// ==================== chat.js - Mensajería entre amigos ====================
// Versión: 1.0
// ====================

const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,

  // ========== OBTENER O CREAR CONVERSACIÓN ==========
  async getOrCreateConversation(userId, friendId) {
    if (!userId || !friendId) return null;
    const conversationId = [userId, friendId].sort().join('_');
    try {
      const docRef = firebaseServices.db.collection('conversations').doc(conversationId);
      const doc = await docRef.get();
      if (!doc.exists) {
        // Obtener datos de los usuarios para guardar como metadata
        const [userData, friendData] = await Promise.all([
          Storage.getUser(userId),
          Storage.getUser(friendId)
        ]);
        await docRef.set({
          participants: [userId, friendId],
          participantsData: {
            [userId]: { username: userData.username },
            [friendId]: { username: friendData.username }
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

  // ========== ENVIAR MENSAJE ==========
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
        readBy: [senderId] // el remitente lo ha leído implícitamente
      });

      // Actualizar el último mensaje en la conversación
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

  // ========== OBTENER CONVERSACIONES DE UN USUARIO ==========
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
        // Obtener el otro participante
        const otherId = data.participants.find(id => id !== userId);
        let otherUser = data.participantsData?.[otherId];
        if (!otherUser) {
          const userDoc = await firebaseServices.db.collection('users').doc(otherId).get();
          otherUser = { username: userDoc.exists ? userDoc.data().username : 'Usuario' };
        }
        conversations.push({
          id: doc.id,
          ...data,
          otherUserId: otherId,
          otherUsername: Utils.capitalizeUsername(otherUser.username),
          unreadCount: 0 // lo calcularemos después
        });
      }

      // Calcular mensajes no leídos para cada conversación
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

  // ========== ESCUCHAR MENSAJES EN TIEMPO REAL ==========
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

  // ========== MARCAR MENSAJES COMO LEÍDOS ==========
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

  // ========== RENDERIZAR LISTA DE CONVERSACIONES ==========
  async renderConversations(container) {
    if (!container || !AppState.currentUserId) return;
    Utils.showLoading();
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
        html += `
          <div class="conversacion-item ${unreadClass}" data-conv-id="${conv.id}" data-other-user-id="${conv.otherUserId}" data-other-username="${conv.otherUsername}">
            <div class="conversacion-avatar">👤</div>
            <div class="conversacion-info">
              <div class="conversacion-nombre">${conv.otherUsername}</div>
              <div class="conversacion-preview">${conv.lastMessage || 'Sin mensajes'}</div>
            </div>
            <div class="conversacion-fecha">${fecha}</div>
            ${conv.unreadCount > 0 ? `<div class="conversacion-badge">${conv.unreadCount}</div>` : ''}
          </div>
        `;
      }
      container.innerHTML = html;

      // Añadir eventos para abrir el chat
      container.querySelectorAll('.conversacion-item').forEach(el => {
        el.addEventListener('click', () => {
          const convId = el.dataset.convId;
          const otherUserId = el.dataset.otherUserId;
          const otherUsername = el.dataset.otherUsername;
          this.openChat(convId, otherUserId, otherUsername);
        });
      });

      // Actualizar badge total de mensajes no leídos
      const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      if (AppState) {
        AppState.mensajesAmigosNoLeidos = totalUnread;
        AppState.actualizarBadgeChat();
      }
    } catch (error) {
      console.error('Error rendering conversations:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar conversaciones</p>';
    } finally {
      Utils.hideLoading();
    }
  },

  // ========== ABRIR CHAT ==========
  openChat(conversationId, otherUserId, otherUsername) {
    // Crear el modal de chat si no existe
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" id="chatModalContent">
          <div class="chat-header">
            <span id="chatFriendName"></span>
            <button class="close-chat" onclick="Chat.closeChat()">✕</button>
          </div>
          <div id="chatMessages" class="chat-messages"></div>
          <div class="chat-input">
            <input type="text" id="chatInput" placeholder="Escribe un mensaje...">
            <button onclick="Chat.sendCurrentMessage()">📤</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const modalElement = document.getElementById('chatModal');
    const chatFriendName = document.getElementById('chatFriendName');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');

    chatFriendName.textContent = otherUsername;
    chatMessages.innerHTML = '';
    modalElement.style.display = 'flex';

    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;

    // Marcar mensajes como leídos
    this.markMessagesAsRead(conversationId);

    // Escuchar mensajes en tiempo real
    this.listenMessages(conversationId, (newMessages) => {
      newMessages.forEach(msg => this.appendMessage(msg, otherUserId));
      // Scroll al final
      chatMessages.scrollTop = chatMessages.scrollHeight;
      // Marcar como leídos al recibir mensajes (si la ventana está abierta)
      this.markMessagesAsRead(conversationId);
    });

    // Cargar mensajes existentes (historial)
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

    // Evento para enviar mensaje con Enter
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter') this.sendCurrentMessage();
    };
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
      // Marcar como leídos después de enviar
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

  // ========== INICIAR CHAT DESDE LISTA DE AMIGOS ==========
  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const conversationId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (conversationId) {
      this.openChat(conversationId, friendId, friendUsername);
    }
  },

  // ========== ACTUALIZAR BADGE DE MENSAJES NO LEÍDOS (llamado desde fuera) ==========
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