// ==================== admin.js - Panel de Administración ====================

// Inicialización cuando se cambia a la pestaña admin
async function cargarPanelAdmin() {
  if (!AppState.isAdmin) {
    document.getElementById('adminTabButton').style.display = 'none';
    return;
  }
  document.getElementById('adminTabButton').style.display = 'block';
  await cargarUsuarios();
  actualizarBadgeAdmin();
}

// Filtro en tiempo real
function filtrarUsuariosAdmin() {
  const texto = document.getElementById('adminBuscar').value.toLowerCase();
  if (!texto) {
    AppState.usuariosFiltrados = AppState.usuarios;
  } else {
    AppState.usuariosFiltrados = AppState.usuarios.filter(u => 
      (u.username && u.username.toLowerCase().includes(texto)) ||
      (u.email && u.email.toLowerCase().includes(texto))
    );
  }
  if (window.UI && UI.renderAdminUserList) UI.renderAdminUserList();
}

// Abrir modal de chat con un usuario
async function abrirChatUsuario(uid) {
  const usuario = AppState.usuarios.find(u => u.uid === uid);
  if (!usuario) return;
  
  AppState.usuarioSeleccionado = usuario;
  document.getElementById('adminChatUsername').innerText = usuario.username || usuario.email;
  
  await cargarConversacionAdmin(uid);
  
  document.getElementById('adminChatOverlay').classList.add('visible');
  document.getElementById('adminChatModal').classList.add('visible');
}

// Cerrar chat
function cerrarAdminChat() {
  document.getElementById('adminChatOverlay').classList.remove('visible');
  document.getElementById('adminChatModal').classList.remove('visible');
  AppState.usuarioSeleccionado = null;
  AppState.conversacionActual = null;
}

// Enviar mensaje desde el chat
async function enviarMensajeAdminChat() {
  const input = document.getElementById('adminChatInput');
  const texto = input.value.trim();
  if (!texto || !AppState.usuarioSeleccionado) return;
  
  await enviarMensajeAdmin(AppState.usuarioSeleccionado.uid, texto);
  input.value = '';
  await cargarConversacionAdmin(AppState.usuarioSeleccionado.uid);
}

// Actualizar badge de mensajes no leídos en la pestaña admin
async function actualizarBadgeAdmin() {
  const total = await contarMensajesNoLeidosAdmin();
  const tabButton = document.getElementById('adminTabButton');
  if (total > 0) {
    tabButton.classList.add('soporte-unread');
    tabButton.innerText = `ADMIN (${total})`;
  } else {
    tabButton.classList.remove('soporte-unread');
    tabButton.innerText = 'ADMIN';
  }
}

// Al entrar en la pestaña admin, refrescar datos
async function switchToAdmin() {
  await cargarPanelAdmin();
  await actualizarBadgeAdmin();
}

// Sobrescribir switchTab para incluir admin (ya está en app.js, pero aquí aseguramos)
const originalSwitchTab = window.switchTab;
window.switchTab = async function(tab) {
  if (tab === 'admin') {
    await switchToAdmin();
  }
  await originalSwitchTab(tab);
};

// Inicializar al cargar la página (si ya está logueado y es admin)
document.addEventListener('DOMContentLoaded', () => {
  if (AppState.isAdmin) {
    document.getElementById('adminTabButton').style.display = 'block';
  }
});

// Hacer funciones globales
window.filtrarUsuariosAdmin = filtrarUsuariosAdmin;
window.abrirChatUsuario = abrirChatUsuario;
window.cerrarAdminChat = cerrarAdminChat;
window.enviarMensajeAdminChat = enviarMensajeAdminChat;