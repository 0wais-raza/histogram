import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyBoepVIGYjPAhzXDk3rI4nzyfHQ4TFD0yw",
  authDomain: "histogram-insta.firebaseapp.com",
  projectId: "histogram-insta",
  storageBucket: "histogram-insta.firebasestorage.app",
  messagingSenderId: "1029067436052",
  appId: "1:1029067436052:web:e23e990ec3b13bbfcfb701",
  measurementId: "G-QHVMJSQ7MM"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);