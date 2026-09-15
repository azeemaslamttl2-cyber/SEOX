import process from "node:process";
import { configureMysqlConnection, query, update } from "./mysql.js";
import { getStoredDocument } from "./mysql-storage.js";

/** `datetime` columns in this schema use "YYYY-MM-DD HH:MM:SS". */
function sqlTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Centralised application settings service.
 *
 * `admin_settings` is the single source of truth for the application-wide
 * credentials listed below.  Every server-side feature reads them through this
 * module instead of touching `process.env` directly.
 *
 *   Admin Settings page -> /api/settings/general -> admin_settings
 *                                                        |
 *                                     getAppSettings() / getAdminSetting()
 *                                                        |
 *              PageSpeed | Bing | DataForSEO | GSC | Google login | GBP
 *
 * Storage layout: one `admin_settings` row per setting, keyed by the snake_case
 * `setting_key`, with the value held in the existing `setting_value` JSON
 * column.  No schema change is required - the table is already a keyed JSON
 * store with a unique index on `setting_key`.
 *
 * `.env` remains a *migration fallback* only: a value is read from the
 * environment solely when the corresponding row is absent, so an existing
 * deployment keeps working until an administrator saves the settings once.
 */

export const LEGACY_API_SETTINGS_COLLECTION = "adminSettings";
export const LEGACY_API_SETTINGS_DOCUMENT = "apis";

/**
 * Canonical setting definitions.
 *
 * - `key`      : `admin_settings.setting_key`
 * - `envKeys`  : environment variables consulted while migrating, in order
 * - `secret`   : never returned to the browser in full
 * - `public`   : safe to expose unauthenticated (OAuth client id / redirect URI)
 */
export const SETTING_DEFINITIONS = [
  {
    key: "pagespeed_api_key",
    group: "pagespeed",
    label: "PageSpeed API Key",
    envKeys: ["PAGESPEED_API_KEY"],
    secret: true,
  },
  {
    key: "bing_webmaster_api_key",
    group: "bing",
    label: "Bing Webmaster API Key",
    envKeys: ["BING_WEBMASTER_API_KEY", "VITE_BING_WEBMASTER_API_KEY"],
    secret: true,
  },
  {
    key: "dataforseo_login",
    group: "dataforseo",
    label: "DataForSEO Login",
    envKeys: ["DATAFORSEO_LOGIN", "VITE_DATAFORSEO_LOGIN"],
    secret: false,
    legacyDocumentField: "dataforseoLogin",
  },
  {
    key: "dataforseo_password",
    group: "dataforseo",
    label: "DataForSEO Password",
    envKeys: ["DATAFORSEO_PASSWORD", "VITE_DATAFORSEO_PASSWORD"],
    secret: true,
    legacyDocumentField: "dataforseoPassword",
  },
  {
    key: "google_client_id",
    group: "google",
    label: "Google Client ID",
    envKeys: ["GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID"],
    secret: false,
    public: true,
  },
  {
    key: "google_client_secret",
    group: "google",
    label: "Google Client Secret",
    envKeys: ["GOOGLE_CLIENT_SECRET"],
    secret: true,
  },
  {
    key: "google_gsc_redirect_uri",
    group: "google",
    label: "Google Search Console Redirect URI",
    envKeys: ["GOOGLE_REDIRECT_URI", "VITE_GOOGLE_REDIRECT_URI"],
    secret: false,
    public: true,
  },
  {
    key: "google_auth_redirect_uri",
    group: "google",
    label: "Google Authentication Redirect URI",
    envKeys: ["GOOGLE_AUTH_REDIRECT_URI", "GOOGLE_OAUTH_REDIRECT_URI"],
    secret: false,
    public: true,
  },
  {
    key: "google_gbp_redirect_uri",
    group: "google",
    label: "Google Business Profile Redirect URI",
    envKeys: ["GBP_REDIRECT_URI", "GOOGLE_GBP_REDIRECT_URI"],
    secret: false,
    public: true,
  },
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((item) => item.key);

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((item) => [item.key, item]));

/** Cache lifetime. Short enough that a missed invalidation self-heals quickly. */
const CACHE_TTL_MS = 60_000;

let cache = null; // { values: Map<key, {value, source}>, expiresAt: number }
let pendingLoad = null;

export function invalidateAppSettingsCache() {
  cache = null;
  pendingLoad = null;
}

function normalizeValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // `setting_value` is a JSON column, so a plain string round-trips as a string;
  // anything else is stored under { value: ... } by saveAdminSettings.
  if (typeof value === "object" && "value" in value) return normalizeValue(value.value);
  return "";
}

function envValueFor(definition, env) {
  for (const name of definition.envKeys || []) {
    const candidate = env?.[name];
    if (candidate != null && String(candidate).trim() !== "") return String(candidate).trim();
  }
  return "";
}

/**
 * Vite does not copy .env values into process.env, so API handlers pass their
 * loaded environment down. Reconfiguring the pool from an environment that has
 * no MySQL settings would tear down the working connection, so only apply an
 * environment that actually carries them.
 */
function applyConnectionEnv(env) {
  if (env && env.MYSQL_HOST) configureMysqlConnection(env);
}

async function readSettingRows(env) {
  applyConnectionEnv(env);
  // Placeholders are expanded by hand: the pool uses prepared statements, which
  // do not expand an array parameter into an IN list.
  const placeholders = SETTING_KEYS.map(() => "?").join(", ");
  const rows = await query(
    `SELECT \`setting_key\`, \`setting_value\`, \`updated_at\`, \`updated_by\` ` +
      `FROM \`admin_settings\` WHERE \`setting_key\` IN (${placeholders})`,
    SETTING_KEYS
  );
  const map = new Map();
  for (const row of rows || []) {
    let parsed = row.setting_value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // A plain (non-JSON) string is still a usable value.
      }
    }
    const value = normalizeValue(parsed);
    if (value) {
      map.set(row.setting_key, {
        value,
        updatedAt: row.updated_at ? String(row.updated_at) : "",
        updatedBy: row.updated_by || "",
      });
    }
  }
  return map;
}

/**
 * Legacy compatibility: DataForSEO credentials were previously stored inside the
 * `admin_settings` row `setting_key = 'apis'` as a camelCase JSON document.
 * Existing installations keep working until the values are re-saved.
 */
async function readLegacyDocument(env) {
  try {
    const collection = env?.ADMIN_SETTINGS_COLLECTION || LEGACY_API_SETTINGS_COLLECTION;
    return (await getStoredDocument(env, collection, LEGACY_API_SETTINGS_DOCUMENT)) || {};
  } catch {
    // The legacy document is optional; absence is not an error.
    return {};
  }
}

/**
 * Pure resolution step, separated from I/O so the precedence rules can be
 * tested directly: admin_settings row -> legacy `apis` document -> .env.
 */
export function resolveSettingValues({ rows = new Map(), legacyDocument = {}, env = {} } = {}) {
  const values = new Map();
  for (const definition of SETTING_DEFINITIONS) {
    const stored = rows.get(definition.key);
    if (stored?.value) {
      values.set(definition.key, {
        value: stored.value,
        source: "admin_settings",
        updatedAt: stored.updatedAt,
        updatedBy: stored.updatedBy,
      });
      continue;
    }

    const legacy = definition.legacyDocumentField
      ? String(legacyDocument?.[definition.legacyDocumentField] || "").trim()
      : "";
    if (legacy) {
      values.set(definition.key, {
        value: legacy,
        source: "admin_settings_legacy",
        updatedAt: String(legacyDocument?.dataforseoUpdatedAt || ""),
        updatedBy: String(legacyDocument?.dataforseoUpdatedBy || ""),
      });
      continue;
    }

    const fromEnv = envValueFor(definition, env);
    values.set(definition.key, {
      value: fromEnv,
      source: fromEnv ? "env" : "unset",
      updatedAt: "",
      updatedBy: "",
    });
  }

  return values;
}

async function loadSettings(env) {
  const resolvedEnv = env || process.env;
  let rows = new Map();
  let databaseAvailable = true;

  try {
    rows = await readSettingRows(resolvedEnv);
  } catch (error) {
    databaseAvailable = false;
    // Never log the values themselves - only that the read failed.
    console.warn("admin_settings could not be read:", error?.message || error);
  }

  const needsLegacy = SETTING_DEFINITIONS.some(
    (definition) => definition.legacyDocumentField && !rows.get(definition.key)
  );
  const legacyDocument = needsLegacy && databaseAvailable ? await readLegacyDocument(resolvedEnv) : {};

  return {
    values: resolveSettingValues({ rows, legacyDocument, env: resolvedEnv }),
    databaseAvailable,
  };
}

/**
 * Returns every application setting, resolving `admin_settings` first and only
 * then the `.env` migration fallback.  Results are cached per process so a
 * single request that touches several credentials issues one database query.
 */
export async function getAppSettings(env = process.env, { refresh = false } = {}) {
  if (!refresh && cache && cache.expiresAt > Date.now()) return cache;
  if (!refresh && pendingLoad) return pendingLoad;

  const load = loadSettings(env)
    .then((result) => {
      cache = { ...result, expiresAt: Date.now() + CACHE_TTL_MS };
      pendingLoad = null;
      return cache;
    })
    .catch((error) => {
      pendingLoad = null;
      throw error;
    });

  pendingLoad = load;
  return load;
}

/** Reads a single setting value, or "" when it is configured nowhere. */
export async function getAdminSetting(key, env = process.env) {
  if (!DEFINITION_BY_KEY.has(key)) {
    throw new Error(`Unknown application setting: ${key}`);
  }
  const settings = await getAppSettings(env);
  return settings.values.get(key)?.value || "";
}

/** Reads several settings at once; returns a plain `{ key: value }` object. */
export async function getAdminSettings(keys, env = process.env) {
  const settings = await getAppSettings(env);
  const result = {};
  for (const key of keys) {
    result[key] = settings.values.get(key)?.value || "";
  }
  return result;
}

/** Says where a value came from: admin_settings, env, or unset. */
export async function getAdminSettingSource(key, env = process.env) {
  const settings = await getAppSettings(env);
  return settings.values.get(key)?.source || "unset";
}

/** Audit metadata for one setting. Never includes the value itself. */
export async function getAdminSettingMeta(key, env = process.env) {
  const settings = await getAppSettings(env);
  const entry = settings.values.get(key);
  return {
    source: entry?.source || "unset",
    configured: Boolean(entry?.value),
    updatedAt: entry?.updatedAt || "",
    updatedBy: entry?.updatedBy || "",
  };
}

/**
 * Writes settings to `admin_settings` and invalidates the cache so a changed
 * credential takes effect on the next request rather than after the TTL.
 *
 * `values` is `{ [setting_key]: string }`. A key mapped to "" clears the row's
 * value; a key that is absent is left untouched.
 */
export async function saveAdminSettings(values, { env = process.env, updatedBy = "" } = {}) {
  applyConnectionEnv(env);
  const entries = Object.entries(values || {}).filter(([key]) => DEFINITION_BY_KEY.has(key));

  for (const [key, rawValue] of entries) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    await update(
      "INSERT INTO `admin_settings` (`setting_key`, `setting_value`, `updated_at`, `updated_by`) " +
        "VALUES (?, ?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`), " +
        "`updated_at` = VALUES(`updated_at`), `updated_by` = VALUES(`updated_by`)",
      [key, JSON.stringify(value), sqlTimestamp(), updatedBy || null]
    );
  }

  invalidateAppSettingsCache();
  return entries.length;
}

/** Metadata for the admin UI - never includes a secret value. */
export async function describeAppSettings(env = process.env) {
  const settings = await getAppSettings(env, { refresh: true });
  return SETTING_DEFINITIONS.map((definition) => {
    const entry = settings.values.get(definition.key) || { value: "", source: "unset" };
    const configured = Boolean(entry.value);
    return {
      key: definition.key,
      group: definition.group,
      label: definition.label,
      secret: Boolean(definition.secret),
      configured,
      source: entry.source,
      updatedAt: entry.updatedAt || "",
      updatedBy: entry.updatedBy || "",
      // Secrets report only that they are set; non-secret values (login,
      // client id, redirect URIs) are editable in place so they are returned.
      value: definition.secret ? "" : entry.value,
      preview: definition.secret && configured ? maskSecret(entry.value) : "",
    };
  });
}

export function maskSecret(value) {
  const secret = String(value || "");
  if (!secret) return "";
  const suffix = secret.slice(-4);
  return suffix ? `••••${suffix}` : "••••";
}

/** The subset that the browser is allowed to read without authentication. */
export async function getPublicAppSettings(env = process.env) {
  const settings = await getAppSettings(env);
  const result = {};
  for (const definition of SETTING_DEFINITIONS) {
    if (!definition.public) continue;
    result[definition.key] = settings.values.get(definition.key)?.value || "";
  }
  return result;
}
