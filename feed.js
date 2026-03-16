// ==================== feed.js - Feed de entrenamientos de amigos (SIN FOTO) ====================

const Feed = {
  async cargarFeed() {
    const container = document.getElementById('feedContainer');
    if (!container || !AppState.currentUserId) return;

    try {
      const feed = await Storage.getFeed(AppState.currentUserId, 30);

      if (feed.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividad reciente de tus amigos</p>';
        return;
      }

      let html = '';
      feed.forEach(item => {
        const fecha = item.trainingDate?.toDate ? item.trainingDate.toDate() : new Date(item.trainingDate);
        const fechaStr = fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Avatar por defecto
        const avatarHTML = `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        if (item.trainingType === 'rodaje') tipoEmoji = '🏃‍♂️';
        else if (item.trainingType === 'tempo') tipoEmoji = '⚡';
        else if (item.trainingType === 'series') tipoEmoji = '🔁';
        else if (item.trainingType === 'largo') tipoEmoji = '📏';
        else tipoEmoji = '🏃';

        html += `
          <div class="feed-item">
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
      });

      container.innerHTML = html;

    } catch (error) {
      console.error('Error cargando feed:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar feed</p>';
    }
  }
};

window.Feed = Feed;