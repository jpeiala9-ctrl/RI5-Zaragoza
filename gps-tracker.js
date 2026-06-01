// ==================== gps-tracker.js ====================
// Versión: 2.3 - Finalización garantizada + salir sin guardar
// ====================

const GPSTracker = {

  // ===== ESTADO =====
  sesion:        null,
  diaIndex:      null,
  trackPoints:   [],
  watchId:       null,
  timerInterval: null,
  stepInterval:  null,
  startTime:     null,
  pausedTime:    0,
  pauseStart:    null,
  isPaused:      false,
  isRunning:     false,
  map:           null,
  polyline:      null,
  markerLayer:   null,
  leafletLoaded: false,

  steps:         [],
  stepIndex:     0,
  stepStartTime: null,

  _rawBuffer:    [],
  _lastAccepted: null,

  // ===== HAVERSINE =====
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

  // ===== FILTRO GPS =====
  _filterGPS(lat, lng, accuracy, timestamp) {
    if (accuracy > 45 && this.trackPoints.length > 3) return null;
    if (this._lastAccepted) {
      const dt  = Math.max(0.5, (timestamp - this._lastAccepted.ts) / 1000);
      const dist = this._haversine(this._lastAccepted.lat, this._lastAccepted.lng, lat, lng);
      if (dist / dt > 7.5 && dist > 20) return null;
    }
    this._rawBuffer.push({ lat, lng, acc: Math.max(1, accuracy) });
    if (this._rawBuffer.length > 4) this._rawBuffer.shift();
    if (this._rawBuffer.length < 2) return null;

    let sumW = 0, sumLat = 0, sumLng = 0;
    for (const p of this._rawBuffer) {
      const w = 1 / p.acc;
      sumW   += w;
      sumLat += p.lat * w;
      sumLng += p.lng * w;
    }
    const sLat = sumLat / sumW;
    const sLng = sumLng / sumW;

    if (this._lastAccepted) {
      const movimiento = this._haversine(this._lastAccepted.lat, this._lastAccepted.lng, sLat, sLng);
      if (movimiento < 2) return null;
    }

    const punto = { lat: sLat, lng: sLng, ts: timestamp, acc: Math.round(accuracy) };
    this._lastAccepted = punto;
    return punto;
  },

  // ===== FORMATO =====
  _fmtTime(ms) {
    const s = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  },

  _fmtPace(distM, ms) {
    if (distM < 30 || ms < 5000) return '--:--';
    const paceS = (ms / 1000) / (distM / 1000);
    const mm = Math.floor(paceS / 60), ss = Math.floor(paceS % 60);
    return `${mm}:${String(ss).padStart(2,'0')}`;
  },

  // ===== PASOS =====
  _buildSteps(sesion) {
    const d = sesion.detalle;
    if (!d) return [{ icono:'💪', titulo:'SESIÓN', duracionMin: sesion.duracion || 45, accion:'' }];
    const pasos = d.pasosDetallados || [];
    if (pasos.length === 0) {
      return [
        { icono:'🔥', titulo:'CALENTAMIENTO',   duracionMin: d.calentamiento  || 10, accion: `${d.calentamiento||10}' trote suave Z1` },
        { icono:'💪', titulo:'PARTE PRINCIPAL', duracionMin: d.partePrincipal || 25, accion: d.estructura || '' },
        { icono:'🧘', titulo:'ENFRIAMIENTO',    duracionMin: d.enfriamiento   || 5,  accion: `${d.enfriamiento||5}' trote suave` }
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
      return { icono: p.icono||'💪', titulo: tit, duracionMin: durMin, accion: p.accion || '' };
    });
  },

  // ===== LEAFLET =====
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
    if (this.map || !window.L) return;
    try {
      document.getElementById('gpsNoGPS')?.remove();
      this.map = window.L.map('gpsMap', { zoomControl:false, attributionControl:false, tap:false })
                         .setView([lat, lng], 16);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                         { maxZoom:19 }).addTo(this.map);
      this.polyline = window.L.polyline([], {
        color:'#c0a060', weight:4, opacity:0.9, lineJoin:'round', lineCap:'round'
      }).addTo(this.map);
      const icon = window.L.divIcon({
        html:`<div style="width:14px;height:14px;background:#c0a060;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(192,160,96,.9);"></div>`,
        className:'', iconAnchor:[7,7]
      });
      this.markerLayer = window.L.marker([lat,lng],{icon}).addTo(this.map);
    } catch(e) { console.warn('Map init error',e); }
  },

  _updateMap(lat, lng) {
    if (!window.L) return;
    if (!this.map) { this._initMap(lat, lng); return; }
    try {
      this.polyline.addLatLng([lat, lng]);
      this.markerLayer.setLatLng([lat, lng]);
      this.map.panTo([lat, lng], { animate:true, duration:0.8 });
    } catch(e) {}
  },

  // ===== PANTALLA COMPLETA =====
  _crearPantalla() {
    document.getElementById('gpsTrackerOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'gpsTrackerOverlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a0a;z-index:999999;display:flex;flex-direction:column;font-family:"Courier New",monospace;color:#fff;user-select:none;-webkit-user-select:none;';

    ov.innerHTML = `
      <!-- PRE-LOCK: pantalla de espera GPS (manual) -->
      <div id="gpsPreLock" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;background:#0a0a0a;">
        <div style="font-size:64px;margin-bottom:20px;">📡</div>
        <div style="font-size:13px;letter-spacing:3px;color:#c0a060;margin-bottom:8px;">ADQUIRIENDO SEÑAL GPS</div>
        <div id="preLockAccText" style="font-size:28px;font-weight:bold;margin:12px 0;">—</div>
        <div style="font-size:11px;color:#555;margin-bottom:20px;">precisión</div>
        <div style="width:200px;height:6px;background:#222;border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div id="preLockBar" style="height:100%;width:0%;background:#c0a060;border-radius:3px;transition:width 0.5s,background 0.5s;"></div>
        </div>
        <div id="preLockStatus" style="font-size:11px;color:#555;letter-spacing:1px;margin-bottom:16px;">buscando satélites...</div>
        
        <button id="preLockStartBtn" onclick="GPSTracker._comenzarManual()" disabled style="padding:12px 28px;border:2px solid #c0a060;background:#c0a060;color:#0a0a0a;border-radius:30px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit;letter-spacing:2px;margin-bottom:12px;opacity:0.5;transition:0.2s;">COMENZAR</button>
        
        <button id="preLockForceBtn" onclick="GPSTracker._forzarInicio()" style="display:none;padding:12px 24px;border:2px solid #666;background:transparent;color:#888;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;letter-spacing:1px;margin-bottom:12px;">INICIAR IGUALMENTE</button>
        
        <button onclick="GPSTracker.cancelar()" style="margin-top:8px;padding:10px 20px;border:none;background:transparent;color:#555;font-size:12px;cursor:pointer;font-family:inherit;letter-spacing:1px;">CANCELAR</button>
      </div>

      <!-- PANTALLA DE SESIÓN EN CURSO -->
      <div id="gpsSessionScreen" style="flex:1;display:none;flex-direction:column;">
        <div style="padding:10px 16px;background:#111;border-bottom:1px solid #222;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div>
            <div style="font-size:10px;color:#555;letter-spacing:2px;">SESIÓN EN CURSO</div>
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
              <span id="gpsStepIcon" style="font-size:20px;">💪</span>
              <span id="gpsStepTitle" style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#fff;"></span>
            </div>
            <div style="text-align:right;">
              <div id="gpsStepCountdown" style="font-size:22px;font-weight:bold;color:#c0a060;font-variant-numeric:tabular-nums;">--:--</div>
              <div style="font-size:9px;color:#444;letter-spacing:1px;">RESTANTE</div>
            </div>
          </div>
          <div id="gpsStepDots" style="display:flex;gap:5px;margin-top:4px;"></div>
          <div id="gpsStepDesc" style="font-size:11px;color:#555;margin-top:6px;line-height:1.4;max-height:36px;overflow:hidden;"></div>
        </div>

        <div style="flex:1;min-height:0;position:relative;background:#0f0f0f;">
          <div id="gpsMap" style="width:100%;height:100%;"></div>
          <div id="gpsNoGPS" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f0f0f;color:#555;font-size:13px;letter-spacing:2px;text-align:center;pointer-events:none;">
            <div style="font-size:40px;margin-bottom:12px;opacity:.5;">🗺️</div>
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
            <button id="gpsPauseBtn" onclick="GPSTracker.togglePause()" style="flex:1;height:50px;border:2px solid #c0a060;background:transparent;color:#c0a060;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;letter-spacing:1px;font-family:inherit;transition:all .2s;">⏸ PAUSA</button>
            <button id="gpsNextBtn"  onclick="GPSTracker.nextStep()"   style="flex:1;height:50px;border:2px solid #9BB5A0;background:#9BB5A0;color:#0a0a0a;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;letter-spacing:1px;font-family:inherit;transition:all .2s;">SIGUIENTE →</button>
          </div>
          <div id="gpsPauseBanner" style="display:none;text-align:center;margin-top:10px;color:#c0a060;font-size:12px;letter-spacing:2px;animation:blink 1.2s step-start infinite;">⏸ EN PAUSA</div>
        </div>
      </div>

      <!-- CONFIRM INLINE (mejorado) -->
      <div id="gpsConfirm" style="display:none;position:absolute;inset:0;background:rgba(10,10,10,.95);z-index:10;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">⏹️</div>
        <div style="font-size:14px;letter-spacing:2px;color:#c0a060;margin-bottom:20px;">FINALIZAR SESIÓN</div>
        <div id="gpsConfirmStats" style="font-size:22px;font-weight:bold;margin-bottom:30px;color:#fff;line-height:1.7;"></div>
        <button id="confirmSaveBtn" style="width:100%;max-width:280px;height:54px;background:#c0392b;border:none;color:#fff;border-radius:14px;font-size:16px;font-weight:bold;cursor:pointer;font-family:inherit;letter-spacing:1px;margin-bottom:12px;">✅ GUARDAR Y SALIR</button>
        <button id="confirmExitBtn" style="width:100%;max-width:280px;height:48px;background:transparent;border:2px solid #555;color:#aaa;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;letter-spacing:1px;margin-bottom:8px;">⚠️ SALIR SIN GUARDAR</button>
        <button id="confirmCancelBtn" style="width:100%;max-width:280px;background:transparent;border:none;color:#555;font-size:12px;cursor:pointer;font-family:inherit;letter-spacing:1px;">CONTINUAR SESIÓN</button>
      </div>

      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes stepPulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,160,96,.4)} 50%{box-shadow:0 0 0 6px rgba(192,160,96,0)} }
        .step-dot-active { animation: stepPulse 1.5s infinite; }
      </style>
    `;
    document.body.appendChild(ov);

    // Asignar eventos manualmente para evitar problemas con onclick global
    const saveBtn = document.getElementById('confirmSaveBtn');
    const exitBtn = document.getElementById('confirmExitBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    if (saveBtn) saveBtn.onclick = () => this._confirmarFinalizar();
    if (exitBtn) exitBtn.onclick = () => this._salirSinGuardar();
    if (cancelBtn) cancelBtn.onclick = () => this._cancelarConfirm();
  },

  // ===== STEP DOTS =====
  _renderStepDots() {
    const container = document.getElementById('gpsStepDots');
    if (!container) return;
    container.innerHTML = this.steps.map((s, i) => {
      const active   = i === this.stepIndex;
      const done     = i < this.stepIndex;
      const bg       = done ? '#9BB5A0' : active ? '#c0a060' : '#2a2a2a';
      const cls      = active ? 'step-dot-active' : '';
      return `<div class="${cls}" style="height:4px;flex:1;border-radius:2px;background:${bg};transition:background .3s;" title="${s.titulo}"></div>`;
    }).join('');
  },

  _renderStepInfo() {
    const s = this.steps[this.stepIndex];
    if (!s) return;
    const iconEl  = document.getElementById('gpsStepIcon');
    const titEl   = document.getElementById('gpsStepTitle');
    const descEl  = document.getElementById('gpsStepDesc');
    const nextBtn = document.getElementById('gpsNextBtn');
    if (iconEl)  iconEl.textContent  = s.icono;
    if (titEl)   titEl.textContent   = s.titulo;
    if (descEl)  descEl.textContent  = s.accion;
    if (nextBtn) {
      const esUltimo = this.stepIndex >= this.steps.length - 1;
      nextBtn.textContent     = esUltimo ? '■ FINALIZAR' : 'SIGUIENTE →';
      nextBtn.style.background = esUltimo ? '#c0392b' : '#9BB5A0';
      nextBtn.style.borderColor= esUltimo ? '#c0392b' : '#9BB5A0';
      nextBtn.style.color      = '#0a0a0a';
    }
    this._renderStepDots();
  },

  // ===== INICIO =====
  async iniciar(sesion, diaIndex) {
    if (this.isRunning) { Utils.showToast('⚠️ Ya hay una sesión en curso', 'warning'); return; }
    if (!navigator.geolocation) { Utils.showToast('❌ GPS no disponible en este dispositivo', 'error'); return; }

    this.sesion      = sesion;
    this.diaIndex    = diaIndex;
    this.trackPoints = [];
    this._rawBuffer  = [];
    this._lastAccepted = null;
    this.isPaused    = false;
    this.pausedTime  = 0;
    this.pauseStart  = null;
    this.map         = null;
    this.polyline    = null;
    this.markerLayer = null;

    this.steps     = this._buildSteps(sesion);
    this.stepIndex = 0;

    document.getElementById('detalleSesion')?.classList.remove('visible');
    document.getElementById('modalOverlay')?.classList.remove('visible');

    this._crearPantalla();

    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (sesion.detalle?.nombre || sesion.tipo || 'SESIÓN').toUpperCase();

    this._loadLeaflet();
    this._iniciarPreLockManual();
  },

  _iniciarPreLockManual() {
    let preLockStarted = Date.now();
    let forceBtnShown  = false;
    let goodSignalReceived = false;

    this.watchId = navigator.geolocation.watchPosition(pos => {
      const acc = pos.coords.accuracy;
      const pct = Math.max(0, Math.min(100, (1 - acc / 60) * 100));

      const accText = document.getElementById('preLockAccText');
      const bar     = document.getElementById('preLockBar');
      const status  = document.getElementById('preLockStatus');
      const forceBtn= document.getElementById('preLockForceBtn');
      const startBtn= document.getElementById('preLockStartBtn');

      if (accText) accText.textContent = `±${Math.round(acc)} m`;
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = acc < 15 ? '#6bd46b' : acc < 30 ? '#f1c40f' : '#c0a060';
      }

      if (acc < 20) {
        if (!goodSignalReceived) {
          goodSignalReceived = true;
          if (status) status.innerHTML = '✅ GPS adquirido';
          if (startBtn) {
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.style.background = '#9BB5A0';
            startBtn.style.borderColor = '#9BB5A0';
          }
        }
      } else {
        if (goodSignalReceived) {
          goodSignalReceived = false;
          if (status) status.innerHTML = acc < 35 ? 'señal aceptable...' : 'buscando satélites...';
          if (startBtn) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.5';
            startBtn.style.background = '#c0a060';
            startBtn.style.borderColor = '#c0a060';
          }
        }
      }

      if (!forceBtnShown && Date.now() - preLockStarted > 20000) {
        forceBtnShown = true;
        if (forceBtn) forceBtn.style.display = 'block';
      }
    }, err => {
      const s = document.getElementById('preLockStatus');
      if (s) s.textContent = err.code === 1 ? '❌ permiso denegado' : '❌ sin señal GPS';
      const forceBtn = document.getElementById('preLockForceBtn');
      if (forceBtn) forceBtn.style.display = 'block';
      const startBtn = document.getElementById('preLockStartBtn');
      if (startBtn) startBtn.disabled = true;
    }, { enableHighAccuracy:true, maximumAge:1000, timeout:15000 });
  },

  _comenzarManual() {
    const startBtn = document.getElementById('preLockStartBtn');
    if (startBtn && startBtn.disabled) {
      Utils.showToast('📡 Esperando señal GPS estable...', 'warning');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => this._arrancarSesion(0, 0, 999)
    , { enableHighAccuracy:true, timeout:5000 });
  },

  _forzarInicio() {
    navigator.geolocation.getCurrentPosition(
      pos => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => this._arrancarSesion(0, 0, 999)
    , { enableHighAccuracy:true, timeout:5000 });
  },

  _arrancarSesion(lat, lng, acc) {
    if (this.isRunning) return;

    const preLock  = document.getElementById('gpsPreLock');
    const session  = document.getElementById('gpsSessionScreen');
    if (preLock)  preLock.style.display  = 'none';
    if (session)  { session.style.display = 'flex'; }

    this._renderStepInfo();

    if (lat !== 0) this._initMap(lat, lng);

    this._rawBuffer  = [];
    this._lastAccepted = null;
    this.isRunning   = true;
    this.startTime   = Date.now();
    this.stepStartTime = Date.now();

    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onGPSError(err),
      { enableHighAccuracy:true, maximumAge:2000, timeout:15000 }
    );

    this.timerInterval = setInterval(() => this._tick(), 1000);

    if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50, 100]);
  },

  cancelar() {
    this._limpiarRecursos();
    document.getElementById('gpsTrackerOverlay')?.remove();
  },

  // ===== LIMPIEZA SEGURA =====
  _limpiarRecursos() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    this.isRunning = false;
    this.isPaused = false;
  },

  // ===== GPS =====
  _onPosition(pos) {
    const { latitude:lat, longitude:lng, accuracy } = pos.coords;
    const dot  = document.getElementById('gpsSignalDot');
    const txt  = document.getElementById('gpsSignalText');
    if (dot) dot.style.background = accuracy < 15 ? '#6bd46b' : accuracy < 35 ? '#f1c40f' : '#e74c3c';
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
      const durMs      = step.duracionMin * 60 * 1000;
      const restante   = Math.max(0, durMs - this._getStepElapsed());
      const cdEl       = document.getElementById('gpsStepCountdown');
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
    const distM    = this._calcTotalDistance();
    const elapsed  = this._getElapsed();
    const distEl   = document.getElementById('gpsDistance');
    const paceEl   = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = (distM / 1000).toFixed(2);
    if (paceEl) paceEl.textContent = this._fmtPace(distM, elapsed);
  },

  togglePause() {
    if (!this.isRunning) return;
    const btn    = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');
    if (this.isPaused) {
      this.pausedTime += Date.now() - this.pauseStart;
      this.pauseStart  = null;
      this.isPaused    = false;
      if (btn)    { btn.innerHTML = '⏸ PAUSA'; btn.style.color = '#c0a060'; btn.style.borderColor = '#c0a060'; }
      if (banner) banner.style.display = 'none';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(50);
    } else {
      this.pauseStart = Date.now();
      this.isPaused   = true;
      if (btn)    { btn.innerHTML = '▶ REANUDAR'; btn.style.color = '#9BB5A0'; btn.style.borderColor = '#9BB5A0'; }
      if (banner) banner.style.display = 'block';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50,50]);
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
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(60);
    }
  },

  _mostrarConfirm() {
    const distKm  = (this._calcTotalDistance() / 1000).toFixed(2);
    const elapsed = this._fmtTime(this._getElapsed());
    const statsEl = document.getElementById('gpsConfirmStats');
    if (statsEl) statsEl.innerHTML = `📏 ${distKm} km<br>⏱️ ${elapsed}`;
    const conf = document.getElementById('gpsConfirm');
    if (conf) conf.style.display = 'flex';
  },

  _cancelarConfirm() {
    const conf = document.getElementById('gpsConfirm');
    if (conf) conf.style.display = 'none';
  },

  // ===== SALIR SIN GUARDAR (nuevo) =====
  _salirSinGuardar() {
    this._limpiarRecursos();
    document.getElementById('gpsTrackerOverlay')?.remove();
    if (typeof Utils !== 'undefined') {
      Utils.showToast('Sesión cancelada sin guardar', 'warning', 3000);
    }
  },

  // ===== FINALIZAR CON GUARDADO (corregido) =====
  async _confirmarFinalizar() {
    if (!this.isRunning) return;

    // Deshabilitar botón para evitar doble clic
    const saveBtn = document.getElementById('confirmSaveBtn');
    if (saveBtn) saveBtn.disabled = true;

    Utils.showLoading('Guardando sesión...');

    try {
      const distKm   = this._calcTotalDistance() / 1000;
      const elapsedMs = this._getElapsed();

      // Guardar en Firebase
      await this._guardarYPublicar(distKm, elapsedMs);

      // Si llegamos aquí, todo correcto
      this._limpiarRecursos();
      document.getElementById('gpsTrackerOverlay')?.remove();

      Utils.hideLoading();
      Utils.showToast(`✅ Sesión guardada · ${distKm.toFixed(2)} km · ${this._fmtTime(elapsedMs)}`, 'success', 5000);
      if (typeof Utils.launchConfetti === 'function') Utils.launchConfetti();
      if (typeof Utils.vibrate === 'function') Utils.vibrate([100,50,100,50,200]);
      if (typeof Utils.playSound === 'function') Utils.playSound('success');
    } catch (err) {
      console.error('Error guardando sesión GPS:', err);
      Utils.hideLoading();
      Utils.showToast('❌ Error al guardar. Puedes usar "SALIR SIN GUARDAR"', 'error', 5000);
      // Reactivar botón
      if (saveBtn) saveBtn.disabled = false;
      // No cerramos la pantalla
    }
  },

  // ===== GUARDAR Y PUBLICAR (con validaciones) =====
  async _guardarYPublicar(distKm, elapsedMs) {
    // Verificar dependencias globales
    if (!window.firebaseServices) throw new Error('firebaseServices no está disponible');
    if (!window.AppState) throw new Error('AppState no está disponible');
    if (!window.PlanGenerator) console.warn('PlanGenerator no disponible, algunas funciones podrían fallar');

    const uid = AppState?.currentUserId;
    if (!uid) throw new Error('Usuario no autenticado');
    const planId = AppState?.planActualId;
    if (!planId) throw new Error('Plan activo no encontrado');

    const planRef = firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId);

    const ptsFull = this._decimarPuntos(this.trackPoints, 120);
    const ptsWall = this._decimarPuntos(ptsFull, 60);

    const trackData = {
      points:      ptsFull.map(p => ({ lat:p.lat, lng:p.lng })),
      distanceKm:  parseFloat(distKm.toFixed(3)),
      durationMs:  elapsedMs,
      recordedAt:  new Date().toISOString(),
      sesionIndex: this.diaIndex,
      planId
    };

    await firebaseServices.db.collection('users').doc(uid).collection('gps_tracks').add(trackData);
    await planRef.update({ [`gpsTrack.${this.diaIndex}`]: trackData });
    await planRef.update({ [`sesionesRealizadas.${this.diaIndex}`]: true });

    if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
    AppState.sesionesRealizadas[this.diaIndex] = true;
    const diaElement = document.querySelector(`.calendario-dia[data-index="${this.diaIndex}"]`);
    if (diaElement) diaElement.classList.add('realizado');

    if (this.sesion && this.sesion.tipo !== 'descanso') {
      if (window.PlanGenerator) {
        await PlanGenerator.limpiarMuroGlobal();
        const metricas = PlanGenerator.calcularMetricasSesion(this.sesion);
        const tss = isFinite(metricas?.tssTotal) ? metricas.tssTotal : 0;
        const userData = AppState.currentUserData || {};

        const entry = {
          userId:        uid,
          username:      userData?.username || '',
          photoURL:      userData?.profile?.photoURL || null,
          trainingType:  this.sesion.tipo,
          duration:      this.sesion.duracion || 0,
          distancia:     parseFloat(distKm.toFixed(3)),
          tss,
          timestamp:     firebaseServices.Timestamp.now(),
          planId,
          sesionIndex:   this.diaIndex,
          likes: [], likeCount: 0,
          zone:          this.sesion.detalle?.zona || '',
          trainingName:  this.sesion.detalle?.nombre || '',
          hasGPS:        true,
          trackPoints:   ptsWall.map(p => ({ lat:p.lat, lng:p.lng })),
          gpsDistanceKm: parseFloat(distKm.toFixed(3)),
          gpsDurationMs: elapsedMs
        };

        const globalRef = await firebaseServices.db.collection('globalFeed').add(entry);
        await planRef.update({ [`wallEntryId.${this.diaIndex}`]: globalRef.id });

        if (window.Gamification) {
          const metricasGPS = { ...(metricas||{}), distanciaTotal: distKm };
          await Gamification.updateAfterSession(uid, this.sesion, metricasGPS);
          if (document.getElementById('tab-perfil')?.classList.contains('active') && window.Profile)
            await Profile.cargarPerfil(true);
          if (document.getElementById('tab-muro')?.classList.contains('active') && window.Wall)
            Wall.cargarMuro();
        }
      } else {
        console.warn('PlanGenerator no definido, se omite publicación en muro');
      }
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
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="border-radius:10px;background:#0f0f0f;display:block;width:100%;max-width:${width}px;" xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <circle cx="${s[0]}" cy="${s[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${e[0]}" cy="${e[1]}" r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  }
};

window.GPSTracker = GPSTracker;
console.log('✅ GPSTracker v2.3 - Finalización garantizada');