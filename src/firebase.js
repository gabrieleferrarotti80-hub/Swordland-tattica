import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

// SOSTITUISCI QUESTO BLOCCO CON I TUOI DATI DA FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBsO3jWhz4Qh75Xk2YTMkb9GfwAnzBDWwg",
  authDomain: "swordlandapp.firebaseapp.com",
  projectId: "swordlandapp",
  storageBucket: "swordlandapp.firebasestorage.app",
  messagingSenderId: "941364052126",
  appId: "1:941364052126:web:c9ef9fff0208d625e8fb8f"
};

// Inizializza Firebase e Firestore
const app = initializeApp(firebaseConfig);

// FIX DEFINITIVO: Forza il Long Polling per bypassare il blocco dei WebSocket (Antivirus/VPN)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});