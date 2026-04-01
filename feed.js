const Feed = {
  async cargarFeed() {
    const container = document.getElementById('feedContainer');
    if (!container) return;

    try {
      const snapshot = await firebaseServices.db.collection('globalFeed').get();
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      items.sort((a, b) => {
        const ta = a.timestamp?.toDate?.() || new Date(0);
        const tb = b.timestamp?.toDate?.() || new Date(0);
        return tb - ta;
      });

      const ultimos20 = items.slice(0, 20);

      if (ultimos20.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No hay actividades recientes</p>';
        return;
      }

      let html = '';
      for (const item of ultimos20) {
        const userData = await Storage.getUser(item.userId);
        const username = userData?.username || 'Usuario';
        const usernameFormatted = Utils.capitalizeUsername(username);
        const photoURL = userData?.profile?.photoURL;

        const avatarHTML = photoURL
          ? `<img src="${Utils.escapeHTML(photoURL)}" class="feed-avatar" style="object-fit:cover;">`
          : `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

        let tipoEmoji = '';
        switch (item.trainingType) {
          case 'rodaje': tipoEmoji = '🏃‍♂️'; break;
          case 'tempo': tipoEmoji = '⚡'; break;
          case 'series': tipoEmoji = '🔁'; break;
          case 'largo': tipoEmoji = '📏'; break;
          default: tipoEmoji = '🏃';
        }

        const fecha = item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : 'Fecha desconocida';
        const duracion = item.duration || 0;
        const distancia = item.distancia?.toFixed ? item.distancia.toFixed(2) : (item.distancia || '0');
        const tss = item.tss || 0;

        html += `
          <div class="feed-item">
            ${avatarHTML}
            <div class="feed-contenido">
              <div class="feed-header">
                <span class="feed-nombre">${Utils.escapeHTML(usernameFormatted)}</span>
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
    } catch (error) {
      console.error('Error cargando feed:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar feed</p>';
    }
  }
};

window.Feed = Feed;