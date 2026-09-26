import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

import { deleteAllCloudBooks } from '@/src/services/cloudBookStorage';
import { auth } from '@/src/services/firebase';

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertValidEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new AuthServiceError('Please enter your email address.');
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AuthServiceError('Please enter a valid email address.');
  }
  return normalized;
}

function assertValidPassword(password: string, context: 'sign-in' | 'sign-up') {
  if (!password) {
    throw new AuthServiceError('Please enter your password.');
  }
  if (context === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthServiceError('Password should be at least 6 characters.');
  }
  return password;
}

function extractFirebaseAuthCode(error: unknown): string | null {
  if (error instanceof FirebaseError && error.code.startsWith('auth/')) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.startsWith('auth/')) {
      return code;
    }
  }

  return null;
}

function mapFirebaseAuthCode(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
      return 'Wrong password. Please try again.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Wrong email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'For security, sign out and sign in again before deleting your account.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not enabled for this app yet.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    default:
      return GENERIC_AUTH_ERROR;
  }
}

function looksLikeFirebaseCode(message: string) {
  return /^auth\/[\w-]+$/.test(message.trim());
}

export function mapAuthError(error: unknown): string {
  if (error instanceof AuthServiceError) {
    return error.message;
  }

  const code = extractFirebaseAuthCode(error);
  if (code) {
    return mapFirebaseAuthCode(code);
  }

  if (error instanceof Error && looksLikeFirebaseCode(error.message)) {
    return GENERIC_AUTH_ERROR;
  }

  return GENERIC_AUTH_ERROR;
}

async function runAuthAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function signUp(email: string, password: string): Promise<User> {
  const normalizedEmail = assertValidEmail(email);
  const validPassword = assertValidPassword(password, 'sign-up');

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, validPassword);
    await sendEmailVerification(credential.user);
    return credential.user;
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const normalizedEmail = assertValidEmail(email);
  const validPassword = assertValidPassword(password, 'sign-in');

  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, validPassword);
    return credential.user;
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function signOutUser(): Promise<void> {
  await runAuthAction(() => signOut(auth));
}

export async function resetPassword(email: string): Promise<void> {
  const normalizedEmail = assertValidEmail(email);

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function resendEmailVerification(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthServiceError('You are not signed in.');
  }

  try {
    await sendEmailVerification(user);
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

export async function refreshAuthUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    await reload(user);
    return auth.currentUser;
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

async function deleteUserRemoteData(user: User): Promise<void> {
  await deleteAllCloudBooks(user.uid);
}

export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthServiceError('You are not signed in.');
  }

  try {
    await deleteUserRemoteData(user);
    await deleteUser(user);
  } catch (error) {
    throw new AuthServiceError(mapAuthError(error));
  }
}

type AuthState = {
  user: User | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUser(null);
      return;
    }

    try {
      await reload(currentUser);
      setUser(auth.currentUser);
    } catch {
      // Keep the last known user if refresh fails (e.g. offline).
    }
  }, []);

  return {
    user: user ?? null,
    isLoading: user === undefined,
    refreshUser,
  };
}
