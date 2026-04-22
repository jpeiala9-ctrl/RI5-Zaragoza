// ==================== notifications.js - Notificaciones en tiempo real ====================
// Versión: 1.0
// Escucha en tiempo real: solicitudes de amistad + mensajes de chat
// Incluir este script DESPUÉS de firebase-config.js y app.js
// ====================

const Notifications = {
_unsubFriendRequests: null,
_unsubConversations: null,
_firstLoadFriends: true,
_firstLoadConversations: true,
_prevFriendCount: 0,
_prevUnreadMsgs: 0,

/**

- Inicia todos los listeners para el usuario dado.
- Llamar tras login o restauración de sesión.
  */
  init(uid) {
  if (!uid) return;
  console.log(‘🔔 Notifications.init() para’, uid);
  this.stop(); // Limpiar listeners anteriores si los hay
  this._firstLoadFriends = true;
  this._firstLoadConversations = true;
  this._prevFriendCount = 0;
  this._prevUnreadMsgs = 0;
  this._listenFriendRequests(uid);
  this._listenConversations(uid);
  },

/**

- Detiene todos los listeners.
- Llamar al cerrar sesión.
  */
  stop() {
  if (this._unsubFriendRequests) {
  this._unsubFriendRequests();
  this._unsubFriendRequests = null;
  }
  if (this._unsubConversations) {
  this._unsubConversations();
  this._unsubConversations = null;
  }
  console.log(‘🔕 Notifications: listeners detenidos’);
  },

// ==================== SOLICITUDES DE AMISTAD ====================
_listenFriendRequests(uid) {
this._unsubFriendRequests = firebaseServices.db
.collection(‘friendRequests’)
.where(‘to’, ‘==’, uid)
.where(‘status’, ‘==’, ‘pending’)
.onSnapshot(snapshot => {
const count = snapshot.size;

```
    // Actualizar badge en la pestaña de amigos
    if (AppState) {
      AppState.solicitudesPendientesCount = count;
      if (typeof AppState.actualizarBadgeSolicitudes === 'function') {
        AppState.actualizarBadgeSolicitudes();
      }
    }

    // En la primera carga no mostrar toast (son solicitudes ya conocidas)
    if (this._firstLoadFriends) {
      this._firstLoadFriends = false;
      this._prevFriendCount = count;
      return;
    }

    // Detectar solicitudes nuevas
    if (count > this._prevFriendCount) {
      const addedChanges = snapshot.docChanges().filter(c => c.type === 'added');
      addedChanges.forEach(change => {
        const data = change.doc.data();
        const fromName = data.fromUsername || 'alguien';
        Utils.showToast(
          `👋 Nueva solicitud de amistad de ${Utils.escapeHTML(fromName)}`,
          'info',
          6000
        );
        Utils.vibrate([50, 100, 50]);
      });
    }

    this._prevFriendCount = count;
  }, error => {
    console.error('Error en listener de solicitudes:', error);
  });
```

},

// ==================== MENSAJES DE CHAT ====================
_listenConversations(uid) {
this._unsubConversations = firebaseServices.db
.collection(‘conversations’)
.where(‘participants’, ‘array-contains’, uid)
.onSnapshot(snapshot => {
let totalUnread = 0;

```
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.lastMessage) return;

      // Un mensaje se considera no leído si:
      // - el remitente no es el usuario actual, Y
      // - el usuario actual no aparece en readBy
      const senderId = data.lastMessage.senderId;
      const readBy = data.lastMessage.readBy || [];

      if (senderId !== uid && !readBy.includes(uid)) {
        totalUnread++;
      }
    });

    // Actualizar badge de chat
    if (AppState) {
      AppState.mensajesAmigosNoLeidos = totalUnread;
      if (typeof AppState.actualizarBadgeChat === 'function') {
        AppState.actualizarBadgeChat();
      }
    }

    // En la primera carga no mostrar toast
    if (this._firstLoadConversations) {
      this._firstLoadConversations = false;
      this._prevUnreadMsgs = totalUnread;
      return;
    }

    // Detectar mensajes nuevos: la conversación se modificó y hay más no leídos
    if (totalUnread > this._prevUnreadMsgs) {
      const modifiedConvs = snapshot.docChanges().filter(c => c.type === 'modified');
      modifiedConvs.forEach(change => {
        const data = change.doc.data();
        if (!data.lastMessage) return;
        const senderId = data.lastMessage.senderId;
        const readBy = data.lastMessage.readBy || [];

        if (senderId !== uid && !readBy.includes(uid)) {
          const senderName = data.lastMessage.senderUsername || 'un amigo';
          const preview = data.lastMessage.text
            ? (data.lastMessage.text.length > 40
                ? data.lastMessage.text.substring(0, 40) + '...'
                : data.lastMessage.text)
            : 'Nuevo mensaje';
          Utils.showToast(
            `💬 ${Utils.escapeHTML(senderName)}: ${Utils.escapeHTML(preview)}`,
            'info',
            6000
          );
          Utils.vibrate([50, 100, 50]);
        }
      });
    }

    this._prevUnreadMsgs = totalUnread;
  }, error => {
    console.error('Error en listener de conversaciones:', error);
  });
```

}
};

window.Notifications = Notifications;
console.log(‘✅ Notifications module cargado’);