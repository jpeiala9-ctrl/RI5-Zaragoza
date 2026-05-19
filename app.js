// ==================== app.js - VERSIÓN COMPLETA CON PRECARGA TOTAL Y TIEMPO REAL ====================
// VERSIÓN: 4.18 - Al login: carga perfil, amigos, explorar, muro y mensajes. Listeners actualizan en tiempo real.
// ====================

// ==================== CONFIGURACIÓN INICIAL ====================
if(!localStorage.getItem('ri5_initialized')) {
  const keysToRemove = [];
  for(let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if(key && (key.startsWith('ri5_') || key.startsWith('historial_') || key.startsWith('ultimoCalculo_') || key.startsWith('ultimoPlan_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  localStorage.setItem('ri5_initialized', 'true');
}

// ==================== UTILS ====================
const Utils = {
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  safeInnerHTML(element, html) {
    if (!element) return;
    element.innerHTML = html;
  },

  parseTime(t) {
    if (!t || typeof t !== 'string') return NaN;
    t = t.trim().replace(',', ':').replace('.', ':');

    if (!t.includes(':')) {
      let minutos = parseFloat(t);
      if (isNaN(minutos)) return NaN;
      if (minutos >= 10 && minutos <= 120) {
        return minutos;
      } else {
        return NaN;
      }
    }

    const parts = t.split(':');
    let m = parseInt(parts[0]);
    let s = parts[1] ? parseInt(parts[1]) : 0;
    if (isNaN(m) || isNaN(s) || s > 59 || m > 120 || m < 10) return NaN;
    return m + s/60; 
  },

  formatR(r) {
    if(!isFinite(r)||r<=0) return "--:--";
    let m = Math.floor(r), s = Math.round((r-m)*60);
    if(s===60){ m++; s=0; }
    return m+":"+(s<10?'0':'')+s;
  },

  showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
  },

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirmOverlay');
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmTitle');
      const msgEl = document.getElementById('confirmMessage');
      const yesBtn = document.getElementById('confirmYes');
      const noBtn = document.getElementById('confirmNo');

      if (!overlay || !modal || !msgEl || !yesBtn || !noBtn) {
        resolve(false);
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      overlay.classList.add('active');
      modal.classList.add('active');

      const onYes = () => {
        overlay.classList.remove('active');
        modal.classList.remove('active');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        resolve(true);
      };
      const onNo = () => {
        overlay.classList.remove('active');
        modal.classList.remove('active');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        resolve(false);
      };

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  vibrate(pattern) {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  },

  playSound(type) {
    if (!window.audioEnabled) return;
    if (!window.audioContext) {
      try {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return;
      }
    }
    const osc = window.audioContext.createOscillator();
    const gainNode = window.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = type === 'success' ? 800 : 400;
    gainNode.gain.value = 0.1;
    gainNode.gain.exponentialRampToValueAtTime(0.00001, window.audioContext.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(window.audioContext.destination);
    osc.start();
    osc.stop(window.audioContext.currentTime + 0.2);
  },

  scrollToElement(elementId, offset = 0) {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        const y = element.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  },

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 5 + 2,
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        color: `hsl(${Math.random() * 60 + 300}, 70%, 60%)`
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let still = false;
      for (let p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < canvas.height) still = true;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      if (still) {
        requestAnimationFrame(draw);
      } else {
        canvas.style.display = 'none';
      }
    }
    draw();
  },

  handleFirebaseError(error) {
    console.error('Firebase Error:', error);
    let message = '';

    switch(error.code) {
      case 'auth/email-already-in-use':
        message = 'Este correo ya está registrado';
        break;
      case 'auth/invalid-email':
        message = 'Correo electrónico no válido';
        break;
      case 'auth/weak-password':
        message = 'La contraseña debe tener al menos 6 caracteres';
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = 'Usuario o contraseña incorrectos';
        break;
      case 'auth/too-many-requests':
        message = 'Demasiados intentos. Intenta más tarde';
        break;
      case 'auth/network-request-failed':
        message = 'Error de conexión. Comprueba tu red';
        break;
      case 'auth/requires-recent-login':
        message = 'Esta operación requiere autenticación reciente. Vuelve a iniciar sesión';
        break;
      case 'permission-denied':
        message = 'No tienes permisos para esta acción';
        break;
      case 'unavailable':
        message = 'Servicio no disponible. Intenta más tarde';
        break;
      default:
        message = 'Error inesperado. Inténtalo de nuevo más tarde';
    }

    if (message) {
      this.showToast(message, 'error');
    }
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  isOnline() {
    return navigator.onLine;
  },

  capitalizeUsername(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
};

// ==================== ESTADO GLOBAL ====================
const AppState = {
  zonasCalculadas: false,
  lastName: "", lastAge: 0, lastFC: 0, lastUL: 0,
  lastZones: [], lastPred: [], lastRitmoBase: 0,
  ultimoPlanParams: null,
  planGeneradoActual: null,
  planActualId: null,
  sesionesRealizadas: {},
  feedbackSesiones: {},
  camposTocados: { name: false, age: false, time: false },
  currentUser: null,
  currentUserId: null,
  currentUserEmail: null,
  currentUserData: null,
  currentSesionDetalle: null,
  deferredPrompt: null,
  mensajesNoLeidos: 0,
  isPremium: false,
  emailVerified: false,
  premiumExpiryDate: null,
  calculosMes: 0,
  mesActual: '',
  trimestreActual: 0,
  unsubscribeMensajes: null,
  isAdmin: false,

  solicitudesPendientesCount: 0,
  mensajesAmigosNoLeidos: 0,

  unsubscribeFriendRequests: null,
  unsubscribeConversations: null,
  unsubscribeMensajesSoporte: null,

  historialPagination: {
    lastDoc: null,
    hasMore: true,
    loading: false
  },

  setLastCalc(d) {
    if (!d) return;
    this.lastName = d.name || "";
    this.lastAge = d.age || 0;
    this.lastFC = d.fcMax || 0;
    this.lastUL = d.ul || 0;
    this.lastZones = d.zones || [];
    this.lastPred = d.pred || [];
    this.lastRitmoBase = d.ritmoBase || 0;
    this.zonasCalculadas = true;
  },

  clearLastCalc() {
    this.zonasCalculadas = false;
    this.lastName = "";
    this.lastAge = 0;
    this.lastFC = 0;
    this.lastUL = 0;
    this.lastZones = [];
    this.lastPred = [];
    this.lastRitmoBase = 0;
  },

  async setCurrentUser(uid, email, userData = null) {
    this.currentUserId = uid;
    this.currentUserEmail = email;
    this.currentUserData = userData;
    this.currentUser = userData?.username ? Utils.capitalizeUsername(userData.username) : (email ? email.split('@')[0] : null);

    if (userData && !userData.username_lowercase && userData.username) {
      const newLowercase = userData.username.toLowerCase();
      firebaseServices.db.collection('users').doc(uid).update({
        username_lowercase: newLowercase
      }).catch(e => console.warn('Error actualizando username_lowercase:', e));
      userData.username_lowercase = newLowercase;
      this.currentUserData = userData;
    }

    this.isPremium = userData?.premium || false;
    this.premiumExpiryDate = userData?.expires ? new Date(userData.expires) : null;
    this.emailVerified = userData?.emailVerified || false;
    this.calculosMes = userData?.calculosMes || 0;
    this.mesActual = userData?.mesActual || '';
    this.isAdmin = userData?.isAdmin || false;

    this.limpiarDatosPlan();

    if (uid) {
      localStorage.setItem('ri5_current_user', uid);
      localStorage.setItem('ri5_user_email', email || '');
      if (this.isAdmin) {
        localStorage.setItem('ri5_is_admin', 'true');
      } else {
        localStorage.removeItem('ri5_is_admin');
      }
    } else {
      localStorage.removeItem('ri5_current_user');
      localStorage.removeItem('ri5_user_email');
      localStorage.removeItem('ri5_is_admin');
      if (window.Wall) {
        Wall.detenerListener();
      }
    }

    const t = document.getElementById('ri5Title'); 
    if(t) { 
      if(this.isPremium && this.premiumExpiryDate && new Date() <= this.premiumExpiryDate) {
        t.classList.add('premium'); 
      } else {
        t.classList.remove('premium'); 
      }
    }

    if (this.currentUser) {
      const nameField = document.getElementById('name');
      if(nameField) nameField.value = this.currentUser;
    }

    this.actualizarInterfazPremium();
    this.verificarExpiracionPremium();

    const adminTab = document.getElementById('adminTabButton');
    if (adminTab) {
      adminTab.style.display = this.isAdmin ? 'inline-block' : 'none';
    }

    this.actualizarBotonCalcular();

    if (uid) {
      this.iniciarListeners();
    } else {
      this.detenerListeners();
    }
  },

  limpiarDatosPlan() {
    this.planGeneradoActual = null;
    this.planActualId = null;
    this.sesionesRealizadas = {};
    this.feedbackSesiones = {};
    this.trimestreActual = 0;
  },

  actualizarInterfazPremium() {
    const planBtns = ['nuevoPlanBtn', 'borrarPlanBtn', 'generarPlanBtn'];
    const isPremiumActive = (this.isPremium && this.premiumExpiryDate && new Date() <= this.premiumExpiryDate);

    planBtns.forEach(id => {
      const btn = document.getElementById(id);
      if(btn) btn.disabled = !isPremiumActive;
    });

    const cargarBtn = document.getElementById('cargarPlanBtn');
    if (cargarBtn) cargarBtn.disabled = false;

    const counterDiv = document.getElementById('calculoCounter');
    if(counterDiv) {
      counterDiv.style.display = 'block';
      const restantes = this.isPremium ? 'Ilimitado' : (10 - this.calculosMes);
      counterDiv.innerHTML = `📊 Cálculos este mes: ${this.calculosMes} (restan ${restantes} gratis)`;
    }

    this.actualizarBotonCalcular();
  },

  verificarExpiracionPremium() {
    const banner = document.getElementById('premium-expiry-banner');
    const message = document.getElementById('expiry-message');

    if (this.premiumExpiryDate) {
      const ahora = new Date();
      const diasRestantes = Math.ceil((this.premiumExpiryDate - ahora) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes <= 7 && diasRestantes > 0) {
        if (banner) {
          banner.style.display = 'block';
          if (message) message.innerText = `⚠️ Tu premium expira en ${diasRestantes} días`;
        }
      } else if (diasRestantes <= 0) {
        if (banner) {
          banner.style.display = 'block';
          if (message) message.innerText = `⚠️ Tu premium ha expirado`;
        }
        this.isPremium = false;
        this.actualizarInterfazPremium();
      } else {
        if (banner) banner.style.display = 'none';
      }
    }
  },

  puedeVerDetalleSesion() {
    if (this.isPremium && this.premiumExpiryDate && new Date() <= this.premiumExpiryDate) {
      return true;
    }
    return false;
  },

  async incrementarCalculo() {
    if(!this.currentUserId) return false;

    const ahora = new Date();
    const mesActualKey = `${ahora.getFullYear()}-${ahora.getMonth() + 1}`;

    if(this.mesActual !== mesActualKey) {
      this.calculosMes = 0;
      this.mesActual = mesActualKey;
    }

    const limite = this.isPremium ? Infinity : 10;
    if (this.calculosMes >= limite) {
      Utils.showToast('⚠️ Límite de 10 cálculos mensuales alcanzado. Actualiza a premium para más.', 'warning');
      return false;
    }

    try {
      await firebaseServices.db.collection('users').doc(this.currentUserId).update({
        calculosMes: firebaseServices.FieldValue.increment(1)
      });
      this.calculosMes++;
    } catch (error) {
      console.error('Error incrementando calculosMes:', error);
      if (error.code === 'permission-denied') {
        Utils.showToast('⚠️ Has alcanzado el límite de cálculos mensuales. Hazte premium para seguir usando la calculadora.', 'warning');
      } else {
        Utils.showToast('Error al registrar cálculo. Intenta de nuevo.', 'error');
      }
      return false;
    }

    this.actualizarInterfazPremium();
    return true;
  },

  actualizarBotonCalcular() {
    const btn = document.getElementById("calcBtn");
    if (!btn) return;
    const ageValid = document.getElementById('age') && document.getElementById('age').value && !isNaN(parseInt(document.getElementById('age').value));
    const timeValid = document.getElementById('time') && document.getElementById('time').value && !isNaN(Utils.parseTime(document.getElementById('time').value));
    const hayCampos = ageValid && timeValid;
    if (this.isPremium || (this.calculosMes < 10)) {
      btn.disabled = !hayCampos;
      if (!hayCampos) btn.title = "Completa edad y tiempo";
      else btn.title = "";
    } else {
      btn.disabled = true;
      btn.title = "Límite de 10 cálculos mensuales alcanzado. Actualiza a premium.";
    }
  },

  resetHistorialPagination() {
    this.historialPagination = {
      lastDoc: null,
      hasMore: true,
      loading: false
    };
  },

  iniciarListeners() {
    this.detenerListeners();
    if (!this.currentUserId) return;

    // Listener de solicitudes de amistad
    this.unsubscribeFriendRequests = firebaseServices.db
      .collection('friendRequests')
      .where('to', '==', this.currentUserId)
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        const count = snapshot.size;
        if (this.solicitudesPendientesCount !== count) {
          this.solicitudesPendientesCount = count;
          this.actualizarBadgeSolicitudes();
          const activeTab = document.querySelector('.tab-button.active')?.textContent.toLowerCase();
          if (activeTab === 'amigos') {
            const activeAmigosTab = document.querySelector('.amigos-tab.active')?.textContent.toLowerCase();
            if (activeAmigosTab === 'solicitudes') {
              if (window.Friends) Friends.cargarSolicitudesRecibidas();
            }
          }
        }
      }, (error) => {
        console.error('Error en listener de solicitudes:', error);
      });

    // Listener de conversaciones (chat)
    this.unsubscribeConversations = firebaseServices.db
      .collection('conversations')
      .where('participants', 'array-contains', this.currentUserId)
      .onSnapshot(async () => {
        if (window.Chat) {
          await Chat.updateUnreadBadge();
        }
        this.actualizarBadgeChat();
      }, (error) => {
        console.error('Error en listener de conversaciones:', error);
      });

    // Listener de mensajes de soporte (admin -> usuario)
    this.unsubscribeMensajesSoporte = firebaseServices.db
      .collection('mensajes')
      .doc(this.currentUserId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const mensajes = data.mensajes || [];
          const noLeidos = mensajes.filter(m => !m.leido && m.esAdmin).length;
          if (this.mensajesNoLeidos !== noLeidos) {
            this.mensajesNoLeidos = noLeidos;
            if (window.UI) UI.actualizarBadgeMensajes();
          }
        }
      }, (error) => {
        console.error('Error en listener de mensajes de soporte:', error);
      });
  },

  detenerListeners() {
    if (this.unsubscribeFriendRequests) {
      this.unsubscribeFriendRequests();
      this.unsubscribeFriendRequests = null;
    }
    if (this.unsubscribeConversations) {
      this.unsubscribeConversations();
      this.unsubscribeConversations = null;
    }
    if (this.unsubscribeMensajesSoporte) {
      this.unsubscribeMensajesSoporte();
      this.unsubscribeMensajesSoporte = null;
    }
  },

  actualizarBadgeSolicitudes() {
    const tab = document.querySelector('.tab-button[onclick="switchTab(\'amigos\')"]');
    if (tab) {
      if (this.solicitudesPendientesCount > 0) {
        tab.classList.add('amigos-solicitudes-unread');
        tab.setAttribute('data-count', this.solicitudesPendientesCount);
      } else {
        tab.classList.remove('amigos-solicitudes-unread');
        tab.removeAttribute('data-count');
      }
    }
    const solicitudesTab = document.querySelector('.amigos-tab[onclick*="solicitudes"]');
    if (solicitudesTab) {
      if (this.solicitudesPendientesCount > 0) {
        solicitudesTab.style.color = 'var(--accent-blue)';
        solicitudesTab.style.fontWeight = '500';
      } else {
        solicitudesTab.style.color = '';
        solicitudesTab.style.fontWeight = '';
      }
    }
  },

  actualizarBadgeChat() {
    const tab = document.querySelector('.tab-button[onclick="switchTab(\'amigos\')"]');
    if (tab) {
      if (this.mensajesAmigosNoLeidos > 0) {
        tab.classList.add('chat-unread');
        tab.setAttribute('data-chat-count', this.mensajesAmigosNoLeidos);
      } else {
        tab.classList.remove('chat-unread');
        tab.removeAttribute('data-chat-count');
      }
    }
    const listaTab = document.querySelector('.amigos-tab[onclick*="lista"]');
    if (listaTab) {
      if (this.mensajesAmigosNoLeidos > 0) {
        listaTab.style.color = '#E67E22';
        listaTab.style.fontWeight = '600';
      } else {
        listaTab.style.color = '';
        listaTab.style.fontWeight = '';
      }
    }
  }
};

// ==================== MÓDULO ADMIN ====================
const Admin = {
  usersPagination: {
    lastDoc: null,
    hasMore: true,
    loading: false,
    searchTerm: ''
  },
  currentEditUserId: null,
  
  messagesPagination: {
    lastDoc: null,
    hasMore: true,
    loading: false,
    allMessagesCache: []
  },

  async borrarMensajeUsuario(uid, idx) {
    if (!AppState.isAdmin) return;

    const confirmed = await Utils.confirm('ELIMINAR MENSAJE', '¿Eliminar este mensaje permanentemente?');
    if (!confirmed) return;

    Utils.showLoading();

    try {
      const docRef = firebaseServices.db.collection('mensajes').doc('admin_' + uid);
      const doc = await docRef.get();
      
      if (doc.exists) {
        const data = doc.data();
        let mensajes = Array.isArray(data.mensajes) ? data.mensajes : [];
        
        if (idx >= 0 && idx < mensajes.length) {
          mensajes.splice(idx, 1);
          await docRef.set({ mensajes });
          
          Utils.showToast('✅ Mensaje eliminado', 'success');
          await this.cargarMensajesUsuarios(true);
        } else {
          Utils.showToast('❌ Mensaje no encontrado', 'error');
        }
      }
    } catch (error) {
      console.error('Error borrando mensaje:', error);
      Utils.showToast('Error al eliminar mensaje: ' + error.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async cargarUsuarios(reset = false) {
    if (!AppState.isAdmin) return;
    if (this.usersPagination.loading) return;

    const cacheKey = `admin_users_cache_${this.usersPagination.searchTerm || 'all'}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached && !reset) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 60000) {
          this.renderUsersList(data);
          return;
        }
      } catch(e) {}
    }

    this.usersPagination.loading = true;

    const container = document.getElementById('adminUsersList');
    if (!container) return;

    if (reset) {
      container.innerHTML = '<div style="text-align:center; padding:40px; color: var(--text-secondary);">⏳ Cargando usuarios...</div>';
      this.usersPagination.lastDoc = null;
      this.usersPagination.hasMore = true;
      const searchEl = document.getElementById('adminUserSearch');
      this.usersPagination.searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    }

    try {
      let query = firebaseServices.db.collection('users')
        .orderBy('username_lowercase')
        .limit(20);
      
      if (this.usersPagination.searchTerm) {
        query = query.where('username_lowercase', '>=', this.usersPagination.searchTerm)
                     .where('username_lowercase', '<=', this.usersPagination.searchTerm + '\uf8ff');
      }
      
      if (this.usersPagination.lastDoc) {
        query = query.startAfter(this.usersPagination.lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (reset) {
        container.innerHTML = '';
      }
      
      if (snapshot.empty) {
        if (reset) container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--text-secondary);">No hay usuarios</p>';
        this.usersPagination.hasMore = false;
        this.usersPagination.loading = false;
        const loadMoreBtn = document.getElementById('loadMoreUsersBtn');
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }
      
      this.usersPagination.lastDoc = snapshot.docs[snapshot.docs.length - 1];
      this.usersPagination.hasMore = snapshot.docs.length === 20;
      
      const usuariosVistos = JSON.parse(localStorage.getItem('admin_usuarios_vistos') || '[]');
      
      const usersData = snapshot.docs.map(doc => {
        const user = doc.data();
        const uid = doc.id;
        const username = Utils.capitalizeUsername(user.username) || '?';
        const email = Utils.escapeHTML(user.email || '?');
        const premium = user.premium ? 'SÍ' : 'NO';
        const expires = user.expires ? new Date(user.expires).toLocaleDateString() : '-';
        const calculos = user.calculosMes || 0;
        const created = user.created ? new Date(user.created).toLocaleDateString() : '-';
        
        const esNuevo = !usuariosVistos.includes(uid) && 
                       (user.created && new Date(user.created) > new Date(Date.now() - 7*24*60*60*1000));
        
        return { uid, username, email, premium, expires, calculos, created, esNuevo, user };
      });
      
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: usersData, timestamp: Date.now() }));
      
      this.renderUsersList(usersData);
      
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      if (reset) container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--zone-5);">Error al cargar</p>';
    } finally {
      this.usersPagination.loading = false;
    }
  },
  
  renderUsersList(usersData) {
    const container = document.getElementById('adminUsersList');
    if (!container) return;
    
    let html = '';
    for (const u of usersData) {
      html += `
        <div class="usuario-item ${u.esNuevo ? 'nuevo' : ''}" data-uid="${u.uid}">
          <div class="usuario-header" data-uid="${u.uid}">
            <span class="usuario-nombre">${Utils.escapeHTML(u.username)}</span>
            <span class="usuario-email">${u.email}</span>
            ${u.esNuevo ? '<span class="usuario-badge">NUEVO</span>' : ''}
          </div>
          <div class="usuario-detalle">
            <div class="usuario-info">
              <div class="info-item">
                <span class="info-label">Premium</span>
                <span class="info-value">${u.premium}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Expira</span>
                <span class="info-value">${u.expires}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Cálculos</span>
                <span class="info-value">${u.calculos}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Registro</span>
                <span class="info-value">${u.created}</span>
              </div>
            </div>
            <div class="usuario-acciones">
              <button class="ver-perfil-btn" data-uid="${u.uid}">VER</button>
              <button class="mensaje-usuario-btn" data-uid="${u.uid}" data-username="${Utils.escapeHTML(u.username)}">MENSAJE</button>
              <button class="premium-usuario-btn" data-uid="${u.uid}" data-username="${Utils.escapeHTML(u.username)}" data-premium="${u.user.premium}" data-expires="${u.user.expires || ''}">PREMIUM</button>
              <button class="eliminar-usuario-btn" data-uid="${u.uid}" data-username="${Utils.escapeHTML(u.username)}">ELIMINAR</button>
            </div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.ver-perfil-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        Admin.verPerfil(uid);
      });
    });
    container.querySelectorAll('.mensaje-usuario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        const username = btn.dataset.username;
        Admin.abrirMensajeUsuario(uid, username);
      });
    });
    container.querySelectorAll('.premium-usuario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        const username = btn.dataset.username;
        const esPremium = btn.dataset.premium === 'true';
        const expires = btn.dataset.expires;
        Admin.abrirModalPremium(uid, username, esPremium, expires);
      });
    });
    container.querySelectorAll('.eliminar-usuario-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        const username = btn.dataset.username;
        Admin.eliminarUsuario(uid, username);
      });
    });
    
    container.querySelectorAll('.usuario-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const item = header.closest('.usuario-item');
        if (item) {
          Admin.toggleUsuario(item, item.dataset.uid);
        }
      });
    });
    
    const loadMoreBtn = document.getElementById('loadMoreUsersBtn');
    if (loadMoreBtn) loadMoreBtn.style.display = this.usersPagination.hasMore ? 'block' : 'none';
  },

  toggleUsuario(element, uid) {
    if (!element) return;
    element.classList.toggle('abierto');

    if (element.classList.contains('nuevo')) {
      const usuariosVistos = JSON.parse(localStorage.getItem('admin_usuarios_vistos') || '[]');
      if (!usuariosVistos.includes(uid)) {
        usuariosVistos.push(uid);
        localStorage.setItem('admin_usuarios_vistos', JSON.stringify(usuariosVistos));
      }
      element.classList.remove('nuevo');
      const badge = element.querySelector('.usuario-badge');
      if (badge) badge.remove();
    }
  },

  cargarMasUsuarios() { this.cargarUsuarios(false); },

  buscarUsuarios: Utils.debounce(function() { 
    Admin.cargarUsuarios(true); 
  }, 300),

  async verPerfil(uid) {
    if (!AppState.isAdmin || !uid) return;
    try {
      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) { Utils.showToast('Usuario no encontrado', 'error'); return; }
      const user = userDoc.data();
      const message = `Usuario: ${Utils.capitalizeUsername(user.username)} Email: ${user.email} Premium: ${user.premium ? 'SÍ' : 'NO'} Expira: ${user.expires ? new Date(user.expires).toLocaleDateString() : '-'} Cálculos mes: ${user.calculosMes || 0} Mes actual: ${user.mesActual || '-'} Registro: ${user.created ? new Date(user.created).toLocaleString() : '-'} Último login: ${user.lastLogin ? new Date(user.lastLogin.toDate()).toLocaleString() : '-'} Admin: ${user.isAdmin ? 'SÍ' : 'NO'}`;
      alert(message);
    } catch (error) { console.error('Error viendo perfil:', error); Utils.showToast('Error al cargar perfil', 'error'); }
  },

  abrirMensajeUsuario(uid, username) {
    const texto = prompt(`Escribe el mensaje para ${username}:`);
    if (texto && texto.trim()) this.enviarMensajeUsuario(uid, texto.trim());
  },

  async enviarMensajeUsuario(uid, texto) {
    if (!AppState.isAdmin || !uid || !texto) return;
    Utils.showLoading();
    try {
      await Storage.enviarMensajeAdminAUsuario(uid, texto);
      Utils.showToast(`✅ Mensaje enviado a usuario`, 'success');
    } catch (error) { console.error('Error enviando mensaje:', error); Utils.showToast('Error al enviar mensaje', 'error'); }
    finally { Utils.hideLoading(); }
  },

  async eliminarUsuario(uid, username) {
    if (!AppState.isAdmin || !uid) return;
    const confirmado = await Utils.confirm(
      'ELIMINAR USUARIO',
      `¿Estás seguro de eliminar permanentemente a "${username}"?\n\nSe borrarán todos sus datos (perfil, historial, planes, mensajes).\nLa cuenta de acceso seguirá existiendo pero sin datos.`
    );
    if (!confirmado) return;

    Utils.showLoading();
    try {
      const userRef = firebaseServices.db.collection('users').doc(uid);

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

      await firebaseServices.db.collection('mensajes').doc(uid).delete();
      await firebaseServices.db.collection('mensajes').doc('admin_' + uid).delete();
      await userRef.delete();

      Utils.showToast(`✅ Usuario ${username} eliminado (datos borrados)`, 'success');
      this.cargarUsuarios(true);
    } catch (error) { console.error('Error eliminando usuario:', error); Utils.showToast('Error al eliminar usuario: ' + error.message, 'error'); }
    finally { Utils.hideLoading(); }
  },

  abrirModalPremium(uid, username, esPremium, expires) {
    this.currentEditUserId = uid;
    const userEl = document.getElementById('premiumManageUser');
    if (userEl) userEl.innerText = `Editando premium de: ${username}`;

    const statusEl = document.getElementById('premiumManageStatus');
    if (statusEl) statusEl.value = esPremium ? 'true' : 'false';

    const expiryEl = document.getElementById('premiumManageExpiry');
    if (expiryEl) {
      if (expires && expires !== '-') {
        const d = new Date(expires);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        expiryEl.value = `${year}-${month}-${day}`;
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        expiryEl.value = `${year}-${month}-${day}`;
      }
    }

    const modal = document.getElementById('premiumManageModal');
    const overlay = document.getElementById('premiumManageOverlay');
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
  },

  cerrarModalPremium() {
    const modal = document.getElementById('premiumManageModal');
    const overlay = document.getElementById('premiumManageOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    this.currentEditUserId = null;
  },

  async guardarPremium() {
    if (!this.currentEditUserId) return;

    const statusEl = document.getElementById('premiumManageStatus');
    const expiryEl = document.getElementById('premiumManageExpiry');
    const status = statusEl ? statusEl.value === 'true' : false;
    let expiry = expiryEl ? expiryEl.value : '';

    if (!expiry) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      expiry = d.toISOString();
    } else {
      expiry = new Date(expiry + 'T23:59:59').toISOString();
    }

    Utils.showLoading();
    try {
      await firebaseServices.db.collection('users').doc(this.currentEditUserId).update({ premium: status, expires: expiry });
      Utils.showToast('✅ Estado premium actualizado', 'success');
      this.cerrarModalPremium();
      this.cargarUsuarios(true);
    } catch (error) { console.error('Error actualizando premium:', error); Utils.showToast('Error: ' + error.message, 'error'); }
    finally { Utils.hideLoading(); }
  },

  async cargarMensajesUsuarios(reset = false) {
    if (!AppState.isAdmin) return;
    if (this.messagesPagination.loading) return;

    this.messagesPagination.loading = true;
    const container = document.getElementById('adminMessagesList');
    if (!container) return;

    if (reset) {
      container.innerHTML = '<div style="text-align:center; padding:40px; color: var(--text-secondary);">⏳ Cargando mensajes...</div>';
      this.messagesPagination.lastDoc = null;
      this.messagesPagination.hasMore = true;
      this.messagesPagination.allMessagesCache = [];
    }

    try {
      const limit = 10;
      const { docs, lastDoc } = await Storage.getAdminMessagesPaginated(limit, this.messagesPagination.lastDoc);
      
      this.messagesPagination.lastDoc = lastDoc;
      this.messagesPagination.hasMore = docs.length === limit;
      
      let allMessages = [];
      const mensajesVistos = JSON.parse(sessionStorage.getItem('admin_mensajes_vistos') || '[]');
      
      for (const doc of docs) {
        const uid = doc.id.replace('admin_', '');
        const mensajes = doc.data().mensajes || [];
        
        mensajes.forEach((msg, idx) => {
          const username = msg.username || 'Usuario';
          const mensajeId = `${uid}_${idx}`;
          allMessages.push({
            ...msg,
            fromUid: uid,
            username: Utils.capitalizeUsername(username),
            mensajeIdx: idx,
            mensajeId,
            docId: doc.id,
            esNuevo: !msg.leido && !mensajesVistos.includes(mensajeId),
            texto: Utils.escapeHTML(msg.texto)
          });
        });
      }
      
      allMessages.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      if (reset) {
        this.messagesPagination.allMessagesCache = allMessages;
      } else {
        this.messagesPagination.allMessagesCache = [...this.messagesPagination.allMessagesCache, ...allMessages];
      }
      
      this.renderMessagesList(this.messagesPagination.allMessagesCache);
      
      const loadMoreBtn = document.getElementById('loadMoreMessagesBtn');
      if (loadMoreBtn) {
        loadMoreBtn.style.display = this.messagesPagination.hasMore ? 'block' : 'none';
        if (!this.messagesPagination.hasMore && this.messagesPagination.allMessagesCache.length === 0) {
          container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--text-secondary);">No hay mensajes de usuarios</p>';
        }
      }
      
    } catch (error) {
      console.error('Error cargando mensajes de usuarios:', error);
      container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--zone-5);">Error al cargar mensajes</p>';
    } finally {
      this.messagesPagination.loading = false;
    }
  },
  
  renderMessagesList(messages) {
    const container = document.getElementById('adminMessagesList');
    if (!container) return;
    
    if (messages.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--text-secondary);">No hay mensajes de usuarios</p>';
      return;
    }
    
    let html = '';
    for (const msg of messages) {
      const nuevoClass = msg.esNuevo ? 'nuevo' : '';
      html += `
        <div class="mensaje-item ${nuevoClass}" data-mensaje-id="${msg.mensajeId}" data-uid="${msg.fromUid}" data-msg-idx="${msg.mensajeIdx}">
          <div class="mensaje-header" data-mensaje-id="${msg.mensajeId}">
            <span class="mensaje-fecha">📨 ${msg.fecha}</span>
            <span class="mensaje-remitente">${Utils.escapeHTML(msg.username)}</span>
            ${msg.esNuevo ? '<span class="nuevo-badge">NUEVO</span>' : ''}
          </div>
          <div class="mensaje-contenido">
            <p>${msg.texto}</p>
          </div>
          <div class="mensaje-botones">
            <button class="responder" data-uid="${msg.fromUid}" data-username="${Utils.escapeHTML(msg.username)}">✉️ RESPONDER</button>
            <button class="eliminar" data-uid="${msg.fromUid}" data-msg-idx="${msg.mensajeIdx}">🗑️ ELIMINAR</button>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.responder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Admin.responderMensaje(btn.dataset.uid, btn.dataset.username);
      });
    });
    container.querySelectorAll('.eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Admin.borrarMensajeUsuario(btn.dataset.uid, parseInt(btn.dataset.msgIdx));
      });
    });
    container.querySelectorAll('.mensaje-item').forEach(item => {
      const header = item.querySelector('.mensaje-header');
      if (header) {
        header.addEventListener('click', () => Admin.toggleMensaje(item, item.dataset.mensajeId));
      } else {
        item.addEventListener('click', () => Admin.toggleMensaje(item, item.dataset.mensajeId));
      }
    });
  },
  
  cargarMasMensajesAdmin() {
    if (this.messagesPagination.hasMore && !this.messagesPagination.loading) {
      this.cargarMensajesUsuarios(false);
    }
  },

  toggleMensaje(element, mensajeId) {
    if (!element) return;
    element.classList.toggle('abierto');
    if (element.classList.contains('nuevo')) {
      const mensajesVistos = JSON.parse(sessionStorage.getItem('admin_mensajes_vistos') || '[]');
      if (!mensajesVistos.includes(mensajeId)) {
        mensajesVistos.push(mensajeId);
        sessionStorage.setItem('admin_mensajes_vistos', JSON.stringify(mensajesVistos));
      }
      element.classList.remove('nuevo');
      const badge = element.querySelector('.nuevo-badge');
      if (badge) badge.remove();
    }
  },

  responderMensaje(uid, username) { this.abrirMensajeUsuario(uid, username); },

  async enviarMensajeATodos() {
    if (!AppState.isAdmin) return;
    const broadcastEl = document.getElementById('adminBroadcastText');
    const texto = broadcastEl ? broadcastEl.value.trim() : '';
    if (!texto) { Utils.showToast('Escribe un mensaje', 'warning'); return; }

    const confirmado = await Utils.confirm('ENVÍO MASIVO', `¿Enviar este mensaje a TODOS los usuarios? (puede tardar unos segundos)`);
    if (!confirmado) return;

    Utils.showLoading();
    try {
      const snapshot = await firebaseServices.db.collection('users').get();
      const users = snapshot.docs;
      let enviados = 0, errores = 0;

      const lotes = [];
      for (let i = 0; i < users.length; i += 10) {
        const lote = users.slice(i, i + 10).map(async (userDoc) => {
          try { await Storage.enviarMensajeAdminAUsuario(userDoc.id, texto); enviados++; }
          catch (e) { console.error(`Error enviando a ${userDoc.id}:`, e); errores++; }
        });
        lotes.push(Promise.all(lote));
      }
      await Promise.all(lotes);
      Utils.showToast(`✅ Mensajes enviados: ${enviados} correctos, ${errores} errores`, errores === 0 ? 'success' : 'warning');
      if (broadcastEl) broadcastEl.value = '';
    } catch (error) { console.error('Error en envío masivo:', error); Utils.showToast('Error al enviar mensajes: ' + error.message, 'error'); }
    finally { Utils.hideLoading(); }
  }
};

window.Admin = Admin;

// ==================== MÓDULO UI ====================
const UI = {
  consejos: [
    "La constancia vence al talento cuando el talento no entrena.",
    "El descanso no es pérdida de forma, es cuando el cuerpo se reconstruye.",
    "Confía en el proceso, no en la prisa.",
    "La Z2 (aeróbica) construye la base de todo corredor.",
    "Incluye fuerza 2 veces por semana; es el seguro de vida de tus articulaciones.",
    "Aumenta el kilometraje semanal no más de un 10% para evitar lesiones.",
    "El umbral de lactato es el mejor predictor de tu rendimiento en carrera.",
    "Las tiradas largas se hacen a ritmo de conversación, no de competición.",
    "Los días de series, la calidad importa más que la cantidad.",
    "El calentamiento y la vuelta a la calma no son opcionales, son parte del entreno.",
    "Dormir 8 horas es tan importante como la sesión de calidad.",
    "La hidratación empieza días antes de la carrera, no en el avituallamiento.",
    "Escucha a tu cuerpo: el dolor punzante es señal de parar, las agujetas son normales.",
    "Un masaje con rodillo de espuma puede ser tu mejor amigo (o tu peor enemigo, pero útil).",
    "Alterna zapatillas para dar tiempo a que la espuma recupere su forma.",
    "La nutrición post-entreno (ventana metabólica) acelera la recuperación.",
    "Divide la carrera en segmentos pequeños; el cerebro gestiona mejor metas cortas.",
    "Visualiza la carrera antes de correrla; el cerebro no distingue lo imaginado de lo real.",
    "Crea un mantra mental para los momentos duros. Repítelo.",
    "No salgas más rápido de lo planeado; el subidón inicial pasa factura al final.",
    "Cada entrenamiento tiene un propósito. Si no sabes cuál es, pregúntate por qué lo haces.",
    "Compara tu yo de hoy con tu yo de ayer, no con el de los demás.",
    "Los geles no se prueban el día de la carrera; entrena también tu estómago.",
    "El café 45 minutos antes de correr puede mejorar tu rendimiento (si lo toleras).",
    "No experimentes con comidas nuevas la noche antes de una competición.",
    "La cadencia ideal ronda los 180 pasos por minuto; contar durante 30 segundos y multiplicar por dos.",
    "Correr descalzo sobre césped de vez en cuando fortalece la musculatura del pie.",
    "Revisa tu pisada en una tienda especializada; unas zapatillas inadecuadas pueden causar lesiones.",
    "El éxito no se construye con un solo entrenamiento, sino con la suma de todos ellos."
  ],

  consejoIndex: 0,
  dailyInterval: null,
  consejoInterval: null,
  historialCargando: false,

  updateTip(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<span>> ' + this.consejos[this.consejoIndex] + '</span><small>// pulsa para otro</small>';
      this.consejoIndex = (this.consejoIndex + 1) % this.consejos.length;
    }
  },

  changeDailyTip() { this.updateTip('dailyTip'); },
  changeConsejo() { this.updateTip('curiosity'); },

  startConsejoAutoChange() {
    if(this.dailyInterval) clearInterval(this.dailyInterval);
    if(this.consejoInterval) clearInterval(this.consejoInterval);
    this.dailyInterval = setInterval(() => { if(document.getElementById("loginPage")?.style.display !== "none") this.updateTip('dailyTip'); }, 8000);
    this.consejoInterval = setInterval(() => { if(document.getElementById("mainContent")?.style.display !== "none") this.updateTip('curiosity'); }, 8000);
  },

  marcarCampoTocado(c) {
    if (!AppState) return;
    AppState.camposTocados[c] = true;
    this.validarCampo(c);
    this.validarTodo();
  },

  validarCampo(c) {
    const el = document.getElementById(c);
    const err = document.getElementById(c + 'Error');
    if (!el || !err) return true;
    if(c === 'name') return true;
    if(!AppState || !AppState.camposTocados[c]) {
      err.classList.remove('visible');
      el.classList.remove('error');
      return true;
    }
    let ok = true;
    if(c === 'age') {
      const a = parseInt(el.value);
      ok = !isNaN(a) && a >= 14 && a <= 85;
    }
    else if(c === 'time') {
      const t = Utils.parseTime(el.value);
      ok = !isNaN(t) && t >= 10 && t <= 90;
    }
    if(!ok) {
      err.innerText = c === 'age' ? 'Edad 14-85' : 'Formato MM:SS o solo minutos (ej. 27)';
      err.classList.add('visible');
      el.classList.add('error');
    }
    else {
      err.classList.remove('visible');
      el.classList.remove('error');
    }
    return ok;
  },

  validarTodo() {
    const a = this.validarCampo('age'), t = this.validarCampo('time');
    const btn = document.getElementById("calcBtn");
    if(btn) btn.disabled = !(a && t);
    AppState.actualizarBotonCalcular();
  },

  async switchTab(tab) {
    if (window.Chat && window.Chat.closeChat) {
      window.Chat.closeChat();
    }

    if (tab !== 'muro' && window.Wall) {
      Wall.detenerListener();
    }

    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(b => b.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    for(let b of tabs) {
      if(b.textContent.includes(tab === 'entreno' ? 'ENTRENO' : 
                               tab === 'plan' ? 'PLAN' : 
                               tab === 'historial' ? 'HISTORIAL' : 
                               tab === 'soporte' ? 'SOPORTE' : 
                               tab === 'perfil' ? 'PERFIL' : 
                               tab === 'amigos' ? 'AMIGOS' : 
                               tab === 'muro' ? 'MURO' : 'ADMIN')) { 
        b.classList.add('active'); 
        break; 
      }
    }

    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');

    try {
      if(tab === 'historial') {
        if (AppState) AppState.resetHistorialPagination();
        await this.cargarHistorialCompleto(true);
      }
      if(tab === 'plan') {
        await this.cargarHistorialPlanes();
      }
      if(tab === 'soporte') { 
        await this.cargarMensajesRecibidos(); 
        await this.cargarMensajesEnviados(); 
      }
      if(tab === 'perfil') {
        if (window.Profile) await Profile.cargarPerfil();
      }
      if(tab === 'amigos') {
        if (window.Friends) {
          await Friends.actualizarBadgeSolicitudes();
          const activeAmigosTab = document.querySelector('.amigos-tab.active');
          if (activeAmigosTab) {
            const tabText = activeAmigosTab.textContent.toLowerCase();
            if (tabText.includes('buscar')) {
              if (!Friends.todosUsuariosPagination.lastDoc) {
                await Friends.cargarTodosUsuarios(true);
              }
            } else if (tabText.includes('solicitudes')) {
              await Friends.cargarSolicitudesRecibidas();
            } else if (tabText.includes('mis amigos')) {
              await Friends.cargarListaAmigos();
            }
          } else {
            await Friends.cargarTodosUsuarios(true);
          }
        }
      }
      if(tab === 'muro') {
        if (window.Wall) {
          Wall.detenerListener();
          Wall.initListener();
        }
      }
      if(tab === 'admin' && AppState && AppState.isAdmin) {
        Admin.cargarUsuarios(true);
        Admin.cargarMensajesUsuarios(true);
      }
    } catch (error) {
      console.error(`Error cargando pestaña ${tab}:`, error);
      Utils.showToast('Error al cargar contenido', 'error');
    }

    this.guardarEstado();
  },

  renderMessageList(container, mensajes, tipo, onToggleCallback) {
    if (!container) return;
    if (!mensajes.length) { container.innerHTML = '<p style="text-align:center; padding:40px; color: var(--text-secondary);">No hay mensajes</p>'; return; }
    const mensajesVistos = JSON.parse(sessionStorage.getItem(`user_mensajes_vistos_${tipo}`) || '[]');
    let html = '';
    mensajes.forEach((msg, i) => {
      const mensajeId = `${tipo}_${i}`;
      const esNuevo = !msg.leido && !mensajesVistos.includes(mensajeId);
      const nuevoClass = esNuevo ? 'nuevo' : '';
      const fecha = msg.fecha;
      const remitente = msg.esAdmin ? 'Admin' : (msg.esUsuario ? 'Tú' : 'Soporte');
      const icono = msg.esAdmin ? '📨' : (msg.esUsuario ? '📤' : '💬');
      html += `<div class="mensaje-item ${nuevoClass}" data-mensaje-id="${mensajeId}" data-msg-index="${i}" data-tipo="${tipo}"> <div class="mensaje-header" data-msg-index="${i}" data-tipo="${tipo}"> <span class="mensaje-fecha">${icono} ${fecha}</span> <span class="mensaje-remitente">${Utils.escapeHTML(remitente)}</span> ${esNuevo ? '<span class="nuevo-badge">NUEVO</span>' : ''} </div> <div class="mensaje-contenido"> <p>${Utils.escapeHTML(msg.texto)}</p> </div> <div class="mensaje-botones"> ${onToggleCallback ?`<button class="responder" data-msg-index="${i}" data-tipo="${tipo}">✉️ RESPONDER</button>`: ''} <button class="eliminar" data-msg-index="${i}" data-tipo="${tipo}">🗑️ ELIMINAR</button> </div> </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.mensaje-item').forEach(el => {
      const header = el.querySelector('.mensaje-header');
      if (header) {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(el.dataset.msgIndex);
          const tipoMsg = el.dataset.tipo;
          const mensajeId = el.dataset.mensajeId;
          el.classList.toggle('abierto');
          if (!el.classList.contains('nuevo') && AppState.currentUserId) {
            Storage.marcarLeido(AppState.currentUserId, idx);
          }
          if (el.classList.contains('nuevo')) {
            const vistos = JSON.parse(sessionStorage.getItem(`user_mensajes_vistos_${tipoMsg}`) || '[]');
            if (!vistos.includes(mensajeId)) {
              vistos.push(mensajeId);
              sessionStorage.setItem(`user_mensajes_vistos_${tipoMsg}`, JSON.stringify(vistos));
            }
            el.classList.remove('nuevo');
            const badge = el.querySelector('.nuevo-badge');
            if (badge) badge.remove();
            Storage.getMensajesUsuario(AppState.currentUserId).then(msgs => {
              AppState.mensajesNoLeidos = msgs.filter(m => !m.leido).length;
              this.actualizarBadgeMensajes();
            });
          }
        });
      } else {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.eliminar') || e.target.closest('.responder')) return;
          const idx = parseInt(el.dataset.msgIndex);
          const tipoMsg = el.dataset.tipo;
          const mensajeId = el.dataset.mensajeId;
          el.classList.toggle('abierto');
          if (!el.classList.contains('nuevo') && AppState.currentUserId) {
            Storage.marcarLeido(AppState.currentUserId, idx);
          }
          if (el.classList.contains('nuevo')) {
            const vistos = JSON.parse(sessionStorage.getItem(`user_mensajes_vistos_${tipoMsg}`) || '[]');
            if (!vistos.includes(mensajeId)) {
              vistos.push(mensajeId);
              sessionStorage.setItem(`user_mensajes_vistos_${tipoMsg}`, JSON.stringify(vistos));
            }
            el.classList.remove('nuevo');
            const badge = el.querySelector('.nuevo-badge');
            if (badge) badge.remove();
            Storage.getMensajesUsuario(AppState.currentUserId).then(msgs => {
              AppState.mensajesNoLeidos = msgs.filter(m => !m.leido).length;
              this.actualizarBadgeMensajes();
            });
          }
        });
      }
      const responderBtn = el.querySelector('.responder');
      if (responderBtn) {
        responderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = responderBtn.dataset.msgIndex;
          const tipoMsg = responderBtn.dataset.tipo;
          if (onToggleCallback) {
            eval(onToggleCallback);
          }
        });
      }
      const eliminarBtn = el.querySelector('.eliminar');
      if (eliminarBtn) {
        eliminarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(eliminarBtn.dataset.msgIndex);
          const tipoMsg = eliminarBtn.dataset.tipo;
          UI.borrarMensajeUsuario(idx, tipoMsg);
        });
      }
    });
  },

  async cargarMensajesRecibidos() {
    const container = document.getElementById('listaMensajesRecibidos');
    if (!container || !AppState.currentUserId) return;
    const msgs = await Storage.getMensajesUsuario(AppState.currentUserId);
    this.renderMessageList(container, msgs, 'recibido', null);
    this.actualizarBadgeMensajes();
  },

  async cargarMensajesEnviados() {
    const container = document.getElementById('listaMensajesEnviados');
    if (!container || !AppState.currentUserId) return;
    const msgs = await Storage.getMensajesEnviadosUsuario(AppState.currentUserId);
    this.renderMessageList(container, msgs, 'enviado', null);
  },

  async borrarMensajeUsuario(i, tipo) {
    if(!AppState || !AppState.currentUserId) return;
    const confirmed = await Utils.confirm('Eliminar mensaje', '¿Eliminar?');
    if(!confirmed) return;
    try {
      if (tipo === 'enviado') {
        await Storage.borrarMensajeEnviadoUsuario(AppState.currentUserId, i);
        await this.cargarMensajesEnviados();
      } else {
        await Storage.borrarMensajeUsuario(AppState.currentUserId, i);
        await this.cargarMensajesRecibidos();
      }
      Utils.showToast('✅ Eliminado', 'success');
    }
    catch (error) { console.error('Error borrando mensaje:', error); Utils.showToast('Error al eliminar', 'error'); }
  },

  async enviarMensajeUsuario() {
    if(!AppState || !AppState.currentUserId) return;
    const t = document.getElementById('mensajeUsuario')?.value.trim();
    if(!t) { Utils.showToast('Escribe un mensaje', 'warning'); return; }
    try { await Storage.enviarMensajeUsuario(AppState.currentUserId, t); if (document.getElementById('mensajeUsuario')) document.getElementById('mensajeUsuario').value = ''; Utils.showToast('✅ Mensaje enviado', 'success'); await this.cargarMensajesEnviados(); }
    catch (error) { console.error('Error enviando mensaje:', error); Utils.showToast('Error al enviar', 'error'); }
  },

  cambiarSoporteTab(tab) {
    const soporteTabs = document.querySelectorAll('#tab-soporte .soporte-tab');
    const soportePanels = document.querySelectorAll('#tab-soporte .soporte-panel');
    soporteTabs.forEach(t => t.classList.remove('active'));
    soportePanels.forEach(p => p.classList.remove('active'));
    if(tab === 'recibidos') {
      if (soporteTabs[0]) soporteTabs[0].classList.add('active');
      const recibidos = document.getElementById('soporte-recibidos');
      if (recibidos) recibidos.classList.add('active');
    } else {
      if (soporteTabs[1]) soporteTabs[1].classList.add('active');
      const enviados = document.getElementById('soporte-enviados');
      if (enviados) enviados.classList.add('active');
    }
  },

  actualizarBadgeMensajes() {
    const t = document.getElementById('soporteTabButton');
    if(t && AppState) {
      if(AppState.mensajesNoLeidos > 0) t.classList.add('soporte-unread');
      else t.classList.remove('soporte-unread');
    }
  },

  cerrarPlan() {
    const calendario = document.getElementById("calendarioEntreno");
    const cuestionario = document.getElementById("cuestionarioEntreno");
    if (calendario) calendario.style.display = "none";
    if (cuestionario) cuestionario.style.display = "block";
    if (AppState) AppState.limpiarDatosPlan();
    this.guardarEstado();
  },

  initDiasCheckboxes() {
    const c = document.getElementById('diasSemanaContainer');
    if (!c) return;
    const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    let h = '';
    for(let i = 0; i < 7; i++) {
      const n = i + 1;
      const checked = (n <= 5) ? 'checked' : '';
      h += `<div class="dia-checkbox"> <input type="checkbox" id="dia${n}" value="${n}" ${checked}> <label for="dia${n}">${dias[i]}</label> </div>`;
    }
    c.innerHTML = h;
  },

  guardarEstado() {
    if (!AppState || !AppState.currentUserId) return;
    const activeTab = document.querySelector('.tab-button.active')?.textContent.toLowerCase() || 'entreno';
    const calendario = document.getElementById('calendarioEntreno');
    const estado = {
      activeTab: activeTab,
      planVisible: calendario ? calendario.style.display === 'block' : false,
      planId: AppState.planActualId,
      trimestre: AppState.trimestreActual
    };
    sessionStorage.setItem('ri5_estado', JSON.stringify(estado));
  },

  async restaurarEstado() {
    const estadoStr = sessionStorage.getItem('ri5_estado');
    if (!estadoStr) return;
    try {
      const estado = JSON.parse(estadoStr);
      if (estado.activeTab) {
        const tabMap = { 'entreno': 'entreno', 'plan': 'plan', 'historial': 'historial', 'soporte': 'soporte', 'perfil': 'perfil', 'amigos': 'amigos', 'muro': 'muro', 'admin': 'admin' };
        const tab = tabMap[estado.activeTab] || 'entreno';
        await this.switchTab(tab);
      }
      if (estado.planVisible && estado.planId && AppState && AppState.currentUserId) {
        if (AppState) AppState.trimestreActual = estado.trimestre || 0;
        await this.cargarPlanDesdeHistorial(estado.planId);
      }
    } catch (e) { console.warn('Error restaurando estado', e); }
  },

  async cargarHistorialCompleto(reset = false) {
    const container = document.getElementById("historialContainer");
    if(!container) return;
    if(!AppState || !AppState.currentUserId) { container.innerHTML = '<p style="text-align:center; padding:20px;">Sin historial</p>'; return; }
    if (!AppState.historialPagination) AppState.historialPagination = { lastDoc: null, hasMore: true, loading: false };
    if (AppState.historialPagination.loading) return;
    AppState.historialPagination.loading = true;
    if (reset) { container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Cargando…</div>'; AppState.historialPagination.lastDoc = null; AppState.historialPagination.hasMore = true; }
    try {
      const limitSelect = document.getElementById('historialLimit');
      const limit = limitSelect ? parseInt(limitSelect.value) : 10;
      const result = await Storage.getHistorial(AppState.currentUserId, limit, reset ? null : AppState.historialPagination.lastDoc);
      if (reset) container.innerHTML = '';
      if (result.items.length === 0) { if (reset) container.innerHTML = '<p style="text-align:center; padding:20px;">Sin cálculos guardados</p>'; AppState.historialPagination.hasMore = false; AppState.historialPagination.loading = false; return; }
      AppState.historialPagination.lastDoc = result.lastDoc;
      AppState.historialPagination.hasMore = result.items.length === limit;
      let html = container.innerHTML;
      result.items.forEach((it) => {
        let zonas = '';
        if(it.zonasResumen && Array.isArray(it.zonasResumen)) {
          zonas = '<div class="zonas-pastillas">';
          it.zonasResumen.forEach(z => {
            if (z.max === "MÁX") zonas += `<span class="zona-pastilla ${z.zona.toLowerCase()}"><span></span> ${z.zona}: >${z.min}</span>`;
            else zonas += `<span class="zona-pastilla ${z.zona.toLowerCase()}"><span></span> ${z.zona}: ${z.min}-${z.max}</span>`;
          });
          zonas += '</div>';
        }
        const pred = it.predicciones ? `<div class="predicciones">📊 ${Utils.escapeHTML(it.predicciones)}</div>` : '';
        const hora = it.hora ? `<div class="hora-detalle">🕒 ${Utils.escapeHTML(it.hora)}</div>` : '';
        const resumen = it.resumen ? Utils.escapeHTML(it.resumen) : (it.nombre + ' · ' + it.edad + ' años');
        html += `<div class="historial-item" onclick="toggleHistorialDetalle(this)"> <div class="fecha">📅 ${it.date || ''}</div> <div class="resumen">${resumen}</div> <button class="delete-icon" onclick="event.stopPropagation(); borrarEntradaHistorial('${it.id}')">🗑️</button> <div class="detalle">${hora}${pred}${zonas}${it.fcMax ? `<div>❤️ FC Máx: ${it.fcMax} lpm</div>`: ''}${it.umbral ?`<div>⚡ Umbral: ${it.umbral} lpm</div>` : ''}</div> </div>`;
      });
      if (AppState.historialPagination.hasMore) html += `<div style="text-align:center; margin-top:20px;"><button class="action-button" onclick="cargarMasHistorial()" style="width:auto; padding:10px 20px;">CARGAR MÁS</button></div>`;
      container.innerHTML = html;
    } catch (error) { console.error('Error cargando historial:', error); if (reset) container.innerHTML = '<p style="text-align:center; padding:20px;">Error al cargar</p>'; }
    finally { if (AppState && AppState.historialPagination) AppState.historialPagination.loading = false; }
  },

  async cargarHistorial() { await this.cargarHistorialCompleto(true); },
  toggleHistorialDetalle(el) { if(el) el.classList.toggle('abierto'); },

  async borrarEntradaHistorial(entryId) {
    if(!AppState || !AppState.currentUserId || !entryId) return;
    const confirmed = await Utils.confirm('Eliminar entrada', '¿Eliminar esta entrada?');
    if(!confirmed) return;
    try { await Storage.deleteHistorialEntry(AppState.currentUserId, entryId); if (AppState) AppState.resetHistorialPagination(); await this.cargarHistorialCompleto(true); Utils.showToast('✅ Entrada eliminada', 'success'); }
    catch (error) { console.error('Error borrando entrada:', error); Utils.showToast('Error al eliminar', 'error'); }
  },

  async borrarHistorial() {
    if(!AppState || !AppState.currentUserId) return;
    const confirmed = await Utils.confirm('Limpiar historial', '¿Eliminar todo el historial?');
    if(!confirmed) return;
    Utils.showLoading();
    try {
      const snapshot = await firebaseServices.db.collection('users').doc(AppState.currentUserId).collection('historial').get();
      const batch = firebaseServices.db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      if (AppState) AppState.resetHistorialPagination();
      await this.cargarHistorialCompleto(true);
      Utils.showToast('✅ Historial limpio', 'success');
    } catch (error) { console.error('Error borrando historial:', error); Utils.showToast('Error al limpiar', 'error'); }
    finally { Utils.hideLoading(); }
  },

  async cargarHistorialPlanes() {
    const container = document.getElementById('planesHistorialContainer');
    const section = document.getElementById('planesHistorial');
    if (!container || !section) return;
    if (!AppState || !AppState.currentUserId || !AppState.isPremium) { section.style.display = 'none'; return; }
    try {
      const planes = await Storage.getHistorialPlanes(AppState.currentUserId, 5);
      if (!planes || planes.length === 0) { section.style.display = 'none'; return; }
      section.style.display = 'block';
      let html = '';
      planes.forEach((plan) => {
        const fecha = plan.fechaCreacion ? new Date(plan.fechaCreacion).toLocaleDateString() : '';
        const params = plan.params || {};
        const distancia = params.distancia ? (params.distancia === '2k' ? '2K' : params.distancia === '5k' ? '5K' : params.distancia === '10k' ? '10K' : params.distancia === 'medio' ? 'MEDIA' : 'MARATÓN') : '';
        html += `<div class="plan-card" data-plan-id="${plan.id}"> <div class="plan-info" onclick="cargarPlanDesdeHistorial('${plan.id}')"> <div class="plan-fecha">📅 ${Utils.escapeHTML(fecha)}</div> <div class="plan-resumen">${Utils.escapeHTML(distancia)} · ${Utils.escapeHTML(params.diasPorSemana || '?')} días · ${Utils.escapeHTML(params.nivel || '')}</div> </div> <button class="delete-plan" onclick="event.stopPropagation(); eliminarPlanHistorial('${plan.id}')">🗑️</button> </div>`;
      });
      container.innerHTML = html;
    } catch (error) { console.error('Error cargando historial de planes:', error); section.style.display = 'none'; }
  },

  async guardarPlanEnHistorial(planParams, planCompleto) {
    if (!AppState || !AppState.currentUserId || !AppState.isPremium) return;
    if (!planCompleto || !planCompleto.sesiones || !Array.isArray(planCompleto.sesiones) || planCompleto.sesiones.length === 0) { console.error('❌ Plan inválido, no se guarda en historial'); return; }
    try {
      const mapaDist = { "2k":"2 km", "5k":"5 km", "10k":"10 km", "medio":"MEDIA", "maraton":"MARATÓN" };
      const resumen = `${mapaDist[planParams.distancia] || planParams.distancia} · ${planParams.diasPorSemana} días · ${planParams.nivel}`;
      const planExistente = await Storage.getPlanCompleto(AppState.currentUserId, planParams.planId);
      if (planExistente) { console.log('📌 Plan ya existe, no se duplica'); return; }
      await Storage.savePlanCompleto(AppState.currentUserId, planParams.planId, planCompleto);
      await this.cargarHistorialPlanes();
      console.log('✅ Plan guardado en historial correctamente');
    } catch (error) { console.error('Error guardando plan en historial:', error); }
  },

  async cargarPlanDesdeHistorial(planId) {
    if (!AppState || !AppState.currentUserId || !planId) return;
    try {
      Utils.showLoading();
      const planCompleto = await Storage.getPlanCompleto(AppState.currentUserId, planId);
      if (!planCompleto) { Utils.hideLoading(); Utils.showToast('El plan ya no existe', 'error'); return; }
      if (!planCompleto.sesiones || planCompleto.sesiones.length === 0) { Utils.hideLoading(); Utils.showToast('El plan está corrupto', 'error'); return; }
      if (AppState) { AppState.planGeneradoActual = planCompleto.params; AppState.planActualId = planId; AppState.sesionesRealizadas = planCompleto.sesionesRealizadas || {}; AppState.feedbackSesiones = planCompleto.feedback || {}; AppState.trimestreActual = 0; }
      const calendario = document.getElementById("calendarioEntreno");
      const cuestionario = document.getElementById("cuestionarioEntreno");
      if (calendario) calendario.style.display = "block";
      if (cuestionario) cuestionario.style.display = "none";
      if (window.PlanGenerator) PlanGenerator.mostrarCalendario(planCompleto.sesiones);
      const resumen = document.getElementById("resumenObjetivo");
      if (resumen) resumen.innerText = planCompleto.resumen || 'Plan cargado';
      await window.switchTab('plan');
      this.guardarEstado();
      Utils.scrollToElement('calendarioEntreno', -20);
      Utils.hideLoading();
    } catch (e) { console.error('Error cargando plan:', e); Utils.hideLoading(); Utils.showToast('Error al cargar el plan', 'error'); }
  },

  async eliminarPlanHistorial(planId) {
    if (!AppState || !AppState.currentUserId || !planId) return;
    const confirmed = await Utils.confirm('Eliminar plan', '¿Eliminar este plan?');
    if (!confirmed) return;
    try { await Storage.deletePlan(AppState.currentUserId, planId); await this.cargarHistorialPlanes(); if (document.getElementById('tab-historial')?.classList.contains('active')) { if (AppState) AppState.resetHistorialPagination(); await this.cargarHistorialCompleto(true); } Utils.showToast('✅ Plan eliminado', 'success'); }
    catch (error) { console.error('Error eliminando plan:', error); Utils.showToast('Error al eliminar', 'error'); }
  }
};

// ==================== MÓDULO PWA ====================
const PWA = {
  init() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); AppState.deferredPrompt = e; if(localStorage.getItem('pwa_installed') !== 'true') { const banner = document.getElementById('pwa-banner'); if (banner) banner.style.display = 'flex'; } });
    window.addEventListener('appinstalled', () => { const banner = document.getElementById('pwa-banner'); if (banner) banner.style.display = 'none'; AppState.deferredPrompt = null; localStorage.setItem('pwa_installed', 'true'); Utils.showToast('✅ App instalada', 'success'); });
  },

  async instalarPWA() {
    if(!AppState.deferredPrompt) { Utils.showToast('Para instalar: menú del navegador → "Añadir a pantalla de inicio"', 'info'); return; }
    try { AppState.deferredPrompt.prompt(); const choiceResult = await AppState.deferredPrompt.userChoice; if(choiceResult.outcome === 'accepted') { localStorage.setItem('pwa_installed', 'true'); Utils.showToast('✅ Instalando…', 'success'); } AppState.deferredPrompt = null; const banner = document.getElementById('pwa-banner'); if (banner) banner.style.display = 'none'; } catch (error) { console.error('Error instalando PWA:', error); Utils.showToast('Error al instalar', 'error'); }
  },

  cerrarBannerPWA() { const banner = document.getElementById('pwa-banner'); if (banner) banner.style.display = 'none'; localStorage.setItem('pwa_banner_closed', 'true'); },

  registerServiceWorker() {
    if('serviceWorker' in navigator) {
      const sw = `const CACHE='ri5-cache-v1'; const urls=['.','https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js']; self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(urls)))); self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))); self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>k!==CACHE?caches.delete(k):null)))));`;
      const b = new Blob([sw], {type:'application/javascript'});
      navigator.serviceWorker.register(URL.createObjectURL(b)).catch(console.log);
    }
  }
};

// ==================== MÓDULO DE AUTENTICACIÓN ====================
const Auth = {
  intentosLogin: 0,
  ultimoIntento: 0,

  _manejarErrorFirebase(error) {
    switch (error?.code) {
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
        return '⚠️ Error al iniciar sesión. Revisa tus credenciales.';
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
      emailVerified: true,
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
        privacySettings: { showTrainings: 'friends', showProfile: 'public' }
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

    try {
      const gamificationDefault = {
        totalXP: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        badges: [],
        totalDistance: 0,
        totalSessions: 0,
        lastSessionDate: null,
        lastUpdate: firebaseServices.Timestamp.now()
      };
      await firebaseServices.db.collection('gamification').doc(userId).set(gamificationDefault);
      console.log('✅ Documento de gamificación creado');
    } catch (e) {
      console.warn('Error creando documento de gamificación:', e);
    }

    return userData;
  },

  showVerificationScreen(email) {
    console.log('🛑 Mostrando pantalla de verificación para:', email);
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainContent").style.display = "none";
    document.getElementById("verificationPage").style.display = "flex";
    const emailDisplay = document.getElementById("verificationEmailDisplay");
    if (emailDisplay) emailDisplay.textContent = email;
    Utils.hideLoading();
  },

  async reenviarVerificacion() {
    const user = firebaseServices.auth.currentUser;
    if (!user) {
      Utils.showToast('No hay sesión activa', 'error');
      return;
    }
    try {
      await user.sendEmailVerification();
      Utils.showToast('📧 Correo de verificación reenviado. Revisa tu bandeja de entrada (y spam).', 'success');
    } catch (error) {
      console.error('Error reenviando verificación:', error);
      Utils.handleFirebaseError(error);
    }
  },

  async verificarAhora() {
    const user = firebaseServices.auth.currentUser;
    if (!user) {
      document.getElementById("verificationPage").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";
      Utils.hideLoading();
      return;
    }
    
    Utils.showLoading();
    try {
      await user.reload();
      console.log('🔄 Usuario recargado, emailVerified =', user.emailVerified);
      
      if (user.emailVerified) {
        let userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
          const username = localStorage.getItem('temp_username') || user.email.split('@')[0];
          
          const usernameDoc = await firebaseServices.db.collection('usernames').doc(username).get();
          let finalUsername = username;
          if (usernameDoc.exists) {
            finalUsername = username + '_' + Math.random().toString(36).substr(2, 5);
          }
          
          await firebaseServices.db.collection('usernames').doc(finalUsername).set({
            uid: user.uid,
            createdAt: firebaseServices.Timestamp.now()
          });
          
          await this.createUserDocument(user.uid, user.email, finalUsername);
          localStorage.removeItem('temp_username');
          
          userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();
        } else {
          await firebaseServices.db.collection('users').doc(user.uid).update({ emailVerified: true });
          userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();
        }
        
        const userData = userDoc.data();
        await AppState.setCurrentUser(user.uid, user.email, userData);
        
        document.getElementById("verificationPage").style.display = "none";
        document.getElementById("mainContent").style.display = "flex";
        
        const welcomeEl = document.getElementById("userWelcome");
        if (welcomeEl) {
          welcomeEl.innerText = `> BIENVENIDO, ${userData.username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${new Date(userData.expires).toLocaleDateString()}`;
        }
        
        if (document.getElementById('perfilContainer')) {
          console.log('🔄 Actualizando perfil...');
          await Profile.cargarPerfil();
        }
        
        Utils.showToast('✅ Correo verificado correctamente', 'success');
        if (window.UI) UI.startConsejoAutoChange();
      } else {
        Utils.showToast('❌ El correo aún no está verificado. Revisa tu bandeja de entrada.', 'warning');
      }
    } catch (error) {
      console.error('Error verificando email:', error);
      Utils.showToast('Error al comprobar verificación', 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async registerUser() {
    console.log('📝 Iniciando registro...');
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
      const usernameDoc = await firebaseServices.db.collection('usernames').doc(username).get();
      if (usernameDoc.exists) {
        errorEl.innerText = "⚠️ El nombre de usuario ya está en uso. Elige otro.";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }

      const methods = await firebaseServices.auth.fetchSignInMethodsForEmail(email);
      if (methods.length > 0) {
        errorEl.innerText = "⚠️ El correo ya está registrado. Inicia sesión.";
        errorEl.classList.add('visible');
        btn.disabled = false;
        btn.textContent = '[ REGISTRARSE ]';
        return;
      }

      const userCredential = await firebaseServices.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('✅ Usuario creado en Auth, emailVerified =', user.emailVerified);

      await user.sendEmailVerification();
      console.log('📧 Correo de verificación enviado');

      localStorage.setItem('temp_username', username);
      
      this.showVerificationScreen(email);
      
      Utils.showToast('📧 Registro exitoso. Verifica tu correo para continuar.', 'success', 5000);

    } catch (error) {
      console.error('❌ Error en registro:', error);
      const errorMsg = this._manejarErrorFirebase(error);
      errorEl.innerText = errorMsg;
      errorEl.classList.add('visible');
      document.getElementById('regPassword').value = '';
      Utils.hideLoading();
    } finally {
      btn.disabled = false;
      btn.textContent = '[ REGISTRARSE ]';
    }
  },

  async loginUser() {
    console.log('🔐 Iniciando login...');
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
      console.log('🔑 Usuario autenticado, emailVerified =', user.emailVerified);

      if (!user.emailVerified) {
        console.warn('⛔ Acceso denegado: email no verificado');
        this.showVerificationScreen(user.email);
        Utils.showToast('⚠️ Debes verificar tu correo antes de continuar', 'warning');
        btn.disabled = false;
        btn.textContent = '[ ACCEDER ]';
        return;
      }

      console.log('✅ Email verificado, continuando con login...');

      const userDoc = await firebaseServices.db.collection('users').doc(user.uid).get();

      if (!userDoc.exists) {
        console.log('⚠️ Usuario verificado sin documento en Firestore, forzando verificación...');
        await user.sendEmailVerification();
        this.showVerificationScreen(user.email);
        Utils.showToast('⚠️ Completa la verificación de tu cuenta', 'warning');
        btn.disabled = false;
        btn.textContent = '[ ACCEDER ]';
        return;
      }

      const userData = userDoc.data();
      
      let isPremiumValid = userData.premium === true;
      if (isPremiumValid && userData.expires) {
        const expiryDate = new Date(userData.expires);
        const ahora = new Date();
        if (expiryDate <= ahora) {
          console.log('Premium expirado durante login, actualizando...');
          await firebaseServices.db.collection('users').doc(user.uid).update({
            premium: false
          }).catch(e => console.warn('Error actualizando premium expirado:', e));
          userData.premium = false;
        }
      }
      
      await AppState.setCurrentUser(user.uid, email, userData);

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
      document.getElementById("verificationPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";

      // ========== PRECARGA TOTAL (PERFIL, AMIGOS, MURO, MENSAJES) ==========
      setTimeout(() => {
        if (AppState.currentUserId) {
          // Perfil (aunque ya funciona, lo precargamos para que esté listo)
          if (window.Profile) Profile.cargarPerfil().catch(e => console.warn('Precarga perfil:', e));
          // Lista de amigos (precarga completa)
          if (window.Friends) {
            Friends.cargarListaAmigos().catch(e => console.warn('Precarga amigos:', e));
            // Primer lote de explorar usuarios
            if (Friends.cargarTodosUsuarios) Friends.cargarTodosUsuarios(true).catch(e => console.warn('Precarga explorar:', e));
          }
          // Muro (listener en tiempo real)
          if (window.Wall) Wall.initListener();
          // Mensajes recibidos y enviados
          if (window.UI) {
            UI.cargarMensajesRecibidos().catch(e => console.warn('Precarga mensajes recibidos:', e));
            UI.cargarMensajesEnviados().catch(e => console.warn('Precarga mensajes enviados:', e));
          }
        }
      }, 300); // Pequeño retardo para no bloquear el renderizado inicial
      // ================================================================

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
        // Ya se precargaron, pero por si acaso:
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
      Utils.hideLoading();
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

  async eliminarMiCuenta() {
    const currentUser = firebaseServices.auth.currentUser;
    if (!currentUser) {
      Utils.showToast('❌ No hay sesión activa.', 'error');
      return;
    }

    const email = currentUser.email;
    const uid = currentUser.uid;

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

      await firebaseServices.auth.signOut();
      await AppState.setCurrentUser(null, null);
      AppState.limpiarDatosPlan();

      document.getElementById("mainContent").style.display = "none";
      document.getElementById("verificationPage").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";

      Utils.showToast('✅ Solicitud enviada al administrador. Tu sesión se ha cerrado.', 'success');
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      Utils.showToast(`❌ No se pudo enviar la solicitud. Error: ${error.message}`, 'error');
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
      document.getElementById("verificationPage").style.display = "none";
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
      localStorage.removeItem('ri5_user_data');
      localStorage.removeItem('temp_username');

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
    if (!uid) {
      Utils.hideLoading();
      return false;
    }

    try {
      console.log('🔍 Verificando sesión guardada:', uid);

      if (!navigator.onLine) {
        console.log('⚠️ Sin conexión, no se puede verificar sesión.');
        localStorage.removeItem('ri5_current_user');
        Utils.hideLoading();
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("mainContent").style.display = "none";
        return false;
      }

      let user = firebaseServices.auth.currentUser;
      if (!user) {
        console.log('⏳ Esperando inicialización de Firebase Auth...');
        user = await new Promise((resolve) => {
          const unsubscribe = firebaseServices.auth.onAuthStateChanged((u) => {
            unsubscribe();
            resolve(u);
          });
          setTimeout(() => {
            unsubscribe();
            resolve(null);
          }, 2000);
        });
      }

      if (!user) {
        console.log('❌ No hay usuario en Auth después de esperar');
        localStorage.removeItem('ri5_current_user');
        Utils.hideLoading();
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("mainContent").style.display = "none";
        return false;
      }

      if (user.uid !== uid) {
        console.log('❌ UID no coincide con Auth');
        localStorage.removeItem('ri5_current_user');
        Utils.hideLoading();
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("mainContent").style.display = "none";
        return false;
      }

      console.log('👤 Usuario encontrado, emailVerified =', user.emailVerified);
      if (!user.emailVerified) {
        console.warn('⛔ Sesión restaurada pero email NO verificado. Mostrando pantalla de verificación.');
        this.showVerificationScreen(user.email);
        return false;
      }

      const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        console.log('❌ Usuario no encontrado en Firestore');
        await firebaseServices.auth.signOut();
        localStorage.removeItem('ri5_current_user');
        Utils.hideLoading();
        document.getElementById("verificationPage").style.display = "none";
        document.getElementById("loginPage").style.display = "flex";
        return false;
      }

      const userData = userDoc.data();

      const now = new Date();
      const expiry = new Date(userData.expires);
      let isPremiumValid = userData.premium === true;

      if (isPremiumValid && expiry <= now) {
        console.log('⚠️ Premium expirado durante verificación de sesión');
        await firebaseServices.db.collection('users').doc(uid).update({
          premium: false
        }).catch(e => console.warn('Error actualizando premium expirado:', e));
        userData.premium = false;
        isPremiumValid = false;
      }

      localStorage.setItem('ri5_user_email', userData.email || '');
      if (userData.isAdmin) {
        localStorage.setItem('ri5_is_admin', 'true');
      } else {
        localStorage.removeItem('ri5_is_admin');
      }

      console.log('✅ Sesión válida para:', userData.username);

      await AppState.setCurrentUser(uid, userData.email, userData);

      document.getElementById("loginPage").style.display = "none";
      document.getElementById("verificationPage").style.display = "none";
      document.getElementById("mainContent").style.display = "flex";

      // ========== PRECARGA TOTAL TAMBIÉN AL RESTAURAR SESIÓN ==========
      setTimeout(() => {
        if (AppState.currentUserId) {
          if (window.Profile) Profile.cargarPerfil().catch(e => console.warn('Precarga perfil:', e));
          if (window.Friends) {
            Friends.cargarListaAmigos().catch(e => console.warn('Precarga amigos:', e));
            if (Friends.cargarTodosUsuarios) Friends.cargarTodosUsuarios(true).catch(e => console.warn('Precarga explorar:', e));
          }
          if (window.Wall) Wall.initListener();
          if (window.UI) {
            UI.cargarMensajesRecibidos().catch(e => console.warn('Precarga mensajes recibidos:', e));
            UI.cargarMensajesEnviados().catch(e => console.warn('Precarga mensajes enviados:', e));
          }
        }
      }, 300);
      // ================================================================

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
      } catch (e) {
        console.warn('Error actualizando lastLogin:', e);
      }

      Utils.hideLoading();
      return true;

    } catch (error) {
      console.error('Error en checkSavedSession:', error);
      localStorage.removeItem('ri5_current_user');
      localStorage.removeItem('ri5_user_data');
      Utils.hideLoading();
      document.getElementById("loginPage").style.display = "flex";
      document.getElementById("mainContent").style.display = "none";
      return false;
    }
  },

  showPremiumBenefits() {
    document.getElementById('premiumOverlay').classList.add('active');
    document.getElementById('premiumModal').classList.add('active');
  }
};

// ==================== LISTENER GLOBAL DE AUTENTICACIÓN ====================
firebaseServices.auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log('👤 onAuthStateChanged: usuario autenticado, emailVerified =', user.emailVerified);
    
    if (user.emailVerified) {
      const uid = user.uid;
      const savedUid = localStorage.getItem('ri5_current_user');
      
      if (savedUid === uid || document.getElementById("mainContent").style.display !== "flex") {
        console.log('🔄 Restaurando sesión automáticamente desde onAuthStateChanged...');
        
        const userDoc = await firebaseServices.db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          await AppState.setCurrentUser(uid, user.email, userData);
          
          document.getElementById("loginPage").style.display = "none";
          document.getElementById("verificationPage").style.display = "none";
          document.getElementById("mainContent").style.display = "flex";
          
          const welcomeEl = document.getElementById("userWelcome");
          if (welcomeEl) {
            welcomeEl.innerText = `> BIENVENIDO, ${userData.username.toUpperCase()} · ${userData.premium ? 'PREMIUM' : 'ACCESO'} HASTA ${new Date(userData.expires).toLocaleDateString()}`;
          }
          
          if (window.UI) UI.startConsejoAutoChange();
          Utils.hideLoading();
        } else {
          Auth.showVerificationScreen(user.email);
        }
      }
    } else {
      const verificationPage = document.getElementById("verificationPage");
      if (verificationPage && verificationPage.style.display !== "flex") {
        Auth.showVerificationScreen(user.email);
      }
    }
  } else {
    if (document.getElementById("mainContent").style.display === "flex") {
      document.getElementById("mainContent").style.display = "none";
      document.getElementById("verificationPage").style.display = "none";
      document.getElementById("loginPage").style.display = "flex";
    }
    Utils.hideLoading();
  }
});

// ==================== INICIALIZACIÓN ====================
document.addEventListener("DOMContentLoaded", async () => {
  console.log('🚀 Iniciando RI5…');

  setTimeout(() => {
    document.querySelectorAll('.password-toggle').forEach(button => {
      if (!button.getAttribute('onclick')) {
        const wrapper = button.closest('.password-wrapper');
        const input = wrapper?.querySelector('input');
        if (input && input.id) {
          button.setAttribute('onclick', `togglePassword('${input.id}', this)`);
        }
      }
    });
  }, 500);

  if(!localStorage.getItem('ri5_info_visto')) {
    setTimeout(() => {
      const banner = document.getElementById('infoBanner');
      if (banner) banner.style.display = 'block';
    }, 1000);
  }

  if (!window.firebaseServices) {
    console.error('❌ Firebase no está configurado');
    Utils.showToast('Error de configuración', 'error');
    return;
  }

  const ageInput = document.getElementById("age");
  const timeInput = document.getElementById("time");

  if (ageInput) {
    ageInput.addEventListener("blur", () => UI.marcarCampoTocado('age'));
    ageInput.addEventListener("input", () => {
      if(AppState && AppState.camposTocados.age) UI.validarCampo('age');
      UI.validarTodo();
    });
  }

  if (timeInput) {
    timeInput.addEventListener("blur", () => UI.marcarCampoTocado('time'));
    timeInput.addEventListener("input", () => {
      if(AppState && AppState.camposTocados.time) UI.validarCampo('time');
      UI.validarTodo();
    });
  }

  UI.validarTodo();
  UI.initDiasCheckboxes();

  if(localStorage.getItem('pwa_installed') === 'true' || localStorage.getItem('pwa_banner_closed') === 'true') {
    const pwaBanner = document.getElementById('pwa-banner');
    if (pwaBanner) pwaBanner.style.display = 'none';
  }

  PWA.init();
  PWA.registerServiceWorker();

  setTimeout(() => {
    if(AppState && AppState.deferredPrompt &&
      localStorage.getItem('pwa_installed') !== 'true' &&
      localStorage.getItem('pwa_banner_closed') !== 'true') {
      const pwaBanner = document.getElementById('pwa-banner');
      if (pwaBanner) pwaBanner.style.display = 'flex';
    }
  }, 3000);

  const savedTheme = localStorage.getItem('ri5_theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.body.classList.add(`manual-${savedTheme}`);
  }

  document.addEventListener('click', function enableAudio() {
    window.audioEnabled = true;
    document.removeEventListener('click', enableAudio);
  }, { once: true });

  window.addEventListener('online', () => {
    Storage.procesarCalculosPendientes();
  });

  document.addEventListener('click', function(e) {
    let target = e.target;
    let premiumElement = null;
    
    if (target.innerText === 'PREMIUM') {
      premiumElement = target;
    } else if (target.parentElement && target.parentElement.innerText === 'PREMIUM') {
      premiumElement = target.parentElement;
    } else if (target.closest && target.closest('[class*="premium"]')) {
      premiumElement = target.closest('[class*="premium"]');
    }
    
    if (premiumElement) {
      const perfilTab = document.getElementById('tab-perfil');
      if (perfilTab && perfilTab.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        Utils.showToast('📱 Para actualizar a Premium, contacta con el administrador', 'info', 4000);
        Utils.confirm(
          'Contactar con Administrador',
          '¿Quieres contactar con el administrador para obtener Premium?\n\nAceptar te llevará a Instagram (@navegacionpro)'
        ).then((resultado) => {
          if (resultado) {
            window.open('https://www.instagram.com/navegacionpro', '_blank');
          }
        }).catch(() => {});
      }
    }
  });

  const savedUid = localStorage.getItem('ri5_current_user');
  if (!savedUid) {
    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("mainContent").style.display = "none";
  } else {
    Utils.showLoading();
  }

  console.log('✅ RI5 inicializado correctamente');
});

window.toggleUsuario = (element, uid) => Admin.toggleUsuario(element, uid);
window.toggleMensaje = (element, mensajeId) => Admin.toggleMensaje(element, mensajeId);
window.UI = UI;

window.instalarPWA = () => PWA.instalarPWA();
window.cerrarBannerPWA = () => PWA.cerrarBannerPWA();
window.changeDailyTip = () => UI.changeDailyTip();
window.changeConsejo = () => UI.changeConsejo();
window.cerrarPremiumModal = () => {
  document.getElementById('premiumOverlay')?.classList.remove('active');
  document.getElementById('premiumModal')?.classList.remove('active');
};
window.contactarAdmin = () => {
  window.open('https://www.instagram.com/navegacionpro', '_blank');
};
window.cerrarInfoBanner = () => {
  const noMostrar = document.getElementById('infoBannerDontShow')?.checked;
  if (noMostrar) {
    localStorage.setItem('ri5_info_visto', 'true');
  }
  document.getElementById('infoBanner').style.display = 'none';
  document.getElementById('infoBannerOverlay').style.display = 'none';
};
window.cerrarWelcomeModal = () => {
  document.getElementById('welcomeOverlay')?.classList.remove('active');
  document.getElementById('welcomeModal')?.classList.remove('active');
};

window.abrirResetModal = () => ResetPassword.abrirModal();
window.cerrarResetModal = () => ResetPassword.cerrarModal();
window.enviarEmailRecuperacion = () => ResetPassword.enviarEmailRecuperacion();

if (typeof PlanGenerator !== 'undefined') {
  window.cambiarTrimestre = async (delta) => { await PlanGenerator.cambiarTrimestre(delta); };
} else {
  window.cambiarTrimestre = async (delta) => {
    console.warn('PlanGenerator no disponible aún');
    Utils.showToast('Cargando planificador...', 'info');
  };
}