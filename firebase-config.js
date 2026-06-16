import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDskMiIM-XQX1oGAxpJT4Se9w-dTBZ1AZs",
    authDomain: "gis-scout-tracker.firebaseapp.com",
    projectId: "gis-scout-tracker",
    storageBucket: "gis-scout-tracker.firebasestorage.app",
    messagingSenderId: "592952880381",
    appId: "1:592952880381:web:be5989bc062b7b26cb6294"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
