import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Globe,
  KeyRound,
  Loader2,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getSessionToken } from "../../lib/authSession.js";

/**
 * General Settings - application-wide credentials stored in `admin_settings`.
 *
 * Secret values are never sent to the browser: the API reports only whether a
 * secret is configured plus a masked preview. Leaving a secret field blank
 * keeps the stored value; "Clear" removes it.
 */
const SECTIONS = [
  {
    id: "pagespeed",
    title: "PageSpeed",
    description: "Google PageSpeed Insights key used by the speed and project audits.",
    icon: Gauge,
    accent: "bg-amber-500/15 text-amber-300",
    keys: ["pagespeed_api_key"],
  },
  {
    id: "bing",
    title: "Bing Webmaster",
    description: "Key used by the Bing Webmaster Tools integration.",
    icon: Search,
    accent: "bg-sky-500/15 text-sky-300",
    keys: ["bing_webmaster_api_key"],
  },
  {
    id: "dataforseo",
    title: "DataForSEO",
    description:
      "Credentials for keyword research, Brand Radar, plagiarism and the other DataForSEO-backed tools.",
    icon: KeyRound,
    accent: "bg-violet-500/15 text-violet-300",
    keys: ["dataforseo_login", "dataforseo_password"],
  },
  {
    id: "google-oauth",
    title: "Google OAuth / Search Console",
    description:
      "One Google OAuth client serves Search Console, Google sign-in and Business Profile. Each flow uses its own redirect URI below.",
    icon: ShieldCheck,
    accent: "bg-emerald-500/15 text-emerald-300",
    keys: ["google_client_id", "google_client_secret", "google_gsc_redirect_uri"],
  },
  {
    id: "google-flows",
    title: "Google Authentication / Business Profile",
    description:
      "Redirect URIs for the remaining Google flows. Each must match a redirect registered on the OAuth client.",
    icon: Globe,
    accent: "bg-rose-500/15 text-rose-300",
    keys: ["google_auth_redirect_uri", "google_gbp_redirect_uri"],
  },
];

const HINTS = {
  pagespeed_api_key: "Google Cloud API key with PageSpeed Insights enabled.",
  bing_webmaster_api_key: "Found in Bing Webmaster Tools under Settings > API access.",
  dataforseo_login: "Usually the account email address.",
  dataforseo_password: "The DataForSEO API password, not the dashboard password.",
  google_client_id: "Ends in .apps.googleusercontent.com.",
  google_client_secret: "Never leaves the server; it is only used for token exchange.",
  google_gsc_redirect_uri: "For example https://your-domain/gsc/oauth-callback",
  google_auth_redirect_uri: "For example https://your-domain/api/auth/google/callback",
  google_gbp_redirect_uri: "Defaults to the Search Console redirect when left blank.",
};

const SOURCE_LABELS = {
  admin_settings: { text: "Saved in database", tone: "text-emerald-300" },
  admin_settings_legacy: { text: "Saved in database (legacy record)", tone: "text-emerald-300" },
  env: { text: "Still coming from .env - save to migrate", tone: "text-amber-300" },
  unset: { text: "Not configured", tone: "text-white/40" },
};

function formatDate(value) {
  if (!value) return "Never";
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

export default function GeneralSettings() {
  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [cleared, setCleared] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");

  const byKey = useMemo(() => {
    const map = new Map();
    settings.forEach((item) => map.set(item.key, item));
    return map;
  }, [settings]);

  const requestSettings = useCallback(async (options = {}) => {
    const token = getSessionToken();
    if (!token) throw new Error("Sign in with an administrator account to manage these settings.");

    const response = await fetch("/api/settings/general", {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const failure = new Error(payload.error || "Failed to load general settings.");
      failure.fieldErrors = payload.errors || {};
      throw failure;
    }
    return payload;
  }, []);

  const applyPayload = useCallback((payload) => {
    const next = payload.settings || [];
    setSettings(next);
    // Non-secret values are editable in place; secrets always start blank.
    setDrafts(
      Object.fromEntries(next.map((item) => [item.key, item.secret ? "" : item.value || ""]))
    );
    setCleared({});
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyPayload(await requestSettings());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applyPayload, requestSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    try {
      const payload = await requestSettings({
        method: "POST",
        body: {
          settings: drafts,
          cleared: Object.keys(cleared).filter((key) => cleared[key]),
        },
      });
      applyPayload(payload);
      setSuccess("General settings saved. New values take effect immediately.");
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  }

  const pendingEnvMigration = settings.filter((item) => item.source === "env").length;

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200">
          <ShieldCheck className="h-3.5 w-3.5" /> Administrator
        </div>
        <h1 className="mt-3 font-display text-3xl font-black text-white">General Settings</h1>
        <p className="mt-2 text-sm text-white/45">
          Application-wide API credentials. These are stored in the database and read by every
          server-side integration. Secrets are never sent back to the browser.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}
      {!loading && pendingEnvMigration > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {pendingEnvMigration} setting{pendingEnvMigration === 1 ? " is" : "s are"} still being read
          from the server environment. Save them here to move them into the database.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings...
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-white">{section.title}</h2>
                    <p className="text-xs text-white/40">{section.description}</p>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  {section.keys.map((key) => {
                    const setting = byKey.get(key);
                    if (!setting) return null;
                    const sourceLabel = SOURCE_LABELS[setting.source] || SOURCE_LABELS.unset;
                    const isCleared = Boolean(cleared[key]);

                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <label className="text-sm font-semibold text-white/75" htmlFor={key}>
                            {setting.label}
                          </label>
                          <span className={`text-[11px] font-medium ${sourceLabel.tone}`}>
                            {sourceLabel.text}
                            {setting.secret && setting.preview ? ` (${setting.preview})` : ""}
                          </span>
                        </div>

                        <input
                          id={key}
                          type={setting.secret ? "password" : "text"}
                          autoComplete={setting.secret ? "new-password" : "off"}
                          spellCheck={false}
                          value={drafts[key] ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({ ...current, [key]: event.target.value }))
                          }
                          disabled={saving || isCleared}
                          placeholder={
                            setting.secret
                              ? setting.configured
                                ? "Enter a new value to replace the saved secret"
                                : "Not configured"
                              : HINTS[key] || ""
                          }
                          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-400/60 disabled:opacity-40"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] text-white/35">{HINTS[key]}</p>
                          {setting.configured && (
                            <label className="flex items-center gap-2 text-[11px] text-white/45">
                              <input
                                type="checkbox"
                                checked={isCleared}
                                onChange={(event) =>
                                  setCleared((current) => ({
                                    ...current,
                                    [key]: event.target.checked,
                                  }))
                                }
                                disabled={saving}
                              />
                              Clear saved value
                            </label>
                          )}
                        </div>

                        {fieldErrors[key] && (
                          <p className="text-[11px] text-red-300">{fieldErrors[key]}</p>
                        )}
                        {setting.source === "admin_settings" && setting.updatedAt && (
                          <p className="text-[11px] text-white/25">
                            Updated {formatDate(setting.updatedAt)}
                            {setting.updatedBy ? ` by ${setting.updatedBy}` : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              onClick={loadSettings}
              disabled={saving}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
