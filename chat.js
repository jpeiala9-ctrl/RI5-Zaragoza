// ==================== chat.js - Mensajería entre amigos (CON FOTO) ====================
// Versión: 1.1 - Añadida foto de perfil en conversaciones
// ====================

const Chat = {
  currentConversationId: null,
  currentOtherUserId: null,
  unsubscribeMessages: null,

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
      // Contar mensajes no leídos para cada conversación
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
        const avatarHTML = conv.otherPhotoURL
          ? `<img src="${conv.otherPhotoURL}" class="conversacion-avatar" style="object-fit:cover;">`
          : `<div class="conversacion-avatar">👤</div>`;
        html += `
          <div class="conversacion-item ${unreadClass}" data-conv-id="${conv.id}" data-other-user-id="${conv.otherUserId}" data-other-username="${conv.otherUsername}">
            ${avatarHTML}
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
    } finally {
      Utils.hideLoading();
    }
  },
