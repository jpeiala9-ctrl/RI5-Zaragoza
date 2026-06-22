// ==================== storage.js - Módulo de almacenamiento completo ====================
// Versión: 3.16 - Añadida funcionalidad de compartir sesiones (envío múltiple)
// ====================

const Storage = {
  async getUser(uid) { 
    if (!uid) return null; 
    try { 
      const doc = await firebaseServices.db.collection('users').doc(uid).get(); 
      return doc.exists ? doc.data() : null; 
    } catch (error) { 
      console.error('Error getting user:', error); 
      return null; 
    } 
  },
  
  async getUserByUsername(username) { 
    if (!username) return null; 
    try { 
      const snapshot = await firebaseServices.db.collection('users')
        .where('username', '==', username)
        .limit(1)
        .get(); 
      if (snapshot.empty) return null; 
      const doc = snapshot.docs[0]; 
      return { uid: doc.id, ...doc.data() }; 
    } catch (error) { 
      console.error('Error getting user by username:', error); 
      return null; 
    } 
  },
  
  async searchUsersByUsername(searchTerm, limit = 20, startAfter = null) {
    if (!searchTerm || searchTerm.length < 2) return { items: [], lastDoc: null };
    try {
      let query = firebaseServices.db.collection('users')
        .orderBy('username_lowercase')
        .startAt(searchTerm.toLowerCase())
        .endAt(searchTerm.toLowerCase() + '\uf8ff')
        .limit(limit);
      if (startAfter) query = query.startAfter(startAfter);
      let snapshot = await query.get();
      if (snapshot.empty) { 
        query = firebaseServices.db.collection('users')
          .orderBy('username')
          .startAt(searchTerm)
          .endAt(searchTerm + '\uf8ff')
          .limit(limit);
        if (startAfter) query = query.startAfter(startAfter);
        snapshot = await query.get(); 
      }
      const items = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      return { items, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
    } catch (error) { 
      console.error('Error searching users:', error); 
      throw error; 
    }
  },
  
  async getAllUsers(limit = 20, startAfter = null) { 
    let query = firebaseServices.db.collection('users')
      .orderBy('username')
      .limit(limit); 
    if (startAfter) query = query.startAfter(startAfter); 
    const snapshot = await query.get(); 
    const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })); 
    return { users, lastDoc: snapshot.docs[snapshot.docs.length - 1] }; 
  },
  
  async createUser(uid, userData) { 
    if (!uid || !userData) return false; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).set(userData); 
      return true; 
    } catch (error) { 
      console.error('Error creating user:', error); 
      Utils.showToast('❌ Error al crear el usuario. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async updateUser(uid, userData) { 
    if (!uid || !userData) return false; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).update(userData); 
      return true; 
    } catch (error) { 
      console.error('Error updating user:', error); 
      Utils.showToast('❌ Error al actualizar el usuario. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async deleteUser(uid) { 
    if (!uid) return false; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).delete(); 
      return true; 
    } catch (error) { 
      console.error('Error deleting user:', error); 
      Utils.showToast('❌ Error al eliminar el usuario. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async getSubcollection(uid, subcol, options = { orderBy: 'timestamp', direction: 'desc', limit: 25, startAfter: null }) {
    if (!uid) return { items: [], lastDoc: null };
    try {
      let query = firebaseServices.db.collection('users').doc(uid).collection(subcol)
        .orderBy(options.orderBy, options.direction)
        .limit(options.limit);
      if (options.startAfter) query = query.startAfter(options.startAfter);
      const snapshot = await query.get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { items, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
    } catch (error) { 
      console.error(`Error getting ${subcol}:`, error); 
      if (error.code === 'failed-precondition') 
        Utils.showToast('❌ Error de índice. Contacta con el administrador.', 'error');
      else 
        Utils.showToast('❌ Error al cargar los datos. Recarga la página.', 'error');
      return { items: [], lastDoc: null }; 
    }
  },

  async getHistorial(uid, limit = 25, startAfter = null) { 
    return this.getSubcollection(uid, 'historial', { orderBy: 'timestamp', direction: 'desc', limit, startAfter }); 
  },
  
  async addHistorialEntry(uid, entry) { 
    if (!uid || !entry) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).collection('historial').add({ ...entry, timestamp: firebaseServices.Timestamp.now() }); 
    } catch (error) { 
      console.error('Error adding historial entry:', error); 
      Utils.showToast('❌ Error al guardar en el historial. Reinténtalo.', 'error'); 
    } 
  },
  
  async deleteHistorialEntry(uid, entryId) { 
    if (!uid || !entryId) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).collection('historial').doc(entryId).delete(); 
    } catch (error) { 
      console.error('Error deleting historial entry:', error); 
      Utils.showToast('❌ Error al eliminar la entrada. Reinténtalo.', 'error'); 
    } 
  },
  
  async getHistorialPlanes(uid, limit = 5, startAfter = null) { 
    const result = await this.getSubcollection(uid, 'planes', { orderBy: 'fechaCreacion', direction: 'desc', limit, startAfter }); 
    return result.items; 
  },
  
  async addPlan(uid, plan) { 
    if (!uid || !plan) return null; 
    try { 
      const planId = plan.id || firebaseServices.db.collection('_').doc().id; 
      await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).set(plan); 
      return planId; 
    } catch (error) { 
      console.error('Error adding plan:', error); 
      Utils.showToast('❌ Error al guardar el plan. Revisa tu conexión.', 'error'); 
      return null; 
    } 
  },
  
  async deletePlan(uid, planId) { 
    if (!uid || !planId) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).delete(); 
    } catch (error) { 
      console.error('Error deleting plan:', error); 
      Utils.showToast('❌ Error al eliminar el plan. Reinténtalo.', 'error'); 
    } 
  },
  
  async getUltimoPlan(uid) { 
    const result = await this.getSubcollection(uid, 'planes', { orderBy: 'fechaCreacion', direction: 'desc', limit: 1 }); 
    return result.items[0] || null; 
  },
  
  async setUltimoPlan(uid, plan) { 
    if (!uid || !plan) return; 
    try { 
      const planId = await this.addPlan(uid, { ...plan, esUltimo: true, fechaCreacion: new Date().toISOString() }); 
      await firebaseServices.db.collection('users').doc(uid).update({ ultimoPlanId: planId }); 
    } catch (error) { 
      console.error('Error setting ultimo plan:', error); 
    } 
  },
  
  async removeUltimoPlan(uid) { 
    if (!uid) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).update({ ultimoPlanId: null }); 
    } catch (error) { 
      console.error('Error removing ultimo plan:', error); 
    } 
  },
  
  async getPlanCompleto(uid, planId) { 
    if (!uid || !planId) return null; 
    try { 
      const doc = await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).get(); 
      return doc.exists ? doc.data() : null; 
    } catch (error) { 
      console.error('Error getting plan completo:', error); 
      return null; 
    } 
  },
  
  async savePlanCompleto(uid, planId, planData) { 
    if (!uid || !planId || !planData) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).set(planData, { merge: true }); 
    } catch (error) { 
      console.error('Error saving plan completo:', error); 
      Utils.showToast('❌ Error al guardar el plan. Revisa tu conexión.', 'error'); 
    } 
  },
  
  async getSesionesRealizadas(uid, planId) { 
    if (!uid || !planId) return {}; 
    try { 
      const snapshot = await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).collection('sesiones').get(); 
      const realizadas = {}; 
      snapshot.forEach(doc => realizadas[doc.id] = doc.data().realizado); 
      return realizadas; 
    } catch (error) { 
      console.error('Error getting sesiones:', error); 
      return {}; 
    } 
  },
  
  async marcarSesionRealizada(uid, planId, diaIndex, realizado) { 
    if (!uid || !planId || !diaIndex) return; 
    try { 
      await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId).collection('sesiones').doc(diaIndex.toString()).set({ 
        realizado, 
        fecha: new Date().toISOString(), 
        timestamp: firebaseServices.Timestamp.now() 
      }); 
    } catch (error) { 
      console.error('Error marking session:', error); 
      Utils.showToast('❌ Error al marcar la sesión. Reinténtalo.', 'error'); 
    } 
  },
  
  async getMensajesUsuario(uid) { 
    if (!uid) return []; 
    try { 
      const doc = await firebaseServices.db.collection('mensajes').doc(uid).get(); 
      const data = doc.data(); 
      return data && Array.isArray(data.mensajes) ? data.mensajes : []; 
    } catch (error) { 
      console.error('Error getting mensajes usuario:', error); 
      return []; 
    } 
  },
  
  async enviarMensajeUsuario(usuario, texto, datosExtra = null) { 
    if (!usuario || !texto) return false; 
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(usuario).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const username = userData?.username || 'Usuario';
      const usernameLower = userData?.username_lowercase || username.toLowerCase();
      
      const adminKey = "admin_" + usuario; 
      const docRef = firebaseServices.db.collection('mensajes').doc(adminKey); 
      const doc = await docRef.get(); 
      let mensajes = []; 
      if (doc.exists) { 
        const data = doc.data(); 
        mensajes = Array.isArray(data.mensajes) ? data.mensajes : []; 
      } 
      
      const mensaje = { 
        fecha: new Date().toLocaleString(), 
        texto, 
        leido: false, 
        esUsuario: true,
        username: username,
        username_lowercase: usernameLower,
        timestamp: firebaseServices.Timestamp.now() 
      };
      
      // Si hay datos extra (ej. sesión compartida), se añaden al mensaje
      if (datosExtra && typeof datosExtra === 'object') {
        Object.assign(mensaje, datosExtra);
      }
      
      mensajes.push(mensaje); 
      await docRef.set({ mensajes }); 
      return true; 
    } catch (error) { 
      console.error('Error detallado en enviarMensajeUsuario:', error); 
      Utils.showToast('❌ Error al enviar el mensaje: ' + error.message, 'error'); 
      return false; 
    } 
  },
  
  async enviarMensajeAdminAUsuario(usuario, texto) { 
    if (!usuario || !texto) return false; 
    try { 
      const userDoc = await firebaseServices.db.collection('users').doc(usuario).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const toUsername = userData?.username || 'Usuario';
      
      const docRef = firebaseServices.db.collection('mensajes').doc(usuario); 
      const doc = await docRef.get(); 
      let mensajes = []; 
      if (doc.exists) { 
        const data = doc.data(); 
        mensajes = Array.isArray(data.mensajes) ? data.mensajes : []; 
      } 
      mensajes.push({ 
        fecha: new Date().toLocaleString(), 
        texto, 
        leido: false, 
        esAdmin: true,
        toUsername: toUsername,
        timestamp: firebaseServices.Timestamp.now() 
      }); 
      await docRef.set({ mensajes }); 
      return true; 
    } catch (error) { 
      console.error('Error detallado en enviarMensajeAdminAUsuario:', error); 
      Utils.showToast('❌ Error al enviar el mensaje: ' + error.message, 'error'); 
      return false; 
    } 
  },
  
  async getMensajesEnviadosUsuario(uid) { 
    if (!uid) return []; 
    try { 
      const adminKey = "admin_" + uid; 
      const doc = await firebaseServices.db.collection('mensajes').doc(adminKey).get(); 
      const data = doc.data(); 
      return data && Array.isArray(data.mensajes) ? data.mensajes : []; 
    } catch (error) { 
      console.error('Error getting mensajes enviados:', error); 
      return []; 
    } 
  },
  
  async borrarMensajeUsuario(uid, idx) { 
    if (!uid || idx === undefined) return; 
    try { 
      const docRef = firebaseServices.db.collection('mensajes').doc(uid); 
      const doc = await docRef.get(); 
      if (doc.exists) { 
        const data = doc.data(); 
        let mensajes = Array.isArray(data.mensajes) ? data.mensajes : []; 
        if (idx >= 0 && idx < mensajes.length) { 
          mensajes.splice(idx, 1); 
          await docRef.set({ mensajes }); 
        } 
      } 
    } catch (error) { 
      console.error('Error deleting mensaje:', error); 
      Utils.showToast('❌ Error al eliminar el mensaje. Reinténtalo.', 'error'); 
    } 
  },

  async borrarMensajeEnviadoUsuario(uid, idx) { 
    if (!uid || idx === undefined) return; 
    try { 
      const docRef = firebaseServices.db.collection('mensajes').doc('admin_' + uid); 
      const doc = await docRef.get(); 
      if (doc.exists) { 
        const data = doc.data(); 
        let mensajes = Array.isArray(data.mensajes) ? data.mensajes : []; 
        if (idx >= 0 && idx < mensajes.length) { 
          mensajes.splice(idx, 1); 
          await docRef.set({ mensajes }); 
        } 
      } 
    } catch (error) { 
      console.error('Error deleting sent message:', error); 
      Utils.showToast('❌ Error al eliminar el mensaje enviado. Reinténtalo.', 'error'); 
    } 
  },
  
  async marcarLeido(uid, index) { 
    if (!uid || index === undefined) return; 
    try { 
      const docRef = firebaseServices.db.collection('mensajes').doc(uid); 
      const doc = await docRef.get(); 
      if (doc.exists) { 
        const data = doc.data(); 
        let mensajes = Array.isArray(data.mensajes) ? data.mensajes : []; 
        if (mensajes[index]) { 
          mensajes[index].leido = true; 
          await docRef.update({ mensajes }); 
        } 
      } 
    } catch (error) { 
      console.error('Error marking mensaje as read:', error); 
    } 
  },
  
  async getUltimoCalculo(uid) { 
    if (!uid) return null; 
    try { 
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get(); 
      if (!userDoc.exists) return null; 
      const ultimoCalculoId = userDoc.data().ultimoCalculoId; 
      if (!ultimoCalculoId) return null; 
      const calculoDoc = await firebaseServices.db.collection('users').doc(uid).collection('calculos').doc(ultimoCalculoId).get(); 
      return calculoDoc.exists ? calculoDoc.data() : null; 
    } catch (error) { 
      console.error('Error getting ultimo calculo:', error); 
      return null; 
    } 
  },
  
  async setUltimoCalculo(uid, calculo) { 
    if (!uid || !calculo) return; 
    try { 
      const calculoId = firebaseServices.db.collection('_').doc().id; 
      await firebaseServices.db.collection('users').doc(uid).collection('calculos').doc(calculoId).set({ ...calculo, timestamp: firebaseServices.Timestamp.now() }); 
      await firebaseServices.db.collection('users').doc(uid).update({ ultimoCalculoId: calculoId }); 
    } catch (error) { 
      console.error('Error setting ultimo calculo:', error); 
    } 
  },
  
  async sendFriendRequest(fromUid, toUid) { 
    if (!fromUid || !toUid) return false; 
    try { 
      const fromUser = await this.getUser(fromUid); 
      const toUser = await this.getUser(toUid); 
      if (!fromUser || !toUser) return false; 
      const requestId = `${fromUid}_${toUid}`; 
      await firebaseServices.db.collection('friendRequests').doc(requestId).set({ 
        from: fromUid, 
        to: toUid, 
        fromUsername: fromUser.username, 
        toUsername: toUser.username, 
        status: 'pending', 
        timestamp: firebaseServices.Timestamp.now() 
      }); 
      return true; 
    } catch (error) { 
      console.error('Error sending friend request:', error); 
      Utils.showToast('❌ Error al enviar la solicitud. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async acceptFriendRequest(requestId, fromUid, toUid) { 
    if (!requestId || !fromUid || !toUid) return false; 
    try { 
      const batch = firebaseServices.db.batch(); 
      const requestRef = firebaseServices.db.collection('friendRequests').doc(requestId); 
      batch.update(requestRef, { status: 'accepted' }); 
      const fromRef = firebaseServices.db.collection('users').doc(fromUid); 
      const toRef = firebaseServices.db.collection('users').doc(toUid); 
      batch.update(fromRef, { 
        friendIds: firebaseServices.FieldValue.arrayUnion(toUid), 
        friendsCount: firebaseServices.FieldValue.increment(1) 
      }); 
      batch.update(toRef, { 
        friendIds: firebaseServices.FieldValue.arrayUnion(fromUid), 
        friendsCount: firebaseServices.FieldValue.increment(1) 
      }); 
      await batch.commit(); 
      return true; 
    } catch (error) { 
      console.error('Error accepting friend request:', error); 
      Utils.showToast('❌ Error al aceptar la solicitud. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async rejectFriendRequest(requestId) { 
    if (!requestId) return false; 
    try { 
      await firebaseServices.db.collection('friendRequests').doc(requestId).update({ status: 'rejected' }); 
      return true; 
    } catch (error) { 
      console.error('Error rejecting friend request:', error); 
      Utils.showToast('❌ Error al rechazar la solicitud. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async getFriendRequests(uid) { 
    if (!uid) return []; 
    try { 
      const snapshot = await firebaseServices.db.collection('friendRequests')
        .where('to', '==', uid)
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .get(); 
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
    } catch (error) { 
      console.error('Error getting friend requests:', error); 
      throw error; 
    } 
  },
  
  async getFriends(uid) { 
    if (!uid) return []; 
    try { 
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get(); 
      const friendIds = userDoc.data()?.friendIds || []; 
      if (friendIds.length === 0) return []; 
      const friendPromises = friendIds.map(fid => firebaseServices.db.collection('users').doc(fid).get()); 
      const snapshots = await Promise.all(friendPromises); 
      const friends = snapshots.filter(doc => doc.exists).map(doc => ({ uid: doc.id, ...doc.data() })); 
      return friends; 
    } catch (error) { 
      console.error('Error getting friends:', error); 
      return []; 
    } 
  },
  
  async removeFriend(uid, friendUid) { 
    if (!uid || !friendUid) return false; 
    try { 
      const batch = firebaseServices.db.batch(); 
      const userRef = firebaseServices.db.collection('users').doc(uid); 
      const friendRef = firebaseServices.db.collection('users').doc(friendUid); 
      batch.update(userRef, { 
        friendIds: firebaseServices.FieldValue.arrayRemove(friendUid), 
        friendsCount: firebaseServices.FieldValue.increment(-1) 
      }); 
      batch.update(friendRef, { 
        friendIds: firebaseServices.FieldValue.arrayRemove(uid), 
        friendsCount: firebaseServices.FieldValue.increment(-1) 
      }); 
      await batch.commit(); 
      return true; 
    } catch (error) { 
      console.error('Error removing friend:', error); 
      Utils.showToast('❌ Error al eliminar el amigo. Reinténtalo.', 'error'); 
      return false; 
    } 
  },
  
  async uploadProfilePicture(uid, file) {
    if (!uid || !file) return null;
    try {
      const ref = firebaseServices.storage.ref(`profile_pictures/${uid}/avatar.jpg`);
      await ref.put(file);
      const downloadURL = await ref.getDownloadURL();
      await firebaseServices.db.collection('users').doc(uid).update({
        'profile.photoURL': downloadURL
      });
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Utils.showToast('❌ Error al subir la foto. Prueba con otra imagen.', 'error');
      return null;
    }
  },
  
  async deleteProfilePicture(uid) {
    if (!uid) return false;
    try {
      const ref = firebaseServices.storage.ref(`profile_pictures/${uid}/avatar.jpg`);
      await ref.delete();
      await firebaseServices.db.collection('users').doc(uid).update({
        'profile.photoURL': null
      });
      return true;
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      Utils.showToast('❌ Error al eliminar la foto. Reinténtalo.', 'error');
      return false;
    }
  },
  
  async getProfilePictureURL(uid) {
    if (!uid) return null;
    try {
      const ref = firebaseServices.storage.ref(`profile_pictures/${uid}/avatar.jpg`);
      return await ref.getDownloadURL();
    } catch (error) {
      return null;
    }
  },
  
  async procesarCalculosPendientes() { 
    if (!navigator.onLine) return; 
    const pendientes = JSON.parse(localStorage.getItem('ri5_calculos_pendientes') || '[]'); 
    if (pendientes.length === 0) return; 
    const nuevosPendientes = []; 
    for (const calc of pendientes) { 
      try { 
        await this.addHistorialEntry(AppState.currentUserId, calc); 
        await this.setUltimoCalculo(AppState.currentUserId, calc); 
      } catch (error) { 
        console.warn('Error subiendo cálculo pendiente, se queda en cola:', error); 
        nuevosPendientes.push(calc); 
      } 
    } 
    localStorage.setItem('ri5_calculos_pendientes', JSON.stringify(nuevosPendientes)); 
    if (nuevosPendientes.length === 0) 
      Utils.showToast('✅ Cálculos pendientes sincronizados.', 'success'); 
    else 
      Utils.showToast(`⚠️ ${nuevosPendientes.length} cálculos pendientes no pudieron sincronizarse.`, 'warning'); 
  },
  
  async getAdminMessagesPaginated(limit = 10, startAfter = null) {
    try {
      let query = firebaseServices.db.collection('mensajes')
        .where('__name__', '>=', 'admin_')
        .where('__name__', '<', 'admin_\uf8ff')
        .orderBy('__name__')
        .limit(limit);
      if (startAfter) query = query.startAfter(startAfter);
      const snapshot = await query.get();
      const docs = snapshot.docs;
      const lastDoc = docs.length === limit ? docs[docs.length - 1] : null;
      return { docs, lastDoc };
    } catch (error) {
      console.error('Error paginating admin messages:', error);
      throw error;
    }
  },

  // ==================== GAMIFICATION ====================
  async getGamificationData(uid) {
    if (!uid) return null;
    try {
      const doc = await firebaseServices.db.collection('gamification').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('Error obteniendo datos de gamificación:', error);
      return null;
    }
  },

  async updateGamificationData(uid, data) {
    if (!uid || !data) return false;
    try {
      await firebaseServices.db.collection('gamification').doc(uid).set(data, { merge: true });
      return true;
    } catch (error) {
      console.error('Error actualizando gamificación:', error);
      return false;
    }
  },

  // ==================== NUEVAS FUNCIONES PARA ADMIN (FASE 1) ====================
  async contarUsuarios() {
    try {
      const snapshot = await firebaseServices.db.collection('users').count().get();
      return snapshot.data().count;
    } catch (e) {
      console.warn('Fallback a método alternativo para contar usuarios:', e);
      const snapshot = await firebaseServices.db.collection('users').get();
      return snapshot.size;
    }
  },

  async contarUsuariosPremium() {
    try {
      const snapshot = await firebaseServices.db.collection('users').where('premium', '==', true).count().get();
      return snapshot.data().count;
    } catch (e) {
      console.warn('Fallback para contar premium:', e);
      const snapshot = await firebaseServices.db.collection('users').where('premium', '==', true).get();
      return snapshot.size;
    }
  },

  async contarUsuariosNuevos(dias = 7) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    const fechaStr = fecha.toISOString();
    try {
      const snapshot = await firebaseServices.db.collection('users')
        .where('created', '>=', fechaStr)
        .count().get();
      return snapshot.data().count;
    } catch (e) {
      console.warn('Fallback para contar nuevos usuarios:', e);
      const snapshot = await firebaseServices.db.collection('users')
        .where('created', '>=', fechaStr).get();
      return snapshot.size;
    }
  },

  async contarSesionesHoy() {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    try {
      const snapshot = await firebaseServices.db.collection('globalFeed')
        .where('timestamp', '>=', firebaseServices.Timestamp.fromDate(hoy))
        .where('timestamp', '<', firebaseServices.Timestamp.fromDate(manana))
        .count().get();
      return snapshot.data().count;
    } catch (e) {
      console.warn('Fallback para contar sesiones de hoy:', e);
      const snapshot = await firebaseServices.db.collection('globalFeed')
        .where('timestamp', '>=', firebaseServices.Timestamp.fromDate(hoy))
        .where('timestamp', '<', firebaseServices.Timestamp.fromDate(manana)).get();
      return snapshot.size;
    }
  },

  // ==================== FUNCIONES PARA COMPARTIR SESIONES ====================

  /**
   * Envía una sesión compartida a uno o varios amigos a través del chat
   * @param {string|string[]} toUids - ID del amigo o array de IDs
   * @param {object} sessionData - Datos de la sesión (tipo, detalle, duracion, etc.)
   * @param {string} fromUsername - Nombre del remitente (para mostrar en el mensaje)
   * @returns {Promise<boolean>}
   */
  async enviarSesionCompartida(toUids, sessionData, fromUsername) {
    if (!toUids || !sessionData || !fromUsername) return false;
    
    // Convertir a array si es un solo UID
    const uids = Array.isArray(toUids) ? toUids : [toUids];
    if (uids.length === 0) return false;
    
    try {
      // Serializar los datos de la sesión (eliminar funciones, etc.)
      const serialized = JSON.parse(JSON.stringify(sessionData));
      
      // Crear el texto del mensaje
      const tipoSesion = sessionData.tipo || 'entreno';
      const duracion = sessionData.duracion || '?';
      const nombre = sessionData.detalle?.nombre || 'Sesión';
      const texto = `📨 @${fromUsername} te ha compartido una sesión: "${nombre}" (${duracion}' · ${tipoSesion})`;
      
      // Enviar a cada destinatario en paralelo
      const resultados = await Promise.all(
        uids.map(toUid =>
          this.enviarMensajeUsuario(toUid, texto, {
            tipo: 'shared_session',
            sessionData: serialized,
            fromUsername: fromUsername,
            sessionId: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6)
          })
        )
      );
      
      const successCount = resultados.filter(r => r).length;
      return successCount === uids.length; // true si todos fueron exitosos
      
    } catch (error) {
      console.error('Error enviando sesión compartida:', error);
      Utils.showToast('❌ Error al compartir la sesión. Reinténtalo.', 'error');
      return false;
    }
  },

  /**
   * Guarda una sesión compartida en el plan del usuario (para que aparezca en su calendario)
   * @param {string} uid - ID del usuario que recibe la sesión
   * @param {object} sessionData - Datos de la sesión
   * @param {string} fromUid - ID del amigo que la compartió
   * @param {string} fromUsername - Nombre del amigo
   * @returns {Promise<boolean>}
   */
  async guardarSesionCompartidaEnPlan(uid, sessionData, fromUid, fromUsername) {
    if (!uid || !sessionData) return false;
    
    try {
      // Obtener el plan activo del usuario
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      const planId = userDoc.data()?.ultimoPlanId;
      
      if (!planId) {
        Utils.showToast('⚠️ No tienes un plan activo. Genera un plan primero.', 'warning');
        return false;
      }
      
      const planRef = firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId);
      
      // Obtener el plan actual
      const planDoc = await planRef.get();
      if (!planDoc.exists) {
        Utils.showToast('⚠️ El plan ya no existe.', 'error');
        return false;
      }
      
      const planData = planDoc.data();
      const sharedSessions = planData.sharedSessions || [];
      
      // Verificar si ya existe una sesión compartida igual (para evitar duplicados)
      const existe = sharedSessions.some(s => 
        s.fromUid === fromUid && 
        s.sessionData.tipo === sessionData.tipo &&
        s.sessionData.duracion === sessionData.duracion
      );
      
      if (existe) {
        Utils.showToast('ℹ️ Ya tienes esta sesión en tu plan.', 'info');
        return true;
      }
      
      // Crear la entrada
      const newShared = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 6),
        sessionData: sessionData,
        fromUid: fromUid,
        fromUsername: fromUsername,
        addedAt: firebaseServices.Timestamp.now(),
        realizado: false
      };
      
      sharedSessions.push(newShared);
      
      // Guardar en Firestore
      await planRef.update({ sharedSessions: sharedSessions });
      
      Utils.showToast(`✅ Sesión de @${fromUsername} añadida a tu plan.`, 'success');
      return true;
      
    } catch (error) {
      console.error('Error guardando sesión compartida en plan:', error);
      Utils.showToast('❌ Error al añadir la sesión al plan. Reinténtalo.', 'error');
      return false;
    }
  },

  /**
   * Obtiene las sesiones compartidas de un plan específico
   * @param {string} uid - ID del usuario
   * @param {string} planId - ID del plan (opcional, usa el último si no se especifica)
   * @returns {Promise<Array>}
   */
  async obtenerSharedSessions(uid, planId = null) {
    if (!uid) return [];
    
    try {
      let id = planId;
      if (!id) {
        const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
        id = userDoc.data()?.ultimoPlanId;
        if (!id) return [];
      }
      
      const planDoc = await firebaseServices.db.collection('users').doc(uid).collection('planes').doc(id).get();
      if (!planDoc.exists) return [];
      
      return planDoc.data().sharedSessions || [];
    } catch (error) {
      console.error('Error obteniendo sesiones compartidas:', error);
      return [];
    }
  },

  /**
   * Marca una sesión compartida como realizada
   * @param {string} uid - ID del usuario
   * @param {string} sharedId - ID de la sesión compartida
   * @returns {Promise<boolean>}
   */
  async marcarSharedSessionRealizada(uid, sharedId) {
    if (!uid || !sharedId) return false;
    
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      const planId = userDoc.data()?.ultimoPlanId;
      if (!planId) return false;
      
      const planRef = firebaseServices.db.collection('users').doc(uid).collection('planes').doc(planId);
      const planDoc = await planRef.get();
      if (!planDoc.exists) return false;
      
      const sharedSessions = planDoc.data().sharedSessions || [];
      const index = sharedSessions.findIndex(s => s.id === sharedId);
      if (index === -1) return false;
      
      sharedSessions[index].realizado = true;
      sharedSessions[index].realizadoEn = firebaseServices.Timestamp.now();
      
      await planRef.update({ sharedSessions: sharedSessions });
      
      // También actualizar gamificación
      if (window.Gamification) {
        const sessionData = sharedSessions[index].sessionData;
        const sesion = {
          tipo: sessionData.tipo || 'rodaje',
          duracion: sessionData.duracion || 30,
          detalle: sessionData.detalle || {}
        };
        let metricas = { distanciaTotal: 0 };
        if (window.PlanGenerator && typeof PlanGenerator.calcularMetricasSesion === 'function') {
          metricas = PlanGenerator.calcularMetricasSesion(sesion);
        }
        await Gamification.updateAfterSession(uid, sesion, metricas);
      }
      
      Utils.showToast('✅ Sesión compartida marcada como realizada.', 'success');
      return true;
      
    } catch (error) {
      console.error('Error marcando shared session como realizada:', error);
      Utils.showToast('❌ Error al marcar la sesión. Reinténtalo.', 'error');
      return false;
    }
  }
};

window.Storage = Storage;
console.log('✅ storage.js v3.16 - Compartir sesiones con amigos (envío múltiple)');