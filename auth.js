// ==================== auth.js - VERSIÓN FINAL CORREGIDA ====================
const Auth = {
  intentosLogin: 0,
  ultimoIntento: 0,

  _manejarErrorFirebase(error) {
    switch (error.code) {
      case 'auth/invalid-email': return '📧 Correo inválido.';
      case 'auth/user-disabled': return '🚫 Cuenta deshabilitada.';
      case 'auth/user-not-found': return '❌ Cuenta no existe.';
      case 'auth/wrong-password': return '🔑 Contraseña incorrecta.';
      case 'auth/email-already-in-use': return '📧 Correo ya registrado.';
      case 'auth/weak-password': return '🔒 Mínimo 6 caracteres.';
      case 'auth/network-request-failed': return '🌐 Error de red.';
      case 'auth/too-many-requests': return '⏳ Demasiados intentos.';
      case 'auth/requires-recent-login': return '⚠️ Vuelve a iniciar sesión.';
      case 'permission-denied': return '🔒 Permiso denegado.';
      default: return `⚠️ ${error.message}`;
    }
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
      document.querySelector('.auth-tab').classList.add('active');
      document.getElementById('loginForm').classList.add('active');
    } else {
      document.querySelectorAll('.auth-tab')[1].classList.add('active');
      document.getElementById('registerForm').classList.add('active');
    }
    document.getElementById('loginError')?.classList.remove('visible');
    document.getElementById('registerError')?.classList.remove('visible');
  },

  async createUserDocument(userId, email, username, extraData = {}, isRetry = false) {
    const now = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    const mesActual = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const premiumValue = isRetry ? false : true;
    const userData = {
      username, username_lowercase: username.toLowerCase(), email,
      created: now.toISOString(), expires: expiry.toISOString(), premium: premiumValue,
      isAdmin: false, emailVerified: false, calculosMes: 0, mesActual, uid: userId,
      lastLogin: firebaseServices.Timestamp.now(),
      profile: { bio: '', city: '', age: null, gender: '', weight: null, height: null, privacySettings: { showTrainings: 'friends', showProfile: 'public' } },
      friendIds: [], friendsCount: 0, ...extraData
    };
    await firebaseServices.db.collection('users').doc(userId).set(userData);
    if (isRetry) {
      await firebaseServices.db.collection('users').doc(userId).update({ premium: true });
      userData.premium = true;
    }
    const mensajesRef = firebaseServices.db.collection('mensajes').doc(userId);
    const mensajesDoc = await mensajesRef.get();
    if (!mensajesDoc.exists) {
      await mensajesRef.set({ mensajes: [{
        fecha: new Date().toLocaleString(),
        texto: "👋 Bienvenido a RI5! Soporte directo con el administrador.",
        leido: false, esAdmin: true, timestamp: firebaseServices.Timestamp.now()
      }] });
    }
    return userData;
  },

  async registerUser() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorEl = document.getElementById('registerError');
    const btn = document.getElementById('registerBtn');
    errorEl.classList.remove('visible');
    if (!username || !email || !password) {
      errorEl.innerText = "⚠️ Completa todos los campos.";
      errorEl.classList.add('visible');
      return;
    }
    if (username.length < 3) {
      errorEl.innerText = "⚠️ El nombre debe tener al menos 3 caracteres.";
      errorEl.classList.add('visible');
      return;
    }
    if (password.length < 6) {
      errorEl.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
      errorEl.classList.add('visible');
      return;
    }
    if (!Utils.isValidEmail(email)) {
      errorEl.innerText = "⚠️ El correo no es válido.";
      errorEl.classList.add('visible');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errorEl.innerText = "⚠️ Solo letras, números y guión bajo.";
      errorEl.classList.add('visible');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'REGISTRANDO...';
    try {
      const usernameDoc = await firebaseServices.db.collection('usernames').doc(username).get();
      if (usernameDoc.exists) throw new Error('username_taken');
      const methods = await firebaseServices.auth.fetchSignInMethodsForEmail(email);
      if (methods.length > 0) throw new Error('email_in_use');
      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await firebaseServices.db.collection('usernames').doc(username).set({ uid: user.uid, createdAt: firebaseServices.Timestamp.now() });
      let userData;
      try {
        userData = await this.createUserDocument(user.uid, email, username, {}, false);
      } catch (firstError) {
        if (firstError.code === 'permission-denied' || firstError.message.includes('permission')) {
          userData = await this.createUserDocument(user.uid, email, username, {}, true);
        } else {
          throw firstError;
        }
      }
      await AppState.setCurrentUser(user.uid, email, userData);
      await this._enablePersistence();
      Utils.showToast('✅ Registro exitoso', 'success');
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      const expiryDate = new Date(userData.expires);
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) welcomeEl.innerText = `> BIENVENIDO, ${username.toUpperCase()} · PREMIUM HASTA ${expiryDate.toLocaleDateString()}`;
      const nameField = document.getElementById('name');
      if (nameField) nameField.value = username;
      if (window.UI) {
        UI.changeDailyTip();
        UI.startConsejoAutoChange();
        const msgs = await Storage.getMensajesUsuario(user.uid);
        AppState.mensajesNoLeidos = msgs.filter(m => !m.leido && m.esAdmin).length;
        UI.actualizarBadgeMensajes();
      }
    } catch (error) {
      console.error(error);
      let userMessage = '';
      if (error.message === 'username_taken') userMessage = "⚠️ Nombre de usuario ya en uso.";
      else if (error.message === 'email_in_use') userMessage = "⚠️ Correo ya registrado.";
      else userMessage = this._manejarErrorFirebase(error);
      errorEl.innerText = userMessage;
      errorEl.classList.add('visible');
      document.getElementById('regPassword').value = '';
    } finally {
      btn.disabled = false;
      btn.textContent = '[ REGISTRARSE ]';
    }
  },

  async loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errorEl.classList.remove('visible');
    if (!email || !password) {
      errorEl.innerText = "⚠️ Introduce correo y contraseña.";
      errorEl.classList.add('visible');
      return;
    }
    if (!Utils.isValidEmail(email)) {
      errorEl.innerText = "⚠️ El correo no es válido.";
      errorEl.classList.add('visible');
      return;
    }
    const ahora = Date.now();
    if (ahora - this.ultimoIntento < 2000) {
      errorEl.innerText = "⏳ Espera 2 segundos.";
      errorEl.classList.add('visible');
      return;
    }
    this.intentosLogin++;
    this.ultimoIntento = ahora;
    if (this.intentosLogin > 5) {
      errorEl.innerText = "⏳ Demasiados intentos. Espera 1 minuto.";
      errorEl.classList.add('visible');
      setTimeout(() => { this.intentosLogin = 0; }, 60000);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'ACCEDIENDO...';
    try {
      const userCredential = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      const userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.floor(Math.random() * 1000);
        const userData = await this.createUserDocument(user.uid, email, username);
        await AppState.setCurrentUser(user.uid, email, userData);
      } else {
        const userData = userDoc.data();
        await AppState.setCurrentUser(user.uid, email, userData);
      }
      const ahora2 = new Date();
      const mesActual = `${ahora2.getFullYear()}-${ahora2.getMonth() + 1}`;
      const updates = { lastLogin: firebaseServices.Timestamp.now() };
      if (AppState.currentUserData.mesActual !== mesActual) {
        updates.calculosMes = 0;
        updates.mesActual = mesActual;
        AppState.currentUserData.calculosMes = 0;
        AppState.currentUserData.mesActual = mesActual;
      }
      await firebaseServices.db.collection('users').doc(user.uid).update(updates);
      await this._enablePersistence();
      Utils.showToast(`✅ Bienvenido, ${AppState.currentUserData.username}`, 'success');
      this.intentosLogin = 0;
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        const expiry = new Date(AppState.currentUserData.expires);
        welcomeEl.innerText = `> BIENVENIDO, ${AppState.currentUserData.username.toUpperCase()} · ${AppState.currentUserData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${expiry.toLocaleDateString()}`;
      }
      const nameField = document.getElementById('name');
      if (nameField) nameField.value = AppState.currentUserData.username;
      if (window.UI) {
        UI.changeDailyTip();
        UI.startConsejoAutoChange();
        await UI.cargarMensajesRecibidos();
        await UI.cargarMensajesEnviados();
      }
      const calc = await Storage.getUltimoCalculo(user.uid);
      if (calc) {
        AppState.setLastCalc(calc);
        if (window.UI) UI.mostrarResultadosGuardados(calc);
      }
    } catch (error) {
      console.error(error);
      errorEl.innerText = this._manejarErrorFirebase(error);
      errorEl.classList.add('visible');
      document.getElementById('loginPassword').value = '';
    } finally {
      btn.disabled = false;
      btn.textContent = '[ ACCEDER ]';
    }
  },

  async _enablePersistence() {
    try {
      await firebaseServices.db.enablePersistence({ synchronizeTabs: true });
    } catch (err) {
      console.warn('Persistencia no disponible:', err);
    }
  },

  async _reauthenticateUser(password) {
    const user = firebaseServices.auth.currentUser;
    if (!user) throw new Error('No hay usuario autenticado');
    // LÍNEA CORREGIDA: usar firebase.auth (global)
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(credential);
    return true;
  },

  async eliminarMiCuenta() {
    const email = prompt('Introduce tu correo electrónico:');
    if (!email) return;
    const password = prompt('Introduce tu contraseña:');
    if (!password) return;
    const confirmed = await Utils.confirm('ELIMINAR CUENTA', `¿ELIMINAR "${email}"?\n\nACCIÓN IRREVERSIBLE`);
    if (!confirmed) return;
    Utils.showLoading();
    try {
      let currentUser = firebaseServices.auth.currentUser;
      if (!currentUser) {
        const userCred = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
        currentUser = userCred.user;
      } else if (currentUser.email !== email) {
        await firebaseServices.auth.signOut();
        const userCred = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
        currentUser = userCred.user;
      }
      try {
        await this._reauthenticateUser(password);
      } catch (reauthError) {
        if (reauthError.code === 'auth/requires-recent-login') {
          await firebaseServices.auth.signOut();
          const userCred = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
          currentUser = userCred.user;
          await this._reauthenticateUser(password);
        } else {
          throw reauthError;
        }
      }
      const uid = currentUser.uid;
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      const username = userDoc.exists ? userDoc.data().username : null;
      const userRef = firebaseServices.db.collection('users').doc(uid);
      const friendIds = userDoc.data()?.friendIds || [];
      if (friendIds.length) {
        const batch = firebaseServices.db.batch();
        for (const fid of friendIds) {
          const friendRef = firebaseServices.db.collection('users').doc(fid);
          batch.update(friendRef, { friendIds: firebaseServices.FieldValue.arrayRemove(uid), friendsCount: firebaseServices.FieldValue.increment(-1) });
        }
        await batch.commit();
      }
      const historial = await userRef.collection('historial').get();
      const b1 = firebaseServices.db.batch();
      historial.docs.forEach(d => b1.delete(d.ref));
      await b1.commit();
      const planes = await userRef.collection('planes').get();
      for (const p of planes.docs) {
        const sesiones = await p.ref.collection('sesiones').get();
        const b2 = firebaseServices.db.batch();
        sesiones.docs.forEach(s => b2.delete(s.ref));
        await b2.commit();
        await p.ref.delete();
      }
      const calculos = await userRef.collection('calculos').get();
      const b3 = firebaseServices.db.batch();
      calculos.docs.forEach(c => b3.delete(c.ref));
      await b3.commit();
      await firebaseServices.db.collection('mensajes').doc(uid).delete();
      await firebaseServices.db.collection('mensajes').doc('admin_' + uid).delete();
      await userRef.delete();
      if (username) await firebaseServices.db.collection('usernames').doc(username).delete();
      await currentUser.delete();
      await AppState.setCurrentUser(null, null);
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";
      Utils.showToast('✅ CUENTA ELIMINADA', 'success');
    } catch (error) {
      console.error(error);
      let msg = '';
      if (error.code === 'auth/wrong-password') msg = '❌ Contraseña incorrecta.';
      else if (error.code === 'auth/user-not-found') msg = '❌ No existe cuenta con ese correo.';
      else if (error.code === 'auth/requires-recent-login') msg = '⚠️ Vuelve a iniciar sesión y reintenta.';
      else msg = this._manejarErrorFirebase(error);
      Utils.showToast(msg, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async logoutUser() {
    const ok = await Utils.confirm('CERRAR SESIÓN', '> ¿CERRAR SESIÓN?_');
    if (!ok) return;
    Utils.showLoading();
    try {
      await firebaseServices.auth.signOut();
      await AppState.setCurrentUser(null, null);
      AppState.limpiarDatosPlan();
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";
      document.getElementById("loginEmail").value = '';
      document.getElementById("loginPassword").value = '';
      document.getElementById("results").innerHTML = '';
      document.getElementById("calendarioEntreno").style.display = "none";
      AppState.clearLastCalc();
      sessionStorage.removeItem('ri5_estado');
      localStorage.removeItem('ri5_current_user');
      localStorage.removeItem('ri5_user_email');
      localStorage.removeItem('ri5_is_admin');
      Utils.showToast('✅ Sesión cerrada', 'success');
    } catch (error) {
      console.error(error);
      Utils.showToast('Error al cerrar sesión', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async checkSavedSession() {
    const uid = localStorage.getItem('ri5_current_user');
    if (!uid) return false;
    try {
      if (!navigator.onLine) {
        const userData = JSON.parse(localStorage.getItem('ri5_user_data') || 'null');
        if (userData) {
          await AppState.setCurrentUser(uid, userData.email, userData);
          return true;
        }
        return false;
      }
      const user = firebaseServices.auth.currentUser;
      if (!user || user.uid !== uid) {
        localStorage.removeItem('ri5_current_user');
        return false;
      }
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        localStorage.removeItem('ri5_current_user');
        return false;
      }
      const userData = userDoc.data();
      localStorage.setItem('ri5_user_data', JSON.stringify(userData));
      const now = new Date();
      const expiry = new Date(userData.expires);
      if (now > expiry && !userData.premium) {
        localStorage.removeItem('ri5_current_user');
        return false;
      }
      await AppState.setCurrentUser(uid, userData.email, userData);
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) welcomeEl.innerText = `> BIENVENIDO, ${userData.username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${expiry.toLocaleDateString()}`;
      const nameField = document.getElementById('name');
      if (nameField) nameField.value = userData.username;
      if (window.UI) {
        UI.changeDailyTip();
        UI.startConsejoAutoChange();
      }
      AppState.actualizarInterfazPremium();
      const calc = await Storage.getUltimoCalculo(uid);
      if (calc) {
        AppState.setLastCalc(calc);
        if (window.UI) UI.mostrarResultadosGuardados(calc);
      }
      await this._enablePersistence();
      await firebaseServices.db.collection('users').doc(uid).update({ lastLogin: firebaseServices.Timestamp.now() }).catch(() => {});
      return true;
    } catch (error) {
      console.error(error);
      localStorage.removeItem('ri5_current_user');
      return false;
    }
  },

  showPremiumBenefits() {
    document.getElementById('premiumOverlay').classList.add('active');
    document.getElementById('premiumModal').classList.add('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  if (loginEmail) loginEmail.addEventListener('input', () => document.getElementById('loginError')?.classList.remove('visible'));
  if (loginPassword) loginPassword.addEventListener('input', () => document.getElementById('loginError')?.classList.remove('visible'));
  const regUsername = document.getElementById('regUsername');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  if (regUsername) regUsername.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
  if (regEmail) regEmail.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
  if (regPassword) regPassword.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
});

window.switchAuthTab = Auth.switchAuthTab.bind(Auth);
window.registerUser = Auth.registerUser.bind(Auth);
window.loginUser = Auth.loginUser.bind(Auth);
window.logoutUser = Auth.logoutUser.bind(Auth);
window.showPremiumBenefits = Auth.showPremiumBenefits;
window.eliminarMiCuenta = Auth.eliminarMiCuenta.bind(Auth);