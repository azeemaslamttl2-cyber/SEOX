import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  X,
} from "lucide-react";
import { fetchJiraTransitions, updateJiraTicketStatus } from "../../lib/jiraTicketsApi.js";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  avatarTint,
  categoryTone,
  formatDate,
  initialsOf,
  relativeTime,
  severityTone,
} from "../../lib/jiraTickets.js";

/**
 * One ticket, in full, with the actions that change it.
 *
 * The two halves are kept visually apart because they are different claims:
 * the SEOX block is what SEOX measured, the Jira block is what the team did
 * about it. Collapsing them would suggest closing the ticket fixed the SEO
 * problem, which is exactly the inference this integration refuses to make.
 *
 * Transitions are fetched when the panel opens, not when the list renders:
 * they are per-issue and per-current-status, so there is no correct way to
 * get them in bulk, and asking for every visible row would be one Jira call
 * per ticket. NOTHING in the dropdown is hardcoded - every option comes from
 * the transitions Jira reports for THIS issue in its CURRENT status, which is
 * why the list can differ between two tickets on the same board.
 *
 * The status and the review are one form and one request, because they are
 * one intention: "I moved this, and here is why." Two buttons would let the
 * second half be forgotten.
 *
 * The look is carried by the `.jira-drawer-*` rules in index.css, on the same
 * token surfaces as the list behind it. The actions panel comes FIRST because
 * it is why the panel was opened; the read-only detail follows it.
 */

// Matches MAX_REVIEW_LENGTH on the server. Enforced here only so the textarea
// stops rather than letting the user write 40,000 characters and then be told
// no; the server's check is the one that counts.
const MAX_REVIEW_LENGTH = 32000;

function Field({ label, children, wide = false }) {
  if (children === null || children === undefined || children === "" || children === "—") {
    return null;
  }
  return (
    <div className={`jira-detail-field${wide ? " is-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * One panel of the drawer.
 *
 * `plain` swaps the definition grid for a plain block. Comments and
 * attachments are lists, not term/description pairs, and wrapping a <ul> in a
 * <dl> to borrow its column span was invalid markup for a layout reason.
 */
function Section({ title, subtitle, icon: Icon = null, badge = "", plain = false, children }) {
  return (
    <section className="jira-panel">
      <header className="jira-panel-head">
        <div className="jira-panel-heading">
          <h3>
            {Icon && <Icon className="jira-panel-icon" aria-hidden="true" />}
            {title}
            {badge && <span className="jira-panel-badge">{badge}</span>}
          </h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      {plain ? <div>{children}</div> : <dl className="jira-detail-grid">{children}</dl>}
    </section>
  );
}

export default function JiraTicketDetail({ ticket, onClose, onUpdated }) {
  const [transitions, setTransitions] = useState([]);
  const [loadingTransitions, setLoadingTransitions] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [note, setNote] = useState("");
  const [transitionId, setTransitionId] = useState("");
  const [review, setReview] = useState("");

  const issueKey = ticket?.key || "";
  // Only sent when the ticket really belongs to a SEOX project. In Jira
  // project mode there is none, and the status endpoint authorises on the
  // issue key against the user's Jira project mappings instead.
  const projectId = ticket?.seox?.seox_project_id || "";

  const loadTransitions = useCallback(
    async (signal) => {
      if (!issueKey) return;
      setLoadingTransitions(true);
      setTransitionError("");
      try {
        const result = await fetchJiraTransitions({ issueKey, projectId, signal });
        setTransitions(Array.isArray(result?.data?.transitions) ? result.data.transitions : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        // Jira being unreachable must not empty the panel - everything above
        // this point came from SEOX's own store and is still true.
        setTransitionError(error.message);
        setTransitions([]);
      } finally {
        setLoadingTransitions(false);
      }
    },
    [issueKey, projectId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setNote("");
    setActionError("");
    setTransitionId("");
    setReview("");
    loadTransitions(controller.signal);
    return () => controller.abort();
  }, [loadTransitions]);

  /** What actually happened, in the order it happened. */
  function describeOutcome({ statusUpdated, commentAdded }, data, transition) {
    const parts = [];
    if (statusUpdated) {
      parts.push(
        `${data.jira_issue_key} moved from "${data.previous_status || "unknown"}" to "${
          data.new_status || transition?.to_status || "its new status"
        }" in Jira.`
      );
    }
    if (commentAdded) {
      parts.push("Your review was added to the ticket's comments in Jira.");
    }
    if (data.awaiting_verification) {
      parts.push(
        "SEOX has queued a re-check of the affected URL; the finding stays awaiting verification until that confirms it."
      );
    }
    return parts.join(" ");
  }

  async function submitUpdate(event) {
    event.preventDefault();
    const transition = transitions.find((item) => item.id === transitionId) || null;
    if (!transition && !review.trim()) return;

    setBusy(true);
    setActionError("");
    setNote("");
    try {
      const result = await updateJiraTicketStatus({
        issueKey,
        projectId,
        transitionId: transition?.id || "",
        review,
      });
      const data = result?.data || {};
      setTransitionId("");
      setReview("");
      setNote(describeOutcome(result, data, transition));
      onUpdated?.(data);
      await loadTransitions();
    } catch (error) {
      const payload = error?.payload;
      const available = payload?.data?.available_transitions;
      if (Array.isArray(available)) setTransitions(available);

      // THE PARTIAL CASE. The server reports `success: false` when the ticket
      // moved but the review did not land, and the client treats that as an
      // error - correctly, because it is not a success. But it is not a
      // nothing either: Jira HAS moved, and showing only the red message
      // would invite the user to press Update again and move it twice.
      //
      // So both halves are shown, the status change is pushed to the list,
      // and the review is deliberately LEFT IN THE BOX with the dropdown
      // cleared, so pressing Update again retries the comment alone.
      if (payload?.statusUpdated) {
        setTransitionId("");
        setNote(describeOutcome(payload, payload.data || {}, transition));
        onUpdated?.(payload.data || {});
        await loadTransitions();
      }
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ticket) return null;

  const category = String(ticket.status?.category || "").toLowerCase();
  const selectedTransition = transitions.find((item) => item.id === transitionId) || null;
  const canSubmit = Boolean(selectedTransition) || Boolean(review.trim());

  return (
    <aside
      className="jira-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={`Jira ticket ${issueKey}`}
    >
      <header className="jira-drawer-head">
        <div className="jira-drawer-head-main">
          <div className="jira-drawer-tags">
            <span className="jira-key">{issueKey}</span>
            <span className="jira-pill" data-tone={categoryTone(category)}>
              {ticket.status?.name || CATEGORY_LABELS[category] || "Unknown"}
            </span>
            {ticket.severity && (
              <span className="jira-pill" data-tone={severityTone(ticket.severity)}>
                {SEVERITY_LABELS[ticket.severity] || ticket.severity}
              </span>
            )}
          </div>
          <h2 className="jira-drawer-title">{ticket.summary}</h2>
        </div>
        <button type="button" onClick={onClose} className="jira-drawer-close" aria-label="Close">
          <X />
        </button>
      </header>

      <div className="jira-drawer-body">
        {note && (
          <p className="jira-banner" data-tone="success">
            <CheckCircle2 aria-hidden="true" />
            <span>{note}</span>
          </p>
        )}
        {actionError && (
          <p className="jira-banner" data-tone="error">
            <AlertTriangle aria-hidden="true" />
            <span>{actionError}</span>
          </p>
        )}

        {/* --- Actions ------------------------------------------------- */}
        <section className="jira-panel jira-panel-action">
          <header className="jira-panel-head">
            <div className="jira-panel-heading">
              <h3>Update in Jira</h3>
              <p>
                Only the transitions this issue&apos;s workflow actually offers right now. The
                review is posted to Jira as a comment.
              </p>
            </div>
            <div className="jira-panel-actions">
              <button
                type="button"
                onClick={() => loadTransitions()}
                disabled={loadingTransitions}
                className="jira-action"
              >
                <RefreshCw className={loadingTransitions ? "animate-spin" : ""} />
                Refresh
              </button>
              {ticket.url && (
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="jira-action"
                >
                  <ExternalLink />
                  Open in Jira
                </a>
              )}
            </div>
          </header>

          {loadingTransitions && !transitions.length ? (
            <p className="jira-drawer-loading">
              <Loader2 className="animate-spin" aria-hidden="true" />
              Reading the workflow from Jira…
            </p>
          ) : (
            <>
              {/* Jira being unreachable, or offering no step from this status,
                  does not stop a review: commenting is a separate right on a
                  separate Jira endpoint. So these are notices above the form,
                  never a replacement for it. */}
              {transitionError && (
                <p className="jira-banner" data-tone="warning">
                  <AlertTriangle aria-hidden="true" />
                  <span>{transitionError}</span>
                </p>
              )}
              {!transitionError && transitions.length === 0 && (
                <p className="jira-drawer-hint">
                  Jira offers no transitions on this issue for the connected account. You can
                  still leave a review.
                </p>
              )}

              <form onSubmit={submitUpdate} className="jira-form">
                <div className="jira-form-row">
                  <label htmlFor="jira-transition" className="jira-form-label">
                    Status
                  </label>
                  <select
                    id="jira-transition"
                    value={transitionId}
                    onChange={(event) => setTransitionId(event.target.value)}
                    disabled={busy || transitions.length === 0}
                    className="jira-form-select"
                  >
                    {/* Leaving the status alone is a deliberate choice, not an
                        oversight - it is how a review is posted on its own. */}
                    <option value="">Leave the status unchanged</option>
                    {transitions.map((transition) => (
                      <option key={transition.id} value={transition.id}>
                        {transition.to_status && transition.to_status !== transition.name
                          ? `${transition.name} → ${transition.to_status}`
                          : transition.name}
                      </option>
                    ))}
                  </select>
                  {selectedTransition?.has_screen && (
                    <p className="jira-form-warning">
                      This transition has a Jira screen. If any of its fields are required, Jira
                      may refuse it.
                    </p>
                  )}
                </div>

                <div className="jira-form-row">
                  <label htmlFor="jira-review" className="jira-form-label">
                    Review / comment
                  </label>
                  <textarea
                    id="jira-review"
                    rows={4}
                    value={review}
                    maxLength={MAX_REVIEW_LENGTH}
                    disabled={busy}
                    onChange={(event) => setReview(event.target.value)}
                    placeholder="Optional. Added to this ticket's comments in Jira."
                    className="jira-form-textarea"
                  />
                  <p className="jira-form-hint">
                    Posted to Jira by SEOX using the connected Jira account, so everyone watching
                    the ticket sees it.
                  </p>
                </div>

                <div className="jira-form-submit">
                  <button type="submit" disabled={busy || !canSubmit} className="jira-submit">
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" />
                    )}
                    Update Ticket
                  </button>
                  {!canSubmit && (
                    <span className="jira-form-hint">Choose a status, write a review, or both.</span>
                  )}
                </div>
              </form>
            </>
          )}

          {/* The boundary this whole integration exists to keep. It reads as a
              rule rather than a footnote, because it is one. */}
          <p className="jira-drawer-rule">
            Resolving the Jira ticket does not mark the SEO issue fixed. SEOX re-checks the
            affected URL and only then records the finding as verified — or reopens it.
          </p>
        </section>

        {/* --- SEOX ---------------------------------------------------- */}
        {ticket.seox ? (
          <Section title="SEOX finding" subtitle="The SEO problem that produced this ticket">
            <Field label="Finding">{ticket.seox.finding_title}</Field>
            <Field label="Issue type">{ticket.seox.finding_type}</Field>
            <Field label="SEO severity">
              {SEVERITY_LABELS[ticket.seox.severity] || ticket.seox.severity}
            </Field>
            <Field label="Source module">{ticket.seox.source_module}</Field>
            <Field label="SEOX state">{ticket.seox.seox_state_label}</Field>
            <Field label="Reopened">
              {ticket.seox.reopened_count ? `${ticket.seox.reopened_count} time(s)` : ""}
            </Field>
            <Field label="Verified">{formatDate(ticket.seox.verified_at)}</Field>
            <Field label="Last synchronisation">
              {ticket.seox.last_synced_at ? relativeTime(ticket.seox.last_synced_at) : ""}
            </Field>
            <Field label="Fingerprint">
              <span className="jira-detail-mono">{ticket.seox.fingerprint}</span>
            </Field>
            <Field label="Affected URL" wide>
              {ticket.seox.affected_url ? (
                <a
                  href={ticket.seox.affected_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="jira-detail-link"
                >
                  {ticket.seox.affected_url}
                </a>
              ) : (
                ""
              )}
            </Field>
            <Field label="Current value" wide>
              {ticket.seox.current_value}
            </Field>
            <Field label="Expected value" wide>
              {ticket.seox.expected_value}
            </Field>
          </Section>
        ) : (
          /* Most tickets on a real board were raised by hand. Saying so is
             better than an empty "SEOX finding" panel that looks broken. */
          <section className="jira-panel jira-panel-empty">
            <h3>No SEOX finding</h3>
            <p>
              This ticket was raised in Jira rather than filed by SEOX, so there is no SEO
              finding attached to it. It can still be transitioned from here.
            </p>
          </section>
        )}

        {/* --- Jira ---------------------------------------------------- */}
        <Section title="Jira issue" subtitle="What the team is doing about it">
          <Field label="Issue key">
            <span className="jira-detail-mono">{ticket.key}</span>
          </Field>
          <Field label="Jira project">{ticket.project?.name || ticket.jiraProjectKey}</Field>
          <Field label="Issue type">{ticket.issueType?.name}</Field>
          <Field label="Status">{ticket.status?.name}</Field>
          <Field label="Status category">
            {CATEGORY_LABELS[category] || ticket.status?.category}
          </Field>
          <Field label="Resolution">{ticket.resolution?.name}</Field>
          <Field label="Priority">{ticket.priority?.name}</Field>
          <Field label="Assignee">{ticket.assignee?.displayName || "Unassigned"}</Field>
          <Field label="Reporter">{ticket.reporter?.displayName}</Field>
          <Field label="Creator">{ticket.creator?.displayName}</Field>
          <Field label="Labels">
            {Array.isArray(ticket.labels) && ticket.labels.length
              ? ticket.labels.join(", ")
              : ""}
          </Field>
          <Field label="Components">
            {Array.isArray(ticket.components) && ticket.components.length
              ? ticket.components.map((component) => component.name).join(", ")
              : ""}
          </Field>
          <Field label="Fix versions">
            {Array.isArray(ticket.fixVersions) && ticket.fixVersions.length
              ? ticket.fixVersions.map((version) => version.name).join(", ")
              : ""}
          </Field>
          {/* Sprint and story points exist only on a Jira site that has those
              custom fields, and the server discovers their ids per site
              rather than assuming them. Absent is normal, not an error. */}
          <Field label="Sprint">
            {Array.isArray(ticket.sprints) && ticket.sprints.length
              ? ticket.sprints
                  .filter((sprint) => sprint.state !== "closed")
                  .concat(ticket.sprints.slice(-1))
                  .slice(0, 1)
                  .map((sprint) => `${sprint.name}${sprint.state ? ` (${sprint.state})` : ""}`)
                  .join("")
              : ""}
          </Field>
          <Field label="Story points">
            {ticket.storyPoints === null || ticket.storyPoints === undefined
              ? ""
              : String(ticket.storyPoints)}
          </Field>
          <Field label="Parent">
            {ticket.parent ? (
              <a
                href={ticket.parent.url}
                target="_blank"
                rel="noreferrer noopener"
                className="jira-detail-link"
              >
                {ticket.parent.key} {ticket.parent.summary}
              </a>
            ) : (
              ""
            )}
          </Field>
          <Field label="Created">{formatDate(ticket.created)}</Field>
          <Field label="Updated">{formatDate(ticket.updated)}</Field>
          <Field label="Due date">{ticket.dueDate || ""}</Field>
          <Field label="Description" wide>
            {ticket.description ? (
              /* Jira returns ADF, which the server flattens to text. Rendered
                 with whitespace preserved so paragraphs and lists survive. */
              <p className="jira-detail-prose">{ticket.description}</p>
            ) : (
              ""
            )}
          </Field>
          <Field label="Issue URL" wide>
            {ticket.url ? (
              <a
                href={ticket.url}
                target="_blank"
                rel="noreferrer noopener"
                className="jira-detail-link"
              >
                {ticket.url}
              </a>
            ) : (
              ""
            )}
          </Field>
        </Section>

        {/* --- Comments ------------------------------------------------ */}
        {Array.isArray(ticket.comments) && ticket.comments.length > 0 && (
          <Section
            title="Comments"
            icon={MessageSquare}
            plain
            badge={String(ticket.commentCount ?? ticket.comments.length)}
            subtitle={
              ticket.commentCount > ticket.comments.length
                ? `Showing the latest ${ticket.comments.length} of ${ticket.commentCount}`
                : `${ticket.commentCount} on this issue`
            }
          >
            <div className="jira-comments">
              {ticket.comments.map((comment) => {
                const author = comment.author?.displayName || "Unknown";
                return (
                  <article key={comment.id} className="jira-comment">
                    <span
                      className="jira-avatar"
                      data-tint={avatarTint(author)}
                      aria-hidden="true"
                    >
                      {initialsOf(author)}
                    </span>
                    <div className="jira-comment-body">
                      <header className="jira-comment-head">
                        <span className="jira-comment-author">{author}</span>
                        <span className="jira-comment-date">{formatDate(comment.created)}</span>
                        {comment.url && (
                          <a
                            href={comment.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="jira-comment-link"
                          >
                            Open in Jira
                          </a>
                        )}
                      </header>
                      <p className="jira-comment-text">{comment.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>
        )}

        {/* --- Attachments --------------------------------------------- */}
        {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
          <Section
            title="Attachments"
            icon={Paperclip}
            plain
            badge={String(ticket.attachments.length)}
            subtitle={`${ticket.attachments.length} file(s)`}
          >
            <ul className="jira-attachments">
              {ticket.attachments.map((attachment) => (
                <li key={attachment.id} className="jira-attachment">
                  {/* The download URL is Jira's own and needs a Jira session.
                      SEOX does not proxy it, because proxying would mean
                      spending the stored credential on serving a file to a
                      browser that was never authenticated against Jira. */}
                  <Paperclip className="jira-attachment-icon" aria-hidden="true" />
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="jira-attachment-name"
                  >
                    {attachment.filename}
                  </a>
                  <span className="jira-attachment-meta">
                    {attachment.size ? `${Math.ceil(attachment.size / 1024)} KB` : ""}
                  </span>
                  <span className="jira-attachment-meta">{formatDate(attachment.created)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </aside>
  );
}
