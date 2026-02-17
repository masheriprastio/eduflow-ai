import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Helper aman untuk membaca Environment Variables
const getEnv = (key: string, fallbackKey?: string): string => {
  let value = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
         // @ts-ignore
        value = import.meta.env[key] || (fallbackKey ? import.meta.env[fallbackKey] : '');
    }
  } catch (e) {}
  if (!value) {
    try {
        if (typeof process !== 'undefined' && process.env) {
            value = process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
        }
    } catch (e) {}
  }
  return value;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID', 'REACT_APP_FIREBASE_APP_ID')
};

// Initialize Firebase (Only if config exists, preventing immediate crash)
// Note: This assumes config is correct. If empty, firebase might warn but usually doesn't crash app execution immediately unless used.
const app = initializeApp(firebaseConfig);

// Initialize Firestore (Database)
export const db = getFirestore(app);