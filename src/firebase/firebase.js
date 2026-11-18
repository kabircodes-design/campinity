import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

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

// CAPACITOR ANDROID NOTE — auth/requests-from-referer-https://localhost-are-blocked
// Capacitor's Android WebView serves this app from the origin
// https://localhost by default (see capacitor.config.json — no
// `server.hostname` override, so Capacitor's own default applies).
// Every Firebase Auth SDK call (including plain email/password
// sign-in, not just Google) goes out as a REST request to
// identitytoolkit.googleapis.com carrying that Referer header. If this
// error appears, it is NOT Firebase Console's Authentication →
// Settings → Authorized domains list (that only gates OAuth
// popup/redirect flows and already includes "localhost" by default) —
// it is the Web API key's own HTTP referrer restriction in Google
// Cloud Console: APIs & Services → Credentials → the key matching
// VITE_FIREBASE_API_KEY → Application restrictions → HTTP referrers.
// Add "https://localhost/*" there to allow this app's Android build.
// This is a Console-only fix; no code change unblocks it.

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

// LOCAL TEST ENVIRONMENT ONLY — Firebase Emulator Suite (tests/e2e/).
// Active only in a dev build (never in `vite build` output) AND only when
// VITE_USE_FIREBASE_EMULATORS=true, so production can never point here.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9199`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8189);
  connectStorageEmulator(storage, host, 9299);
  connectFunctionsEmulator(getFunctions(app), host, 5101);
  console.warn('[Campinity] Using LOCAL Firebase emulators (test environment).');
}

export default app;
