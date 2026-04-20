const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,

  async getOrCreateConversation(userId, friendId) {
    if (!userId || !friendId) return null;
    const conversationId = [userId, friendId].sort().join('_');
    const convRef = firebaseServices.db.collection('conversations').doc(conversationId);
    const doc = await convRef.get();
    if (!doc.exists) {
      await convRef.set({
        participants: [userId, friendId],
        lastMessage: '',
        lastUpdated: firebaseServices.Timestamp.now()
      });
    }
    return conversationId;
  },

  async sendMessage(conversationId, text) {
    if (!conversationId || !text.trim()) return false;
    const senderId = AppState.currentUserId;
    if (!senderId) return false;
    
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
  },

  listenMessages(conversationId, callback) {
    if (this.unsubscribeMessages) this.unsubscribeMessages();
    
    this.unsubscribeMessages = firebaseServices.db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        const messages = [];
        snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
        if (callback) callback(messages);
      });
  },

  openChat(conversationId, otherUserId, otherUsername) {
    let modal = document.getElementById('chatModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chatModal';
      modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:200000;justify-content:center;align-items:center;';
      modal.innerHTML = '<div style="background:#1a1a1a;border-radius:16px;width:90%;max-width:500px;height:80%;display:flex;flex-direction:column;"><div style="padding:16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;"><span id="chatFriendName" style="font-size:18px;color:#fff;"></span><button id="closeChatBtn" style="background:none;border:none;font-size:24px;color:#fff;cursor:pointer;">✕</button></div><div id="chatMessages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;"></div><div style="padding:12px;border-top:1px solid #333;display:flex;gap:8px;"><input type="text" id="chatInput" placeholder="Mensaje..." style="flex:1;padding:8px;border-radius:20px;border:1px solid #333;background:#0f0f0f;color:#fff;"><button id="sendChatBtn" style="padding:8px 16px;border-radius:20px;background:#c0a060;color:#000;border:none;cursor:pointer;">></button></div></div>';
      document.body.appendChild(modal);
      document.getElementById('closeChatBtn').onclick = () => this.closeChat();
      document.getElementById('sendChatBtn').onclick = () => this.sendCurrentMessage();
      document.getElementById('chatInput').onkeypress = (e) => { if (e.key === 'Enter') this.sendCurrentMessage(); };
    }
    
    document.getElementById('chatFriendName').textContent = otherUsername;
    document.getElementById('chatMessages').innerHTML = '';
    modal.style.display = 'flex';
    
    this.currentConversationId = conversationId;
    this.currentOtherUserId = otherUserId;
    
    this.loadMessages(conversationId);
    this.listenMessages(conversationId, (messages) => {
      this.renderMessages(messages);
      document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    });
  },

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

  renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';
    if (!messages.length) return;
    
    const currentUserId = AppState.currentUserId;
    
    messages.forEach(msg => {
      const isMine = msg.senderId === currentUserId;
      const div = document.createElement('div');
      div.style.cssText = `max-width:70%;padding:10px 14px;margin:5px 10px;border-radius:18px;align-self:${isMine ? 'flex-end' : 'flex-start'};background:${isMine ? '#c0a060' : '#222'};color:${isMine ? '#000' : '#fff'};`;
      div.textContent = msg.text;
      container.appendChild(div);
    });
  },

  async sendCurrentMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await this.sendMessage(this.currentConversationId, text);
  },

  closeChat() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    document.getElementById('chatModal').style.display = 'none';
  },

  async startChatWithFriend(friendId, friendUsername) {
    if (!AppState.currentUserId || !friendId) return;
    const convId = await this.getOrCreateConversation(AppState.currentUserId, friendId);
    if (convId) this.openChat(convId, friendId, friendUsername);
  },

  async renderConversations(container) {
    if (!container || !AppState.currentUserId) return;
    const snapshot = await firebaseServices.db
      .collection('conversations')
      .where('participants', 'array-contains', AppState.currentUserId)
      .orderBy('lastUpdated', 'desc')
      .get();
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">No hay conversaciones</p>';
      return;
    }
    
    let html = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const otherId = data.participants.find(id => id !== AppState.currentUserId);
      html += `<div style="padding:12px;margin:5px;background:#1a1a1a;border-radius:8px;cursor:pointer;" data-conv-id="${doc.id}" data-other-id="${otherId}">Chat</div>`;
    });
    
    container.innerHTML = html;
    container.querySelectorAll('[data-conv-id]').forEach(el => {
      el.onclick = () => this.openChat(el.dataset.convId, el.dataset.otherId, 'Chat');
    });
  }
};

window.Chat = Chat;