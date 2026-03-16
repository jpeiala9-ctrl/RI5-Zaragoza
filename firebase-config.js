// ==================== firebase-config.js ====================
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
const { Timestamp, FieldValue } = firebase.firestore;

// Configuración opcional
db.settings({
  ignoreUndefinedProperties: true,
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Persistencia offline (opcional, puede fallar en algunos navegadores)
db.enablePersistence()
  .then(() => console.log('✅ Persistencia offline habilitada'))
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('⚠️ Persistencia offline limitada: múltiples pestañas abiertas');
    } else if (err.code == 'unimplemented') {
      console.warn('⚠️ El navegador no soporta persistencia offline');
    }
  });

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('✅ Persistencia de autenticación configurada'))
  .catch(console.error);

// Exportar servicios
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

console.log('📁 Proyecto:', firebaseConfig.projectId);