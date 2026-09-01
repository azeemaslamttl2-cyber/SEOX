import { auth } from "./firebase.js";

const GSC_ACCESS_TOKEN_KEY = "seox_gsc_access_token";
const GSC_TOKEN_EXPIRY_KEY = "seox_gsc_token_expiry";
const GSC_EMAIL_KEY = "seox_gsc_email";
const GSC_EXPIRY_SKEW_MS = 2 * 60 * 1000;

function parseExpiry(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function readStoredGscSession({ minValidityMs = GSC_EXPIRY_SKEW_MS } = {}) {
  try {
    const accessToken = localStorage.getItem(GSC_ACCESS_TOKEN_KEY);
    const rawExpiry = localStorage.getItem(GSC_TOKEN_EXPIRY_KEY);
    const googleEmail = localStorage.getItem(GSC_EMAIL_KEY);
    const expiresAt = parseExpiry(rawExpiry);

    if (!accessToken || !expiresAt) return null;
    if (expiresAt <= Date.now() + minValidityMs) return null;

    return {
      connected: true,
      accessToken,
      expiresAt,
      googleEmail: googleEmail || null,
    };
  } catch {
    return null;
  }
}

export function writeStoredGscSession({ accessToken, expiresAt, googleEmail }) {
  if (!accessToken || !expiresAt) return;

  localStorage.setItem(GSC_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(GSC_TOKEN_EXPIRY_KEY, new Date(expiresAt).toISOString());

  if (googleEmail) localStorage.setItem(GSC_EMAIL_KEY, googleEmail);
  else localStorage.removeItem(GSC_EMAIL_KEY);
}

export function clearStoredGscSession() {
  localStorage.removeItem(GSC_ACCESS_TOKEN_KEY);
  localStorage.removeItem(GSC_TOKEN_EXPIRY_KEY);
  localStorage.removeItem(GSC_EMAIL_KEY);
}

export async function fetchServerGscSession(userId) {
  if (!userId) return null;

  const headers = new Headers({ "Content-Type": "application/json" });
  const currentUser = auth.currentUser;
  if (currentUser) {
    headers.set("Authorization", `Bearer ${await currentUser.getIdToken()}`);
  }

  const response = await fetch("/api/gsc-token", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "get", userId }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Failed to restore GSC session (${response.status})`);
  }

  if (!data.connected || !data.accessToken) return { connected: false };

  const session = {
    connected: true,
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    googleEmail: data.googleEmail || null,
  };
  writeStoredGscSession(session);
  return session;
}

export async function restoreGscSession({ userId, preferServer = true } = {}) {
  const localSession = readStoredGscSession();

  if (!preferServer && localSession) return localSession;

  if (userId) {
    try {
      const serverSession = await fetchServerGscSession(userId);
      if (serverSession?.connected) return serverSession;
    } catch (error) {
      if (!localSession) throw error;
    }
  }

  return localSession || { connected: false };
}

export async function ensureValidGscSession({ userId } = {}) {
  const localSession = readStoredGscSession();
  if (localSession) return localSession;
  if (!userId) return null;

  const serverSession = await fetchServerGscSession(userId);
  return serverSession?.connected ? serverSession : null;
}
