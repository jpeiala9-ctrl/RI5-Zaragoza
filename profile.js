// ==================== profile.js - Gestión de perfil de usuario (SIN FOTO) ====================
// Versión: 2.3 - Corregido doble notificación al guardar

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
        age: null,
        gender: '',
        weight: null,
        height: null,
        privacySettings: { showTrainings: 'friends', showProfile: 'public' }
      };

      const photoHTML = `<div class="perfil-avatar-placeholder">👤</div>`;

      const age = profile.age ? profile.age + ' años' : '—';
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
          <div class="perfil-detalle-item"><span class="label">EDAD</span><span class="value">${age}</span></div>
          <div class="perfil-detalle-item"><span class="label">GÉNERO</span><span class="value">${gender}</span></div>
          <div class="perfil-detalle-item"><span class="label">PESO</span><span class="value">${profile.weight ? profile.weight + ' kg' : '—'}</span></div>
          <div class="perfil-detalle-item"><span class="label">ALTURA</span><span class="value">${profile.height ? profile.height + ' cm' : '—'}</span></div>
        </div>
      `;

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando perfil:', error);
      // No mostramos toast para evitar doble notificación
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
      document.getElementById('editAge').value = profile.age || '';
      document.getElementById('editGender').value = profile.gender || '';
      document.getElementById('editWeight').value = profile.weight || '';
      document.getElementById('editHeight').value = profile.height || '';
    } catch (error) {
      console.error('Error cargando datos en modal:', error);
    }
  },

  async guardarPerfil() {
    Utils.showLoading();

    try {
      const bio = document.getElementById('editBio').value.trim();
      const city = document.getElementById('editCity').value.trim();
      const age = parseInt(document.getElementById('editAge').value) || null;
      const gender = document.getElementById('editGender').value;
      const weight = parseFloat(document.getElementById('editWeight').value) || null;
      const height = parseFloat(document.getElementById('editHeight').value) || null;

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

      Utils.showToast('✅ Perfil actualizado', 'success');
      this.cerrarModal();
      await this.cargarPerfil(); // Si falla, no muestra toast, solo error en consola

    } catch (error) {
      console.error('Error guardando perfil:', error);
      Utils.showToast('Error al guardar perfil', 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

window.Profile = Profile;