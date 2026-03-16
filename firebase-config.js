const firebaseConfig = {
  apiKey: "AIzaSyCY0nBRMcgPMMoCuXobwVn7GxIR_HKTo9s",
  authDomain: "ri5-zaragoza.firebaseapp.com",
  projectId: "ri5-zaragoza",
  storageBucket: "ri5-zaragoza.firebasestorage.app",
  messagingSenderId: "660832033861",
  appId: "1:660832033861:web:a1ee877a7637c6fda8d72c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const { Timestamp, FieldValue } = firebase.firestore;

window.firebaseServices = {
  auth,
  db,
  Timestamp,
  FieldValue
};

console.log('✅ Firebase listo');