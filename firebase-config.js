// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

// TODO: Replace this with your actual Firebase configuration
// You can get this from your Firebase Console -> Project Settings -> General
const firebaseConfig = {
  apiKey: "AIzaSyA5qOnOcF6Xv7i0g4xRzSFPDMy0UISAoh0",
  authDomain: "veeresh-ddf94.firebaseapp.com",
  projectId: "veeresh-ddf94",
  storageBucket: "veeresh-ddf94.firebasestorage.app",
  messagingSenderId: "509659125264",
  appId: "1:509659125264:web:6486f3c5041dae90291c95",
};

// Start Firebase App
let app, db, auth, storage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  console.log("Firebase initialized successfully");
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

export { app, db, auth, storage };
