// ==================== profile.js - PERFIL CON TARJETAS REDISEÑADAS (MIS ENTRENAMIENTOS) ====================
// Versión: 6.1 - Mejorada la apariencia de las tarjetas de entrenamiento sin cambiar funcionalidad.
// ====================

const Profile = {
  async cargarPerfil() {
    const container = document.getElementById('perfilContainer');
    if (!container || !AppState.currentUserId) {
      console.warn('⚠️ cargarPerfil: contenedor no encontrado o usuario no autenticado');
      return;
    }

    const cacheKey = `perfil_${AppState.currentUserId}`;
    const cached = localStorage.getItem(cacheKey);
    let htmlCache = null;

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

    try {
      console.time('cargarPerfil');
      console.log('🔄 Cargando perfil desde Firestore...');
      const userRef = firebaseServices.db.collection('users').doc(AppState.currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      // Limpieza de amigos huérfanos (optimizada)
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

      // Gamificación (con zapatilla)
      try {
        const gamificationData = await Gamification.getData(AppState.currentUserId);
        if (gamificationData) {
          const progress = Gamification.getProgressToNextLevel(gamificationData.totalDistance);
          const levelColor = Gamification.getColorByLevel(gamificationData.level);
          const textStyle = `color: ${levelColor};`;
          const badgesHTML = (gamificationData.badges || []).map(badgeId => {
            const badge = Gamification.BADGES[badgeId];
            if (!badge) return '';
            return `<span class="badge" title="${badge.description}">${badge.icon} ${badge.name}</span>`;
          }).filter(b => b).join('');
          
          const shoe = await Gamification.getCurrentShoe(AppState.currentUserId);
          const shoeName = shoe.name || 'Zapatilla actual';
          const shoeKm = (shoe.km || 0).toFixed(1);
          
          html += `
            <div class="gamification-section" style="margin-top:24px; padding:16px; background:var(--bg-secondary); border-radius:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div><strong style="font-size:20px; ${textStyle}">Nivel ${gamificationData.level}</strong><div style="font-size:12px;">📏 ${gamificationData.totalDistance.toFixed(1)} km</div></div>
                <div><strong>👟 ${Utils.escapeHTML(shoeName)}</strong><br><span style="font-size:12px;">📊 ${shoeKm} km</span></div>
                <div><strong>🎯 Sesiones: ${gamificationData.totalSessions}</strong><br><span style="font-size:12px;">✨ XP: ${gamificationData.totalXP}</span></div>
              </div>
              <div class="level-progress" style="margin-top:12px;"><div class="level-progress-fill" style="width: ${progress}%; background: ${levelColor};"></div></div>
              ${badgesHTML ? `<div class="badges-container" style="margin-top:12px;">${badgesHTML}</div>` : '<p style="margin-top:12px; font-size:12px;">Completa entrenamientos para desbloquear insignias</p>'}
              <button id="changeShoeBtn" style="margin-top:12px; background:transparent; border:1px solid var(--border-color); color:var(--text-primary); padding:6px 12px; border-radius:20px; font-size:12px; cursor:pointer;">👟 Cambiar zapatilla</button>
            </div>
          `;
        }
      } catch (e) { console.warn(e); }

      // ========== SECCIÓN "MIS ÚLTIMOS ENTRENAMIENTOS" REDISEÑADA ==========
      try {
        const misEntrenamientosSnapshot = await firebaseServices.db
          .collection('globalFeed')
          .where('userId', '==', AppState.currentUserId)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get();

        if (!misEntrenamientosSnapshot.empty) {
          let entrenamientosHTML = `
            <div style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:20px; padding:16px;">
              <h3 style="margin:0 0 16px 0; text-align:left; font-size:18px; font-weight:600; color:var(--accent-yellow);">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>
              <div style="display:flex; flex-direction:column; gap:12px;">
          `;
          
          for (const doc of misEntrenamientosSnapshot.docs) {
            const entry = doc.data();
            const entryId = doc.id;
            let fecha = '';
            let hora = '';
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
            
            let likeCount = 0;
            try {
              const feedDoc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
              if (feedDoc.exists) likeCount = (feedDoc.data().likes || []).length;
            } catch (err) {}
            
            entrenamientosHTML += `
              <div class="mis-entreno-wrapper" data-entry-id="${entryId}" style="background:var(--bg-card); border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05); transition:box-shadow 0.2s;">
                <div class="mis-entreno-header" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; background:var(--bg-card);">
                  <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    <div style="width:44px; height:44px; background:var(--bg-secondary); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px;">${tipoEmoji}</div>
                    <div style="flex:1;">
                      <div style="font-weight:600; font-size:15px;">${trainingName}</div>
                      <div style="font-size:12px; color:var(--text-secondary);">${fecha} · ${hora}</div>
                    </div>
                  </div>
                  <div style="color:var(--text-secondary); font-size:14px;">▼</div>
                </div>
                <div class="mis-entreno-detalle" style="display:none; padding:12px 16px 16px 16px; background:var(--bg-secondary); border-top:1px solid var(--border-color);">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
                    <div style="display:flex; gap:16px; font-size:14px;">
                      <span>⏱️ ${duracion}'</span>
                      <span>📏 ${distancia} km</span>
                      <span>⚡ ${tss} TSS</span>
                    </div>
                    <button class="like-btn-profile" data-entry-id="${entryId}" style="background:transparent; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-size:14px; padding:6px 12px; border-radius:30px; transition:background 0.2s; color:var(--text-secondary);">
                      ❤️ <span class="like-count-profile">${likeCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }
          entrenamientosHTML += `</div></div>`;
          html += entrenamientosHTML;
        } else {
          html += `
            <div style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:20px; padding:20px; text-align:center;">
              <h3 style="margin:0 0 8px 0; font-size:18px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>
              <p style="font-size:14px; color:var(--text-secondary);">Aún no has compartido ningún entrenamiento.<br>Completa sesiones en la pestaña PLAN y márcalas como realizadas.</p>
            </div>
          `;
        }
      } catch (error) { console.warn(error); }

      container.innerHTML = html;
      console.timeEnd('cargarPerfil');

      localStorage.setItem(cacheKey, JSON.stringify({ html, timestamp: Date.now() }));

      setTimeout(() => {
        document.querySelectorAll('.mis-entreno-header').forEach(header => {
          header.removeEventListener('click', Profile._toggleEntrenoDetail);
          header.addEventListener('click', Profile._toggleEntrenoDetail);
        });
        document.querySelectorAll('.like-btn-profile').forEach(btn => {
          btn.removeEventListener('click', Profile._showLikesModal);
          btn.addEventListener('click', Profile._showLikesModal);
        });
        
        const changeBtn = document.getElementById('changeShoeBtn');
        if (changeBtn) {
          changeBtn.onclick = async () => {
            const currentShoe = await Gamification.getCurrentShoe(AppState.currentUserId);
            const currentName = currentShoe.name || 'Zapatilla actual';
            const newName = prompt('Nombre de la nueva zapatilla:', currentName);
            if (newName && newName.trim()) {
              await Gamification.setCurrentShoe(AppState.currentUserId, newName.trim());
              await Profile.cargarPerfil();
              Utils.showToast('✅ Zapatilla actualizada', 'success');
            }
          };
        }
      }, 0);

    } catch (error) {
      console.error('Error cargando perfil:', error);
      if (container && !htmlCache) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar perfil</p>';
    }
  },

  _toggleEntrenoDetail(e) {
    e.stopPropagation();
    const wrapper = e.currentTarget.closest('.mis-entreno-wrapper');
    if (!wrapper) return;
    const detailDiv = wrapper.querySelector('.mis-entreno-detalle');
    const toggleIcon = e.currentTarget.querySelector('div:last-child');
    if (detailDiv) {
      const isVisible = detailDiv.style.display !== 'none';
      detailDiv.style.display = isVisible ? 'none' : 'block';
      if (toggleIcon) toggleIcon.innerHTML = isVisible ? '▼' : '▲';
    }
  },

  async _showLikesModal(e) {
    e.stopPropagation();
    const entryId = e.currentTarget.getAttribute('data-entry-id');
    if (!entryId) return;
    try {
      if (typeof Wall !== 'undefined' && Wall.showLikesModal) {
        await Wall.showLikesModal(entryId);
      } else {
        const doc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
        if (!doc.exists) { Utils.showToast('La publicación ya no existe', 'error'); return; }
        const likes = doc.data().likes || [];
        if (likes.length === 0) { Utils.showToast('Nadie ha dado like a esta publicación aún', 'info'); return; }
        const usersData = [];
        for (const uid of likes) {
          const userData = await Storage.getUser(uid);
          usersData.push(userData ? { uid, ...userData } : { uid, username: 'Usuario desconocido', profile: {} });
        }
        this._createLikesModal(usersData);
      }
    } catch (error) { console.error(error); Utils.showToast('Error al cargar los likes', 'error'); }
  },

  _createLikesModal(users) {
    const existingModal = document.getElementById('likesModalProfile');
    const existingOverlay = document.getElementById('likesModalOverlayProfile');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlayProfile';
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:2000; display:flex; align-items:center; justify-content:center;`;
    const modal = document.createElement('div');
    modal.id = 'likesModalProfile';
    modal.style.cssText = `background:var(--bg-primary); border-radius:24px; max-width:500px; width:90%; max-height:80vh; overflow-y:auto; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--border-color);`;
    modal.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid var(--border-color);"><h3 style="margin:0; color:var(--accent-yellow);">❤️ Me gusta (${users.length})</h3><button id="closeLikesModalProfileBtn" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-secondary);">&times;</button></div><div id="likesListProfile"></div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const listContainer = modal.querySelector('#likesListProfile');
    listContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
    for (const user of users) {
      const photoURL = user.profile?.photoURL;
      const avatarHTML = photoURL ? `<img src="${Utils.escapeHTML(photoURL)}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">` : `<div style="width:48px; height:48px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">👤</div>`;
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:8px; border-radius:16px; background:var(--bg-secondary); cursor:pointer;';
      div.innerHTML = `${avatarHTML}<div style="flex:1;"><div style="font-weight:bold; color:var(--accent-yellow);">${Utils.escapeHTML(Utils.capitalizeUsername(user.username))}</div><div style="font-size:12px; color:var(--text-secondary);">@${Utils.escapeHTML(user.username)}</div></div><button class="view-profile-btn-profile" data-uid="${user.uid}" style="background:var(--zone-2); border:none; padding:6px 12px; border-radius:20px; color:var(--bg-primary); cursor:pointer;">Ver perfil</button>`;
      div.addEventListener('click', (e) => { if (!e.target.classList.contains('view-profile-btn-profile')) { Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); } });
      div.querySelector('.view-profile-btn-profile')?.addEventListener('click', (e) => { e.stopPropagation(); Friends?.abrirModalAmigo(user.uid); this._closeLikesModal(); });
      listContainer.appendChild(div);
    }
    document.getElementById('closeLikesModalProfileBtn')?.addEventListener('click', () => this._closeLikesModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeLikesModal(); });
  },

  _closeLikesModal() {
    document.getElementById('likesModalProfile')?.remove();
    document.getElementById('likesModalOverlayProfile')?.remove();
  },

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
      if (file.size > 2 * 1024 * 1024) {
        Utils.showToast('La imagen no debe exceder 2 MB', 'error');
        return;
      }
      const processedFile = await this.compressImage(file);
      Utils.showLoading();
      const url = await Storage.uploadProfilePicture(AppState.currentUserId, processedFile);
      Utils.hideLoading();
      if (url) {
        Utils.showToast('✅ Foto actualizada', 'success');
        this.cargarFotoActual();
        await Profile.cargarPerfil();
        if (window.Friends) Friends.cargarListaAmigos();
        if (window.Chat) Chat.updateUnreadBadge();
      }
    };
    input.click();
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
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = 500;
          let height = 500;
          let canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
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
  }
};

window.Profile = Profile;