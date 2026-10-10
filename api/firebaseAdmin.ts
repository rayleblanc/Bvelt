/**
 * Firebase Admin SDK Singleton & Resilient Initializer
 *
 * PRODUCTION REQUIREMENTS (OWNER_OPS):
 * To enable full server-side Firestore persistence and bypass in-memory degraded mode,
 * the host environment must provide valid Google Cloud / Firebase service account credentials
 * for the SAME project as the client app: "localflowpro-20e3d".
 *
 * Accepted Environment Variables:
 * - FIREBASE_SERVICE_ACCOUNT: Stringified JSON of the service account key
 * - FIREBASE_ADMIN_CREDENTIALS: Stringified JSON of the service account key
 * - FIREBASE_SERVICE_ACCOUNT_KEY: Stringified JSON of the service account key
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to a service account JSON file on disk
 * - Ambient GCP runtime (Cloud Run / GAE): Uses metadata server via applicationDefault()
 *
 * If credentials are missing or invalid (UNAUTHENTICATED code 16), the system automatically
 * switches to in-memory degraded mode, logs ONE warning, and continues without log spam.
 */

// Dynamic imports for firebase-admin to allow running in environments (like Vite dev server) where firebase-admin is not installed
export type App = any;
export type Firestore = any;
export type Auth = any;

let fbAppModule: any = null;
let fbFirestoreModule: any = null;
let fbAuthModule: any = null;
let fbModulesLoaded = false;

function loadFirebaseAdminModules(): boolean {
  if (fbModulesLoaded) return Boolean(fbAppModule);
  fbModulesLoaded = true;
  try {
    // Dynamic import to prevent bundler static resolution failure
    const req = typeof require !== "undefined" ? require : null;
    if (req) {
      fbAppModule = req("firebase-admin/app");
      fbFirestoreModule = req("firebase-admin/firestore");
      fbAuthModule = req("firebase-admin/auth");
      return true;
    }
  } catch {
    // firebase-admin is not installed or unavailable in this runtime
    fbAppModule = null;
    fbFirestoreModule = null;
    fbAuthModule = null;
  }
  return false;
}

const FieldValue = {
  serverTimestamp: () => new Date().toISOString(),
  increment: (n: number) => n,
  arrayUnion: (...elements: any[]) => elements,
  arrayRemove: (...elements: any[]) => elements,
  delete: () => undefined,
};

import fs from "fs";
import path from "path";

export const CANONICAL_FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "localflowpro-20e3d";

let adminAppInstance: any = null;
let dbInstance: any = null;
let authInstance: any = null;
let adminReady = false;
let hasLoggedDegradedWarning = false;
let adminInitAttempted = false;

function parseServiceAccount(): any | null {
  // 1. Try loading from environment variables
  const envCreds = process.env.FIREBASE_SERVICE_ACCOUNT || 
                   process.env.FIREBASE_ADMIN_CREDENTIALS || 
                   process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
                   process.env.FIREBASE_ACCOUNT;
  if (envCreds) {
    try {
      const parsed = JSON.parse(envCreds);
      if (parsed && (parsed.project_id || parsed.client_email)) {
        return parsed;
      }
    } catch (e) {
      console.error("[Firebase Admin] Error parsing Firebase service account environment variable:", e);
    }
  }

  // 2. Try loading from GOOGLE_APPLICATION_CREDENTIALS path if it points to a JSON file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credPath)) {
        const raw = fs.readFileSync(credPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.project_id || parsed.client_email)) {
          return parsed;
        }
      }
    } catch (e) {
      // not a readable JSON file
    }
  }

  // 3. Try loading from service-account.json in root or current working dir
  try {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.project_id || parsed.client_email)) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export function isFirebaseAdminReady(): boolean {
  if (!adminInitAttempted) {
    getAdminFirestore();
  }
  return adminReady;
}

export function markAdminUnauthenticated(error?: any): void {
  adminReady = false;
  dbInstance = null;
  authInstance = null;
  if (!hasLoggedDegradedWarning) {
    hasLoggedDegradedWarning = true;
    const detail = error?.message || error?.details || '';
    console.warn(`[Firebase Admin] ⚠️ Firestore Admin client received UNAUTHENTICATED (code 16). Credentials missing or invalid for project ${CANONICAL_FIREBASE_PROJECT_ID}. Running in memory-fallback degraded mode. ${detail ? `(${detail})` : ''}`);
  }
}

export function getAdminFirestore(): Firestore | null {
  if (adminInitAttempted) {
    return adminReady ? dbInstance : null;
  }
  adminInitAttempted = true;

  if (!loadFirebaseAdminModules()) {
    adminReady = false;
    if (!hasLoggedDegradedWarning) {
      hasLoggedDegradedWarning = true;
      console.warn(`[Firebase Admin] ⚠️ firebase-admin package is not installed or available. Running in degraded mode: plan limits and counters will use in-memory store.`);
    }
    return null;
  }

  const existingApps = fbAppModule.getApps();
  if (existingApps.length > 0) {
    adminAppInstance = existingApps[0];
  }

  const serviceAccount = parseServiceAccount();
  const targetProjectId = serviceAccount?.project_id || CANONICAL_FIREBASE_PROJECT_ID;

  if (serviceAccount && serviceAccount.private_key && serviceAccount.client_email) {
    try {
      console.log(`[Firebase Admin] Initializing with service account. Project ID: ${targetProjectId}`);
      if (!adminAppInstance) {
        adminAppInstance = fbAppModule.initializeApp({
          credential: fbAppModule.cert(serviceAccount),
          projectId: targetProjectId,
        });
      }
      dbInstance = fbFirestoreModule.getFirestore(adminAppInstance);
      adminReady = true;
      return dbInstance;
    } catch (err: any) {
      console.error("[Firebase Admin] initializeApp with cert failed:", err?.message || err);
      adminReady = false;
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.GAE_SERVICE) {
    try {
      console.log(`[Firebase Admin] Initializing with applicationDefault. Project ID: ${CANONICAL_FIREBASE_PROJECT_ID}`);
      if (!adminAppInstance) {
        adminAppInstance = fbAppModule.initializeApp({
          credential: fbAppModule.applicationDefault(),
          projectId: CANONICAL_FIREBASE_PROJECT_ID,
        });
      }
      dbInstance = fbFirestoreModule.getFirestore(adminAppInstance);
      adminReady = true;
      return dbInstance;
    } catch (err: any) {
      console.warn("[Firebase Admin] applicationDefault failed:", err?.message || err);
      adminReady = false;
    }
  } else {
    // Missing credentials - explicitly degraded
    adminReady = false;
  }

  if (!adminReady && !hasLoggedDegradedWarning) {
    hasLoggedDegradedWarning = true;
    console.warn(`[Firebase Admin] ⚠️ Missing or unauthenticated Firebase Admin service account credentials. Running in degraded mode: plan limits and counters will use in-memory store (DEV-ONLY). Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT / FIREBASE_ADMIN_CREDENTIALS matching project ${CANONICAL_FIREBASE_PROJECT_ID}.`);
  }

  return null;
}

export function getFirebaseAdminDB(): Firestore | null {
  return getAdminFirestore();
}

export function getFirebaseAdminApp(): App | null {
  if (!adminInitAttempted) {
    getAdminFirestore();
  }
  return adminAppInstance;
}

export function getFirebaseAdminAuth(): Auth | null {
  if (!adminInitAttempted) {
    getAdminFirestore();
  }
  if (!loadFirebaseAdminModules()) {
    return null;
  }
  if (!adminAppInstance) {
    const existingApps = fbAppModule.getApps();
    if (existingApps.length > 0) {
      adminAppInstance = existingApps[0];
    } else {
      try {
        adminAppInstance = fbAppModule.initializeApp({
          projectId: CANONICAL_FIREBASE_PROJECT_ID
        });
      } catch (e) {
        const apps = fbAppModule.getApps();
        if (apps.length > 0) {
          adminAppInstance = apps[0];
        }
      }
    }
  }
  if (!adminAppInstance) {
    return null;
  }
  if (!authInstance) {
    try {
      authInstance = fbAuthModule.getAuth(adminAppInstance);
    } catch {
      authInstance = null;
    }
  }
  return authInstance;
}

export function resetFirebaseAdminDB(): void {
  dbInstance = null;
  authInstance = null;
  adminInitAttempted = false;
  adminReady = false;
}

export function hasFirebaseAdminCredentials(): boolean {
  return isFirebaseAdminReady();
}

export { FieldValue };
