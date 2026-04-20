// ==================== chat.js - VERSIÓN 100% LIMPIA ====================
// Sin checks. Sin vistos. Sin estados. Sin badges. Solo mensajes.
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
      await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add({
          senderId: senderId,
          text: text.trim(),
          timestamp: firebaseServices.Timestamp.now()
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

  // ========== ESCUCHAR MENSAJES ==========
  listenMessages(conversationId, callback) {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
    }
    
    this.unsubscribeMessages = firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        snapshot => {
          const messages = [];
          snapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
          });
          if (callback) callback(messages);
        },
        error => console.error('Error listener:', error)
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
          <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column;"></div>
          <div style="padding: 12px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <input type="text" id="chatInput" placeholder="Escribe un mensaje..." style="flex: 1; padding: 8px; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
            <button id="sendChatBtn" style="padding: 8px 16px; border-radius: 20px; background: var(--accent-blue); color: white; border: none; cursor: pointer;">Enviar</button>
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
    
    this.loadMessages(conversationId);
    
    this.listenMessages(conversationId, (messages) => {
      this.renderMessages(messages);
      const container = document.getElementById('chatMessages');
      if (container) container.scrollTop = container.scrollHeight;
    });
  },

  // ========== CARGAR MENSAJES ==========
  async loadMessages(conversationId) {
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();
      
      const messages = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      
      this.renderMessages(messages);
      
      const container = document.getElementById('chatMessages');
      if (container) container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  },

  // ========== RENDERIZAR MENSAJES ==========
  renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!messages.length) return;
    
    const currentUserId = AppState.currentUserId;
    
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
        const isMine = msg.senderId === currentUserId;
        
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = `
          max-width: 70%;
          padding: 10px 14px;
          margin: 5px 10px;
          border-radius: 18px;
          word-wrap: break-word;
          align-self: ${isMine ? 'flex-end' : 'flex-start'};
          background: ${isMine ? 'var(--accent-blue)' : 'var(--bg-secondary)'};
          color: ${isMine ? 'var(--bg-primary)' : 'var(--text-primary)'};
        `;
        
        const textDiv = document.createElement('div');
        textDiv.textContent = msg.text;
        
        const timeDiv = document.createElement('div');
        timeDiv.style.cssText = 'text-align: right; font-size: 10px; margin-top: 5px; opacity: 0.7;';
        const timestamp = msg.timestamp?.toDate?.() || new Date();
        timeDiv.textContent = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        
        msgDiv.appendChild(textDiv);
        msgDiv.appendChild(timeDiv);
        container.appendChild(msgDiv);
      });
    }
  },

  // ========== ENVIAR MENSAJE ACTUAL ==========
  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    await this.sendMessage(this.currentConversationId, text);
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
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .where('participants', 'array-contains', AppState.currentUserId)
        .orderBy('lastUpdated', 'desc')
        .get();
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No tienes conversaciones</p>';
        return;
      }
      
      let html = '';
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const otherId = data.participants.find(id => id !== AppState.currentUserId);
        const otherUser = data.participantsData?.[otherId] || { username: 'Usuario' };
        
        html += `
          <div class="conversacion-item" data-conv-id="${doc.id}" data-other-id="${otherId}" data-other-name="${Utils.escapeHTML(Utils.capitalizeUsername(otherUser.username))}">
            <div class="conversacion-avatar">👤</div>
            <div class="conversacion-info">
              <div class="conversacion-nombre">${Utils.escapeHTML(Utils.capitalizeUsername(otherUser.username))}</div>
              <div class="conversacion-preview">${Utils.escapeHTML(data.lastMessage || '')}</div>
            </div>
          </div>
        `;
      }
      
      container.innerHTML = html;
      
      container.querySelectorAll('.conversacion-item').forEach(el => {
        el.onclick = () => {
          this.openChat(el.dataset.convId, el.dataset.otherId, el.dataset.otherName);
        };
      });
    } catch (error) {
      console.error('Error:', error);
      container.innerHTML = '<p style="text-align:center; color:var(--zone-5);">Error al cargar conversaciones</p>';
    }
  }
};

window.Chat = Chat;
console.log('✅ Chat cargado - Versión 100% limpia');