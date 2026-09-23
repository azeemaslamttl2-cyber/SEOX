import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { presentState } from "../../lib/jiraTicketStates.js";

/**
 * One outcome, explained.
 *
 * This component is the fix for the reported bug expressed as a UI rule: a
 * configuration failure and an empty backlog must not look the same. The
 * "empty" tone is quiet and grey and may say "no tickets"; the "error" tone
 * is amber, names the specific problem, and links to the screen that fixes
 * it. `presentState` decides which, from the code the server sent.
 */
export default function JiraStateNotice({ state, jira = null, projectName = "", onRetry = null }) {
  if (!state) return null;
  const { tone, Icon, title, detail, action, code } = presentState(state);
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`rounded-2xl border p-6 backdrop-blur ${
        isError
          ? "border-amber-500/30 bg-amber-500/[0.07]"
          : "border-white/10 bg-ink-800/60"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            isError ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-white/40"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          {projectName && (
            <p className="mb-0.5 truncate text-[11px] font-bold uppercase tracking-wider text-white/35">
              {projectName}
            </p>
          )}
          <h2
            className={`font-display text-base font-bold ${
              isError ? "text-amber-100" : "text-white"
            }`}
          >
            {title}
          </h2>
          <p className={`mt-1 text-sm ${isError ? "text-amber-100/70" : "text-white/45"}`}>
            {detail}
          </p>

          {/* What SEOX actually resolved, so the user can see how far the
              chain got rather than guessing. */}
          {jira && (jira.base_url || jira.project_key) && (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
              {jira.base_url && (
                <div className="flex gap-1.5">
                  <dt className="text-white/30">Jira site:</dt>
                  <dd className="text-white/60">{jira.base_url.replace(/^https?:\/\//, "")}</dd>
                </div>
              )}
              {jira.project_key && (
                <div className="flex gap-1.5">
                  <dt className="text-white/30">Jira project:</dt>
                  <dd className="font-mono text-white/60">
                    {jira.project_key}
                    {jira.project_name ? ` · ${jira.project_name}` : ""}
                  </dd>
                </div>
              )}
              {jira.account_email && (
                <div className="flex gap-1.5">
                  <dt className="text-white/30">Connected as:</dt>
                  <dd className="text-white/60">{jira.account_email}</dd>
                </div>
              )}
            </dl>
          )}

          {(action || onRetry) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {action && (
                <Link
                  to={action.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-400"
                >
                  {action.label}
                </Link>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </button>
              )}
            </div>
          )}

          {/* The machine-readable code, for a support conversation. */}
          {isError && (
            <p className="mt-3 font-mono text-[11px] text-white/25">{code}</p>
          )}
        </div>
      </div>
    </div>
  );
}
