// ==================== chat.js - Chat estilo Telegram ====================
// Versión: 4.0 - CORREGIDO: readBy al crear mensajes, eliminación de chat, notificaciones
// ====================

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
      console.log('✅ Conversación creada:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('❌ Error en getOrCreateConversation:', error);
      Utils.showToast('Error al iniciar conversación', 'error');
      return null;
    }
  },

  async sendMessage(conversationId, text) {
    if (!conversationId || !text.trim()) return false;
    const senderId = AppState.currentUserId;
    if (!senderId) return false;
    try {
      const messageRef = firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc();
      
      // ✅ CORREGIDO: Añadir readBy con el senderId
      await messageRef.set({
        senderId,
        text: text.trim(),
        timestamp: firebaseServices.Timestamp.now(),
        read: false,
        readBy: [senderId]
      });
      
      await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .update({
          lastMessage: text.trim(),
          lastUpdated: firebaseServices.Timestamp.now()
        });
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      Utils.showToast('Error al enviar mensaje', 'error');
      return false;
    }
  },

  async getConversations(userId) {
    if (!userId) return [];
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('lastUpdated', 'desc')
        .get();
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
          id: doc.id,
          ...data,
          otherUserId: otherId,
          otherUsername: Utils.capitalizeUsername(otherUser.username),
          otherPhotoURL: otherUser.photoURL,
          unreadCount: 0
        });
      }
      for (const conv of conversations) {
        const unreadSnapshot = await firebaseServices.db
          .collection('conversations')
          .doc(conv.id)
          .collection('messages')
          .where('read', '==', false)
          .where('senderId', '!=', userId)
          .get();
        conv.unreadCount = unreadSnapshot.size;
      }
      return conversations;
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  },

  listenMessages(conversationId, callback) {
    if (this.unsubscribeMessages) this.unsubscribeMessages();
    const query = firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc');
    this.unsubscribeMessages = query.onSnapshot(
      snapshot => {
        const messages = [];
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            messages.push({ id: change.doc.id, ...change.doc.data() });
          }
        });
        if (callback) callback(messages);
      },
      error => console.error('Error listening messages:', error)
    );
  },

  async markMessagesAsRead(conversationId) {
    if (!conversationId) return;
    const userId = AppState.currentUserId;
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('read', '==', false)
        .where('senderId', '!=', userId)
        .get();
      
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        const currentReadBy = doc.data().readBy || [];
        if (!currentReadBy.includes(userId)) {
          batch.update(doc.ref, { 
            read: true, 
            readBy: firebaseServices.FieldValue.arrayUnion(userId) 
          });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  async renderConversations(container) {
    if (!container || !AppState.currentUserId) return;
    try {
      const conversations = await this.getConversations(AppState.currentUserId);
      if (conversations.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes conversaciones. Envía un mensaje a un amigo.</p>';
        return;
      }
      let html = '';
      for (const conv of conversations) {
        const unreadClass = conv.unreadCount > 0 ? 'conversacion-no-leida' : '';
        const nombreClass = conv.unreadCount > 0 ? 'conversacion-nombre-no-leido' : '';
        const fecha = conv.lastUpdated?.toDate ? conv.lastUpdated.toDate().toLocaleDateString() : '';
        const avatarHTML = conv.otherPhotoURL
          ? `<img src="${Utils.escapeHTML(conv.otherPhotoURL)}" class="conversacion-avatar" style="object-fit:cover;">`
          : `<div class="conversacion-avatar">👤</div>`;
        const otherUsernameEscaped = Utils.escapeHTML(conv.otherUsername);
        const lastMessageEscaped = conv.lastMessage ? Utils.escapeHTML(conv.lastMessage) : 'Sin mensajes';
        const fechaEscaped = Utils.escapeHTML(fecha);
        html += `
          <div class="conversacion-item ${unreadClass}" data-conv-id="${conv.id}" data-other-user-id="${conv.otherUserId}" data-other-username="${otherUsernameEscaped}">
            ${avatarHTML}
            <div class="conversacion-info">
              <div class="conversacion-nombre ${nombreClass}">${otherUsernameEscaped}</div>
              <div class="conversacion-preview">${lastMessageEscaped}</div>
            </div>
            <div class="conversacion-fecha">${fechaEscaped}</div>
            ${conv.unreadCount > 0 ? `<div class="conversacion-badge">${conv.unreadCount}</div>` : ''}
          </div>
        `;
      }
      container.innerHTML = html;
      container.querySelectorAll('.conversacion-item').forEach(el => {
        el.addEventListener('click', () => {
          this.openChat(el.dataset.convId, el.dataset.otherUserId, el.dataset.otherUsername);
        });
      });
      const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      if (AppState) {
        AppState.mensajesAmigosNoLeidos = totalUnread;
        AppState.actualizarBadgeChat();
      }
    } catch (error) {
      console.error('Error rendering conversations:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar conversaciones</p>';
    }
  },

  openChat(conversationId, otherUserId, otherUsername) {
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" id="chatModalContent">
          <div class="chat-header">
            <span id="chatFriendName"></span>
            <button class="close-chat" id="closeChatBtn">✕</button>
          </div>
          <div id="chatMessages" class="chat-messages"></div>
          <div class="chat-input">
            <input type="text" id="chatInput" placeholder="Escribe un mensaje...">
            <button class="send-btn" id="sendChatBtn">📤</button>
            <button class="clear-chat-btn" id="clearChatBtn">🗑️</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('closeChatBtn').addEventListener('click', () => this.closeChat());
      document.getElementById('sendChatBtn').addEventListener('click', () => this.sendCurrentMessage());
      document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendCurrentMessage();
      });
      document.getElementById('clearChatBtn').addEventListener('click', async () => {
        const confirmed = await Utils.confirm('Vaciar chat', '¿Seguro que quieres borrar todos los mensajes de esta conversación? Esta acción no se puede deshacer.');
        if (confirmed) {
          await this.clearChat(this.currentConversationId);
          await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
          await firebaseServices.db.collection('conversations').doc(this.currentConversationId).update({
            lastMessage: '',
            lastUpdated: firebaseServices.Timestamp.now()
          }).catch(e => console.warn(e));
          Utils.showToast('Chat vaciado correctamente', 'success');
        }
      });
    } else {
      const clearBtn = document.getElementById('clearChatBtn');
      if (clearBtn) {
        const newClearBtn = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
        newClearBtn.addEventListener('click', async () => {
          const confirmed = await Utils.confirm('Vaciar chat', '¿Seguro que quieres borrar todos los mensajes de esta conversación? Esta acción no se puede deshacer.');
          if (confirmed) {
            await this.clearChat(this.currentConversationId);
            await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
            await firebaseServices.db.collection('conversations').doc(this.currentConversationId).update({
              lastMessage: '',
              lastUpdated: firebaseServices.Timestamp.now()
            }).catch(e => console.warn(e));
            Utils.showToast('Chat vaciado correctamente', 'success');
          }
        });
      }
    }
    const modalElement = document.getElementById('chatModal');
    const chatFriendName = document.getElementById('chatFriendName');
    const chatMessages = document.getElementById('chatMessages');
    chatFriendName.textContent = otherUsername;
    chatMessages.innerHTML = '';
    modalElement.style.display = 'flex';
    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;
    this.markMessagesAsRead(conversationId);
    this.listenMessages(conversationId, (newMessages) => {
      if (newMessages.length) this.appendMessagesGrouped(newMessages, otherUserId);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      this.markMessagesAsRead(conversationId);
    });
    this.loadAndRenderMessages(conversationId, otherUserId);
  },

  async clearChat(conversationId) {
    if (!conversationId) return;
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error clearing chat:', error);
      Utils.showToast('Error al vaciar el chat', 'error');
    }
  },

  async loadAndRenderMessages(conversationId, otherUserId) {
    const snapshot = await firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    const messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    this.renderMessagesGrouped(messages, otherUserId);
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  },

  renderMessagesGrouped(messages, otherUserId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';
    if (!messages.length) return;
    const grouped = this.groupMessagesByDate(messages);
    for (const [dateLabel, msgs] of Object.entries(grouped)) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'chat-date-separator';
      dateDiv.textContent = dateLabel;
      container.appendChild(dateDiv);
      msgs.forEach(msg => {
        const msgElement = this.createMessageElement(msg, otherUserId);
        container.appendChild(msgElement);
      });
    }
  },

  async appendMessagesGrouped(newMessages, otherUserId) {
    if (this.currentConversationId) {
      await this.loadAndRenderMessages(this.currentConversationId, otherUserId);
    }
  },

  groupMessagesByDate(messages) {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    messages.forEach(msg => {
      let timestamp = msg.timestamp;
      if (timestamp && timestamp.toDate) timestamp = timestamp.toDate();
      else if (timestamp) timestamp = new Date(timestamp);
      else timestamp = new Date();
      let dateLabel;
      if (timestamp.toDateString() === today.toDateString()) dateLabel = 'Hoy';
      else if (timestamp.toDateString() === yesterday.toDateString()) dateLabel = 'Ayer';
      else {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateLabel = timestamp.toLocaleDateString(undefined, options);
      }
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(msg);
    });
    return groups;
  },

  createMessageElement(msg, otherUserId) {
    const isSent = msg.senderId === AppState.currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    const textSpan = document.createElement('div');
    textSpan.className = 'message-text';
    textSpan.textContent = msg.text;
    const footerSpan = document.createElement('div');
    footerSpan.className = 'message-footer';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    let timestamp = msg.timestamp;
    if (timestamp && timestamp.toDate) timestamp = timestamp.toDate();
    else if (timestamp) timestamp = new Date(timestamp);
    else timestamp = new Date();
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    timeSpan.textContent = `${hours}:${minutes}`;
    if (isSent) {
      const statusSpan = document.createElement('span');
      statusSpan.className = 'message-status';
      const readBy = msg.readBy || [];
      const isRead = readBy.includes(otherUserId);
      if (isRead) {
        statusSpan.innerHTML = '✓✓';
        statusSpan.title = 'Visto';
        statusSpan.classList.add('read');
      } else {
        statusSpan.innerHTML = '✓';
        statusSpan.title = 'Enviado';
        statusSpan.classList.add('sent');
      }
      footerSpan.appendChild(statusSpan);
    }
    footerSpan.appendChild(timeSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(footerSpan);
    return messageDiv;
  },

  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !this.currentConversationId) return;
    const success = await this.sendMessage(this.currentConversationId, text);
    if (success) {
      input.value = '';
      this.markMessagesAsRead(this.currentConversationId);
      await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  },

  closeChat() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    const modal = document.getElementById('chatModal');
    if (modal) modal.style.display = 'none';
    this.currentConversationId = null;
    this.currentOtherUserId = null;
  },

  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const conversationId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (conversationId) this.openChat(conversationId, friendId, friendUsername);
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
      console.error('Error updating unread badge:', error);
    }
  }
};

window.Chat = Chat;