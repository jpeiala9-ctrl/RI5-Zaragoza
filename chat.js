// ==================== chat.js - VERSIÓN FINAL ====================
const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,

  async getOrCreateConversation(userId, friendId) {
    if (!userId || !friendId) return null;
    const conversationId = [userId, friendId].sort().join('_');
    const convRef = firebaseServices.db.collection('conversations').doc(conversationId);
    try {
      const doc = await convRef.get();
      if (doc.exists) return conversationId;
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
        participantsData,
        lastMessage: '',
        lastUpdated: firebaseServices.Timestamp.now(),
        created: firebaseServices.Timestamp.now()
      });
      return conversationId;
    } catch (error) {
      console.error('Error en getOrCreateConversation:', error);
      return null;
    }
  },

  async sendMessage(conversationId, text) {
    if (!conversationId || !text.trim()) return false;
    const senderId = AppState.currentUserId;
    if (!senderId) return false;
    try {
      const messageRef = firebaseServices.db.collection('conversations').doc(conversationId).collection('messages').doc();
      await messageRef.set({
        senderId, text: text.trim(), timestamp: firebaseServices.Timestamp.now(),
        read: false, readBy: [senderId]
      });
      await firebaseServices.db.collection('conversations').doc(conversationId).update({
        lastMessage: text.trim(), lastUpdated: firebaseServices.Timestamp.now()
      });
      return true;
    } catch (error) { console.error('Error sending message:', error); return false; }
  },

  async getConversations(userId) {
    if (!userId) return [];
    try {
      const snapshot = await firebaseServices.db.collection('conversations')
        .where('participants', 'array-contains', userId).orderBy('lastUpdated', 'desc').get();
      const conversations = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const otherId = data.participants.find(id => id !== userId);
        let otherUser = data.participantsData?.[otherId];
        if (!otherUser) {
          const userDoc = await firebaseServices.db.collection('users').doc(otherId).get();
          otherUser = { username: userDoc.exists ? userDoc.data().username : 'Usuario', photoURL: userDoc.exists ? userDoc.data().profile?.photoURL : null };
        }
        conversations.push({
          id: doc.id, ...data, otherUserId: otherId,
          otherUsername: Utils.capitalizeUsername(otherUser.username),
          otherPhotoURL: otherUser.photoURL, unreadCount: 0
        });
      }
      for (const conv of conversations) {
        const unreadSnapshot = await firebaseServices.db.collection('conversations').doc(conv.id)
          .collection('messages').where('read', '==', false).where('senderId', '!=', userId).get();
        conv.unreadCount = unreadSnapshot.size;
      }
      return conversations;
    } catch (error) { console.error('Error getting conversations:', error); return []; }
  },

  // ✅ ESCUCHA ADDED Y MODIFIED PARA TIEMPO REAL
  listenMessages(conversationId, callback) {
    if (this.unsubscribeMessages) this.unsubscribeMessages();
    const query = firebaseServices.db.collection('conversations').doc(conversationId)
      .collection('messages').orderBy('timestamp', 'asc');
    this.unsubscribeMessages = query.onSnapshot(snapshot => {
      const messages = [];
      let hasChanges = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          messages.push({ id: change.doc.id, ...change.doc.data() });
          hasChanges = true;
        }
      });
      if (hasChanges && this.currentConversationId) {
        this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
      }
      if (callback) callback(messages);
    }, error => console.error('Error listening messages:', error));
  },

  async markMessagesAsRead(conversationId) {
    if (!conversationId) return;
    const userId = AppState.currentUserId;
    try {
      const snapshot = await firebaseServices.db.collection('conversations').doc(conversationId)
        .collection('messages').where('read', '==', false).where('senderId', '!=', userId).get();
      if (snapshot.empty) return;
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { read: true, readBy: firebaseServices.FieldValue.arrayUnion(userId) });
      });
      await batch.commit();
    } catch (error) { console.error('Error marking messages as read:', error); }
  },

  openChat(conversationId, otherUserId, otherUsername) {
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'chatModal'; modal.className = 'modal';
      modal.innerHTML = `<div class="modal-content"><div class="chat-header"><span id="chatFriendName"></span><button class="close-chat" id="closeChatBtn">✕</button></div><div id="chatMessages" class="chat-messages"></div><div class="chat-input"><input id="chatInput" placeholder="Escribe..."><button class="send-btn" id="sendChatBtn">📤</button><button class="clear-chat-btn" id="clearChatBtn">🗑️</button></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('closeChatBtn').addEventListener('click', () => this.closeChat());
      document.getElementById('sendChatBtn').addEventListener('click', () => this.sendCurrentMessage());
      document.getElementById('chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') this.sendCurrentMessage(); });
      document.getElementById('clearChatBtn').addEventListener('click', async () => {
        if (confirm('¿Vaciar chat?')) {
          await this.clearChat(this.currentConversationId);
          await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
          Utils.showToast('Chat vaciado', 'success');
        }
      });
    }
    document.getElementById('chatFriendName').textContent = otherUsername;
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatModal').style.display = 'flex';
    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;
    
    // ✅ LIMPIAR NOTIFICACIONES AL ABRIR
    this.markMessagesAsRead(conversationId);
    Chat.updateUnreadBadge();
    if (window.Friends && document.getElementById('listaAmigos')) Friends.cargarListaAmigos();
    
    this.listenMessages(conversationId, () => {});
    this.loadAndRenderMessages(conversationId, otherUserId);
  },

  async clearChat(conversationId) {
    const snapshot = await firebaseServices.db.collection('conversations').doc(conversationId).collection('messages').get();
    const batch = firebaseServices.db.batch();
    snapshot.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  async loadAndRenderMessages(conversationId, otherUserId) {
    const snapshot = await firebaseServices.db.collection('conversations').doc(conversationId)
      .collection('messages').orderBy('timestamp', 'asc').get();
    const messages = []; snapshot.forEach(d => messages.push(d.data()));
    this.renderMessagesGrouped(messages, otherUserId);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
  },

  renderMessagesGrouped(messages, otherUserId) {
    const container = document.getElementById('chatMessages'); if (!container) return; container.innerHTML = '';
    if (!messages.length) return;
    const groups = {}; const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    messages.forEach(m => {
      let ts = m.timestamp; if (ts?.toDate) ts = ts.toDate(); else if (ts) ts = new Date(ts); else ts = new Date();
      let label = ts.toDateString() === today.toDateString() ? 'Hoy' : ts.toDateString() === yesterday.toDateString() ? 'Ayer' : ts.toLocaleDateString();
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    });
    for (const [label, arr] of Object.entries(groups)) {
      const d = document.createElement('div'); d.className = 'chat-date-separator'; d.textContent = label; container.appendChild(d);
      arr.forEach(m => container.appendChild(this.createMessageElement(m, otherUserId)));
    }
  },

  // ✅ DOBLE CHECK CORREGIDO
  createMessageElement(msg, otherUserId) {
    const isSent = msg.senderId === AppState.currentUserId;
    const div = document.createElement('div'); div.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    const txt = document.createElement('div'); txt.className = 'message-text'; txt.textContent = msg.text;
    const foot = document.createElement('div'); foot.className = 'message-footer';
    const time = document.createElement('span'); time.className = 'message-time';
    let ts = msg.timestamp; if (ts?.toDate) ts = ts.toDate(); else if (ts) ts = new Date(ts); else ts = new Date();
    time.textContent = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}`;
    if (isSent) {
      const status = document.createElement('span'); status.className = 'message-status';
      const readBy = msg.readBy || [];
      const isRead = readBy.some(uid => uid !== AppState.currentUserId);
      status.innerHTML = isRead ? '✓✓' : '✓';
      status.classList.add(isRead ? 'read' : 'sent');
      foot.appendChild(status);
    }
    foot.appendChild(time); div.appendChild(txt); div.appendChild(foot);
    return div;
  },

  async sendCurrentMessage() {
    const inp = document.getElementById('chatInput'); const txt = inp.value.trim();
    if (!txt || !this.currentConversationId) return;
    if (await this.sendMessage(this.currentConversationId, txt)) {
      inp.value = '';
      await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
    }
  },

  closeChat() {
    if (this.unsubscribeMessages) { this.unsubscribeMessages(); this.unsubscribeMessages = null; }
    document.getElementById('chatModal').style.display = 'none';
    if (this.currentConversationId) { Chat.updateUnreadBadge(); if (window.Friends) Friends.cargarListaAmigos(); }
    this.currentConversationId = null; this.currentOtherUserId = null;
  },

  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const cId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (cId) this.openChat(cId, friendId, friendUsername);
  },

  async updateUnreadBadge() {
    if (!AppState.currentUserId) return;
    const convs = await this.getConversations(AppState.currentUserId);
    const total = convs.reduce((a, c) => a + (c.unreadCount || 0), 0);
    AppState.mensajesAmigosNoLeidos = total;
    AppState.actualizarBadgeChat();
  }
};
window.Chat = Chat;