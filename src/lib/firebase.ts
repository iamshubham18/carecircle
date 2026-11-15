import * as admin from 'firebase-admin';

// Ensure this module is only run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Firebase Admin SDK can only be used on the server side.');
}

/**
 * Singleton getter for Firebase Admin App
 */
export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in environment variables.'
    );
  }

  // Handle escaped newlines in private key string
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

/**
 * Lazy singleton getter for Firestore database
 */
export function getAdminDb(): admin.firestore.Firestore {
  return admin.firestore(getFirebaseAdminApp());
}

/**
 * Proxy object providing direct access to adminDb without failing at import time
 */
export const adminDb: admin.firestore.Firestore = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const db = getAdminDb();
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(db);
    }
    return value;
  },
});
