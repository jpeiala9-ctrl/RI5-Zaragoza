// ==================== gps-tracker.js ====================
// Versión: 2.0 - GPS perfecto + pasos de sesión + confirmación inline
// ====================

const GPSTracker = {

  // ===== ESTADO =====
  sesion:        null,
  diaIndex:      null,
  trackPoints:   [],   // puntos ya filtrados y guardados
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

  // Paso actual
  steps:         [],   // [{titulo, accion, duracionMin, icono}]
  stepIndex:     0,
  stepStartTime: null, // ms cuando empezó el paso actual

  // Buffer para suavizado GPS
  _rawBuffer:    [],   // últimas lecturas crudas (max 4)
  _lastAccepted: null, // último punto aceptado {lat, lng, ts}

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

  // ===== FILTRO GPS: 3 capas =====
  // 1. Precisión bruta  2. Speed-gate  3. Buffer centroide pesado
  _filterGPS(lat, lng, accuracy, timestamp) {
    // Capa 1: descartar precisión muy mala (salvo inicio)
    if (accuracy > 45 && this.trackPoints.length > 3) return null;

    // Capa 2: speed-gate – velocidad máxima runner = 7 m/s (~25 km/h)
    if (this._lastAccepted) {
      const dt  = Math.max(0.5, (timestamp - this._lastAccepted.ts) / 1000);
      const dist = this._haversine(this._lastAccepted.lat, this._lastAccepted.lng, lat, lng);
      if (dist / dt > 7.5 && dist > 20) {
        // salto imposible: ignorar
        return null;
      }
    }

    // Capa 3: buffer de últimas 4 lecturas → centroide ponderado por 1/accuracy
    this._rawBuffer.push({ lat, lng, acc: Math.max(1, accuracy) });
    if (this._rawBuffer.length > 4) this._rawBuffer.shift();

    if (this._rawBuffer.length < 2) return null; // esperar al menos 2 lecturas

    let sumW = 0, sumLat = 0, sumLng = 0;
    for (const p of this._rawBuffer) {
      const w = 1 / p.acc;
      sumW   += w;
      sumLat += p.lat * w;
      sumLng += p.lng * w;
    }
    const sLat = sumLat / sumW;
    const sLng = sumLng / sumW;

    // Descartar si el centroide suavizado se mueve < 2m (ruido estático)
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
    const paceS = (ms / 1000) / (distM / 1000) ; // seg/km
    const mm = Math.floor(paceS / 60), ss = Math.floor(paceS % 60);
    return `${mm}:${String(ss).padStart(2,'0')}`;
  },

  // ===== PASOS DE SESIÓN =====
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
        // para sesiones con múltiples pasos principales, dividir partePrincipal
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
      <!-- PRE-LOCK: pantalla de espera GPS -->
      <div id="gpsPreLock" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;background:#0a0a0a;">
        <div style="font-size:64px;margin-bottom:20px;">📡</div>
        <div style="font-size:13px;letter-spacing:3px;color:#c0a060;margin-bottom:8px;">OBTENIENDO SEÑAL GPS</div>
        <div id="preLockAccText" style="font-size:28px;font-weight:bold;margin:12px 0;">—</div>
        <div style="font-size:11px;color:#555;margin-bottom:20px;">precisión</div>
        <!-- barra de progreso precisión -->
        <div style="width:200px;height:6px;background:#222;border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div id="preLockBar" style="height:100%;width:0%;background:#c0a060;border-radius:3px;transition:width 0.5s,background 0.5s;"></div>
        </div>
        <div id="preLockStatus" style="font-size:11px;color:#555;letter-spacing:1px;margin-bottom:32px;">buscando satélites...</div>
        <button id="preLockForceBtn" onclick="GPSTracker._forzarInicio()" style="display:none;padding:12px 24px;border:2px solid #666;background:transparent;color:#888;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;letter-spacing:1px;">INICIAR IGUALMENTE</button>
        <button onclick="GPSTracker.cancelar()" style="margin-top:14px;padding:10px 20px;border:none;background:transparent;color:#555;font-size:12px;cursor:pointer;font-family:inherit;letter-spacing:1px;">CANCELAR</button>
      </div>

      <!-- PANTALLA DE SESIÓN EN CURSO (oculta hasta tener GPS) -->
      <div id="gpsSessionScreen" style="flex:1;display:none;flex-direction:column;">

        <!-- CABECERA: señal + nombre sesión -->
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

        <!-- PASO ACTUAL -->
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
          <!-- dots de progreso de pasos -->
          <div id="gpsStepDots" style="display:flex;gap:5px;margin-top:4px;"></div>
          <!-- descripción del paso -->
          <div id="gpsStepDesc" style="font-size:11px;color:#555;margin-top:6px;line-height:1.4;max-height:36px;overflow:hidden;"></div>
        </div>

        <!-- MAPA -->
        <div style="flex:1;min-height:0;position:relative;background:#0f0f0f;">
          <div id="gpsMap" style="width:100%;height:100%;"></div>
          <div id="gpsNoGPS" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f0f0f;color:#555;font-size:13px;letter-spacing:2px;text-align:center;pointer-events:none;">
            <div style="font-size:40px;margin-bottom:12px;opacity:.5;">🗺️</div>
            <div>Esperando posición...</div>
          </div>
        </div>

        <!-- STATS -->
        <div style="background:#111;border-top:1px solid #222;padding:14px 16px 20px;flex-shrink:0;">
          <!-- TIMER GLOBAL -->
          <div style="text-align:center;margin-bottom:12px;">
            <div id="gpsTimer" style="font-size:52px;font-weight:bold;letter-spacing:4px;color:#fff;line-height:1;font-variant-numeric:tabular-nums;">00:00</div>
            <div style="font-size:9px;color:#333;letter-spacing:3px;margin-top:2px;">TIEMPO TOTAL</div>
          </div>
          <!-- DISTANCIA + RITMO -->
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
          <!-- BOTONES -->
          <div style="display:flex;gap:10px;">
            <button id="gpsPauseBtn" onclick="GPSTracker.togglePause()" style="flex:1;height:50px;border:2px solid #c0a060;background:transparent;color:#c0a060;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;letter-spacing:1px;font-family:inherit;transition:all .2s;">⏸ PAUSA</button>
            <button id="gpsNextBtn"  onclick="GPSTracker.nextStep()"   style="flex:1;height:50px;border:2px solid #9BB5A0;background:#9BB5A0;color:#0a0a0a;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;letter-spacing:1px;font-family:inherit;transition:all .2s;">SIGUIENTE →</button>
          </div>
          <div id="gpsPauseBanner" style="display:none;text-align:center;margin-top:10px;color:#c0a060;font-size:12px;letter-spacing:2px;animation:blink 1.2s step-start infinite;">⏸ EN PAUSA</div>
        </div>
      </div>

      <!-- CONFIRM INLINE (para Finalizar) -->
      <div id="gpsConfirm" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10,10,10,.97);z-index:3000;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;pointer-events:all;">
        <div style="font-size:48px;margin-bottom:16px;">⏹️</div>
        <div style="font-size:14px;letter-spacing:2px;color:#c0a060;margin-bottom:20px;">FINALIZAR SESIÓN</div>
        <div id="gpsConfirmStats" style="font-size:22px;font-weight:bold;margin-bottom:30px;color:#fff;line-height:1.7;"></div>
        <button id="gpsConfirmYes" style="width:100%;max-width:280px;height:54px;background:#c0392b;border:none;color:#fff;border-radius:14px;font-size:16px;font-weight:bold;cursor:pointer;font-family:inherit;letter-spacing:1px;margin-bottom:12px;">✅ GUARDAR Y SALIR</button>
        <button id="gpsConfirmNo"  style="width:100%;max-width:280px;height:48px;background:transparent;border:2px solid #444;color:#aaa;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;letter-spacing:1px;">CONTINUAR SESIÓN</button>
      </div>

      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes stepPulse { 0%,100%{box-shadow:0 0 0 0 rgba(192,160,96,.4)} 50%{box-shadow:0 0 0 6px rgba(192,160,96,0)} }
        .step-dot-active { animation: stepPulse 1.5s infinite; }
      </style>
    `;
    document.body.appendChild(ov);

    // Usar addEventListener para los botones del confirm (no onclick inline)
    // porque el mapa Leaflet puede bloquar los eventos touch si usan inline handlers
    const _yes = document.getElementById('gpsConfirmYes');
    const _no  = document.getElementById('gpsConfirmNo');
    if (_yes) _yes.addEventListener('click', () => GPSTracker._confirmarFinalizar());
    if (_no)  _no.addEventListener('click',  () => GPSTracker._cancelarConfirm());
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
      const lbl      = s.titulo.slice(0, 3);
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

  // ===== INICIO CON PRE-LOCK =====
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

    // Construir pasos
    this.steps     = this._buildSteps(sesion);
    this.stepIndex = 0;

    // Cerrar modal de sesión
    document.getElementById('detalleSesion')?.classList.remove('visible');
    document.getElementById('modalOverlay')?.classList.remove('visible');

    // Crear pantalla
    this._crearPantalla();

    // Nombre sesión
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (sesion.detalle?.nombre || sesion.tipo || 'SESIÓN').toUpperCase();

    // Cargar Leaflet en background (no bloquea)
    this._loadLeaflet();

    // Fase pre-lock: esperar señal buena antes de grabar
    this._iniciarPreLock();
  },

  // ===== PRE-LOCK: esperar precisión < 20m =====
  _iniciarPreLock() {
    let preLockStarted = Date.now();
    let forceBtnShown  = false;

    this.watchId = navigator.geolocation.watchPosition(pos => {
      const acc = pos.coords.accuracy;
      const pct = Math.max(0, Math.min(100, (1 - acc / 60) * 100));

      const accText = document.getElementById('preLockAccText');
      const bar     = document.getElementById('preLockBar');
      const status  = document.getElementById('preLockStatus');
      const forceBtn= document.getElementById('preLockForceBtn');

      if (accText) accText.textContent = `±${Math.round(acc)} m`;
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = acc < 15 ? '#6bd46b' : acc < 30 ? '#f1c40f' : '#c0a060';
      }

      if (acc < 20) {
        if (status) status.textContent = '✅ señal lista';
        // Pequeña pausa visual y arrancamos
        setTimeout(() => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, acc), 800);
      } else {
        if (status) status.textContent = acc < 35 ? 'señal aceptable...' : 'buscando satélites...';
        // Mostrar botón "iniciar igualmente" tras 20s
        if (!forceBtnShown && Date.now() - preLockStarted > 20000) {
          forceBtnShown = true;
          if (forceBtn) forceBtn.style.display = 'block';
        }
      }
    }, err => {
      const s = document.getElementById('preLockStatus');
      if (s) s.textContent = err.code === 1 ? '❌ permiso denegado' : '❌ sin señal GPS';
      const forceBtn = document.getElementById('preLockForceBtn');
      if (forceBtn) forceBtn.style.display = 'block';
    }, { enableHighAccuracy:true, maximumAge:1000, timeout:15000 });
  },

  _forzarInicio() {
    // Obtener última posición conocida y arrancar
    navigator.geolocation.getCurrentPosition(
      pos => this._arrancarSesion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => this._arrancarSesion(0, 0, 999)
    , { enableHighAccuracy:true, timeout:5000 });
  },

  _arrancarSesion(lat, lng, acc) {
    if (this.isRunning) return; // evitar doble arranque

    // Ocultar pre-lock, mostrar sesión
    const preLock  = document.getElementById('gpsPreLock');
    const session  = document.getElementById('gpsSessionScreen');
    if (preLock)  preLock.style.display  = 'none';
    if (session)  { session.style.display = 'flex'; }

    // Renderizar paso inicial
    this._renderStepInfo();

    // Iniciar mapa con la primera posición buena
    if (lat !== 0) this._initMap(lat, lng);

    // Resetear buffer y arrancar grabación
    this._rawBuffer  = [];
    this._lastAccepted = null;
    this.isRunning   = true;
    this.startTime   = Date.now();
    this.stepStartTime = Date.now();

    // Re-usar el watchId ya activo (del pre-lock) → ahora irá a _onPosition
    // Cancelar el anterior y abrir uno nuevo con el handler definitivo
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onGPSError(err),
      { enableHighAccuracy:true, maximumAge:2000, timeout:15000 }
    );

    // Cronómetros
    this.timerInterval = setInterval(() => this._tick(), 1000);

    if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50, 100]);
  },

  cancelar() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    clearInterval(this.timerInterval);
    clearInterval(this.stepInterval);
    document.getElementById('gpsTrackerOverlay')?.remove();
  },

  // ===== CALLBACK GPS EN SESIÓN =====
  _onPosition(pos) {
    const { latitude:lat, longitude:lng, accuracy } = pos.coords;

    // Actualizar señal visual
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

  // ===== TICK (cada segundo) =====
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

    // Timer global
    const timerEl = document.getElementById('gpsTimer');
    if (timerEl) timerEl.textContent = this._fmtTime(this._getElapsed());

    // Countdown del paso actual
    const step = this.steps[this.stepIndex];
    if (step) {
      const durMs      = step.duracionMin * 60 * 1000;
      const restante   = Math.max(0, durMs - this._getStepElapsed());
      const cdEl       = document.getElementById('gpsStepCountdown');
      if (cdEl) {
        cdEl.textContent = this._fmtTime(restante);
        // Cuando agota, cambiar color para avisar
        cdEl.style.color = restante === 0 ? '#e74c3c' : '#c0a060';
      }
      // Hacer pulsar el botón SIGUIENTE cuando el paso llega a 0
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

  // ===== PAUSA =====
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

  // ===== SIGUIENTE PASO =====
  nextStep() {
    if (!this.isRunning) return;
    const esUltimo = this.stepIndex >= this.steps.length - 1;
    if (esUltimo) {
      // Mostrar confirm inline
      this._mostrarConfirm();
    } else {
      this.stepIndex++;
      this.stepStartTime = Date.now();
      // Reset animación del botón
      const nextBtn = document.getElementById('gpsNextBtn');
      if (nextBtn) nextBtn.style.animation = '';
      this._renderStepInfo();
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(60);
    }
  },

  // ===== CONFIRM INLINE =====
  _mostrarConfirm() {
    const distKm  = (this._calcTotalDistance() / 1000).toFixed(2);
    const elapsed = this._fmtTime(this._getElapsed());
    const statsEl = document.getElementById('gpsConfirmStats');
    if (statsEl) statsEl.innerHTML = `📏 ${distKm} km<br>⏱️ ${elapsed}`;
    const conf = document.getElementById('gpsConfirm');
    if (!conf) return;
    // Forzar TODOS los estilos via JS para garantizar que está por encima de Leaflet (z-index 3000)
    Object.assign(conf.style, {
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      position:        'absolute',
      top:             '0',
      left:            '0',
      right:           '0',
      bottom:          '0',
      background:      'rgba(10,10,10,0.97)',
      zIndex:          '3000',
      padding:         '30px',
      textAlign:       'center',
      pointerEvents:   'all'
    });
  },

  _cancelarConfirm() {
    const conf = document.getElementById('gpsConfirm');
    if (conf) conf.style.display = 'none';
  },

  async _confirmarFinalizar() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerInterval);
    if (this.watchId !== null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }

    const distKm   = this._calcTotalDistance() / 1000;
    const elapsedMs = this._getElapsed();

    document.getElementById('gpsTrackerOverlay')?.remove();

    Utils.showLoading();
    try {
      await this._guardarYPublicar(distKm, elapsedMs);
      Utils.hideLoading();
      Utils.showToast(`✅ Sesión guardada · ${distKm.toFixed(2)} km · ${this._fmtTime(elapsedMs)}`, 'success', 5000);
      if (typeof Utils.launchConfetti === 'function') Utils.launchConfetti();
      if (typeof Utils.vibrate === 'function') Utils.vibrate([100,50,100,50,200]);
      if (typeof Utils.playSound === 'function') Utils.playSound('success');
    } catch(err) {
      console.error('Error guardando sesión GPS:', err);
      Utils.hideLoading();
      const msg = err?.message || String(err) || 'Error desconocido';
      Utils.showToast(`⚠️ Error GPS: ${msg}`, 'error', 6000);
    }
  },

  // ===== GUARDAR Y PUBLICAR =====
  // Estrategia: delegar en marcarSesionRealizada (ya funciona y tiene todo el contexto)
  // y luego enriquecer la entrada del muro con los datos GPS.
  async _guardarYPublicar(distKm, elapsedMs) {
    const uid = AppState?.currentUserId;
    if (!uid || !AppState?.planActualId) throw new Error('Sin usuario o plan activo');

    const planId  = AppState.planActualId;
    const planRef = firebaseServices.db
      .collection('users').doc(uid)
      .collection('planes').doc(planId);

    // Decimar puntos
    const ptsFull = this._decimarPuntos(this.trackPoints, 120);
    const ptsWall = this._decimarPuntos(ptsFull, 60);

    // 1. Guardar track GPS completo en subcolección del usuario
    const trackData = {
      points:      ptsFull.map(p => ({ lat: p.lat, lng: p.lng })),
      distanceKm:  parseFloat(distKm.toFixed(3)),
      durationMs:  elapsedMs,
      recordedAt:  new Date().toISOString(),
      sesionIndex: this.diaIndex,
      planId
    };
    await firebaseServices.db
      .collection('users').doc(uid)
      .collection('gps_tracks').add(trackData);

    // 2. Guardar metadata ligera en el plan (sin los puntos completos para no sobrepasar 1MB)
    await planRef.update({
      [`gpsTrack.${this.diaIndex}`]: {
        distanceKm: trackData.distanceKm,
        durationMs: trackData.durationMs,
        recordedAt: trackData.recordedAt
      }
    });

    // 3. Usar marcarSesionRealizada que ya funciona:
    //    marca la sesión, publica en el muro y actualiza gamificación
    await PlanGenerator.marcarSesionRealizada(this.diaIndex, true);

    // 4. Enriquecer la entrada del muro que acaba de crear con los datos GPS
    const planDoc     = await planRef.get();
    const wallEntryId = planDoc.data()?.wallEntryId?.[this.diaIndex];
    if (wallEntryId) {
      await firebaseServices.db.collection('globalFeed').doc(wallEntryId).update({
        hasGPS:        true,
        trackPoints:   ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
        gpsDistanceKm: parseFloat(distKm.toFixed(3)),
        gpsDurationMs: elapsedMs,
        distancia:     parseFloat(distKm.toFixed(3)) // sobreescribir con distancia GPS real
      });
    }
  },

  // ===== DECIMACIÓN =====
  _decimarPuntos(pts, max) {
    if (pts.length <= max) return pts;
    const step = Math.ceil(pts.length / max);
    const res = [];
    for (let i = 0; i < pts.length; i += step) res.push(pts[i]);
    if (res[res.length-1] !== pts[pts.length-1]) res.push(pts[pts.length-1]);
    return res;
  },

  // ===== MINIMAP SVG (para wall.js) =====
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
console.log('✅ GPSTracker v2.0 - GPS perfecto + pasos + confirm inline');
