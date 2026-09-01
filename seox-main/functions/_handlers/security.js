import { requireFirebaseAuthFromNodeRequest } from "../_lib/request-auth.js";
import { fetchPublicHttpUrl } from "../_lib/url-security.js";

const buckets = new Map();

export function applyApiSecurity(req, res, { methods = ["GET", "POST", "OPTIONS"] } = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export function enforceRateLimit(req, res, { key = "api", limit = 30, windowMs = 60_000 } = {}) {
  const client = String(req.headers?.["cf-connecting-ip"] || req.headers?.["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const bucketKey = `${key}:${client}`;
  const now = Date.now();
  const current = buckets.get(bucketKey);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(bucketKey, bucket);
  if (bucket.count > limit) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return false;
  }
  return true;
}

export function requireJsonBody(req, res, { maxBytes = 100_000 } = {}) {
  const type = String(req.headers?.["content-type"] || "").toLowerCase();
  if (req.method !== "GET" && !type.includes("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return false;
  }
  const size = new TextEncoder().encode(JSON.stringify(req.body ?? {})).length;
  if (size > maxBytes) {
    res.status(413).json({ error: "Request body is too large" });
    return false;
  }
  return true;
}

export async function requireFirebaseUser(req, res) {
  try {
    return await requireFirebaseAuthFromNodeRequest(req);
  } catch (error) {
    res.status(error?.status || 401).json({ error: error?.message || "Authentication required" });
    return null;
  }
}

export function safeFetch(url, init = {}) {
  return fetchPublicHttpUrl(url, init);
}
