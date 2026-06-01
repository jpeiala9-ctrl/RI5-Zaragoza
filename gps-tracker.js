// ==================== gps-tracker.js ====================
// Versión: FINAL - Creada desde cero, sin errores previos.
// - Pantalla de preparación: "Adquiriendo GPS..." -> "GPS adquirido"
// - Botón COMENZAR se habilita automáticamente al recibir primera posición
// - Todas las funciones de entrenamiento (fases, mapa, guardado) intactas
// ====================

const GPSTracker = {

  // ========== ESTADO ==========
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
  
  faseActual: 'preparacion', // 'preparacion', 'calentamiento', 'principal', 'enfriamiento'
  tiempoRestanteFase: 0,
  duracionCalentamiento: 0,
  duracionPrincipal: 0,
  duracionEnfriamiento: 0,
  animationFrame: null,
  startTimeFase: null,
  pauseStart: null,
  
  lastPositions: [],
  gpsReady: false,
  primeraPosicion: null,

  // ========== CÁLCULOS ==========
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
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
    return total;
  },

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
    const pace = (seg / 60) / (distMetros / 1000);
    const mm = Math.floor(pace);
    const ss = Math.floor((pace - mm) * 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  },

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
      script.onerror = () => { console.warn('Leaflet error'); resolve(); };
      document.head.appendChild(script);
    });
  },

  // ========== PANTALLA DE PREPARACIÓN (SIN DATOS TÉCNICOS) ==========
  _crearPantallaPreparacion() {
    const existing = document.getElementById('gpsTrackerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gpsTrackerOverlay';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:#0a0a0a; z-index:999999;
      display:flex; flex-direction:column;
      font-family:"Courier New",monospace;
      color:#ffffff;
    `;

    overlay.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px;">
        <div style="font-size:24px; font-weight:bold; letter-spacing:2px; margin-bottom:20px;">ADQUIRIENDO GPS</div>
        <div id="gpsPrepStatus" style="margin:20px 0; font-size:16px; color:#888;">Adquiriendo GPS...</div>
        <div style="display:flex; gap:15px; margin-top:30px;">
          <button id="gpsStartBtn" style="padding:12px 30px; background:#c0a060; border:none; border-radius:30px; color:#0a0a0a; font-weight:bold; font-size:16px; cursor:pointer; opacity:0.5;" disabled>COMENZAR</button>
          <button id="gpsCancelBtn" style="padding:12px 30px; background:transparent; border:1px solid #888; border-radius:30px; color:#ccc; font-weight:bold; font-size:16px; cursor:pointer;">CANCELAR</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Vincular eventos (después de que existan en el DOM)
    setTimeout(() => {
      const startBtn = document.getElementById('gpsStartBtn');
      const cancelBtn = document.getElementById('gpsCancelBtn');
      if (startBtn) {
        startBtn.onclick = (e) => {
          e.preventDefault();
          if (this.gpsReady) {
            this.comenzarEntreno();
          } else {
            Utils.showToast('Esperando señal GPS...', 'warning');
          }
        };
      }
      if (cancelBtn) {
        cancelBtn.onclick = (e) => {
          e.preventDefault();
          this.cancelarPreparacion();
        };
      }
    }, 100);
  },

  // Se llama al recibir la primera posición
  _gpsAdquirido() {
    if (this.gpsReady) return;
    const statusDiv = document.getElementById('gpsPrepStatus');
    const startBtn = document.getElementById('gpsStartBtn');
    if (statusDiv) {
      statusDiv.innerHTML = '✅ GPS adquirido';
      statusDiv.style.color = '#6bd46b';
    }
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
    }
    this.gpsReady = true;
  },

  async cancelarPreparacion() {
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    const overlay = document.getElementById('gpsTrackerOverlay');
    if (overlay) overlay.remove();
    this.isRunning = false;
    const modal = document.getElementById('detalleSesion');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modal && this.sesion) {
      modal.classList.add('visible');
      if (modalOverlay) modalOverlay.classList.add('visible');
    }
    Utils.showToast('Preparación cancelada', 'info');
  },

  // ========== PANTALLA DE ENTRENAMIENTO ==========
  _crearPantallaEntrenamiento() {
    const existing = document.getElementById('gpsTrackerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gpsTrackerOverlay';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:#0a0a0a; z-index:999999;
      display:flex; flex-direction:column;
      font-family:"Courier New",monospace;
      color:#ffffff;
    `;

    overlay.innerHTML = `
      <div style="padding:12px 20px 10px; display:flex; align-items:center; justify-content:space-between; background:#111; border-bottom:1px solid #2a2a2a; flex-shrink:0;">
        <div>
          <div style="font-size:10px; color:#666; letter-spacing:3px;">Sesión en curso</div>
          <div id="gpsSesionNombre" style="font-size:14px; color:#c0a060; font-weight:bold;"></div>
          <div id="gpsSesionZona" style="font-size:10px; color:#888;"></div>
        </div>
        <div style="display:flex; gap:8px;">
          <div id="gpsSignalDot" style="width:8px; height:8px; border-radius:50%; background:#444;"></div>
          <span id="gpsSignalText" style="font-size:11px; color:#666;">GPS</span>
        </div>
      </div>
      <div id="gpsMapWrapper" style="flex:1; position:relative; background:#0f0f0f;">
        <div id="gpsMap" style="width:100%; height:100%;"></div>
        <div id="gpsNoGPS" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#0f0f0f; color:#555;">
          <div style="text-align:center;">📡 Buscando señal...</div>
        </div>
      </div>
      <div id="faseContainer" style="background:#111; padding:16px 20px; border-top:1px solid #2a2a2a; border-bottom:1px solid #2a2a2a;">
        <div id="faseCalentamiento" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>🔥 CALENTAMIENTO</span><span id="calentamientoRestante">--:--</span></div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; margin-top:4px;"><div id="calentamientoBar" style="width:0%; background:#c0a060; height:6px; border-radius:6px;"></div></div>
        </div>
        <div id="fasePrincipal" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>💪 PARTE PRINCIPAL</span><span id="principalRestante">--:--</span></div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; margin-top:4px;"><div id="principalBar" style="width:0%; background:#9BB5A0; height:6px; border-radius:6px;"></div></div>
        </div>
        <div id="faseEnfriamiento">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span>🧘 ENFRIAMIENTO</span><span id="enfriamientoRestante">--:--</span></div>
          <div style="background:#2a2a2a; border-radius:6px; height:6px; margin-top:4px;"><div id="enfriamientoBar" style="width:0%; background:#8AA0B0; height:6px; border-radius:6px;"></div></div>
        </div>
      </div>
      <div style="background:#111; padding:20px; flex-shrink:0;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div style="text-align:center; background:#1a1a1a; border-radius:14px; padding:14px;"><div id="gpsDistance" style="font-size:34px; font-weight:bold; color:#c0a060;">0.00</div><div style="font-size:10px;">KM</div></div>
          <div style="text-align:center; background:#1a1a1a; border-radius:14px; padding:14px;"><div id="gpsPace" style="font-size:34px; font-weight:bold; color:#9BB5A0;">--:--</div><div style="font-size:10px;">MIN/KM</div></div>
        </div>
        <div id="botonera" style="display:flex; gap:12px;">
          <button id="gpsPauseBtn" style="flex:1; height:54px; border:2px solid #c0a060; background:transparent; color:#c0a060; border-radius:14px; font-weight:bold;">⏸ PAUSA</button>
          <button id="gpsSiguienteBtn" style="flex:1; height:54px; border:2px solid #3498db; background:transparent; color:#3498db; border-radius:14px; font-weight:bold;">⏩ SIGUIENTE</button>
          <button id="gpsFinalizarBtn" style="flex:1; height:54px; border:2px solid #c0392b; background:#c0392b; color:#fff; border-radius:14px; font-weight:bold;">■ FINALIZAR</button>
        </div>
        <div id="gpsPauseBanner" style="display:none; text-align:center; margin-top:12px; color:#c0a060; animation:blink 1s step-start infinite;">⏸ EN PAUSA</div>
      </div>
      <style>@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}</style>
    `;
    document.body.appendChild(overlay);
  },

  // ========== DURACIONES DE LAS FASES ==========
  _extraerDuraciones() {
    const d = this.sesion.detalle || {};
    this.duracionCalentamiento = (d.calentamiento || 0) * 60;
    this.duracionPrincipal = (d.partePrincipal || 0) * 60;
    this.duracionEnfriamiento = (d.enfriamiento || 0) * 60;
    if (this.duracionCalentamiento === 0 && this.duracionPrincipal === 0 && this.duracionEnfriamiento === 0) {
      const total = (this.sesion.duracion || 45) * 60;
      this.duracionCalentamiento = Math.floor(total * 0.15);
      this.duracionPrincipal = total - this.duracionCalentamiento - Math.floor(total * 0.1);
      this.duracionEnfriamiento = total - this.duracionCalentamiento - this.duracionPrincipal;
    }
  },

  _actualizarFaseUI() {
    const cal = document.getElementById('faseCalentamiento');
    const pri = document.getElementById('fasePrincipal');
    const enf = document.getElementById('faseEnfriamiento');
    if (!cal) return;
    cal.style.opacity = this.faseActual === 'calentamiento' ? '1' : '0.3';
    pri.style.opacity = this.faseActual === 'principal' ? '1' : '0.3';
    enf.style.opacity = this.faseActual === 'enfriamiento' ? '1' : '0.3';
    const sig = document.getElementById('gpsSiguienteBtn');
    const fin = document.getElementById('gpsFinalizarBtn');
    if (this.faseActual === 'enfriamiento') {
      if (sig) sig.style.display = 'none';
      if (fin) { fin.style.flex = '2'; fin.style.fontSize = '16px'; }
    } else {
      if (sig) sig.style.display = 'block';
      if (fin) { fin.style.flex = '1'; fin.style.fontSize = '15px'; }
    }
  },

  async comenzarEntreno() {
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    this.faseActual = 'calentamiento';
    this.tiempoRestanteFase = this.duracionCalentamiento;
    this.startTimeFase = Date.now();
    this.trackPoints = [];
    this.lastPositions = [];
    this._crearPantallaEntrenamiento();
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (this.sesion.detalle?.nombre || this.sesion.tipo || 'SESIÓN').toUpperCase();
    const zonaEl = document.getElementById('gpsSesionZona');
    if (zonaEl && this.sesion.detalle?.zona) zonaEl.textContent = `Zona: ${this.sesion.detalle.zona}`;
    await this._loadLeaflet();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    this.isRunning = true;
    this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
    const pauseBtn = document.getElementById('gpsPauseBtn');
    const siguienteBtn = document.getElementById('gpsSiguienteBtn');
    const finalizarBtn = document.getElementById('gpsFinalizarBtn');
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
    if (siguienteBtn) siguienteBtn.onclick = () => this.siguienteFase();
    if (finalizarBtn) finalizarBtn.onclick = () => this.finalizar();
    this._actualizarFaseUI();
    Utils.showToast('✅ Entrenamiento iniciado', 'success', 2000);
  },

  async siguienteFase() {
    if (this.faseActual === 'enfriamiento') {
      await this.finalizar();
      return;
    }
    const confirmado = await Utils.confirm('Saltar fase', `¿Saltar la fase actual (${this.faseActual === 'calentamiento' ? 'CALENTAMIENTO' : 'PARTE PRINCIPAL'})?`);
    if (!confirmado) return;
    if (this.faseActual === 'calentamiento') {
      this.faseActual = 'principal';
      this.tiempoRestanteFase = this.duracionPrincipal;
    } else if (this.faseActual === 'principal') {
      this.faseActual = 'enfriamiento';
      this.tiempoRestanteFase = this.duracionEnfriamiento;
    }
    this.startTimeFase = Date.now();
    this._actualizarFaseUI();
    Utils.showToast(`▶️ Ahora: ${this.faseActual.toUpperCase()}`, 'info', 2000);
  },

  _updateFaseTimers() {
    if (!this.isRunning || this.isPaused) {
      this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
      return;
    }
    const ahora = Date.now();
    let nuevoRestante = Math.max(0, this.tiempoRestanteFase - (ahora - this.startTimeFase) / 1000);
    let total = 0, bar = null, text = null;
    if (this.faseActual === 'calentamiento') {
      total = this.duracionCalentamiento;
      bar = document.getElementById('calentamientoBar');
      text = document.getElementById('calentamientoRestante');
    } else if (this.faseActual === 'principal') {
      total = this.duracionPrincipal;
      bar = document.getElementById('principalBar');
      text = document.getElementById('principalRestante');
    } else {
      total = this.duracionEnfriamiento;
      bar = document.getElementById('enfriamientoBar');
      text = document.getElementById('enfriamientoRestante');
    }
    if (total > 0 && bar) bar.style.width = `${((total - nuevoRestante) / total) * 100}%`;
    if (text) text.textContent = this._formatTime(Math.floor(nuevoRestante));
    if (nuevoRestante <= 0 && this.faseActual !== 'enfriamiento') {
      if (this.faseActual === 'calentamiento') {
        this.faseActual = 'principal';
        this.tiempoRestanteFase = this.duracionPrincipal;
      } else if (this.faseActual === 'principal') {
        this.faseActual = 'enfriamiento';
        this.tiempoRestanteFase = this.duracionEnfriamiento;
      }
      this.startTimeFase = Date.now();
      this._actualizarFaseUI();
      Utils.showToast(`✅ Fase completada. Ahora: ${this.faseActual.toUpperCase()}`, 'success', 2000);
    }
    this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
  },

  _initMap(lat, lng) {
    if (this.map || !window.L) return;
    const noGPS = document.getElementById('gpsNoGPS');
    if (noGPS) noGPS.style.display = 'none';
    try {
      this.map = window.L.map('gpsMap', { zoomControl: false, attributionControl: false }).setView([lat, lng], 16);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.map);
      this.polyline = window.L.polyline([], { color: '#c0a060', weight: 4 }).addTo(this.map);
      const icon = window.L.divIcon({ html: `<div style="width:12px;height:12px;background:#c0a060;border:2px solid #fff;border-radius:50%;"></div>`, iconAnchor: [6, 6] });
      this.markerLayer = window.L.marker([lat, lng], { icon }).addTo(this.map);
    } catch (e) { console.warn(e); }
  },

  _updateMap(lat, lng) {
    if (!window.L) return;
    if (!this.map) this._initMap(lat, lng);
    else {
      this.polyline.addLatLng([lat, lng]);
      this.markerLayer.setLatLng([lat, lng]);
      this.map.panTo([lat, lng]);
    }
  },

  _smoothPosition(lat, lng, acc) {
    this.lastPositions.push({ lat, lng, acc, ts: Date.now() });
    if (this.lastPositions.length > 3) this.lastPositions.shift();
    let sumLat = 0, sumLng = 0, totalWeight = 0;
    for (let p of this.lastPositions) {
      const w = 1 / (p.acc || 10);
      sumLat += p.lat * w;
      sumLng += p.lng * w;
      totalWeight += w;
    }
    if (totalWeight > 0) return { lat: sumLat / totalWeight, lng: sumLng / totalWeight };
    return { lat, lng };
  },

  _onPosition(pos) {
    let { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (this.faseActual === 'preparacion') {
      if (!this.gpsReady) {
        this._gpsAdquirido();
        this.primeraPosicion = { lat, lng, acc: accuracy };
      }
      return;
    }
    if (accuracy > 25 && this.trackPoints.length > 2) return;
    const smoothed = this._smoothPosition(lat, lng, accuracy);
    lat = smoothed.lat;
    lng = smoothed.lng;
    const dot = document.getElementById('gpsSignalDot');
    const txt = document.getElementById('gpsSignalText');
    const color = accuracy < 15 ? '#6bd46b' : accuracy < 30 ? '#f1c40f' : '#e74c3c';
    if (dot) dot.style.background = color;
    if (txt) txt.textContent = accuracy ? `±${Math.round(accuracy)}m` : 'GPS';
    if (this.isPaused) return;
    if (this.trackPoints.length > 0) {
      const last = this.trackPoints[this.trackPoints.length - 1];
      if (this._haversine(last.lat, last.lng, lat, lng) < 4) return;
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
  },

  _actualizarStats() {
    const dist = this._calcTotalDistance() / 1000;
    const elapsed = this._getElapsedTotal();
    const distEl = document.getElementById('gpsDistance');
    const paceEl = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = dist.toFixed(2);
    if (paceEl) paceEl.textContent = this._formatPace(dist * 1000, elapsed);
  },

  _getElapsedTotal() {
    if (!this.startTimeFase) return 0;
    let total = this.duracionCalentamiento + this.duracionPrincipal + this.duracionEnfriamiento;
    return total - this.tiempoRestanteFase;
  },

  togglePause() {
    if (!this.isRunning || this.faseActual === 'preparacion') return;
    const btn = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');
    if (this.isPaused) {
      const pausa = Date.now() - this.pauseStart;
      this.startTimeFase += pausa;
      this.isPaused = false;
      if (btn) { btn.innerHTML = '⏸ PAUSA'; btn.style.color = '#c0a060'; btn.style.borderColor = '#c0a060'; }
      if (banner) banner.style.display = 'none';
      if (Utils.vibrate) Utils.vibrate(50);
    } else {
      this.pauseStart = Date.now();
      this.isPaused = true;
      if (btn) { btn.innerHTML = '▶ REANUDAR'; btn.style.color = '#9BB5A0'; btn.style.borderColor = '#9BB5A0'; }
      if (banner) banner.style.display = 'block';
      if (Utils.vibrate) Utils.vibrate([50, 50]);
    }
  },

  async finalizar() {
    if (!this.isRunning) return;
    const distKm = this._calcTotalDistance() / 1000;
    const elapsed = this._getElapsedTotal();
    const confirmed = await Utils.confirm('FINALIZAR SESIÓN', `¿Guardar sesión?\n📏 ${distKm.toFixed(2)} km · ⏱️ ${this._formatTime(Math.floor(elapsed))}`);
    if (!confirmed) return;
    this.isRunning = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    const overlay = document.getElementById('gpsTrackerOverlay');
    if (overlay) overlay.remove();
    Utils.showLoading();
    try {
      await this._guardarYPublicar(distKm, elapsed);
      Utils.hideLoading();
      Utils.showToast(`✅ Sesión guardada · ${distKm.toFixed(2)} km · ${this._formatTime(Math.floor(elapsed))}`, 'success', 5000);
      if (Utils.launchConfetti) Utils.launchConfetti();
      if (Utils.vibrate) Utils.vibrate([100, 50, 100, 50, 200]);
      if (Utils.playSound) Utils.playSound('success');
    } catch (err) {
      console.error(err);
      Utils.hideLoading();
      Utils.showToast('⚠️ Error al guardar la sesión GPS', 'error');
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
    await firebaseServices.db.collection('users').doc(uid).collection('gps_tracks').add(trackData);
    await planRef.update({ [`gpsTrack.${this.diaIndex}`]: trackData });
    await planRef.update({ [`sesionesRealizadas.${this.diaIndex}`]: true });
    if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
    AppState.sesionesRealizadas[this.diaIndex] = true;
    const celda = document.querySelector(`.calendario-dia[data-index="${this.diaIndex}"]`);
    if (celda) celda.classList.add('realizado');
    if (this.sesion && this.sesion.tipo !== 'descanso') {
      await PlanGenerator.limpiarMuroGlobal();
      const metricas = PlanGenerator.calcularMetricasSesion(this.sesion);
      const tss = isFinite(metricas?.tssTotal) ? metricas.tssTotal : 0;
      const userData = AppState.currentUserData;
      const entry = {
        userId: uid, username: userData?.username || '', photoURL: userData?.profile?.photoURL || null,
        trainingType: this.sesion.tipo, duration: this.sesion.duracion || 0,
        distancia: parseFloat(distKm.toFixed(3)), tss,
        timestamp: firebaseServices.Timestamp.now(), planId, sesionIndex: this.diaIndex,
        likes: [], likeCount: 0, zone: this.sesion.detalle?.zona || '',
        trainingName: this.sesion.detalle?.nombre || '',
        hasGPS: true, trackPoints: ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
        gpsDistanceKm: parseFloat(distKm.toFixed(3)), gpsDurationMs: elapsedMs
      };
      const globalRef = await firebaseServices.db.collection('globalFeed').add(entry);
      await planRef.update({ [`wallEntryId.${this.diaIndex}`]: globalRef.id });
      if (window.Gamification) {
        const metricasGPS = { ...(metricas || {}), distanciaTotal: distKm };
        await Gamification.updateAfterSession(uid, this.sesion, metricasGPS);
        if (document.getElementById('tab-perfil')?.classList.contains('active') && window.Profile) await Profile.cargarPerfil(true);
        if (document.getElementById('tab-muro')?.classList.contains('active') && window.Wall) Wall.cargarMuro();
      }
    }
  },

  _decimarPuntos(points, maxPts) {
    if (points.length <= maxPts) return points;
    const step = Math.ceil(points.length / maxPts);
    const result = [];
    for (let i = 0; i < points.length; i += step) result.push(points[i]);
    const last = points[points.length - 1];
    if (result[result.length - 1] !== last) result.push(last);
    return result;
  },

  renderTrackSVG(points, width = 320, height = 130) {
    if (!points || points.length < 2) return '';
    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLng = maxLng - minLng || 0.0001, rangeLat = maxLat - minLat || 0.0001;
    const pad = 14, W = width - pad * 2, H = height - pad * 2;
    const scale = Math.min(W / rangeLng, H / rangeLat);
    const offX = pad + (W - rangeLng * scale) / 2;
    const offY = pad + (H - rangeLat * scale) / 2;
    const toXY = p => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const pathD = 'M ' + points.map(toXY).join(' L ');
    const start = toXY(points[0]).split(','), end = toXY(points[points.length - 1]).split(',');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="border-radius:10px; background:#0f0f0f; display:block; width:100%; max-width:${width}px;"><path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/><circle cx="${start[0]}" cy="${start[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/><circle cx="${end[0]}" cy="${end[1]}" r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/><text x="${pad}" y="${height - 4}" font-size="9" fill="#555" font-family="monospace">● inicio  ● fin</text></svg>`;
  },

  async iniciar(sesion, diaIndex) {
    if (this.isRunning) { Utils.showToast('⚠️ Ya hay una sesión en curso', 'warning'); return; }
    if (!navigator.geolocation) { Utils.showToast('❌ GPS no disponible', 'error'); return; }
    try {
      await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
    } catch (err) {
      if (err.code === 1) { Utils.showToast('❌ Permiso de GPS denegado. Habilítalo en ajustes.', 'error', 5000); return; }
    }
    this.sesion = sesion;
    this.diaIndex = diaIndex;
    this.trackPoints = [];
    this.isPaused = false;
    this.isRunning = false;
    this.lastPositions = [];
    this.map = null;
    this.polyline = null;
    this.markerLayer = null;
    this.gpsReady = false;
    this.primeraPosicion = null;
    this.faseActual = 'preparacion';
    this._extraerDuraciones();
    const modal = document.getElementById('detalleSesion');
    const overlayModal = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('visible');
    if (overlayModal) overlayModal.classList.remove('visible');
    this._crearPantallaPreparacion();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }
};

window.GPSTracker = GPSTracker;
console.log('✅ GPSTracker - Versión final, completamente funcional');