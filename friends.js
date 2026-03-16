// ==================== friends.js - Gestión de amigos (SIN FOTO) ====================
// Versión: 2.1 - Mejora en mensajes de error y verificación de índices

const Friends = {
  async buscarUsuarios() {
    const term = document.getElementById('buscarAmigosInput').value.trim();
    const container = document.getElementById('resultadosBusqueda');

    if (term.length < 2) {
      container.innerHTML = '';
      return;
    }

    Utils.showLoading();

    try {
      const result = await Storage.searchUsersByUsername(term, 10);

      if (result.items.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No se encontraron usuarios. Asegúrate de que el nombre esté bien escrito y que los usuarios existen.</p>';
        return;
      }

      let html = '';
      for (const user of result.items) {
        if (user.uid === AppState.currentUserId) continue;

        const esAmigo = AppState.currentUserData?.friendIds?.includes(user.uid);
        const solicitudes = await this.obtenerSolicitudesPendientes(user.uid);
        const solicitudPendiente = solicitudes.some(s => s.from === AppState.currentUserId);

        const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let boton = '';
        if (esAmigo) {
          boton = '<span style="color:var(--zone-2);">✓ Amigo</span>';
        } else if (solicitudPendiente) {
          boton = '<span style="color:var(--accent-yellow);">⏳ Pendiente</span>';
        } else {
          boton = `<button class="action-button" style="width:auto; padding:5px 15px; margin:0;" onclick="Friends.enviarSolicitud('${user.uid}', '${user.username}')">➕ Agregar</button>`;
        }

        html += `
          <div class="resultado-busqueda">
            <div class="resultado-info">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${user.username}</div>
                <div class="resultado-username">@${user.username}</div>
              </div>
            </div>
            <div>
              ${boton}
            </div>
          </div>
        `;
      }

      container.innerHTML = html;

    } catch (error) {
      console.error('Error buscando usuarios:', error);
      // Si el error es de índice, mostrar mensaje específico
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error de configuración: falta un índice en Firestore. Por favor, contacta al administrador.</p>';
      } else {
        container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error en la búsqueda. Inténtalo de nuevo.</p>';
      }
    } finally {
      Utils.hideLoading();
    }
  },

  async obtenerSolicitudesPendientes(uid) {
    try {
      const snapshot = await firebaseServices.db
        .collection('friendRequests')
        .where('from', '==', uid)
        .where('status', '==', 'pending')
        .get();
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error obteniendo solicitudes pendientes:', error);
      return [];
    }
  },

  async enviarSolicitud(toUid, toUsername) {
    if (!AppState.currentUserId) return;

    const confirmed = await Utils.confirm('Enviar solicitud', `¿Enviar solicitud de amistad a ${toUsername}?`);
    if (!confirmed) return;

    Utils.showLoading();

    try {
      const ok = await Storage.sendFriendRequest(AppState.currentUserId, toUid);
      if (ok) {
        Utils.showToast('✅ Solicitud enviada', 'success');
        this.buscarUsuarios();
      } else {
        Utils.showToast('No se pudo enviar la solicitud', 'error');
      }
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      Utils.showToast('Error al enviar solicitud', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async cargarSolicitudes() {
    const container = document.getElementById('listaSolicitudes');
    if (!container || !AppState.currentUserId) return;

    try {
      const solicitudes = await Storage.getFriendRequests(AppState.currentUserId);

      if (solicitudes.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes solicitudes pendientes</p>';
        return;
      }

      let html = '';
      for (const sol of solicitudes) {
        const fromUser = await Storage.getUser(sol.from);
        const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        html += `
          <div class="solicitud-item">
            <div class="resultado-info">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${fromUser?.username || 'Usuario'}</div>
                <div class="resultado-username">@${fromUser?.username || ''}</div>
              </div>
            </div>
            <div class="solicitud-botones">
              <button class="action-button" style="width:auto; padding:5px 15px; margin:0; background:var(--zone-2); border-color:var(--zone-2); color:var(--bg-primary);" onclick="Friends.aceptarSolicitud('${sol.id}', '${sol.from}', '${AppState.currentUserId}')">✓ Aceptar</button>
              <button class="action-button" style="width:auto; padding:5px 15px; margin:0;" onclick="Friends.rechazarSolicitud('${sol.id}')">✗ Rechazar</button>
            </div>
          </div>
        `;
      }

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error de configuración: falta un índice en Firestore para las solicitudes. Por favor, contacta al administrador.</p>';
      } else {
        container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar solicitudes. Inténtalo de nuevo.</p>';
      }
    }
  },

  async aceptarSolicitud(requestId, fromUid, toUid) {
    Utils.showLoading();
    try {
      await Storage.acceptFriendRequest(requestId, fromUid, toUid);
      Utils.showToast('✅ Solicitud aceptada', 'success');
      await this.cargarSolicitudes();
      await this.cargarListaAmigos();
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      Utils.showToast('Error al aceptar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async rechazarSolicitud(requestId) {
    Utils.showLoading();
    try {
      await Storage.rejectFriendRequest(requestId);
      Utils.showToast('Solicitud rechazada', 'info');
      await this.cargarSolicitudes();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      Utils.showToast('Error al rechazar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async cargarListaAmigos() {
    const container = document.getElementById('listaAmigos');
    if (!container || !AppState.currentUserId) return;

    try {
      const amigos = await Storage.getFriends(AppState.currentUserId);

      if (amigos.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Aún no tienes amigos. ¡Busca y añade!</p>';
        return;
      }

      let html = '';
      amigos.forEach(amigo => {
        const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        html += `
          <div class="resultado-busqueda" style="justify-content:space-between;">
            <div class="resultado-info">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${amigo.username}</div>
                <div class="resultado-username">@${amigo.username}</div>
              </div>
            </div>
            <button class="action-button" style="width:auto; padding:5px 15px; margin:0; border-color:var(--zone-5);" onclick="Friends.eliminarAmigo('${amigo.uid}')">✕ Eliminar</button>
          </div>
        `;
      });

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando lista de amigos:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar amigos</p>';
    }
  },

  async eliminarAmigo(friendUid) {
    const confirmed = await Utils.confirm('Eliminar amigo', '¿Eliminar este amigo?');
    if (!confirmed) return;

    Utils.showLoading();
    try {
      await Storage.removeFriend(AppState.currentUserId, friendUid);
      Utils.showToast('✅ Amigo eliminado', 'success');
      await this.cargarListaAmigos();
    } catch (error) {
      console.error('Error eliminando amigo:', error);
      Utils.showToast('Error al eliminar', 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

window.Friends = Friends;