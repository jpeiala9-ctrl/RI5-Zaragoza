// ==================== chat.js - VERSIÓN QUE SÍ FUNCIONA ====================
// Probado y verificado. Los checks funcionan.
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
      const messageRef = firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc();
      
      await messageRef.set({
        senderId: senderId,
        text: text.trim(),
        timestamp: firebaseServices.Timestamp.now(),
        visto: false
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

  // ========== MARCAR COMO VISTO ==========
  async markAsSeen(conversationId) {
    if (!conversationId) return;
    
    const currentUserId = AppState.currentUserId;
    if (!currentUserId) return;
    
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('visto', '==', false)
        .where('senderId', '!=', currentUserId)
        .get();
      
      if (snapshot.empty) return;
      
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { visto: true });
      });
      
      await batch.commit();
      console.log('✅ Marcados como vistos:', snapshot.size);
    } catch (error) {
      console.error('Error al marcar visto:', error);
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
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
              messages.push({ id: change.doc.id, ...change.doc.data() });
            }
          });
          if (callback && messages.length > 0) callback(messages);
        },
        error => console.error('Error listener:', error)
      );
  },

  // ========== ABRIR CHAT ==========
  openChat(conversationId, otherUserId, otherUsername) {
    // Crear modal si no existe
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.className = 'chat-modal';
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
        <div class="chat-container" style="background: var(--bg-card); border-radius: 16px; width: 90%; max-width: 500px; height: 80%; display: flex; flex-direction: column;">
          <div class="chat-header" style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
            <span id="chatFriendName" style="font-size: 18px;"></span>
            <button id="closeChatBtn" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
          </div>
          <div id="chatMessages" class="chat-messages" style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column;"></div>
          <div class="chat-input" style="padding: 12px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
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
    
    // Cargar mensajes existentes
    this.loadMessages(conversationId);
    
    // Marcar como vistos
    this.markAsSeen(conversationId);
    
    // Escuchar cambios
    this.listenMessages(conversationId, () => {
      // Recargar todos los mensajes cuando haya cambios
      this.loadMessages(conversationId);
      // Volver a marcar como vistos
      this.markAsSeen(conversationId);
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
    
    messages.forEach(msg => {
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
      
      const footerDiv = document.createElement('div');
      footerDiv.style.cssText = `
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 5px;
        margin-top: 5px;
        font-size: 11px;
      `;
      
      const timeSpan = document.createElement('span');
      const timestamp = msg.timestamp?.toDate?.() || new Date();
      timeSpan.textContent = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
      timeSpan.style.opacity = '0.7';
      
      footerDiv.appendChild(timeSpan);
      
      if (isMine) {
        const checkSpan = document.createElement('span');
        if (msg.visto === true) {
          checkSpan.innerHTML = '✓✓';
          checkSpan.style.color = '#4caf50';
          checkSpan.style.fontWeight = 'bold';
        } else {
          checkSpan.innerHTML = '✓';
          checkSpan.style.color = '#888888';
        }
        footerDiv.appendChild(checkSpan);
      }
      
      msgDiv.appendChild(textDiv);
      msgDiv.appendChild(footerDiv);
      container.appendChild(msgDiv);
    });
  },

  // ========== ENVIAR MENSAJE ==========
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

  // ========== INICIAR CHAT ==========
  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const convId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (convId) this.openChat(convId, friendId, friendUsername);
  },

  // ========== RENDERIZAR LISTA ==========
  async renderConversations(container) {
    if (!container || !AppState.currentUserId) return;
    
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .where('participants', 'array-contains', AppState.currentUserId)
        .orderBy('lastUpdated', 'desc')
        .get();
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center;">No hay conversaciones</p>';
        return;
      }
      
      let html = '';
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const otherId = data.participants.find(id => id !== AppState.currentUserId);
        const otherUser = data.participantsData?.[otherId] || { username: 'Usuario' };
        
        const unreadSnapshot = await firebaseServices.db
          .collection('conversations')
          .doc(doc.id)
          .collection('messages')
          .where('visto', '==', false)
          .where('senderId', '!=', AppState.currentUserId)
          .get();
        
        const unreadCount = unreadSnapshot.size;
        const unreadClass = unreadCount > 0 ? 'conversacion-no-leida' : '';
        
        html += `
          <div class="conversacion-item ${unreadClass}" data-conv-id="${doc.id}" data-other-id="${otherId}" data-other-name="${Utils.escapeHTML(Utils.capitalizeUsername(otherUser.username))}">
            <div class="conversacion-avatar">👤</div>
            <div class="conversacion-info">
              <div class="conversacion-nombre">${Utils.escapeHTML(Utils.capitalizeUsername(otherUser.username))}</div>
              <div class="conversacion-preview">${Utils.escapeHTML(data.lastMessage || '')}</div>
            </div>
            ${unreadCount > 0 ? `<div class="conversacion-badge">${unreadCount}</div>` : ''}
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
    }
  },

  async updateUnreadBadge() {
    if (!AppState.currentUserId) return;
    const snapshot = await firebaseServices.db
      .collection('conversations')
      .where('participants', 'array-contains', AppState.currentUserId)
      .get();
    
    let total = 0;
    for (const doc of snapshot.docs) {
      const unread = await firebaseServices.db
        .collection('conversations')
        .doc(doc.id)
        .collection('messages')
        .where('visto', '==', false)
        .where('senderId', '!=', AppState.currentUserId)
        .get();
      total += unread.size;
    }
    
    if (AppState) {
      AppState.mensajesAmigosNoLeidos = total;
      if (AppState.actualizarBadgeChat) AppState.actualizarBadgeChat();
    }
  }
};

window.Chat = Chat;