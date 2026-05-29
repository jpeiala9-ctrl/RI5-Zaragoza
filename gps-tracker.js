// ==================== gps-tracker.js - Grabación de rutas con Leaflet/OSM ====================
// Versión: 1.0 - GPS con OpenStreetMap, aviso al usuario y guardado en Firestore
// ====================

const GPSTracker = {
  // Estado de grabación
  isTracking: false,
  watchId: null,
  routePoints: [],      // almacena objetos {lat, lng, timestamp}
  startTime: null,
  currentMap: null,
  currentPolyline: null,
  currentMarker: null,
  mapContainerId: null,
  
  // Callbacks
  onPointAdded: null,
  onTrackingEnd: null,
  onTrackingStart: null,

  // Configuración de Leaflet (OpenStreetMap)
  leafletLoaded: false,

  // Carga dinámicamente Leaflet CSS y JS
  loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L && this.leafletLoaded) {
        resolve(window.L);
        return;
      }
      // CSS de Leaflet
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      
      // JS de Leaflet
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => {
        this.leafletLoaded = true;
        resolve(window.L);
      };
      script.onerror = () => reject(new Error('Error al cargar Leaflet'));
      document.head.appendChild(script);
    });
  },

  // Muestra un aviso al usuario antes de empezar (modal personalizado)
  async showTrackingWarning() {
    return new Promise((resolve) => {
      // Crear overlay y modal si no existen
      let overlay = document.getElementById('gpsWarningOverlay');
      let modal = document.getElementById('gpsWarningModal');
      
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gpsWarningOverlay';
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
          z-index: 50000; display: flex; align-items: center; justify-content: center;
        `;
        document.body.appendChild(overlay);
        
        modal = document.createElement('div');
        modal.id = 'gpsWarningModal';
        modal.style.cssText = `
          background: var(--bg-card); border-radius: 24px; max-width: 400px;
          width: 90%; padding: 24px; text-align: center;
          border: 1px solid var(--gold-border); box-shadow: var(--shadow-xl);
        `;
        modal.innerHTML = `
          <h3 style="color: var(--gold); margin-bottom: 16px;">📍 Iniciar Grabación GPS</h3>
          <p style="margin-bottom: 20px; color: var(--text-secondary);">
            Para grabar tu ruta correctamente, mantén la aplicación abierta y no bloquees la pantalla.<br>
            <strong>Si cierras la app o bloqueas el móvil, la grabación se detendrá.</strong>
          </p>
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
      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  },

  // Inicializa el mapa en un contenedor
  async initMap(containerId, center = null) {
    await this.loadLeaflet();
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    // Si ya existe un mapa en ese contenedor, lo destruimos
    if (this.currentMap && this.currentMap.getContainer().id === containerId) {
      this.currentMap.remove();
    }
    
    const map = L.map(containerId).setView(center || [40.416775, -3.703790], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19,
      minZoom: 3
    }).addTo(map);
    
    this.currentMap = map;
    return map;
  },

  // Actualiza el mapa con la posición actual y la ruta
  updateMap(position) {
    if (!this.currentMap) return;
    
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const latlng = L.latLng(lat, lng);
    
    // Centrar el mapa
    this.currentMap.setView(latlng, 15);
    
    // Actualizar o crear marcador de posición actual
    if (this.currentMarker) {
      this.currentMarker.setLatLng(latlng);
    } else {
      this.currentMarker = L.circleMarker(latlng, {
        radius: 6,
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 1,
        weight: 2
      }).addTo(this.currentMap);
    }
    
    // Añadir punto a la ruta
    const point = {
      lat: lat,
      lng: lng,
      timestamp: position.timestamp
    };
    this.routePoints.push(point);
    
    // Actualizar la polyline
    const latlngs = this.routePoints.map(p => [p.lat, p.lng]);
    if (this.currentPolyline) {
      this.currentPolyline.setLatLngs(latlngs);
    } else if (latlngs.length > 1) {
      this.currentPolyline = L.polyline(latlngs, {
        color: '#C9A96E',
        weight: 4,
        opacity: 0.8
      }).addTo(this.currentMap);
    }
    
    // Callback opcional
    if (this.onPointAdded) {
      this.onPointAdded(point, this.routePoints.length - 1);
    }
  },

  // Inicia la grabación con mapa y aviso
  async startTracking(mapContainerId) {
    if (this.isTracking) {
      Utils.showToast('Ya hay una grabación en curso', 'warning');
      return false;
    }
    
    if (!navigator.geolocation) {
      Utils.showToast('GPS no soportado en este dispositivo', 'error');
      return false;
    }
    
    // Mostrar aviso al usuario
    const userConfirmed = await this.showTrackingWarning();
    if (!userConfirmed) {
      return false;
    }
    
    Utils.showLoading();
    
    try {
      // Inicializar mapa
      this.mapContainerId = mapContainerId;
      await this.initMap(mapContainerId);
      if (!this.currentMap) throw new Error('No se pudo inicializar el mapa');
      
      // Resetear datos
      this.routePoints = [];
      this.startTime = Date.now();
      this.isTracking = true;
      
      // Obtener posición inicial
      const initPos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      
      const center = [initPos.coords.latitude, initPos.coords.longitude];
      this.currentMap.setView(center, 15);
      
      // Iniciar seguimiento continuo
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.updateMap(position),
        (error) => {
          console.error('Error de GPS:', error);
          Utils.showToast('Error al obtener ubicación. Comprueba los permisos.', 'warning');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
      
      Utils.hideLoading();
      Utils.showToast('Grabación iniciada. Mantén la app abierta.', 'success');
      if (this.onTrackingStart) this.onTrackingStart();
      return true;
      
    } catch (error) {
      Utils.hideLoading();
      console.error('Error al iniciar grabación:', error);
      Utils.showToast('No se pudo iniciar la grabación. Comprueba los permisos de ubicación.', 'error');
      return false;
    }
  },

  // Finaliza la grabación y devuelve los datos
  async stopTracking() {
    if (!this.isTracking) {
      return null;
    }
    
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    this.isTracking = false;
    const endTime = Date.now();
    const durationSeconds = (endTime - this.startTime) / 1000;
    
    const routeData = this.calculateRouteStats(this.routePoints, durationSeconds);
    
    if (this.onTrackingEnd) {
      this.onTrackingEnd(routeData);
    }
    
    Utils.showToast('Grabación finalizada', 'success');
    return routeData;
  },

  // Calcula estadísticas de la ruta (distancia, duración, velocidad media)
  calculateRouteStats(points, durationSeconds) {
    if (!points || points.length < 2) {
      return {
        points: [],
        distanceMeters: 0,
        durationSeconds: durationSeconds,
        avgSpeedKmh: 0,
        startTime: this.startTime,
        endTime: Date.now()
      };
    }
    
    // Calcular distancia total (fórmula de Haversine)
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.haversineDistance(
        points[i-1].lat, points[i-1].lng,
        points[i].lat, points[i].lng
      );
    }
    
    const avgSpeedKmh = (totalDistance / 1000) / (durationSeconds / 3600);
    
    return {
      points: points, // ya tienen lat, lng, timestamp
      distanceMeters: Math.round(totalDistance),
      durationSeconds: Math.round(durationSeconds),
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      startTime: this.startTime,
      endTime: Date.now()
    };
  },

  // Fórmula de Haversine (distancia en metros)
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  },

  // Muestra una ruta guardada en un mapa (para visualización posterior)
  async displayRoute(containerId, points, options = {}) {
    if (!points || points.length < 2) {
      if (options.onError) options.onError('Ruta sin puntos suficientes');
      return null;
    }
    
    await this.loadLeaflet();
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const latlngs = points.map(p => [p.lat, p.lng]);
    const map = L.map(containerId).setView(latlngs[0], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    
    const polyline = L.polyline(latlngs, {
      color: options.color || '#C9A96E',
      weight: 4,
      opacity: 0.8
    }).addTo(map);
    
    // Ajustar zoom
    map.fitBounds(polyline.getBounds());
    
    // Opcional: marcadores de inicio y fin
    if (options.showMarkers !== false) {
      L.circleMarker(latlngs[0], { radius: 6, color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 1, weight: 2 }).addTo(map);
      L.circleMarker(latlngs[latlngs.length-1], { radius: 6, color: '#F44336', fillColor: '#F44336', fillOpacity: 1, weight: 2 }).addTo(map);
    }
    
    return map;
  },

  // Cancela la grabación actual (sin guardar)
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