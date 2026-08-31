const AUTH_API_BASE = '/api/auth';

async function requestAuth(path, body) {
  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const message = payload.error || payload.message || 'Authentication failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function registerUser({ email, password, displayName }) {
  return requestAuth('/register', { email, password, displayName });
}

export async function signIn({ email, password }) {
  return requestAuth('/login', { email, password });
}

export async function logout() {
  return requestAuth('/logout', {});
}

export async function resetPassword(email) {
  return requestAuth('/password-reset', { email });
}
