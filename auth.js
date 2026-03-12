// ==================== auth.js - Módulo de Autenticación (CON ADMIN) ====================

const Auth = {
  intentosLogin: 0,
  ultimoIntento: 0,
  
  switchAuthTab(tab) { 
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active')); 
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active')); 
    
    if(tab === 'login') { 
      document.querySelector('.auth-tab').classList.add('active'); 
      document.getElementById('loginForm').classList.add('active'); 
    } else { 
      document.querySelectorAll('.auth-tab')[1].classList.add('active'); 
      document.getElementById('registerForm').classList.add('active'); 
    } 
    
    document.getElementById('loginError')?.classList.remove('visible');
    document.getElementById('registerError')?.classList.remove('visible');
  },
  
  async registerUser() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const errorEl = document.getElementById('registerError');
    const btn = document.getElementById('registerBtn');
    
    errorEl.classList.remove('visible');
    
    if(!username || !email || !password) { 
      errorEl.innerText = "> COMPLETA TODOS LOS CAMPOS_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    if(username.length < 3) { 
      errorEl.innerText = "> MÍNIMO 3 CARACTERES_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    if(password.length < 6) { 
      errorEl.innerText = "> MÍNIMO 6 CARACTERES_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    if(!Utils.isValidEmail(email)) { 
      errorEl.innerText = "> CORREO ELECTRÓNICO NO VÁLIDO_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    if(!/^[a-zA-Z0-9_]+$/.test(username)) {
      errorEl.innerText = "> SOLO LETRAS, NÚMEROS Y GUION BAJO_";
      errorEl.classList.add('visible');
      return;
    }
    
    btn.disabled = true;
    btn.textContent = 'REGISTRANDO...';
    
    try {
      console.log('🔍 Verificando si usuario existe:', username);
      
      const usernameQuery = await firebaseServices.db
        .collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();
      
      if (!usernameQuery.empty) {
        errorEl.innerText = "> EL USUARIO YA EXISTE_";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }
      
      console.log('✅ Usuario disponible, preparando datos...');
      
      const expiry = new Date(); 
      expiry.setMonth(expiry.getMonth() + 1);
      const ahora = new Date();
      const mesActual = `${ahora.getFullYear()}-${ahora.getMonth() + 1}`;
      
      console.log('🔐 Creando usuario en Firebase Auth...');
      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('✅ Usuario creado en Auth:', user.uid);
      
      console.log('💾 Guardando usuario en Firestore...');
      const userData = { 
        username: username,
        email: email,
        created: ahora.toISOString(), 
        expires: expiry.toISOString(), 
        premium: true,
        isAdmin: false,
        emailVerified: false,
        calculosMes: 0,
        mesActual: mesActual,
        welcomeSeen: false,
        adminNotified: false,
        uid: user.uid,
        lastLogin: firebaseServices.Timestamp.now()
      };
      
      await firebaseServices.db.collection('users').doc(user.uid).set(userData);
      console.log('✅ Usuario guardado en Firestore');
      
      try {
        const mensajesRef = firebaseServices.db.collection('mensajes').doc(user.uid);
        await mensajesRef.set({
          mensajes: [{
            fecha: new Date().toLocaleString(),
            texto: "¡Bienvenido a RI5! Disfruta de 1 mes premium.",
            leido: false,
            esAdmin: true,
            timestamp: firebaseServices.Timestamp.now()
          }]
        });
        console.log('✅ Mensaje de bienvenida enviado');
      } catch (e) {
        console.log('Mensaje de bienvenida no enviado (no crítico)', e);
      }
      
      console.log('🚀 Iniciando sesión automática...');
      await AppState.setCurrentUser(user.uid, email, userData);
      
      Utils.showToast('✅ Registro exitoso', 'success');
      
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        welcomeEl.innerText = `> BIENVENIDO, ${username.toUpperCase()} · PREMIUM HASTA ${expiry.toLocaleDateString()}`;
      }
      
      const nameField = document.getElementById('name');
      if(nameField) nameField.value = username;
      
      if (window.UI) {
        UI.changeDailyTip(); 
        UI.startConsejoAutoChange();
      }
      
    } catch (error) {
      console.error('❌ Error en registro:', error);
      
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        Utils.showToast('Error de permisos. Contacta al administrador.', 'error');
      } else {
        Utils.handleFirebaseError(error);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '[ REGISTRARSE ]';
    }
  },
  
  async loginUser() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    
    console.log('🔍 Intentando login para usuario:', username);
    
    errorEl.classList.remove('visible');
    
    if(!username || !password) { 
      errorEl.innerText = "> INTRODUCE USUARIO Y CONTRASEÑA_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    
    const ahora = Date.now();
    if (ahora - this.ultimoIntento < 2000) {
      errorEl.innerText = "> ESPERA 2 SEGUNDOS ANTES DE REINTENTAR_"; 
      errorEl.classList.add('visible'); 
      return;
    }
    
    this.intentosLogin++;
    this.ultimoIntento = ahora;
    
    if (this.intentosLogin > 5) {
      errorEl.innerText = "> DEMASIADOS INTENTOS. ESPERA 1 MINUTO_"; 
      errorEl.classList.add('visible'); 
      setTimeout(() => { this.intentosLogin = 0; }, 60000);
      return;
    }
    
    btn.disabled = true;
    btn.textContent = 'ACCEDIENDO...';
    
    try {
      console.log('🔍 Buscando usuario en Firestore...');
      
      if (!navigator.onLine) {
        errorEl.innerText = "> SIN CONEXIÓN A INTERNET_"; 
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ ACCEDER ]';
        return;
      }
      
      const usersRef = firebaseServices.db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).limit(1).get();
      
      if (snapshot.empty) {
        console.log('❌ Usuario no encontrado');
        errorEl.innerText = "> USUARIO O CONTRASEÑA INCORRECTOS_"; 
        errorEl.classList.add('visible'); 
        btn.disabled = false;
        btn.textContent = '[ ACCEDER ]';
        return;
      }
      
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      console.log('✅ Usuario encontrado:', userData.email);
      
      const now = new Date();
      const expiry = new Date(userData.expires);
      
      if(now > expiry && !userData.premium) { 
        console.log('❌ Usuario expirado');
        errorEl.innerText = "> ACCESO EXPIRADO_"; 
        errorEl.classList.add('visible'); 
        btn.disabled = false;
        btn.textContent = '[ ACCEDER ]';
        return; 
      }
      
      console.log('🔐 Autenticando con Firebase Auth...');
      
      const userCredential = await firebaseServices.auth.signInWithEmailAndPassword(userData.email, password);
      const user = userCredential.user;
      console.log('✅ Login exitoso en Auth:', user.uid);
      
      if (user.uid !== userId) {
        console.log('⚠️ UID no coincide, actualizando Firestore...');
        
        await firebaseServices.db.collection('users').doc(user.uid).set({
          ...userData,
          uid: user.uid
        });
        
        if (userId && userId !== user.uid) {
          try {
            await firebaseServices.db.collection('users').doc(userId).delete();
            console.log('✅ Documento antiguo eliminado:', userId);
          } catch (e) {
            console.log('No se pudo eliminar documento antiguo:', e);
          }
        }
        
        userData.uid = user.uid;
        console.log('✅ UID actualizado en Firestore');
      }
      
      const ahora2 = new Date();
      const mesActual = `${ahora2.getFullYear()}-${ahora2.getMonth() + 1}`;
      
      if(userData.mesActual !== mesActual) {
        userData.calculosMes = 0;
        userData.mesActual = mesActual;
        await firebaseServices.db.collection('users').doc(user.uid).update({
          calculosMes: 0,
          mesActual: mesActual
        });
      }
      
      try {
        await firebaseServices.db.collection('users').doc(user.uid).update({
          lastLogin: firebaseServices.Timestamp.now()
        });
        console.log('✅ lastLogin actualizado');
      } catch (e) {
        console.log('Error actualizando lastLogin (no crítico)', e);
      }
      
      console.log('🚀 Estableciendo sesión...');
      await AppState.setCurrentUser(user.uid, userData.email, userData);
      
      const msgs = await window.Storage.getMensajesUsuario(user.uid);
      AppState.mensajesNoLeidos = msgs.filter(m => !m.leido && m.esAdmin).length;
      if (window.UI) UI.actualizarBadgeMensajes();
      
      Utils.showToast(`✅ Bienvenido, ${username}`, 'success');
      
      this.intentosLogin = 0;
      
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        welcomeEl.innerText = `> BIENVENIDO, ${username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${expiry.toLocaleDateString()}`;
      }
      
      const nameField = document.getElementById('name');
      if(nameField) nameField.value = username;
      
      if (window.UI) {
        UI.changeDailyTip(); 
        UI.startConsejoAutoChange();
        await UI.cargarMensajesRecibidos();
        await UI.cargarMensajesEnviados();
      }
      
      const calc = await window.Storage.getUltimoCalculo(user.uid);
      if(calc) { 
        AppState.setLastCalc(calc); 
        if (window.UI) UI.mostrarResultadosGuardados(calc); 
      }
      
      console.log('✅ Login completado exitosamente');
      
    } catch (error) {
      console.error('❌ Error en login:', error);
      
      if (error.code === 'auth/wrong-password') {
        errorEl.innerText = "> CONTRASEÑA INCORRECTA_"; 
      } else if (error.code === 'auth/user-not-found') {
        errorEl.innerText = "> USUARIO O CONTRASEÑA INCORRECTOS_"; 
      } else if (error.code === 'auth/too-many-requests') {
        errorEl.innerText = "> DEMASIADOS INTENTOS. INTENTA MÁS TARDE_"; 
      } else if (error.code === 'auth/invalid-email') {
        errorEl.innerText = "> EMAIL INVÁLIDO_"; 
      } else if (error.code === 'auth/network-request-failed') {
        errorEl.innerText = "> ERROR DE RED. COMPRUEBA TU CONEXIÓN_"; 
      } else {
        errorEl.innerText = "> ERROR DE AUTENTICACIÓN_"; 
      }
      errorEl.classList.add('visible'); 
    } finally {
      btn.disabled = false;
      btn.textContent = '[ ACCEDER ]';
    }
  },
  
  async eliminarMiCuenta() {
    const username = prompt('Introduce tu nombre de usuario:');
    if (!username) return;
    
    const password = prompt('Introduce tu contraseña:');
    if (!password) return;
    
    const confirmed = await Utils.confirm('ELIMINAR CUENTA', `¿ELIMINAR "${username}"?\n\nACCIÓN IRREVERSIBLE`);
    if(!confirmed) return;
    
    Utils.showLoading();
    
    try {
      const usersRef = firebaseServices.db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).limit(1).get();
      
      if (snapshot.empty) {
        Utils.showToast('> USUARIO NO ENCONTRADO_', 'error');
        Utils.hideLoading();
        return;
      }
      
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        await firebaseServices.auth.signInWithEmailAndPassword(userData.email, password);
      } catch (error) {
        Utils.hideLoading();
        Utils.showToast('> CONTRASEÑA INCORRECTA_', 'error');
        return;
      }
      
      const user = firebaseServices.auth.currentUser;
      
      if (!user) {
        Utils.hideLoading();
        Utils.showToast('> ERROR DE AUTENTICACIÓN_', 'error');
        return;
      }
      
      await firebaseServices.db.collection('users').doc(userId).delete();
      await firebaseServices.db.collection('mensajes').doc(userId).delete();
      await firebaseServices.db.collection('mensajes').doc('admin_' + userId).delete();
      
      await user.delete();
      
      await AppState.setCurrentUser(null, null);
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";
      
      Utils.showToast(`✅ CUENTA ELIMINADA`, 'success');
      
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      Utils.handleFirebaseError(error);
    } finally {
      Utils.hideLoading();
    }
  },
  
  async logoutUser() { 
    const ok = await Utils.confirm('CERRAR SESIÓN', '> ¿CERRAR SESIÓN?_');
    if(!ok) return;
    
    Utils.showLoading();
    
    try {
      await firebaseServices.auth.signOut();
      await AppState.setCurrentUser(null, null); 
      AppState.limpiarDatosPlan();
      
      document.getElementById("mainContent").style.display = "none"; 
      document.getElementById("loginPage").style.display = "flex"; 
      document.getElementById("loginUsername").value = ''; 
      document.getElementById("loginPassword").value = ''; 
      document.getElementById("results").innerHTML = ''; 
      document.getElementById("calendarioEntreno").style.display = "none"; 
      AppState.clearLastCalc();
      sessionStorage.removeItem('ri5_estado');
      
      localStorage.removeItem('ri5_current_user');
      localStorage.removeItem('ri5_user_email');
      
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
    if(!uid) return false;
    
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
      
      if(now > expiry && !userData.premium) { 
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
      if(nameField) nameField.value = userData.username;
      
      if (window.UI) {
        UI.changeDailyTip(); 
        UI.startConsejoAutoChange();
      }
      
      AppState.actualizarInterfazPremium();
      
      const calc = await window.Storage.getUltimoCalculo(uid); 
      if(calc) { 
        AppState.setLastCalc(calc); 
        if (window.UI) UI.mostrarResultadosGuardados(calc); 
      }
      
      try {
        await firebaseServices.db.collection('users').doc(uid).update({
          lastLogin: firebaseServices.Timestamp.now()
        });
      } catch (e) {}
      
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

// Funciones globales
window.switchAuthTab = Auth.switchAuthTab.bind(Auth);
window.registerUser = Auth.registerUser.bind(Auth);
window.loginUser = Auth.loginUser.bind(Auth);
window.logoutUser = Auth.logoutUser.bind(Auth);
window.showPremiumBenefits = Auth.showPremiumBenefits;
window.eliminarMiCuenta = Auth.eliminarMiCuenta.bind(Auth);