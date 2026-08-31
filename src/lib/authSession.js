const AUTH_STORAGE_KEY = 'mysql-auth-user';

function readStorage(storage) {
  try {
    return storage?.getItem(AUTH_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getPersistedAuthUser() {
  if (typeof window === 'undefined') return null;
  const raw = readStorage(window.localStorage) || readStorage(window.sessionStorage);
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function persistAuthUser(user, remember = true) {
  if (typeof window === 'undefined' || !user) return;
  const serialized = JSON.stringify(user);
  try {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(AUTH_STORAGE_KEY, serialized);
  } catch {
    try { window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized); } catch { /* Ignore storage failures. */ }
  }
}

export function getSessionToken() {
  return getPersistedAuthUser()?.accessToken || '';
}

export function clearSession() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event('mysql-auth-changed'));
  } catch {
    // Ignore storage failures; callers still receive the original API error.
  }
}
