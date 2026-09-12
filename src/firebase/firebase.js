import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
  
const app = initializeApp(firebaseConfig);

// TEMPORARY DIAGNOSTIC — remove once the auth/unauthorized-domain
// issue is confirmed fixed. Logs only projectId/authDomain (never
// apiKey or any other secret), read from the actual firebaseConfig
// object above — this reflects exactly what Vite loaded into this
// running process, not what's supposed to be in .env. Runs
// automatically on app load since this file is imported at startup —
// no console command needed.
console.log('[Firebase Config Check]', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider(); 

export default app;
