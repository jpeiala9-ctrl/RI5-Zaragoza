// ==================== tracker.js - Grabación de sesiones GPS con voz, pausa y saltos ====================
// Versión: 1.0
// ====================

const SessionTracker = {
  // Estado
  isRecording: false,
  isPaused: false,
  watchId: null,
  trackPoints: [],
  sessionData: null,
  currentStepIndex: 0,
  stepTimer: null,
  stepRemaining: 0,
  wakeLock: null,
  map: null,
  polyline: null,
  marker: null,
  speechEnabled: true,

  // Elementos UI (se crean dinámicamente)
  containerId: 'sesionTrackerContainer',
  mapContainerId: 'trackMap',
  instructionsContainerId: 'trackInstructions',
  timerDisplayId: 'trackTimer',
  stepNameId: 'trackStepName',

  // Inicializar UI dentro del modal de detalle de sesión
  initUI() {
    const modal = document.getElementById('detalleSesion');
    if (!modal) return;

    let trackerDiv = document.getElementById(this.containerId);
    if (!trackerDiv) {
      trackerDiv = document.createElement('div');
      trackerDiv.id = this.containerId;
      trackerDiv.style.cssText = 'margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;';
      trackerDiv.innerHTML = `
        <div id="trackMap" style="height: 250px; width: 100%; border-radius: 12px; margin-bottom: 12px; display: none;"></div>
        <div id="trackInstructions" style="background: var(--bg-secondary); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
          <div style="font-size: 14px; font-weight: bold;" id="trackStepName">Preparado</div>
          <div style="font-size: 32px; font-family: monospace;" id="trackTimer">00:00</div>
          <div style="font-size: 12px; color: var(--text-secondary);" id="trackStepDesc"></div>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <button id="pauseTrackingBtn" class="action-button" style="display: none; flex:1; background: var(--zone-4);">⏸️ Pausar</button>
          <button id="resumeTrackingBtn" class="action-button" style="display: none; flex:1; background: var(--zone-3);">▶️ Reanudar</button>
          <button id="nextStepBtn" class="action-button" style="display: none; flex:1; background: var(--zone-2);">⏩ Siguiente paso</button>
        </div>
        <button id="startTrackingBtn" class="action-button" style="background: var(--accent-green); color: var(--bg-primary);">▶ COMENZAR</button>
        <button id="stopTrackingBtn" class="action-button" style="display: none; background: var(--zone-5);">⏹️ FINALIZAR</button>
        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 12px;">
          <label style="font-size: 12px;"><input type="checkbox" id="speechToggle" checked> 🔊 Voz</label>
        </div>
      `;
      const closeBtn = modal.querySelector('.close-btn');
      if (closeBtn) modal.insertBefore(trackerDiv, closeBtn);
    }

    // Eventos
    document.getElementById('startTrackingBtn')?.addEventListener('click', () => this.start());
    document.getElementById('stopTrackingBtn')?.addEventListener('click', () => this.finish());
    document.getElementById('pauseTrackingBtn')?.addEventListener('click', () => this.pause());
    document.getElementById('resumeTrackingBtn')?.addEventListener('click', () => this.resume());
    document.getElementById('nextStepBtn')?.addEventListener('click', () => this.nextStep());
    document.getElementById('speechToggle')?.addEventListener('change', (e) => this.speechEnabled = e.target.checked);
  },

  // Cargar los pasos de la sesión (estructura de pasosDetallados)
  loadSteps(sesionDetalle, duracionTotal) {
    if (!sesionDetalle) return [];
    if (sesionDetalle.pasosDetallados && sesionDetalle.pasosDetallados.length > 0) {
      return sesionDetalle.pasosDetallados.map(paso => {
        let duracion = 0;
        const match = paso.accion.match(/(\d+)[']/);
        if (match) duracion = parseInt(match[1]);
        return {
          nombre: paso.titulo,
          duracion: duracion,
          accion: paso.accion,
          porque: paso.porque,
          zona: paso.zona || (paso.titulo.includes('CALENTAMIENTO') ? 'Z1' : (paso.titulo.includes('ENFRIAMIENTO') ? 'Z1' : 'Z3'))
        };
      }).filter(p => p.duracion > 0);
    }
    // Si no hay pasos detallados, crear estructura básica
    const cal = sesionDetalle.calentamiento || 10;
    const pp = sesionDetalle.partePrincipal || (duracionTotal - cal - (sesionDetalle.enfriamiento || 5));
    const enf = sesionDetalle.enfriamiento || 5;
    return [
      { nombre: 'CALENTAMIENTO', duracion: cal, accion: 'Trote suave Z1 + movilidad', zona: 'Z1' },
      { nombre: 'PARTE PRINCIPAL', duracion: pp, accion: sesionDetalle.estructura || 'Entrenamiento específico', zona: sesionDetalle.zona || 'Z2' },
      { nombre: 'ENFRIAMIENTO', duracion: enf, accion: 'Trote suave + estiramientos', zona: 'Z1' }
    ];
  },

  async start() {
    if (this.isRecording) return;
    const detalle = AppState.currentSesionDetalle;
    if (!detalle || !detalle.sesion) {
      Utils.showToast('No hay sesión activa', 'error');
      return;
    }
    this.sessionData = {
      sesion: detalle.sesion,
      diaIndex: detalle.diaIndex,
      planId: detalle.planId,
      tipo: detalle.sesion.tipo,
      duracionTotal: detalle.sesion.duracion || 45,
      pasos: this.loadSteps(detalle.sesion.detalle, detalle.sesion.duracion)
    };

    if (!navigator.geolocation) {
      Utils.showToast('Geolocalización no soportada', 'error');
      return;
    }

    // Wake Lock
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) { console.warn('Wake Lock no disponible', err); }
    }

    // Iniciar grabación GPS
    this.trackPoints = [];
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        this.trackPoints.push(point);
        this.updateMap(point);
      },
      (err) => console.error('Error GPS:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    this.initMap();
    document.getElementById('trackMap').style.display = 'block';

    // UI
    document.getElementById('startTrackingBtn').style.display = 'none';
    document.getElementById('stopTrackingBtn').style.display = 'block';
    document.getElementById('pauseTrackingBtn').style.display = 'block';
    document.getElementById('nextStepBtn').style.display = 'block';
    document.getElementById('resumeTrackingBtn').style.display = 'none';

    this.currentStepIndex = 0;
    this.isRecording = true;
    this.isPaused = false;
    this.startStep();
    Utils.showToast('Grabando sesión...', 'info');
  },

  pause() {
    if (!this.isRecording || this.isPaused) return;
    this.isPaused = true;
    if (this.stepTimer) clearInterval(this.stepTimer);
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    document.getElementById('pauseTrackingBtn').style.display = 'none';
    document.getElementById('resumeTrackingBtn').style.display = 'block';
    Utils.showToast('Grabación pausada', 'info');
  },

  resume() {
    if (!this.isRecording || !this.isPaused) return;
    this.isPaused = false;
    // Reiniciar GPS
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        this.trackPoints.push(point);
        this.updateMap(point);
      },
      (err) => console.error('Error GPS:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    // Reiniciar temporizador del paso actual
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.stepTimer = setInterval(() => {
      if (this.isPaused) return;
      if (this.stepRemaining <= 0) {
        clearInterval(this.stepTimer);
        this.currentStepIndex++;
        this.startStep();
      } else {
        this.stepRemaining--;
        this.updateStepUI(this.sessionData.pasos[this.currentStepIndex], this.stepRemaining);
      }
    }, 1000);
    document.getElementById('pauseTrackingBtn').style.display = 'block';
    document.getElementById('resumeTrackingBtn').style.display = 'none';
    Utils.showToast('Grabación reanudada', 'info');
  },

  nextStep() {
    if (!this.isRecording || this.isPaused) return;
    // Saltar al siguiente paso
    if (this.stepTimer) clearInterval(this.stepTimer);
    this.currentStepIndex++;
    if (this.currentStepIndex >= this.sessionData.pasos.length) {
      this.finish();
    } else {
      this.startStep();
    }
  },

  startStep() {
    if (this.currentStepIndex >= this.sessionData.pasos.length) {
      this.finish();
      return;
    }
    const step = this.sessionData.pasos[this.currentStepIndex];
    this.stepRemaining = step.duracion * 60;
    this.updateStepUI(step, this.stepRemaining);

    // Anunciar por voz
    if (this.speechEnabled && 'speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(`${step.nombre}: ${step.duracion} minutos. ${step.accion}`);
      msg.lang = 'es-ES';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(msg);
    }

    if (this.stepTimer) clearInterval(this.stepTimer);
    this.stepTimer = setInterval(() => {
      if (this.isPaused) return;
      if (this.stepRemaining <= 0) {
        clearInterval(this.stepTimer);
        this.currentStepIndex++;
        this.startStep();
      } else {
        this.stepRemaining--;
        this.updateStepUI(step, this.stepRemaining);
      }
    }, 1000);
  },

  updateStepUI(step, remainingSeconds) {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timerStr = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    const timerEl = document.getElementById(this.timerDisplayId);
    if (timerEl) timerEl.innerText = timerStr;
    const stepNameEl = document.getElementById(this.stepNameId);
    if (stepNameEl) stepNameEl.innerHTML = `${step.nombre} · ${step.zona || ''}`;
    const stepDescEl = document.getElementById('trackStepDesc');
    if (stepDescEl) stepDescEl.innerText = step.accion.substring(0, 100);
    if (remainingSeconds === 0) Utils.vibrate(200);
  },

  initMap() {
    if (this.map) this.map.remove();
    const mapDiv = document.getElementById(this.mapContainerId);
    if (!mapDiv) return;
    this.map = L.map(mapDiv).setView([40.4168, -3.7038], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB'
    }).addTo(this.map);
    this.polyline = L.polyline([], { color: '#c0a060', weight: 4 }).addTo(this.map);
    this.marker = L.marker([0,0], { icon: L.divIcon({ className: 'current-marker', html: '🏃', iconSize: [20,20] }) }).addTo(this.map);
  },

  updateMap(point) {
    if (!this.map) return;
    const latlng = [point.lat, point.lng];
    this.marker.setLatLng(latlng);
    const points = this.polyline.getLatLngs();
    points.push(latlng);
    this.polyline.setLatLngs(points);
    this.map.setView(latlng, 15);
  },

  async finish() {
    if (!this.isRecording) return;
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    if (this.stepTimer) clearInterval(this.stepTimer);
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
    this.isRecording = false;
    this.isPaused = false;

    if (this.trackPoints.length > 0) {
      await this.saveTrack();
      // Marcar sesión como realizada automáticamente
      if (window.PlanGenerator && this.sessionData.planId && this.sessionData.diaIndex) {
        await PlanGenerator.marcarSesionRealizada(this.sessionData.diaIndex, true);
      }
      Utils.showToast('Ruta guardada y sesión completada', 'success');
    } else {
      Utils.showToast('No se grabó ninguna posición', 'warning');
    }

    // Limpiar UI
    document.getElementById('startTrackingBtn').style.display = 'block';
    document.getElementById('stopTrackingBtn').style.display = 'none';
    document.getElementById('pauseTrackingBtn').style.display = 'none';
    document.getElementById('resumeTrackingBtn').style.display = 'none';
    document.getElementById('nextStepBtn').style.display = 'none';
    document.getElementById('trackMap').style.display = 'none';
    if (this.map) this.map.remove();
    this.map = null;
  },

  async saveTrack() {
    const uid = AppState.currentUserId;
    const sessionId = `${this.sessionData.planId}_${this.sessionData.diaIndex}`;
    const trackData = {
      points: this.trackPoints,
      startTime: this.trackPoints[0]?.timestamp,
      endTime: this.trackPoints[this.trackPoints.length-1]?.timestamp,
      distance: this.calculateDistance(),
      duration: (this.trackPoints[this.trackPoints.length-1]?.timestamp - this.trackPoints[0]?.timestamp) / 1000,
      sessionId,
      planId: this.sessionData.planId,
      diaIndex: this.sessionData.diaIndex,
      userId: uid,
      timestamp: firebaseServices.Timestamp.now()
    };
    const docRef = await firebaseServices.db.collection('users').doc(uid).collection('tracks').add(trackData);
    // Actualizar entrada del muro con trackId
    const wallEntryId = await this.getWallEntryId();
    if (wallEntryId) {
      await firebaseServices.db.collection('globalFeed').doc(wallEntryId).update({
        trackId: docRef.id,
        hasTrack: true,
        trackDistance: trackData.distance,
        trackDuration: trackData.duration
      });
    }
  },

  calculateDistance() {
    let dist = 0;
    for (let i = 1; i < this.trackPoints.length; i++) {
      const p1 = this.trackPoints[i-1];
      const p2 = this.trackPoints[i];
      dist += this.haversine(p1.lat, p1.lng, p2.lat, p2.lng);
    }
    return dist;
  },

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  async getWallEntryId() {
    const planRef = firebaseServices.db.collection('users').doc(AppState.currentUserId)
                    .collection('planes').doc(this.sessionData.planId);
    const doc = await planRef.get();
    return doc.data()?.wallEntryId?.[this.sessionData.diaIndex];
  }
};

window.SessionTracker = SessionTracker;