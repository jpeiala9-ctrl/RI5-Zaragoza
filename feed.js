// ==================== feed.js - Feed de entrenamientos de amigos (SIN FOTO) ====================
// Versión: 2.0 - Con notificaciones de actividades no leídas

const Feed = {
  async cargarFeed(marcarComoLeido = true) {
    const container = document.getElementById('feedContainer');
    if (!container || !AppState.currentUserId) return;

    try {
      const { items, noLeidos } = await Storage.getFeed(AppState.currentUserId, 30);

      // Actualizar estado global con el número de no leídos
      const amigosNovedades = new Set();
      items.forEach(item => {
        if (!item.leido) {
          amigosNovedades.add(item.friendUid);
        }
      });
      AppState.actualizarNovedadesFeed(noLeidos, amigosNovedades);

      if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividad reciente de tus amigos</p>';
        return;
      }

      let html = '';
      const idsNoLeidos = []; // para marcar como leídos después

      items.forEach(item => {
        const fecha = item.trainingDate?.toDate ? item.trainingDate.toDate() : new Date(item.trainingDate);
        const fechaStr = fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const avatarHTML = `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        if (item.trainingType === 'rodaje') tipoEmoji = '🏃‍♂️';
        else if (item.trainingType === 'tempo') tipoEmoji = '⚡';
        else if (item.trainingType === 'series') tipoEmoji = '🔁';
        else if (item.trainingType === 'largo') tipoEmoji = '📏';
        else tipoEmoji = '🏃';

        // Clase especial si no está leído
        const noLeidoClass = !item.leido ? 'feed-item-nuevo' : '';

        html += `
          <div class="feed-item ${noLeidoClass}" data-feed-id="${item.id}">
            ${avatarHTML}
            <div class="feed-contenido">
              <div class="feed-header">
                <span class="feed-nombre">${item.friendUsername}</span>
                <span class="feed-fecha">${fechaStr}</span>
              </div>
              <div class="feed-entreno">
                <div class="feed-entreno-tipo">${tipoEmoji} ${item.trainingType?.toUpperCase() || 'ENTRENO'}</div>
                <div class="feed-entreno-detalles">
                  <span>⏱️ ${item.duration}'</span>
                  ${item.distancia ? `<span>📏 ${item.distancia.toFixed(2)} km</span>` : ''}
                  ${item.tss ? `<span>⚡ ${item.tss} TSS</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;

        if (!item.leido) {
          idsNoLeidos.push(item.id);
        }
      });

      container.innerHTML = html;

      // Si se solicita marcar como leído y hay elementos, los marcamos
      if (marcarComoLeido && idsNoLeidos.length > 0) {
        await Storage.marcarFeedComoLeido(AppState.currentUserId, idsNoLeidos);
        // Actualizar estado (quitar badge)
        AppState.actualizarNovedadesFeed(0, new Set());
        // Opcional: quitar la clase de los elementos
        document.querySelectorAll('.feed-item-nuevo').forEach(el => {
          el.classList.remove('feed-item-nuevo');
        });
      }

    } catch (error) {
      console.error('Error cargando feed:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar feed</p>';
    }
  }
};

window.Feed = Feed;