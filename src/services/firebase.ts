import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  // Metro resolves the React Native auth bundle at runtime; types target the web entry.
  // @ts-expect-error getReactNativePersistence is exported from the RN bundle only.
  getReactNativePersistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
} from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAvOUUjXf9bkxBH7dANqxXhXtQkrv-skgw',
  authDomain: 'bookapp-16d9b.firebaseapp.com',
  projectId: 'bookapp-16d9b',
  storageBucket: 'bookapp-16d9b.firebasestorage.app',
  messagingSenderId: '957934938656',
  appId: '1:957934938656:web:424b9fbd4a204647a7aa45',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createAuth() {
  if (Platform.OS === 'web') {
    try {
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } catch {
      return getAuth(app);
    }
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

const auth = createAuth();

function createFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: Platform.OS === 'web' ? persistentLocalCache() : memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
  }
}

const firestore = createFirestore();

export { app, auth, firestore };
