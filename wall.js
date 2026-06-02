// ==================== wall.js - Muro global con minimapa clickeable y modal ampliado ====================
// Versión: 4.3 - Mapa más grande, datos extra, botón cerrar funcional
// ====================

const Wall = {
  refreshInterval: null,
  currentEntries: [],
  container: null,
  isActive: false,
  loading: false,

  COLOR_ZONA: {
    z1: '#8AA0B0',
    z2: '#9BB5A0',
    z3: '#C9A78B',
    z4: '#C99BA5',
    z5: '#9AA5A5',
    z6: '#8A8A8A'
  },

  _colorZona(zona) {
    if (!zona) return null;
    const simple = zona.split('-')[0].trim().toLowerCase();
    return this.COLOR_ZONA[simple] || null;
  },

  init() {
    this.container = document.getElementById('wallContainer');
    if (!this.container) return;
    this.detenerListener();
    this.cargarMuro();
    this.iniciarActualizacionPeriodica();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && document.querySelector('#tab-muro').classList.contains('active')) {
        this.cargarMuro();
      }
    });
  },

  iniciarActualizacionPeriodica() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      if (document.querySelector('#tab-muro').classList.contains('active')) {
        this.cargarMuro();
      }
    }, 30000);
  },

  detenerListener() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  },

  async cargarMuro() {
    if (this.loading) return;
    this.loading = true;
    try {
      const snapshot = await firebaseServices.db
        .collection('globalFeed')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      this.currentEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.render(this.currentEntries);
    } catch (error) {
      console.error('Error cargando muro:', error);
      if (this.container) this.container.innerHTML =
        '<p style="text-align:center; padding:40px; color:var(--zone-5);">Error al cargar el muro. Intenta recargar la página.</p>';
    } finally {
      this.loading = false;
    }
  },

  _renderMiniMap(trackPoints) {
    if (!trackPoints || trackPoints.length < 2) return '';
    if (window.GPSTracker && typeof GPSTracker.renderTrackSVG === 'function') {
      return GPSTracker.renderTrackSVG(trackPoints, 320, 130);
    }
    return this._miniMapFallback(trackPoints);
  },

  _miniMapFallback(points) {
    const w = 320, h = 130, pad = 14;
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangeLng = maxLng - minLng || 0.0001;
    const rangeLat = maxLat - minLat || 0.0001;
    const W = w - pad * 2, H = h - pad * 2;
    const scale = Math.min(W / rangeLng, H / rangeLat);
    const offX = pad + (W - rangeLng * scale) / 2;
    const offY = pad + (H - rangeLat * scale) / 2;
    const toXY = p => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const pathD = 'M ' + points.map(toXY).join(' L ');
    const s = toXY(points[0]).split(',');
    const e = toXY(points[points.length - 1]).split(',');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"
      style="border-radius:10px;background:#0f0f0f;display:block;width:100%;"
      xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#c0a060" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <circle cx="${s[0]}" cy="${s[1]}" r="5" fill="#9BB5A0" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${e[0]}" cy="${e[1]}" r="5" fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  },

  render(entries) {
    if (!this.container) return;
    if (!entries || entries.length === 0) {
      this.container.innerHTML =
        '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes. ¡Sé el primero en compartir!</p>';
      return;
    }

    let html = '';
    for (const entry of entries) {
      try {
        let fecha = '—', hora = '';
        try {
          if (entry.timestamp) {
            let dateObj = entry.timestamp.toDate
              ? entry.timestamp.toDate()
              : new Date(entry.timestamp);
            fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            hora  = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } catch (_) {}

        const likeCount = Number(entry.likeCount) || 0;
        const userLiked = Array.isArray(entry.likes) && entry.likes.includes(AppState.currentUserId);
        const likeClass = userLiked ? 'liked' : '';

        const avatarHTML = entry.photoURL
          ? `<img src="${Utils.escapeHTML(entry.photoURL)}" class="wall-avatar" style="object-fit:cover;">`
          : `<div class="wall-avatar" style="background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        switch (entry.trainingType) {
          case 'rodaje':   tipoEmoji = '🏃‍♂️'; break;
          case 'tempo':    tipoEmoji = '⚡';    break;
          case 'series':   tipoEmoji = '🔁';    break;
          case 'largo':    tipoEmoji = '📏';    break;
          case 'strength': tipoEmoji = '💪';    break;
          default:         tipoEmoji = '🏃';
        }

        const usernameFormatted = Utils.capitalizeUsername(entry.username || 'Usuario');
        const duracion  = Number(entry.duration) || 0;
        const distancia = isFinite(Number(entry.distancia))
          ? Number(entry.distancia).toFixed(2)
          : '0.00';
        const tss       = Number(entry.tss) || 0;
        const zone      = entry.zone || '';
        const trainingName = entry.trainingName || '';

        const tipoMostrado = trainingName
          ? Utils.escapeHTML(trainingName).toUpperCase()
          : Utils.escapeHTML(String(entry.trainingType || 'ENTRENO')).toUpperCase();

        const colorZona = this._colorZona(zone);

        const gpsBadge = entry.hasGPS
          ? `<span style="
              font-size:10px; font-weight:600; letter-spacing:1px;
              color:#c0a060; background:rgba(192,160,96,0.12);
              border:1px solid rgba(192,160,96,0.3);
              border-radius:20px; padding:2px 8px; margin-left:6px;
            ">📍 GPS</span>`
          : '';
        const parcialBadge = (entry.tipoMarcado === 'parcial')
          ? `<span style="
              font-size:10px; font-weight:600; letter-spacing:1px;
              color:#e67e22; background:rgba(230,126,34,0.12);
              border:1px solid rgba(230,126,34,0.3);
              border-radius:20px; padding:2px 8px; margin-left:6px;
            ">🟠 Parcial</span>`
          : '';

        let miniMapHTML = '';
        if (entry.hasGPS && Array.isArray(entry.trackPoints) && entry.trackPoints.length >= 2) {
          const mapSVG = this._renderMiniMap(entry.trackPoints);
          if (mapSVG) {
            miniMapHTML = `
              <div class="track-minimap" data-points='${JSON.stringify(entry.trackPoints)}'
                   data-dist="${entry.gpsDistanceKm || entry.distancia}"
                   data-tiempo="${duracion}"
                   data-ritmo="${entry.ritmoMedio || '—'}"
                   data-zapatillas="${entry.zapatillas || 'No info'}"
                   data-ciudad="${entry.ciudad || 'Ubicación no disponible'}"
                   style="margin-top:10px; border-radius:10px; overflow:hidden; border:1px solid #2a2a2a; cursor:pointer;">
                ${mapSVG}
              </div>
            `;
          }
        }

        html += `
          <div class="wall-item" data-entry-id="${entry.id}">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                ${avatarHTML}
                <div>
                  <div class="wall-username">${Utils.escapeHTML(usernameFormatted)}</div>
                  <div class="wall-fecha">${fecha} · ${hora}</div>
                </div>
              </div>
              <button class="wall-like-btn ${likeClass}" data-entry-id="${entry.id}"
                style="background:transparent; border:none; padding:6px 12px; border-radius:20px;
                       cursor:pointer; display:inline-flex; align-items:center; gap:6px;
                       font-size:14px; color:var(--text-secondary); transition:all 0.2s ease;">
                ❤️ <span class="like-count">${likeCount}</span>
              </button>
            </div>

            <div style="border:1px solid var(--border-color); border-radius:12px; padding:14px;
                        text-align:center; background:var(--bg-primary); margin-top:4px;">
              <div style="font-size:14px; font-weight:500; margin-bottom:10px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px;">
                ${tipoEmoji} ${tipoMostrado}${gpsBadge}${parcialBadge}
              </div>
              <div style="display:flex; justify-content:space-around; align-items:center;
                          gap:8px; color:var(--text-secondary); font-size:13px; margin-bottom:6px;">
                <span>⏱️ ${duracion}'</span>
                <span>📏 ${distancia} km</span>
                <span>⚡ ${tss} TSS</span>
              </div>
              <div style="color:var(--text-secondary); font-size:12px;
                          display:flex; justify-content:center; align-items:center; gap:12px; margin-top:4px;">
                ${zone ? `<span style="color:${colorZona}; font-weight:500;">🔥 ${Utils.escapeHTML(zone)}</span>` : ''}
                ${hora ? `<span>🕒 ${hora}</span>` : ''}
              </div>
              ${miniMapHTML}
            </div>
          </div>
        `;
      } catch (err) {
        console.warn('Error renderizando entrada del muro:', err, entry);
      }
    }

    if (!html) {
      this.container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>';
      return;
    }

    this.container.innerHTML = html;

    // Eventos like
    this.container.querySelectorAll('.wall-like-btn').forEach(btn => {
      btn.removeEventListener('click', this._handleLikeClick);
      btn.addEventListener('click', this._handleLikeClick.bind(this));
    });

    // Eventos para abrir modal de likes en la tarjeta completa
    this.container.querySelectorAll('.wall-item').forEach(item => {
      item.removeEventListener('click', this._handleItemClick);
      item.addEventListener('click', this._handleItemClick.bind(this));
    });

    // Eventos para minimap click
    this.container.querySelectorAll('.track-minimap').forEach(el => {
      el.removeEventListener('click', this._handleMinimapClick);
      el.addEventListener('click', this._handleMinimapClick.bind(this));
    });
  },

  _handleLikeClick(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const entryId = btn.dataset.entryId;
    this.toggleLike(entryId, btn);
  },

  _handleItemClick(e) {
    if (e.target.closest('.wall-like-btn')) return;
    if (e.target.closest('.track-minimap')) return;
    const item = e.currentTarget;
    const entryId = item.dataset.entryId;
    this.showLikesModal(entryId);
  },

  _handleMinimapClick(e) {
    e.stopPropagation();
    const container = e.currentTarget;
    const points = JSON.parse(container.dataset.points);
    const distancia = container.dataset.dist;
    const tiempo = container.dataset.tiempo;
    const ritmo = container.dataset.ritmo;
    const zapatillas = container.dataset.zapatillas;
    const ciudad = container.dataset.ciudad;
    this.abrirModalMapa(points, distancia, {
      tiempo: tiempo,
      ritmo: ritmo,
      zapatillas: zapatillas,
      ciudad: ciudad
    });
  },

  async toggleLike(entryId, btnElement) {
    if (!AppState.currentUserId) {
      Utils.showToast('Inicia sesión para dar like', 'warning');
      return;
    }

    const likeSpan    = btnElement.querySelector('.like-count');
    const currentCount = parseInt(likeSpan.textContent, 10) || 0;
    const isLiked     = btnElement.classList.contains('liked');

    let newCount = isLiked ? currentCount - 1 : currentCount + 1;
    likeSpan.textContent = newCount;
    isLiked ? btnElement.classList.remove('liked') : btnElement.classList.add('liked');

    const entryRef = firebaseServices.db.collection('globalFeed').doc(entryId);
    try