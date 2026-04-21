// ==================== wall.js - Muro global de entrenamientos (CORREGIDO) ====================
// Versión: 1.6 - Forzado de recarga y logs de depuración
// ====================

const Wall = {
  unsubscribe: null,
  lastDoc: null,
  hasMore: true,
  loading: false,

  initListener() {
    if (this.unsubscribe) this.unsubscribe();

    const query = firebaseServices.db
      .collection('globalFeed')
      .orderBy('timestamp', 'desc')
      .limit(30);

    console.log('🎧 [MURO] Iniciando listener...');

    this.unsubscribe = query.onSnapshot((snapshot) => {
      console.log('📡 [MURO] Snapshot recibido, cantidad:', snapshot.size);
      const entries = [];
      snapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      this.render(entries);
    }, (error) => {
      console.error('❌ [MURO] Error en listener:', error);
      Utils.showToast('Error al cargar el muro', 'error');
      this.cargarManual();
    });
  },

  async cargarManual() {
    console.log('🔄 [MURO] Cargando manualmente...');
    try {
      const snapshot = await firebaseServices.db
        .collection('globalFeed')
        .orderBy('timestamp', 'desc')
        .limit(30)
        .get();
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📊 [MURO] Entradas manuales:', entries.length);
      this.render(entries);
    } catch (error) {
      console.error('❌ [MURO] Error en carga manual:', error);
      const container = document.getElementById('wallContainer');
      if (container) container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--zone-5);">Error al cargar el muro</p>';
    }
  },

  render(entries) {
    const container = document.getElementById('wallContainer');
    console.log('🎨 [MURO] Renderizando, entradas:', entries?.length);
    
    if (!container) {
      console.error('❌ [MURO] Contenedor no encontrado');
      return;
    }

    if (!entries || entries.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes. ¡Sé el primero en compartir!</p>';
      return;
    }

    let html = '';
    for (const entry of entries) {
      try {
        let fecha = '—';
        try {
          if (entry.timestamp) {
            if (typeof entry.timestamp.toDate === 'function') {
              fecha = entry.timestamp.toDate().toLocaleString();
            } else {
              fecha = new Date(entry.timestamp).toLocaleString();
            }
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
        const duracion = Number(entry.duration) || 0;
        const distancia = isFinite(Number(entry.distancia)) ? Number(entry.distancia).toFixed(2) : '0.00';
        const tss = Number(entry.tss) || 0;

        html += `
          <div class="wall-item" data-entry-id="${entry.id}">
            <div class="wall-header">
              ${avatarHTML}
              <div class="wall-user-info">
                <div class="wall-username">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="wall-fecha">${fecha}</div>
              </div>
            </div>
            <div class="wall-entreno">
              <div class="wall-entreno-tipo">${tipoEmoji} ${Utils.escapeHTML(String(entry.trainingType || 'ENTRENO').toUpperCase())}</div>
              <div class="wall-entreno-detalles">
                <span>⏱️ ${duracion}'</span>
                <span>📏 ${distancia} km</span>
                <span>⚡ ${tss} TSS</span>
              </div>
            </div>
            <div class="wall-actions">
              <button class="wall-like-btn ${likeClass}" data-entry-id="${entry.id}">
                ❤️ <span class="like-count">${likeCount}</span>
              </button>
            </div>
          </div>
        `;
      } catch (err) {
        console.warn('Error renderizando entrada:', err);
      }
    }

    if (!html) {
      container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>';
      return;
    }

    container.innerHTML = html;

    container.querySelectorAll('.wall-like-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entryId = btn.dataset.entryId;
        this.toggleLike(entryId);
      });
    });

    container.querySelectorAll('.wall-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.wall-like-btn')) return;
        const entryId = item.dataset.entryId;
        this.showLikesModal(entryId);
      });
    });
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
        if (userData) {
          usersData.push({ uid, ...userData });
        } else {
          usersData.push({ uid, username: 'Usuario desconocido', profile: {} });
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
    overlay.className = 'modal-overlay';
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
      const avatarHTML = photoURL
        ? `<img src="${Utils.escapeHTML(photoURL)}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">`
        : `<div style="width: 48px; height: 48px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>`;
      
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

  async toggleLike(entryId) {
    if (!AppState.currentUserId) {
      Utils.showToast('Inicia sesión para dar like', 'warning');
      return;
    }
    const entryRef = firebaseServices.db.collection('globalFeed').doc(entryId);
    try {
      const doc = await entryRef.get();
      if (!doc.exists) return;
      const data = doc.data();
      const likes = data.likes || [];
      const userLiked = likes.includes(AppState.currentUserId);
      if (userLiked) {
        await entryRef.update({
          likes: firebaseServices.FieldValue.arrayRemove(AppState.currentUserId),
          likeCount: firebaseServices.FieldValue.increment(-1)
        });
        Utils.vibrate(30);
      } else {
        await entryRef.update({
          likes: firebaseServices.FieldValue.arrayUnion(AppState.currentUserId),
          likeCount: firebaseServices.FieldValue.increment(1)
        });
        Utils.vibrate(50);
      }
    } catch (error) {
      console.error('Error al dar/quitar like:', error);
      Utils.showToast('Error al procesar like', 'error');
    }
  },

  detenerListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },

  recargar() {
    console.log('🔄 [MURO] Recargando manualmente...');
    this.detenerListener();
    this.initListener();
  }
};

window.Wall = Wall;