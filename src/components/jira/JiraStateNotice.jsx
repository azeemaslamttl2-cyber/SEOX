import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { presentState } from "../../lib/jiraTicketStates.js";

/**
 * One outcome, explained.
 *
 * This component is the fix for the reported bug expressed as a UI rule: a
 * configuration failure and an empty backlog must not look the same. The
 * "empty" tone is quiet and neutral and may say "no tickets"; the "error"
 * tone takes the warning palette, names the specific problem, and links to
 * the screen that fixes it. `presentState` decides which, from the code the
 * server sent.
 *
 * The look is carried by `.jira-*` rules in index.css so it sits on the same
 * token surfaces as the rest of /jira/tickets; the states, the copy and the
 * actions are unchanged.
 */
export default function JiraStateNotice({ state, jira = null, projectName = "", onRetry = null }) {
  if (!state) return null;
  const { tone, Icon, title, detail, action, code } = presentState(state);
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className="jira-notice"
      data-tone={isError ? "error" : "empty"}
    >
      <span className="jira-notice-icon" aria-hidden="true">
        <Icon />
      </span>

      <div className="jira-notice-body">
        {projectName && <p className="jira-notice-project">{projectName}</p>}
        <h2 className="jira-notice-title">{title}</h2>
        <p className="jira-notice-detail">{detail}</p>

        {/* What SEOX actually resolved, so the user can see how far the
            chain got rather than guessing. */}
        {jira && (jira.base_url || jira.project_key) && (
          <dl className="jira-notice-facts">
            {jira.base_url && (
              <div className="jira-notice-fact">
                <dt>Jira site</dt>
                <dd>{jira.base_url.replace(/^https?:\/\//, "")}</dd>
              </div>
            )}
            {jira.project_key && (
              <div className="jira-notice-fact">
                <dt>Jira project</dt>
                <dd className="is-mono">
                  {jira.project_key}
                  {jira.project_name ? ` · ${jira.project_name}` : ""}
                </dd>
              </div>
            )}
            {jira.account_email && (
              <div className="jira-notice-fact">
                <dt>Connected as</dt>
                <dd>{jira.account_email}</dd>
              </div>
            )}
          </dl>
        )}

        {(action || onRetry) && (
          <div className="jira-notice-actions">
            {action && (
              <Link to={action.href} className="jira-notice-cta">
                {action.label}
              </Link>
            )}
            {onRetry && (
              <button type="button" onClick={onRetry} className="jira-notice-retry">
                <RefreshCw />
                Try again
              </button>
            )}
          </div>
        )}

        {/* The machine-readable code, for a support conversation. */}
        {isError && <p className="jira-notice-code">{code}</p>}
      </div>
    </div>
  );
}
