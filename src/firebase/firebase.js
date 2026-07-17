import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {getFirestore} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBpaaoVFk_YhwCBnmigRF6yxoU6Zfmw4PU",
    authDomain: "campinity-app.firebaseapp.com",
    projectId: "campinity-app",
    storageBucket: "campinity-app.firebasestorage.app",
    messagingSenderId: "803486094288",
    appId: "1:803486094288:web:202d12b1edf3b9aaa65fd5",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;