import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase,ref, push, orderByChild, query, get } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

  const firebaseConfig = {
    apiKey: "AIzaSyCcyR-VW3hFroVrG0164QwVO8WYSliGZQA",
    authDomain: "testrun-b565e.firebaseapp.com",
    projectId: "testrun-b565e",
    storageBucket: "testrun-b565e.firebasestorage.app",
    messagingSenderId: "786542410028",
    appId: "1:786542410028:web:7898349ee8c158e96e9489",
    databaseURL: "https://testrun-b565e-default-rtdb.asia-southeast1.firebasedatabase.app",
  };
  
const app = initializeApp(firebaseConfig);

export { app, getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, getDatabase, ref, push, orderByChild, query, get };
export default app;
export { firebaseConfig };