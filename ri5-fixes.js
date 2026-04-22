// ==================== ri5-fixes.js ====================
// Parche para index.html:
//   1. Admin: paginación real con “cargar más”
//   2. WhatsApp: elimina dependencia de TinyURL (CORS)
//
// INSTRUCCIONES: Añadir <script src="ri5-fixes.js"></script>
// justo antes del cierre </body> en index.html,
// DESPUÉS de todos los demás scripts.
// ====================

// ============================================================
//  FIX 1: ADMIN - PAGINACIÓN REAL DE USUARIOS
// ============================================================
(function patchAdminPagination() {

// Estado de paginación del admin
let adminLastDoc = null;
let adminHasMore = true;
let adminLoading = false;

// Sobrescribe loadUsersToCache para resetear el estado y cargar la primera página
window.loadUsersToCache = async function () {
if (typeof cachedUsers === ‘undefined’) {
console.warn(’[Admin Fix] cachedUsers no está definido todavía. Reintentando…’);
return [];
}
adminLastDoc = null;
adminHasMore = true;
cachedUsers = [];
window.usersLoaded = false;
return await loadMoreAdmin(true);
};

// Sobrescribe refreshUsersCache para empezar desde el principio
window.refreshUsersCache = async function () {
adminLastDoc = null;
adminHasMore = true;
cachedUsers = [];
window.usersLoaded = false;
await loadMoreAdmin(true);
if (typeof renderUserList === ‘function’) renderUserList(cachedUsers);
if (typeof Utils !== ‘undefined’) Utils.showToast(‘Usuarios actualizados’, ‘success’);
};

// Función principal de paginación
async function loadMoreAdmin(isFirst = false) {
if (adminLoading || !adminHasMore) return [];
adminLoading = true;

```
try {
  let query = firebaseServices.db
    .collection('users')
    .orderBy('username_lowercase')
    .limit(50);

  if (!isFirst && adminLastDoc) {
    query = query.startAfter(adminLastDoc);
  }

  const snapshot = await query.get();
  const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  cachedUsers = isFirst ? newUsers : [...cachedUsers, ...newUsers];
  adminLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  adminHasMore = newUsers.length === 50;
  window.usersLoaded = true;

  _actualizarBotonCargarMas();
  return newUsers;
} catch (error) {
  console.error('[Admin Fix] Error cargando usuarios:', error);
  return [];
} finally {
  adminLoading = false;
}
```

}

// Muestra u oculta el botón “cargar más” del admin
function _actualizarBotonCargarMas() {
let btn = document.getElementById(‘adminLoadMoreBtn’);

```
if (!btn) {
  // Crear el botón si no existe en el HTML
  const container = document.getElementById('adminUsersList');
  if (!container) return;

  btn = document.createElement('button');
  btn.id = 'adminLoadMoreBtn';
  btn.textContent = '▼ Cargar más usuarios';
  btn.style.cssText = `
    display: block;
    width: 100%;
    margin: 12px 0 4px 0;
    padding: 10px;
    background: transparent;
    border: 1px solid var(--border-color, #333);
    color: var(--text-secondary, #b0b0b0);
    cursor: pointer;
    font-size: 13px;
    letter-spacing: 1px;
    border-radius: 4px;
    transition: background 0.2s;
  `;
  btn.onmouseover = () => btn.style.background = 'var(--bg-secondary, #1a1a1a)';
  btn.onmouseleave = () => btn.style.background = 'transparent';
  btn.onclick = async () => {
    btn.textContent = 'Cargando...';
    btn.disabled = true;
    await loadMoreAdmin(false);
    if (typeof renderUserList === 'function') {
      const term = typeof currentSearchTerm !== 'undefined' ? currentSearchTerm : '';
      if (term) {
        const filtered = cachedUsers.filter(u =>
          (u.username && u.username.toLowerCase().includes(term.toLowerCase())) ||
          (u.email && u.email.toLowerCase().includes(term.toLowerCase()))
        );
        renderUserList(filtered);
      } else {
        renderUserList(cachedUsers);
      }
    }
    btn.disabled = false;
    btn.textContent = '▼ Cargar más usuarios';
  };

  // Insertar después del contenedor de lista
  container.parentNode.insertBefore(btn, container.nextSibling);
}

btn.style.display = adminHasMore ? 'block' : 'none';
```

}

console.log(‘✅ [Fix] Admin paginación aplicada’);
})();

// ============================================================
//  FIX 2: WHATSAPP - SIN TINYURL (evita error CORS)
// ============================================================
window.compartirAppPorWhatsApp = function () {
const url = window.location.href;
const titulo = “RI5 - Running Intelligence”;
const descripcion = “🏃‍♂️ Entrena por zonas de frecuencia cardíaca, genera planes personalizados y conecta con una comunidad de corredores. ¡Todo gratis!”;
const mensaje = `*${titulo}*\n\n${descripcion}\n\n👉 ${url}`;
window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, ‘_blank’);
};

console.log(‘✅ [Fix] WhatsApp compartir aplicado’);