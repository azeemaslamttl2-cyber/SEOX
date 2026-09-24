import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Key, Loader2, Save } from "lucide-react";
import { getSessionToken } from "../../../lib/authSession.js";

/**
 * DeepSeek panel, shown by the Settings page under the "DeepSeek AI" tab.
 *
 * It is the original DeepSeek Settings screen: the same `/api/deepseek-settings`
 * endpoint and the same `deepseek_api_settings` record, so every DeepSeek-backed
 * tool keeps reading the one key that was already configured.
 *
 * Presentation comes from the shared `.settings-*` rules in index.css.
 */

const emptySettings = { hasSavedKey: false, apiKeyPreview: "", envConfigured: false, updatedAt: "" };

export default function DeepSeekPanel() {
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
    <div className="settings-measure settings-panel">
      {error && (
        <p className="settings-banner" data-tone="error">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {success && (
        <p className="settings-banner" data-tone="success">
          <CheckCircle2 aria-hidden="true" />
          <span>{success}</span>
        </p>
      )}

      <form onSubmit={saveSettings} className="settings-card">
        <div className="settings-card-head">
          <span className="settings-card-icon" data-tone="info" aria-hidden="true">
            <Key />
          </span>
          <div className="settings-card-titles">
            <h2>API key</h2>
            <p>
              {configured
                ? `Configured${settings.apiKeyPreview ? ` (${settings.apiKeyPreview})` : ""}`
                : "Not configured"}
            </p>
          </div>
          <div className="settings-card-aside">
            <span className="settings-pill" data-tone={configured ? "success" : undefined}>
              {configured ? "Connected" : "Not set"}
            </span>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="settings-field">
            <label className="settings-label" htmlFor="deepseek-api-key">
              DeepSeek API key
            </label>
            <input
              id="deepseek-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings.hasSavedKey ? "Enter a new key to replace the saved key" : "sk-..."}
              disabled={loading || saving}
              className="settings-input"
            />
          </div>

          <div className="settings-checks">
            <label className="settings-check">
              <input
                type="checkbox"
                checked={clearApiKey}
                onChange={(event) => setClearApiKey(event.target.checked)}
                disabled={loading || saving}
              />
              <span className="settings-check-text">Clear saved key</span>
            </label>
          </div>

          <div className="settings-actions">
            <button
              type="submit"
              disabled={loading || saving || (!apiKey.trim() && !clearApiKey)}
              className="settings-btn is-primary"
            >
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {saving ? "Saving..." : "Save API key"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
