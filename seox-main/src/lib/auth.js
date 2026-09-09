import { registerUser as registerMysqlUser, signIn as signInMysqlUser, logout as logoutMysqlUser, resetPassword as resetMysqlPassword } from "./mysqlAuth.js";
import { clearSession } from "./authSession.js";

export async function signUp({ email, password, displayName }) {
  const payload = await registerMysqlUser({ email, password, displayName });
  return payload.user;
}

export async function signIn({ email, password, remember = true }) {
  void remember;
  const payload = await signInMysqlUser({ email, password });
  return payload.user;
}

export function signInWithGoogle({ returnTo = "/dashboard" } = {}) {
  if (typeof window === "undefined") throw new Error("Google sign-in is only available in a browser.");
  window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
}

export async function logout() {
  try {
    await logoutMysqlUser();
  } catch {
    // Local logout must still complete when the server request is unavailable.
  } finally {
    clearSession();
  }
}

export async function resetPassword(email) {
  await resetMysqlPassword(email);
}
