import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let authPromise: Promise<void> | undefined;

export function hasFirebaseConfig() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    getDatabaseUrl()
  );
}

export function getFirebaseDatabase() {
  if (!hasFirebaseConfig()) {
    return undefined;
  }

  try {
    app ??= initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: getDatabaseUrl(),
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    });
    database ??= getDatabase(app);
    return database;
  } catch {
    return undefined;
  }
}

export async function prepareFirebaseConnection() {
  const database = getFirebaseDatabase();
  if (!database) {
    return undefined;
  }

  auth ??= getAuth(app);
  authPromise ??= signInAnonymously(auth).then(() => undefined).catch(() => undefined);
  await authPromise;
  return database;
}

function getDatabaseUrl() {
  const rawUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL;
  if (!rawUrl) {
    return "";
  }

  const sanitized = rawUrl.trim().replace(/["',;]+$/g, "").replace(/^["']+/g, "");
  const url = sanitized.startsWith("https://") ? sanitized : `https://${sanitized}`;

  try {
    const parsed = new URL(url);
    return /(?:^|\.)firebaseio\.com$|(?:^|\.)firebasedatabase\.app$/i.test(parsed.hostname)
      ? parsed.origin
      : "";
  } catch {
    return "";
  }
}
