// ==================== profile.js - Perfil con tarjetas estilo muro y mapa CartoDB Voyager ====================
// Versión: 11.5 - Mapa limpio sin números de portal, marcadores sutiles
// ====================

const Profile = {
  async cargarPerfil(forceRefresh = false) {
    const container = document.getElementById('perfilContainer');
    if (!container || !AppState.currentUserId) {
      console.warn('⚠️ cargarPerfil: contenedor no encontrado o usuario no autenticado');
      return;
    }

    const cacheKey = `perfil_${AppState.currentUserId}`;
    let htmlCache = null;

    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { html, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 60 * 1000) {
            container.innerHTML = html;
            console.log('📦 Perfil cargado desde caché');
            htmlCache = html;
          }
        } catch (e) {}
      }
    } else {
      localStorage.removeItem(cacheKey);
      sessionStorage.removeItem(`gamification_${AppState.currentUserId}`);
      localStorage.removeItem(`gamification_${AppState.currentUserId}`);
      console.log('🔄 Recarga forzada del perfil (sin caché)');
    }

    try {
      console.time('cargarPerfil');
      console.log('🔄 Cargando perfil desde Firestore...');
      const userRef = firebaseServices.db.collection('users').doc(AppState.currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      // Limpieza de amigos huérfanos
      let friendIds = userData.friendIds || [];
      let necesitaActualizacion = false;
      const amigosValidos = [];
      const chunks = [];
      for (let i = 0; i < friendIds.length; i += 10) {
        chunks.push(friendIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const snapshot = await firebaseServices.db.collection('users')
          .where('__name__', 'in', chunk)
          .get();
        snapshot.forEach(doc => amigosValidos.push(doc.id));
      }
      if (amigosValidos.length !== friendIds.length) {
        necesitaActualizacion = true;
        await userRef.update({
          friendIds: amigosValidos,
          friendsCount: amigosValidos.length
        });
        userData.friendIds = amigosValidos;
        userData.friendsCount = amigosValidos.length;
        console.log(`✅ Lista de amigos limpiada. Ahora hay ${amigosValidos.length} amigos reales.`);
      }
      const amigosReales = amigosValidos.length;

      const profile = userData.profile || {
        bio: '', city: '', age: null, gender: '', weight: null, height: null,
        privacySettings: { showTrainings: 'friends', showProfile: 'public' },
        photoURL: null
      };

      const photoHTML = profile.photoURL
        ? `<img src="${Utils.escapeHTML(profile.photoURL)}" class="perfil-avatar" style="object-fit:cover;">`
        : `<div class="perfil-avatar-placeholder">👤</div>`;

      const age = profile.age ? Utils.escapeHTML(profile.age + ' años') : '—';
      const gender = profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : profile.gender === 'other' ? 'Otro' : '—';
      const bio = profile.bio ? Utils.escapeHTML(profile.bio) : '—';
      const city = profile.city ? Utils.escapeHTML(profile.city) : '—';
      const weight = profile.weight ? Utils.escapeHTML(profile.weight + ' kg') : '—';
      const height = profile.height ? Utils.escapeHTML(profile.height + ' m') : '—';

      let html = `
        <div class="perfil-header">
          ${photoHTML}
          <div class="perfil-info">
            <div class="perfil-nombre">${Utils.escapeHTML(Utils.capitalizeUsername(userData.username))}</div>
            <div class="perfil-username">@${Utils.escapeHTML(userData.username)}</div>
            <div class="perfil-stats">
              <div class="perfil-stat"><span>${amigosReales}</span><label>Amigos</label></div>
              <div class="perfil-stat"><span>${userData.calculosMes || 0}</span><label>Cálculos/mes</label></div>
              <div class="perfil-stat"><span>${userData.premium ? 'PREMIUM' : 'GRATIS'}</span><label>Plan</label></div>
            </div>
          </div>
        </div>
        <div class="perfil-detalle-grid" style="grid-template-columns: repeat(2, 1fr) !important;">
          <div class="perfil-detalle-item"><span class="label">BIO</span><span class="value">${bio}</span></div>
          <div class="perfil-detalle-item"><span class="label">CIUDAD</span><span class="value">${city}</span></div>
          <div class="perfil-detalle-item"><span class="label">EDAD</span><span class="value">${age}</span></div>
          <div class="perfil-detalle-item"><span class="label">GÉNERO</span><span class="value">${gender}</span></div>
          <div class="perfil-detalle-item"><span class="label">PESO</span><span class="value">${weight}</span></div>
          <div class="perfil-detalle-item"><span class="label">ALTURA</span><span class="value">${height}</span></div>
          <div class="perfil-detalle-item" style="grid-column: span 2;">
            <span class="label">EMAIL</span>
            <span class="value">${Utils.escapeHTML(userData.email)}</span>
          </div>
        </div>
      `;

      // Tarjeta Pasaporte (gamificación)
      try {
        const gamificationData = await Gamification.getData(AppState.currentUserId);
        if (gamificationData) {
          const progress = Gamification.getProgressToNextLevel(gamificationData.totalDistance);
          const levelColor = Gamification.getColorByLevel(gamificationData.level);
          
          let bgColor = levelColor;
          if (levelColor.startsWith('#')) {
            const r = parseInt(levelColor.slice(1,3), 16);
            const g = parseInt(levelColor.slice(3,5), 16);
            const b = parseInt(levelColor.slice(5,7), 16);
            bgColor = `rgba(${r}, ${g}, ${b}, 0.05)`;
          } else if (levelColor.startsWith('rgb')) {
            bgColor = levelColor.replace('rgb', 'rgba').replace(')', ', 0.05)');
          } else {
            bgColor = 'var(--bg-secondary)';
          }
          
          const badgesIcons = (gamificationData.badges || []).map(badgeId => {
            const badge = Gamification.BADGES[badgeId];
            if (!badge) return '';
            return `<span class="badge-icon" data-badge-id="${badgeId}" style="display:inline-block; font-size:28px; margin:0 6px; cursor:pointer;" title="${badge.name}">${badge.icon}</span>`;
          }).filter(b => b).join('');
          
          const shoe = await Gamification.getCurrentShoe(AppState.currentUserId);
          const shoeName = shoe.name || 'Zapatilla actual';
          const shoeKm = (shoe.km || 0).toFixed(1);
          
          const nextLevel = Gamification.LEVELS_KM.find(l => l.level === gamificationData.level + 1);
          const nextKm = nextLevel ? nextLevel.kmNeeded : gamificationData.totalDistance;
          
          const userName = Utils.capitalizeUsername(userData.username);
          
          html += `
            <div class="passport-card" style="margin-top:24px; border:2px solid ${levelColor}; border-radius:24px; background:${bgColor}; box-shadow:0 8px 20px rgba(0,0,0,0.1); overflow:hidden;">
              <div style="padding:16px 20px 0 20px; text-align:center; border-bottom:1px solid ${levelColor}40;">
                <span style="font-size:16px; font-weight:500; letter-spacing:1px; color:${levelColor};">${Utils.escapeHTML(userName)}</span>
              </div>
              <div style="padding:16px 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                  <div style="flex:1; text-align: center;">
                    <div style="font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary);">Nivel</div>
                    <strong style="font-size:36px; font-weight:300; color:${levelColor};">${gamificationData.level}</strong>
                  </div>
                  <div style="flex:1; text-align: right;">
                    <div style="font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary);">Zapatilla actual</div>
                    <strong style="font-size:14px;">${Utils.escapeHTML(shoeName)}</strong>
                    <div style="font-size:12px; opacity:0.8;">${shoeKm} km</div>
                  </div>
                </div>
                <div style="margin-bottom: 20px;">
                  <div class="level-progress" style="background:var(--border-color); height:3px; border-radius:3px; overflow:hidden;">
                    <div class="level-progress-fill" style="width: ${progress}%; background: ${levelColor}; height:3px;"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span style="font-size:8px;">0 km</span>
                    <span style="font-size:8px;">${gamificationData.totalDistance.toFixed(0)} km</span>
                    <span style="font-size:8px;">${nextKm} km</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; text-align: center;">
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">📏 DISTANCIA</div>
                    <strong style="font-size:18px;">${gamificationData.totalDistance.toFixed(1)}</strong>
                    <span style="font-size:11px;"> km</span>
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">🎯 SESIONES</div>
                    <strong style="font-size:18px;">${gamificationData.totalSessions}</strong>
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary);">✨ XP</div>
                    <strong style="font-size:18px;">${gamificationData.totalXP}</strong>
                  </div>
                </div>
                ${badgesIcons ? `<div style="margin-bottom: 16px; border-top:1px solid ${levelColor}40; padding-top:16px;">
                  <div style="font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--text-secondary); margin-bottom:12px;">🏅 Sellos de progreso</div>
                  <div class="badges-icons-container" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">${badgesIcons}</div>
                </div>` : '<p style="text-align:center; font-size:11px; margin-bottom:16px;">Completa entrenamientos para desbloquear sellos</p>'}
                <div style="display: flex; justify-content: center; gap: 12px; margin-top:8px;">
                  <button id="changeShoeBtn" style="background:transparent; border:1px solid ${levelColor}; color:${levelColor}; padding:2px 10px; border-radius:30px; font-size:10px; letter-spacing:0.5px; cursor:pointer;">👟 Cambiar</button>
                  <button id="historyShoeBtn" style="background:transparent; border:1px solid ${levelColor}; color:${levelColor}; padding:2px 10px; border-radius:30px; font-size:10px; letter-spacing:0.5px; cursor:pointer;">📜 Historial</button>
                </div>
              </div>
            </div>
          `;
        }
      } catch (e) { console.warn(e); }

      // ========== MIS ÚLTIMOS ENTRENAMIENTOS (ESTILO MURO) ==========
      try {
        const misEntrenamientosSnapshot = await firebaseServices.db
          .collection('globalFeed')
          .where('userId', '==', AppState.currentUserId)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get();

        if (!misEntrenamientosSnapshot.empty) {
          let entrenamientosHTML = '<div class="mis-entrenamentos-section" style="margin-top:24px; margin-bottom:24px;">';
          entrenamientosHTML += '<h3 style="margin-top:0; margin-bottom:16px; text-align:left; font-size:18px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>';
          
          for (const doc of misEntrenamientosSnapshot.docs) {
            const entry = doc.data();
            const entryId = doc.id;
            let fecha = '', hora = '';
            try {
              if (entry.timestamp) {
                const dateObj = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}
            
            const tipoEmoji = { rodaje: '🏃‍♂️', tempo: '⚡', series: '🔁', largo: '📏', strength: '💪' }[entry.trainingType] || '🏃';
            const trainingName = entry.trainingName ? Utils.escapeHTML(entry.trainingName) : Utils.escapeHTML(entry.trainingType).toUpperCase();
            const duracion = entry.duration || 0;
            const distancia = (entry.distancia && isFinite(entry.distancia)) ? entry.distancia.toFixed(2) : '0.00';
            const tss = entry.tss || 0;
            const zone = entry.zone || '';
            const usernameFormatted = Utils.capitalizeUsername(entry.username || 'Usuario');
            const avatarHTML = entry.photoURL
              ? `<img src="${Utils.escapeHTML(entry.photoURL)}" class="wall-avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">`
              : `<div class="wall-avatar" style="width:48px; height:48px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>`;
            
            // Obtener likeCount actual
            let likeCount = 0;
            let userLiked = false;
            try {
              const feedDoc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
              if (feedDoc.exists) {
                likeCount = (feedDoc.data().likes || []).length;
                userLiked = Array.isArray(feedDoc.data().likes) && feedDoc.data().likes.includes(AppState.currentUserId);
              }
            } catch (err) {}
            
            const likeClass = userLiked ? 'liked' : '';
            const colorZona = this._colorZona(zone);
            
            entrenamientosHTML += `
              <div class="profile-wall-item" data-entry-id="${entryId}" data-plan-id="${entry.planId || ''}" data-sesion-index="${entry.sesionIndex || ''}" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; margin-bottom:16px; padding:16px; cursor:pointer;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    ${avatarHTML}
                    <div>
                      <div class="wall-username" style="font-weight:bold; color:var(--accent-yellow);">${usernameFormatted}</div>
                      <div class="wall-fecha" style="font-size:12px; color:var(--text-secondary);">${fecha} · ${hora}</div>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="profile-like-btn ${likeClass}" data-entry-id="${entryId}" style="background:transparent; border:none; padding:6px 12px; border-radius:20px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:14px; color:var(--text-secondary); transition:all 0.2s ease;">
                      ❤️ <span class="like-count">${likeCount}</span>
                    </button>
                    <button class="delete-wall-btn" data-entry-id="${entryId}" data-plan-id="${entry.planId || ''}" data-sesion-index="${entry.sesionIndex || ''}" style="background:transparent; border:none; cursor:pointer; font-size:16px; color:var(--zone-5); padding:6px;">🗑️</button>
                  </div>
                </div>
                <div style="border:1px solid var(--border-color); border-radius:12px; padding:16px; text-align:center; background:var(--bg-primary);">
                  <div style="font-size:14px; font-weight:500; margin-bottom:12px;">${tipoEmoji} ${trainingName}</div>
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
            
            // Mapa con CartoDB Voyager si existe ruta GPS
            if (entry.gpsRoute && entry.gpsRoute.points && entry.gpsRoute.points.length >= 2) {
              const mapId = `profileMap_${entryId}`;
              entrenamientosHTML += `<div id="${mapId}" class="route-map" style="height: 200px; margin-top: 16px; border-radius: 8px; overflow: hidden;"></div>`;
            }
            
            entrenamientosHTML += `</div></div>`;
          }
          entrenamientosHTML += '</div>';
          html += entrenamientosHTML;
        } else {
          html += `<div style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:16px; padding:16px; text-align:center;"><h3 style="margin-top:0; margin-bottom:8px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3><p style="font-size:14px;">Aún no has compartido ningún entrenamiento.<br>Completa sesiones en la pestaña PLAN y márcalas como realizadas.</p></div>`;
        }
      } catch (error) { console.warn(error); }

      container.innerHTML = html;
      console.timeEnd('cargarPerfil');

      if (!forceRefresh) {
        localStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: Date.now() }));
      } else {
        localStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: Date.now() }));
      }

      setTimeout(() => {
        // Eventos de like
        document.querySelectorAll('.profile-like-btn').forEach(btn => {
          btn.removeEventListener('click', Profile._toggleLikeProfile);
          btn.addEventListener('click', Profile._toggleLikeProfile);
        });
        // Eventos de eliminar
        document.querySelectorAll('.delete-wall-btn').forEach(btn => {
          btn.removeEventListener('click', Profile._eliminarEntradaMuro);
          btn.addEventListener('click', Profile._eliminarEntradaMuro);
        });
        // Evento para abrir modal de likes al hacer clic en la tarjeta (excepto en botones)
        document.querySelectorAll('.profile-wall-item').forEach(item => {
          item.removeEventListener('click', Profile._handleProfileItemClick);
          item.addEventListener('click', Profile._handleProfileItemClick);
        });
        
        // Insignias
        document.querySelectorAll('.badge-icon').forEach(icon => {
          icon.removeEventListener('click', Profile._mostrarModalInsignias);
          icon.addEventListener('click', Profile._mostrarModalInsignias);
          icon.removeEventListener('touchstart', Profile._mostrarModalInsignias);
          icon.addEventListener('touchstart', Profile._mostrarModalInsignias);
        });
        
        const changeBtn = document.getElementById('changeShoeBtn');
        if (changeBtn) changeBtn.onclick = () => Profile._mostrarModalCambiarZapatilla();
        const historyBtn = document.getElementById('historyShoeBtn');
        if (historyBtn) historyBtn.onclick = () => Profile._mostrarModalHistorial();
        
        Profile._initProfileMaps();
      }, 0);

    } catch (error) {
      console.error('Error cargando perfil:', error);
      if (container && !htmlCache) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar perfil</p>';
    }
  },

  _colorZona(zona) {
    if (!zona) return null;
    const simple = zona.split('-')[0].trim().toLowerCase();
    const colores = {
      z1: '#8AA0B0', z2: '#9BB5A0', z3: '#C9A78B',
      z4: '#C99BA5', z5: '#9AA5A5', z6: '#8A8A8A'
    };
    return colores[simple] || null;
  },

  async _toggleLikeProfile(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const entryId = btn.dataset.entryId;
    if (!entryId) return;
    if (!AppState.currentUserId) {
      Utils.showToast('Inicia sesión para dar like', 'warning');
      return;
    }

    const likeSpan = btn.querySelector('.like-count');
    const currentCount = parseInt(likeSpan.textContent, 10) || 0;
    const isLiked = btn.classList.contains('liked');

    let newCount = isLiked ? currentCount - 1 : currentCount + 1;
    likeSpan.textContent = newCount;
    if (isLiked) {
      btn.classList.remove('liked');
    } else {
      btn.classList.add('liked');
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
      if (isLiked) btn.classList.add('liked');
      else btn.classList.remove('liked');
      Utils.showToast('Error al procesar like', 'error');
    }
  },

  _handleProfileItemClick(e) {
    if (e.target.closest('.profile-like-btn') || e.target.closest('.delete-wall-btn')) return;
    const item = e.currentTarget;
    const entryId = item.dataset.entryId;
    if (entryId) this.showLikesModal(entryId);
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
    const existingModal = document.getElementById('likesModalProfile');
    const existingOverlay = document.getElementById('likesModalOverlayProfile');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlayProfile';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'likesModalProfile';
    modal.style.cssText = `
      background: var(--bg-primary); border-radius: 24px; max-width: 500px;
      width: 90%; max-height: 80vh; overflow-y: auto; padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid var(--border-color);
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);';
    header.innerHTML = `
      <h3 style="margin:0; color: var(--accent-yellow);">❤️ Me gusta (${users.length})</h3>
      <button id="closeLikesModalProfileBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
    `;

    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    for (const user of users) {
      const photoURL = user.profile?.photoURL;
      const nivel = user.nivel || 1;
      const colorNivel = Gamification.getColorByLevel(nivel);
      const badgeStyle = `background: ${colorNivel}; color: white; text-shadow: 0 0 1px black; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; position: absolute; bottom: 0; right: 0; border: 2px solid var(--bg-primary);`;
      const avatarHTML = photoURL
        ? `<div style="position: relative; display: inline-block; width: 48px; height: 48px; overflow: visible;">
            <img src="${Utils.escapeHTML(photoURL)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            <div class="nivel-badge" style="${badgeStyle}">${nivel}</div>
          </div>`
        : `<div style="position: relative; display: inline-block; width: 48px; height: 48px; overflow: visible;">
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

    const closeBtn = document.getElementById('closeLikesModalProfileBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeLikesModal());
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeLikesModal();
    });
  },

  _closeLikesModal() {
    const modal = document.getElementById('likesModalProfile');
    const overlay = document.getElementById('likesModalOverlayProfile');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
  },

  async _eliminarEntradaMuro(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const entryId = btn.dataset.entryId;
    const planId = btn.dataset.planId;
    const sesionIndex = btn.dataset.sesionIndex;

    const confirmed = await Utils.confirm('Eliminar publicación', '¿Eliminar este entrenamiento del muro? La sesión quedará desmarcada en tu plan.');
    if (!confirmed) return;

    Utils.showLoading();
    try {
      await firebaseServices.db.collection('globalFeed').doc(entryId).delete();

      if (planId && sesionIndex !== undefined && AppState.currentUserId) {
        const planRef = firebaseServices.db
          .collection('users')
          .doc(AppState.currentUserId)
          .collection('planes')
          .doc(planId);
        await planRef.update({
          [`sesionesRealizadas.${sesionIndex}`]: false,
          [`wallEntryId.${sesionIndex}`]: firebaseServices.FieldValue.delete(),
          [`gpsRoutes.${sesionIndex}`]: firebaseServices.FieldValue.delete()
        });
      }

      Utils.showToast('✅ Publicación eliminada', 'success');
      await Profile.cargarPerfil(true);
    } catch (error) {
      console.error('Error al eliminar entrada del muro:', error);
      Utils.showToast('Error al eliminar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ========== INICIALIZAR MAPAS CON CARTODB VOYAGER (estilo limpio) ==========
  async _initProfileMaps() {
    if (typeof L === 'undefined') {
      try {
        await this._loadLeaflet();
      } catch (err) {
        console.warn('Error cargando Leaflet:', err);
        return;
      }
    }
    
    const mapContainers = document.querySelectorAll('.profile-wall-item .route-map');
    for (const container of mapContainers) {
      const wrapper = container.closest('.profile-wall-item');
      if (!wrapper) continue;
      const entryId = wrapper.dataset.entryId;
      if (!entryId) continue;
      
      try {
        const doc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
        if (doc.exists && doc.data().gpsRoute) {
          const gpsRoute = doc.data().gpsRoute;
          if (gpsRoute.points && gpsRoute.points.length >= 2) {
            container.style.height = '200px';
            container.style.width = '100%';
            container.style.display = 'block';
            if (container._leaflet_map) {
              container._leaflet_map.remove();
            }
            
            const latlngs = gpsRoute.points.map(p => [p.lat, p.lng]);
            const map = L.map(container.id, { attributionControl: false });
            const polyline = L.polyline(latlngs, { color: '#C9A96E', weight: 4, opacity: 0.8 }).addTo(map);
            map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
            
            // Capa CartoDB Voyager (limpia, sin números de portal)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
              subdomains: 'abcd',
              maxZoom: 19
            }).addTo(map);
            
            // Marcadores sutiles (grises)
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
            setTimeout(() => { if (map) map.invalidateSize(); }, 100);
          }
        }
      } catch (err) {
        console.warn('Error cargando mapa para entrenamiento', entryId, err);
      }
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
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  // ========== RESTO DE FUNCIONES (modal editar perfil, fotos, etc.) ==========
  abrirModal() {
    this.cargarDatosEnModal();
    this.cargarFotoActual();
    const overlay = document.getElementById('modalEditarPerfilOverlay');
    const modal = document.getElementById('modalEditarPerfil');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
    document.body.classList.add('modal-open');
  },

  cerrarModal() {
    const overlay = document.getElementById('modalEditarPerfilOverlay');
    const modal = document.getElementById('modalEditarPerfil');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  },

  async cargarDatosEnModal() {
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
      const profile = userDoc.data().profile || {};

      const bioInput = document.getElementById('editBio');
      const cityInput = document.getElementById('editCity');
      const ageInput = document.getElementById('editAge');
      const genderSelect = document.getElementById('editGender');
      const weightInput = document.getElementById('editWeight');
      const heightInput = document.getElementById('editHeight');

      if (bioInput) bioInput.value = profile.bio || '';
      if (cityInput) cityInput.value = profile.city || '';
      if (ageInput) ageInput.value = profile.age || '';
      if (genderSelect) genderSelect.value = profile.gender || '';
      if (weightInput) weightInput.value = profile.weight || '';
      if (heightInput) heightInput.value = profile.height || '';
    } catch (error) {
      console.error('Error cargando datos en modal:', error);
      Utils.showToast('Error al cargar datos del perfil', 'error');
    }
  },

  async cargarFotoActual() {
    const container = document.getElementById('currentPhotoPreview');
    if (!container) return;
    const uid = AppState.currentUserId;
    const url = await Storage.getProfilePictureURL(uid);
    if (url) {
      container.innerHTML = `<img src="${Utils.escapeHTML(url)}" style="width:100px; height:100px; border-radius:50%; object-fit:cover;">`;
    } else {
      container.innerHTML = `<div style="width:100px; height:100px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px;">👤</div>`;
    }
  },

  async seleccionarFoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      Utils.showLoading();
      try {
        const compressedFile = await this.compressImageToTarget(file, 1920, 5 * 1024 * 1024);
        const url = await Storage.uploadProfilePicture(AppState.currentUserId, compressedFile);
        if (url) {
          Utils.showToast('✅ Foto actualizada', 'success');
          this.cargarFotoActual();
          await Profile.cargarPerfil();
          if (window.Friends) Friends.cargarListaAmigos();
          if (window.Chat) Chat.updateUnreadBadge();
        }
      } catch (err) {
        console.error(err);
        Utils.showToast('Error al procesar la imagen', 'error');
      } finally {
        Utils.hideLoading();
      }
    };
    input.click();
  },

  async compressImageToTarget(file, maxDimension, maxSizeBytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          let resizedBlob = await this._resizeImage(img, maxDimension, 0.92);
          if (resizedBlob.size <= maxSizeBytes) {
            resolve(new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' }));
            return;
          }
          let qualities = [0.85, 0.8, 0.75, 0.7];
          for (let q of qualities) {
            resizedBlob = await this._resizeImage(img, maxDimension, q);
            if (resizedBlob.size <= maxSizeBytes) {
              resolve(new File([resizedBlob], 'avatar.jpg', { type: 'image/jpeg' }));
              return;
            }
          }
          const finalBlob = await this._resizeImage(img, 1600, 0.7);
          resolve(new File([finalBlob], 'avatar.jpg', { type: 'image/jpeg' }));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  _resizeImage(img, maxDimension, quality) {
    return new Promise((resolve) => {
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  },

  async eliminarFoto() {
    const confirm = await Utils.confirm('Eliminar foto', '¿Eliminar tu foto de perfil?');
    if (!confirm) return;
    Utils.showLoading();
    const ok = await Storage.deleteProfilePicture(AppState.currentUserId);
    Utils.hideLoading();
    if (ok) {
      Utils.showToast('✅ Foto eliminada', 'success');
      this.cargarFotoActual();
      await Profile.cargarPerfil();
      if (window.Friends) Friends.cargarListaAmigos();
      if (window.Chat) Chat.updateUnreadBadge();
    } else {
      Utils.showToast('Error al eliminar foto', 'error');
    }
  },

  compressImage(file) {
    return this.compressImageToTarget(file, 1920, 5 * 1024 * 1024);
  },

  async guardarPerfil() {
    Utils.showLoading();

    try {
      const bio = document.getElementById('editBio')?.value.trim() || '';
      const city = document.getElementById('editCity')?.value.trim() || '';
      const age = parseInt(document.getElementById('editAge')?.value) || null;
      const gender = document.getElementById('editGender')?.value || '';
      const weight = parseFloat(document.getElementById('editWeight')?.value) || null;
      const height = parseFloat(document.getElementById('editHeight')?.value) || null;

      if (age !== null && (age < 14 || age > 85)) {
        Utils.showToast('La edad debe estar entre 14 y 85 años', 'error');
        Utils.hideLoading();
        return;
      }

      const updateData = {
        'profile.bio': bio,
        'profile.city': city,
        'profile.age': age,
        'profile.gender': gender,
        'profile.weight': weight,
        'profile.height': height
      };

      await firebaseServices.db.collection('users').doc(AppState.currentUserId).update(updateData);

      if (AppState.currentUserData) {
        AppState.currentUserData.profile = {
          ...(AppState.currentUserData.profile || {}),
          bio,
          city,
          age,
          gender,
          weight,
          height
        };
      }

      Utils.showToast('✅ Perfil actualizado', 'success');
      await this.cargarPerfil();
      this.cerrarModal();

    } catch (error) {
      console.error('Error guardando perfil:', error);
      Utils.showToast('Error al guardar perfil', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // Funciones de insignias y zapatillas
  async _mostrarModalInsignias() {
    const gamificationData = await Gamification.getData(AppState.currentUserId);
    if (!gamificationData) return;
    
    const earnedBadges = gamificationData.badges || [];
    const allBadgesOrder = [
      'FIRST_SESSION', 'FIRST_WEEK', 'FIRST_MONTH',
      'SESSIONS_10', 'SESSIONS_50',
      'DISTANCE_100', 'DISTANCE_500', 'DISTANCE_1000',
      'LEVEL_5_KM', 'LEVEL_10_KM'
    ];
    
    const earned = [];
    const upcoming = [];
    for (const id of allBadgesOrder) {
      const badge = Gamification.BADGES[id];
      if (badge) {
        if (earnedBadges.includes(id)) {
          earned.push(badge);
        } else {
          upcoming.push(badge);
        }
      }
    }
    
    const existingModal = document.getElementById('badgesModal');
    const existingOverlay = document.getElementById('badgesModalOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'badgesModalOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'badgesModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 500px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    let content = `<h3 style="margin: 0 0 16px 0; text-align: center; color: var(--accent-yellow);">🏅 INSIGNIAS</h3>`;
    
    content += `<div style="margin-bottom: 20px;">
      <div style="font-size: 14px; font-weight: bold; color: var(--accent-blue); margin-bottom: 12px;">✓ Conseguidas (${earned.length})</div>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">`;
    for (const badge of earned) {
      content += `
        <div style="flex: 1; min-width: 140px; background: var(--bg-secondary); border-radius: 16px; padding: 8px; text-align: center;">
          <div style="font-size: 32px;">${badge.icon}</div>
          <div style="font-weight: bold; font-size: 13px;">${badge.name}</div>
          <div style="font-size: 10px; color: var(--text-secondary);">${badge.description}</div>
        </div>
      `;
    }
    content += `</div></div>`;
    
    if (upcoming.length > 0) {
      content += `<div>
        <div style="font-size: 14px; font-weight: bold; color: var(--accent-blue); margin-bottom: 12px;">🔜 Próximas</div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">`;
      for (const badge of upcoming) {
        content += `
          <div style="flex: 1; min-width: 140px; background: var(--bg-secondary); border-radius: 16px; padding: 8px; text-align: center; opacity: 0.8;">
            <div style="font-size: 32px; filter: grayscale(0.3);">${badge.icon}</div>
            <div style="font-weight: bold; font-size: 13px;">${badge.name}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">${badge.description}</div>
          </div>
        `;
      }
      content += `</div></div>`;
    } else {
      content += `<p style="text-align:center; color: var(--text-secondary);">¡Has conseguido todas las insignias! 🎉</p>`;
    }
    
    content += `<div style="display: flex; justify-content: center; margin-top: 24px;">
      <button id="closeBadgesModalBtn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CERRAR</button>
    </div>`;
    
    modal.innerHTML = content;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeBtn = document.getElementById('closeBadgesModalBtn');
    const closeModal = () => overlay.remove();
    if (closeBtn) closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  },

  _mostrarModalCambiarZapatilla() {
    const existingModal = document.getElementById('changeShoeModal');
    const existingOverlay = document.getElementById('changeShoeOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'changeShoeOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'changeShoeModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      text-align: center;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--accent-yellow);">👟 CAMBIAR ZAPATILLA</h3>
      <div style="margin-bottom: 16px;">
        <label style="display: block; text-align: left; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Marca</label>
        <input type="text" id="newShoeBrand" placeholder="Ej. Nike" style="width: 100%; padding: 10px; border-radius: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);">
      </div>
      <div style="margin-bottom: 24px;">
        <label style="display: block; text-align: left; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Modelo</label>
        <input type="text" id="newShoeModel" placeholder="Ej. Pegasus 40" style="width: 100%; padding: 10px; border-radius: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);">
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirmChangeShoe" style="background: var(--accent-blue); border: none; color: var(--bg-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CAMBIAR</button>
        <button id="cancelChangeShoe" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CANCELAR</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const confirmBtn = document.getElementById('confirmChangeShoe');
    const cancelBtn = document.getElementById('cancelChangeShoe');
    const brandInput = document.getElementById('newShoeBrand');
    const modelInput = document.getElementById('newShoeModel');

    const closeModal = () => {
      overlay.remove();
    };

    confirmBtn.onclick = async () => {
      const brand = brandInput.value.trim();
      const model = modelInput.value.trim();
      if (!brand && !model) {
        Utils.showToast('Escribe al menos la marca o el modelo', 'warning');
        return;
      }
      const newName = `${brand} ${model}`.trim();
      if (newName) {
        await Gamification.setCurrentShoe(AppState.currentUserId, newName);
        await Profile.cargarPerfil();
        Utils.showToast('✅ Zapatilla actualizada', 'success');
        closeModal();
      }
    };

    cancelBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  },

  async _mostrarModalHistorial() {
    const history = await Gamification.getShoeHistory(AppState.currentUserId);
    if (!history || history.length === 0) {
      Utils.showToast('No hay historial de zapatillas aún', 'info');
      return;
    }

    const existingModal = document.getElementById('shoeHistoryModal');
    const existingOverlay = document.getElementById('shoeHistoryOverlay');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shoeHistoryOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
      z-index: 30000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'shoeHistoryModal';
    modal.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    let historyHtml = '<h3 style="margin: 0 0 16px 0; text-align: center; color: var(--accent-yellow);">📜 HISTORIAL DE ZAPATILLAS</h3><div style="display: flex; flex-direction: column; gap: 12px;">';
    [...history].reverse().forEach(entry => {
      const date = new Date(entry.changedAt).toLocaleDateString();
      historyHtml += `
        <div style="background: var(--bg-secondary); border-radius: 16px; padding: 12px; border: 1px solid var(--border-color);">
          <div style="font-weight: bold; color: var(--accent-blue);">${Utils.escapeHTML(entry.name)}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">📊 ${entry.km} km acumulados</div>
          <div style="font-size: 11px; color: var(--text-secondary);">🔄 Cambio: ${date}</div>
        </div>
      `;
    });
    historyHtml += '</div><div style="display: flex; justify-content: center; margin-top: 20px;"><button id="closeHistoryModalBtn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 24px; border-radius: 30px; cursor: pointer;">CERRAR</button></div>';
    modal.innerHTML = historyHtml;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('closeHistoryModalBtn');
    const closeModal = () => overlay.remove();
    if (closeBtn) closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  }
};

window.Profile = Profile;