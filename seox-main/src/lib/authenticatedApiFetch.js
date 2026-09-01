import { auth } from "./firebase.js";

let installed = false;

function apiUrlFromInput(input) {
  const raw = typeof input === "string" ? input : input?.url;
  if (!raw || typeof window === "undefined") return null;

  try {
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
}

function isAppApiRequest(url) {
  if (!url || url.pathname.startsWith("/api/") === false) return false;
  if (url.origin === window.location.origin) return true;

  return (
    import.meta.env.DEV &&
    ["http://127.0.0.1:8788", "http://localhost:8788"].includes(url.origin)
  );
}

function hasAuthorization(headers) {
  if (headers instanceof Headers) return headers.has("authorization");
  return Object.keys(headers || {}).some((key) => key.toLowerCase() === "authorization");
}

function mergeAuthHeader(init, token) {
  const headers = new Headers(init?.headers || {});
  if (!hasAuthorization(headers)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return { ...(init || {}), headers };
}

export function installAuthenticatedApiFetch() {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = apiUrlFromInput(input);
    if (!isAppApiRequest(url) || hasAuthorization(init?.headers)) {
      return nativeFetch(input, init);
    }

    const user = auth.currentUser;
    if (!user) return nativeFetch(input, init);

    const token = await user.getIdToken();
    return nativeFetch(input, mergeAuthHeader(init, token));
  };
}
