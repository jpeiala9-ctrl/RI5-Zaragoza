// ==================== gps-tracker.js ====================
// Versión: 2.0 - Estabilización GPS + temporizadores por fases + botón siguiente
// ====================

const GPSTracker = {

  // ===== ESTADO INTERNO =====
  sesion: null,
  diaIndex: null,
  trackPoints: [],
  watchId: null,
  isPaused: false,
  isRunning: false,
  map: null,
  polyline: null,
  markerLayer: null,
  leafletLoaded: false,
  
  // Nuevos: control de fases
  faseActual: 'calentamiento', // 'calentamiento', 'principal', 'enfriamiento'
  tiempoRestanteFase: 0,
  duracionCalentamiento: 0,
  duracionPrincipal: 0,
  duracionEnfriamiento: 0,
  animationFrame: null,
  startTimeFase: null,
  faseTerminada: false,
  
  // Filtro GPS: cola de últimos puntos para suavizado
  lastPositions: [],

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
  _formatTime(seg) {
    if (!isFinite(seg) || seg < 0) seg = 0;
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  _formatPace(distMetros, seg) {
    if (distMetros < 20 || seg < 5) return '--:--';
    const distKm = distMetros / 1000;
    const paceMin = (seg / 60) / distKm;
    const mm = Math.floor(paceMin);
    const ss = Math.floor((paceMin - mm) * 60);
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

  // ===== PANTALLA DE SESIÓN EN CURSO (CON FASES Y BOTÓN SIGUIENTE) =====
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
      <div style="padding:12px 20px 10px; display:flex; align-items:center; justify-content:space-between; background:#111; border-bottom:1px solid #2a2a2a; flex-shrink:0;">
        <div>
          <div style="font-size:10px; color:#666; letter-spacing:3px; text-transform:uppercase;">Sesión en curso</div>
          <div id="gpsSesionNombre" style="font-size:14px; color:#c0a060; font-weight:bold; margin-top:2px; letter-spacing:1px;"></div>
          <div id="gpsSesionZona" style="font-size:10px; color:#888;"></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div id="gpsSignalDot" style="width:8px; height:8px; border-radius:50%; background:#444; transition:background 0.5s;"></div>
          <span id="gpsSignalText" style="font-size:11px; color:#666; letter-spacing:1px;">SIN GPS</span>
        </div>
      </div>

      <!-- MAPA -->
      <div id="gpsMapWrapper" style="flex:1; min-height:0; position:relative; background:#0f0f0f; overflow:hidden;">
        <div id="gpsMap" style="width:100%; height:100%;"></div>
        <div id="gpsNoGPS" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f0f0f; color:#555; font-size:13px; letter-spacing:2px; text-align:center; pointer-events:none;">
          <div style="font-size:52px; margin-bottom:16px; opacity:0.6;">📡</div>
          <div style="text-transform:uppercase;">Buscando señal GPS...</div>
          <div style="font-size:11px; margin-top:10px; color:#3a3a3a; max-width:220px;">Sal al exterior para mejorar la recepción</div>
        </div>
      </div>

      <!-- FASES (TIMERS) -->
      <div id="faseContainer" style="background:#111; padding:16px 20px; border-top:1px solid #2a2a2a; border-bottom:1px solid #2a2a2a;">
        <div id="faseCalentamiento" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; letter-spacing:1px; margin-bottom:4px;">
            <span>🔥 CALENTAMIENTO</span>
            <span id="calentamientoRestante">--:--</span>
          </div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; overflow:hidden;">
            <div id="calentamientoBar" style="width:0%; background:#c0a060; height:6px;"></div>
          </div>
        </div>
        <div id="fasePrincipal" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; letter-spacing:1px; margin-bottom:4px;">
            <span>💪 PARTE PRINCIPAL</span>
            <span id="principalRestante">--:--</span>
          </div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; overflow:hidden;">
            <div id="principalBar" style="width:0%; background:#9BB5A0; height:6px;"></div>
          </div>
        </div>
        <div id="faseEnfriamiento">
          <div style="display:flex; justify-content:space-between; font-size:12px; letter-spacing:1px; margin-bottom:4px;">
            <span>🧘 ENFRIAMIENTO</span>
            <span id="enfriamientoRestante">--:--</span>
          </div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; overflow:hidden;">
            <div id="enfriamientoBar" style="width:0%; background:#8AA0B0; height:6px;"></div>
          </div>
        </div>
      </div>

      <!-- ESTADÍSTICAS GENERALES -->
      <div style="background:#111; padding:20px 20px 28px; flex-shrink:0;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div style="text-align:center; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:14px; padding:14px 8px;">
            <div id="gpsDistance" style="font-size:34px; font-weight:bold; color:#c0a060; line-height:1; font-variant-numeric:tabular-nums;">0.00</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px; margin-top:4px;">KM</div>
          </div>
          <div style="text-align:center; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:14px; padding:14px 8px;">
            <div id="gpsPace" style="font-size:34px; font-weight:bold; color:#9BB5A0; line-height:1; font-variant-numeric:tabular-nums;">--:--</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px; margin-top:4px;">MIN/KM</div>
          </div>
        </div>

        <!-- BOTONES -->
        <div style="display:flex; gap:12px;">
          <button id="gpsPauseBtn" class="gps-pause-btn" style="flex:1; height:54px; border:2px solid #c0a060; background:transparent; color:#c0a060; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer; letter-spacing:1px;">⏸ PAUSA</button>
          <button id="gpsSiguienteBtn" class="gps-siguiente-btn" style="flex:1; height:54px; border:2px solid #3498db; background:transparent; color:#3498db; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer; letter-spacing:1px;">⏩ SIGUIENTE</button>
          <button id="gpsFinalizarBtn" class="gps-finalizar-btn" style="flex:1; height:54px; border:2px solid #c0392b; background:#c0392b; color:#fff; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer; letter-spacing:1px;">■ FINALIZAR</button>
        </div>
        <div id="gpsPauseBanner" style="display:none; text-align:center; margin-top:12px; color:#c0a060; font-size:13px; letter-spacing:2px; animation:blink 1.2s step-start infinite;">⏸ EN PAUSA</div>
      </div>
      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .gps-pause-btn:active, .gps-siguiente-btn:active, .gps-finalizar-btn:active { transform:scale(0.97); }
      </style>
    `;

    document.body.appendChild(overlay);
  },

  // Extrae duraciones de la sesión (en segundos)
  _extraerDuraciones() {
    const detalle = this.sesion.detalle || {};
    this.duracionCalentamiento = (detalle.calentamiento || 0) * 60;
    this.duracionPrincipal = (detalle.partePrincipal || 0) * 60;
    this.duracionEnfriamiento = (detalle.enfriamiento || 0) * 60;
    
    // Si no están definidos, usar valores por defecto de la sesión
    if (this.duracionCalentamiento === 0 && this.duracionPrincipal === 0 && this.duracionEnfriamiento === 0) {
      const duracionTotal = (this.sesion.duracion || 45) * 60;
      this.duracionCalentamiento = Math.floor(duracionTotal * 0.15);
      this.duracionPrincipal = duracionTotal - this.duracionCalentamiento - Math.floor(duracionTotal * 0.1);
      this.duracionEnfriamiento = duracionTotal - this.duracionCalentamiento - this.duracionPrincipal;
    }
  },

  // Actualiza la interfaz de fases según la fase actual
  _actualizarFaseUI() {
    const calentamientoDiv = document.getElementById('faseCalentamiento');
    const principalDiv = document.getElementById('fasePrincipal');
    const enfriamientoDiv = document.getElementById('faseEnfriamiento');
    
    if (this.faseActual === 'calentamiento') {
      calentamientoDiv.style.opacity = '1';
      principalDiv.style.opacity = '0.5';
      enfriamientoDiv.style.opacity = '0.3';
    } else if (this.faseActual === 'principal') {
      calentamientoDiv.style.opacity = '0.3';
      principalDiv.style.opacity = '1';
      enfriamientoDiv.style.opacity = '0.5';
    } else {
      calentamientoDiv.style.opacity = '0.3';
      principalDiv.style.opacity = '0.5';
      enfriamientoDiv.style.opacity = '1';
    }
    
    // Mostrar/ocultar botón siguiente según si la fase actual ha terminado
    const siguienteBtn = document.getElementById('gpsSiguienteBtn');
    if (siguienteBtn) {
      siguienteBtn.style.display = this.faseTerminada ? 'block' : 'none';
    }
  },

  // Avanza manualmente a la siguiente fase
  siguienteFase() {
    if (!this.faseTerminada) return;
    
    if (this.faseActual === 'calentamiento') {
      this.faseActual = 'principal';
      this.tiempoRestanteFase = this.duracionPrincipal;
    } else if (this.faseActual === 'principal') {
      this.faseActual = 'enfriamiento';
      this.tiempoRestanteFase = this.duracionEnfriamiento;
    } else {
      // Enfriamiento terminado, se puede finalizar
      return;
    }
    
    this.faseTerminada = false;
    this.startTimeFase = Date.now();
    this._actualizarFaseUI();
  },

  // Bucle de actualización de temporizadores de fase
  _updateFaseTimers() {
    if (!this.isRunning || this.isPaused) {
      this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
      return;
    }
    
    const ahora = Date.now();
    let transcurrido = (ahora - this.startTimeFase) / 1000;
    let nuevoRestante = Math.max(0, this.tiempoRestanteFase - transcurrido);
    
    // Actualizar barra y texto de la fase actual
    let totalFase = 0;
    let barElement = null;
    let textElement = null;
    if (this.faseActual === 'calentamiento') {
      totalFase = this.duracionCalentamiento;
      barElement = document.getElementById('calentamientoBar');
      textElement = document.getElementById('calentamientoRestante');
    } else if (this.faseActual === 'principal') {
      totalFase = this.duracionPrincipal;
      barElement = document.getElementById('principalBar');
      textElement = document.getElementById('principalRestante');
    } else {
      totalFase = this.duracionEnfriamiento;
      barElement = document.getElementById('enfriamientoBar');
      textElement = document.getElementById('enfriamientoRestante');
    }
    
    if (totalFase > 0) {
      const porcentaje = ((totalFase - nuevoRestante) / totalFase) * 100;
      if (barElement) barElement.style.width = `${Math.min(100, Math.max(0, porcentaje))}%`;
    } else {
      if (barElement) barElement.style.width = '0%';
    }
    if (textElement) textElement.textContent = this._formatTime(Math.floor(nuevoRestante));
    
    // Comprobar si la fase ha terminado
    if (nuevoRestante <= 0 && !this.faseTerminada) {
      this.faseTerminada = true;
      this._actualizarFaseUI();
      // Si es la última fase y terminó, mostrar mensaje opcional
      if (this.faseActual === 'enfriamiento') {
        Utils.showToast('✅ Sesión completada. Pulsa "FINALIZAR".', 'success', 4000);
      }
    }
    
    this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
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

      const icon = window.L.divIcon({
        html: `<div style="width:16px; height:16px; background:#c0a060; border:3px solid #fff; border-radius:50%; box-shadow:0 0 10px rgba(192,160,96,0.9);"></div>`,
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

  // ===== FILTRO GPS (promedio móvil) =====
  _smoothPosition(lat, lng, acc) {
    this.lastPositions.push({ lat, lng, acc, ts: Date.now() });
    if (this.lastPositions.length > 3) this.lastPositions.shift();
    
    let sumLat = 0, sumLng = 0, totalWeight = 0;
    for (let p of this.lastPositions) {
      const weight = 1 / (p.acc || 10);
      sumLat += p.lat * weight;
      sumLng += p.lng * weight;
      totalWeight += weight;
    }
    if (totalWeight > 0) {
      return { lat: sumLat / totalWeight, lng: sumLng / totalWeight };
    }
    return { lat, lng };
  },

  // ===== CALLBACK GPS =====
  _onPosition(pos) {
    let { latitude: lat, longitude: lng, accuracy } = pos.coords;
    
    // Descartar puntos muy imprecisos (peor que 25m)
    if (accuracy > 25 && this.trackPoints.length > 2) return;
    
    // Suavizado
    const smoothed = this._smoothPosition(lat, lng, accuracy);
    lat = smoothed.lat;
    lng = smoothed.lng;
    
    // Actualizar indicador de señal
    const dot = document.getElementById('gpsSignalDot');
    const txt = document.getElementById('gpsSignalText');
    const color = accuracy < 15 ? '#6bd46b' : accuracy < 30 ? '#f1c40f' : '#e74c3c';
    if (dot) dot.style.background = color;
    if (txt) txt.textContent = `±${Math.round(accuracy)}m`;
    
    if (this.isPaused) return;
    
    // Descartar puntos demasiado próximos (< 4m) para evitar ruido
    if (this.trackPoints.length > 0) {
      const last = this.trackPoints[this.trackPoints.length - 1];
      const d = this._haversine(last.lat, last.lng, lat, lng);
      if (d < 4) return;
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

  _actualizarStats() {
    const distMetros = this._calcTotalDistance();
    const elapsed = this._getElapsedFaseTotal();
    const distEl = document.getElementById('gpsDistance');
    const paceEl = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = (distMetros / 1000).toFixed(2);
    if (paceEl) paceEl.textContent = this._formatPace(distMetros, elapsed);
  },

  _getElapsedFaseTotal() {
    if (!this.startTimeFase) return 0;
    let base = (Date.now() - this.startTimeFase) / 1000;
    let totalTranscurrido = (this.duracionCalentamiento + this.duracionPrincipal + this.duracionEnfriamiento) - this.tiempoRestanteFase;
    return Math.max(0, totalTranscurrido);
  },

  // ===== PAUSA / REANUDAR =====
  togglePause() {
    if (!this.isRunning) return;
    const btn = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');
    
    if (this.isPaused) {
      // Reanudar
      const ahora = Date.now();
      const pausaDuracion = ahora - this.pauseStart;
      this.startTimeFase += pausaDuracion;
      this.isPaused = false;
      if (btn) { btn.innerHTML = '⏸ PAUSA'; btn.style.color = '#c0a060'; btn.style.borderColor = '#c0a060'; }
      if (banner) banner.style.display = 'none';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(50);
    } else {
      // Pausar
      this.pauseStart = Date.now();
      this.isPaused = true;
      if (btn) { btn.innerHTML = '▶ REANUDAR'; btn.style.color = '#9BB5A0'; btn.style.borderColor = '#9BB5A0'; }
      if (banner) banner.style.display = 'block';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50]);
    }
  },

  // ===== FINALIZAR SESIÓN =====
  async finalizar() {
    if (!this.isRunning) return;
    
    const distKm = this._calcTotalDistance() / 1000;
    const elapsed = this._getElapsedFaseTotal();
    
    const confirmed = await Utils.confirm(
      'FINALIZAR SESIÓN',
      `¿Guardar sesión?\n📏 ${distKm.toFixed(2)} km · ⏱️ ${this._formatTime(Math.floor(elapsed))}`
    );
    if (!confirmed) return;
    
    // Detener todo
    this.isRunning = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
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
      Utils.showToast(`✅ Sesión guardada · ${distKm.toFixed(2)} km · ${this._formatTime(Math.floor(elapsed))}`, 'success', 5000);
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
    
    const sesion = this.sesion;
    const diaIndex = this.diaIndex;
    const planId = AppState.planActualId;
    const planRef = firebaseServices.db
      .collection('users').doc(uid)
      .collection('planes').doc(planId);
    
    // Decimar puntos a máx. 120
    const ptsFull = this._decimarPuntos(this.trackPoints, 120);
    const ptsWall = this._decimarPuntos(ptsFull, 60);
    
    const trackData = {
      points: ptsFull.map(p => ({ lat: p.lat, lng: p.lng })),
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
    
    // 2. Guardar referencia en el plan
    await planRef.update({ [`gpsTrack.${diaIndex}`]: trackData });
    
    // 3. Marcar sesión como realizada
    await planRef.update({ [`sesionesRealizadas.${diaIndex}`]: true });
    if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
    AppState.sesionesRealizadas[diaIndex] = true;
    
    const celda = document.querySelector(`.calendario-dia[data-index="${diaIndex}"]`);
    if (celda) celda.classList.add('realizado');
    
    // 4. Publicar en muro global con track GPS
    if (sesion && sesion.tipo !== 'descanso') {
      await PlanGenerator.limpiarMuroGlobal();
      
      const metricas = PlanGenerator.calcularMetricasSesion(sesion);
      const tss = isFinite(metricas?.tssTotal) ? metricas.tssTotal : 0;
      const userData = AppState.currentUserData;
      
      const entry = {
        userId: uid,
        username: userData?.username || '',
        photoURL: userData?.profile?.photoURL || null,
        trainingType: sesion.tipo,
        duration: sesion.duracion || 0,
        distancia: parseFloat(distKm.toFixed(3)),
        tss,
        timestamp: firebaseServices.Timestamp.now(),
        planId,
        sesionIndex: diaIndex,
        likes: [],
        likeCount: 0,
        zone: sesion.detalle?.zona || '',
        trainingName: sesion.detalle?.nombre || '',
        hasGPS: true,
        trackPoints: ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
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
        if (document.getElementById('tab-perfil')?.classList.contains('active') && window.Profile) {
          await Profile.cargarPerfil(true);
        }
        if (document.getElementById('tab-muro')?.classList.contains('active') && window.Wall) {
          Wall.cargarMuro();
        }
      }
    }
  },

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
    
    const scaleX = W / rangeLng;
    const scaleY = H / rangeLat;
    const scale = Math.min(scaleX, scaleY);
    const offX = pad + (W - rangeLng * scale) / 2;
    const offY = pad + (H - rangeLat * scale) / 2;
    
    const toXY = (p) => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    
    const pathD = 'M ' + points.map(toXY).join(' L ');
    const startXY = toXY(points[0]).split(',');
    const endXY = toXY(points[points.length - 1]).split(',');
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
           style="border-radius:10px; background:#0f0f0f; display:block; width:100%; max-width:${width}px;"
           xmlns="http://www.w3.org/2000/svg">
        <path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <circle cx="${startXY[0]}" cy="${startXY[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${endXY[0]}"   cy="${endXY[1]}"   r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
        <text x="${pad}" y="${height - 4}" font-size="9" fill="#555" font-family="monospace">● inicio  ● fin</text>
      </svg>
    `;
  },

  // ===== INICIO DE SESIÓN =====
  async iniciar(sesion, diaIndex) {
    if (this.isRunning) {
      Utils.showToast('⚠️ Ya hay una sesión en curso', 'warning');
      return;
    }
    
    if (!navigator.geolocation) {
      Utils.showToast('❌ GPS no disponible en este dispositivo', 'error');
      return;
    }
    
    // Solicitar permisos explícitamente
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
    } catch (err) {
      if (err.code === 1) {
        Utils.showToast('❌ Permiso de GPS denegado. Habilítalo en ajustes.', 'error', 5000);
        return;
      }
    }
    
    // Resetear estado
    this.sesion = sesion;
    this.diaIndex = diaIndex;
    this.trackPoints = [];
    this.isPaused = false;
    this.pauseStart = null;
    this.lastPositions = [];
    this.map = null;
    this.polyline = null;
    this.markerLayer = null;
    
    // Extraer duraciones
    this._extraerDuraciones();
    this.faseActual = 'calentamiento';
    this.tiempoRestanteFase = this.duracionCalentamiento;
    this.faseTerminada = false;
    this.startTimeFase = Date.now();
    
    // Cerrar modal de sesión
    const modal = document.getElementById('detalleSesion');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
    
    // Crear pantalla GPS
    this._crearPantalla();
    
    // Mostrar nombre y zona de la sesión
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (sesion.detalle?.nombre || sesion.tipo || 'SESIÓN').toUpperCase();
    const zonaEl = document.getElementById('gpsSesionZona');
    if (zonaEl && sesion.detalle?.zona) zonaEl.textContent = `Zona: ${sesion.detalle.zona}`;
    
    // Cargar Leaflet
    await this._loadLeaflet();
    
    // Iniciar rastreo GPS
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    
    this.isRunning = true;
    
    // Iniciar actualización de fases
    this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
    
    // Configurar botones
    const pauseBtn = document.getElementById('gpsPauseBtn');
    const siguienteBtn = document.getElementById('gpsSiguienteBtn');
    const finalizarBtn = document.getElementById('gpsFinalizarBtn');
    
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
    if (siguienteBtn) siguienteBtn.onclick = () => this.siguienteFase();
    if (finalizarBtn) finalizarBtn.onclick = () => this.finalizar();
    
    this._actualizarFaseUI();
    
    if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50, 100]);
  }
};

window.GPSTracker = GPSTracker;
console.log('✅ GPSTracker v2.0 con filtro GPS y temporizadores por fases');