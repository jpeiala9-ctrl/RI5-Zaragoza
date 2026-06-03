// ==================== gps-tracker.js ====================
// Versión: 4.0 - Filtro GPS profesional (≤5m), mapa robusto, sin emojis, botón "Terminar sin guardar"
// ====================

const GPSTracker = {
  sesion: null,
  diaIndex: null,
  trackPoints: [],
  watchId: null,
  timerInterval: null,
  stepInterval: null,
  startTime: null,
  pausedTime: 0,
  pauseStart: null,
  isPaused: false,
  isRunning: false,
  map: null,
  polyline: null,
  markerLayer: null,
  leafletLoaded: false,
  tileLayer: null,
  mapRetryCount: 0,

  steps: [],
  stepIndex: 0,
  stepStartTime: null,

  // Buffer para filtro de centroide avanzado (mejora precisión)
  _rawBuffer: [],
  _lastAccepted: null,
  _speedBuffer: [],

  // Filtro Kalman simple (opcional, mejora suavizado)
  _kalman: { q: 0.01, r: 0.1, p: 1, x: null, k: null },

  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  _calcTotalDistance() {
    let d = 0;
    for (let i = 1; i < this.trackPoints.length; i++)
      d += this._haversine(this.trackPoints[i-1].lat, this.trackPoints[i-1].lng,
                           this.trackPoints[i].lat,   this.trackPoints[i].lng);
    return d;
  },

  // ===== FILTRO GPS PROFESIONAL (precisión ≤5m, velocidad máxima 5 m/s) =====
  _filterGPS(lat, lng, accuracy, timestamp) {
    // 1. Descartar precisión muy mala (más de 5m después de los primeros puntos)
    if (accuracy > 5 && this.trackPoints.length > 3) return null;

    // 2. Speed-gate: velocidad máxima realista para corredor: 5.0 m/s (18 km/h)
    if (this._lastAccepted) {
      const dt = Math.max(0.5, (timestamp - this._lastAccepted.ts) / 1000);
      const dist = this._haversine(this._lastAccepted.lat, this._lastAccepted.lng, lat, lng);
      if (dist / dt > 5.0 && dist > 8) {
        // Salto imposible, ignorar este punto
        return null;
      }
    }

    // 3. Buffer de centroide ponderado por precisión (últimas 5 lecturas)
    this._rawBuffer.push({ lat, lng, acc: Math.max(1, accuracy) });
    if (this._rawBuffer.length > 5) this._rawBuffer.shift();
    if (this._rawBuffer.length < 2) return null;

    let sumW = 0, sumLat = 0, sumLng = 0;
    for (const p of this._rawBuffer) {
      const w = 1 / p.acc;
      sumW += w;
      sumLat += p.lat * w;
      sumLng += p.lng * w;
    }
    let sLat = sumLat / sumW;
    let sLng = sumLng / sumW;

    // 4. Si el movimiento es menor a 2 metros, ignorar (ruido de parada)
    if (this._lastAccepted) {
      const movimiento = this._haversine(this._lastAccepted.lat, this._lastAccepted.lng, sLat, sLng);
      if (movimiento < 2) return null;
    }

    // 5. Filtro Kalman para suavizado adicional
    if (this._kalman.x === null) {
      this._kalman.x = { lat: sLat, lng: sLng };
    } else {
      // Predicción
      const predLat = this._kalman.x.lat;
      const predLng = this._kalman.x.lng;
      this._kalman.p += this._kalman.q;
      // Actualización
      this._kalman.k = this._kalman.p / (this._kalman.p + this._kalman.r);
      sLat = predLat + this._kalman.k * (sLat - predLat);
      sLng = predLng + this._kalman.k * (sLng - predLng);
      this._kalman.p *= (1 - this._kalman.k);
    }
    this._kalman.x = { lat: sLat, lng: sLng };

    const punto = { lat: sLat, lng: sLng, ts: timestamp, acc: Math.round(accuracy) };
    this._lastAccepted = punto;
    return punto;
  },

  _fmtTime(ms) {
    const s = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  },

  _fmtPace(distM, ms) {
    if (distM < 50 || ms < 5000) return '--:--';
    const paceS = (ms / 1000) / (distM / 1000);
    const mm = Math.floor(paceS / 60), ss = Math.floor(paceS % 60);
    return `${mm}:${String(ss).padStart(2,'0')}`;
  },

  _buildSteps(sesion) {
    const d = sesion.detalle;
    if (!d) return [{ titulo: 'SESION', duracionMin: sesion.duracion || 45, accion: '' }];
    let pasos = (d.pasosDetallados || []).filter(p => {
      const titulo = (p.titulo || '').toUpperCase();
      const icono = p.icono || '';
      return !titulo.includes('FUERZA') && icono !== '🏋️';
    });
    if (pasos.length === 0) {
      return [
        { titulo: 'CALENTAMIENTO',   duracionMin: d.calentamiento  || 10, accion: `${d.calentamiento||10}' trote suave Z1` },
        { titulo: 'PARTE PRINCIPAL', duracionMin: d.partePrincipal || 25, accion: d.estructura || '' },
        { titulo: 'ENFRIAMIENTO',    duracionMin: d.enfriamiento   || 5,  accion: `${d.enfriamiento||5}' trote suave` }
      ];
    }
    return pasos.map(p => {
      const tit = (p.titulo || '').toUpperCase();
      let durMin = d.partePrincipal || 25;
      if (tit.includes('CALENTAMIENTO'))  durMin = d.calentamiento  || 10;
      else if (tit.includes('ENFRIAMIENTO')) durMin = d.enfriamiento || 5;
      else {
        const nMain = pasos.filter(x => {
          const t = (x.titulo||'').toUpperCase();
          return !t.includes('CALENTAMIENTO') && !t.includes('ENFRIAMIENTO');
        }).length;
        durMin = Math.round((d.partePrincipal || 25) / Math.max(1, nMain));
      }
      return { titulo: tit, duracionMin: durMin, accion: p.accion || '' };
    });
  },

  _loadLeaflet() {
    return new Promise(resolve => {
      if (window.L && this.leafletLoaded) { resolve(); return; }
      if (window.L) { this.leafletLoaded = true; resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => { this.leafletLoaded = true; resolve(); };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  },

  _initMap(lat, lng) {
    if (this.map) {
      this.map.setView([lat, lng], 18);
      return;
    }
    try {
      document.getElementById('gpsNoGPS')?.remove();
      this.map = window.L.map('gpsMap', { zoomControl: false, attributionControl: false, tap: false })
                         .setView([lat, lng], 18);
      this.tileLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB',
        errorTileUrl: '',
      }).addTo(this.map);
      this.tileLayer.on('tileerror', () => {
        if (this.mapRetryCount < 3) {
          this.mapRetryCount++;
          setTimeout(() => {
            if (this.map) this.tileLayer.redraw();
          }, 1000);
        }
      });
      this.polyline = window.L.polyline([], {
        color: '#1e88e5',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(this.map);
      const icon = window.L.divIcon({
        html: `<div style="width:12px;height:12px;background:#1e88e5;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(30,136,229,0.6);"></div>`,
        className: '', iconAnchor: [6, 6]
      });
      this.markerLayer = window.L.marker([lat, lng], { icon }).addTo(this.map);
    } catch(e) { console.warn('Map init error', e); }
  },

  _updateMap(lat, lng) {
    if (!window.L) return;
    if (!this.map) { this._initMap(lat, lng); return; }
    try {
      this.polyline.addLatLng([lat, lng]);
      this.markerLayer.setLatLng([lat, lng]);
      this.map.flyTo([lat, lng], this.map.getZoom(), { duration: 0.5 });
    } catch(e) {}
  },

  _crearPantalla() {
    document.getElementById('gpsTrackerOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'gpsTrackerOverlay';
    ov.style.cssText = `
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:#0a0a0a;
      z-index:999999;
      display:flex;
      flex-direction:column;
      font-family:"Courier New",monospace;
      color:#fff;
      user-select:none;
      -webkit-user-select:none;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
      box-sizing: border-box;
    `;

    ov.innerHTML = `
      <div id="gpsPreLock" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;background:#0a0a0a;">
        <div style="font-size:13px;letter-spacing:3px;color:#c0a060;margin-bottom:8px;">OBTENIENDO SEÑAL GPS</div>
        <div style="font-size:11px;color:#555;margin-bottom:20px;">buscando satélites...</div>
        <div style="width:200px;height:6px;background:#222;border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div id="preLockBar" style="height:100%;width:0%;background:#c0a060;border-radius:3px;transition:width 0.5s,background 0.5s;"></div>
        </div>
        <div id="preLockStatus" style="font-size:11px;color:#555;letter-spacing:1px;">inicializando...</div>
        <button id="preLockForceBtn" onclick="GPSTracker._forzarInicio()" style="display:none;margin-top:32px;padding:10px 20px;border:1px solid #666;background:transparent;color:#aaa;border-radius:8px;cursor:pointer;font-family:monospace;">INICIAR IGUALMENTE</button>
        <button onclick="GPSTracker.cancelar()" style="margin-top:20px;padding:8px 16px;background:transparent;border:none;color:#555;font-size:11px;cursor:pointer;">CANCELAR</button>
      </div>

      <div id="gpsSessionScreen" style="flex:1;display:none;flex-direction:column;">
        <div style="padding: max(10px, env(safe-area-inset-top)) 16px 10px 16px; background:#111; border-bottom:1px solid #222; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
          <div>
            <div style="font-size:10px;color:#555;letter-spacing:2px;">SESION EN CURSO</div>
            <div id="gpsSesionNombre" style="font-size:13px;color:#c0a060;font-weight:bold;letter-spacing:1px;margin-top:1px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div id="gpsSignalDot" style="width:8px;height:8px;border-radius:50%;background:#444;transition:background .5s;"></div>
            <span id="gpsSignalText" style="font-size:10px;color:#555;letter-spacing:1px;">—</span>
          </div>
        </div>

        <div id="gpsStepBar" style="padding:10px 16px;background:#141414;border-bottom:1px solid #1e1e1e;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span id="gpsStepTitle" style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#fff;"></span>
            </div>
            <div style="text-align:right;">
              <div id="gpsStepCountdown" style="font-size:22px;font-weight:bold;color:#c0a060;font-variant-numeric:tabular-nums;">--:--</div>
              <div style="font-size:9px;color:#444;letter-spacing:1px;">RESTANTE</div>
            </div>
          </div>
          <div id="gpsStepDots" style="display:flex;gap:5px;margin-top:4px;"></div>
          <div id="gpsStepDesc" style="font-size:11px;color:#aaa;margin-top:6px;line-height:1.4;max-height:36px;overflow:hidden;"></div>
        </div>

        <div style="flex:1;min-height:0;position:relative;background:#0f0f0f;">
          <div id="gpsMap" style="width:100%;height:100%;"></div>
          <div id="gpsNoGPS" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f0f0f;color:#555;font-size:13px;letter-spacing:2px;text-align:center;pointer-events:none;">
            <div>Esperando posición...</div>
          </div>
        </div>

        <div style="background:#111;border-top:1px solid #222;padding:14px 16px 20px;flex-shrink:0;">
          <div style="text-align:center;margin-bottom:12px;">
            <div id="gpsTimer" style="font-size:52px;font-weight:bold;letter-spacing:4px;color:#fff;line-height:1;font-variant-numeric:tabular-nums;">00:00</div>
            <div style="font-size:9px;color:#333;letter-spacing:3px;margin-top:2px;">TIEMPO TOTAL</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="text-align:center;background:#1a1a1a;border:1px solid #222;border-radius:12px;padding:10px 6px;">
              <div id="gpsDistance" style="font-size:28px;font-weight:bold;color:#c0a060;font-variant-numeric:tabular-nums;">0.00</div>
              <div style="font-size:9px;color:#444;letter-spacing:2px;">KM</div>
            </div>
            <div style="text-align:center;background:#1a1a1a;border:1px solid #222;border-radius:12px;padding:10px 6px;">
              <div id="gpsPace" style="font-size:28px;font-weight:bold;color:#9BB5A0;font-variant-numeric:tabular-nums;">--:--</div>
              <div style="font-size:9px;color:#444;letter-spacing:2px;">MIN/KM</div>
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="gpsPauseBtn" onclick="GPSTracker.togglePause()" style="flex:1;height:50px;border:2px solid #c0a060;background:transparent;color:#c0a060;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;transition:all .2s;">PAUSA</button>
            <button id="gpsNextBtn" onclick="GPSTracker.nextStep()" style="flex:1;height:50px;border:2px solid #9BB5A0;background:#9BB5A0;color:#0a0a0a;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;transition:all .2s;">SIGUIENTE</button>
          </div>
          <div id="gpsPauseBanner" style="display:none;text-align:center;margin-top:10px;color:#c0a060;font-size:12px;letter-spacing:2px;animation:blink 1.2s step-start infinite;">EN PAUSA</div>
        </div>
      </div>

      <div id="gpsConfirm" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10,10,10,.97);z-index:3000;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;pointer-events:all;">
        <div style="font-size:14px;letter-spacing:2px;color:#c0a060;margin-bottom:20px;">FINALIZAR SESION</div>
        <div id="gpsConfirmStats" style="font-size:22px;font-weight:bold;margin-bottom:30px;color:#fff;line-height:1.7;"></div>
        <button id="gpsConfirmYes" style="width:100%;max-width:280px;height:54px;background:#2ecc71;border:none;color:#fff;border-radius:14px;font-size:16px;font-weight:bold;cursor:pointer;font-family:inherit;margin-bottom:12px;">GUARDAR Y SALIR</button>
        <button id="gpsConfirmNo" style="width:100%;max-width:280px;height:48px;background:transparent;border:2px solid #444;color:#aaa;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;margin-bottom:12px;">CONTINUAR</button>
        <button id="gpsConfirmCancel" style="width:100%;max-width:280px;height:48px;background:transparent;border:2px solid #c0392b;color:#c0392b;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;margin-top:8px;">TERMINAR SIN GUARDAR</button>
      </div>

      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes stepPulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,160,96,.4)} 50%{box-shadow:0 0 0 6px rgba(192,160,96,0)} }
        .step-dot-active { animation: stepPulse 1.5s infinite; }
      </style>
    `;
    document.body.appendChild(ov);
    document.getElementById('gpsConfirmYes')?.addEventListener('click', () => GPSTracker._confirmarFinalizar(true));
    document.getElementById('gpsConfirmNo')?.addEventListener('click', () => GPSTracker._cancelarConfirm());
    document.getElementById('gpsConfirmCancel')?.addEventListener('click', () => GPSTracker._confirmarFinalizar(false));
  },

  _renderStepDots() {
    const container = document.getElementById('gpsStepDots');
    if (!container) return;
    container.innerHTML = this.steps.map((s, i) => {
      const active = i === this.stepIndex;
      const done = i < this.stepIndex;
      const bg = done ? '#9BB5A0' : active ? '#c0a060' : '#2a2a2a';
      const cls = active ? 'step-dot-active' : '';
      return `<div class="${cls}" style="height:4px;flex:1;border-radius:2px;background:${bg};transition:background .3s;" title="${s.titulo}"></div>`;
    }).join('');
  },

  _renderStepInfo() {
    const s = this.steps[this.stepIndex];
    if (!s) return;
    const titEl = document.getElementById('gpsStepTitle');
    const descEl = document.getElementById('gpsStepDesc');
    const nextBtn = document.getElementById('gpsNextBtn');
    if (titEl) titEl.textContent = s.titulo;
    if (descEl) descEl.textContent = s.accion;
    if (nextBtn) {
      const esUltimo = this.stepIndex >= this.steps.length - 1;
      nextBtn.textContent = esUltimo ? 'FINALIZAR' : 'SIGUIENTE';
      nextBtn.style.background = esUltimo ? '#c0392b' : '#9BB5A0';
      nextBtn.style.borderColor = esUltimo ? '#c0392b' : '#9BB5A0';
      nextBtn.style.color = '#0a0a0a';
    }
    this._renderStepDots();
  },

  async iniciar(sesion, diaIndex) {
    if (this.isRunning) { Utils.showToast('Ya hay una sesion en curso', 'warning'); return; }
    if (!navigator.geolocation) { Utils.showToast('GPS no disponible', 'error'); return; }
    this.sesion = sesion;
    this.diaIndex = diaIndex;
    this.trackPoints = [];
    this._rawBuffer = [];
    this._lastAccepted = null;
    this._kalman = { q: 0.01, r: 0.1, p: 1, x: null, k: null };
    this.isPaused = false;
    this.pausedTime = 0;
    this.pauseStart = null;
    this.map = null;
    this.polyline = null;
    this.markerLayer = null;
    this.mapRetryCount = 0;
    this.steps = this._buildSteps(sesion);
    this.stepIndex = 0;
    document.getElementById('detalleSesion')?.classList.remove('visible');
    document.getElementById('modalOverlay')?.classList.remove('visible');
    this._crearPantalla();
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (sesion.detalle?.nombre || sesion.tipo || 'SESION').toUpperCase();
    this._loadLeaflet();
    this._iniciarPreLock();
  },

  _iniciarPreLock() {
    let preLockStarted = Date.now();
    let forceBtnShown = false;
    this.watchId = navigator.geolocation.watchPosition(pos => {
      const acc = pos.coords.accuracy;
      const pct = Math.max(0, Math.min(100, (1 - acc / 60) * 100));
      const bar = document.getElementById('preLockBar');
      const status = document.getElementById('preLockStatus');
      const forceBtn = document.getElementById('preLockForceBtn');
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = acc < 10 ? '#6bd46b' : acc < 20 ? '#f1c40f' : '#c0a060';
      }
      if (acc < 10) {
        if (status) status.textContent = 'señal lista';
        setTimeout(() => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, acc), 800);
      } else {
        if (status) status.textContent = acc < 25 ? 'señal aceptable...' : 'buscando satélites...';
        if (!forceBtnShown && Date.now() - preLockStarted > 20000) {
          forceBtnShown = true;
          if (forceBtn) forceBtn.style.display = 'block';
        }
      }
    }, err => {
      const s = document.getElementById('preLockStatus');
      if (s) s.textContent = err.code === 1 ? 'permiso denegado' : 'sin señal GPS';
      const forceBtn = document.getElementById('preLockForceBtn');
      if (forceBtn) forceBtn.style.display = 'block';
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  },

  _forzarInicio() {
    navigator.geolocation.getCurrentPosition(
      pos => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => this._arrancarSesion(0, 0, 999),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  },

  _arrancarSesion(lat, lng, acc) {
    if (this.isRunning) return;
    const preLock = document.getElementById('gpsPreLock');
    const session = document.getElementById('gpsSessionScreen');
    if (preLock) preLock.style.display = 'none';
    if (session) session.style.display = 'flex';
    this._renderStepInfo();
    if (lat !== 0) this._initMap(lat, lng);
    this._rawBuffer = [];
    this._lastAccepted = null;
    this._kalman = { q: 0.01, r: 0.1, p: 1, x: null, k: null };
    this.isRunning = true;
    this.startTime = Date.now();
    this.stepStartTime = Date.now();
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    this.timerInterval = setInterval(() => this._tick(), 1000);
    if (typeof Utils.vibrate === 'function') Utils.vibrate([50, 50, 100]);
  },

  cancelar() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    clearInterval(this.timerInterval);
    clearInterval(this.stepInterval);
    document.getElementById('gpsTrackerOverlay')?.remove();
  },

  _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const dot = document.getElementById('gpsSignalDot');
    const txt = document.getElementById('gpsSignalText');
    if (dot) dot.style.background = accuracy < 10 ? '#6bd46b' : accuracy < 25 ? '#f1c40f' : '#e74c3c';
    if (txt) txt.textContent = `±${Math.round(accuracy)}m`;
    if (this.isPaused) return;
    const punto = this._filterGPS(lat, lng, accuracy, Date.now());
    if (!punto) return;
    this.trackPoints.push(punto);
    this._updateMap(punto.lat, punto.lng);
    this._updateStats();
  },

  _onGPSError(err) {
    const txt = document.getElementById('gpsSignalText');
    if (txt) txt.textContent = err.code === 1 ? 'DENEGADO' : 'ERROR';
  },

  _getElapsed() {
    if (!this.startTime) return 0;
    if (this.isPaused) return (this.pauseStart - this.startTime) - this.pausedTime;
    return (Date.now() - this.startTime) - this.pausedTime;
  },

  _getStepElapsed() {
    if (!this.stepStartTime) return 0;
    if (this.isPaused) return (this.pauseStart - this.stepStartTime);
    return Date.now() - this.stepStartTime;
  },

  _tick() {
    if (!this.isRunning) return;
    const timerEl = document.getElementById('gpsTimer');
    if (timerEl) timerEl.textContent = this._fmtTime(this._getElapsed());
    const step = this.steps[this.stepIndex];
    if (step) {
      const durMs = step.duracionMin * 60 * 1000;
      const restante = Math.max(0, durMs - this._getStepElapsed());
      const cdEl = document.getElementById('gpsStepCountdown');
      if (cdEl) {
        cdEl.textContent = this._fmtTime(restante);
        cdEl.style.color = restante === 0 ? '#e74c3c' : '#c0a060';
      }
      const nextBtn = document.getElementById('gpsNextBtn');
      if (nextBtn && restante === 0) {
        nextBtn.style.animation = 'stepPulse 0.8s ease infinite';
      }
    }
  },

  _updateStats() {
    const distM = this._calcTotalDistance();
    const elapsed = this._getElapsed();
    const distEl = document.getElementById('gpsDistance');
    const paceEl = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = (distM / 1000).toFixed(2);
    if (paceEl) paceEl.textContent = this._fmtPace(distM, elapsed);
  },

  togglePause() {
    if (!this.isRunning) return;
    const btn = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');
    if (this.isPaused) {
      this.pausedTime += Date.now() - this.pauseStart;
      this.pauseStart = null;
      this.isPaused = false;
      if (btn) { btn.innerHTML = 'PAUSA'; btn.style.color = '#c0a060'; btn.style.borderColor = '#c0a060'; }
      if (banner) banner.style.display = 'none';
      if (typeof Utils.vibrate === 'function') Utils.vibrate(50);
    } else {
      this.pauseStart = Date.now();
      this.isPaused = true;
      if (btn) { btn.innerHTML = 'REANUDAR'; btn.style.color = '#9BB5A0'; btn.style.borderColor = '#9BB5A0'; }
      if (banner) banner.style.display = 'block';
      if (typeof Utils.vibrate === 'function') Utils.vibrate([50,50]);
    }
  },

  nextStep() {
    if (!this.isRunning) return;
    const esUltimo = this.stepIndex >= this.steps.length - 1;
    if (esUltimo) {
      this._mostrarConfirm();
    } else {
      this.stepIndex++;
      this.stepStartTime = Date.now();
      const nextBtn = document.getElementById('gpsNextBtn');
      if (nextBtn) nextBtn.style.animation = '';
      this._renderStepInfo();
      if (typeof Utils.vibrate === 'function') Utils.vibrate(60);
    }
  },

  _mostrarConfirm() {
    const distKm = (this._calcTotalDistance() / 1000).toFixed(2);
    const elapsed = this._fmtTime(this._getElapsed());
    const statsEl = document.getElementById('gpsConfirmStats');
    if (statsEl) statsEl.innerHTML = `${distKm} km\n${elapsed}`;
    const confirmDiv = document.getElementById('gpsConfirm');
    if (!confirmDiv) return;
    if (!document.getElementById('gpsEditDistance')) {
      const editDiv = document.createElement('div');
      editDiv.style.margin = '15px 0';
      editDiv.innerHTML = `
        <label style="font-size:12px; color:#aaa; letter-spacing:1px;">Editar distancia (km):</label>
        <input type="number" id="gpsEditDistance" step="0.01" value="${distKm}" style="
          width:100%;
          max-width:180px;
          margin:8px auto;
          padding:8px 12px;
          background:#222;
          border:1px solid #c0a060;
          border-radius:10px;
          color:#fff;
          text-align:center;
          font-family:monospace;
          display:block;
        ">
      `;
      statsEl?.insertAdjacentElement('afterend', editDiv);
    } else {
      document.getElementById('gpsEditDistance').value = distKm;
    }
    Object.assign(confirmDiv.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(10,10,10,0.97)',
      zIndex: '3000',
      padding: '30px',
      textAlign: 'center',
      pointerEvents: 'all'
    });
  },

  _cancelarConfirm() {
    const conf = document.getElementById('gpsConfirm');
    if (conf) conf.style.display = 'none';
  },

  async _confirmarFinalizar(guardar = true) {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerInterval);
    if (this.watchId !== null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
    const elapsedMs = this._getElapsed();
    document.getElementById('gpsTrackerOverlay')?.remove();

    if (!guardar) {
      Utils.showToast('Sesion descartada', 'info');
      return;
    }

    let distKm = this._calcTotalDistance() / 1000;
    const editInput = document.getElementById('gpsEditDistance');
    if (editInput) {
      const newDist = parseFloat(editInput.value);
      if (!isNaN(newDist) && newDist > 0) distKm = newDist;
    }

    Utils.showLoading();
    try {
      await this._guardarYPublicar(distKm, elapsedMs);
      Utils.hideLoading();
      Utils.showToast(`Sesion guardada · ${distKm.toFixed(2)} km · ${this._fmtTime(elapsedMs)}`, 'success', 5000);
      if (typeof Utils.launchConfetti === 'function') Utils.launchConfetti();
      if (typeof Utils.vibrate === 'function') Utils.vibrate([100,50,100,50,200]);
      if (typeof Utils.playSound === 'function') Utils.playSound('success');
    } catch(err) {
      console.error('Error guardando sesion GPS:', err);
      Utils.hideLoading();
      Utils.showToast(`Error GPS: ${err.message || 'desconocido'}`, 'error', 6000);
    }
  },

  async _guardarYPublicar(distKm, elapsedMs) {
    const uid = AppState?.currentUserId;
    if (!uid || !AppState?.planActualId) throw new Error('Sin usuario o plan activo');
    const planId = AppState.planActualId;
    const planRef = firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId);
    const ptsFull = this._decimarPuntos(this.trackPoints, 120);
    const ptsWall = this._decimarPuntos(ptsFull, 60);
    const trackData = {
      points: ptsFull.map(p => ({ lat: p.lat, lng: p.lng })),
      distanceKm: parseFloat(distKm.toFixed(3)),
      durationMs: elapsedMs,
      recordedAt: new Date().toISOString(),
      sesionIndex: this.diaIndex,
      planId
    };
    try {
      await firebaseServices.db.collection('users').doc(uid).collection('gps_tracks').add(trackData);
    } catch (e) { console.warn('gps_tracks sin permiso (no critico):', e.message); }
    try {
      await planRef.update({ [`gpsTrack.${this.diaIndex}`]: { distanceKm: trackData.distanceKm, durationMs: trackData.durationMs, recordedAt: trackData.recordedAt } });
    } catch (e) { console.warn('No se pudo guardar metadata GPS en el plan:', e.message); }
    // Llamar a marcarSesionRealizada con skipToast = true para evitar duplicado
    await PlanGenerator.marcarSesionRealizada(this.diaIndex, true, true);
    const planDoc = await planRef.get();
    const wallEntryId = planDoc.data()?.wallEntryId?.[this.diaIndex];
    if (wallEntryId) {
      await firebaseServices.db.collection('globalFeed').doc(wallEntryId).update({
        hasGPS: true,
        trackPoints: ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
        gpsDistanceKm: parseFloat(distKm.toFixed(3)),
        gpsDurationMs: elapsedMs,
        distancia: parseFloat(distKm.toFixed(3)),
        duration: Math.round(elapsedMs / 60000)
      });
    }
  },

  _decimarPuntos(pts, max) {
    if (pts.length <= max) return pts;
    const step = Math.ceil(pts.length / max);
    const res = [];
    for (let i = 0; i < pts.length; i += step) res.push(pts[i]);
    if (res[res.length-1] !== pts[pts.length-1]) res.push(pts[pts.length-1]);
    return res;
  },

  renderTrackSVG(points, width = 320, height = 130) {
    if (!points || points.length < 2) return '';
    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLng = maxLng - minLng || 0.0001, rangeLat = maxLat - minLat || 0.0001;
    const pad = 14, W = width - pad*2, H = height - pad*2;
    const scale = Math.min(W/rangeLng, H/rangeLat);
    const offX = pad + (W - rangeLng*scale)/2, offY = pad + (H - rangeLat*scale)/2;
    const toXY = p => `${(offX+(p.lng-minLng)*scale).toFixed(1)},${(offY+(maxLat-p.lat)*scale).toFixed(1)}`;
    const pathD = 'M '+points.map(toXY).join(' L ');
    const s = toXY(points[0]).split(','), e = toXY(points[points.length-1]).split(',');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="border-radius:10px;background:#f8f9fa;display:block;width:100%;max-width:${width}px;" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#1e88e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <circle cx="${s[0]}" cy="${s[1]}" r="5" fill="#2ecc71" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${e[0]}" cy="${e[1]}" r="5" fill="#e74c3c" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  }
};

window.GPSTracker = GPSTracker;
console.log('GPSTracker v4.0 - filtro profesional (≤5m), suavizado Kalman, mapa robusto, sin emojis');