// ==================== storage.js - Módulo de almacenamiento completo ====================
// Versión: 3.16 - CORREGIDO: Toasts amigables, envío de mensajes soporte, sincronización contador amigos, procesarCalculosPendientes
// ====================

const Storage = {
async getUser(uid) {
if (!uid) return null;
try {
const doc = await firebaseServices.db.collection(‘users’).doc(uid).get();
return doc.exists ? doc.data() : null;
} catch (error) {
console.error(‘Error getting user:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async getUserByUsername(username) {
if (!username) return null;
try {
const snapshot = await firebaseServices.db.collection(‘users’)
.where(‘username’, ‘==’, username)
.limit(1)
.get();
if (snapshot.empty) return null;
const doc = snapshot.docs[0];
return { uid: doc.id, …doc.data() };
} catch (error) {
console.error(‘Error getting user by username:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async searchUsersByUsername(searchTerm, limit = 20, startAfter = null) {
if (!searchTerm || searchTerm.length < 2) return { items: [], lastDoc: null };
try {
let query = firebaseServices.db.collection(‘users’)
.orderBy(‘username_lowercase’)
.startAt(searchTerm.toLowerCase())
.endAt(searchTerm.toLowerCase() + ‘\uf8ff’)
.limit(limit);
if (startAfter) query = query.startAfter(startAfter);
let snapshot = await query.get();
if (snapshot.empty) {
query = firebaseServices.db.collection(‘users’)
.orderBy(‘username’)
.startAt(searchTerm)
.endAt(searchTerm + ‘\uf8ff’)
.limit(limit);
if (startAfter) query = query.startAfter(startAfter);
snapshot = await query.get();
}
const items = snapshot.docs.map(doc => ({ uid: doc.id, …doc.data() }));
return { items, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
} catch (error) {
console.error(‘Error searching users:’, error);
Utils.handleFirebaseError(error);
return { items: [], lastDoc: null };
}
},

async getAllUsers(limit = 20, startAfter = null) {
try {
let query = firebaseServices.db.collection(‘users’)
.orderBy(‘username’)
.limit(limit);
if (startAfter) query = query.startAfter(startAfter);
const snapshot = await query.get();
const users = snapshot.docs.map(doc => ({ uid: doc.id, …doc.data() }));
return { users, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
} catch (error) {
console.error(‘Error getting all users:’, error);
Utils.handleFirebaseError(error);
return { users: [], lastDoc: null };
}
},

async createUser(uid, userData) {
if (!uid || !userData) return false;
try {
await firebaseServices.db.collection(‘users’).doc(uid).set(userData);
return true;
} catch (error) {
console.error(‘Error creating user:’, error);
Utils.handleFirebaseError(error);
return false;
}
},

async updateUser(uid, userData) {
if (!uid || !userData) return false;
try {
await firebaseServices.db.collection(‘users’).doc(uid).update(userData);
return true;
} catch (error) {
console.error(‘Error updating user:’, error);
Utils.handleFirebaseError(error);
return false;
}
},

async deleteUser(uid) {
if (!uid) return false;
try {
await firebaseServices.db.collection(‘users’).doc(uid).delete();
return true;
} catch (error) {
console.error(‘Error deleting user:’, error);
Utils.handleFirebaseError(error);
return false;
}
},

async getSubcollection(uid, subcol, options = { orderBy: ‘timestamp’, direction: ‘desc’, limit: 25, startAfter: null }) {
if (!uid) return { items: [], lastDoc: null };
try {
let query = firebaseServices.db.collection(‘users’).doc(uid).collection(subcol)
.orderBy(options.orderBy, options.direction)
.limit(options.limit);
if (options.startAfter) query = query.startAfter(options.startAfter);
const snapshot = await query.get();
const items = snapshot.docs.map(doc => ({ id: doc.id, …doc.data() }));
return { items, lastDoc: snapshot.docs[snapshot.docs.length - 1] };
} catch (error) {
console.error(`Error getting ${subcol}:`, error);
Utils.handleFirebaseError(error);
return { items: [], lastDoc: null };
}
},

async getHistorial(uid, limit = 25, startAfter = null) {
return this.getSubcollection(uid, ‘historial’, { orderBy: ‘timestamp’, direction: ‘desc’, limit, startAfter });
},

async addHistorialEntry(uid, entry) {
if (!uid || !entry) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘historial’).add({ …entry, timestamp: firebaseServices.Timestamp.now() });
} catch (error) {
console.error(‘Error adding historial entry:’, error);
Utils.handleFirebaseError(error);
}
},

async deleteHistorialEntry(uid, entryId) {
if (!uid || !entryId) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘historial’).doc(entryId).delete();
} catch (error) {
console.error(‘Error deleting historial entry:’, error);
Utils.handleFirebaseError(error);
}
},

async getHistorialPlanes(uid, limit = 5, startAfter = null) {
const result = await this.getSubcollection(uid, ‘planes’, { orderBy: ‘fechaCreacion’, direction: ‘desc’, limit, startAfter });
return result.items;
},

async addPlan(uid, plan) {
if (!uid || !plan) return null;
try {
const planId = plan.id || firebaseServices.db.collection(’_’).doc().id;
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).set(plan);
return planId;
} catch (error) {
console.error(‘Error adding plan:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async deletePlan(uid, planId) {
if (!uid || !planId) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).delete();
} catch (error) {
console.error(‘Error deleting plan:’, error);
Utils.handleFirebaseError(error);
}
},

async getUltimoPlan(uid) {
const result = await this.getSubcollection(uid, ‘planes’, { orderBy: ‘fechaCreacion’, direction: ‘desc’, limit: 1 });
return result.items[0] || null;
},

async setUltimoPlan(uid, plan) {
if (!uid || !plan) return;
try {
const planId = await this.addPlan(uid, { …plan, esUltimo: true, fechaCreacion: new Date().toISOString() });
await firebaseServices.db.collection(‘users’).doc(uid).update({ ultimoPlanId: planId });
} catch (error) {
console.error(‘Error setting ultimo plan:’, error);
Utils.handleFirebaseError(error);
}
},

async removeUltimoPlan(uid) {
if (!uid) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).update({ ultimoPlanId: null });
} catch (error) {
console.error(‘Error removing ultimo plan:’, error);
Utils.handleFirebaseError(error);
}
},

async getPlanCompleto(uid, planId) {
if (!uid || !planId) return null;
try {
const doc = await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).get();
return doc.exists ? doc.data() : null;
} catch (error) {
console.error(‘Error getting plan completo:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async savePlanCompleto(uid, planId, planData) {
if (!uid || !planId || !planData) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).set(planData, { merge: true });
} catch (error) {
console.error(‘Error saving plan completo:’, error);
Utils.handleFirebaseError(error);
}
},

async getSesionesRealizadas(uid, planId) {
if (!uid || !planId) return {};
try {
const snapshot = await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).collection(‘sesiones’).get();
const realizadas = {};
snapshot.forEach(doc => realizadas[doc.id] = doc.data().realizado);
return realizadas;
} catch (error) {
console.error(‘Error getting sesiones:’, error);
Utils.handleFirebaseError(error);
return {};
}
},

async marcarSesionRealizada(uid, planId, diaIndex, realizado) {
if (!uid || !planId || diaIndex === null || diaIndex === undefined) return;
try {
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘planes’).doc(planId).collection(‘sesiones’).doc(diaIndex.toString()).set({
realizado,
fecha: new Date().toISOString(),
timestamp: firebaseServices.Timestamp.now()
});
} catch (error) {
console.error(‘Error marking session:’, error);
Utils.handleFirebaseError(error);
}
},

async getMensajesUsuario(uid) {
if (!uid) return [];
try {
const doc = await firebaseServices.db.collection(‘mensajes’).doc(uid).get();
const data = doc.data();
return data && Array.isArray(data.mensajes) ? data.mensajes : [];
} catch (error) {
console.error(‘Error getting mensajes usuario:’, error);
Utils.handleFirebaseError(error);
return [];
}
},

async enviarMensajeUsuario(usuario, texto) {
if (!usuario || !texto) return false;
try {
const userDoc = await firebaseServices.db.collection(‘users’).doc(usuario).get();
const userData = userDoc.exists ? userDoc.data() : null;
const username = userData?.username || ‘Usuario’;
const usernameLower = userData?.username_lowercase || username.toLowerCase();

```
  const adminKey = "admin_" + usuario; 
  const docRef = firebaseServices.db.collection('mensajes').doc(adminKey); 
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
    esUsuario: true,
    username: username,
    username_lowercase: usernameLower,
    timestamp: firebaseServices.Timestamp.now() 
  }); 
  await docRef.set({ mensajes }); 
  return true; 
} catch (error) { 
  console.error('Error detallado en enviarMensajeUsuario:', error); 
  Utils.handleFirebaseError(error);
  return false; 
} 
```

},

async enviarMensajeAdminAUsuario(usuario, texto) {
if (!usuario || !texto) return false;
try {
const userDoc = await firebaseServices.db.collection(‘users’).doc(usuario).get();
const userData = userDoc.exists ? userDoc.data() : null;
const toUsername = userData?.username || ‘Usuario’;

```
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
  Utils.handleFirebaseError(error);
  return false; 
} 
```

},

async getMensajesEnviadosUsuario(uid) {
if (!uid) return [];
try {
const adminKey = “admin_” + uid;
const doc = await firebaseServices.db.collection(‘mensajes’).doc(adminKey).get();
const data = doc.data();
return data && Array.isArray(data.mensajes) ? data.mensajes : [];
} catch (error) {
console.error(‘Error getting mensajes enviados:’, error);
Utils.handleFirebaseError(error);
return [];
}
},

async borrarMensajeUsuario(uid, idx) {
if (!uid || idx === undefined) return;
try {
const docRef = firebaseServices.db.collection(‘mensajes’).doc(uid);
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
console.error(‘Error deleting mensaje:’, error);
Utils.handleFirebaseError(error);
}
},

async marcarLeido(uid, index) {
if (!uid || index === undefined) return;
try {
const docRef = firebaseServices.db.collection(‘mensajes’).doc(uid);
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
console.error(‘Error marking mensaje as read:’, error);
Utils.handleFirebaseError(error);
}
},

async getUltimoCalculo(uid) {
if (!uid) return null;
try {
const userDoc = await firebaseServices.db.collection(‘users’).doc(uid).get();
if (!userDoc.exists) return null;
const ultimoCalculoId = userDoc.data().ultimoCalculoId;
if (!ultimoCalculoId) return null;
const calculoDoc = await firebaseServices.db.collection(‘users’).doc(uid).collection(‘calculos’).doc(ultimoCalculoId).get();
return calculoDoc.exists ? calculoDoc.data() : null;
} catch (error) {
console.error(‘Error getting ultimo calculo:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async setUltimoCalculo(uid, calculo) {
if (!uid || !calculo) return;
try {
const calculoId = firebaseServices.db.collection(’_’).doc().id;
await firebaseServices.db.collection(‘users’).doc(uid).collection(‘calculos’).doc(calculoId).set({ …calculo, timestamp: firebaseServices.Timestamp.now() });
await firebaseServices.db.collection(‘users’).doc(uid).update({ ultimoCalculoId: calculoId });
} catch (error) {
console.error(‘Error setting ultimo calculo:’, error);
Utils.handleFirebaseError(error);
}
},

async sendFriendRequest(fromUid, toUid) {
if (!fromUid || !toUid) return false;
try {
const fromUser = await this.getUser(fromUid);
const toUser = await this.getUser(toUid);
if (!fromUser || !toUser) return false;
const requestId = `${fromUid}_${toUid}`;
await firebaseServices.db.collection(‘friendRequests’).doc(requestId).set({
from: fromUid,
to: toUid,
fromUsername: fromUser.username,
toUsername: toUser.username,
status: ‘pending’,
timestamp: firebaseServices.Timestamp.now()
});
return true;
} catch (error) {
console.error(‘Error sending friend request:’, error);
Utils.handleFirebaseError(error);
return false;
}
},

async acceptFriendRequest(requestId, fromUid, toUid) {
if (!requestId || !fromUid || !toUid) return false;
try {
const batch = firebaseServices.db.batch();
const requestRef = firebaseServices.db.collection(‘friendRequests’).doc(requestId);
batch.update(requestRef, { status: ‘accepted’ });

```
  const fromRef = firebaseServices.db.collection('users').doc(fromUid); 
  const toRef = firebaseServices.db.collection('users').doc(toUid); 
  
  const [fromDoc, toDoc] = await Promise.all([
    fromRef.get(),
    toRef.get()
  ]);
  
  const fromFriendIds = fromDoc.data()?.friendIds || [];
  const toFriendIds = toDoc.data()?.friendIds || [];
  
  batch.update(fromRef, { 
    friendIds: firebaseServices.FieldValue.arrayUnion(toUid), 
    friendsCount: fromFriendIds.length + 1
  }); 
  batch.update(toRef, { 
    friendIds: firebaseServices.FieldValue.arrayUnion(fromUid), 
    friendsCount: toFriendIds.length + 1
  }); 
  
  await batch.commit(); 
  return true; 
} catch (error) { 
  console.error('Error accepting friend request:', error); 
  Utils.handleFirebaseError(error);
  return false; 
} 
```

},

async rejectFriendRequest(requestId) {
if (!requestId) return false;
try {
await firebaseServices.db.collection(‘friendRequests’).doc(requestId).update({ status: ‘rejected’ });
return true;
} catch (error) {
console.error(‘Error rejecting friend request:’, error);
Utils.handleFirebaseError(error);
return false;
}
},

async getFriendRequests(uid) {
if (!uid) return [];
try {
const snapshot = await firebaseServices.db.collection(‘friendRequests’)
.where(‘to’, ‘==’, uid)
.where(‘status’, ‘==’, ‘pending’)
.orderBy(‘timestamp’, ‘desc’)
.get();
return snapshot.docs.map(doc => ({ id: doc.id, …doc.data() }));
} catch (error) {
console.error(‘Error getting friend requests:’, error);
Utils.handleFirebaseError(error);
return [];
}
},

async getFriends(uid) {
if (!uid) return [];
try {
const userDoc = await firebaseServices.db.collection(‘users’).doc(uid).get();
const friendIds = userDoc.data()?.friendIds || [];
if (friendIds.length === 0) return [];
const friendPromises = friendIds.map(fid => firebaseServices.db.collection(‘users’).doc(fid).get());
const snapshots = await Promise.all(friendPromises);
const friends = snapshots.filter(doc => doc.exists).map(doc => ({ uid: doc.id, …doc.data() }));
return friends;
} catch (error) {
console.error(‘Error getting friends:’, error);
Utils.handleFirebaseError(error);
return [];
}
},

async removeFriend(uid, friendUid) {
if (!uid || !friendUid) return false;
try {
const batch = firebaseServices.db.batch();
const userRef = firebaseServices.db.collection(‘users’).doc(uid);
const friendRef = firebaseServices.db.collection(‘users’).doc(friendUid);

```
  const [userDoc, friendDoc] = await Promise.all([
    userRef.get(),
    friendRef.get()
  ]);
  
  const userFriendIds = userDoc.data()?.friendIds || [];
  const friendFriendIds = friendDoc.data()?.friendIds || [];
  
  batch.update(userRef, { 
    friendIds: firebaseServices.FieldValue.arrayRemove(friendUid), 
    friendsCount: Math.max(0, userFriendIds.length - 1)
  }); 
  batch.update(friendRef, { 
    friendIds: firebaseServices.FieldValue.arrayRemove(uid), 
    friendsCount: Math.max(0, friendFriendIds.length - 1)
  }); 
  
  await batch.commit(); 
  return true; 
} catch (error) { 
  console.error('Error removing friend:', error); 
  Utils.handleFirebaseError(error);
  return false; 
} 
```

},

async uploadProfilePicture(uid, file) {
if (!uid || !file) return null;
try {
const ref = firebaseServices.storage.ref(`profile_pictures/${uid}/avatar.jpg`);
await ref.put(file);
const downloadURL = await ref.getDownloadURL();
await firebaseServices.db.collection(‘users’).doc(uid).update({
‘profile.photoURL’: downloadURL
});
return downloadURL;
} catch (error) {
console.error(‘Error uploading profile picture:’, error);
Utils.handleFirebaseError(error);
return null;
}
},

async deleteProfilePicture(uid) {
if (!uid) return false;
try {
const ref = firebaseServices.storage.ref(`profile_pictures/${uid}/avatar.jpg`);
await ref.delete();
await firebaseServices.db.collection(‘users’).doc(uid).update({
‘profile.photoURL’: null
});
return true;
} catch (error) {
console.error(‘Error deleting profile picture:’, error);
Utils.handleFirebaseError(error);
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
if (!AppState || !AppState.currentUserId) return;

```
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
  Utils.showToast('✅ Cálculos pendientes sincronizados', 'success'); 
else 
  Utils.showToast(`⚠️ ${nuevosPendientes.length} cálculos pendientes no pudieron sincronizarse`, 'warning'); 
```

},

async getAdminMessagesPaginated(limit = 10, startAfter = null) {
try {
let query = firebaseServices.db.collection(‘mensajes’)
.where(’**name**’, ‘>=’, ‘admin_’)
.where(’**name**’, ‘<’, ‘admin_\uf8ff’)
.orderBy(’**name**’)
.limit(limit);
if (startAfter) query = query.startAfter(startAfter);
const snapshot = await query.get();
const docs = snapshot.docs;
const lastDoc = docs.length === limit ? docs[docs.length - 1] : null;
return { docs, lastDoc };
} catch (error) {
console.error(‘Error paginating admin messages:’, error);
Utils.handleFirebaseError(error);
return { docs: [], lastDoc: null };
}
}
};

window.Storage = Storage;