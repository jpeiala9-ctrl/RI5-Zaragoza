// ==================== auth.js - LOGIN CON EMAIL (SENCILLO Y FUNCIONAL) ====================

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
      // Verificar si el username ya existe en Firestore
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
      
      // Verificar si el email ya existe en Auth
      const methods = await firebaseServices.auth.fetchSignInMethodsForEmail(email);
      if (methods.length > 0) {
        errorEl.innerText = "> EL CORREO YA ESTÁ REGISTRADO_";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }
      
      // Crear usuario en Firebase Auth
      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      const expiry = new Date(); 
      expiry.setMonth(expiry.getMonth() + 1);
      const ahora = new Date();
      const mesActual = `${ahora.getFullYear()}-${ahora.getMonth() + 1}`;
      
      const userData = { 
        username,
        email,
        created: ahora.toISOString(), 
        expires: expiry.toISOString(), 
        premium: true,
        isAdmin: false,
        emailVerified: false,
        calculosMes: 0,
        mesActual,
        uid: user.uid,
        lastLogin: firebaseServices.Timestamp.now()
      };
      
      // Guardar en Firestore
      await firebaseServices.db.collection('users').doc(user.uid).set(userData);
      
      // === MENSAJE DE BIENVENIDA AUTOMÁTICO ===
      const mensajeBienvenida = {
        fecha: new Date().toLocaleString(),
        texto: "👋 ¡Bienvenido a RI5! Este es tu espacio de soporte directo con el administrador. Aquí recibirás notificaciones importantes y puedes enviar tus consultas. ¡Disfruta de la app! 🏃",
        leido: false,
        esAdmin: true,
        timestamp: firebaseServices.Timestamp.now()
      };
      
      // Crear bandeja de mensajes con el mensaje de bienvenida
      await firebaseServices.db.collection('mensajes').doc(user.uid).set({ 
        mensajes: [mensajeBienvenida] 
      });
      
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
        // Actualizar badge de mensajes (habrá 1 no leído)
        const msgs = await Storage.getMensajesUsuario(user.uid);
        AppState.mensajesNoLeidos = msgs.filter(m => !m.leido && m.esAdmin).length;
        UI.actualizarBadgeMensajes();
      }
      
    } catch (error) {
      console.error('❌ Error en registro:', error);
      Utils.handleFirebaseError(error);
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
    
    if(!email || !password) { 
      errorEl.innerText = "> INTRODUCE CORREO Y CONTRASEÑA_"; 
      errorEl.classList.add('visible'); 
      return; 
    }
    
    if(!Utils.isValidEmail(email)) {
      errorEl.innerText = "> CORREO ELECTRÓNICO NO VÁLIDO_";
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
      const userCredential = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      const userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        console.log('⚠️ Usuario autenticado sin documento en Firestore, creándolo...');
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.floor(Math.random()*1000);
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
        const mesActual = `${new Date().getFullYear()}-${new Date().getMonth()+1}`;
        const userData = {
          username,
          email,
          created: new Date().toISOString(),
          expires: expiry.toISOString(),
          premium: true,
          isAdmin: false,
          emailVerified: user.emailVerified,
          calculosMes: 0,
          mesActual,
          uid: user.uid,
          lastLogin: firebaseServices.Timestamp.now()
        };
        await firebaseServices.db.collection('users').doc(user.uid).set(userData);
        await firebaseServices.db.collection('mensajes').doc(user.uid).set({ mensajes: [] });
        userDoc.data = () => userData;
      }
      
      const userData = userDoc.data();
      
      const ahora2 = new Date();
      const mesActual = `${ahora2.getFullYear()}-${ahora2.getMonth() + 1}`;
      const updates = { lastLogin: firebaseServices.Timestamp.now() };
      if (userData.mesActual !== mesActual) {
        updates.calculosMes = 0;
        updates.mesActual = mesActual;
        userData.calculosMes = 0;
        userData.mesActual = mesActual;
      }
      await firebaseServices.db.collection('users').doc(user.uid).update(updates);
      
      await AppState.setCurrentUser(user.uid, email, userData);
      
      const msgs = await Storage.getMensajesUsuario(user.uid);
      AppState.mensajesNoLeidos = msgs.filter(m => !m.leido && m.esAdmin).length;
      if (window.UI) UI.actualizarBadgeMensajes();
      
      Utils.showToast(`✅ Bienvenido, ${userData.username}`, 'success');
      
      this.intentosLogin = 0;
      
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";
      
      const welcomeEl = document.getElementById("userWelcome");
      if (welcomeEl) {
        const expiry = new Date(userData.expires);
        welcomeEl.innerText = `> BIENVENIDO, ${userData.username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${expiry.toLocaleDateString()}`;
      }
      
      const nameField = document.getElementById('name');
      if(nameField) nameField.value = userData.username;
      
      if (window.UI) {
        UI.changeDailyTip(); 
        UI.startConsejoAutoChange();
        await UI.cargarMensajesRecibidos();
        await UI.cargarMensajesEnviados();
      }
      
      const calc = await Storage.getUltimoCalculo(user.uid);
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
        errorEl.innerText = "> CORREO NO REGISTRADO_"; 
      } else if (error.code === 'auth/too-many-requests') {
        errorEl.innerText = "> DEMASIADOS INTENTOS. INTENTA MÁS TARDE_"; 
      } else if (error.code === 'auth/invalid-email') {
        errorEl.innerText = "> CORREO INVÁLIDO_"; 
      } else if (error.code === 'auth/network-request-failed') {
        errorEl.innerText = "> ERROR DE RED. COMPRUEBA TU CONEXIÓN_"; 
      } else if (error.message.includes('permission')) {
        errorEl.innerText = "> ERROR DE PERMISOS. CONTACTA AL ADMIN_"; 
      } else {
        errorEl.innerText = "> ERROR DE AUTENTICACIÓN: " + (error.message || 'DESCONOCIDO'); 
      }
      errorEl.classList.add('visible'); 
    } finally {
      btn.disabled = false;
      btn.textContent = '[ ACCEDER ]';
    }
  },
  
  async eliminarMiCuenta() {
    const email = prompt('Introduce tu correo electrónico:');
    if (!email) return;
    
    const password = prompt('Introduce tu contraseña:');
    if (!password) return;
    
    const confirmed = await Utils.confirm('ELIMINAR CUENTA', `¿ELIMINAR "${email}"?\n\nACCIÓN IRREVERSIBLE`);
    if(!confirmed) return;
    
    Utils.showLoading();
    
    try {
      const userCredential = await firebaseServices.auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      await firebaseServices.db.collection('users').doc(user.uid).delete();
      await firebaseServices.db.collection('mensajes').doc(user.uid).delete();
      await firebaseServices.db.collection('mensajes').doc('admin_' + user.uid).delete();
      
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
      
      const calc = await Storage.getUltimoCalculo(uid); 
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