// ==================== feed.js - Feed de entrenamientos de amigos (CON FOTO) ====================
// Versión: 3.8 - Añadidas fotos de perfil
// ====================

const Feed = {
async cargarFeed(marcarLeido = false) {
const container = document.getElementById(‘feedContainer’);
if (!container || !AppState.currentUserId) return;
try {
const { items, noLeidos } = await Storage.getFeed(AppState.currentUserId, 50);
if (items.length === 0) {
container.innerHTML = ‘<p style="text-align:center; padding:20px;">No hay actividades recientes de tus amigos</p>’;
AppState.actualizarNovedadesFeed(0, new Set());
return;
}

```
  // Agrupar UIDs únicos y cargar todos los usuarios en paralelo (evita N lecturas en serie)
  const uniqueUids = [...new Set(items.map(i => i.friendUid).filter(Boolean))];
  const userDocs = await Promise.all(uniqueUids.map(uid => Storage.getUser(uid)));
  const usersMap = {};
  uniqueUids.forEach((uid, idx) => { usersMap[uid] = userDocs[idx]; });

  let html = '';
  for (const item of items) {
    const friendData = usersMap[item.friendUid];
    // Escapar photoURL para evitar inyección en atributos
    const rawURL = friendData?.profile?.photoURL;
    const safeURL = rawURL ? Utils.escapeHTML(rawURL) : null;
    const avatarHTML = safeURL
      ? `<img src="${safeURL}" class="feed-avatar" style="object-fit:cover;" alt="">`
      : `<div class="feed-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;

    let tipoEmoji = '';
    switch (item.trainingType) {
      case 'rodaje':  tipoEmoji = '🏃‍♂️'; break;
      case 'tempo':   tipoEmoji = '⚡';   break;
      case 'series':  tipoEmoji = '🔁';   break;
      case 'largo':   tipoEmoji = '📏';   break;
      case 'strength':tipoEmoji = '💪';   break;
      default:        tipoEmoji = '🏃';
    }

    const fecha      = item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : new Date(item.timestamp).toLocaleDateString();
    const duracion   = item.duration || 0;
    const distancia  = item.distancia?.toFixed ? item.distancia.toFixed(2) : (item.distancia || '0');
    const tss        = item.tss || 0;
    // Escapar datos de usuario antes de insertar en HTML
    const username   = Utils.escapeHTML(Utils.capitalizeUsername(item.friendUsername));
    const tipoStr    = Utils.escapeHTML(item.trainingType?.toUpperCase() || 'ENTRENO');

    html += `
      <div class="feed-item ${!item.leido ? 'feed-item-nuevo' : ''}">
        ${avatarHTML}
        <div class="feed-contenido">
          <div class="feed-header">
            <span class="feed-nombre">${username}</span>
            <span class="feed-fecha">📅 ${fecha}</span>
          </div>
          <div class="feed-entreno">
            <div class="feed-entreno-tipo">${tipoEmoji} ${tipoStr}</div>
            <div class="feed-entreno-detalles">
              <span>⏱️ ${duracion}'</span>
              <span>📏 ${distancia} km</span>
              <span>⚡ ${tss} TSS</span>
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
```

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
console.error(‘Error marcando feed como leído:’, error);
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