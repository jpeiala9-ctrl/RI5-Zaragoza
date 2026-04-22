// ==================== ri5-fixes.js ====================
// Parche para index.html:
//   1. Admin: paginación real con “cargar más” + guard de Firebase
//   2. WhatsApp: elimina dependencia de TinyURL (CORS)
//   3. checkPremiumExpiry: solo se ejecuta cuando el usuario está logado
// ====================

// ============================================================
//  FIX 0: GUARD GLOBAL
// ============================================================
function esperarFirebase(callback, intentos = 0) {
if (typeof firebaseServices !== ‘undefined’ && firebaseServices.db) {
callback();
} else if (intentos < 50) {
setTimeout(() => esperarFirebase(callback, intentos + 1), 200);
} else {
console.warn(’[ri5-fixes] Firebase no disponible tras 10s.’);
}
}

// ============================================================
//  FIX 1: ADMIN - PAGINACIÓN REAL DE USUARIOS
// ============================================================
(function patchAdminPagination() {

let adminLastDoc = null;
let adminHasMore = true;
let adminLoading = false;

window.loadUsersToCache = async function () {
if (typeof firebaseServices === ‘undefined’ || !firebaseServices.db) return [];
if (typeof AppState !== ‘undefined’ && AppState.currentUserId && !AppState.isAdmin) return [];
if (typeof cachedUsers === ‘undefined’) return [];
adminLastDoc = null;
adminHasMore = true;
cachedUsers = [];
window.usersLoaded = false;
return await loadMoreAdmin(true);
};

window.refreshUsersCache = async function () {
if (typeof firebaseServices === ‘undefined’ || !firebaseServices.db) return;
adminLastDoc = null;
adminHasMore = true;
cachedUsers = [];
window.usersLoaded = false;
await loadMoreAdmin(true);
if (typeof renderUserList === ‘function’) renderUserList(cachedUsers);
if (typeof Utils !== ‘undefined’) Utils.showToast(‘Usuarios actualizados’, ‘success’);
};

async function loadMoreAdmin(isFirst = false) {
if (adminLoading || !adminHasMore) return [];
if (typeof firebaseServices === ‘undefined’ || !firebaseServices.db) return [];
adminLoading = true;
try {
let query = firebaseServices.db
.collection(‘users’)
.orderBy(‘username_lowercase’)
.limit(50);
if (!isFirst && adminLastDoc) query = query.startAfter(adminLastDoc);
const snapshot = await query.get();
const newUsers = snapshot.docs.map(doc => ({ id: doc.id, …doc.data() }));
cachedUsers = isFirst ? newUsers : […cachedUsers, …newUsers];
adminLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
adminHasMore = newUsers.length === 50;
window.usersLoaded = true;
_actualizarBotonCargarMas();
return newUsers;
} catch (error) {
console.error(’[Admin Fix] Error cargando usuarios:’, error);
return [];
} finally {
adminLoading = false;
}
}

function _actualizarBotonCargarMas() {
let btn = document.getElementById(‘adminLoadMoreBtn’);
if (!btn) {
const container = document.getElementById(‘adminUsersList’);
if (!container) return;
btn = document.createElement(‘button’);
btn.id = ‘adminLoadMoreBtn’;
btn.textContent = ‘▼ Cargar más usuarios’;
btn.style.cssText = ‘display:block;width:100%;margin:12px 0 4px 0;padding:10px;background:transparent;border:1px solid var(–border-color,#333);color:var(–text-secondary,#b0b0b0);cursor:pointer;font-size:13px;letter-spacing:1px;border-radius:4px;transition:background 0.2s;’;
btn.onmouseover = () => btn.style.background = ‘var(–bg-secondary,#1a1a1a)’;
btn.onmouseleave = () => btn.style.background = ‘transparent’;
btn.onclick = async () => {
btn.textContent = ‘Cargando…’;
btn.disabled = true;
await loadMoreAdmin(false);
if (typeof renderUserList === ‘function’) {
const term = typeof currentSearchTerm !== ‘undefined’ ? currentSearchTerm : ‘’;
const list = term ? cachedUsers.filter(u =>
(u.username && u.username.toLowerCase().includes(term.toLowerCase())) ||
(u.email && u.email.toLowerCase().includes(term.toLowerCase()))
) : cachedUsers;
renderUserList(list);
}
btn.disabled = false;
btn.textContent = ‘▼ Cargar más usuarios’;
};
container.parentNode.insertBefore(btn, container.nextSibling);
}
btn.style.display = adminHasMore ? ‘block’ : ‘none’;
}

console.log(‘✅ [Fix] Admin paginación aplicada’);
})();

// ============================================================
//  FIX 2: checkPremiumExpiry — solo admin logado
// ============================================================
window.checkPremiumExpiry = async function () {
if (typeof firebaseServices === ‘undefined’ || !firebaseServices.db) return;
if (typeof AppState === ‘undefined’ || !AppState.currentUserId) return;
if (!AppState.isAdmin) return;
try {
const snapshot = await firebaseServices.db.collection(‘users’).get();
const batch = firebaseServices.db.batch();
let updated = false;
const now = new Date();
snapshot.forEach(doc => {
const data = doc.data();
if (data.premium === true && data.expires && new Date(data.expires) < now) {
batch.update(doc.ref, { premium: false });
updated = true;
}
});
if (updated) await batch.commit();
} catch (error) {
console.warn(’[Fix] checkPremiumExpiry:’, error.message);
}
};

// ============================================================
//  FIX 3: WHATSAPP - SIN TINYURL (evita error CORS)
// ============================================================
window.compartirAppPorWhatsApp = function () {
const url = window.location.href;
const titulo = “RI5 - Running Intelligence”;
const descripcion = “🏃‍♂️ Entrena por zonas de frecuencia cardíaca, genera planes personalizados y conecta con una comunidad de corredores. ¡Todo gratis!”;
const mensaje = `*${titulo}*\n\n${descripcion}\n\n👉 ${url}`;
window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, ‘_blank’);
};

console.log(‘✅ [ri5-fixes] Todos los parches aplicados’);