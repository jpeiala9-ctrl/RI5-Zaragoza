// ==================== gps-track-viewer.js ====================
// Versión: 1.3 - Mapa claro, visor funcional, robusto, sin errores "no disponible"
// ====================

const GPSTrackViewer = {
  map: null,
  leafletLoaded: false,

  async open(entry) {
    if (!entry || !entry.hasGPS || !entry.trackPoints || entry.trackPoints.length < 2) {
      Utils.showToast('Sin datos GPS disponibles', 'info');
      return;
    }
    this._crearSheet(entry);
    await this._loadLeaflet();
    await this._initMap(entry);
    this._getCity(entry.trackPoints[0].lat, entry.trackPoints[0].lng)
      .then(ciudad => {
        const el = document.getElementById('gpsViewerCity');
        if (el) el.textContent = `${ciudad}`;
      });
  },

  _crearSheet(entry) {
    document.getElementById('gpsViewerOverlay')?.remove();
    document.getElementById('gpsViewerSheet')?.remove();
    if (this.map) { try { this.map.remove(); } catch(e) {} this.map = null; }

    const overlay = document.createElement('div');
    overlay.id = 'gpsViewerOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:60000;backdrop-filter:blur(3px);';
    overlay.addEventListener('click', () => this.close());

    const sheet = document.createElement('div');
    sheet.id = 'gpsViewerSheet';
    sheet.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'height:88vh',
      'background:#111',
      'border-radius:22px 22px 0 0',
      'z-index:60001',
      'display:flex', 'flex-direction:column',
      'transform:translateY(100%)',
      'transition:transform 0.38s cubic-bezier(0.32,0.72,0,1)',
      'overflow:hidden',
      'font-family:"Courier New",monospace'
    ].join(';');

    const distKm   = entry.gpsDistanceKm != null ? Number(entry.gpsDistanceKm).toFixed(2) : (Number(entry.distancia)||0).toFixed(2);
    const tiempo   = entry.gpsDurationMs  ? this._fmtTime(entry.gpsDurationMs)  : '--:--';
    const ritmo    = (entry.gpsDurationMs && entry.gpsDistanceKm)
      ? this._fmtPace(entry.gpsDistanceKm * 1000, entry.gpsDurationMs) : '--:--';
    const tss      = entry.tss || 0;

    let fecha = '';
    try {
      if (entry.timestamp) {
        const d = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
        fecha = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
      }
    } catch(e) {}

    const EMOJI = { rodaje:'🏃‍♂️', tempo:'⚡', series:'🔁', largo:'📏', strength:'💪' };
    const tipoEmoji = EMOJI[entry.trainingType] || '🏃';
    const nombre    = (entry.trainingName || entry.trainingType || 'SESION').toUpperCase();

    sheet.innerHTML = `
      <div style="flex-shrink:0;padding:10px 16px 4px;display:flex;justify-content:center;cursor:grab;">
        <div style="width:44px;height:4px;background:#333;border-radius:2px;"></div>
      </div>
      <div style="flex-shrink:0;padding:8px 16px 12px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #1e1e1e;">
        <div>
          <div style="font-size:15px;font-weight:bold;color:#fff;letter-spacing:1px;">
            ${tipoEmoji} ${Utils.escapeHTML(nombre)}
          </div>
          <div id="gpsViewerCity" style="font-size:12px;color:#c0a060;margin-top:4px;letter-spacing:1px;">
            Cargando ubicacion...
          </div>
          <div style="font-size:11px;color:#444;margin-top:3px;text-transform:capitalize;">${fecha}</div>
        </div>
        <button id="gpsViewerClose" style="
          width:34px;height:34px;border-radius:50%;
          background:transparent;border:1px solid #333;
          color:#888;font-size:20px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;margin-left:12px;line-height:1;
        ">&times;</button>
      </div>
      <div style="flex-shrink:0;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;background:#0d0d0d;border-bottom:1px solid #1e1e1e;">
        <div style="text-align:center;padding:12px 4px;border-right:1px solid #1e1e1e;">
          <div style="font-size:20px;font-weight:bold;color:#c0a060;font-variant-numeric:tabular-nums;">${distKm}</div>
          <div style="font-size:9px;color:#444;letter-spacing:1px;margin-top:3px;">KM</div>
        </div>
        <div style="text-align:center;padding:12px 4px;border-right:1px solid #1e1e1e;">
          <div style="font-size:20px;font-weight:bold;color:#9BB5A0;font-variant-numeric:tabular-nums;">${tiempo}</div>
          <div style="font-size:9px;color:#444;letter-spacing:1px;margin-top:3px;">TIEMPO</div>
        </div>
        <div style="text-align:center;padding:12px 4px;border-right:1px solid #1e1e1e;">
          <div style="font-size:20px;font-weight:bold;color:#aaa;font-variant-numeric:tabular-nums;">${ritmo}</div>
          <div style="font-size:9px;color:#444;letter-spacing:1px;margin-top:3px;">MIN/KM</div>
        </div>
        <div style="text-align:center;padding:12px 4px;">
          <div style="font-size:20px;font-weight:bold;color:#888;">${tss}</div>
          <div style="font-size:9px;color:#444;letter-spacing:1px;margin-top:3px;">TSS</div>
        </div>
      </div>
      <div id="gpsViewerMap" style="flex:1;min-height:0;"></div>
      <div style="flex-shrink:0;padding:8px 16px;display:flex;align-items:center;gap:16px;background:#0d0d0d;border-top:1px solid #1e1e1e;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#555;">
          <div style="width:10px;height:10px;border-radius:50%;background:#2ecc71;border:1.5px solid #fff;"></div> Inicio
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#555;">
          <div style="width:10px;height:10px;border-radius:50%;background:#c0392b;border:1.5px solid #fff;"></div> Fin
        </div>
        <div style="margin-left:auto;font-size:10px;color:#333;letter-spacing:1px;">GPS</div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);

    document.getElementById('gpsViewerClose')?.addEventListener('click', () => this.close());
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.style.transform = 'translateY(0)';
    }));
  },

  async _initMap(entry) {
    if (!window.L) return;
    const points = entry.trackPoints;
    if (!points || points.length < 2) return;

    try {
      const map = window.L.map('gpsViewerMap', {
        zoomControl: true,
        attributionControl: false,
        tap: false
      });

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> & CartoDB'
      }).addTo(map);

      const latlngs = points.map(p => [p.lat, p.lng]);
      const poly    = window.L.polyline(latlngs, {
        color: '#1e88e5',
        weight: 5,
        opacity: 0.92,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);

      window.L.marker(latlngs[0], { icon: window.L.divIcon({
        html: '<div style="width:12px;height:12px;background:#2ecc71;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(46,204,113,.6);"></div>',
        className: '', iconAnchor: [6, 6]
      })}).addTo(map);

      window.L.marker(latlngs[latlngs.length - 1], { icon: window.L.divIcon({
        html: '<div style="width:12px;height:12px;background:#c0392b;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(192,57,43,.6);"></div>',
        className: '', iconAnchor: [6, 6]
      })}).addTo(map);

      map.fitBounds(poly.getBounds(), { padding: [24, 24] });
      this.map = map;
    } catch(e) {
      console.warn('GPSTrackViewer map error:', e);
    }
  },

  async _getCity(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'RI5RunningApp/1.0' }
      });
      const data = await res.json();
      const a = data.address || {};
      return a.city || a.town || a.village || a.municipality || a.county || a.state || '—';
    } catch(e) {
      return '—';
    }
  },

  _loadLeaflet() {
    return new Promise(resolve => {
      if (window.L) { this.leafletLoaded = true; resolve(); return; }
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload  = () => { this.leafletLoaded = true; resolve(); };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  },

  _fmtTime(ms) {
    const s  = Math.floor(Math.max(0, ms) / 1000);
    const h  = Math.floor(s / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  },

  _fmtPace(distM, ms) {
    if (distM < 10 || ms < 1000) return '--:--';
    const paceS = (ms / 1000) / (distM / 1000);
    return `${Math.floor(paceS/60)}:${String(Math.floor(paceS%60)).padStart(2,'0')}`;
  },

  close() {
    const sheet   = document.getElementById('gpsViewerSheet');
    const overlay = document.getElementById('gpsViewerOverlay');
    if (sheet) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => { sheet.remove(); overlay?.remove(); }, 380);
    } else {
      overlay?.remove();
    }
    if (this.map) {
      try { this.map.remove(); } catch(e) {}
      this.map = null;
    }
  }
};

window.GPSTrackViewer = GPSTrackViewer;
console.log('GPSTrackViewer v1.3 - visor funcional');