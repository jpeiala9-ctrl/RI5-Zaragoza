// ==================== chat.js - Chat entre amigos ====================
// Versión: 2.1 - Hora formateada en mensajes
// ====================

const Chat = {
  conversationId: null,
  otherUserId: null,
  otherUsername: null,
  unsubscribeMessages: null,

  async abrirChat(amigoId, amigoUsername) {
    this.otherUserId = amigoId;
    this.otherUsername = amigoUsername;
    
    // Marcar como que el chat está abierto (para evitar notificaciones duplicadas)
    AppState.isChatOpen = true;
    
    // Cerrar modal si ya estaba abierto
    this.cerrarModal();
    
    // Mostrar modal
    const modal = document.getElementById('chatModal');
    const overlay = document.getElementById('modalAmigoOverlay');
    const titulo = document.getElementById('chatTitulo');
    
    if (modal) modal.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
    if (titulo) titulo.textContent = `💬 Chat con @${Utils.escapeHTML(amigoUsername)}`;
    
    // Obtener o crear ID de conversación
    const ids = [AppState.currentUserId, amigoId].sort();
    this.conversationId = `${ids[0]}_${ids[1]}`;
    
    // Cargar mensajes
    await this.cargarMensajes();
    
    // Escuchar nuevos mensajes
    if (this.unsubscribeMessages) this.unsubscribeMessages();
    this.unsubscribeMessages = firebaseServices.db
      .collection('conversations')
      .doc(this.conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot((snapshot) => {
        this.renderMensajes(snapshot.docs);
        // Marcar mensajes como leídos
        this.marcarComoLeidos();
      });
  },
  
  cerrarChat() {
    AppState.isChatOpen = false;
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    this.cerrarModal();
    // Recargar conversaciones para actualizar badges
    this.cargarConversaciones();
  },
  
  cerrarModal() {
    const modal = document.getElementById('chatModal');
    const overlay = document.getElementById('modalAmigoOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    this.conversationId = null;
    this.otherUserId = null;
    this.otherUsername = null;
  },
  
  async cargarMensajes() {
    if (!this.conversationId) return;
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando mensajes...</div>';
    
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .doc(this.conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();
      
      this.renderMensajes(snapshot.docs);
      this.marcarComoLeidos();
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      container.innerHTML = '<div style="text-align:center; padding:20px; color: var(--zone-5);">Error al cargar mensajes</div>';
    }
  },
  
  renderMensajes(docs) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (docs.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color: var(--text-secondary);">Sin mensajes. Envía el primero 💬</div>';
      return;
    }
    
    let html = '';
    for (const doc of docs) {
      const msg = doc.data();
      const esMio = msg.senderId === AppState.currentUserId;
      const horaFormateada = this._formatMsgTime(msg.timestamp);
      
      html += `
        <div class="chat-message ${esMio ? 'sent' : 'received'}">
          <div>${Utils.escapeHTML(msg.text)}</div>
          <div style="font-size: 10px; opacity: 0.7; margin-top: 4px; text-align: ${esMio ? 'right' : 'left'}">${horaFormateada}</div>
        </div>
      `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  },
  
  // Método para formatear la hora del mensaje (Hoy, Ayer, o día abreviado)
  _formatMsgTime(timestamp) {
    if (!timestamp) return '';
    
    const msgDate = timestamp.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    
    if (msgDateOnly.getTime() === today.getTime()) {
      // Hoy: mostrar solo la hora
      return `Hoy ${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
    } else if (msgDateOnly.getTime() === yesterday.getTime()) {
      // Ayer: mostrar "Ayer" + hora
      return `Ayer ${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
      // Más antiguo: mostrar día abreviado + hora
      const diasSemana = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
      const diaAbr = diasSemana[msgDate.getDay()];
      return `${diaAbr} ${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
    }
  },
  
  async enviarMensaje() {
    const input = document.getElementById('chatInput');
    const texto = input?.value.trim();
    if (!texto) return;
    if (!this.conversationId || !this.otherUserId) return;
    
    input.value = '';
    
    try {
      const messageData = {
        text: texto,
        senderId: AppState.currentUserId,
        receiverId: this.otherUserId,
        timestamp: firebaseServices.Timestamp.now(),
        read: false
      };
      
      // Añadir mensaje a la subcolección
      await firebaseServices.db
        .collection('conversations')
        .doc(this.conversationId)
        .collection('messages')
        .add(messageData);
      
      // Actualizar el último mensaje en el documento de conversación
      const conversationRef = firebaseServices.db.collection('conversations').doc(this.conversationId);
      await conversationRef.set({
        participants: [AppState.currentUserId, this.otherUserId],
        lastMessage: {
          text: texto,
          senderId: AppState.currentUserId,
          timestamp: firebaseServices.Timestamp.now(),
          read: false
        },
        otherUsername: this.otherUsername,
        updatedAt: firebaseServices.Timestamp.now()
      }, { merge: true });
      
      // Scroll al último mensaje
      const container = document.getElementById('chatMessages');
      if (container) container.scrollTop = container.scrollHeight;
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      Utils.showToast('Error al enviar mensaje', 'error');
    }
  },
  
  async marcarComoLeidos() {
    if (!this.conversationId) return;
    
    try {
      const messagesRef = firebaseServices.db
        .collection('conversations')
        .doc(this.conversationId)
        .collection('messages');
      
      const snapshot = await messagesRef.where('receiverId', '==', AppState.currentUserId).where('read', '==', false).get();
      
      const batch = firebaseServices.db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      if (snapshot.size > 0) {
        await batch.commit();
      }
      
      // También actualizar el lastMessage.read en la conversación
      const convRef = firebaseServices.db.collection('conversations').doc(this.conversationId);
      const convDoc = await convRef.get();
      if (convDoc.exists && convDoc.data().lastMessage && convDoc.data().lastMessage.senderId !== AppState.currentUserId) {
        await convRef.update({
          'lastMessage.read': true
        });
      }
      
      // Actualizar badge de mensajes no leídos
      await this.updateUnreadBadge();
      
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
    }
  },
  
  async updateUnreadBadge() {
    if (!AppState.currentUserId) return;
    
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .where('participants', 'array-contains', AppState.currentUserId)
        .get();
      
      let unreadCount = 0;
      snapshot.forEach(doc => {
        const conv = doc.data();
        if (conv.lastMessage && conv.lastMessage.senderId !== AppState.currentUserId && !conv.lastMessage.read) {
          unreadCount++;
        }
      });
      
      AppState.mensajesAmigosNoLeidos = unreadCount;
      AppState.actualizarBadgeChat();
      
    } catch (error) {
      console.error('Error actualizando badge de chat:', error);
    }
  },
  
  async cargarConversaciones() {
    const container = document.getElementById('listaConversaciones');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando conversaciones...</div>';
    
    try {
      const snapshot = await firebaseServices.db
        .collection('conversations')
        .where('participants', 'array-contains', AppState.currentUserId)
        .orderBy('updatedAt', 'desc')
        .get();
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color: var(--text-secondary);">No tienes conversaciones activas. Invita a un amigo a chatear 💬</p>';
        return;
      }
      
      let html = '';
      for (const doc of snapshot.docs) {
        const conv = doc.data();
        const otroId = conv.participants.find(p => p !== AppState.currentUserId);
        const userDoc = await firebaseServices.db.collection('users').doc(otroId).get();
        const username = userDoc.exists ? Utils.capitalizeUsername(userDoc.data().username) : 'Usuario';
        const lastMsg = conv.lastMessage?.text || 'Sin mensajes';
        const lastTime = conv.lastMessage?.timestamp ? conv.lastMessage.timestamp.toDate() : null;
        const tieneNoLeidos = (conv.lastMessage && conv.lastMessage.senderId !== AppState.currentUserId && !conv.lastMessage.read);
        const noLeidosClass = tieneNoLeidos ? 'conversacion-no-leida' : '';
        
        let fechaStr = '';
        if (lastTime) {
          const hoy = new Date();
          const ayer = new Date(hoy);
          ayer.setDate(ayer.getDate() - 1);
          if (lastTime.toDateString() === hoy.toDateString()) {
            fechaStr = `Hoy ${lastTime.getHours().toString().padStart(2, '0')}:${lastTime.getMinutes().toString().padStart(2, '0')}`;
          } else if (lastTime.toDateString() === ayer.toDateString()) {
            fechaStr = `Ayer ${lastTime.getHours().toString().padStart(2, '0')}:${lastTime.getMinutes().toString().padStart(2, '0')}`;
          } else {
            fechaStr = lastTime.toLocaleDateString();
          }
        }
        
        html += `
          <div class="conversacion-item ${noLeidosClass}" onclick="Chat.abrirChat('${otroId}', '${Utils.escapeHTML(username)}')">
            <div class="conversacion-avatar">👤</div>
            <div class="conversacion-info">
              <div class="conversacion-nombre">${Utils.escapeHTML(username)}</div>
              <div class="conversacion-preview">${Utils.escapeHTML(lastMsg.substring(0, 50))}${lastMsg.length > 50 ? '…' : ''}</div>
            </div>
            <div class="conversacion-fecha">${fechaStr}</div>
            ${tieneNoLeidos ? '<div class="conversacion-badge">●</div>' : ''}
          </div>
        `;
      }
      container.innerHTML = html;
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      container.innerHTML = '<p style="text-align:center; color: var(--zone-5);">Error al cargar conversaciones</p>';
    }
  },
  
  closeChat() {
    this.cerrarChat();
  }
};

window.Chat = Chat;