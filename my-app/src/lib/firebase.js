// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBu9mIOzC1TTZrzZLq1_Pij3nQq-fdmos",
  authDomain: "yourtube-local.firebaseapp.com",
  projectId: "yourtube-local",
  storageBucket: "yourtube-local.firebasestorage.app",
  messagingSenderId: "751251688372",
  appId: "1:751251688372:web:853322ad2a8ef1166400e1",
  measurementId: "G-ZL2G34T1R3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export { auth, provider };
