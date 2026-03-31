// ==================== feed.js - Feed de entrenamientos de amigos (CON FOTO Y SEGURIDAD XSS) ====================
// Versión: 4.0 - Añadido listener en tiempo real para nuevas actividades
// ====================

const Feed = {
  unsubscribeFeed: null, // para detener el listener
  listenerActivo: false,

  // --- Listener en tiempo real para nuevas actividades en el feed ---
  iniciarListenerFeed() {
    if (!AppState.currentUserId) return;
    if (this.listenerActivo) return;
    this.listenerActivo = true;

    this.unsubscribeFeed = firebaseServices.db
      .collection('users')
      .doc(AppState.currentUserId)
      .collection('feed')
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        // Contar los documentos no leídos
        const noLeidos = snapshot.docs.filter(doc => !doc.data().leido).length;
        AppState.actualizarNovedadesFeed(noLeidos, new Set());

        // Si la pestaña de amigos/feed está activa, refrescamos la vista
        if (document.getElementById('amigos-feed')?.classList.contains('active')) {
          this.cargarFeed(false);
        }
      }, (error) => {
        console.warn('Error en listener del feed:', error);
      });
  },

  detenerListenerFeed() {
    if (this.unsubscribeFeed) {
      this.unsubscribeFeed();
      this.unsubscribeFeed = null;
    }
    this.listenerActivo = false;
  },
  // ------------------------------------------------

  async cargarFeed(marcarLeido = false) {
    const container = document.getElementById('feedContainer');
    if (!container || !AppState.currentUserId) return;
    try {
      const { items, noLeidos } = await Storage.getFeed(AppState.currentUserId, 50);
      if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividades recientes de tus amigos</p>';
        AppState.actualizarNovedadesFeed(0, new Set());
        return;
      }
      let html = '';
      for (const item of items) {
        const friendData = await Storage.getUser(item.friendUid);
        const photoURL = friendData?.profile?.photoURL;
        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="feed-avatar" style="object-fit:cover;">`
          : `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
        let tipoEmoji = '';
        switch (item.trainingType) {
          case 'rodaje': tipoEmoji = '🏃‍♂️'; break;
          case 'tempo': tipoEmoji = '⚡'; break;
          case 'series': tipoEmoji = '🔁'; break;
          case 'largo': tipoEmoji = '📏'; break;
          case 'strength': tipoEmoji = '💪'; break;
          default: tipoEmoji = '🏃';
        }
        const fecha = item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : new Date(item.timestamp).toLocaleDateString();
        const duracion = item.duration || 0;
        const distancia = item.distancia?.toFixed ? item.distancia.toFixed(2) : (item.distancia || '0');
        const tss = item.tss || 0;
        const friendUsernameFormatted = Utils.capitalizeUsername(item.friendUsername);
        html += `
          <div class="feed-item ${!item.leido ? 'feed-item-nuevo' : ''}">
            ${avatarHTML}
            <div class="feed-contenido">
              <div class="feed-header">
                <span class="feed-nombre">${Utils.escapeHTML(friendUsernameFormatted)}</span>
                <span class="feed-fecha">📅 ${Utils.escapeHTML(fecha)}</span>
              </div>
              <div class="feed-entreno">
                <div class="feed-entreno-tipo">${tipoEmoji} ${Utils.escapeHTML(item.trainingType?.toUpperCase() || 'ENTRENO')}</div>
                <div class="feed-entreno-detalles">
                  <span>⏱️ ${Utils.escapeHTML(duracion)}'</span>
                  <span>📏 ${Utils.escapeHTML(distancia)} km</span>
                  <span>⚡ ${Utils.escapeHTML(tss)} TSS</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      container.innerHTML = html;
      if (marcarLeido) await this.marcarTodoLeido();
      AppState.actualizarNovedadesFeed(noLeidos, new Set());
    } catch (error) {
      console.error('Error cargando feed:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar feed</p>';
      AppState.actualizarNovedadesFeed(0, new Set());
    }
  },

  async marcarTodoLeido() {
    if (!AppState.currentUserId) return;
    try {
      const feedItems = await Storage.getFeed(AppState.currentUserId, 100);
      const noLeidos = feedItems.items.filter(item => !item.leido);
      if (noLeidos.length > 0) {
        const ids = noLeidos.map(item => item.id);
        await Storage.marcarFeedComoLeido(AppState.currentUserId, ids);
      }
      AppState.actualizarNovedadesFeed(0, new Set());
    } catch (error) {
      console.error('Error marcando feed como leído:', error);
    }
  },

  buscarSesionPorFecha(sesiones, fechaInicio, fechaObjetivo) {
    if (!sesiones || !Array.isArray(sesiones)) return null;
    const inicioUTC = Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate());
    const objetivoUTC = Date.UTC(fechaObjetivo.getUTCFullYear(), fechaObjetivo.getUTCMonth(), fechaObjetivo.getUTCDate());
    const diffDays = Math.floor((objetivoUTC - inicioUTC) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays >= sesiones.length) return null;
    return sesiones[diffDays];
  }
};

// Inicializar el listener si ya hay un usuario logueado (esto ocurre cuando se carga el módulo después del login)
if (AppState && AppState.currentUserId) {
  Feed.iniciarListenerFeed();
}

window.Feed = Feed;