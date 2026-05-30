// ==================== wall.js - Muro con borde izquierdo verde/naranja, CartoDB Voyager ====================
// Versión: 4.1
// ============================================================================

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
      if (this.container) this.container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--zone-5);">Error al cargar el muro. Intenta recargar la página.</p>';
    } finally {
      this.loading = false;
    }
  },

  render(entries) {
    if (!this.container) return;
    if (!entries || entries.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes. ¡Sé el primero en compartir!</p>';
      return;
    }

    let html = '';
    for (const entry of entries) {
      try {
        let fecha = '', hora = '';
        try {
          if (entry.timestamp) {
            let dateObj = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
            fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } catch (_) {}

        const likeCount = Number(entry.likeCount) || 0;
        const userLiked = Array.isArray(entry.likes) && entry.likes.includes(AppState.currentUserId);
        const likeClass = userLiked ? 'liked' : '';

        const avatarHTML = entry.photoURL
          ? `<img src="${Utils.escapeHTML(entry.photoURL)}" class="wall-avatar" style="object-fit:cover;">`
          : `<div class="wall-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        switch (entry.trainingType) {
          case 'rodaje': tipoEmoji = '🏃‍♂️'; break;
          case 'tempo': tipoEmoji = '⚡'; break;
          case 'series': tipoEmoji = '🔁'; break;
          case 'largo': tipoEmoji = '📏'; break;
          case 'strength': tipoEmoji = '💪'; break;
          default: tipoEmoji = '🏃';
        }

        const usernameFormatted = Utils.capitalizeUsername(entry.username || 'Usuario');
        const duracion  = Number(entry.duration) || 0;
        const distancia = isFinite(Number(entry.distancia)) ? Number(entry.distancia).toFixed(2) : '0.00';
        const tss       = Number(entry.tss) || 0;
        const zone = entry.zone || '';
        const trainingName = entry.trainingName || '';

        const tipoMostrado = trainingName
          ? Utils.escapeHTML(trainingName).toUpperCase()
          : Utils.escapeHTML(String(entry.trainingType || 'ENTRENO')).toUpperCase();

        const colorZona = this._colorZona(zone);
        
        let estadoClass = '';
        if (entry.forcedComplete === true) {
          estadoClass = 'realizado-forzado';
        } else if (entry.distancia && entry.distancia > 0 && entry.forcedComplete !== false) {
          estadoClass = 'realizado';
        }

        html += `
          <div class="wall-item ${estadoClass}" data-entry-id="${entry.id}" data-plan-id="${entry.planId || ''}" data-sesion-index="${entry.sesionIndex || ''}">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                ${avatarHTML}
                <div>
                  <div class="wall-username" data-uid="${entry.userId}" style="cursor:pointer;">${Utils.escapeHTML(usernameFormatted)}</div>
                  <div class="wall-fecha">${fecha} · ${hora}</div>
                </div>
              </div>
              <button class="wall-like-btn ${likeClass}" data-entry-id="${entry.id}"
                style="background:transparent; border:none; padding:6px 12px; border-radius:20px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:14px; color:var(--text-secondary); transition:all 0.2s ease;">
                ❤️ <span class="like-count">${likeCount}</span>
              </button>
            </div>
            <div style="border:1px solid var(--border-color); border-radius:12px; padding:16px; text-align:center; background:var(--bg-primary); margin-top:4px;">
              <div style="font-size:14px; font-weight:500; margin-bottom:12px;">${tipoEmoji} ${tipoMostrado}</div>
              <div style="display:flex; justify-content:space-around; align-items:center; gap:8px; color:var(--text-secondary); font-size:13px; margin-bottom:8px;">
                <span>⏱️ ${duracion}'</span>
                <span>📏 ${distancia} km</span>
                <span>⚡ ${tss} TSS</span>
              </div>
              <div style="color:var(--text-secondary); font-size:12px; display:flex; justify-content:center; align-items:center; gap:12px; margin-top:4px;">
                ${zone ? `<span style="color:${colorZona}; font-weight:500;">🔥 ${Utils.escapeHTML(zone)}</span>` : ''}
                <span>🕒 ${hora}</span>
              </div>
        `;
        
        if (entry.gpsRoute && entry.gpsRoute.points && entry.gpsRoute.points.length >= 2) {
          const mapId = `wallMap_${entry.id}`;
          html += `
            <div id="${mapId}" class="route-map" style="height: 200px; margin-top: 16px; border-radius: 8px; overflow: hidden; cursor: pointer;" data-entry-id="${entry.id}"></div>
            <div style="text-align:center; margin-top: 5px;">
              <button class="expand-map-btn" data-entry-id="${entry.id}" style="background:transparent; border:none; color:var(--accent-blue); font-size:12px; cursor:pointer;">🔍 Ver ruta completa</button>
            </div>
          `;
        }
        
        html += `</div></div>`;
      } catch (err) {
        console.warn('Error renderizando entrada del muro:', err, entry);
      }
    }

    if (!html) {
      this.container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>';
      return;
    }

    this.container.innerHTML = html;

    // Click en nombre de usuario -> perfil
    this.container.querySelectorAll('.wall-username').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = el.dataset.uid;
        if (uid && typeof Friends !== 'undefined' && Friends.abrirModalAmigo) {
          Friends.abrirModalAmigo(uid);
        }
      });
    });

    // Mostrar mapas
    for (const entry of this.currentEntries) {
      if (entry.gpsRoute && entry.gpsRoute.points && entry.gpsRoute.points.length >= 2) {
        const mapId = `wallMap_${entry.id}`;
        const mapContainer = document.getElementById(mapId);
        if (mapContainer) {
          this._displayRouteMini(mapId, entry.gpsRoute.points);
          mapContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            this._openRouteModal(entry);
          });
          const btn = document.querySelector(`.expand-map-btn[data-entry-id="${entry.id}"]`);
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              this._openRouteModal(entry);
            });
          }
        }
      }
    }

    this.container.querySelectorAll('.wall-like-btn').forEach(btn => {
      btn.removeEventListener('click', this._handleLikeClick);
      btn.addEventListener('click', this._handleLikeClick.bind(this));
    });

    this.container.querySelectorAll('.wall-item').forEach(item => {
      item.removeEventListener('click', this._handleItemClick);
      item.addEventListener('click', this._handleItemClick.bind(this));
    });
  },

  async _displayRouteMini(containerId, points) {
    if (!points || points.length < 2) return;
    await this._loadLeaflet();
    const container = document.getElementById(containerId);
    if (!container) return;
    const latlngs = points.map(p => [p.lat, p.lng]);
    const map = L.map(containerId, { attributionControl: false });
    const polyline = L.polyline(latlngs, { color: '#C9A96E', weight: 4, opacity: 0.8 }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    L.circleMarker(latlngs[0], {
      radius: 3,
      color: '#aaa',
      fillColor: '#ccc',
      fillOpacity: 0.6,
      weight: 1
    }).addTo(map);
    L.circleMarker(latlngs[latlngs.length-1], {
      radius: 3,
      color: '#aaa',
      fillColor: '#ccc',
      fillOpacity: 0.6,
      weight: 1
    }).addTo(map);
    container._leaflet_map = map;
  },

  async _openRouteModal(entry) {
    let modal = document.getElementById('wallRouteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wallRouteModal';
      modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 200000;
        justify-content: center;
        align-items: center;
      `;
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: var(--bg-card);
        border-radius: 16px;
        width: 90%;
        max-width: 800px;
        max-height: 90%;
        overflow-y: auto;
        padding: 20px;
        position: relative;
      `;
      modalContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; color:var(--accent-yellow);">Recorrido completo</h3>
          <button id="closeWallRouteModal" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:var(--text-primary);">&times;</button>
        </div>
        <div id="wallRouteMap" style="height: 400px; width: 100%; border-radius: 12px; margin-bottom: 16px;"></div>
        <div id="wallRouteStats" style="text-align:center; font-size:14px; color:var(--text-primary);"></div>
      `;
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      document.getElementById('closeWallRouteModal').addEventListener('click', () => {
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
    modal.style.display = 'flex';
    const mapContainer = document.getElementById('wallRouteMap');
    const statsDiv = document.getElementById('wallRouteStats');
    if (mapContainer) {
      if (mapContainer._leaflet_map) {
        mapContainer._leaflet_map.remove();
      }
      const points = entry.gpsRoute.points;
      const latlngs = points.map(p => [p.lat, p.lng]);
      await this._loadLeaflet();
      const map = L.map(mapContainer.id, { attributionControl: false }).fitBounds(latlngs, { padding: [50, 50] });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      L.polyline(latlngs, { color: '#C9A96E', weight: 5, opacity: 0.9 }).addTo(map);
      L.circleMarker(latlngs[0], {
        radius: 3,
        color: '#aaa',
        fillColor: '#ccc',
        fillOpacity: 0.6,
        weight: 1
      }).addTo(map);
      L.circleMarker(latlngs[latlngs.length-1], {
        radius: 3,
        color: '#aaa',
        fillColor: '#ccc',
        fillOpacity: 0.6,
        weight: 1
      }).addTo(map);
      mapContainer._leaflet_map = map;
      
      const distanceKm = (entry.gpsRoute.distanceMeters / 1000).toFixed(2);
      const durationSec = entry.gpsRoute.durationSeconds;
      const durationMin = Math.floor(durationSec / 60);
      const durationSecRemainder = Math.round(durationSec % 60);
      const pace = (durationSec / 60 / distanceKm).toFixed(1);
      
      let city = '--';
      try {
        const center = latlngs[Math.floor(latlngs.length / 2)];
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center[0]}&lon=${center[1]}&zoom=10&addressdetails=1`);
        const data = await response.json();
        if (data.address) {
          city = data.address.city || data.address.town || data.address.village || data.address.municipality || 'Ubicación aproximada';
        }
      } catch (e) {
        console.warn('Error obteniendo ciudad:', e);
      }
      
      let dateStr = '';
      try {
        const ts = entry.timestamp;
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch(e) {}
      
      statsDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div><strong>📏 Distancia</strong><br>${distanceKm} km</div>
          <div><strong>⏱️ Duración</strong><br>${durationMin}:${durationSecRemainder.toString().padStart(2,'0')}</div>
          <div><strong>⚡ Ritmo medio</strong><br>${pace} min/km</div>
          <div><strong>📍 Ciudad</strong><br>${city}</div>
          <div><strong>📅 Fecha</strong><br>${dateStr}</div>
          <div><strong>❤️ Me gusta</strong><br>${entry.likeCount || 0}</div>
        </div>
      `;
    }
  },

  async _loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (typeof L !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const style = document.createElement('style');
        style.textContent = '.leaflet-control-attribution { display: none !important; }';
        document.head.appendChild(style);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  _handleLikeClick(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const entryId = btn.dataset.entryId;
    this.toggleLike(entryId, btn);
  },

  _handleItemClick(e) {
    if (e.target.closest('.route-map') || e.target.closest('.expand-map-btn')) return;
    if (e.target.closest('.wall-like-btn')) return;
    const item = e.currentTarget;
    const entryId = item.dataset.entryId;
    this.showLikesModal(entryId);
  },

  async toggleLike(entryId, btnElement) {
    if (!AppState.currentUserId) {
      Utils.showToast('Inicia sesión para dar like', 'warning');
      return;
    }

    const likeSpan = btnElement.querySelector('.like-count');
    const currentCount = parseInt(likeSpan.textContent, 10) || 0;
    const isLiked = btnElement.classList.contains('liked');

    let newCount = isLiked ? currentCount - 1 : currentCount + 1;
    likeSpan.textContent = newCount;
    if (isLiked) {
      btnElement.classList.remove('liked');
    } else {
      btnElement.classList.add('liked');
    }

    const entryRef = firebaseServices.db.collection('globalFeed').doc(entryId);
    try {
      if (isLiked) {
        await entryRef.update({
          likes: firebaseServices.FieldValue.arrayRemove(AppState.currentUserId),
          likeCount: firebaseServices.FieldValue.increment(-1)
        });
      } else {
        await entryRef.update({
          likes: firebaseServices.FieldValue.arrayUnion(AppState.currentUserId),
          likeCount: firebaseServices.FieldValue.increment(1)
        });
      }
      Utils.vibrate(isLiked ? 30 : 50);
    } catch (error) {
      console.error('Error al dar/quitar like:', error);
      likeSpan.textContent = currentCount;
      if (isLiked) btnElement.classList.add('liked');
      else btnElement.classList.remove('liked');
      Utils.showToast('Error al procesar like', 'error');
    }
  },

  async showLikesModal(entryId) {
    if (!entryId) return;
    try {
      const entryRef = firebaseServices.db.collection('globalFeed').doc(entryId);
      const doc = await entryRef.get();
      if (!doc.exists) {
        Utils.showToast('La publicación ya no existe', 'error');
        return;
      }
      const data = doc.data();
      const likes = data.likes || [];
      if (likes.length === 0) {
        Utils.showToast('Nadie ha dado like a esta publicación aún', 'info');
        return;
      }
      const usersData = [];
      for (const uid of likes) {
        const userData = await Storage.getUser(uid);
        const nivel = await Friends.getNivelDirecto(uid);
        if (userData) {
          usersData.push({ uid, ...userData, nivel });
        } else {
          usersData.push({ uid, username: 'Usuario desconocido', profile: {}, nivel: 1 });
        }
      }
      this._createLikesModal(usersData);
    } catch (error) {
      console.error('Error al obtener likes:', error);
      Utils.showToast('Error al cargar los likes', 'error');
    }
  },

  _createLikesModal(users) {
    const existingModal = document.getElementById('likesModal');
    const existingOverlay = document.getElementById('likesModalOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'likesModal';
    modal.className = 'modal';
    modal.style.cssText = `
      background: var(--bg-primary); border-radius: 24px; max-width: 500px;
      width: 90%; max-height: 80vh; overflow-y: auto; padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--border-color);
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);';
    header.innerHTML = `
      <h3 style="margin:0; color: var(--accent-yellow);">❤️ Me gusta (${users.length})</h3>
      <button id="closeLikesModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
    `;

    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    for (const user of users) {
      const photoURL = user.profile?.photoURL;
      const nivel = user.nivel || 1;
      const colorNivel = Gamification.getColorByLevel(nivel);
      const badgeStyle = `background: ${colorNivel}; color: white; text-shadow: 0 0 1px black; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; position: absolute; bottom: 0; right: 0; border: 2px solid var(--bg-primary);`;
      const avatarHTML = photoURL
        ? `<div class="resultado-avatar-wrapper" style="position: relative; display: inline-block; width: 48px; height: 48px; overflow: visible;">
            <img src="${Utils.escapeHTML(photoURL)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            <div class="nivel-badge" style="${badgeStyle}">${nivel}</div>
          </div>`
        : `<div class="resultado-avatar-wrapper" style="position: relative; display: inline-block; width: 48px; height: 48px; overflow: visible;">
            <div style="width: 48px; height: 48px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>
            <div class="nivel-badge" style="${badgeStyle}">${nivel}</div>
          </div>`;
      
      const usernameFormatted = Utils.capitalizeUsername(user.username);
      const userItem = document.createElement('div');
      userItem.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 16px; background: var(--bg-secondary); cursor: pointer; transition: background 0.2s;';
      userItem.innerHTML = `
        ${avatarHTML}
        <div style="flex:1;">
          <div style="font-weight: bold; color: var(--accent-yellow);">${Utils.escapeHTML(usernameFormatted)}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">@${Utils.escapeHTML(user.username)}</div>
        </div>
        <button class="view-profile-btn" data-uid="${user.uid}" style="background: var(--zone-2); border: none; padding: 6px 12px; border-radius: 20px; color: var(--bg-primary); cursor: pointer;">Ver perfil</button>
      `;
      userItem.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-profile-btn')) return;
        if (typeof Friends !== 'undefined' && Friends.abrirModalAmigo) {
          Friends.abrirModalAmigo(user.uid);
          this._closeLikesModal();
        }
      });
      const btn = userItem.querySelector('.view-profile-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof Friends !== 'undefined' && Friends.abrirModalAmigo) {
            Friends.abrirModalAmigo(user.uid);
            this._closeLikesModal();
          }
        });
      }
      listContainer.appendChild(userItem);
    }

    modal.appendChild(header);
    modal.appendChild(listContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('closeLikesModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeLikesModal());
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeLikesModal();
    });
  },

  _closeLikesModal() {
    const modal = document.getElementById('likesModal');
    const overlay = document.getElementById('likesModalOverlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
  },

  recargar() {
    this.cargarMuro();
  }
};

window.Wall = Wall;