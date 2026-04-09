// ==================== auth.js - VERSIÓN DEFINITIVA CON ELIMINACIÓN DE CUENTA SIN LOGOUT FORZADO ====================
// Versión: 3.18 - Eliminación de cuenta renueva sesión automáticamente si es antigua
// ====================

const Auth = {
  intentosLogin: 0,
  ultimoIntento: 0,

  _manejarErrorFirebase(error) {
    switch (error.code) {
      case 'auth/invalid-email':
        return '📧 El correo electrónico no es válido.';
      case 'auth/user-disabled':
        return '🚫 Esta cuenta ha sido deshabilitada. Contacta con soporte.';
      case 'auth/user-not-found':
        return '❌ No existe ninguna cuenta con este correo.';
      case 'auth/wrong-password':
        return '🔑 Contraseña incorrecta. Inténtalo de nuevo.';
      case 'auth/email-already-in-use':
        return '📧 Este correo ya está registrado. Inicia sesión o usa otro.';
      case 'auth/weak-password':
        return '🔒 La contraseña debe tener al menos 6 caracteres.';
      case 'auth/network-request-failed':
        return '🌐 Error de conexión. Comprueba tu internet.';
      case 'auth/too-many-requests':
        return '⏳ Demasiados intentos. Espera un momento y vuelve a intentarlo.';
      case 'auth/requires-recent-login':
        return '⚠️ Por seguridad, debes volver a iniciar sesión antes de eliminar la cuenta.';
      case 'permission-denied':
        return '🔒 Error de permisos. Si persiste, contacta con soporte.';
      default:
        return `⚠️ Error inesperado: ${error.message}`;
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
      username,
      username_lowercase: username.toLowerCase(),
      email,
      created: now.toISOString(),
      expires: expiry.toISOString(),
      premium: premiumValue,
      isAdmin: false,
      emailVerified: false,
      calculosMes: 0,
      mesActual,
      uid: userId,
      lastLogin: firebaseServices.Timestamp.now(),
      profile: {
        bio: '',
        city: '',
        age: null,
        gender: '',
        weight: null,
        height: null,
        privacySettings: {
          showTrainings: 'friends',
          showProfile: 'public'
        }
      },
      friendIds: [],
      friendsCount: 0,
      ...extraData
    };

    console.log(`📝 Creando documento de usuario en Firestore (premium: ${premiumValue})...`);
    await firebaseServices.db.collection('users').doc(userId).set(userData);
    console.log('✅ Documento de usuario creado');

    if (isRetry) {
      console.log('🔄 Actualizando a premium true...');
      await firebaseServices.db.collection('users').doc(userId).update({ premium: true });
      console.log('✅ Actualizado a premium true');
      userData.premium = true;
    }

    const mensajesRef = firebaseServices.db.collection('mensajes').doc(userId);
    const mensajesDoc = await mensajesRef.get();
    if (!mensajesDoc.exists) {
      const mensajeBienvenida = {
        fecha: new Date().toLocaleString(),
        texto: "👋 ¡Bienvenido a RI5! Este es tu espacio de soporte directo con el administrador. Aquí recibirás notificaciones importantes y puedes enviar tus consultas. ¡Disfruta de la app! 🏃",
        leido: false,
        esAdmin: true,
        timestamp: firebaseServices.Timestamp.now()
      };
      await mensajesRef.set({ mensajes: [mensajeBienvenida] });
      console.log('✅ Mensaje de bienvenida creado');
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
    errorEl.innerText = '';

    if (!username || !email || !password) {
      errorEl.innerText = "⚠️ Completa todos los campos.";
      errorEl.classList.add('visible');
      return;
    }
    if (username.length < 3) {
      errorEl.innerText = "⚠️ El nombre de usuario debe tener al menos 3 caracteres.";
      errorEl.classList.add('visible');
      return;
    }
    if (password.length < 6) {
      errorEl.innerText = "⚠️ La contraseña debe tener al menos 6 caracteres.";
      errorEl.classList.add('visible');
      return;
    }
    if (!Utils.isValidEmail(email)) {
      errorEl.innerText = "⚠️ El correo electrónico no es válido.";
      errorEl.classList.add('visible');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errorEl.innerText = "⚠️ Solo se permiten letras, números y guión bajo en el usuario.";
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'REGISTRANDO...';

    try {
      // Verificar username
      const usernameDoc = await firebaseServices.db.collection('usernames').doc(username).get();
      if (usernameDoc.exists) {
        throw new Error('username_taken');
      }

      // Verificar email en Auth
      const methods = await firebaseServices.auth.fetchSignInMethodsForEmail(email);
      if (methods.length > 0) {
        throw new Error('email_in_use');
      }

      // Crear usuario en Auth
      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Reservar username
      await firebaseServices.db.collection('usernames').doc(username).set({
        uid: user.uid,
        createdAt: firebaseServices.Timestamp.now()
      });

      // Crear documento de usuario (con reintento si falla por premium)
      let userData;
      try {
        userData = await this.createUserDocument(user.uid, email, username, {}, false);
      } catch (firstError) {
        console.warn('⚠️ Error creando documento con premium true:', firstError);
        if (firstError.code === 'permission-denied' || firstError.message.includes('permission')) {
          console.log('🔄 Reintentando con premium false...');
          userData = await this.createUserDocument(user.uid, email, username, {}, true);
        } else {
          throw firstError;
        }
      }

      // Actualizar estado global
      await AppState.setCurrentUser(user.uid, email, userData);
      await this._enablePersistence();

      Utils.showToast('✅ Registro exitoso', 'success');

      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";

      const expiryDate = new Date(userData.expires);
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        welcomeEl.innerText = `> BIENVENIDO, ${username.toUpperCase()} · PREMIUM HASTA ${expiryDate.toLocaleDateString()}`;
      }

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
      console.error('❌ Error en registro:', error);
      let userMessage = '';
      if (error.message === 'username_taken') {
        userMessage = "⚠️ El nombre de usuario ya está en uso. Elige otro.";
      } else if (error.message === 'email_in_use') {
        userMessage = "⚠️ El correo ya está registrado. Inicia sesión.";
      } else {
        userMessage = this._manejarErrorFirebase(error);
        alert(`Error detallado:\n${error.code || error.message}`);
      }
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
    errorEl.innerText = '';

    if (!email || !password) {
      errorEl.innerText = "⚠️ Introduce correo y contraseña.";
      errorEl.classList.add('visible');
      return;
    }

    if (!Utils.isValidEmail(email)) {
      errorEl.innerText = "⚠️ El correo electrónico no es válido.";
      errorEl.classList.add('visible');
      return;
    }

    const ahora = Date.now();
    if (ahora - this.ultimoIntento < 2000) {
      errorEl.innerText = "⏳ Espera 2 segundos antes de reintentar.";
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
        console.log('⚠️ Usuario autenticado sin documento en Firestore, creándolo...');
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

      const msgs = await Storage.getMensajesUsuario(user.uid);
      AppState.mensajesNoLeidos = msgs.filter(m => !m.leido && m.esAdmin).length;
      if (window.UI) UI.actualizarBadgeMensajes();

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

      console.log('✅ Login completado exitosamente');

    } catch (error) {
      console.error('❌ Error en login:', error);
      const errorMsg = this._manejarErrorFirebase(error);
      errorEl.innerText = errorMsg;
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
      console.log('✅ Persistencia offline habilitada');
    } catch (err) {
      console.warn('⚠️ Persistencia no disponible:', err);
    }
  },

  async _reauthenticateUser(password) {
    const user = firebaseServices.auth.currentUser;
    if (!user) throw new Error('No hay usuario autenticado');
    const credential = firebaseServices.auth.EmailAuthProvider.credential(user.email, password);
    await user.reauthenticateWithCredential(credential);
    return true;
  },

  // ==================== FUNCIÓN CORREGIDA: elimina cuenta sin cerrar sesión forzadamente ====================
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

      // Si no hay usuario autenticado, intentamos iniciar sesión directamente
      if (!currentUser) {
        const userCred = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
        currentUser = userCred.user;
      } else if (currentUser.email !== email) {
        throw new Error(`El email introducido (${email}) no coincide con el de la sesión actual (${currentUser.email}).`);
      }

      // Verificar si la sesión es reciente; si no, renovar con signIn
      try {
        await this._reauthenticateUser(password);
      } catch (reauthError) {
        if (reauthError.code === 'auth/requires-recent-login') {
          // Sesión antigua: realizamos un nuevo login para actualizar el token
          console.log('🔄 Sesión antigua, renovando autenticación...');
          await firebaseServices.auth.signInWithEmailAndPassword(email, password);
          // Actualizar currentUser después del nuevo login
          currentUser = firebaseServices.auth.currentUser;
          // Reintentar reautenticación (ahora debería funcionar)
          await this._reauthenticateUser(password);
        } else {
          throw reauthError;
        }
      }

      const uid = currentUser.uid;
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      const username = userDoc.exists ? userDoc.data().username : null;
      const userRef = firebaseServices.db.collection('users').doc(uid);
      const userData = userDoc.data();
      const friendIds = userData?.friendIds || [];

      // Eliminar referencias de amigos
      if (friendIds.length > 0) {
        const batch = firebaseServices.db.batch();
        for (const friendId of friendIds) {
          const friendRef = firebaseServices.db.collection('users').doc(friendId);
          batch.update(friendRef, {
            friendIds: firebaseServices.FieldValue.arrayRemove(uid),
            friendsCount: firebaseServices.FieldValue.increment(-1)
          });
        }
        await batch.commit();
      }

      // Eliminar subcolecciones
      const historialSnapshot = await userRef.collection('historial').get();
      const batch1 = firebaseServices.db.batch();
      historialSnapshot.docs.forEach(doc => batch1.delete(doc.ref));
      await batch1.commit();

      const planesSnapshot = await userRef.collection('planes').get();
      for (const planDoc of planesSnapshot.docs) {
        const sesionesSnapshot = await planDoc.ref.collection('sesiones').get();
        const batch2 = firebaseServices.db.batch();
        sesionesSnapshot.docs.forEach(doc => batch2.delete(doc.ref));
        await batch2.commit();
        await planDoc.ref.delete();
      }

      const calculosSnapshot = await userRef.collection('calculos').get();
      const batch3 = firebaseServices.db.batch();
      calculosSnapshot.docs.forEach(doc => batch3.delete(doc.ref));
      await batch3.commit();

      // Eliminar mensajes
      await firebaseServices.db.collection('mensajes').doc(uid).delete();
      await firebaseServices.db.collection('mensajes').doc('admin_' + uid).delete();

      // Eliminar documento de usuario
      await userRef.delete();

      if (username) {
        await firebaseServices.db.collection('usernames').doc(username).delete();
      }

      // Eliminar cuenta de autenticación
      await currentUser.delete();

      // Limpiar estado y redirigir a login
      await AppState.setCurrentUser(null, null);
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";

      Utils.showToast('✅ CUENTA ELIMINADA', 'success');

    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      let userMessage = '';
      if (error.code === 'auth/wrong-password') {
        userMessage = '❌ Contraseña incorrecta. No se pudo eliminar la cuenta.';
      } else if (error.code === 'auth/requires-recent-login') {
        userMessage = '⚠️ Por seguridad, debes volver a iniciar sesión. Inténtalo de nuevo.';
      } else if (error.message && error.message.includes('no coincide')) {
        userMessage = error.message;
      } else {
        userMessage = this._manejarErrorFirebase(error);
      }
      Utils.showToast(userMessage, 'error');
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
      console.error('Error en logout:', error);
      Utils.showToast('Error al cerrar sesión', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async checkSavedSession() {
    const uid = localStorage.getItem('ri5_current_user');
    if (!uid) return false;

    try {
      console.log('🔍 Verificando sesión guardada:', uid);

      if (!navigator.onLine) {
        console.log('⚠️ Sin conexión, usando datos locales');
        const userData = JSON.parse(localStorage.getItem('ri5_user_data') || 'null');
        if (userData) {
          await AppState.setCurrentUser(uid, userData.email, userData);
          return true;
        }
        return false;
      }

      const user = firebaseServices.auth.currentUser;
      if (!user) {
        console.log('❌ No hay usuario en Auth');
        localStorage.removeItem('ri5_current_user');
        return false;
      }

      if (user.uid !== uid) {
        console.log('❌ UID no coincide con Auth');
        localStorage.removeItem('ri5_current_user');
        return false;
      }

      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        console.log('❌ Usuario no encontrado en Firestore');
        localStorage.removeItem('ri5_current_user');
        return false;
      }

      const userData = userDoc.data();
      localStorage.setItem('ri5_user_data', JSON.stringify(userData));

      const now = new Date();
      const expiry = new Date(userData.expires);
      if (now > expiry && !userData.premium) {
        console.log('❌ Usuario expirado');
        localStorage.removeItem('ri5_current_user');
        return false;
      }

      console.log('✅ Sesión válida para:', userData.username);
      await AppState.setCurrentUser(uid, userData.email, userData);

      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";

      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        welcomeEl.innerText = `> BIENVENIDO, ${userData.username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${expiry.toLocaleDateString()}`;
      }

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

      try {
        await firebaseServices.db.collection('users').doc(uid).update({
          lastLogin: firebaseServices.Timestamp.now()
        });
      } catch (e) { }

      return true;

    } catch (error) {
      console.error('Error checking session:', error);
      localStorage.removeItem('ri5_current_user');
      return false;
    }
  },

  showPremiumBenefits() {
    document.getElementById('premiumOverlay').classList.add('active');
    document.getElementById('premiumModal').classList.add('active');
  }
};

// Inicializar listeners
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