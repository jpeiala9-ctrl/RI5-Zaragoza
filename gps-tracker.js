// ==================== gps-tracker.js ====================
// Versión: 2.6 (Extendida) - Botón COMENZAR funcional, cancelar operativo, sin emoticono
// ====================
// Descripción: Módulo de grabación GPS para sesiones de entrenamiento.
// Incluye adquisición previa de señal, fases (calentamiento/principal/enfriamiento),
// botón siguiente para saltar fases, pausa, finalizar, y guardado en Firestore.
// ====================

const GPSTracker = {

  // ==================== ESTADO INTERNO ====================
  
  // Datos de la sesión actual
  sesion: null,          // Objeto sesión del plan
  diaIndex: null,        // Índice del día en el plan

  // Puntos del track GPS (lat, lng, timestamp, accuracy)
  trackPoints: [],

  // Identificador del watchPosition de geolocalización
  watchId: null,

  // Estado de la sesión
  isPaused: false,       // Si la sesión está en pausa
  isRunning: false,      // Si la sesión está activa (grabando)

  // Elementos del mapa Leaflet
  map: null,
  polyline: null,
  markerLayer: null,
  leafletLoaded: false,  // Flag para saber si Leaflet ya se cargó

  // Control de fases del entrenamiento
  faseActual: 'preparacion',   // 'preparacion', 'calentamiento', 'principal', 'enfriamiento'
  tiempoRestanteFase: 0,       // Segundos restantes en la fase actual
  duracionCalentamiento: 0,    // Duración total del calentamiento (segundos)
  duracionPrincipal: 0,        // Duración total de la parte principal (segundos)
  duracionEnfriamiento: 0,     // Duración total del enfriamiento (segundos)

  animationFrame: null,        // ID del requestAnimationFrame para los temporizadores
  startTimeFase: null,         // Timestamp de inicio de la fase actual (ms)

  // Filtro de suavizado de posición (promedio móvil)
  lastPositions: [],           // Almacena las últimas 3 posiciones con peso por precisión

  // Adquisición inicial de GPS
  gpsReady: false,            // Si la señal GPS es buena (precisión <= 20 m)
  primeraPosicion: null,      // Primera posición recibida (útil para el mapa)

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Fórmula de Haversine para calcular distancia entre dos coordenadas (metros)
   */
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /**
   * Calcula la distancia total del track acumulado (metros)
   */
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

  /**
   * Formatea segundos a HH:MM:SS o MM:SS
   */
  _formatTime(seg) {
    if (!isFinite(seg) || seg < 0) seg = 0;
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  /**
   * Calcula el ritmo medio (min/km) a partir de distancia (metros) y tiempo (segundos)
   */
  _formatPace(distMetros, seg) {
    if (distMetros < 20 || seg < 5) return '--:--';
    const distKm = distMetros / 1000;
    const paceMin = (seg / 60) / distKm;
    const mm = Math.floor(paceMin);
    const ss = Math.floor((paceMin - mm) * 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  },

  /**
   * Carga dinámicamente la librería Leaflet para el mapa
   */
  _loadLeaflet() {
    return new Promise((resolve) => {
      if (window.L && this.leafletLoaded) {
        resolve();
        return;
      }
      if (window.L) {
        this.leafletLoaded = true;
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        this.leafletLoaded = true;
        resolve();
      };
      script.onerror = () => {
        console.warn('No se pudo cargar Leaflet, mapa no disponible');
        resolve(); // Continuar sin mapa
      };
      document.head.appendChild(script);
    });
  },

  // ==================== PANTALLA DE PREPARACIÓN (ADQUISICIÓN GPS) ====================

  /**
   * Crea la pantalla de preparación donde se espera señal GPS suficiente
   */
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
        <div id="gpsPrepStatus" style="margin:20px 0; font-size:14px; color:#888;">Buscando señal...</div>
        <div id="gpsPrepAccuracy" style="font-size:12px; color:#555;"></div>
        <div style="display:flex; gap:15px; margin-top:30px;">
          <button id="gpsStartBtn" style="padding:12px 30px; background:#c0a060; border:none; border-radius:30px; color:#0a0a0a; font-weight:bold; font-size:16px; cursor:pointer; opacity:0.5; transition:opacity 0.3s;" disabled>COMENZAR</button>
          <button id="gpsCancelBtn" style="padding:12px 30px; background:transparent; border:1px solid #888; border-radius:30px; color:#ccc; font-weight:bold; font-size:16px; cursor:pointer;">CANCELAR</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  },

  /**
   * Actualiza la pantalla de preparación con la precisión actual
   * Habilita el botón "COMENZAR" cuando la precisión es <= 20 m
   */
  _actualizarPantallaPreparacion(accuracy) {
    const statusDiv = document.getElementById('gpsPrepStatus');
    const accDiv = document.getElementById('gpsPrepAccuracy');
    const btn = document.getElementById('gpsStartBtn');
    if (!statusDiv) return;

    if (accuracy !== null && accuracy <= 20) {
      statusDiv.innerHTML = '✅ Señal GPS adquirida';
      statusDiv.style.color = '#6bd46b';
      accDiv.innerHTML = `Precisión: ±${Math.round(accuracy)}m`;
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
      this.gpsReady = true;
    } else {
      statusDiv.innerHTML = '🔄 Buscando mejor señal...';
      statusDiv.style.color = '#f1c40f';
      accDiv.innerHTML = accuracy ? `Precisión actual: ±${Math.round(accuracy)}m (ideal <20m)` : '';
      if (btn && !btn.disabled) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'default';
      }
      this.gpsReady = false;
    }
  },

  /**
   * Cancela la preparación: detiene la búsqueda de GPS, cierra la pantalla y vuelve al modal de la sesión
   */
  async cancelarPreparacion() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    const gpsOverlay = document.getElementById('gpsTrackerOverlay');
    if (gpsOverlay) gpsOverlay.remove();
    this.isRunning = false;

    // Volver a mostrar el modal de la sesión
    const modal = document.getElementById('detalleSesion');
    const modalOverlay = document.getElementById('modalOverlay');
    if (modal && this.sesion) {
      modal.classList.add('visible');
      if (modalOverlay) modalOverlay.classList.add('visible');
    }
    Utils.showToast('Preparación cancelada', 'info');
  },

  // ==================== PANTALLA PRINCIPAL DE ENTRENAMIENTO ====================

  /**
   * Crea la pantalla de entrenamiento con mapa, fases, estadísticas y botones
   */
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
            <div id="gpsDistance" style="font-size:34px; font-weight:bold; color:#c0a060; line-height:1;">0.00</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px;">KM</div>
          </div>
          <div style="text-align:center; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:14px; padding:14px 8px;">
            <div id="gpsPace" style="font-size:34px; font-weight:bold; color:#9BB5A0; line-height:1;">--:--</div>
            <div style="font-size:10px; color:#555; letter-spacing:2px;">MIN/KM</div>
          </div>
        </div>

        <!-- BOTONES -->
        <div id="botonera" style="display:flex; gap:12px;">
          <button id="gpsPauseBtn" class="gps-pause-btn" style="flex:1; height:54px; border:2px solid #c0a060; background:transparent; color:#c0a060; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer;">⏸ PAUSA</button>
          <button id="gpsSiguienteBtn" class="gps-siguiente-btn" style="flex:1; height:54px; border:2px solid #3498db; background:transparent; color:#3498db; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer;">⏩ SIGUIENTE</button>
          <button id="gpsFinalizarBtn" class="gps-finalizar-btn" style="flex:1; height:54px; border:2px solid #c0392b; background:#c0392b; color:#fff; border-radius:14px; font-size:15px; font-weight:bold; cursor:pointer;">■ FINALIZAR</button>
        </div>
        <div id="gpsPauseBanner" style="display:none; text-align:center; margin-top:12px; color:#c0a060; animation:blink 1.2s step-start infinite;">⏸ EN PAUSA</div>
      </div>
      <style>
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .gps-pause-btn:active, .gps-siguiente-btn:active, .gps-finalizar-btn:active { transform:scale(0.97); }
      </style>
    `;

    document.body.appendChild(overlay);
  },

  // ==================== EXTRACCIÓN DE DURACIONES DE LA SESIÓN ====================

  /**
   * Extrae las duraciones de calentamiento, parte principal y enfriamiento desde el detalle de la sesión.
   * Si no están definidas, usa valores por defecto (15% calentamiento, 10% enfriamiento).
   */
  _extraerDuraciones() {
    const detalle = this.sesion.detalle || {};
    this.duracionCalentamiento = (detalle.calentamiento || 0) * 60;
    this.duracionPrincipal = (detalle.partePrincipal || 0) * 60;
    this.duracionEnfriamiento = (detalle.enfriamiento || 0) * 60;

    if (this.duracionCalentamiento === 0 && this.duracionPrincipal === 0 && this.duracionEnfriamiento === 0) {
      const total = (this.sesion.duracion || 45) * 60;
      this.duracionCalentamiento = Math.floor(total * 0.15);
      this.duracionPrincipal = total - this.duracionCalentamiento - Math.floor(total * 0.1);
      this.duracionEnfriamiento = total - this.duracionCalentamiento - this.duracionPrincipal;
    }
  },

  // ==================== ACTUALIZACIÓN DE LA INTERFAZ DE FASES ====================

  /**
   * Cambia la opacidad de las fases según la fase actual y ajusta los botones
   */
  _actualizarFaseUI() {
    const calDiv = document.getElementById('faseCalentamiento');
    const priDiv = document.getElementById('fasePrincipal');
    const enfDiv = document.getElementById('faseEnfriamiento');
    if (!calDiv) return;

    calDiv.style.opacity = this.faseActual === 'calentamiento' ? '1' : '0.3';
    priDiv.style.opacity = this.faseActual === 'principal' ? '1' : '0.3';
    enfDiv.style.opacity = this.faseActual === 'enfriamiento' ? '1' : '0.3';

    this._actualizarBotonesSegunFase();
  },

  /**
   * Configura la visibilidad y tamaño de los botones según la fase:
   * - En enfriamiento: oculta "Siguiente" y agranda "Finalizar"
   * - En otras fases: muestra "Siguiente" y tamaño normal
   */
  _actualizarBotonesSegunFase() {
    const siguienteBtn = document.getElementById('gpsSiguienteBtn');
    const finalizarBtn = document.getElementById('gpsFinalizarBtn');
    const pauseBtn = document.getElementById('gpsPauseBtn');
    if (!siguienteBtn || !finalizarBtn) return;

    if (this.faseActual === 'enfriamiento') {
      siguienteBtn.style.display = 'none';
      finalizarBtn.style.flex = '2';
      if (pauseBtn) pauseBtn.style.flex = '1';
      finalizarBtn.style.fontSize = '16px';
    } else {
      siguienteBtn.style.display = 'block';
      finalizarBtn.style.flex = '1';
      if (pauseBtn) pauseBtn.style.flex = '1';
      finalizarBtn.style.fontSize = '15px';
    }
  },

  // ==================== INICIO DEL ENTRENAMIENTO (TRAS ADQUISICIÓN GPS) ====================

  /**
   * Comienza el entrenamiento: cambia a la fase de calentamiento, crea la pantalla,
   * inicia el watchPosition y el bucle de temporizadores.
   */
  async comenzarEntreno() {
    // Detener el watch de preparación
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Inicializar fases
    this.faseActual = 'calentamiento';
    this.tiempoRestanteFase = this.duracionCalentamiento;
    this.startTimeFase = Date.now();
    this.trackPoints = [];
    this.lastPositions = [];

    // Crear pantalla de entrenamiento
    this._crearPantallaEntrenamiento();

    // Mostrar datos de la sesión
    const nombreEl = document.getElementById('gpsSesionNombre');
    if (nombreEl) nombreEl.textContent = (this.sesion.detalle?.nombre || this.sesion.tipo || 'SESIÓN').toUpperCase();
    const zonaEl = document.getElementById('gpsSesionZona');
    if (zonaEl && this.sesion.detalle?.zona) zonaEl.textContent = `Zona: ${this.sesion.detalle.zona}`;

    // Cargar Leaflet para el mapa
    await this._loadLeaflet();

    // Iniciar la geolocalización para el entrenamiento
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    this.isRunning = true;

    // Iniciar el bucle de actualización de temporizadores
    this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());

    // Asignar eventos a los botones (usando funciones flecha para mantener el contexto)
    const pauseBtn = document.getElementById('gpsPauseBtn');
    const siguienteBtn = document.getElementById('gpsSiguienteBtn');
    const finalizarBtn = document.getElementById('gpsFinalizarBtn');
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
    if (siguienteBtn) siguienteBtn.onclick = () => this.siguienteFase();
    if (finalizarBtn) finalizarBtn.onclick = () => this.finalizar();

    this._actualizarFaseUI();
    Utils.showToast('✅ Entrenamiento iniciado', 'success', 2000);
  },

  // ==================== CONTROL DE FASES (SIGUIENTE / AUTOMÁTICO) ====================

  /**
   * Permite saltar manualmente a la siguiente fase (con confirmación).
   * En la fase de enfriamiento, este método llama a finalizar().
   */
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

  /**
   * Bucle principal que actualiza el tiempo restante de la fase actual y la barra de progreso.
   * Cuando una fase termina, pasa automáticamente a la siguiente (excepto si es enfriamiento).
   */
  _updateFaseTimers() {
    if (!this.isRunning || this.isPaused) {
      this.animationFrame = requestAnimationFrame(() => this._updateFaseTimers());
      return;
    }

    const ahora = Date.now();
    let transcurrido = (ahora - this.startTimeFase) / 1000;
    let nuevoRestante = Math.max(0, this.tiempoRestanteFase - transcurrido);

    let totalFase = 0, barElement = null, textElement = null;
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

    // Actualizar barra y texto
    if (totalFase > 0 && barElement) {
      const pct = ((totalFase - nuevoRestante) / totalFase) * 100;
      barElement.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
    if (textElement) textElement.textContent = this._formatTime(Math.floor(nuevoRestante));

    // Si la fase ha terminado y no es la última, pasar automáticamente
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

  // ==================== MAPA LEAFLET ====================

  /**
   * Inicializa el mapa Leaflet con una vista centrada en las coordenadas dadas
   */
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
        color: '#c0a060',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'
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

  /**
   * Actualiza el mapa añadiendo un nuevo punto y centrando la vista
   */
  _updateMap(lat, lng) {
    if (!window.L) return;
    if (!this.map) {
      this._initMap(lat, lng);
    } else {
      try {
        this.polyline.addLatLng([lat, lng]);
        this.markerLayer.setLatLng([lat, lng]);
        this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
      } catch (e) {
        // Ignorar errores si el mapa aún no está listo
      }
    }
  },

  // ==================== FILTRO DE SUAVIZADO DE POSICIÓN GPS ====================

  /**
   * Suaviza la posición mediante promedio móvil ponderado por precisión
   */
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

  // ==================== MANEJADORES DE GEOLOCALIZACIÓN ====================

  /**
   * Callback de posición GPS
   */
  _onPosition(pos) {
    let { latitude: lat, longitude: lng, accuracy } = pos.coords;

    // Fase de preparación: solo actualizar estado, no guardar track
    if (this.faseActual === 'preparacion') {
      this._actualizarPantallaPreparacion(accuracy);
      if (!this.primeraPosicion || accuracy < (this.primeraPosicion.acc || 100)) {
        this.primeraPosicion = { lat, lng, acc: accuracy };
      }
      return;
    }

    // Durante el entrenamiento: aplicar filtros de calidad
    // Descartar puntos con muy mala precisión (excepto los primeros para no quedarnos sin datos)
    if (accuracy > 25 && this.trackPoints.length > 2) return;

    // Suavizado
    const smoothed = this._smoothPosition(lat, lng, accuracy);
    lat = smoothed.lat;
    lng = smoothed.lng;

    // Actualizar indicador de señal en la UI
    const dot = document.getElementById('gpsSignalDot');
    const txt = document.getElementById('gpsSignalText');
    const color = accuracy < 15 ? '#6bd46b' : accuracy < 30 ? '#f1c40f' : '#e74c3c';
    if (dot) dot.style.background = color;
    if (txt) txt.textContent = `±${Math.round(accuracy)}m`;

    if (this.isPaused) return;

    // Evitar puntos demasiado cercanos para no saturar el track (menos de 4 metros)
    if (this.trackPoints.length > 0) {
      const last = this.trackPoints[this.trackPoints.length - 1];
      if (this._haversine(last.lat, last.lng, lat, lng) < 4) return;
    }

    // Guardar punto
    this.trackPoints.push({ lat, lng, ts: Date.now(), acc: Math.round(accuracy) });
    this._updateMap(lat, lng);
    this._actualizarStats();
  },

  /**
   * Callback de error de geolocalización
   */
  _onGPSError(err) {
    const codes = { 1: 'Permiso denegado', 2: 'Sin señal', 3: 'Tiempo de espera' };
    const txt = document.getElementById('gpsSignalText');
    if (txt) txt.textContent = codes[err.code] || 'ERROR';
    const dot = document.getElementById('gpsSignalDot');
    if (dot) dot.style.background = '#e74c3c';
    if (this.faseActual === 'preparacion') {
      this._actualizarPantallaPreparacion(null);
    }
  },

  // ==================== ACTUALIZACIÓN DE ESTADÍSTICAS (DISTANCIA Y RITMO) ====================

  /**
   * Actualiza los elementos de distancia y ritmo en la UI
   */
  _actualizarStats() {
    const distMetros = this._calcTotalDistance();
    const elapsed = this._getElapsedTotal();
    const distEl = document.getElementById('gpsDistance');
    const paceEl = document.getElementById('gpsPace');
    if (distEl) distEl.textContent = (distMetros / 1000).toFixed(2);
    if (paceEl) paceEl.textContent = this._formatPace(distMetros, elapsed);
  },

  /**
   * Calcula el tiempo total transcurrido desde el inicio de la sesión
   * restando el tiempo restante de la fase actual.
   */
  _getElapsedTotal() {
    if (!this.startTimeFase) return 0;
    let totalDuracion = this.duracionCalentamiento + this.duracionPrincipal + this.duracionEnfriamiento;
    let progreso = totalDuracion - this.tiempoRestanteFase;
    return Math.max(0, progreso);
  },

  // ==================== PAUSA / REANUDAR ====================

  /**
   * Alterna el estado de pausa/reanudación
   */
  togglePause() {
    if (!this.isRunning || this.faseActual === 'preparacion') return;

    const btn = document.getElementById('gpsPauseBtn');
    const banner = document.getElementById('gpsPauseBanner');

    if (this.isPaused) {
      // Reanudar
      const ahora = Date.now();
      const pausaDuracion = ahora - this.pauseStart;
      this.startTimeFase += pausaDuracion;
      this.isPaused = false;
      if (btn) {
        btn.innerHTML = '⏸ PAUSA';
        btn.style.color = '#c0a060';
        btn.style.borderColor = '#c0a060';
      }
      if (banner) banner.style.display = 'none';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate(50);
    } else {
      // Pausar
      this.pauseStart = Date.now();
      this.isPaused = true;
      if (btn) {
        btn.innerHTML = '▶ REANUDAR';
        btn.style.color = '#9BB5A0';
        btn.style.borderColor = '#9BB5A0';
      }
      if (banner) banner.style.display = 'block';
      if (typeof Utils !== 'undefined' && Utils.vibrate) Utils.vibrate([50, 50]);
    }
  },

  // ==================== FINALIZAR SESIÓN Y GUARDAR DATOS ====================

  /**
   * Finaliza la sesión, detiene la grabación, guarda el track y publica en el muro.
   */
  async finalizar() {
    if (!this.isRunning) return;

    const distKm = this._calcTotalDistance() / 1000;
    const elapsed = this._getElapsedTotal();

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

    // Eliminar overlay
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

  /**
   * Guarda el track en Firestore, actualiza el plan, marca la sesión como realizada
   * y publica la entrada en el muro global con minimapa.
   */
  async _guardarYPublicar(distKm, elapsedMs) {
    const uid = AppState?.currentUserId;
    if (!uid || !AppState?.planActualId) throw new Error('Sin usuario o plan activo');

    const planId = AppState.planActualId;
    const planRef = firebaseServices.db
      .collection('users').doc(uid)
      .collection('planes').doc(planId);

    // Decimar puntos para no sobrecargar la base de datos (máx 120 para el track completo, 60 para el muro)
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

    // 1. Guardar track completo en subcolección del usuario
    await firebaseServices.db
      .collection('users').doc(uid)
      .collection('gps_tracks')
      .add(trackData);

    // 2. Guardar referencia en el plan
    await planRef.update({ [`gpsTrack.${this.diaIndex}`]: trackData });

    // 3. Marcar sesión como realizada
    await planRef.update({ [`sesionesRealizadas.${this.diaIndex}`]: true });
    if (!AppState.sesionesRealizadas) AppState.sesionesRealizadas = {};
    AppState.sesionesRealizadas[this.diaIndex] = true;

    // Actualizar visualmente la celda del calendario
    const celda = document.querySelector(`.calendario-dia[data-index="${this.diaIndex}"]`);
    if (celda) celda.classList.add('realizado');

    // 4. Publicar en muro global con track GPS
    if (this.sesion && this.sesion.tipo !== 'descanso') {
      await PlanGenerator.limpiarMuroGlobal();  // Limpiar entradas antiguas

      const metricas = PlanGenerator.calcularMetricasSesion(this.sesion);
      const tss = isFinite(metricas?.tssTotal) ? metricas.tssTotal : 0;
      const userData = AppState.currentUserData;

      const entry = {
        userId: uid,
        username: userData?.username || '',
        photoURL: userData?.profile?.photoURL || null,
        trainingType: this.sesion.tipo,
        duration: this.sesion.duracion || 0,
        distancia: parseFloat(distKm.toFixed(3)),
        tss,
        timestamp: firebaseServices.Timestamp.now(),
        planId,
        sesionIndex: this.diaIndex,
        likes: [],
        likeCount: 0,
        zone: this.sesion.detalle?.zona || '',
        trainingName: this.sesion.detalle?.nombre || '',
        hasGPS: true,
        trackPoints: ptsWall.map(p => ({ lat: p.lat, lng: p.lng })),
        gpsDistanceKm: parseFloat(distKm.toFixed(3)),
        gpsDurationMs: elapsedMs
      };

      const globalRef = await firebaseServices.db.collection('globalFeed').add(entry);
      await planRef.update({ [`wallEntryId.${this.diaIndex}`]: globalRef.id });

      // 5. Actualizar gamificación con la distancia real GPS
      if (window.Gamification) {
        const metricasGPS = { ...(metricas || {}), distanciaTotal: distKm };
        await Gamification.updateAfterSession(uid, this.sesion, metricasGPS);
        // Refrescar UI si es necesario
        if (document.getElementById('tab-perfil')?.classList.contains('active') && window.Profile) {
          await Profile.cargarPerfil(true);
        }
        if (document.getElementById('tab-muro')?.classList.contains('active') && window.Wall) {
          Wall.cargarMuro();
        }
      }
    }
  },

  /**
   * Reduce el número de puntos del track para evitar saturar la base de datos
   * @param {Array} points - Lista de puntos
   * @param {number} maxPts - Número máximo de puntos deseado
   * @returns {Array} Lista decimada
   */
  _decimarPuntos(points, maxPts) {
    if (points.length <= maxPts) return points;
    const step = Math.ceil(points.length / maxPts);
    const result = [];
    for (let i = 0; i < points.length; i += step) {
      result.push(points[i]);
    }
    // Asegurar que el último punto esté incluido
    const last = points[points.length - 1];
    if (result[result.length - 1] !== last) result.push(last);
    return result;
  },

  // ==================== GENERADOR DE MINIMAP SVG (PARA EL MURO) ====================

  /**
   * Genera un SVG con el track para mostrar en el muro
   * @param {Array} points - Lista de puntos {lat, lng}
   * @param {number} width - Ancho del SVG
   * @param {number} height - Alto del SVG
   * @returns {string} Código SVG del track
   */
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

    const scale = Math.min(W / rangeLng, H / rangeLat);
    const offX = pad + (W - rangeLng * scale) / 2;
    const offY = pad + (H - rangeLat * scale) / 2;

    const toXY = (p) => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const pathD = 'M ' + points.map(toXY).join(' L ');
    const start = toXY(points[0]).split(',');
    const end = toXY(points[points.length - 1]).split(',');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
           style="border-radius:10px; background:#0f0f0f; display:block; width:100%; max-width:${width}px;"
           xmlns="http://www.w3.org/2000/svg">
        <path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <circle cx="${start[0]}" cy="${start[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${end[0]}"   cy="${end[1]}"   r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
        <text x="${pad}" y="${height - 4}" font-size="9" fill="#555" font-family="monospace">● inicio  ● fin</text>
      </svg>
    `;
  },

  // ==================== MÉTODO PRINCIPAL: INICIAR SESIÓN ====================

  /**
   * Punto de entrada principal. Cierra el modal de la sesión y muestra la pantalla de adquisición de GPS.
   * @param {Object} sesion - Objeto sesión del plan
   * @param {number} diaIndex - Índice del día en el plan
   */
  async iniciar(sesion, diaIndex) {
    if (this.isRunning) {
      Utils.showToast('⚠️ Ya hay una sesión en curso', 'warning');
      return;
    }
    if (!navigator.geolocation) {
      Utils.showToast('❌ GPS no disponible en este dispositivo', 'error');
      return;
    }

    // Solicitar permisos explícitamente antes de continuar
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
    } catch (err) {
      if (err.code === 1) {
        Utils.showToast('❌ Permiso de GPS denegado. Habilítalo en ajustes.', 'error', 5000);
        return;
      }
      // Si es timeout o falta de señal, continuamos de todas formas (seguirá buscando)
    }

    // Resetear estado
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

    // Extraer duraciones de la sesión
    this._extraerDuraciones();

    // Cerrar el modal de detalle de sesión
    const modal = document.getElementById('detalleSesion');
    const overlayModal = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('visible');
    if (overlayModal) overlayModal.classList.remove('visible');

    // Crear pantalla de preparación GPS
    this._crearPantallaPreparacion();

    // Iniciar watch para preparación
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onGPSError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    // Asignar eventos a los botones (con un pequeño retraso para asegurar que existan en el DOM)
    setTimeout(() => {
      const startBtn = document.getElementById('gpsStartBtn');
      const cancelBtn = document.getElementById('gpsCancelBtn');
      if (startBtn) {
        startBtn.onclick = (e) => {
          e.preventDefault();
          if (this.gpsReady) {
            this.comenzarEntreno();
          } else {
            Utils.showToast('Esperando mejor señal GPS...', 'warning');
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
  }
};

// Exportar para uso global
window.GPSTracker = GPSTracker;
console.log('✅ GPSTracker v2.6 (Extendida) - Botón COMENZAR funcional, cancelar operativo');