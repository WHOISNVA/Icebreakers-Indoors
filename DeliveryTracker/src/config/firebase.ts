// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBQ_3Jaa4DBTS8zOS8ywjl0qblxriFXUHc',
  authDomain: 'icebreakers-indoors.firebaseapp.com',
  databaseURL: 'https://icebreakers-indoors-default-rtdb.firebaseio.com',
  projectId: 'icebreakers-indoors',
  storageBucket: 'icebreakers-indoors.firebasestorage.app',
  messagingSenderId: '276619753863',
  appId: '1:276619753863:web:46d4768b1fbe4f70213b22',
};

// Ensure we only initialize once (hot reload safe)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export Realtime Database instance
export const database = getDatabase(app);

export default app;






