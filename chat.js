// ==================== chat.js - CON CHECKS (✓ enviado, ✓✓ visto) ====================
// Versión: 2.0.0 - Base sólida + checks funcionales
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
        Storage.getUser(userId).catch(() => ({ username: 'Usuario' })),
        Storage.getUser(friendId).catch(() => ({ username: 'Amigo' }))
      ]);
      
      await convRef.set({
        participants: [userId, friendId],
        participantsData: {
          [userId]: { username: userData.username || 'Usuario' },
          [friendId]: { username: friendData.username || 'Amigo' }
        },
        lastMessage: '',
        lastUpdated: firebaseServices.Timestamp.now(),
        created: firebaseServices.Timestamp.now()
      });
      
      return conversationId;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  },

  // ========== ENVIAR MENSAJE ==========
  async sendMessage(conversationId, text) {
    if (!conversationId || !text.trim()) return false;
    
    const senderId = AppState.currentUserId;
    if (!senderId) return false;
    
    try {
      // estado: 1 = enviado, 2 = visto
      await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add({
          senderId: senderId,
          text: text.trim(),
          timestamp: firebaseServices.Timestamp.now(),
          estado: 1
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
      console.error('Error:', error);
      return false;
    }
  },

  // ========== MARCAR MENSAJES COMO VISTOS ==========
  async marcarComoVistos(conversationId) {
    if (!conversationId) return;
    
    const currentUserId = AppState.currentUserId;
    if (!currentUserId) return;
    
    try {
      // Buscar mensajes con estado = 1 que NO envió el usuario actual
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('estado', '==', 1)
        .where('senderId', '!=', currentUserId)
        .get();
      
      if (snapshot.empty) return;
      
      // Cambiar estado a 2 (visto)
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { estado: 2 });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error:', error);
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
        const otherUser = data.participantsData?.[otherId] || { username: 'Usuario' };
        
        // Contar no leídos (estado = 1 Y senderId != userId)
        const unreadSnapshot = await firebaseServices.db
          .collection('conversations')
          .doc(doc.id)
          .collection('messages')
          .where('estado', '==', 1)
          .where('senderId', '!=', userId)
          .get();
        
        conversations.push({
          id: doc.id,
          otherUserId: otherId,
          otherUsername: Utils.capitalizeUsername(otherUser.username),
          lastMessage: data.lastMessage || '',
          lastUpdated: data.lastUpdated,
          unreadCount: unreadSnapshot.size
        });
      }
      
      return conversations;
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  },

  // ========== ESCUCHAR MENSAJES ==========
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
      error => console.error('Error:', error)
    );
  },

  // ========== ABRIR CHAT ==========
  openChat(conversationId, otherUserId, otherUsername) {
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 200000;
        justify-content: center;
        align-items: center;
      `;
      modal.innerHTML = `
        <div style="background: var(--bg-card); border-radius: 16px; width: 90%; max-width: 500px; height: 80%; display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
            <span id="chatFriendName" style="font-size: 18px;"></span>
            <button id="closeChatBtn" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
          </div>
          <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 12px;"></div>
          <div style="padding: 12px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <input type="text" id="chatInput" placeholder="Escribe un mensaje..." style="flex: 1;">
            <button id="sendChatBtn" style="padding: 0 16px;">📤</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      document.getElementById('closeChatBtn').onclick = () => this.closeChat();
      document.getElementById('sendChatBtn').onclick = () => this.sendCurrentMessage();
      document.getElementById('chatInput').onkeypress = (e) => {
        if (e.key === 'Enter') this.sendCurrentMessage();
      };
    }
    
    document.getElementById('chatFriendName').textContent = otherUsername;
    document.getElementById('chatMessages').innerHTML = '';
    modal.style.display = 'flex';
    
    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;
    
    // MARCAR COMO VISTOS
    this.marcarComoVistos(conversationId);
    
    // CARGAR MENSAJES
    this.loadMessages(conversationId);
    
    // ESCUCHAR NUEVOS MENSAJES
    this.listenMessages(conversationId, (messages) => {
      this.renderMessages(messages);
      document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
      // Marcar como vistos los nuevos mensajes
      this.marcarComoVistos(conversationId);
    });
  },

  // ========== CARGAR MENSAJES ==========
  async loadMessages(conversationId) {
    const snapshot = await firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    
    const messages = [];
    snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    this.renderMessages(messages);
  },

  // ========== RENDERIZAR MENSAJES ==========
  renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!messages.length) return;
    
    const grupos = {};
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    
    messages.forEach(msg => {
      const fecha = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
      let etiqueta;
      
      if (fecha.toDateString() === hoy.toDateString()) {
        etiqueta = 'Hoy';
      } else if (fecha.toDateString() === ayer.toDateString()) {
        etiqueta = 'Ayer';
      } else {
        etiqueta = fecha.toLocaleDateString();
      }
      
      if (!grupos[etiqueta]) grupos[etiqueta] = [];
      grupos[etiqueta].push(msg);
    });
    
    for (const [etiqueta, msgs] of Object.entries(grupos)) {
      const fechaDiv = document.createElement('div');
      fechaDiv.style.cssText = 'text-align: center; margin: 10px 0; color: var(--text-secondary); font-size: 12px;';
      fechaDiv.textContent = etiqueta;
      container.appendChild(fechaDiv);
      
      msgs.forEach(msg => {
        container.appendChild(this.createMessageElement(msg));
      });
    }
  },

  // ========== CREAR ELEMENTO DE MENSAJE (CON CHECKS) ==========
  createMessageElement(msg) {
    const esMio = msg.senderId === AppState.currentUserId;
    
    const div = document.createElement('div');
    div.style.cssText = `
      max-width: 70%;
      padding: 8px 12px;
      margin: 4px 0;
      border-radius: 18px;
      word-wrap: break-word;
      ${esMio ? 'align-self: flex-end; background: var(--accent-blue); color: var(--bg-primary);' : 'align-self: flex-start; background: var(--bg-secondary); color: var(--text-primary);'}
    `;
    
    const texto = document.createElement('div');
    texto.textContent = msg.text;
    
    const footer = document.createElement('div');
    footer.style.cssText = 'display: flex; justify-content: flex-end; align-items: center; gap: 4px; margin-top: 4px;';
    
    const hora = document.createElement('span');
    hora.style.cssText = 'font-size: 10px; opacity: 0.7;';
    const fecha = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
    hora.textContent = `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
    
    footer.appendChild(hora);
    
    // ========== AQUÍ ESTÁN LOS CHECKS ==========
    if (esMio) {
      const check = document.createElement('span');
      check.style.cssText = 'font-size: 12px; margin-left: 2px;';
      
      // estado: 1 = enviado (✓), 2 = visto (✓✓)
      if (msg.estado === 2) {
        check.innerHTML = '✓✓';
        check.style.color = '#4caf50';
        check.style.fontWeight = 'bold';
      } else {
        check.innerHTML = '✓';
        check.style.color = '#888888';
      }
      
      footer.appendChild(check);
    }
    
    div.appendChild(texto);
    div.appendChild(footer);
    
    return div;
  },

  // ========== ENVIAR MENSAJE ACTUAL ==========
  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    await this.sendMessage(this.currentConversationId, text);
    input.value = '';
  },

  // ========== CERRAR CHAT ==========
  closeChat() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    document.getElementById('chatModal').style.display = 'none';
    this.currentConversationId = null;
    this.currentOtherUserId = null;
  },

  // ========== INICIAR CHAT CON AMIGO ==========
  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const conversationId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (conversationId) this.openChat(conversationId, friendId, friendUsername);
  },

  // ========== RENDERIZAR LISTA DE CONVERSACIONES ==========
  async renderConversations(container) {
    if (!container || !AppState.currentUserId) return;
    
    try {
      const conversations = await this.getConversations(AppState.currentUserId);
      
      if (conversations.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes conversaciones</p>';
        return;
      }
      
      let html = '';
      for (const conv of conversations) {
        const unreadClass = conv.unreadCount > 0 ? 'conversacion-no-leida' : '';
        const fecha = conv.lastUpdated?.toDate ? conv.lastUpdated.toDate().toLocaleDateString() : '';
        
        html += `
          <div class="conversacion-item ${unreadClass}" data-conv-id="${conv.id}" data-other-id="${conv.otherUserId}" data-other-name="${Utils.escapeHTML(conv.otherUsername)}">
            <div class="conversacion-avatar">👤</div>
            <div class="conversacion-info">
              <div class="conversacion-nombre">${Utils.escapeHTML(conv.otherUsername)}</div>
              <div class="conversacion-preview">${Utils.escapeHTML(conv.lastMessage || 'Sin mensajes')}</div>
            </div>
            <div class="conversacion-fecha">${fecha}</div>
            ${conv.unreadCount > 0 ? `<div class="conversacion-badge">${conv.unreadCount}</div>` : ''}
          </div>
        `;
      }
      
      container.innerHTML = html;
      
      container.querySelectorAll('.conversacion-item').forEach(el => {
        el.addEventListener('click', () => {
          this.openChat(el.dataset.convId, el.dataset.otherId, el.dataset.otherName);
        });
      });
      
      // Actualizar badge
      const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
      if (AppState) {
        AppState.mensajesAmigosNoLeidos = totalUnread;
        if (AppState.actualizarBadgeChat) AppState.actualizarBadgeChat();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  },

  // ========== ACTUALIZAR BADGE ==========
  async updateUnreadBadge() {
    if (!AppState.currentUserId) return;
    const conversations = await this.getConversations(AppState.currentUserId);
    const total = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
    if (AppState) {
      AppState.mensajesAmigosNoLeidos = total;
      if (AppState.actualizarBadgeChat) AppState.actualizarBadgeChat();
    }
  }
};

window.Chat = Chat;
console.log('✅ Chat cargado - Checks funcionales (✓ enviado, ✓✓ visto)');