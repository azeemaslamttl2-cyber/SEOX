import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { HINTS, SECTION_BY_ID } from "../settingsCatalog.js";
import { formatSettingDate } from "../formatSettingDate.js";

const SOURCE_LABELS = {
  admin_settings: { text: "Saved", tone: "saved" },
  admin_settings_legacy: { text: "Saved (legacy record)", tone: "saved" },
  env: { text: "From .env - save to migrate", tone: "pending" },
  unset: { text: "Not configured", tone: "unset" },
};

/**
 * Renders the `admin_settings` credential sections that belong to one tab.
 *
 * All state lives in the shared `useAppSettings` hook, so the SEO APIs and
 * Google tabs edit one copy of the data and save through the one existing
 * `/api/settings/general` endpoint.
 *
 * Presentation comes from the shared `.settings-*` rules in index.css.
 */
export default function AppCredentialsPanel({ sectionIds, keys, state }) {
  const {
    byKey,
    drafts,
    cleared,
    loading,
    saving,
    error,
    fieldErrors,
    success,
    setDraft,
    setCleared,
    reload,
    save,
  } = state;

  const sections = sectionIds.map((id) => SECTION_BY_ID.get(id)).filter(Boolean);
  const pendingEnvMigration = keys.filter((key) => byKey.get(key)?.source === "env").length;

  function onSubmit(event) {
    event.preventDefault();
    save(keys);
  }

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
      {!loading && pendingEnvMigration > 0 && (
        <p className="settings-banner" data-tone="warning">
          <AlertCircle aria-hidden="true" />
          <span>
            {pendingEnvMigration} setting{pendingEnvMigration === 1 ? " is" : "s are"} still being
            read from the server environment. Save them here to move them into the database.
          </span>
        </p>
      )}

      {loading ? (
        <div className="settings-loading">
          <Loader2 className="animate-spin" aria-hidden="true" />
          Loading settings...
        </div>
      ) : (
        <form onSubmit={onSubmit} className="settings-panel">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} className="settings-card">
                <div className="settings-card-head">
                  <span className="settings-card-icon" data-tone={section.tone} aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="settings-card-titles">
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                </div>

                <div className="settings-card-body">
                  {section.keys.map((key) => {
                    const setting = byKey.get(key);
                    if (!setting) return null;
                    const sourceLabel = SOURCE_LABELS[setting.source] || SOURCE_LABELS.unset;
                    const isCleared = Boolean(cleared[key]);

                    return (
                      <div key={key} className="settings-field">
                        <div className="settings-field-head">
                          <label className="settings-label" htmlFor={key}>
                            {setting.label}
                          </label>
                          <span className={`settings-badge settings-badge-${sourceLabel.tone}`}>
                            {sourceLabel.text}
                            {setting.secret && setting.preview ? ` · ${setting.preview}` : ""}
                          </span>
                        </div>

                        <input
                          id={key}
                          type={setting.secret ? "password" : "text"}
                          autoComplete={setting.secret ? "new-password" : "off"}
                          spellCheck={false}
                          value={drafts[key] ?? ""}
                          onChange={(event) => setDraft(key, event.target.value)}
                          disabled={saving || isCleared}
                          placeholder={
                            setting.secret
                              ? setting.configured
                                ? "Enter a new value to replace the saved secret"
                                : "Not configured"
                              : HINTS[key] || ""
                          }
                          className="settings-input"
                        />

                        <div className="settings-field-foot">
                          <p className="settings-hint">{HINTS[key]}</p>
                          {setting.configured && (
                            <label className="settings-check-inline">
                              <input
                                type="checkbox"
                                checked={isCleared}
                                onChange={(event) => setCleared(key, event.target.checked)}
                                disabled={saving}
                              />
                              Clear saved value
                            </label>
                          )}
                        </div>

                        {fieldErrors[key] && <p className="settings-error">{fieldErrors[key]}</p>}
                        {setting.source === "admin_settings" &&
                          formatSettingDate(setting.updatedAt) && (
                            <p className="settings-meta">
                              Updated {formatSettingDate(setting.updatedAt)}
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

          <div className="settings-actions">
            <button type="submit" disabled={saving} className="settings-btn is-primary">
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={saving}
              className="settings-btn"
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
