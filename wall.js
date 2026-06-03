// ==================== wall.js - Muro global con minimapa claro y visor funcional ====================
// Versión: 4.7 - Minimapa claro, prioriza GPS real, visor garantizado
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
      if (!document.hidden && document.querySelector('#tab-muro').classList.contains('active')) this.cargarMuro();
    });
  },

  iniciarActualizacionPeriodica() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      if (document.querySelector('#tab-muro').classList.contains('active')) this.cargarMuro();
    }, 30000);
  },

  detenerListener() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  },

  async cargarMuro() {
    if (this.loading) return;
    this.loading = true;
    try {
      const snapshot = await firebaseServices.db.collection('globalFeed').orderBy('timestamp', 'desc').limit(20).get();
      this.currentEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.render(this.currentEntries);
    } catch (error) {
      console.error('Error cargando muro:', error);
      if (this.container) this.container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--zone-5);">Error al cargar el muro.</p>';
    } finally {
      this.loading = false;
    }
  },

  _renderMiniMap(points, width = 320, height = 130) {
    if (!points || points.length < 2) return '';
    let lats = points.map(p => p.lat);
    let lngs = points.map(p => p.lng);
    const allSameLat = lats.every(v => v === lats[0]);
    const allSameLng = lngs.every(v => v === lngs[0]);
    if (allSameLat && allSameLng) {
      lats = lats.map((v, i) => v + i * 0.00001);
      lngs = lngs.map((v, i) => v + i * 0.00001);
    }
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
    const toXY = p => {
      const x = offX + (p.lng - minLng) * scale;
      const y = offY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const pathD = 'M ' + points.map(toXY).join(' L ');
    const start = toXY(points[0]).split(',');
    const end = toXY(points[points.length - 1]).split(',');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
      style="border-radius:10px;background:#f8f9fa;display:block;width:100%;max-width:${width}px;"
      xmlns="http://www.w3.org/2000/svg">
      <path d="${pathD}" fill="none" stroke="#1e88e5" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
      <circle cx="${start[0]}" cy="${start[1]}" r="5" fill="#2ecc71" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${end[0]}" cy="${end[1]}" r="5" fill="#e74c3c" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  },

  render(entries) {
    if (!this.container) return;
    if (!entries || entries.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>';
      return;
    }
    let html = '';
    for (const entry of entries) {
      try {
        let fecha = '', hora = '';
        if (entry.timestamp) {
          const dateObj = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
          fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        const likeCount = Number(entry.likeCount) || 0;
        const userLiked = Array.isArray(entry.likes) && entry.likes.includes(AppState.currentUserId);
        const likeClass = userLiked ? 'liked' : '';
        const avatarHTML = entry.photoURL ? `<img src="${Utils.escapeHTML(entry.photoURL)}" class="wall-avatar" style="object-fit:cover;">` : `<div class="wall-avatar" style="background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;">👤</div>`;
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
        // PRIORIZAR DATOS REALES DEL GPS
        const duracion = entry.gpsDurationMs ? Math.round(entry.gpsDurationMs / 60000) : (Number(entry.duration) || 0);
        const distancia = entry.gpsDistanceKm ? entry.gpsDistanceKm.toFixed(2) : (isFinite(Number(entry.distancia)) ? Number(entry.distancia).toFixed(2) : '0.00');
        const tss = Number(entry.tss) || 0;
        const zone = entry.zone || '';
        const trainingName = entry.trainingName || '';
        const tipoMostrado = trainingName ? Utils.escapeHTML(trainingName).toUpperCase() : Utils.escapeHTML(String(entry.trainingType || 'ENTRENO')).toUpperCase();
        const colorZona = this._colorZona(zone);
        const gpsBadge = entry.hasGPS ? `<span style="font-size:10px; font-weight:600; letter-spacing:1px; color:#1e88e5; background:rgba(30,136,229,0.12); border:1px solid rgba(30,136,229,0.3); border-radius:20px; padding:2px 8px; margin-left:6px;">GPS</span>` : '';
        let miniMapHTML = '';
        if (entry.hasGPS && Array.isArray(entry.trackPoints) && entry.trackPoints.length >= 2) {
          const mapSVG = this._renderMiniMap(entry.trackPoints, 320, 130);
          if (mapSVG) {
            miniMapHTML = `<div class="gps-minimap-tap" data-entry-id="${entry.id}" style="margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid #ddd;cursor:pointer;position:relative;">
              ${mapSVG}
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding:8px;pointer-events:none;">
                <div style="background:rgba(0,0,0,0.7);color:white;font-size:10px;padding:4px 12px;border-radius:20px;font-family:sans-serif;">VER RECORRIDO</div>
              </div>
            </div>`;
          }
        }
        html += `<div class="wall-item" data-entry-id="${entry.id}">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              ${avatarHTML}
              <div>
                <div class="wall-username">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="wall-fecha">${fecha} · ${hora}</div>
              </div>
            </div>
            <button class="wall-like-btn ${likeClass}" data-entry-id="${entry.id}" style="background:transparent; border:none; padding:6px 12px; border-radius:20px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:14px; color:var(--text-secondary);">❤️ <span class="like-count">${likeCount}</span></button>
          </div>
          <div style="border:1px solid var(--border-color); border-radius:12px; padding:14px; text-align:center; background:var(--bg-primary); margin-top:4px;">
            <div style="font-size:14px; font-weight:500; margin-bottom:10px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px;">
              ${tipoEmoji} ${tipoMostrado}${gpsBadge}
            </div>
            <div style="display:flex; justify-content:space-around; gap:8px; color:var(--text-secondary); font-size:13px; margin-bottom:6px;">
              <span>${duracion}'</span> <span>${distancia} km</span> <span>${tss} TSS</span>
            </div>
            <div style="color:var(--text-secondary); font-size:12px; display:flex; justify-content:center; gap:12px; margin-top:4px;">
              ${zone ? `<span style="color:${colorZona}; font-weight:500;">${Utils.escapeHTML(zone)}</span>` : ''}
              <span>${hora}</span>
            </div>
            ${miniMapHTML}
          </div>
        </div>`;
      } catch (err) { console.warn(err); }
    }
    if (!html) { this.container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>'; return; }
    this.container.innerHTML = html;
    this.container.querySelectorAll('.wall-like-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleLike(btn.dataset.entryId, btn); }));
    this.container.querySelectorAll('.wall-item').forEach(item => item.addEventListener('click', (e) => { if (!e.target.closest('.wall-like-btn')) this.showLikesModal(item.dataset.entryId); }));
    this.container.querySelectorAll('.gps-minimap-tap').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const entryId = el.dataset.entryId;
        const entry = this.currentEntries.find(en => en.id === entryId);
        if (entry && window.GPSTrackViewer) {
          GPSTrackViewer.open(entry);
        } else {
          Utils.showToast('Visor no disponible temporalmente', 'error');
        }
      });
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
    const item = e.currentTarget;
    const entryId = item.dataset.entryId;
    this.showLikesModal(entryId);
  },

  async toggleLike(entryId, btnElement) {
    if (!AppState.currentUserId) { Utils.showToast('Inicia sesión para dar like', 'warning'); return; }
    const likeSpan = btnElement.querySelector('.like-count');
    const currentCount = parseInt(likeSpan.textContent, 10) || 0;
    const isLiked = btnElement.classList.contains('liked');
    likeSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
    isLiked ? btnElement.classList.remove('liked') : btnElement.classList.add('liked');
    try {
      await firebaseServices.db.collection('globalFeed').doc(entryId).update({
        likes: isLiked ? firebaseServices.FieldValue.arrayRemove(AppState.currentUserId) : firebaseServices.FieldValue.arrayUnion(AppState.currentUserId),
        likeCount: firebaseServices.FieldValue.increment(isLiked ? -1 : 1)
      });
    } catch (error) { console.error(error); Utils.showToast('Error al procesar like', 'error'); }
  },

  async showLikesModal(entryId) {
    try {
      const doc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
      if (!doc.exists) { Utils.showToast('La publicación ya no existe', 'error'); return; }
      const likes = doc.data().likes || [];
      if (likes.length === 0) { Utils.showToast('Nadie ha dado like a esta publicación', 'info'); return; }
      const usersData = [];
      for (const uid of likes) {
        const userData = await Storage.getUser(uid);
        usersData.push(userData ? { uid, ...userData } : { uid, username: 'Usuario desconocido', profile: {} });
      }
      this._createLikesModal(usersData);
    } catch (error) { console.error(error); Utils.showToast('Error al cargar los likes', 'error'); }
  },

  _createLikesModal(users) {
    const existingModal = document.getElementById('likesModal');
    const existingOverlay = document.getElementById('likesModalOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();
    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:2000; display:flex; align-items:center; justify-content:center;';
    const modal = document.createElement('div');
    modal.id = 'likesModal';
    modal.className = 'modal';
    modal.style.cssText = 'background:var(--bg-primary); border-radius:24px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--border-color);';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid var(--border-color);';
    header.innerHTML = `<h3 style="margin:0; color:var(--accent-yellow);">Me gusta (${users.length})</h3><button id="closeLikesModalBtn" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-secondary);">&times;</button>`;
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
    for (const user of users) {
      const photoURL = user.profile?.photoURL;
      const avatarHTML = photoURL ? `<img src="${Utils.escapeHTML(photoURL)}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">` : `<div style="width:48px; height:48px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">👤</div>`;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:8px; border-radius:16px; background:var(--bg-secondary); cursor:pointer;';
      div.innerHTML = `${avatarHTML}<div style="flex:1;"><div style="font-weight:bold; color:var(--accent-yellow);">${Utils.escapeHTML(Utils.capitalizeUsername(user.username))}</div><div style="font-size:12px; color:var(--text-secondary);">@${Utils.escapeHTML(user.username)}</div></div><button class="view-profile-btn" data-uid="${user.uid}" style="background:var(--zone-2); border:none; padding:6px 12px; border-radius:20px; color:var(--bg-primary); cursor:pointer;">Ver perfil</button>`;
      div.addEventListener('click', (e) => { if (!e.target.classList.contains('view-profile-btn')) { Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); } });
      div.querySelector('.view-profile-btn')?.addEventListener('click', (e) => { e.stopPropagation(); Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); });
      listContainer.appendChild(div);
    }
    modal.appendChild(header);
    modal.appendChild(listContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('closeLikesModalBtn')?.addEventListener('click', () => this._closeLikesModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeLikesModal(); });
  },

  _closeLikesModal() {
    document.getElementById('likesModal')?.remove();
    document.getElementById('likesModalOverlay')?.remove();
  },

  recargar() { this.cargarMuro(); }
};

window.Wall = Wall;