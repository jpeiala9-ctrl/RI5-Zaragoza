// ==================== friends.js - Gestión de amigos (CON LIMPIEZA DE HUÉRFANOS) ====================
// Versión: 3.15 - Al cargar lista de amigos, elimina IDs que ya no existen
// ====================

const Friends = {
  todosUsuariosPagination: { lastDoc: null, hasMore: true, loading: false },

  initEventListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-friend-action]');
      if (!target) return;
      const action = target.getAttribute('data-friend-action');
      const uid = target.getAttribute('data-uid');
      const username = target.getAttribute('data-username');
      const requestId = target.getAttribute('data-request-id');
      if (action === 'agregar' && uid && username) this.enviarSolicitud(uid, username);
      else if (action === 'aceptar' && uid && requestId) this.aceptarSolicitud(requestId, uid, AppState.currentUserId);
      else if (action === 'rechazar' && uid && requestId) this.rechazarSolicitud(requestId);
      else if (action === 'cancelar' && requestId) this.cancelarSolicitud(requestId);
    });

    document.addEventListener('click', (e) => {
      const chatBtn = e.target.closest('.chat-btn');
      if (chatBtn && chatBtn.dataset.uid && chatBtn.dataset.username) {
        e.stopPropagation();
        Chat.startChatWithFriend(chatBtn.dataset.uid, chatBtn.dataset.username);
        return;
      }
      const deleteBtn = e.target.closest('.delete-friend-btn');
      if (deleteBtn && deleteBtn.dataset.uid) {
        e.stopPropagation();
        this.eliminarAmigo(deleteBtn.dataset.uid);
        return;
      }
    });
  },

  async obtenerSolicitudesPendientes() {
    if (!AppState.currentUserId) return { enviadas: [], recibidas: [] };
    try {
      const [enviadasSnap, recibidasSnap] = await Promise.all([
        firebaseServices.db.collection('friendRequests').where('from', '==', AppState.currentUserId).where('status', '==', 'pending').get(),
        firebaseServices.db.collection('friendRequests').where('to', '==', AppState.currentUserId).where('status', '==', 'pending').get()
      ]);
      const enviadas = enviadasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const recibidas = recibidasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`📊 [Friends] Solicitudes pendientes: Enviadas=${enviadas.length}, Recibidas=${recibidas.length}`);
      return { enviadas, recibidas };
    } catch (error) { 
      console.error('Error obteniendo solicitudes pendientes:', error); 
      return { enviadas: [], recibidas: [] }; 
    }
  },

  async cargarSolicitudes(tipo) {
    const containerId = tipo === 'recibidas' ? 'listaSolicitudesRecibidas' : 'listaSolicitudesEnviadas';
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ [Friends] No se encontró el contenedor con id="${containerId}". Verifica tu HTML.`);
      return;
    }
    if (!AppState.currentUserId) return;
    try {
      const { recibidas, enviadas } = await this.obtenerSolicitudesPendientes();
      const solicitudes = tipo === 'recibidas' ? recibidas : enviadas;
      if (solicitudes.length === 0) { 
        container.innerHTML = `<p style="text-align:center; padding:20px;">No tienes solicitudes ${tipo === 'recibidas' ? 'pendientes' : 'enviadas'}</p>`; 
        return; 
      }
      let html = '';
      for (const sol of solicitudes) {
        const otroUid = tipo === 'recibidas' ? sol.from : sol.to;
        const otroUser = await Storage.getUser(otroUid);
        const usernameFormatted = Utils.capitalizeUsername(otroUser?.username || 'Usuario');
        const userTag = otroUser?.username ? `@${Utils.escapeHTML(otroUser.username)}` : 'cuenta no disponible';
        const photoURL = otroUser?.profile?.photoURL;
        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="resultado-avatar" style="object-fit:cover;">`
          : `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
        let botones = '';
        if (tipo === 'recibidas') {
          botones = `<button class="btn-amigo" data-friend-action="aceptar" data-request-id="${sol.id}" data-uid="${sol.from}" data-username="${Utils.escapeHTML(usernameFormatted)}" style="background:var(--zone-2); border-color:var(--zone-2); color:var(--bg-primary);">✓ Aceptar</button>
                     <button class="btn-amigo eliminar" data-friend-action="rechazar" data-request-id="${sol.id}" data-uid="${sol.from}">✗ Rechazar</button>`;
        } else {
          botones = `<button class="btn-amigo eliminar" data-friend-action="cancelar" data-request-id="${sol.id}" data-uid="${sol.to}">✖️ Cancelar</button>`;
        }
        html += `
          <div class="solicitud-item">
            <div class="resultado-info" data-uid="${otroUid}" onclick="Friends.abrirModalAmigo('${otroUid}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="resultado-username">${Utils.escapeHTML(userTag)}</div>
              </div>
            </div>
            <div class="solicitud-botones">${botones}</div>
          </div>
        `;
      }
      container.innerHTML = html;
    } catch (error) { 
      console.error(`Error cargando solicitudes ${tipo}:`, error); 
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar solicitudes. Inténtalo de nuevo.</p>'; 
    }
  },

  cargarSolicitudesRecibidas() { this.cargarSolicitudes('recibidas'); },
  cargarSolicitudesEnviadas() { this.cargarSolicitudes('enviadas'); },

  async enviarSolicitud(toUid, toUsername) {
    if (!AppState.currentUserId) return;
    if (!toUid || typeof toUid !== 'string' || toUid === 'undefined' || toUid === 'null' || toUid.trim() === '') {
      console.error('❌ Destinatario inválido:', toUid);
      Utils.showToast('Error: destinatario no válido', 'error');
      return;
    }
    const confirmed = await Utils.confirm('Enviar solicitud', `¿Enviar solicitud de amistad a ${Utils.escapeHTML(toUsername)}?`);
    if (!confirmed) return;
    try {
      console.log('📤 Enviando solicitud de', AppState.currentUserId, 'a', toUid);
      const ok = await Storage.sendFriendRequest(AppState.currentUserId, toUid);
      if (ok) {
        Utils.showToast('✅ Solicitud enviada', 'success');
        await this.cargarTodosUsuarios(true);
        await this.cargarSolicitudesEnviadas();
        const term = document.getElementById('buscarAmigosInput')?.value.trim();
        if (term && term.length >= 2) await this.buscarUsuarios();
      } else Utils.showToast('No se pudo enviar la solicitud', 'error');
    } catch (error) { console.error('Error enviando solicitud:', error); Utils.showToast('Error al enviar solicitud', 'error'); }
  },

  async _refreshCurrentUserData() {
    if (!AppState.currentUserId) return;
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(AppState.currentUserId).get();
      if (userDoc.exists) {
        const newData = userDoc.data();
        AppState.currentUserData = newData;
        const { recibidas } = await this.obtenerSolicitudesPendientes();
        AppState.solicitudesPendientesCount = recibidas.length;
        AppState.actualizarBadgeSolicitudes();
      }
    } catch (error) {
      console.error('Error refrescando datos de usuario:', error);
    }
  },

  // ==================== ACEPTAR SOLICITUD (con creación de conversación) ====================
  async aceptarSolicitud(requestId, fromUid, toUid) {
    try {
      // 1. Aceptar la solicitud de amistad (actualiza friendIds)
      await Storage.acceptFriendRequest(requestId, fromUid, toUid);
      Utils.showToast('✅ Solicitud aceptada', 'success');
      
      // 2. Crear la conversación entre ambos (si no existe)
      const conversationId = [fromUid, toUid].sort().join('_');
      const convRef = firebaseServices.db.collection('conversations').doc(conversationId);
      const convDoc = await convRef.get();
      if (!convDoc.exists) {
        // Obtener datos de ambos usuarios para participantsData
        const [userData, friendData] = await Promise.all([
          Storage.getUser(fromUid).catch(() => ({ username: 'Usuario', profile: {} })),
          Storage.getUser(toUid).catch(() => ({ username: 'Amigo', profile: {} }))
        ]);
        const participantsData = {
          [fromUid]: { username: userData.username || 'Usuario', photoURL: userData.profile?.photoURL || null },
          [toUid]: { username: friendData.username || 'Amigo', photoURL: friendData.profile?.photoURL || null }
        };
        await convRef.set({
          participants: [fromUid, toUid],
          participantsData: participantsData,
          lastMessage: '',
          lastUpdated: firebaseServices.Timestamp.now(),
          created: firebaseServices.Timestamp.now()
        });
        console.log('✅ Conversación creada al aceptar amistad:', conversationId);
      } else {
        console.log('📌 Conversación ya existente:', conversationId);
      }
      
      // 3. Refrescar vistas
      await this._refreshCurrentUserData();
      await this.cargarSolicitudesRecibidas();
      await this.cargarListaAmigos();
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      Utils.showToast('Error al aceptar', 'error');
    }
  },
  // ====================================================================================

  async rechazarSolicitud(requestId) {
    try {
      await Storage.rejectFriendRequest(requestId);
      Utils.showToast('Solicitud rechazada', 'info');
      await this.cargarSolicitudesRecibidas();
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
    } catch (error) { console.error('Error rechazando solicitud:', error); Utils.showToast('Error al rechazar', 'error'); }
  },

  async cancelarSolicitud(requestId) {
    const confirmed = await Utils.confirm('Cancelar solicitud', '¿Cancelar esta solicitud de amistad?');
    if (!confirmed) return;
    try {
      await firebaseServices.db.collection('friendRequests').doc(requestId).update({ status: 'cancelled' });
      Utils.showToast('✅ Solicitud cancelada', 'success');
      await this.cargarTodosUsuarios(true);
      await this.actualizarBadgeSolicitudes();
      await this.cargarSolicitudesEnviadas();
      const term = document.getElementById('buscarAmigosInput')?.value.trim();
      if (term && term.length >= 2) await this.buscarUsuarios();
    } catch (error) { 
      console.error('Error cancelando solicitud:', error); 
      if (error.code === 'not-found') { 
        Utils.showToast('La solicitud ya no existe', 'info'); 
        await this.cargarTodosUsuarios(true); 
        await this.actualizarBadgeSolicitudes();
        await this.cargarSolicitudesEnviadas();
      } else Utils.showToast('Error al cancelar: ' + (error.message || 'desconocido'), 'error'); 
    }
  },

  async cargarListaAmigos() {
    const container = document.getElementById('listaAmigos');
    if (!container || !AppState.currentUserId) return;
    
    try {
      const userRef = firebaseServices.db.collection('users').doc(AppState.currentUserId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      const friendIds = userData.friendIds || [];
      
      if (friendIds.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Aún no tienes amigos. ¡Busca y añade!</p>';
        return;
      }
      
      // Verificar cada amigo y limpiar huérfanos
      const amigosValidos = [];
      let necesitaActualizacion = false;
      
      const snapshots = await Promise.all(
        friendIds.map(fid => firebaseServices.db.collection('users').doc(fid).get())
      );
      
      const amigos = [];
      for (let i = 0; i < friendIds.length; i++) {
        const doc = snapshots[i];
        const fid = friendIds[i];
        if (doc.exists) {
          amigosValidos.push(fid);
          amigos.push({ uid: fid, ...doc.data() });
        } else {
          necesitaActualizacion = true;
          console.warn(`🧹 Amigo fantasma eliminado: ${fid}`);
        }
      }
      
      // Si hay huérfanos, actualizar Firestore
      if (necesitaActualizacion) {
        await userRef.update({
          friendIds: amigosValidos,
          friendsCount: amigosValidos.length
        });
        // Actualizar también el estado local para que el perfil lo refleje
        if (AppState.currentUserData) {
          AppState.currentUserData.friendIds = amigosValidos;
          AppState.currentUserData.friendsCount = amigosValidos.length;
        }
      }
      
      // Renderizar la lista de amigos válidos
      let html = '';
      for (const amigo of amigos) {
        const photoURL = amigo.profile?.photoURL;
        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="resultado-avatar" style="object-fit:cover;">`
          : `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
        const usernameFormatted = Utils.capitalizeUsername(amigo.username);
        html += `
          <div class="resultado-busqueda" style="justify-content:space-between;">
            <div class="resultado-info" data-uid="${amigo.uid}" onclick="Friends.abrirModalAmigo('${amigo.uid}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="resultado-username">@${Utils.escapeHTML(amigo.username)}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn-amigo chat-btn" data-uid="${amigo.uid}" data-username="${Utils.escapeHTML(usernameFormatted)}">💬 CHAT</button>
              <button class="btn-amigo eliminar delete-friend-btn" data-uid="${amigo.uid}">✕</button>
            </div>
          </div>
        `;
      }
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Error cargando lista de amigos:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar amigos</p>';
    }
  },

  async eliminarAmigo(friendUid) {
    const confirmed = await Utils.confirm('Eliminar amigo', '¿Eliminar este amigo?');
    if (!confirmed) return;
    try {
      await Storage.removeFriend(AppState.currentUserId, friendUid);
      Utils.showToast('✅ Amigo eliminado', 'success');
      await this._refreshCurrentUserData();
      await this.cargarListaAmigos();
      await this.cargarTodosUsuarios(true);
    } catch (error) { console.error('Error eliminando amigo:', error); Utils.showToast('Error al eliminar', 'error'); }
  },

  async abrirModalAmigo(uid) {
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) { Utils.showToast('Usuario no encontrado', 'error'); return; }
      const userData = userDoc.data();
      const profile = userData.profile || {};
      const escape = Utils.escapeHTML;
      const age = profile.age ? escape(profile.age + ' años') : '—';
      const gender = profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : profile.gender === 'other' ? 'Otro' : '—';
      const bio = profile.bio ? escape(profile.bio) : 'Sin biografía';
      const city = profile.city ? escape(profile.city) : '—';
      const weight = profile.weight ? escape(profile.weight + ' kg') : '—';
      const height = profile.height ? escape(profile.height + ' cm') : '—';
      const usernameFormatted = Utils.capitalizeUsername(userData.username);
      const photoURL = profile.photoURL;
      const avatarHTML = photoURL
        ? `<img src="${escape(photoURL)}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin-bottom:10px;">`
        : `<div style="width:80px; height:80px; background:var(--bg-secondary); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px; margin:0 auto 10px auto;">👤</div>`;
      const contenido = `
        ${avatarHTML}
        <div style="margin-bottom:16px;">
          <div style="font-size:24px; color:var(--accent-yellow);">${escape(usernameFormatted)}</div>
          <div style="font-size:14px; color:var(--text-secondary);">@${escape(userData.username)}</div>
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
    } catch (error) { console.error('Error cargando perfil de amigo:', error); Utils.showToast('Error al cargar perfil', 'error'); }
  },

  cerrarModalAmigo() {
    document.getElementById('modalAmigoOverlay').style.display = 'none';
    document.getElementById('modalAmigo').style.display = 'none';
  },

  async cargarTodosUsuarios(reset = false) {
    const container = document.getElementById('todosUsuariosList');
    if (!container) return;
    if (this.todosUsuariosPagination.loading) return;
    this.todosUsuariosPagination.loading = true;
    if (reset) { container.innerHTML = '<div style="text-align:center; padding:20px;">Cargando usuarios...</div>'; this.todosUsuariosPagination.lastDoc = null; this.todosUsuariosPagination.hasMore = true; }
    try {
      if (!AppState.currentUserData?.friendIds) await this._refreshCurrentUserData();
      const friendIds = AppState.currentUserData?.friendIds || [];
      const { enviadas, recibidas } = await this.obtenerSolicitudesPendientes();
      const result = await Storage.getAllUsers(20, reset ? null : this.todosUsuariosPagination.lastDoc);
      if (reset) container.innerHTML = '';
      if (result.users.length === 0) { if (reset) container.innerHTML = '<p style="text-align:center; padding:20px;">No hay más usuarios</p>'; this.todosUsuariosPagination.hasMore = false; this.todosUsuariosPagination.loading = false; const loadMoreBtn = document.getElementById('cargarMasUsuariosBtn'); if (loadMoreBtn) loadMoreBtn.style.display = 'none'; return; }
      this.todosUsuariosPagination.lastDoc = result.lastDoc;
      this.todosUsuariosPagination.hasMore = result.users.length === 20;
      let html = '';
      for (const user of result.users) {
        if (user.uid === AppState.currentUserId) continue;
        if (friendIds.includes(user.uid)) continue;
        const solicitudEnviada = enviadas.some(s => s.to === user.uid);
        const solicitudRecibida = recibidas.some(s => s.from === user.uid);
        const solicitudPendiente = solicitudEnviada || solicitudRecibida;
        let solicitudId = null;
        if (solicitudEnviada) solicitudId = enviadas.find(s => s.to === user.uid)?.id;
        if (solicitudRecibida) solicitudId = recibidas.find(s => s.from === user.uid)?.id;
        const photoURL = user.profile?.photoURL;
        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="resultado-avatar" style="object-fit:cover;">`
          : `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
        const usernameFormatted = Utils.capitalizeUsername(user.username);
        let boton = '';
        if (solicitudPendiente) {
          if (solicitudEnviada) boton = `<button class="btn-amigo" data-friend-action="cancelar" data-request-id="${solicitudId}" data-uid="${user.uid}">✖️ Cancelar</button>`;
          else boton = `<button class="btn-amigo" data-friend-action="aceptar" data-request-id="${solicitudId}" data-uid="${user.uid}" data-username="${usernameFormatted}">✓ Aceptar</button>
                        <button class="btn-amigo eliminar" data-friend-action="rechazar" data-request-id="${solicitudId}" data-uid="${user.uid}">✗ Rechazar</button>`;
        } else boton = `<button class="btn-amigo" data-friend-action="agregar" data-uid="${user.uid}" data-username="${usernameFormatted}">➕ Agregar</button>`;
        html += `
          <div class="resultado-busqueda">
            <div class="resultado-info" data-uid="${user.uid}" onclick="Friends.abrirModalAmigo('${user.uid}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="resultado-username">@${Utils.escapeHTML(user.username)}</div>
              </div>
            </div>
            <div>${boton}</div>
          </div>
        `;
      }
      container.innerHTML += html;
      const loadMoreBtn = document.getElementById('cargarMasUsuariosBtn');
      if (loadMoreBtn) loadMoreBtn.style.display = this.todosUsuariosPagination.hasMore ? 'block' : 'none';
    } catch (error) { console.error('Error cargando todos los usuarios:', error); if (reset) container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar</p>'; }
    finally { this.todosUsuariosPagination.loading = false; }
  },

  cargarMasTodosUsuarios() { this.cargarTodosUsuarios(false); },

  async actualizarBadgeSolicitudes() {
    if (!AppState.currentUserId) return;
    try {
      const { recibidas } = await this.obtenerSolicitudesPendientes();
      const count = recibidas.length;
      AppState.solicitudesPendientesCount = count;
      AppState.actualizarBadgeSolicitudes();
    } catch (error) { console.error('Error actualizando badge solicitudes:', error); }
  },

  async buscarUsuarios() {
    const term = document.getElementById('buscarAmigosInput')?.value.trim();
    const container = document.getElementById('resultadosBusqueda');
    if (!container) return;
    if (term.length < 2) { container.innerHTML = ''; return; }
    try {
      if (!AppState.currentUserData?.friendIds) await this._refreshCurrentUserData();
      const friendIds = AppState.currentUserData?.friendIds || [];
      const result = await Storage.searchUsersByUsername(term, 10);
      if (result.items.length === 0) { container.innerHTML = '<p style="text-align:center; padding:20px;">No se encontraron usuarios</p>'; return; }
      const { enviadas, recibidas } = await this.obtenerSolicitudesPendientes();
      let html = '';
      for (const user of result.items) {
        if (user.uid === AppState.currentUserId) continue;
        const esAmigo = friendIds.includes(user.uid);
        const solicitudEnviada = enviadas.some(s => s.to === user.uid);
        const solicitudRecibida = recibidas.some(s => s.from === user.uid);
        const solicitudPendiente = solicitudEnviada || solicitudRecibida;
        let solicitudId = null;
        if (solicitudEnviada) solicitudId = enviadas.find(s => s.to === user.uid)?.id;
        if (solicitudRecibida) solicitudId = recibidas.find(s => s.from === user.uid)?.id;
        const photoURL = user.profile?.photoURL;
        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="resultado-avatar" style="object-fit:cover;">`
          : `<div class="resultado-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
        const usernameFormatted = Utils.capitalizeUsername(user.username);
        let boton = '';
        if (esAmigo) boton = '<span style="color:var(--zone-2);">✓ Amigo</span>';
        else if (solicitudPendiente) {
          if (solicitudEnviada) boton = `<button class="btn-amigo" data-friend-action="cancelar" data-request-id="${solicitudId}" data-uid="${user.uid}">✖️ Cancelar</button>`;
          else boton = `<button class="btn-amigo" data-friend-action="aceptar" data-request-id="${solicitudId}" data-uid="${user.uid}" data-username="${usernameFormatted}">✓ Aceptar</button>
                       <button class="btn-amigo eliminar" data-friend-action="rechazar" data-request-id="${solicitudId}" data-uid="${user.uid}">✗ Rechazar</button>`;
        } else boton = `<button class="btn-amigo" data-friend-action="agregar" data-uid="${user.uid}" data-username="${usernameFormatted}">➕ Agregar</button>`;
        html += `
          <div class="resultado-busqueda">
            <div class="resultado-info" data-uid="${user.uid}" onclick="Friends.abrirModalAmigo('${user.uid}')">
              ${avatarHTML}
              <div>
                <div class="resultado-nombre">${Utils.escapeHTML(usernameFormatted)}</div>
                <div class="resultado-username">@${Utils.escapeHTML(user.username)}</div>
              </div>
            </div>
            <div>${boton}</div>
          </div>
        `;
      }
      container.innerHTML = html;
    } catch (error) { console.error('Error buscando usuarios:', error); container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error en la búsqueda. Inténtalo de nuevo.</p>'; }
  }
};

document.addEventListener('DOMContentLoaded', () => { Friends.initEventListeners(); });
window.Friends = Friends;