// ==================== chat.js - ESTRATEGIA NUCLEAR (ENTREGADO ✓ / VISTO ✓✓) ====================
// Versión: 3.0 - IMPOSIBLE QUE FALLE
// ====================

const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,

  // ========== CREAR O OBTENER CONVERSACIÓN ==========
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
        [userId]: { 
          username: userData.username || 'Usuario', 
          photoURL: userData.profile?.photoURL || null 
        },
        [friendId]: { 
          username: friendData.username || 'Amigo', 
          photoURL: friendData.profile?.photoURL || null 
        }
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
      Utils.handleFirebaseError(error);
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
      
      // ========== NUCLEAR: status 1 = Entregado (✓), status 2 = Visto (✓✓) ==========
      await messageRef.set({
        senderId: senderId,
        text: text.trim(),
        timestamp: firebaseServices.Timestamp.now(),
        status: 1  // 1 = Entregado
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
      Utils.handleFirebaseError(error);
      return false;
    }
  },

  // ========== OBTENER CONVERSACIONES ==========
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
          otherUser = { 
            username: userDoc.exists ? userDoc.data().username : 'Usuario', 
            photoURL: userDoc.exists ? userDoc.data().profile?.photoURL : null 
          };
        }
        
        // Contar mensajes no leídos (status = 1, no enviados por el usuario)
        const unreadSnapshot = await firebaseServices.db
          .collection('conversations')
          .doc(doc.id)
          .collection('messages')
          .where('status', '==', 1)
          .where('senderId', '!=', userId)
          .get();
        
        conversations.push({
          id: doc.id,
          ...data,
          otherUserId: otherId,
          otherUsername: Utils.capitalizeUsername(otherUser.username),
          otherPhotoURL: otherUser.photoURL,
          unreadCount: unreadSnapshot.size
        });
      }
      
      return conversations;
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  },

  // ========== MARCAR MENSAJES COMO VISTOS ==========
  async markMessagesAsSeen(conversationId) {
    if (!conversationId) return;
    const currentUserId = AppState.currentUserId;
    if (!currentUserId) return;
    
    try {
      // Buscar mensajes con status = 1 (Entregado) que NO fueron enviados por el usuario actual
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('status', '==', 1)
        .where('senderId', '!=', currentUserId)
        .get();
      
      if (snapshot.empty) return;
      
      // Actualizar a status = 2 (Visto)
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { status: 2 });
      });
      
      await batch.commit();
      console.log(`✅ ${snapshot.size} mensajes marcados como VISTOS`);
    } catch (error) {
      console.error('Error marking messages as seen:', error);
    }
  },

  // ========== ESCUCHAR MENSAJES EN TIEMPO REAL ==========
  listenMessages(conversationId, callback) {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
    }
    
    const query = firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc');
      
    this.unsubscribeMessages = query.onSnapshot(
      snapshot => {
        const messages = [];
        snapshot.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        if (callback) callback(messages);
      },
      error => console.error('Error listening messages:', error)
    );
  },

  // ========== RENDERIZAR LISTA DE CONVERSACIONES ==========
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

  // ========== ABRIR CHAT ==========
  openChat(conversationId, otherUserId, otherUsername) {
    console.log(`💬 Abriendo chat con ${otherUsername}`);
    
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
        if (confirm('¿Seguro que quieres borrar todos los mensajes?')) {
          await this.clearChat(this.currentConversationId);
          await this.loadAndRenderMessages(this.currentConversationId, this.currentOtherUserId);
        }
      });
    }
    
    document.getElementById('chatFriendName').textContent = otherUsername;
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatModal').style.display = 'flex';
    
    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;
    
    // ========== NUCLEAR: MARCAR COMO VISTOS AL ABRIR ==========
    this.markMessagesAsSeen(conversationId);
    
    // Cargar mensajes iniciales
    this.loadAndRenderMessages(conversationId, otherUserId);
    
    // Escuchar nuevos mensajes
    this.listenMessages(conversationId, (messages) => {
      this.renderMessagesGrouped(messages, otherUserId);
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Marcar como vistos los nuevos mensajes también
      this.markMessagesAsSeen(conversationId);
    });
  },

  // ========== LIMPIAR CHAT ==========
  async clearChat(conversationId) {
    if (!conversationId) return;
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .get();
      
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      Utils.showToast('Chat vaciado', 'success');
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  },

  // ========== CARGAR Y RENDERIZAR MENSAJES ==========
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
  },

  // ========== RENDERIZAR MENSAJES AGRUPADOS POR FECHA ==========
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
        container.appendChild(this.createMessageElement(msg, otherUserId));
      });
    }
  },

  // ========== AGRUPAR MENSAJES POR FECHA ==========
  groupMessagesByDate(messages) {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    messages.forEach(msg => {
      let timestamp = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
      let dateLabel;
      
      if (timestamp.toDateString() === today.toDateString()) {
        dateLabel = 'Hoy';
      } else if (timestamp.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Ayer';
      } else {
        dateLabel = timestamp.toLocaleDateString();
      }
      
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(msg);
    });
    
    return groups;
  },

  // ========== CREAR ELEMENTO DE MENSAJE ==========
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
    
    const timestamp = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    timeSpan.textContent = `${hours}:${minutes}`;
    
    // ========== NUCLEAR: LÓGICA DEL DOBLE CHECK ==========
    if (isSent) {
      const statusSpan = document.createElement('span');
      statusSpan.className = 'message-status';
      
      const status = msg.status || 1;
      
      if (status === 2) {
        // Visto por el destinatario
        statusSpan.innerHTML = '✓✓';
        statusSpan.title = 'Visto';
        statusSpan.style.color = '#4caf50';
        statusSpan.style.fontWeight = 'bold';
        statusSpan.style.fontSize = '14px';
      } else {
        // Entregado pero no visto
        statusSpan.innerHTML = '✓';
        statusSpan.title = 'Entregado';
        statusSpan.style.color = '#888888';
        statusSpan.style.fontSize = '14px';
      }
      
      footerSpan.appendChild(statusSpan);
    }
    
    footerSpan.appendChild(timeSpan);
    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(footerSpan);
    
    return messageDiv;
  },

  // ========== ENVIAR MENSAJE ACTUAL ==========
  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !this.currentConversationId) return;
    
    const success = await this.sendMessage(this.currentConversationId, text);
    if (success) {
      input.value = '';
    }
  },

  // ========== CERRAR CHAT ==========
  closeChat() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    const modal = document.getElementById('chatModal');
    if (modal) modal.style.display = 'none';
    this.currentConversationId = null;
    this.currentOtherUserId = null;
    this.updateUnreadBadge();
  },

  // ========== INICIAR CHAT CON AMIGO ==========
  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const conversationId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (conversationId) this.openChat(conversationId, friendId, friendUsername);
  },

  // ========== ACTUALIZAR BADGE DE NO LEÍDOS ==========
  async updateUnreadBadge() {
    if (!AppState.currentUserId) return;
    try {
      const conversations = await this.getConversations(AppState.currentUserId);
      const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      if (AppState) {
        AppState.mensajesAmigosNoLeidos = totalUnread;
        if (AppState.actualizarBadgeChat) {
          AppState.actualizarBadgeChat();
        }
      }
    } catch (error) {
      console.error('Error updating unread badge:', error);
    }
  }
};

window.Chat = Chat;

console.log('✅ Chat cargado - Estrategia NUCLEAR (Entregado ✓ / Visto ✓✓)');