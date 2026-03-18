// ==================== feed.js - Feed de entrenamientos de amigos (SIN FOTO) ====================
// Versión: 3.0 - Muestra la sesión programada para mañana de cada amigo

const Feed = {
  async cargarFeed() {
    const container = document.getElementById('feedContainer');
    if (!container || !AppState.currentUserId) return;

    try {
      // Obtener lista de amigos del usuario actual
      const amigos = await Storage.getFriends(AppState.currentUserId);

      if (amigos.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes amigos para mostrar feed</p>';
        return;
      }

      // Fecha de mañana (inicio del día)
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(0, 0, 0, 0);

      let html = '';
      let actividades = [];

      // Para cada amigo, obtener su último plan y buscar la sesión de mañana
      for (const amigo of amigos) {
        const ultimoPlan = await Storage.getUltimoPlan(amigo.uid);
        if (!ultimoPlan || !ultimoPlan.sesiones) continue;

        // Obtener fecha de inicio del plan
        const fechaInicio = new Date(ultimoPlan.params?.fechaInicio);
        if (isNaN(fechaInicio)) continue;

        // Buscar la sesión correspondiente a mañana
        const sesionManana = this.buscarSesionPorFecha(ultimoPlan.sesiones, fechaInicio, manana);
        if (!sesionManana) continue;

        // Calcular días hasta la fecha (opcional, para ordenar)
        const diasDiff = Math.floor((manana - fechaInicio) / (1000 * 60 * 60 * 24));

        actividades.push({
          amigo,
          sesion: sesionManana,
          fecha: manana,
          diasDiff
        });
      }

      // Ordenar por amigo (alfabético) o por fecha (ya todas son mañana)
      actividades.sort((a, b) => a.amigo.username.localeCompare(b.amigo.username));

      if (actividades.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividades programadas para mañana</p>';
        return;
      }

      // Generar HTML
      actividades.forEach(item => {
        const amigo = item.amigo;
        const sesion = item.sesion;

        const avatarHTML = `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        if (sesion.tipo === 'rodaje') tipoEmoji = '🏃‍♂️';
        else if (sesion.tipo === 'tempo') tipoEmoji = '⚡';
        else if (sesion.tipo === 'series') tipoEmoji = '🔁';
        else if (sesion.tipo === 'largo') tipoEmoji = '📏';
        else tipoEmoji = '🏃';

        // Formatear fecha (mañana)
        const fechaStr = manana.toLocaleDateString();

        // Detalles de la sesión
        const duracion = sesion.duracion || 0;
        const distancia = sesion.detalle?.distanciaTotal?.toFixed(2) || '?';
        const tss = sesion.detalle?.tssTotal || 0;

        html += `
          <div class="feed-item">
            ${avatarHTML}
            <div class="feed-contenido">
              <div class="feed-header">
                <span class="feed-nombre">${amigo.username}</span>
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

    } catch (error) {
      console.error('Error cargando feed:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar feed</p>';
    }
  },

  // Busca la sesión de un plan que corresponda a una fecha dada
  buscarSesionPorFecha(sesiones, fechaInicio, fechaObjetivo) {
    if (!sesiones || !Array.isArray(sesiones)) return null;

    // Calcular el índice del día (0-based) desde la fecha de inicio
    const diffTime = fechaObjetivo - fechaInicio;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || diffDays >= sesiones.length) return null;

    return sesiones[diffDays];
  }
};

window.Feed = Feed;