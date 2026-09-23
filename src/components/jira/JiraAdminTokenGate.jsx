import { useState } from "react";
import { KeyRound, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { maskAdminToken, setJiraAdminToken } from "../../lib/jiraAdminToken.js";

/**
 * Collects the admin token the Jira ticket APIs require.
 *
 * It exists because those APIs authenticate on `users.admin_token` and
 * deliberately refuse every other credential - session, cookie, Bearer
 * header. Nothing hands the browser one, so the user supplies it, exactly as
 * they already do for the DeepSeek API key and the Jira API token in
 * Settings.
 *
 * The field is type="password" and the saved value is only ever echoed back
 * masked, so a shared screen or a screenshot does not leak it.
 */
export default function JiraAdminTokenGate({ token, onChange, checking = false, error = "" }) {
  const [draft, setDraft] = useState("");
  const saved = Boolean(token);

  function save(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    setJiraAdminToken(value);
    setDraft("");
    onChange(value);
  }

  function clear() {
    setJiraAdminToken("");
    setDraft("");
    onChange("");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-white">Admin token</h2>
          <p className="truncate text-xs text-white/40">
            {saved ? `Saved in this browser (${maskAdminToken(token)})` : "Not set"}
          </p>
        </div>
        {checking && <Loader2 className="ml-auto h-4 w-4 animate-spin text-white/40" />}
      </div>

      <form onSubmit={save} className="space-y-3 px-5 py-4">
        <p className="text-sm leading-relaxed text-white/60">
          The Jira ticket APIs authenticate with your SEOX <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] text-white/80">admin_token</code> and
          accept no other credential — not your session, not a cookie. Paste it once and this
          browser will remember it.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            id="jira-admin-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={saved ? "Enter a new token to replace the saved one" : "Your SEOX admin token"}
            className="settings-input min-w-[260px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-400/50"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save token
          </button>
          {saved && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
            >
              <Trash2 className="h-4 w-4" />
              Forget
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <p className="flex items-start gap-2 text-xs text-white/35">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Stored in this browser only and sent to SEOX&apos;s own <code>/api/jira/*</code> routes
            and nowhere else. No Jira credential ever reaches the browser — SEOX talks to Jira
            server-to-server.
          </span>
        </p>
      </form>
    </div>
  );
}
