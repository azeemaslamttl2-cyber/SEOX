import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Key,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

const emptySettings = {
  login: "",
  hasSavedCredentials: false,
  hasSavedPassword: false,
  passwordPreview: "",
  envConfigured: false,
  updatedAt: "",
  updatedBy: "",
};

function formatDate(value) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminApis() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(emptySettings);
  const [login, setLogin] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestApiSettings = useCallback(async (options = {}) => {
    if (!user) throw new Error("Sign in before managing API settings.");
    const token = await user.getIdToken();
    const response = await fetch("/api/api-settings", {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "Failed to load API settings.");
    }
    return payload;
  }, [user]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await requestApiSettings();
      const dataforseo = payload.dataforseo || emptySettings;
      setSettings(dataforseo);
      setLogin(dataforseo.login || "");
    } catch (err) {
      setError(err.message || "Failed to load API settings.");
    } finally {
      setLoading(false);
    }
  }, [requestApiSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = await requestApiSettings({
        method: "POST",
        body: {
          dataforseoLogin: login.trim(),
          dataforseoPassword: apiKey.trim(),
          clearDataforseoPassword: clearKey,
        },
      });
      const dataforseo = payload.dataforseo || emptySettings;
      setSettings(dataforseo);
      setLogin(dataforseo.login || "");
      setApiKey("");
      setClearKey(false);
      setSuccess("DataForSEO API settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save API settings.");
    } finally {
      setSaving(false);
    }
  }

  const configured = settings.hasSavedCredentials || settings.envConfigured;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin API Settings
          </div>
          <h1 className="mt-3 font-display text-3xl font-black text-white">APIs</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/45">
            Manage shared API credentials for PGC tools. DataForSEO-powered tools use these credentials automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSettings}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <form onSubmit={saveSettings} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-white">DataForSEO</h2>
                <p className="text-xs text-white/40">Keyword, SERP, Brand Radar, and local rank grid data.</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                configured
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {configured ? "Configured" : "Needs credentials"}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading API settings...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Login</span>
                  <input
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900/70 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-brand-500/40 focus:outline-none"
                    placeholder="DataForSEO login"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">API Key / Password</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value);
                      if (event.target.value) setClearKey(false);
                    }}
                    disabled={clearKey}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900/70 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-brand-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={settings.hasSavedPassword ? `Saved ${settings.passwordPreview}; leave blank to keep` : "DataForSEO API key/password"}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-white/45">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(event) => {
                    setClearKey(event.target.checked);
                    if (event.target.checked) setApiKey("");
                  }}
                  className="h-4 w-4 rounded border-white/20 bg-ink-900 text-brand-500 focus:ring-brand-500"
                />
                Clear the saved DataForSEO API key/password
              </label>

              <div className="grid gap-3 rounded-xl border border-white/10 bg-ink-900/50 p-4 text-xs text-white/45 md:grid-cols-3">
                <div>
                  <div className="font-semibold uppercase tracking-wider text-white/25">Saved Key</div>
                  <div className="mt-1 text-white/70">{settings.hasSavedPassword ? settings.passwordPreview : "None"}</div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wider text-white/25">Server Env</div>
                  <div className="mt-1 text-white/70">{settings.envConfigured ? "Configured" : "Not configured"}</div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wider text-white/25">Last Updated</div>
                  <div className="mt-1 text-white/70">{formatDate(settings.updatedAt)}</div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 px-5 py-4">
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:shadow-[0_12px_36px_-8px_rgba(249,115,22,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving" : "Save API Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
