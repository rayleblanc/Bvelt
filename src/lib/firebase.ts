import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  browserPopupRedirectResolver,
  onAuthStateChanged, 
  User, 
  getAdditionalUserInfo 
} from "firebase/auth";
import { initializeFirestore, doc, getDocFromCache, persistentLocalCache, persistentMultipleTabManager, getFirestore, memoryLocalCache } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase with platform config
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Force use of default database (default) with persistent local cache.
// If persistent cache is blocked (e.g. within an iframe with restricted storage),
// fall back to memory-only local cache or standard getFirestore.
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (error) {
  console.warn("Failed to initialize Firestore with persistent local cache (may be blocked inside an iframe). Falling back to memory cache:", error);
  try {
    dbInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch (fallbackError) {
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;

export type { User };

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

export const initFirebase = async () => {
  return { app, auth, db };
};

export const getFirebaseAuth = () => auth;
export const getFirebaseDB = () => db;

/**
 * Detects whether the current client is a mobile device or running in standalone PWA display mode.
 * On mobile/PWA, signInWithRedirect is vastly superior and prevents popup-opener disconnection errors.
 */
export const isMobileOrStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true || 
                       document.referrer.includes('android-app://');
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth <= 768;
  return isStandalone || isMobileUserAgent || isSmallScreen;
};

/**
 * Standard ActionCodeSettings configured strictly with canonical production URL https://bvelt.app
 */
export const getActionCodeSettings = (continuePath: string = '/') => {
  const origin = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : 'https://bvelt.app';
  
  return {
    url: `${origin}${continuePath.startsWith('/') ? continuePath : `/${continuePath}`}`,
    handleCodeInApp: true,
  };
};

/**
 * Resolves any pending redirect sign-in results from Firebase Auth.
 * Must be executed on application mount so redirect flows cleanly return to bvelt.app.
 */
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    sessionStorage.removeItem('lf_auth_redirect_pending');
    if (result && result.user) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
      const additionalInfo = getAdditionalUserInfo(result);
      if (additionalInfo?.isNewUser) {
        (window as any).isFirebaseNewUser = true;
      }
      console.log("[Firebase Auth] Successfully resolved redirect auth for user:", result.user.uid);
      return result.user;
    }
    return null;
  } catch (error: any) {
    sessionStorage.removeItem('lf_auth_redirect_pending');
    console.warn("[Firebase Auth] Non-fatal redirect check notice:", error?.code || error?.message || error);
    return null;
  }
};

// Firebase Cloud Messaging (FCM) Push Notifications Helpers
export const requestFcmToken = async (): Promise<string | null> => {
  try {
    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.log("Firebase Messaging is not supported in this environment");
      return null;
    }
    const messaging = getMessaging(app);
    
    // 1. Solicita permiso con Notification.requestPermission() solo si no fue denegado previamente
    if ('Notification' in window) {
      if (Notification.permission === 'denied') {
        console.log("Notification permission was previously denied by user");
        return null;
      }
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log("Notification permission was denied by user");
          return null;
        }
      }
    }
    
    // Retrieve active custom /sw.js registration to link FCM token
    let registration;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.getRegistration('/sw.js');
    }

    // 2. Si se otorga el permiso, genera el token FCM con la VAPID key requerida
    const token = await getToken(messaging, {
      vapidKey: 'BOwx9XA0wnpqIiSY5ryHjQXigvRr6AVxGFi3q4GX9tn37ktZlebwXKVKJAaW9laKmhQUdajzJ6u6EEbQLhNiYck',
      serviceWorkerRegistration: registration
    });
    console.log("FCM Registration Token acquired:", token ? token.substring(0, 15) + "..." : "none");
    return token;
  } catch (err) {
    console.warn("FCM token retrieval skipped or not supported:", err);
    return null;
  }
};

export const listenToFcmMessages = async (callback: (payload: any) => void) => {
  try {
    const messagingSupported = await isSupported();
    if (!messagingSupported) return;
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log("FCM Notification Received in foreground:", payload);
      callback(payload);
    });
  } catch (err) {
    console.warn("FCM message listener error:", err);
  }
};

/**
 * Environment-aware Google Authentication:
 * - Mobile devices & standalone PWA: Uses signInWithRedirect to guarantee clean auth without popup postMessage failures.
 * - Desktop browsers: Uses signInWithPopup with automatic redirect fallback if popups are blocked.
 */
export const loginWithGoogle = async (requestScopes: string[] = []): Promise<User | null> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  // Add Workspace scopes if requested
  if (requestScopes.length > 0) {
    requestScopes.forEach(scope => provider.addScope(scope));
  }

  // 1. Mobile or Standalone PWA environment: prefer redirect flow
  if (isMobileOrStandalone()) {
    try {
      isSigningIn = true;
      sessionStorage.setItem('lf_auth_redirect_pending', 'true');
      console.log("[Firebase Auth] Initiating signInWithRedirect for mobile/PWA environment...");
      await signInWithRedirect(auth, provider);
      return null;
    } catch (error: any) {
      isSigningIn = false;
      sessionStorage.removeItem('lf_auth_redirect_pending');
      console.error("[Firebase Auth] Error in mobile signInWithRedirect:", error);
      throw error;
    }
  }

  // 2. Desktop standard browser environment: prefer popup flow
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    
    // Check if user is signing up for the first time
    const additionalInfo = getAdditionalUserInfo(result);
    if (additionalInfo?.isNewUser) {
      (window as any).isFirebaseNewUser = true;
    }

    return result.user;
  } catch (error: any) {
    console.error("[Firebase Auth] Error in desktop signInWithPopup:", error);
    // If popup was blocked on desktop, fallback to redirect
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
      try {
        console.log("[Firebase Auth] Popup blocked on desktop, falling back to signInWithRedirect...");
        sessionStorage.setItem('lf_auth_redirect_pending', 'true');
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        throw error;
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Maps Firebase Auth error codes to user-friendly messages in Spanish/English.
 * Strictly prevents leaking sensitive credentials or raw tracebacks to users.
 */
export const getHumanAuthErrorMessage = (error: any, lang: 'es' | 'en' = 'es'): string => {
  const code = error?.code || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  switch (code) {
    case 'auth/unauthorized-domain':
      return lang === 'es'
        ? `Dominio (${hostname}) no autorizado en Firebase Authentication. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.`
        : `Domain (${hostname}) is not authorized in Firebase Authentication settings. Add it in Firebase Console.`;
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return lang === 'es'
        ? 'El código de verificación o enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.'
        : 'The verification code or action link has expired or already been used. Please request a new one.';
    case 'auth/popup-blocked':
      return lang === 'es'
        ? 'El navegador bloqueó la ventana emergente de inicio de sesión. Por favor, permite ventanas emergentes o continúa con la redirección.'
        : 'Sign-in popup was blocked by your browser. Please allow popups or proceed with redirect.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return lang === 'es'
        ? 'Inicio de sesión cancelado antes de completarse.'
        : 'Sign-in was cancelled before completion.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return lang === 'es'
        ? 'Credenciales inválidas o cuenta no encontrada. Por favor, intenta de nuevo.'
        : 'Invalid credentials or account not found. Please try again.';
    case 'auth/network-request-failed':
      return lang === 'es'
        ? 'Error de conexión de red al autenticar con Google. Revisa tu internet e inténtalo de nuevo.'
        : 'Network connection issue while authenticating. Please check your internet and try again.';
    case 'auth/user-disabled':
      return lang === 'es'
        ? 'Esta cuenta ha sido inhabilitada. Contacta a soporte si crees que es un error.'
        : 'This account has been disabled. Contact support if you need assistance.';
    case 'auth/account-exists-with-different-credential':
      return lang === 'es'
        ? 'Ya existe una cuenta asociada a este correo con otro método de acceso.'
        : 'An account already exists with this email using a different sign-in method.';
    default:
      return lang === 'es'
        ? 'Error al autenticar. Por favor, inténtalo de nuevo o recarga la página.'
        : 'Authentication error. Please try again or refresh the page.';
  }
};

export { onAuthStateChanged, getRedirectResult, signInWithRedirect, browserPopupRedirectResolver };



