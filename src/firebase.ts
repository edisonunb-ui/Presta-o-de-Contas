import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-6643186205-60db5",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:430896619588:web:06d5ffe54ac77211809c11",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDXpe3M-fzBqgFS3JbNcxg4baR40yXJreU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-6643186205-60db5.firebaseapp.com",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-6643186205-60db5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "430896619588"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId from the configuration
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-portaldeprestaod-4aac8b58-6a44-4173-85a1-a7b0d01e859e");

