// ==================== chat.js - Mensajería entre amigos (CON FOTO Y SEGURIDAD XSS) ====================
// Versión: 1.5 - Añadido listener en tiempo real para actualizar badge de mensajes no leídos
// ====================

const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,
  unsubscribeConversaciones: null, // para el listener global
  listenersActivos: false, // flag para evitar duplicados

  async getOrCreateConversation(userId, friendId) {
    if (!userId || !friendId) return null;
    const conversationId = [userId, friendId].sort().join('_');
    try {
      const docRef = firebaseServices.db.collection('conversations').doc(conversationId);
      const doc = await docRef.get();
      if (!doc.exists) {
        const [userData, friendData] = await Promise.all([
          Storage.getUser(userId),
          Storage.getUser(friendId)
        ]);
        await docRef.set({
          participants: [userId, friendId],
          participantsData: {
            [userId]: { username: userData.username, photoURL: userData.profile?.photoURL || null },
            [friendId]: { username: friendData.username, photoURL: friendData.profile?.photoURL || null }
          },
          lastMessage: '',
          lastUpdated: firebaseServices.Timestamp.now(),
          created: firebaseServices.Timestamp.now()
        });
      }
      return conversationId;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
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
            const msg = { id: change.doc.id, ...change.doc.data() };
            messages.push(msg);
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
        batch.update(doc.ref, { read: true, readBy: firebaseServices.FieldValue.arrayUnion(userId) });
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
              <div class="conversacion-nombre">${otherUsernameEscaped}</div>
              <div class="conversacion-preview">${lastMessageEscaped}</div>
            </div>
            <div class="conversacion-fecha">${fechaEscaped}</div>
            ${conv.unreadCount > 0 ? `<div class="conversacion-badge">${conv.unreadCount}</div>` : ''}
          </div>
        `;
      }
      container.innerHTML = html;
      // Delegación de eventos (ya no usa onclick)
      container.querySelectorAll('.conversacion-item').forEach(el => {
        el.addEventListener('click', () => {
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
            <button id="sendChatBtn">📤</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      // Agregar listeners una sola vez
      document.getElementById('closeChatBtn').addEventListener('click', () => this.closeChat());
      document.getElementById('sendChatBtn').addEventListener('click', () => this.sendCurrentMessage());
      document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendCurrentMessage();
      });
    }
    const modalElement = document.getElementById('chatModal');
    const chatFriendName = document.getElementById('chatFriendName');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    chatFriendName.textContent = otherUsername; // textContent es seguro
    chatMessages.innerHTML = '';
    modalElement.style.display = 'flex';
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
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();
      chatMessages.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        this.appendMessage(msg, otherUserId);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    loadMessages();
  },

  appendMessage(msg, otherUserId) {
    const isSent = msg.senderId === AppState.currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
    messageDiv.textContent = msg.text;
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.appendChild(messageDiv);
  },

  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !this.currentConversationId) return;
    const success = await this.sendMessage(this.currentConversationId, text);
    if (success) {
      input.value = '';
      this.markMessagesAsRead(this.currentConversationId);
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
      console.error('Error updating unread badge:', error);
    }
  },

  // --- NUEVO: Listener en tiempo real para el badge de mensajes no leídos ---
  iniciarListenerChat() {
    if (!AppState.currentUserId) return;
    if (this.listenersActivos) return;
    this.listenersActivos = true;

    // Escuchar cambios en la colección de conversaciones del usuario
    this.unsubscribeConversaciones = firebaseServices.db.collection('conversations')
      .where('participants', 'array-contains', AppState.currentUserId)
      .onSnapshot(async (snapshot) => {
        let totalUnread = 0;
        // Para cada conversación, necesitamos escuchar los mensajes no leídos.
        // Esto podría ser costoso si hay muchas conversaciones, pero para un MVP es aceptable.
        // Alternativa: usar Cloud Functions para mantener un contador en la conversación.
        for (const doc of snapshot.docs) {
          const convId = doc.id;
          // Usamos una subconsulta para contar mensajes no leídos (podría optimizarse)
          const unreadSnapshot = await firebaseServices.db
            .collection('conversations')
            .doc(convId)
            .collection('messages')
            .where('read', '==', false)
            .where('senderId', '!=', AppState.currentUserId)
            .get();
          totalUnread += unreadSnapshot.size;
        }
        AppState.mensajesAmigosNoLeidos = totalUnread;
        AppState.actualizarBadgeChat();
        // Si la pestaña de amigos está abierta y el panel de chat está visible, refrescamos la lista de conversaciones
        if (document.getElementById('amigos-chat')?.classList.contains('active')) {
          const chatContainer = document.getElementById('conversacionesContainer');
          if (chatContainer) this.renderConversations(chatContainer);
        }
      }, (error) => {
        console.warn('Error en listener de conversaciones:', error);
      });
  },

  detenerListenerChat() {
    if (this.unsubscribeConversaciones) {
      this.unsubscribeConversaciones();
      this.unsubscribeConversaciones = null;
    }
    this.listenersActivos = false;
  }
  // ------------------------------------------------
};

// Inicializar el listener si ya hay un usuario logueado (esto ocurre cuando se carga el módulo después del login)
if (AppState && AppState.currentUserId) {
  Chat.iniciarListenerChat();
}

window.Chat = Chat;