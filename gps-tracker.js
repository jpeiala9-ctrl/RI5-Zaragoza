// ==================== gps-tracker.js ====================
// Versión: 1.0 - Módulo de grabación GPS con pantalla de sesión en curso
// Integrado con wall.js (minimap SVG) y calendar.js (botón en modal de sesión)
// ====================

const GPSTracker = {

  // ===== ESTADO INTERNO =====
  sesion: null,
  diaIndex: null,
  trackPoints: [],
  watchId: null,
  timerInterval: null,
  startTime: null,
  pausedTime: 0,
  pauseStart: null,
  isPaused: false,
  isRunning: false,
  map: null,
  polyline: null,
  markerLayer: null,
  leafletLoaded: false,

  // ===== CÁLCULO DE DISTANCIA (Haversine) =====
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  _calcTotalDistance() {
    let total = 0;
    for (let i = 1; i < this.trackPoints.length; i++) {
      total += this._haversine(
        this.trackPoints[i - 1].lat, this.trackPoints[i - 1].lng,
        this.trackPoints[i].lat,     this.trackPoints[i].lng
      );
    }
    return total; // metros
  },

  // ===== FORMATO DE TIEMPO Y RITMO =====
  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  },

  _formatPace(distMetros, ms) {
    if (distMetros < 20 || ms < 5000) return '--:--';
    const distKm = distMetros / 1000;
    const minutos = ms / 60000;
    const paceMin = minutos / distKm;
    const paceS = paceMin * 60;
    const mm = Math.floor(paceS / 60);
    const ss = Math.floor(paceS % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  },

  // ===== CARGA DINÁMICA DE LEAFLET =====
  _loadLeaflet() {
    return new Promise((resolve) => {
      if (window.L && this.leafletLoaded) { resolve(); return; }
      if (window.L) { this.leafletLoaded = true; resolve(); return; }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => { this.leafletLoaded = true; resolve(); };
      script.onerror = () => {
        console.warn('No se pudo cargar Leaflet, mapa no disponible');
        resolve(); // continuar sin mapa
      };
      document.head.appendChild(script);
    });
  },

  // ===== PANTALLA DE SESIÓN EN CURSO =====
  _crearPantalla() {
    const existing = document.getElementById('gpsTrackerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gpsTrackerOverlay';
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:#0a0a0a', 'z-index:999999',
      'display:flex', 'flex-direction:column',
      'font-family:"Courier New",monospace',
      'color:#ffffff', 'user-select:none',
      '-webkit-user-select:none'
    ].join(';');

    overlay.innerHTML = `
      <!-- CABECERA -->
      <div style="
        padding:12px 20px 10px;
        display:flex; align-items:center; justify-content:space-between;
        background:#111; border-bottom:1px solid #2a2a2a;
        flex-shrink:0;
      ">
        <div>
          <div style="font-size:10px; color:#666; letter-spacing:3px; text-transform:uppercase;">Sesión en curso</div>
          <div id="gpsSesionNombre" style="font-size:14px; color:#c0a060; font-weight:bold; margin-top:2px; letter-spacing:1px;"></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div id="gpsSignalDot" style="width:8px; height:8px; border-radius:50%; background:#444; transition:background 0.5s;"></div>
          <span id="gpsSignalText" style="font-size:11px; color:#666; letter-spacing:1px;">SIN GPS</span>
        </div>
      </div>

      <!-- MAPA -->
      <div id="gpsMapWrapper" style="flex:1; min-height:0; position:relative; background:#0f0f0f; overflow:hidden;">
        <div id="gpsMap" style="width:100%; height:100%;"></div>
        <div id="gpsNoGPS" style="
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          background:#0f0f0f; color:#555;
          font-size:13px; letter-spacing:2px; text-align:center;
          pointer-events:none;
        ">
          <div style="font-size:52px; margin-bottom:16px; opacity:0.6;">📡</div>
          <div style="text-transform:uppercase;">Buscando señal GPS...</div>
          <div style="font-size:11px; margin-top:10px; color:#3a3a3a; max-width:220px;">
            Sal al exterior para mejorar la recepción
          </div>
        </div>
      </div>

      <!-- ESTADÍSTICAS -->
      <div style="background:#111; border-top:1px solid #2a2a2a; padding:20px 20px 28px; flex-shrink:0;">

        <!-- TIMER GRANDE -->
        <div style="text-align:center; margin-bottom:18px;">
          <div id="gpsTimer" style="
            font-size:60px; font-weight:bold; letter-spacing:4px;
            color:#ffffff; line-height:1; font-variant-numeric:tabular-nums;
          ">00:00</div>
          <div style="font-size:10px; color:#444; letter-spacing:3px; margin-top:4px; text-transform:uppercase;">Tiempo activo</div>
        </div>

        <!-- DISTANCIA + RITMO -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div style="
            text-align:center; background:#1a1a1a;
            border:1px solid #2a2a2a; border-radius:14px; padding:14px 8px;
          ">
            <div id="gpsDistance" style="font-size:34px; font-weight:bold; color:#c0a060; line-height:1; font-variant-numeric:tabular-nums;">0.00</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px; margin-top:4px;">KM</div>
          </div>
          <div style="
            text-align:center; background:#1a1a1a;
            border:1px solid #2a2a2a; border-radius:14px; padding:14px 8px;
          ">
            <div id="gpsPace" style="font-size:34px; font-weight:bold; color:#9BB5A0; line-height:1; font-variant-numeric:tabular-nums;">--:--</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px; margin-top:4px;">MIN/KM</div>
          </div>
        </div>

        <!-- BOTONES -->
        <div style="display:flex; gap:12px;">
          <button id="gpsPauseBtn" onclick="GPSTracker.togglePause()" style="
            flex:1; height:54px;
            border:2px solid #c0a060; background:transparent; color:#c0a060;
            border-radius:14px; font-size:15px; font-weight:bold;
            cursor:pointer; letter-spacing:1px;
            font-family:'Courier New',monospace;
            transition:all 0.2s ease;
          ">⏸ PAUSA</button>
          <button onclick="GPSTracker.finalizar()" style="
            flex:1; height:54px;
            border:2px solid #c0392b; background:#c0392b; color:#fff;
            border-radius:14px; font-size:15px; font-weight:bold;
            cursor:pointer; letter-spacing:1px;
            font-family:'Courier New',monospace;
            transition:all 0.2s ease;
          ">■ FINALIZAR</button>
        </div>

        <!-- PAUSA INDICATOR -->
        <div id="gpsPauseBanner" style="
          display:none; text-align:center; margin-top:12px;
          color:#c0a060; font-size:13px; letter-spacing:2px;
          animation: blink 1.2s step-start infinite;
        ">⏸ EN PAUSA</div>
      </div>

      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        #gpsPauseBtn:active { transform:scale(0.97); }
        #gpsTrackerOverlay button:last-child:active { transform:scale(0.97); }
      </style>
    `;

    document.body.appendChild(overlay);
  },

  // ===== INICIALIZAR MAPA LEAFLET =====
  _initMap(lat, lng) {
    if (this.map || !window.L) return;

    const noGPSDiv = document.getElementById('gpsNoGPS');
    if (noGPSDiv) noGPSDiv.style.display = 'none';

    try {
      this.map = window.L.map('gpsMap', {
        zoomControl: false,
        attributionControl: false,
        tap: false
      }).setView([lat, lng], 16);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(this.map);

      this.polyline = window.L.polyline([], {
        color: '#c0a060', weight: 4, opacity: 0.9,
        lineJoin: 'round', lineCap: 'round'
      }).addTo(this.map);

      // Marcador de posición actual
      const icon = window.L.divIcon({
        html: `<div style="
          width:16px; height:16px;
          background:#c0a060;
          border:3px solid #fff;
          border-radius:50%;
          box-shadow:0 0 10px rgba(192,160,96,0.9);
        "></div>`,
        className: '',
        iconAnchor: [8, 8]
      });
      this.markerLayer = window.L.marker([lat, lng], { icon }).addTo(this.map);
    } catch (e) {
      console.warn('Error iniciando mapa Leaflet:', e);
    }
  },

  _updateMap(lat, lng) {
    if (!window.L) return;
    if (!this.map) {
      this._initMap(lat, lng);
    } else {
      try {
        this.polyline.addLatLng([lat, lng]);
        this.markerLayer.setLatLng([lat, lng]);
        this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
      } catch (e) { /* mapa aún no listo */ }
    }
  },

  // ===== ARRANQUE DE SESIÓN =====
  async iniciar(sesion, diaIndex) {
    if (this.isRunning) {
      Utils.showToast('⚠️ Ya hay una sesión en curso', 'warning');
      return;
    }

    if (!navigator.geolocation) {
      Utils.showToast('❌ GPS no disponible en este dispositivo', 'error');
      return;
    }

    // Solicitar permisos explícitamente antes de abrir la pantalla
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
    } catch (err) {
      if (err.code === 1) {
        Utils.showToast('❌ Permiso de GPS denegado. Habilítalo en ajustes.', 'error', 5000);
        return;
      }
      // timeout o sin señal: continuar igualmente
    }

    // Resetear estado
    this.sesion = sesion;
    this.diaIndex = diaIndex;
    this.trackPoints = [];
    this.isPaused = false;
    this.pausedTime = 0;
    this.pauseStart = null;
    this.map = null;
    this.polyline = null;
    this.markerLayer = null;

    // Cerrar modal de sesión
    const modal = document.getElementById('detalleSesion');
    const overlay = document.getElementById('modalOverlay');
    if (modal)   modal.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');

    // Crear pantalla GPS
    this._crearPantalla();

    // Nombre de sesión
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) {
      nombreEl.textContent = (sesion.detalle?.nombre || sesion.tipo || 'SESIÓN').toUpperCase();
    }

    // Cargar Leaflet
    await this._loadLeaflet();

    // Iniciar rastreo GPS
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    // Iniciar cronómetro
    this.startTime = Date.now();
    this.isRunning = true;
    this.timerInterval = setInterval(() => this._tickTimer(), 1000);

    if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50, 100]);
  },

  // ===== CALLBACK GPS =====
  _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;

    // Actualizar indicador de señal
    const dot  = document.getElementById('gpsSignalDot');
    const txt  = document.getElementById('gpsSignalText');
    const color = accuracy < 15 ? '#6bd46b' : accuracy < 40 ? '#f1c40f' : '#e74c3c';
    if (dot) dot.style.background = color;
    if (txt) txt.textContent = `±${Math.round(accuracy)}m`;

    if (this.isPaused) return;

    // Descartar puntos muy imprecisos salvo que sea el primero
    if (accuracy > 60 && this.trackPoints.length > 3) return;

    // Descartar puntos demasiado próximos (< 3m) para evitar ruido
    if (this.trackPoints.length > 0) {
      const last = this.trackPoints[this.trackPoints.length - 1];
      const d = this._haversine(last.lat, last.lng, lat, lng);
      if (d < 3) return;
    }

    this.trackPoints.push({ lat, lng, ts: Date.now(), acc: Math.round(accuracy) });
    this._updateMap(lat, lng);
    this._actualizarStats();
  },

  _onGPSError(err) {
    const codes = { 1: 'Permiso denegado', 2: 'Sin señal', 3: 'Tiempo de espera' };
    const txt = document.getElementById('gpsSignalText');
    if (txt) txt.textContent = codes[err.code] || 'ERROR';
    const dot = document.getElementById('gpsSignalDot');
    if (dot) dot.style.background = '#e74c3c';
    console.warn('GPS error:', err.code, err.message);
  },

  // ===== CRONÓMETRO =====
  _getElapsed() {
    if (!this.startTime) return 0;
    if (this.isPaused) {
      return (this.pauseStart - this.startTime) - this.pausedTime;
    }
    return (Date.now() - this.startTime) - this.pausedTime;
  },

  _tickTimer() {
    if (!this.isRunning) return;
    const el = document.getElementById('gpsTimer');
    if (el) el.textContent = this._formatTime(Math.max(0, this._getElapsed()));
  },

  _actualizarStats() {
    const distMetros = this._calcTotalDistance();
    const elapsed = this._getElapsed();
    const distEl = document.getElementById('gpsDistance');
    const paceEl = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = (distMetros / 1000).toFixed(2);
    if (paceEl) paceEl.textContent = this._formatPace(distMetros, elapsed);
  },

  // ===== PAUSA / REANUDAR =====
  togglePause() {
    if (!this.isRunning) return;
    const btn    = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');

    if (this.isPaused) {
      // Reanudar
      this.pausedTime += Date.now() - this.pauseStart;
      this.pauseStart = null;
      this.isPaused = false;
      if (btn)    { btn.innerHTML = '⏸ PAUSA'; btn.style.color = '#c0a060'; btn.style.borderColor = '#c0a060'; }
      if (banner) banner.style.display = 'none';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(50);
    } else {
      // Pausar
      this.pauseStart = Date.now();
      this.isPaused = true;
      if (btn)    { btn.innerHTML = '▶ REANUDAR'; btn.style.color = '#9BB5A0'; btn.style.borderColor = '#9BB5A0'; }
      if (banner) banner.style.display = 'block';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50]);
    }
  },

  // ===== FINALIZAR SESIÓN =====
  async finalizar() {
    if (!this.isRunning) return;

    const distKm = this._calcTotalDistance() / 1000;
    const elapsed = this._getElapsed();

    const confirmed = await Utils.confirm(
      'FINALIZAR SESIÓN',
      `¿Guardar sesión?\n📏 ${distKm.toFixed(2)} km · ⏱️ ${this._formatTime(elapsed)}`
    );
    if (!confirmed) return;

    // Detener todo
    this.isRunning = false;
    clearInterval(this.timerInterval);
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Retirar overlay
    const gpsOverlay = document.getElementById('gpsTrackerOverlay');
    if (gpsOverlay) gpsOverlay.remove();

    Utils.showLoading();
    try {
      await this._guardarYPublicar(distKm, elapsed);
      Utils.hideLoading();
      Utils.showToast(`✅ Sesión guardada · ${distKm.toFixed(2)} km · ${this._formatTime(elapsed)}`, 'success', 5000);
      if (typeof Utils.launchConfetti === 'function') Utils.launchConfetti();
      if (typeof Utils.vibrate === 'function') Utils.vibrate([100, 50, 100, 50, 200]);
      if (typeof Utils.playSound === 'function') Utils.playSound('success');
    } catch (err) {
      console.error('Error guardando sesión GPS:', err);
      Utils.hideLoading();
      Utils.showToast('⚠️ Error al guardar la sesión GPS', 'error');
    }
  },

  // ===== GUARDAR TRACK Y PUBLICAR =====
  async _guardarYPublicar(distKm, elapsedMs) {
    const uid = AppState?.currentUserId;
    if (!uid || !AppState?.planActualId) throw new Error('Sin usuario o plan activo');

    const sesion     = this.sesion;
    const diaIndex   = this.diaIndex;
    const planId     = AppState.planActualId;
    const planRef    = firebaseServices.db
      .collection('users').doc(uid)
      .collection('planes').doc(planId);

    // Decimar a máx. 120 puntos para Firestore
    const ptsFull  = this._decimarPuntos(this.trackPoints, 120);
    const ptsWall  = this._decimarPuntos(ptsFull, 60); // versión más ligera para el muro

    const trackData = {
      points:     ptsFull.map(p => ({ lat: p.lat, lng: p.lng })),
      distanceKm: parseFloat(distKm.toFixed(3)),
      durationMs: elapsedMs,
      recordedAt: new Date().toISOString(),
      sesionIndex: diaIndex,
      planId
    };

    // 1. Guardar track completo en subcolección del usuario
    await firebaseServices.db
      .collection('users').doc(uid)
      .collection('gps_tracks')
      .add(trackData);

    // 2. Guardar referencia en el plan (para historial propio)
    await planRef.update({ [`gpsTrack.${diaIndex}`]: trackData });

    // 3. Marcar sesión como realizada en el plan
    await planRef.update({ [`sesionesRealizadas.${diaIndex}`]: true });
    if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
    AppState.sesionesRealizadas[diaIndex] = true;

    const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
    if (celda) celda.classList.add('realizado');

    // 4. Publicar en muro global con track GPS
    if (sesion && sesion.tipo !== 'descanso') {
      await PlanGenerator.limpiarMuroGlobal();

      const metricas = PlanGenerator.calcularMetricasSesion(sesion);
      const tss      = isFinite(metricas?.tssTotal) ? metricas.tssTotal : 0;
      const userData = AppState.currentUserData;

      const entry = {
        userId:       uid,
        username:     userData?.username || '',
        photoURL:     userData?.profile?.photoURL || null,
        trainingType: sesion.tipo,
        duration:     sesion.duracion || 0,
        distancia:    parseFloat(distKm.toFixed(3)),
        tss,
        timestamp:    firebaseServices.Timestamp.now(),
        planId,
        sesionIndex:  diaIndex,
        likes:        [],
        likeCount:    0,
        zone:         sesion.detalle?.zona || '',
        trainingName: sesion.detalle?.nombre || '',
        // === DATOS GPS ===
        hasGPS:        true,
        trackPoints:   ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
        gpsDistanceKm: parseFloat(distKm.toFixed(3)),
        gpsDurationMs: elapsedMs
      };

      const globalRef = await firebaseServices.db.collection('globalFeed').add(entry);
      await planRef.update({ [`wallEntryId.${diaIndex}`]: globalRef.id });

      // 5. Actualizar gamificación con distancia real GPS
      if (window.Gamification) {
        const metricasGPS = { ...(metricas || {}), distanciaTotal: distKm };
        await Gamification.updateAfterSession(uid, sesion, metricasGPS);
        const gData = await Gamification.getData(uid);
        // Refrescar UI si procede
        if (document.getElementById('tab-perfil')?.classList.contains('active') && window.Profile) {
          await Profile.cargarPerfil(true);
        }
        if (document.getElementById('tab-muro')?.classList.contains('active') && window.Wall) {
          Wall.cargarMuro();
        }
      }
    }
  },

  // ===== DECIMACIÓN (nth-point) =====
  _decimarPuntos(points, maxPts) {
    if (points.length <= maxPts) return points;
    const step = Math.ceil(points.length / maxPts);
    const result = [];
    for (let i = 0; i < points.length; i += step) {
      result.push(points[i]);
    }
    const last = points[points.length - 1];
    if (result[result.length - 1] !== last) result.push(last);
    return result;
  },

  // ===== GENERADOR DE MINIMAP SVG (usado por wall.js) =====
  renderTrackSVG(points, width = 320, height = 130) {
    if (!points || points.length < 2) return '';

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    const rangeLng = maxLng - minLng || 0.0001;
    const rangeLat = maxLat - minLat || 0.0001;

    const pad = 14;
    const W = width - pad * 2;
    const H = height - pad * 2;

    // Preservar aspect ratio del track real
    const scaleX = W / rangeLng;
    const scaleY = H / rangeLat;
    const scale  = Math.min(scaleX, scaleY);
    const offX   = pad + (W - rangeLng * scale) / 2;
    const offY   = pad + (H - rangeLat * scale) / 2;

    const toXY = (p) => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale; // Y invertida
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const pathD    = 'M ' + points.map(toXY).join(' L ');
    const startXY  = toXY(points[0]).split(',');
    const endXY    = toXY(points[points.length - 1]).split(',');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
           style="border-radius:10px; background:#0f0f0f; display:block; width:100%; max-width:${width}px;"
           xmlns="http://www.w3.org/2000/svg">
        <!-- Track -->
        <path d="${pathD}"
              fill="none" stroke="#c0a060" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <!-- Inicio (verde) -->
        <circle cx="${startXY[0]}" cy="${startXY[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
        <!-- Fin (rojo) -->
        <circle cx="${endXY[0]}"   cy="${endXY[1]}"   r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
        <!-- Leyenda -->
        <text x="${pad}" y="${height - 4}" font-size="9" fill="#555" font-family="monospace">
          ● inicio  ● fin
        </text>
      </svg>
    `;
  }
};

window.GPSTracker = GPSTracker;
console.log('✅ GPSTracker listo');
