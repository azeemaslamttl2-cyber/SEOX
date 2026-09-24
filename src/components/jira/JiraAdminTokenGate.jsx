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
 *
 * Styling lives in the `.jira-gate-*` rules in index.css, alongside the rest
 * of /jira/tickets. Behaviour here is untouched.
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
    <div className="jira-gate">
      <div className="jira-gate-head">
        <span className="jira-gate-icon" aria-hidden="true">
          <KeyRound />
        </span>
        <div className="min-w-0">
          <h2 className="jira-gate-title">Admin token</h2>
          <p className="jira-gate-status">
            {saved ? `Saved in this browser (${maskAdminToken(token)})` : "Not set"}
          </p>
        </div>
        {checking && <Loader2 className="jira-gate-spinner animate-spin" aria-hidden="true" />}
      </div>

      <form onSubmit={save} className="jira-gate-form">
        <p className="jira-gate-lede">
          The Jira ticket APIs authenticate with your SEOX{" "}
          <code className="jira-gate-code">admin_token</code> and accept no other credential — not
          your session, not a cookie. Paste it once and this browser will remember it.
        </p>

        <div className="jira-gate-row">
          <input
            id="jira-admin-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={saved ? "Enter a new token to replace the saved one" : "Your SEOX admin token"}
            className="jira-gate-input"
          />
          <button type="submit" disabled={!draft.trim()} className="jira-gate-save">
            <Save />
            Save token
          </button>
          {saved && (
            <button type="button" onClick={clear} className="jira-gate-forget">
              <Trash2 />
              Forget
            </button>
          )}
        </div>

        {error && <p className="jira-gate-error">{error}</p>}

        <p className="jira-gate-note">
          <ShieldCheck aria-hidden="true" />
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
