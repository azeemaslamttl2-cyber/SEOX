import { queryOne, update } from "./mysql.js";
import { getAdminSettings } from "./app-settings.js";
import { googleFetch } from "./google-fetch.js";
import { findMatchingSiteForProject, runGscAudit } from "../../src/lib/gscAuditCore.js";
import { runGscInsights } from "../../src/lib/gscInsightsCore.js";

const SITES_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 120000;

/** A saved result younger than this is served without calling Google. */
export const GSC_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * project_data keys. `gsc` is deliberately NOT here: the Dashboard card, the
 * OAuth callback and the GSC Audit page all write their own shape to it.
 */
export const GSC_MODULES = {
  gsc_audit: {
    run: ({ request, site }) => runGscAudit({ request: (_site, body) => request(body), site, rangeDays: 28 }),
    usable: (value) => Boolean(value?.signedIn && value.metrics && Array.isArray(value.topQueries)),
  },
  gsc_insights: {
    run: ({ request, site }) => runGscInsights({ request, site, days: 90 }),
    usable: (value) => Boolean(value?.signedIn && value.summary && Array.isArray(value.keywords)),
  },
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isFreshGscResult(key, value, now = Date.now(), maxAgeMs = GSC_MAX_AGE_MS) {
  if (!GSC_MODULES[key]?.usable(value)) return false;
  const fetchedAt = Date.parse(value.fetchedAt || "");
  return Number.isFinite(fetchedAt) && now - fetchedAt < maxAgeMs;
}

async function loadConnection(userId, projectId) {
  // A project-scoped connection wins over the user-wide one (project_id NULL).
  return queryOne(
    `SELECT id, access_token, refresh_token, expires_at
       FROM gsc_connections
      WHERE user_id = ? AND (project_id = ? OR project_id IS NULL)
      ORDER BY project_id IS NULL
      LIMIT 1`,
    [userId, projectId]
  );
}

async function refreshAccessToken(env, connection) {
  if (!connection.refresh_token) throw fail("GSC_TOKEN_EXPIRED", "Search Console token expired and no refresh token is stored. Reconnect Search Console.");
  const { google_client_id: clientId, google_client_secret: clientSecret } = await getAdminSettings(
    ["google_client_id", "google_client_secret"],
    env
  );
  if (!clientId || !clientSecret) throw fail("GSC_NOT_CONFIGURED", "Google OAuth credentials are not configured.");

  const response = await googleFetch(
    TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: connection.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    },
    { label: "Google OAuth token refresh" }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // Unlike the interactive route, the stored connection is left in place:
    // a transient refusal must not disconnect the user's Search Console.
    throw fail("GSC_TOKEN_INVALID", `Search Console token refresh failed (${data.error || response.status}). Reconnect Search Console.`);
  }

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  await update(
    `UPDATE gsc_connections SET access_token = ?, expires_at = ?, updated_at = NOW() WHERE id = ?`,
    [data.access_token, new Date(expiresAt).toISOString().slice(0, 19).replace("T", " "), connection.id]
  );
  return data.access_token;
}

async function getAccessToken(env, userId, projectId) {
  const connection = await loadConnection(userId, projectId);
  if (!connection?.access_token && !connection?.refresh_token) {
    throw fail("GSC_NOT_CONNECTED", "Search Console is not connected for this project owner.");
  }
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (connection.access_token && expiresAt > Date.now() + EXPIRY_SKEW_MS) return connection.access_token;
  return refreshAccessToken(env, connection);
}

async function googleJson(url, init, label) {
  const response = await googleFetch(url, init, { label });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw fail("GSC_API_ERROR", payload?.error?.message || `${label} returned HTTP ${response.status}`);
  }
  return payload;
}

/**
 * Writes only `project_data.<key>`. JSON_SET leaves every other key untouched
 * and runs atomically in MySQL. Callers pass only usable results, so a failed
 * run can never overwrite a good saved one.
 */
export async function saveGscResult(projectId, key, value) {
  if (!GSC_MODULES[key]) throw new Error(`Unknown GSC module: ${key}`);
  await update(
    `UPDATE user_projects
        SET project_data = JSON_SET(COALESCE(project_data, JSON_OBJECT()), '$.${key}', CAST(? AS JSON)),
            updated_at = NOW()
      WHERE project_id = ?`,
    [JSON.stringify(value), projectId]
  );
}

function errorEntry(saved, key, error) {
  return {
    data: GSC_MODULES[key].usable(saved[key]) ? saved[key] : null,
    status: "error",
    error: { code: error?.code || "GSC_ERROR", message: error?.message || "GSC request failed." },
  };
}

/**
 * Cache-first resolution for the requested modules. Never throws.
 *
 * Fresh saved results are returned without touching Google. For the rest the
 * token and property lookup happen once, then every stale module runs in
 * parallel. Returns { [key]: { data, status: cached|fresh|error, error? } }.
 */
export async function resolveGscData({ env, project, saved = {}, want = Object.keys(GSC_MODULES), force = false }) {
  const out = {};
  const stale = [];
  for (const key of want) {
    if (!GSC_MODULES[key]) continue;
    if (!force && isFreshGscResult(key, saved[key])) out[key] = { data: saved[key], status: "cached" };
    else stale.push(key);
  }
  if (!stale.length) return out;

  let site;
  let headers;
  let sitesAvailable = 0;
  try {
    const token = await getAccessToken(env, project.user_id, project.project_id);
    headers = { Authorization: `Bearer ${token}` };
    const sites = await googleJson(SITES_ENDPOINT, { headers }, "Search Console sites");
    const list = sites?.siteEntry || [];
    sitesAvailable = list.length;
    site = findMatchingSiteForProject(list, project.full_url, project.domain);
    if (!site) throw fail("GSC_SITE_NOT_FOUND", `No Google Search Console property matched ${project.domain || project.full_url}.`);
  } catch (error) {
    for (const key of stale) out[key] = errorEntry(saved, key, error);
    return out;
  }

  const request = async (body) => {
    const payload = await googleJson(
      `${SITES_ENDPOINT}/${encodeURIComponent(site)}/searchAnalytics/query`,
      { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      "Search Console analytics"
    );
    return payload?.rows || [];
  };

  await Promise.all(
    stale.map(async (key) => {
      try {
        const result = await GSC_MODULES[key].run({ request, site });
        const data = { ...result, sitesAvailable, fetchedAt: new Date().toISOString(), source: "api" };
        if (!GSC_MODULES[key].usable(data)) throw fail("GSC_EMPTY", "Search Console returned no usable data.");
        await saveGscResult(project.project_id, key, data);
        out[key] = { data, status: "fresh" };
      } catch (error) {
        out[key] = errorEntry(saved, key, error);
      }
    })
  );
  return out;
}
