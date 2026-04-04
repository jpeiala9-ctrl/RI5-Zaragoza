// ==================== wall.js - Muro global de entrenamientos (con likes en tiempo real) ====================
// Versión: 1.2 - Fix: escapeHTML con números, render blindado contra datos corruptos
// ====================

const Wall = {
unsubscribe: null,
lastDoc: null,
hasMore: true,
loading: false,

// Iniciar listener en tiempo real
initListener() {
if (this.unsubscribe) this.unsubscribe();

```
const query = firebaseServices.db
  .collection('globalFeed')
  .orderBy('timestamp', 'desc')
  .limit(20);

// Escuchar cambios
this.unsubscribe = query.onSnapshot((snapshot) => {
  const entries = [];
  snapshot.forEach(doc => {
    entries.push({ id: doc.id, ...doc.data() });
  });
  this.render(entries);
}, (error) => {
  console.error('Error en listener del muro:', error);
  Utils.showToast('Error al cargar el muro en tiempo real', 'error');
  // Intentar carga manual una vez
  this.cargarManual();
});
```

},

// Carga manual (para cuando el listener falla)
async cargarManual() {
try {
const snapshot = await firebaseServices.db
.collection(‘globalFeed’)
.orderBy(‘timestamp’, ‘desc’)
.limit(20)
.get();
const entries = snapshot.docs.map(doc => ({ id: doc.id, …doc.data() }));
this.render(entries);
} catch (error) {
console.error(‘Error en carga manual:’, error);
const container = document.getElementById(‘wallContainer’);
if (container) container.innerHTML = ‘<p style="text-align:center; padding:40px; color:var(--zone-5);">Error al cargar el muro. Intenta recargar la página.</p>’;
}
},

// Renderizar las entradas
// FIX: cada entrada en su propio try/catch; métricas numéricas convertidas antes de mostrar
render(entries) {
const container = document.getElementById(‘wallContainer’);
if (!container) return;

```
if (!entries || entries.length === 0) {
  container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes. ¡Sé el primero en compartir!</p>';
  return;
}

let html = '';
for (const entry of entries) {
  try {
    // Fecha segura
    let fecha = '—';
    try {
      fecha = entry.timestamp?.toDate
        ? entry.timestamp.toDate().toLocaleString()
        : new Date(entry.timestamp || 0).toLocaleString();
    } catch (_) {}

    const likeCount = Number(entry.likeCount) || 0;
    const userLiked = Array.isArray(entry.likes) && entry.likes.includes(AppState.currentUserId);
    const likeClass = userLiked ? 'liked' : '';
    
    const avatarHTML = entry.photoURL
      ? `<img src="${Utils.escapeHTML(entry.photoURL)}" class="wall-avatar" style="object-fit:cover;">`
      : `<div class="wall-avatar" style="background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">👤</div>`;
    
    let tipoEmoji = '';
    switch (entry.trainingType) {
      case 'rodaje': tipoEmoji = '🏃‍♂️'; break;
      case 'tempo': tipoEmoji = '⚡'; break;
      case 'series': tipoEmoji = '🔁'; break;
      case 'largo': tipoEmoji = '📏'; break;
      case 'strength': tipoEmoji = '💪'; break;
      default: tipoEmoji = '🏃';
    }
    
    const usernameFormatted = Utils.capitalizeUsername(entry.username || 'Usuario');
    // FIX: convertir a Number antes de mostrar — nunca pasar números a escapeHTML
    const duracion  = Number(entry.duration) || 0;
    const distancia = isFinite(Number(entry.distancia)) ? Number(entry.distancia).toFixed(2) : '0.00';
    const tss       = Number(entry.tss) || 0;
    
    html += `
      <div class="wall-item" data-entry-id="${entry.id}">
        <div class="wall-header">
          ${avatarHTML}
          <div class="wall-user-info">
            <div class="wall-username">${Utils.escapeHTML(usernameFormatted)}</div>
            <div class="wall-fecha">${fecha}</div>
          </div>
        </div>
        <div class="wall-entreno">
          <div class="wall-entreno-tipo">${tipoEmoji} ${Utils.escapeHTML(String(entry.trainingType || 'ENTRENO').toUpperCase())}</div>
          <div class="wall-entreno-detalles">
            <span>⏱️ ${duracion}'</span>
            <span>📏 ${distancia} km</span>
            <span>⚡ ${tss} TSS</span>
          </div>
        </div>
        <div class="wall-actions">
          <button class="wall-like-btn ${likeClass}" data-entry-id="${entry.id}">
            ❤️ <span class="like-count">${likeCount}</span>
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    // Una entrada corrupta no rompe el resto del muro
    console.warn('Error renderizando entrada del muro:', err, entry);
  }
}

if (!html) {
  container.innerHTML = '<p style="text-align:center; padding:40px;">No hay entrenamientos recientes.</p>';
  return;
}

container.innerHTML = html;

// Añadir event listeners para los botones de like
container.querySelectorAll('.wall-like-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const entryId = btn.dataset.entryId;
    this.toggleLike(entryId);
  });
});
```

},

// Dar o quitar like
async toggleLike(entryId) {
if (!AppState.currentUserId) {
Utils.showToast(‘Inicia sesión para dar like’, ‘warning’);
return;
}

```
const entryRef = firebaseServices.db.collection('globalFeed').doc(entryId);

try {
  const doc = await entryRef.get();
  if (!doc.exists) return;
  
  const data = doc.data();
  const likes = data.likes || [];
  const userLiked = likes.includes(AppState.currentUserId);
  
  if (userLiked) {
    await entryRef.update({
      likes: firebaseServices.FieldValue.arrayRemove(AppState.currentUserId),
      likeCount: firebaseServices.FieldValue.increment(-1)
    });
    Utils.vibrate(30);
  } else {
    await entryRef.update({
      likes: firebaseServices.FieldValue.arrayUnion(AppState.currentUserId),
      likeCount: firebaseServices.FieldValue.increment(1)
    });
    Utils.vibrate(50);
  }
} catch (error) {
  console.error('Error al dar/quitar like:', error);
  Utils.showToast('Error al procesar like', 'error');
}
```

},

// Detener listener
detenerListener() {
if (this.unsubscribe) {
this.unsubscribe();
this.unsubscribe = null;
}
},

// Recargar manualmente (puedes llamar desde un botón)
recargar() {
this.detenerListener();
this.initListener();
}
};

window.Wall = Wall;