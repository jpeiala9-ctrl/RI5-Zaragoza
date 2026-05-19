// ==================== profile.js - PERFIL CON MINI MURO PERSONAL (LIKES SÓLO LECTURA) ====================
// Versión: 5.3 - Añadido margin-bottom a la sección de entrenamientos para separar del botón editar
// ====================

const Profile = {
  async cargarPerfil() {
    const container = document.getElementById('perfilContainer');
    if (!container || !AppState.currentUserId) {
      console.warn('⚠️ cargarPerfil: contenedor no encontrado o usuario no autenticado');
      return;
    }

    try {
      console.log('🔄 Cargando perfil desde Firestore...');
      const userRef = firebaseServices.db.collection('users').doc(AppState.currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      console.log('📄 Datos del perfil obtenidos');

      // Obtener lista de amigos y limpiar huérfanos (mismo código que antes)
      let friendIds = userData.friendIds || [];
      const amigosValidos = [];
      let necesitaActualizacion = false;

      for (const friendId of friendIds) {
        const friendDoc = await firebaseServices.db.collection('users').doc(friendId).get();
        if (friendDoc.exists) {
          amigosValidos.push(friendId);
        } else {
          necesitaActualizacion = true;
          console.warn(`🧹 Amigo fantasma eliminado: ${friendId}`);
        }
      }

      if (necesitaActualizacion) {
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
        bio: '',
        city: '',
        age: null,
        gender: '',
        weight: null,
        height: null,
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

      // ==================== GAMIFICATION ====================
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
          
          html += `
            <div class="gamification-section" style="margin-top:24px; padding:16px; background:var(--bg-secondary); border-radius:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                  <strong style="font-size:20px; ${textStyle}">Nivel ${gamificationData.level}</strong>
                  <div style="font-size:12px;">📏 ${gamificationData.totalDistance.toFixed(1)} km</div>
                </div>
                <div>
                  <strong>🔥 Racha actual: ${gamificationData.currentStreak} días</strong><br>
                  <span style="font-size:12px;">🏆 Racha máxima: ${gamificationData.longestStreak}</span>
                </div>
                <div>
                  <strong>🎯 Sesiones: ${gamificationData.totalSessions}</strong><br>
                  <span style="font-size:12px;">✨ XP: ${gamificationData.totalXP}</span>
                </div>
              </div>
              <div class="level-progress" style="margin-top:12px;">
                <div class="level-progress-fill" style="width: ${progress}%; background: ${levelColor};"></div>
              </div>
              ${badgesHTML ? `<div class="badges-container" style="margin-top:12px;">${badgesHTML}</div>` : '<p style="margin-top:12px; font-size:12px;">Completa entrenamientos para desbloquear insignias</p>'}
            </div>
          `;
        }
      } catch (e) {
        console.warn('Error cargando gamificación en perfil:', e);
      }
      // ============================================================

      // ==================== MIS ÚLTIMOS ENTRENAMIENTOS (COLLAPSABLES + LIKES SÓLO LECTURA) ====================
      try {
        const misEntrenamientosSnapshot = await firebaseServices.db
          .collection('globalFeed')
          .where('userId', '==', AppState.currentUserId)
          .orderBy('timestamp', 'desc')
          .limit(5)
          .get();

        if (!misEntrenamientosSnapshot.empty) {
          let entrenamientosHTML = '<div class="mis-entrenamentos-section" style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:16px; padding:16px;">';
          entrenamientosHTML += '<h3 style="margin-top:0; margin-bottom:16px; text-align:left; font-size:18px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>';
          
          for (const doc of misEntrenamientosSnapshot.docs) {
            const entry = doc.data();
            const entryId = doc.id;
            let fecha = '';
            try {
              if (entry.timestamp) {
                const dateObj = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                fecha = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              }
            } catch (e) {}
            
            const tipoEmoji = {
              rodaje: '🏃‍♂️', tempo: '⚡', series: '🔁', largo: '📏', strength: '💪'
            }[entry.trainingType] || '🏃';
            
            const trainingName = entry.trainingName ? Utils.escapeHTML(entry.trainingName) : Utils.escapeHTML(entry.trainingType).toUpperCase();
            const duracion = entry.duration || 0;
            const distancia = (entry.distancia && isFinite(entry.distancia)) ? entry.distancia.toFixed(2) : '0.00';
            const tss = entry.tss || 0;
            
            // Obtener likes actualizados
            let likeCount = 0;
            try {
              const feedDoc = await firebaseServices.db.collection('globalFeed').doc(entryId).get();
              if (feedDoc.exists) {
                const feedData = feedDoc.data();
                const likes = feedData.likes || [];
                likeCount = likes.length;
              }
            } catch (err) {
              console.warn('Error obteniendo likes para entrada', entryId, err);
            }
            
            entrenamientosHTML += `
              <div class="mis-entreno-wrapper" data-entry-id="${entryId}" style="border-bottom:1px solid var(--border-color); margin-bottom:8px;">
                <!-- CABECERA (colapsable) -->
                <div class="mis-entreno-header" style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; cursor:pointer;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px;">${tipoEmoji}</span>
                    <div>
                      <div style="font-weight:500;">${trainingName}</div>
                      <div style="font-size:12px; color:var(--text-secondary);">${fecha}</div>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:16px;">
                    <span style="font-size:13px;">▶</span>
                  </div>
                </div>
                <!-- CONTENIDO DETALLE (colapsado inicialmente) -->
                <div class="mis-entreno-detalle" style="display:none; padding:0 0 12px 0; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                  <div style="display:flex; gap:16px; font-size:13px; margin-bottom:8px;">
                    <span>⏱️ ${duracion}'</span>
                    <span>📏 ${distancia} km</span>
                    <span>⚡ ${tss} TSS</span>
                  </div>
                  <div class="mis-entreno-likes" style="display:flex; align-items:center; gap:8px;">
                    <button class="like-btn-profile" data-entry-id="${entryId}" style="background:none; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:14px; color:var(--text-secondary);">
                      ❤️ <span class="like-count-profile">${likeCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }
          entrenamientosHTML += '</div>';
          html += entrenamientosHTML;
        } else {
          html += `
            <div style="margin-top:24px; margin-bottom:24px; background:var(--bg-secondary); border-radius:16px; padding:16px; text-align:center;">
              <h3 style="margin-top:0; margin-bottom:8px;">📋 MIS ÚLTIMOS ENTRENAMIENTOS</h3>
              <p style="font-size:14px;">Aún no has compartido ningún entrenamiento.<br>Completa sesiones en la pestaña PLAN y márcalas como realizadas.</p>
            </div>
          `;
        }
      } catch (error) {
        console.warn('Error cargando últimos entrenamientos:', error);
      }
      // ============================================================

      container.innerHTML = html;
      console.log('✅ Perfil renderizado correctamente');

      // ==================== EVENTOS: COLAPSO Y MODAL DE LIKES ====================
      setTimeout(() => {
        // 1. Evento de colapso
        document.querySelectorAll('.mis-entreno-header').forEach(header => {
          header.removeEventListener('click', Profile._toggleEntrenoDetail);
          header.addEventListener('click', Profile._toggleEntrenoDetail);
        });

        // 2. Evento de like (solo modal)
        document.querySelectorAll('.like-btn-profile').forEach(btn => {
          btn.removeEventListener('click', Profile._showLikesModal);
          btn.addEventListener('click', Profile._showLikesModal);
        });
      }, 0);

    } catch (error) {
      console.error('Error cargando perfil:', error);
      if (container) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar perfil</p>';
    }
  },

  // Alterna la visibilidad del detalle del entrenamiento
  _toggleEntrenoDetail(e) {
    e.stopPropagation();
    const wrapper = e.currentTarget.closest('.mis-entreno-wrapper');
    if (!wrapper) return;
    const detailDiv = wrapper.querySelector('.mis-entreno-detalle');
    const toggleIcon = e.currentTarget.querySelector('span:last-child');
    if (detailDiv) {
      const isVisible = detailDiv.style.display !== 'none';
      detailDiv.style.display = isVisible ? 'none' : 'flex';
      if (toggleIcon) toggleIcon.innerHTML = isVisible ? '▶' : '▼';
    }
  },

  // Muestra un modal con la lista de usuarios que dieron like a la publicación
  async _showLikesModal(e) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const entryId = btn.getAttribute('data-entry-id');
    if (!entryId) return;

    try {
      if (typeof Wall !== 'undefined' && Wall.showLikesModal) {
        await Wall.showLikesModal(entryId);
      } else {
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
      }
    } catch (error) {
      console.error('Error al obtener likes:', error);
      Utils.showToast('Error al cargar los likes', 'error');
    }
  },

  // Crea y muestra el modal de likes
  _createLikesModal(users) {
    const existingModal = document.getElementById('likesModalProfile');
    const existingOverlay = document.getElementById('likesModalOverlayProfile');
    if (existingModal) existingModal.remove();
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'likesModalOverlayProfile';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.id = 'likesModalProfile';
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
      <button id="closeLikesModalProfileBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
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
        <button class="view-profile-btn-profile" data-uid="${user.uid}" style="background: var(--zone-2); border: none; padding: 6px 12px; border-radius: 20px; color: var(--bg-primary); cursor: pointer;">Ver perfil</button>
      `;
      userItem.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-profile-btn-profile')) return;
        if (typeof Friends !== 'undefined' && Friends.abrirModalAmigo) {
          Friends.abrirModalAmigo(user.uid);
          this._closeLikesModal();
        }
      });
      const btn = userItem.querySelector('.view-profile-btn-profile');
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

  // El resto de métodos (abrirModal, cerrarModal, cargarDatosEnModal, etc.) se mantienen igual
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