import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

declare const __FIREBASE_API_KEY__: string;

// Firebase web config identifies this public web app; Firestore Security Rules
// protect the data. Keep the project identifiers here so preview and static
// builds do not depend on runtime-only environment injection.
const firebaseConfig = {
  apiKey: __FIREBASE_API_KEY__,
  authDomain: "balaji-wood-kraft.firebaseapp.com",
  projectId: "balaji-wood-kraft",
  storageBucket: "balaji-wood-kraft.firebasestorage.app",
  messagingSenderId: "1094512532369",
  appId: "1:1094512532369:web:216aebc027eb068bcf1830",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig as FirebaseOptions);
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export const googleProvider = new GoogleAuthProvider();
