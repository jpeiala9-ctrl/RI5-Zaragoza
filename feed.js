// ==================== feed.js - Feed de entrenamientos de amigos (SIN FOTO) ====================
// Versión: 3.6 - Eliminado badge de novedades (solo solicitudes de amistad generan badge)
// ====================

const Feed = {
  async cargarFeed(marcarLeido = false) {
    const container = document.getElementById('feedContainer');
    if (!container || !AppState.currentUserId) return;

    try {
      const amigos = await Storage.getFriends(AppState.currentUserId);

      if (amigos.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes amigos para mostrar feed</p>';
        AppState.actualizarNovedadesFeed(0, new Set());
        return;
      }

      const mananaUTC = new Date();
      mananaUTC.setUTCHours(0, 0, 0, 0);
      mananaUTC.setUTCDate(mananaUTC.getUTCDate() + 1);
      const mananaUTCms = mananaUTC.getTime();

      // Obtener todos los planes en paralelo
      const promesasPlanes = amigos.map(amigo => Storage.getUltimoPlan(amigo.uid));
      const planes = await Promise.all(promesasPlanes);

      let actividades = [];
      for (let i = 0; i < amigos.length; i++) {
        const amigo = amigos[i];
        const ultimoPlan = planes[i];
        if (!ultimoPlan || !ultimoPlan.sesiones) continue;

        let fechaInicio;
        if (ultimoPlan.params?.fechaInicio) {
          fechaInicio = new Date(ultimoPlan.params.fechaInicio);
        } else {
          console.warn(`Plan de ${amigo.username} sin fechaInicio, no se puede calcular feed.`);
          continue;
        }
        if (isNaN(fechaInicio)) continue;

        const inicioUTC = Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate());
        const diffDays = Math.floor((mananaUTCms - inicioUTC) / (1000 * 60 * 60 * 24));

        if (diffDays < 0 || diffDays >= ultimoPlan.sesiones.length) continue;

        const sesionManana = ultimoPlan.sesiones[diffDays];
        if (!sesionManana) continue;

        actividades.push({ amigo, sesion: sesionManana, fecha: mananaUTC });
      }

      actividades.sort((a, b) => a.amigo.username.localeCompare(b.amigo.username));

      if (actividades.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividades programadas para mañana</p>';
        AppState.actualizarNovedadesFeed(0, new Set());
        return;
      }

      let html = '';
      actividades.forEach(item => {
        const { amigo, sesion, fecha } = item;
        const avatarHTML = `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        if (sesion.tipo === 'rodaje') tipoEmoji = '🏃‍♂️';
        else if (sesion.tipo === 'tempo') tipoEmoji = '⚡';
        else if (sesion.tipo === 'series') tipoEmoji = '🔁';
        else if (sesion.tipo === 'largo') tipoEmoji = '📏';
        else tipoEmoji = '🏃';

        const fechaStr = fecha.toLocaleDateString();
        const duracion = sesion.duracion || 0;
        
        // Calcular métricas reales
        const metricas = PlanGenerator.calcularMetricasSesion(sesion);
        const distancia = metricas.distanciaTotal.toFixed(2);
        const tss = metricas.tssTotal;

        html += `
          <div class="feed-item">
            ${avatarHTML}
            <div class="feed-contenido">
              <div class="feed-header">
                <span class="feed-nombre">${Utils.capitalizeUsername(amigo.username)}</span>
                <span class="feed-fecha">📅 ${fechaStr}</span>
              </div>
              <div class="feed-entreno">
                <div class="feed-entreno-tipo">${tipoEmoji} ${sesion.tipo?.toUpperCase() || 'ENTRENO'}</div>
                <div class="feed-entreno-detalles">
                  <span>⏱️ ${duracion}'</span>
                  <span>📏 ${distancia} km</span>
                  <span>⚡ ${tss} TSS</span>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // ===== MODIFICACIÓN: Solo se marca como leído si se pide, pero no se actualiza badge =====
      // El badge de novedades se gestiona exclusivamente con solicitudes de amistad (friends.js)
      if (marcarLeido) {
        await this.marcarTodoLeido();
      }
      // NOTA: Ya no se llama a AppState.actualizarNovedadesFeed para evitar badge por actividades

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

window.Feed = Feed;