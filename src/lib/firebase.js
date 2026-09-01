import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, setUserProperties } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration.
// NOTE: Web API keys are PUBLIC by design — security is enforced via Firebase
// rules. Values can be overridden in production via Vite env vars (VITE_*).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBFBzzhp5rkUq3JEKVnBil4j_WheFdBuSI",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "codestap-9a0b2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "codestap-9a0b2",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "codestap-9a0b2.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_SENDER_ID || "242145893439",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:242145893439:web:4e1879e51999b8df3e6c8a",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-G56E8XZWVX",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let analyticsInstance = null;
let analyticsReady = false;

if (typeof window !== "undefined") {
  isSupported()
    .then((ok) => {
      if (ok) {
        analyticsInstance = getAnalytics(firebaseApp);
        analyticsReady = true;
        // Tag the visitor's session
        try {
          setUserProperties(analyticsInstance, {
            app_version: "1.0.0",
            app_name: "ai-smart-seo-web",
          });
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {
      // Analytics blocked (e.g., adblocker) — silently degrade.
    });
}

/**
 * Track a custom analytics event.
 * Safe to call before analytics is ready (will no-op).
 */
export function track(eventName, params = {}) {
  if (!analyticsReady || !analyticsInstance) return;
  try {
    logEvent(analyticsInstance, eventName, params);
  } catch {
    // never let analytics break the UI
  }
}

export function getAnalyticsInstance() {
  return analyticsInstance;
}
