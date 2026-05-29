// ==================== gps-tracker.js - Grabación de rutas con Leaflet/OSM (corregido) ====================
// Versión: 1.1 - Mejor manejo de errores y logs
// ====================

const GPSTracker = {
  isTracking: false,
  watchId: null,
  routePoints: [],
  startTime: null,
  currentMap: null,
  currentPolyline: null,
  currentMarker: null,
  mapContainerId: null,
  onPointAdded: null,
  onTrackingEnd: null,

  leafletLoaded: false,
  leafletLoadingPromise: null,

  loadLeaflet() {
    if (this.leafletLoadingPromise) return this.leafletLoadingPromise;
    
    this.leafletLoadingPromise = new Promise((resolve, reject) => {
      if (window.L && this.leafletLoaded) {
        console.log('✅ Leaflet ya cargado');
        resolve(window.L);
        return;
      }
      
      console.log('📦 Cargando Leaflet...');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => {
        this.leafletLoaded = true;
        console.log('✅ Leaflet cargado correctamente');
        resolve(window.L);
      };
      script.onerror = (err) => {
        console.error('❌ Error cargando Leaflet:', err);
        reject(new Error('No se pudo cargar Leaflet'));
      };
      document.head.appendChild(script);
    });
    
    return this.leafletLoadingPromise;
  },

  async showTrackingWarning() {
    return new Promise((resolve) => {
      let overlay = document.getElementById('gpsWarningOverlay');
      let modal = document.getElementById('gpsWarningModal');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gpsWarningOverlay';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); z-index: 50000; display: flex; align-items: center; justify-content: center;`;
        document.body.appendChild(overlay);
        modal = document.createElement('div');
        modal.id = 'gpsWarningModal';
        modal.style.cssText = `background: var(--bg-card); border-radius: 24px; max-width: 400px; width: 90%; padding: 24px; text-align: center; border: 1px solid var(--gold-border); box-shadow: var(--shadow-xl);`;
        modal.innerHTML = `
          <h3 style="color: var(--gold); margin-bottom: 16px;">📍 Iniciar Grabación GPS</h3>
          <p style="margin-bottom: 20px; color: var(--text-secondary);">Para grabar tu ruta correctamente, mantén la aplicación abierta y no bloquees la pantalla.<br><strong>Si cierras la app o bloqueas el móvil, la grabación se detendrá.</strong></p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="gpsWarningConfirm" class="action-button" style="background: var(--gold); color: #000; width: auto;">Entendido, empezar</button>
            <button id="gpsWarningCancel" class="action-button" style="width: auto;">Cancelar</button>
          </div>
        `;
        overlay.appendChild(modal);
      }
      overlay.style.display = 'flex';
      const confirmBtn = document.getElementById('gpsWarningConfirm');
      const cancelBtn = document.getElementById('gpsWarningCancel');
      const cleanup = () => {
        overlay.style.display = 'none';
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
      };
      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  },

  async initMap(containerId, center = null) {
    console.log('🗺️ Inicializando mapa en', containerId);
    await this.loadLeaflet();
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('❌ Contenedor del mapa no encontrado:', containerId);
      return null;
    }
    if (this.currentMap && this.currentMap.getContainer().id === containerId) {
      this.currentMap.remove();
    }
    const map = L.map(containerId).setView(center || [40.416775, -3.703790], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    this.currentMap = map;
    console.log('✅ Mapa inicializado');
    return map;
  },

  updateMap(position) {
    if (!this.currentMap) return;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const latlng = L.latLng(lat, lng);
    this.currentMap.setView(latlng, 15);
    if (this.currentMarker) {
      this.currentMarker.setLatLng(latlng);
    } else {
      this.currentMarker = L.circleMarker(latlng, { radius: 6, color: '#4285F4', fillColor: '#4285F4', fillOpacity: 1, weight: 2 }).addTo(this.currentMap);
    }
    const point = { lat, lng, timestamp: position.timestamp };
    this.routePoints.push(point);
    const latlngs = this.routePoints.map(p => [p.lat, p.lng]);
    if (this.currentPolyline) {
      this.currentPolyline.setLatLngs(latlngs);
    } else if (latlngs.length > 1) {
      this.currentPolyline = L.polyline(latlngs, { color: '#C9A96E', weight: 4, opacity: 0.8 }).addTo(this.currentMap);
    }
    if (this.onPointAdded) this.onPointAdded(point, this.routePoints.length - 1);
  },

  async startTracking(mapContainerId) {
    console.log('🎯 startTracking llamado con contenedor:', mapContainerId);
    if (this.isTracking) {
      Utils.showToast('Ya hay una grabación en curso', 'warning');
      return false;
    }
    if (!navigator.geolocation) {
      Utils.showToast('GPS no soportado en este dispositivo', 'error');
      return false;
    }
    
    const userConfirmed = await this.showTrackingWarning();
    if (!userConfirmed) {
      console.log('❌ Usuario canceló la grabación');
      return false;
    }
    
    Utils.showLoading();
    try {
      this.mapContainerId = mapContainerId;
      await this.initMap(mapContainerId);
      if (!this.currentMap) throw new Error('No se pudo inicializar el mapa');
      
      this.routePoints = [];
      this.startTime = Date.now();
      this.isTracking = true;
      
      const initPos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      console.log('📍 Posición inicial obtenida:', initPos.coords.latitude, initPos.coords.longitude);
      const center = [initPos.coords.latitude, initPos.coords.longitude];
      this.currentMap.setView(center, 15);
      
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.updateMap(position),
        (error) => {
          console.error('❌ Error de GPS:', error);
          Utils.showToast('Error al obtener ubicación. Comprueba los permisos.', 'warning');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
      
      Utils.hideLoading();
      Utils.showToast('Grabación iniciada. Mantén la app abierta.', 'success');
      if (this.onTrackingStart) this.onTrackingStart();
      console.log('✅ Grabación GPS iniciada');
      return true;
      
    } catch (error) {
      Utils.hideLoading();
      console.error('❌ Error al iniciar grabación:', error);
      Utils.showToast('No se pudo iniciar la grabación. Comprueba los permisos de ubicación.', 'error');
      return false;
    }
  },

  async stopTracking() {
    if (!this.isTracking) return null;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    const endTime = Date.now();
    const durationSeconds = (endTime - this.startTime) / 1000;
    const routeData = this.calculateRouteStats(this.routePoints, durationSeconds);
    if (this.onTrackingEnd) this.onTrackingEnd(routeData);
    Utils.showToast('Grabación finalizada', 'success');
    console.log('✅ Grabación finalizada, datos:', routeData);
    return routeData;
  },

  calculateRouteStats(points, durationSeconds) {
    if (!points || points.length < 2) {
      return { points: [], distanceMeters: 0, durationSeconds: durationSeconds, avgSpeedKmh: 0, startTime: this.startTime, endTime: Date.now() };
    }
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.haversineDistance(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
    }
    const avgSpeedKmh = (totalDistance / 1000) / (durationSeconds / 3600);
    return {
      points: points,
      distanceMeters: Math.round(totalDistance),
      durationSeconds: Math.round(durationSeconds),
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      startTime: this.startTime,
      endTime: Date.now()
    };
  },

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  async displayRoute(containerId, points, options = {}) {
    console.log('🗺️ Mostrando ruta en', containerId, 'puntos:', points.length);
    if (!points || points.length < 2) {
      console.warn('No hay suficientes puntos para mostrar la ruta');
      return null;
    }
    try {
      await this.loadLeaflet();
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('Contenedor no encontrado:', containerId);
        return null;
      }
      const latlngs = points.map(p => [p.lat, p.lng]);
      const map = L.map(containerId).setView(latlngs[0], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      const polyline = L.polyline(latlngs, { color: options.color || '#C9A96E', weight: 4, opacity: 0.8 }).addTo(map);
      map.fitBounds(polyline.getBounds());
      if (options.showMarkers !== false) {
        L.circleMarker(latlngs[0], { radius: 6, color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 1, weight: 2 }).addTo(map);
        L.circleMarker(latlngs[latlngs.length-1], { radius: 6, color: '#F44336', fillColor: '#F44336', fillOpacity: 1, weight: 2 }).addTo(map);
      }
      console.log('✅ Ruta mostrada correctamente');
      return map;
    } catch (err) {
      console.error('Error mostrando ruta:', err);
      return null;
    }
  },

  cancelTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.routePoints = [];
    this.startTime = null;
    if (this.currentMap) {
      if (this.currentPolyline) this.currentMap.removeLayer(this.currentPolyline);
      if (this.currentMarker) this.currentMap.removeLayer(this.currentMarker);
    }
    Utils.showToast('Grabación cancelada', 'info');
  }
};

window.GPSTracker = GPSTracker;