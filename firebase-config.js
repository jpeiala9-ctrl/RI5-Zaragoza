// ==================== firebase-config.js ====================
const firebaseConfig = {
  apiKey: "AIzaSyCY0nBRMcgPMMoCuXobwVn7GxIR_HKTo9s",
  authDomain: "ri5-zaragoza.firebaseapp.com",
  projectId: "ri5-zaragoza",
  storageBucket: "ri5-zaragoza.firebasestorage.app",
  messagingSenderId: "660832033861",
  appId: "1:660832033861:web:a1ee877a7637c6fda8d72c"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado correctamente');
  } else {
    console.log('✅ Firebase ya estaba inicializado');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();
const { Timestamp, FieldValue } = firebase.firestore;

// Configuración adicional de Firestore (opcional)
db.settings({
  ignoreUndefinedProperties: true,
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// NOTA: La persistencia offline se habilita después del login para evitar errores
// (ver auth.js: _enablePersistence)

// Configurar persistencia de autenticación (para mantener sesión)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('✅ Persistencia de autenticación configurada (LOCAL)'))
  .catch((error) => console.error('❌ Error configurando persistencia de auth:', error));

window.firebaseServices = {
  auth,
  db,
  Timestamp,
  FieldValue,
  utils: {
    isOnline: () => navigator.onLine,
    now: () => Timestamp.now(),
    createId: () => db.collection('_').doc().id
  }
};

console.log('✅ firebaseServices listo');