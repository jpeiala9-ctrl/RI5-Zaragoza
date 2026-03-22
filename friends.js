// ==================== friends.js - Gestión de amigos (SIN FOTO) ====================
// Versión: 3.1 - Correcciones en cancelación y solicitudes enviadas
// ====================

const Friends = {
  todosUsuariosPagination: { lastDoc: null, hasMore: true, loading: false },

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
        container.innerHTML = '<p style="text-align:center; padding:20px;">No se encontraron usuarios</p>';
        return;
      }

      let html = '';
      for (const user of result.items) {
        if (user.uid === AppState.currentUserId) continue;

        const esAmigo = AppState.currentUserData?.friendIds?.includes(user.uid);
        
        // Verificar solicitudes en ambos sentidos
        const solicitudesEnviadas = await this.obtenerSolicitudesPendientes(user.uid, 'from', AppState.currentUserId);
        const solicitudesRecibidas = await this.obtenerSolicitudesPendientes(user.uid, 'to', AppState.currentUserId);
        const solicitudPendiente = solicitudesEnviadas.length > 0 || solicitudesRecibidas.length > 0;
        let solicitudId = null;
        if (solicitudesEnviadas.length) solicitudId = solicitudesEnviadas[0].id;
        if (solicitudesRecibidas.length) solicitudId = solicitudesRecibidas[0].id;

        const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let boton = '';
        if (esAmigo) {
          boton = '<span style="color:var(--zone-2);">✓ Amigo</span>';
        } else if (solicitudPendiente) {
          if (solicitudesEnviadas.length) {
            boton = `<button class="btn-amigo" onclick="Friends.cancelarSolicitud('${solicitudId}')">✖️ Cancelar</button>`;
          } else {
            boton = `<button class="btn-amigo" onclick="Friends.aceptarSolicitud('${solicitudId}', '${user.uid}', '${AppState.currentUserId}')">✓ Aceptar</button>
                     <button class="btn-amigo eliminar" onclick="Friends.rechazarSolicitud('${solicitudId}')">✗ Rechazar</button>`;
          }
        } else {
          boton = `<button class="btn-amigo" onclick="Friends.enviarSolicitud('${user.uid}', '${user.username}')">➕ Agregar</button>`;
        }

        html += `
          <div class="resultado-busqueda">
            <div class="resultado-info" onclick="Friends.abrirModalAmigo('${user.uid}')">
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
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error en la búsqueda. Inténtalo de nuevo.</p>';
    } finally {
      Utils.hideLoading();
    }
  },

  async obtenerSolicitudesPendientes(uid, campo, valor) {
    try {
      const snapshot = await firebaseServices.db
        .collection('friendRequests')
        .where(campo, '==', valor)
        .where('status', '==', 'pending')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        await this.cargarTodosUsuarios(true);
        const term = document.getElementById('buscarAmigosInput').value.trim();
        if (term.length >= 2) await this.buscarUsuarios();
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

  async cargarSolicitudesRecibidas() {
    const container = document.getElementById('listaSolicitudesRecibidas');
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
            <div class="resultado-info" onclick="Friends.abrirModalAmigo('${sol.from}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${fromUser?.username || 'Usuario'}</div>
                <div class="resultado-username">@${fromUser?.username || ''}</div>
              </div>
            </div>
            <div class="solicitud-botones">
              <button class="btn-amigo" style="background:var(--zone-2); border-color:var(--zone-2); color:var(--bg-primary);" onclick="Friends.aceptarSolicitud('${sol.id}', '${sol.from}', '${AppState.currentUserId}')">✓ Aceptar</button>
              <button class="btn-amigo eliminar" onclick="Friends.rechazarSolicitud('${sol.id}')">✗ Rechazar</button>
            </div>
          </div>
        `;
      }

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar solicitudes. Inténtalo de nuevo.</p>';
    }
  },

  async aceptarSolicitud(requestId, fromUid, toUid) {
    Utils.showLoading();
    try {
      await Storage.acceptFriendRequest(requestId, fromUid, toUid);
      Utils.showToast('✅ Solicitud aceptada', 'success');
      await this.cargarSolicitudesRecibidas();
      await this.cargarListaAmigos();
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
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
      await this.cargarSolicitudesRecibidas();
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      Utils.showToast('Error al rechazar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async cancelarSolicitud(requestId) {
    const confirmed = await Utils.confirm('Cancelar solicitud', '¿Cancelar esta solicitud de amistad?');
    if (!confirmed) return;
    Utils.showLoading();
    try {
      // Actualizar estado a 'cancelled' en lugar de eliminar
      await firebaseServices.db.collection('friendRequests').doc(requestId).update({
        status: 'cancelled'
      });
      Utils.showToast('✅ Solicitud cancelada', 'success');
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
      const term = document.getElementById('buscarAmigosInput').value.trim();
      if (term.length >= 2) await this.buscarUsuarios();
      // Recargar lista de solicitudes enviadas si está visible
      const enviadasDiv = document.getElementById('listaSolicitudesEnviadas');
      if (enviadasDiv && enviadasDiv.style.display === 'block') {
        await this.cargarSolicitudesEnviadas();
      }
    } catch (error) {
      console.error('Error cancelando solicitud:', error);
      if (error.code === 'not-found') {
        Utils.showToast('La solicitud ya no existe', 'info');
        await this.cargarTodosUsuarios(true);
        await this.actualizarBadgeSolicitudes();
      } else {
        Utils.showToast('Error al cancelar: ' + (error.message || 'desconocido'), 'error');
      }
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

        const tieneNovedades = AppState.amigosConNovedades?.has(amigo.uid);
        const nombreClass = tieneNovedades ? 'amigo-nuevo' : '';

        html += `
          <div class="resultado-busqueda" style="justify-content:space-between;">
            <div class="resultado-info" onclick="Friends.abrirModalAmigo('${amigo.uid}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre ${nombreClass}">${amigo.username}</div>
                <div class="resultado-username">@${amigo.username}</div>
              </div>
            </div>
            <button class="btn-amigo eliminar" onclick="event.stopPropagation(); Friends.eliminarAmigo('${amigo.uid}')">✕ Eliminar</button>
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
      await this.cargarTodosUsuarios(true);
    } catch (error) {
      console.error('Error eliminando amigo:', error);
      Utils.showToast('Error al eliminar', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async abrirModalAmigo(uid) {
    Utils.showLoading();
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        Utils.showToast('Usuario no encontrado', 'error');
        return;
      }
      const userData = userDoc.data();
      const profile = userData.profile || {};

      const age = profile.age ? profile.age + ' años' : '—';
      const gender = profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : profile.gender === 'other' ? 'Otro' : '—';
      const bio = profile.bio || 'Sin biografía';
      const city = profile.city || '—';
      const weight = profile.weight ? profile.weight + ' kg' : '—';
      const height = profile.height ? profile.height + ' cm' : '—';

      const contenido = `
        <div style="margin-bottom:16px;">
          <div style="font-size:24px; color:var(--accent-yellow);">${userData.username}</div>
          <div style="font-size:14px; color:var(--text-secondary);">@${userData.username}</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:left;">
          <div><strong>Bio:</strong> ${bio}</div>
          <div><strong>Ciudad:</strong> ${city}</div>
          <div><strong>Edad:</strong> ${age}</div>
          <div><strong>Género:</strong> ${gender}</div>
          <div><strong>Peso:</strong> ${weight}</div>
          <div><strong>Altura:</strong> ${height}</div>
        </div>
      `;
      document.getElementById('modalAmigoContenido').innerHTML = contenido;
      document.getElementById('modalAmigoOverlay').style.display = 'block';
      document.getElementById('modalAmigo').style.display = 'block';
    } catch (error) {
      console.error('Error cargando perfil de amigo:', error);
      Utils.showToast('Error al cargar perfil', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  cerrarModalAmigo() {
    document.getElementById('modalAmigoOverlay').style.display = 'none';
    document.getElementById('modalAmigo').style.display = 'none';
  },

  // NUEVAS FUNCIONES PARA EXPLORAR TODOS LOS USUARIOS
  async cargarTodosUsuarios(reset = false) {
    const container = document.getElementById('todosUsuariosList');
    if (!container) return;
    if (this.todosUsuariosPagination.loading) return;
    this.todosUsuariosPagination.loading = true;

    if (reset) {
      container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando...</div>';
      this.todosUsuariosPagination.lastDoc = null;
      this.todosUsuariosPagination.hasMore = true;
    }

    try {
      const result = await Storage.getAllUsers(20, reset ? null : this.todosUsuariosPagination.lastDoc);
      if (reset) container.innerHTML = '';

      if (result.users.length === 0) {
        if (reset) container.innerHTML = '<p style="text-align:center; padding:20px;">No hay más usuarios</p>';
        this.todosUsuariosPagination.hasMore = false;
        this.todosUsuariosPagination.loading = false;
        const loadMoreBtn = document.getElementById('cargarMasUsuariosBtn');
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      this.todosUsuariosPagination.lastDoc = result.lastDoc;
      this.todosUsuariosPagination.hasMore = result.users.length === 20;

      let html = '';
      for (const user of result.users) {
        if (user.uid === AppState.currentUserId) continue;
        if (AppState.currentUserData?.friendIds?.includes(user.uid)) continue;

        // Verificar si ya hay solicitud pendiente
        const solicitudesEnviadas = await this.obtenerSolicitudesPendientes(user.uid, 'from', AppState.currentUserId);
        const solicitudesRecibidas = await this.obtenerSolicitudesPendientes(user.uid, 'to', AppState.currentUserId);
        const solicitudPendiente = solicitudesEnviadas.length > 0 || solicitudesRecibidas.length > 0;
        let solicitudId = null;
        if (solicitudesEnviadas.length) solicitudId = solicitudesEnviadas[0].id;
        if (solicitudesRecibidas.length) solicitudId = solicitudesRecibidas[0].id;

        const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let boton = '';
        if (solicitudPendiente) {
          if (solicitudesEnviadas.length) {
            boton = `<button class="btn-amigo" onclick="Friends.cancelarSolicitud('${solicitudId}')">✖️ Cancelar</button>`;
          } else {
            boton = `<button class="btn-amigo" onclick="Friends.aceptarSolicitud('${solicitudId}', '${user.uid}', '${AppState.currentUserId}')">✓ Aceptar</button>
                     <button class="btn-amigo eliminar" onclick="Friends.rechazarSolicitud('${solicitudId}')">✗ Rechazar</button>`;
          }
        } else {
          boton = `<button class="btn-amigo" onclick="Friends.enviarSolicitud('${user.uid}', '${user.username}')">➕ Agregar</button>`;
        }

        html += `
          <div class="resultado-busqueda">
            <div class="resultado-info" onclick="Friends.abrirModalAmigo('${user.uid}')">
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

      container.innerHTML += html;
      const loadMoreBtn = document.getElementById('cargarMasUsuariosBtn');
      if (loadMoreBtn) loadMoreBtn.style.display = this.todosUsuariosPagination.hasMore ? 'block' : 'none';

    } catch (error) {
      console.error('Error cargando todos los usuarios:', error);
      if (reset) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar</p>';
    } finally {
      this.todosUsuariosPagination.loading = false;
    }
  },

  cargarMasTodosUsuarios() {
    this.cargarTodosUsuarios(false);
  },

  async actualizarBadgeSolicitudes() {
    if (!AppState.currentUserId) return;
    try {
      const solicitudes = await Storage.getFriendRequests(AppState.currentUserId);
      const count = solicitudes.length;
      AppState.solicitudesPendientesCount = count;
      AppState.actualizarBadgeSolicitudes();
    } catch (error) {
      console.error('Error actualizando badge solicitudes:', error);
    }
  },

  async cargarSolicitudesEnviadas() {
    const container = document.getElementById('listaSolicitudesEnviadas');
    if (!container || !AppState.currentUserId) return;

    try {
      const snapshot = await firebaseServices.db
        .collection('friendRequests')
        .where('from', '==', AppState.currentUserId)
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .get();
      
      const solicitudes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (solicitudes.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes solicitudes enviadas pendientes</p>';
        return;
      }
      
      let html = '';
      for (const sol of solicitudes) {
        try {
          const toUser = await Storage.getUser(sol.to);
          const avatarHTML = `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
          const username = toUser?.username || 'Usuario desconocido';
          const userTag = toUser?.username ? `@${toUser.username}` : 'cuenta no disponible';
          
          html += `
            <div class="solicitud-item">
              <div class="resultado-info" onclick="Friends.abrirModalAmigo('${sol.to}')">
                ${avatarHTML}
                <div>
                  <div class="resultado-nombre">${username}</div>
                  <div class="resultado-username">${userTag}</div>
                </div>
              </div>
              <div class="solicitud-botones">
                <button class="btn-amigo eliminar" onclick="Friends.cancelarSolicitud('${sol.id}')">✖️ Cancelar</button>
              </div>
            </div>
          `;
        } catch (err) {
          console.warn(`Error obteniendo usuario ${sol.to}:`, err);
          // Mostrar entrada con "usuario no disponible"
          html += `
            <div class="solicitud-item">
              <div class="resultado-info">
                <div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>
                <div>
                  <div class="resultado-nombre">Usuario no disponible</div>
                  <div class="resultado-username">(posiblemente eliminado)</div>
                </div>
              </div>
              <div class="solicitud-botones">
                <button class="btn-amigo eliminar" onclick="Friends.cancelarSolicitud('${sol.id}')">✖️ Cancelar</button>
              </div>
            </div>
          `;
        }
      }
      
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Error cargando solicitudes enviadas:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar</p>';
    }
  }
};

window.Friends = Friends;