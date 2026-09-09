import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BrainCircuit, CheckCircle2, Key, Loader2, Save } from "lucide-react";
import { getSessionToken } from "../../lib/authSession.js";

const emptySettings = { hasSavedKey: false, apiKeyPreview: "", envConfigured: false, updatedAt: "" };

export default function DeepSeekSettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestSettings = useCallback(async (options = {}) => {
    const token = getSessionToken();
    if (!token) throw new Error("Sign in before managing DeepSeek settings.");
    const response = await fetch("/api/deepseek-settings", {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error(payload.error || "Failed to load DeepSeek settings.");
    return payload;
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setSettings(await requestSettings()); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [requestSettings]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      setSettings(await requestSettings({ method: "POST", body: { apiKey, clearApiKey } }));
      setApiKey(""); setClearApiKey(false); setSuccess("DeepSeek API settings saved.");
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const configured = settings.hasSavedKey || settings.envConfigured;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200"><BrainCircuit className="h-3.5 w-3.5" /> AI Provider</div>
        <h1 className="mt-3 font-display text-3xl font-black text-white">DeepSeek API</h1>
        <p className="mt-2 text-sm text-white/45">Configure the key used by DeepSeek-powered SEO tools. Keys are stored securely on the server.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"><AlertCircle className="h-4 w-4" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      <form onSubmit={saveSettings} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Key className="h-5 w-5" /></div><div><h2 className="font-display text-base font-bold text-white">API key</h2><p className="text-xs text-white/40">{configured ? `Configured${settings.apiKeyPreview ? ` (${settings.apiKeyPreview})` : ""}` : "Not configured"}</p></div></div>
        <div className="space-y-4 p-5">
          <label className="block text-sm font-semibold text-white/75" htmlFor="deepseek-api-key">DeepSeek API key</label>
          <input id="deepseek-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.hasSavedKey ? "Enter a new key to replace the saved key" : "sk-..."} disabled={loading || saving} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-400/60" />
          <label className="flex items-center gap-2 text-sm text-white/55"><input type="checkbox" checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} disabled={loading || saving} /> Clear saved key</label>
          <button type="submit" disabled={loading || saving || (!apiKey.trim() && !clearApiKey)} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save API key"}</button>
        </div>
      </form>
    </div>
  );
}
