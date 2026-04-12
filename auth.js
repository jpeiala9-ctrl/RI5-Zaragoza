// ==================== auth.js - LOGIN CON EMAIL (MANEJADOR DE ERRORES AMIGABLE) ====================
// Versión: 3.14 - Modificada eliminación de cuenta: envía solicitud al administrador (sin borrar)
// ====================

const Auth = {
  intentosLogin: 0,
  ultimoIntento: 0,

  // Manejador de errores amigable (privado)
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

  async createUserDocument(userId, email, username, extraData = {}) {
    const now = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    const mesActual = `${now.getFullYear()}-${now.getMonth() + 1}`;

    const userData = {
      username,
      username_lowercase: username.toLowerCase(),
      email,
      created: now.toISOString(),
      expires: expiry.toISOString(),
      premium: true,
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

    console.log('📝 Creando documento de usuario en Firestore...');
    await firebaseServices.db.collection('users').doc(userId).set(userData);
    console.log('✅ Documento de usuario creado');

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

    // Validaciones previas
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
      // Verificar nombre de usuario
      const usernameDoc = await firebaseServices.db.collection('usernames').doc(username).get();
      if (usernameDoc.exists) {
        errorEl.innerText = "⚠️ El nombre de usuario ya está en uso. Elige otro.";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }

      // Verificar email en Auth
      const methods = await firebaseServices.auth.fetchSignInMethodsForEmail(email);
      if (methods.length > 0) {
        errorEl.innerText = "⚠️ El correo ya está registrado. Inicia sesión.";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }

      // Crear usuario en Auth
      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Reservar username
      await firebaseServices.db.collection('usernames').doc(username).set({
        uid: user.uid,
        createdAt: firebaseServices.Timestamp.now()
      });

      // Crear documento de usuario
      const userData = await this.createUserDocument(user.uid, email, username);

      // Actualizar estado global
      await AppState.setCurrentUser(user.uid, email, userData);

      // Habilitar persistencia offline
      await this._enablePersistence();

      Utils.showToast('✅ Registro exitoso', 'success');

      // Mostrar interfaz principal
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
      const errorMsg = this._manejarErrorFirebase(error);
      errorEl.innerText = errorMsg;
      errorEl.classList.add('visible');
      // Limpiar campo contraseña
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
      // Limpiar campo contraseña por seguridad
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

  // Reautenticación (corregida: usar firebase.auth global)
  async _reauthenticateUser(password) {
    const user = firebaseServices.auth.currentUser;
    if (!user) throw new Error('No hay usuario autenticado');
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    try {
      await user.reauthenticateWithCredential(credential);
      return true;
    } catch (error) {
      console.error('Error en reautenticación:', error);
      throw error;
    }
  },

  // ==================== NUEVA FUNCIÓN: SOLICITUD DE ELIMINACIÓN (solo envía mensaje al admin) ====================
  async eliminarMiCuenta() {
    const currentUser = firebaseServices.auth.currentUser;
    if (!currentUser) {
      Utils.showToast('❌ No hay sesión activa.', 'error');
      return;
    }

    const email = currentUser.email;
    const uid = currentUser.uid;

    // Obtener nombre de usuario desde Firestore (opcional)
    let username = 'Usuario';
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (userDoc.exists) username = userDoc.data().username || 'Usuario';
    } catch (e) {
      console.warn('No se pudo obtener el username', e);
    }

    const confirmed = await Utils.confirm(
      'SOLICITAR ELIMINACIÓN DE CUENTA',
      `¿SOLICITAR la eliminación de la cuenta "${email}"?\n\nSe enviará una notificación al administrador y se cerrará tu sesión.\n\nEl administrador procesará tu solicitud manualmente.`
    );
    if (!confirmed) return;

    Utils.showLoading();

    try {
      // Enviar mensaje al administrador (colección mensajes, documento 'admin_solicitudes')
      const adminMsgRef = firebaseServices.db.collection('mensajes').doc('admin_solicitudes');
      const newMessage = {
        fecha: new Date().toLocaleString(),
        texto: `📢 SOLICITUD DE ELIMINACIÓN DE CUENTA\nUsuario: ${username}\nEmail: ${email}\nUID: ${uid}\n\nEl usuario solicita la eliminación de su cuenta.`,
        leido: false,
        esUsuario: true,
        timestamp: firebaseServices.Timestamp.now()
      };
      await adminMsgRef.set({
        mensajes: firebaseServices.FieldValue.arrayUnion(newMessage)
      }, { merge: true });

      // Cerrar sesión
      await firebaseServices.auth.signOut();
      await AppState.setCurrentUser(null, null);
      AppState.limpiarDatosPlan();

      document.getElementById("mainContent").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";

      Utils.showToast('✅ Solicitud enviada al administrador. Tu sesión se ha cerrado.', 'success');
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      Utils.showToast(`❌ No se pudo enviar la solicitud. Error: ${error.message}`, 'error');
    } finally {
      Utils.hideLoading();
    }
  },
  // ============================================================================

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

// Inicializar listeners para limpiar errores al escribir (después de cargar el DOM)
document.addEventListener('DOMContentLoaded', () => {
  // Login
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  if (loginEmail) loginEmail.addEventListener('input', () => document.getElementById('loginError')?.classList.remove('visible'));
  if (loginPassword) loginPassword.addEventListener('input', () => document.getElementById('loginError')?.classList.remove('visible'));
  // Registro
  const regUsername = document.getElementById('regUsername');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  if (regUsername) regUsername.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
  if (regEmail) regEmail.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
  if (regPassword) regPassword.addEventListener('input', () => document.getElementById('registerError')?.classList.remove('visible'));
});

// Funciones globales
window.switchAuthTab = Auth.switchAuthTab.bind(Auth);
window.registerUser = Auth.registerUser.bind(Auth);
window.loginUser = Auth.loginUser.bind(Auth);
window.logoutUser = Auth.logoutUser.bind(Auth);
window.showPremiumBenefits = Auth.showPremiumBenefits;
window.eliminarMiCuenta = Auth.eliminarMiCuenta.bind(Auth);