// ==================== firebase-config.js - CONFIGURACIÓN MEJORADA ====================

const firebaseConfig = {
  apiKey: "AIzaSyCY0nBRMcgPMMoCuXobwVn7GxIR_HKTo9s",
  authDomain: "ri5-zaragoza.firebaseapp.com",
  projectId: "ri5-zaragoza",
  storageBucket: "ri5-zaragoza.firebasestorage.app",
  messagingSenderId: "660832033861",
  appId: "1:660832033861:web:a1ee877a7637c6fda8d72c",
  measurementId: "G-05Z49ZKNDK"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase inicializado correctamente');
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const { Timestamp, FieldValue } = firebase.firestore;

db.settings({
  ignoreUndefinedProperties: true,
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

db.enablePersistence({
  synchronizeTabs: true
})
  .then(() => {
    console.log('✅ Persistencia offline habilitada (multi-tab)');
  })
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('⚠️ Persistencia offline limitada: múltiples pestañas abiertas');
    } else if (err.code == 'unimplemented') {
      console.warn('⚠️ El navegador no soporta persistencia offline');
    }
  });

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('✅ Persistencia de autenticación configurada (LOCAL)');
  })
  .catch((error) => {
    console.error('❌ Error configurando persistencia de auth:', error);
  });

auth.languageCode = 'es';
console.log('🌐 Idioma configurado: español');

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('📶 Conexión restaurada - Modo online');
    if (window.Utils) Utils.showToast('📶 Conexión restaurada', 'success');
  });
  
  window.addEventListener('offline', () => {
    console.log('📶 Sin conexión - Modo offline');
    if (window.Utils) Utils.showToast('📶 Sin conexión - Modo offline', 'warning');
  });
}

window.firebaseServices = {
  auth,
  db,
  storage,
  Timestamp,
  FieldValue,
  utils: {
    isOnline: () => navigator.onLine,
    now: () => Timestamp.now(),
    createId: () => db.collection('_').doc().id
  }
};

console.log('📁 Proyecto:', firebaseConfig.projectId);
console.log('🚀 RI5 - Listo para usar');