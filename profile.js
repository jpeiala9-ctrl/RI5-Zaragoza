// ==================== profile.js - Gestión de perfil de usuario (SIN FOTO) ====================

const Profile = {
  async cargarPerfil() {
    const container = document.getElementById('perfilContainer');
    if (!container || !AppState.currentUserId) return;

    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
      const userData = userDoc.data();

      const profile = userData.profile || {
        bio: '',
        city: '',
        birthDate: null,
        gender: '',
        weight: null,
        height: null,
        privacySettings: { showTrainings: 'friends', showProfile: 'public' }
      };

      // Avatar por defecto (siempre el mismo, sin foto)
      const photoHTML = `<div class="perfil-avatar-placeholder">👤</div>`;

      const birthDate = profile.birthDate ? new Date(profile.birthDate).toLocaleDateString() : '—';
      const gender = profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : profile.gender === 'other' ? 'Otro' : '—';

      let html = `
        <div class="perfil-header">
          ${photoHTML}
          <div class="perfil-info">
            <div class="perfil-nombre">${userData.username}</div>
            <div class="perfil-username">@${userData.username}</div>
            <div class="perfil-stats">
              <div class="perfil-stat"><span>${userData.friendsCount || 0}</span><label>Amigos</label></div>
              <div class="perfil-stat"><span>${userData.calculosMes || 0}</span><label>Cálculos/mes</label></div>
              <div class="perfil-stat"><span>${userData.premium ? 'PREMIUM' : 'GRATIS'}</span><label>Plan</label></div>
            </div>
          </div>
        </div>
        <div class="perfil-detalle-grid">
          <div class="perfil-detalle-item"><span class="label">BIO</span><span class="value">${profile.bio || '—'}</span></div>
          <div class="perfil-detalle-item"><span class="label">CIUDAD</span><span class="value">${profile.city || '—'}</span></div>
          <div class="perfil-detalle-item"><span class="label">CUMPLEAÑOS</span><span class="value">${birthDate}</span></div>
          <div class="perfil-detalle-item"><span class="label">GÉNERO</span><span class="value">${gender}</span></div>
          <div class="perfil-detalle-item"><span class="label">PESO</span><span class="value">${profile.weight ? profile.weight + ' kg' : '—'}</span></div>
          <div class="perfil-detalle-item"><span class="label">ALTURA</span><span class="value">${profile.height ? profile.height + ' cm' : '—'}</span></div>
        </div>
      `;

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando perfil:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar perfil</p>';
    }
  },

  abrirModal() {
    if (!AppState.currentUserId) return;
    this.cargarDatosEnModal();
    document.getElementById('modalEditarPerfil').style.display = 'block';
    document.getElementById('modalEditarPerfilOverlay').style.display = 'block';
  },

  cerrarModal() {
    document.getElementById('modalEditarPerfil').style.display = 'none';
    document.getElementById('modalEditarPerfilOverlay').style.display = 'none';
  },

  async cargarDatosEnModal() {
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
      const profile = userDoc.data().profile || {};

      document.getElementById('editBio').value = profile.bio || '';
      document.getElementById('editCity').value = profile.city || '';
      document.getElementById('editBirthDate').value = profile.birthDate ? profile.birthDate.split('T')[0] : '';
      document.getElementById('editGender').value = profile.gender || '';
      document.getElementById('editWeight').value = profile.weight || '';
      document.getElementById('editHeight').value = profile.height || '';
      // No hay campo de foto
    } catch (error) {
      console.error('Error cargando datos en modal:', error);
    }
  },

  async guardarPerfil() {
    Utils.showLoading();

    try {
      const bio = document.getElementById('editBio').value.trim();
      const city = document.getElementById('editCity').value.trim();
      const birthDate = document.getElementById('editBirthDate').value;
      const gender = document.getElementById('editGender').value;
      const weight = parseFloat(document.getElementById('editWeight').value) || null;
      const height = parseFloat(document.getElementById('editHeight').value) || null;

      const updateData = {
        'profile.bio': bio,
        'profile.city': city,
        'profile.birthDate': birthDate || null,
        'profile.gender': gender,
        'profile.weight': weight,
        'profile.height': height
      };

      await firebaseServices.db.collection('users').doc(AppState.currentUserId).update(updateData);

      Utils.showToast('✅ Perfil actualizado', 'success');
      this.cerrarModal();
      await this.cargarPerfil();

    } catch (error) {
      console.error('Error guardando perfil:', error);
      Utils.showToast('Error al guardar perfil', 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

window.Profile = Profile;