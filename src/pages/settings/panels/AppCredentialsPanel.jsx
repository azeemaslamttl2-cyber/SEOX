import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
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
    <div className="max-w-4xl space-y-6 pb-10">
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
        <form onSubmit={onSubmit} className="space-y-5">
          {sections.map((section) => {
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
                          className="settings-input w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none transition"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="settings-hint">{HINTS[key]}</p>
                          {setting.configured && (
                            <label className="flex items-center gap-2 text-[11px] text-white/45">
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

                        {fieldErrors[key] && (
                          <p className="settings-error">{fieldErrors[key]}</p>
                        )}
                        {setting.source === "admin_settings" && formatSettingDate(setting.updatedAt) && (
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
              onClick={reload}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
