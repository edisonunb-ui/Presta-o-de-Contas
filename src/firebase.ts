import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "studio-6643186205-60db5",
  appId: "1:430896619588:web:06d5ffe54ac77211809c11",
  apiKey: "AIzaSyDXpe3M-fzBqgFS3JbNcxg4baR40yXJreU",
  authDomain: "studio-6643186205-60db5.firebaseapp.com",
  storageBucket: "studio-6643186205-60db5.firebasestorage.app",
  messagingSenderId: "430896619588"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId from the configuration
export const db = getFirestore(app, "ai-studio-4aac8b58-6a44-4173-85a1-a7b0d01e859e");

