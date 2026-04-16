// ==================== chat.js - Mensajería entre amigos (VERSIÓN DEFINITIVA) ====================
// Versión: 1.9 - Timestamp en cada mensaje
// ====================

const Chat = {
currentConversationId: null,
currentOtherUserId: null,
unsubscribeMessages: null,

async getOrCreateConversation(userId, friendId) {
if (!userId || !friendId) return null;
const conversationId = [userId, friendId].sort().join(’_’);
const convRef = firebaseServices.db.collection(‘conversations’).doc(conversationId);

```
try {
  const doc = await convRef.get();
  if (doc.exists) {
    return conversationId;
  }
  const [userData, friendData] = await Promise.all([
    Storage.getUser(userId).catch(() => ({ username: 'Usuario', profile: {} })),
    Storage.getUser(friendId).catch(() => ({ username: 'Amigo', profile: {} }))
  ]);
  const participantsData = {
    [userId]: { username: userData.username || 'Usuario', photoURL: userData.profile?.photoURL || null },
    [friendId]: { username: friendData.username || 'Amigo', photoURL: friendData.profile?.photoURL || null }
  };
  await convRef.set({
    participants: [userId, friendId],
    participantsData: participantsData,
    lastMessage: '',
    lastUpdated: firebaseServices.Timestamp.now(),
    created: firebaseServices.Timestamp.now()
  });
  console.log('✅ Conversación creada (fallback):', conversationId);
  return conversationId;
} catch (error) {
  console.error('❌ Error en getOrCreateConversation:', error);
  Utils.showToast('Error al iniciar conversación', 'error');
  return null;
}
```

},

async sendMessage(conversationId, text) {
if (!conversationId || !text.trim()) return false;
const senderId = AppState.currentUserId;
if (!senderId) return false;
try {
const messageRef = firebaseServices.db
.collection(‘conversations’)
.doc(conversationId)
.collection(‘messages’)
.doc();
await messageRef.set({
senderId,
text: text.trim(),
timestamp: firebaseServices.Timestamp.now(),
read: false,
readBy: [senderId]
});
await firebaseServices.db
.collection(‘conversations’)
.doc(conversationId)
.update({
lastMessage: text.trim(),
lastUpdated: firebaseServices.Timestamp.now()
});
return true;
} catch (error) {
console.error(‘Error sending message:’, error);
Utils.showToast(‘Error al enviar mensaje’, ‘error’);
return false;
}
},

async getConversations(userId) {
if (!userId) return [];
try {
const snapshot = await firebaseServices.db
.collection(‘conversations’)
.where(‘participants’, ‘array-contains’, userId)
.orderBy(‘lastUpdated’, ‘desc’)
.get();
const conversations = [];
for (const doc of snapshot.docs) {
const data = doc.data();
const otherId = data.participants.find(id => id !== userId);
let otherUser = data.participantsData?.[otherId];
if (!otherUser) {
const userDoc = await firebaseServices.db.collection(‘users’).doc(otherId).get();
otherUser = { username: userDoc.exists ? userDoc.data().username : ‘Usuario’, photoURL: userDoc.exists ? userDoc.data().profile?.photoURL : null };
}
conversations.push({
id: doc.id,
…data,
otherUserId: otherId,
otherUsername: Utils.capitalizeUsername(otherUser.username),
otherPhotoURL: otherUser.photoURL,
unreadCount: 0
});
}
for (const conv of conversations) {
const unreadSnapshot = await firebaseServices.db
.collection(‘conversations’)
.doc(conv.id)
.collection(‘messages’)
.where(‘read’, ‘==’, false)
.where(‘senderId’, ‘!=’, userId)
.get();
conv.unreadCount = unreadSnapshot.size;
}
return conversations;
} catch (error) {
console.error(‘Error getting conversations:’, error);
return [];
}
},

listenMessages(conversationId, callback) {
if (this.unsubscribeMessages) this.unsubscribeMessages();
const query = firebaseServices.db
.collection(‘conversations’)
.doc(conversationId)
.collection(‘messages’)
.orderBy(‘timestamp’, ‘asc’);
this.unsubscribeMessages = query.onSnapshot(
snapshot => {
const messages = [];
snapshot.docChanges().forEach(change => {
if (change.type === ‘added’) {
const msg = { id: change.doc.id, …change.doc.data() };
messages.push(msg);
}
});
if (callback) callback(messages);
},
error => console.error(‘Error listening messages:’, error)
);
},

async markMessagesAsRead(conversationId) {
if (!conversationId) return;
const userId = AppState.currentUserId;
try {
const snapshot = await firebaseServices.db
.collection(‘conversations’)
.doc(conversationId)
.collection(‘messages’)
.where(‘read’, ‘==’, false)
.where(‘senderId’, ‘!=’, userId)
.get();
const batch = firebaseServices.db.batch();
snapshot.forEach(doc => {
batch.update(doc.ref, { read: true, readBy: firebaseServices.FieldValue.arrayUnion(userId) });
});
await batch.commit();
} catch (error) {
console.error(‘Error marking messages as read:’, error);
}
},

async renderConversations(container) {
if (!container || !AppState.currentUserId) return;
try {
const conversations = await this.getConversations(AppState.currentUserId);
if (conversations.length === 0) {
container.innerHTML = ‘<p style="text-align:center; padding:20px;">No tienes conversaciones. Envía un mensaje a un amigo.</p>’;
return;
}
let html = ‘’;
for (const conv of conversations) {
const unreadClass = conv.unreadCount > 0 ? ‘conversacion-no-leida’ : ‘’;
const fecha = conv.lastUpdated?.toDate ? conv.lastUpdated.toDate().toLocaleDateString() : ‘’;
const avatarHTML = conv.otherPhotoURL
? `<img src="${Utils.escapeHTML(conv.otherPhotoURL)}" class="conversacion-avatar" style="object-fit:cover;">`
: `<div class="conversacion-avatar">👤</div>`;
const otherUsernameEscaped = Utils.escapeHTML(conv.otherUsername);
const lastMessageEscaped = conv.lastMessage ? Utils.escapeHTML(conv.lastMessage) : ‘Sin mensajes’;
const fechaEscaped = Utils.escapeHTML(fecha);
html += `<div class="conversacion-item ${unreadClass}" data-conv-id="${conv.id}" data-other-user-id="${conv.otherUserId}" data-other-username="${otherUsernameEscaped}"> ${avatarHTML} <div class="conversacion-info"> <div class="conversacion-nombre">${otherUsernameEscaped}</div> <div class="conversacion-preview">${lastMessageEscaped}</div> </div> <div class="conversacion-fecha">${fechaEscaped}</div> ${conv.unreadCount > 0 ?`<div class="conversacion-badge">${conv.unreadCount}</div>`: ''} </div>`;
}
container.innerHTML = html;
container.querySelectorAll(’.conversacion-item’).forEach(el => {
el.addEventListener(‘click’, () => {
const convId = el.dataset.convId;
const otherUserId = el.dataset.otherUserId;
const otherUsername = el.dataset.otherUsername;
this.openChat(convId, otherUserId, otherUsername);
});
});
const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
if (AppState) {
AppState.mensajesAmigosNoLeidos = totalUnread;
AppState.actualizarBadgeChat();
}
} catch (error) {
console.error(‘Error rendering conversations:’, error);
container.innerHTML = ‘<p style="text-align:center; color:var(--zone-5);">Error al cargar conversaciones</p>’;
}
},

openChat(conversationId, otherUserId, otherUsername) {
let modal = document.getElementById(‘chatModal’);
if (!modal) {
modal = document.createElement(‘div’);
modal.id = ‘chatModal’;
modal.className = ‘modal’;
modal.innerHTML = `<div class="modal-content" id="chatModalContent"> <div class="chat-header"> <span id="chatFriendName"></span> <button class="close-chat" id="closeChatBtn">✕</button> </div> <div id="chatMessages" class="chat-messages"></div> <div class="chat-input"> <input type="text" id="chatInput" placeholder="Escribe un mensaje..."> <button id="sendChatBtn">📤</button> </div> </div>`;
document.body.appendChild(modal);
document.getElementById(‘closeChatBtn’).addEventListener(‘click’, () => this.closeChat());
document.getElementById(‘sendChatBtn’).addEventListener(‘click’, () => this.sendCurrentMessage());
document.getElementById(‘chatInput’).addEventListener(‘keypress’, (e) => {
if (e.key === ‘Enter’) this.sendCurrentMessage();
});
}
const modalElement = document.getElementById(‘chatModal’);
const chatFriendName = document.getElementById(‘chatFriendName’);
const chatMessages = document.getElementById(‘chatMessages’);
chatFriendName.textContent = otherUsername;
chatMessages.innerHTML = ‘’;
modalElement.style.display = ‘flex’;
this.currentConversationId = conversationId;
this.currentOtherUserId = otherUserId;
this.markMessagesAsRead(conversationId);
this.listenMessages(conversationId, (newMessages) => {
newMessages.forEach(msg => this.appendMessage(msg, otherUserId));
chatMessages.scrollTop = chatMessages.scrollHeight;
this.markMessagesAsRead(conversationId);
});
const loadMessages = async () => {
const snapshot = await firebaseServices.db
.collection(‘conversations’)
.doc(conversationId)
.collection(‘messages’)
.orderBy(‘timestamp’, ‘asc’)
.get();
chatMessages.innerHTML = ‘’;
snapshot.forEach(doc => {
const msg = doc.data();
this.appendMessage(msg, otherUserId);
});
chatMessages.scrollTop = chatMessages.scrollHeight;
};
loadMessages();
},

// Formatear timestamp del mensaje: “Hoy 14:32” / “Ayer 09:05” / “lun 14:32”
_formatMsgTime(timestamp) {
if (!timestamp) return ‘’;
let date;
try {
date = typeof timestamp.toDate === ‘function’ ? timestamp.toDate() : new Date(timestamp);
} catch (e) { return ‘’; }
const now = new Date();
const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
const hhmm = date.toLocaleTimeString(‘es-ES’, { hour: ‘2-digit’, minute: ‘2-digit’ });
if (msgDay.getTime() === hoy.getTime()) return ’Hoy ’ + hhmm;
if (msgDay.getTime() === ayer.getTime()) return ’Ayer ’ + hhmm;
const diaSemana = date.toLocaleDateString(‘es-ES’, { weekday: ‘short’ });
return diaSemana + ’ ’ + hhmm;
},

appendMessage(msg, otherUserId) {
const isSent = msg.senderId === AppState.currentUserId;
const messageDiv = document.createElement(‘div’);
messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;

```
const textSpan = document.createElement('span');
textSpan.className = 'chat-msg-text';
textSpan.textContent = msg.text;

const timeSpan = document.createElement('span');
timeSpan.className = 'chat-msg-time';
timeSpan.textContent = this._formatMsgTime(msg.timestamp);
timeSpan.style.cssText = 'display:block; font-size:10px; opacity:0.6; margin-top:3px; text-align:' + (isSent ? 'right' : 'left');

messageDiv.appendChild(textSpan);
messageDiv.appendChild(timeSpan);

const chatMessages = document.getElementById('chatMessages');
if (chatMessages) chatMessages.appendChild(messageDiv);
```

},

async sendCurrentMessage() {
const input = document.getElementById(‘chatInput’);
const text = input.value.trim();
if (!text || !this.currentConversationId) return;
const success = await this.sendMessage(this.currentConversationId, text);
if (success) {
input.value = ‘’;
this.markMessagesAsRead(this.currentConversationId);
}
},

closeChat() {
if (this.unsubscribeMessages) {
this.unsubscribeMessages();
this.unsubscribeMessages = null;
}
const modal = document.getElementById(‘chatModal’);
if (modal) modal.style.display = ‘none’;
this.currentConversationId = null;
this.currentOtherUserId = null;
},

async startChatWithFriend(friendId, friendUsername) {
if (!AppState.currentUserId || !friendId) return;
const conversationId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
if (conversationId) {
this.openChat(conversationId, friendId, friendUsername);
}
},

async updateUnreadBadge() {
if (!AppState.currentUserId) return;
try {
const conversations = await this.getConversations(AppState.currentUserId);
const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
if (AppState) {
AppState.mensajesAmigosNoLeidos = totalUnread;
AppState.actualizarBadgeChat();
}
} catch (error) {
console.error(‘Error updating unread badge:’, error);
}
}
};

window.Chat = Chat;