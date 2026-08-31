const DEFAULT_MAX_REDIRECTS = 5;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function makeHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeHostname(hostname = "") {
  return String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function parseIpv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return null;
  return parts;
}

function isPrivateIpv4(parts) {
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isBlockedFetchHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  const ipv4 = parseIpv4(host);
  if (ipv4) return isPrivateIpv4(ipv4);

  if (host.includes(":")) {
    return true;
  }

  return false;
}

export function parsePublicHttpUrl(value, label = "URL") {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw makeHttpError(`Invalid ${label} format`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw makeHttpError("Only HTTP and HTTPS URLs are allowed");
  }

  if (url.username || url.password) {
    throw makeHttpError("URLs with embedded credentials are not allowed");
  }

  if (isBlockedFetchHostname(url.hostname)) {
    throw makeHttpError("Private, local, and metadata network URLs are not allowed");
  }

  url.hash = "";
  return url;
}

export function resolvePublicRedirect(location, currentUrl) {
  if (!location) return null;
  return parsePublicHttpUrl(new URL(location, currentUrl).toString(), "redirect URL");
}

export async function fetchPublicHttpUrl(value, init = {}) {
  const { maxRedirects = DEFAULT_MAX_REDIRECTS, ...fetchInit } = init;
  let currentUrl = parsePublicHttpUrl(value);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      ...fetchInit,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount >= maxRedirects) return response;
    currentUrl = resolvePublicRedirect(location, currentUrl);
  }

  throw makeHttpError("Too many redirects", 508);
}
