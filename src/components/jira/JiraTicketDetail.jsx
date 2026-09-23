import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { fetchJiraTransitions, updateJiraTicketStatus } from "../../lib/jiraTicketsApi.js";
import {
  CATEGORY_LABELS,
  CATEGORY_TONE,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  formatDate,
  relativeTime,
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
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-white/35">{label}</dt>
      <dd className="mt-1 break-words text-sm text-white/80">{children}</dd>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <header className="mb-3">
        <h3 className="font-display text-sm font-bold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
      </header>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
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
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-white/10 bg-ink-900 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={`Jira ticket ${issueKey}`}
    >
      <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-brand-300">{issueKey}</span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                CATEGORY_TONE[category] || CATEGORY_TONE.new
              }`}
            >
              {ticket.status?.name || CATEGORY_LABELS[category] || "Unknown"}
            </span>
            {ticket.severity && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  SEVERITY_TONE[ticket.severity] || SEVERITY_TONE.notice
                }`}
              >
                {SEVERITY_LABELS[ticket.severity] || ticket.severity}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 font-display text-base font-bold leading-snug text-white">
            {ticket.summary}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {note && (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{note}</span>
          </p>
        )}
        {actionError && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{actionError}</span>
          </p>
        )}

        {/* --- Actions ------------------------------------------------- */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <header className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-white">Update in Jira</h3>
              <p className="text-xs text-white/40">
                Only the transitions this issue&apos;s workflow actually offers right now. The
                review is posted to Jira as a comment.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadTransitions()}
                disabled={loadingTransitions}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTransitions ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {ticket.url && (
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Jira
                </a>
              )}
            </div>
          </header>

          {loadingTransitions && !transitions.length ? (
            <p className="flex items-center gap-2 text-sm text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the workflow from Jira…
            </p>
          ) : (
            <>
              {/* Jira being unreachable, or offering no step from this status,
                  does not stop a review: commenting is a separate right on a
                  separate Jira endpoint. So these are notices above the form,
                  never a replacement for it. */}
              {transitionError && (
                <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
                  {transitionError}
                </p>
              )}
              {!transitionError && transitions.length === 0 && (
                <p className="mb-3 text-sm text-white/45">
                  Jira offers no transitions on this issue for the connected account. You can
                  still leave a review.
                </p>
              )}

              <form onSubmit={submitUpdate} className="space-y-3">
                <div>
                  <label
                    htmlFor="jira-transition"
                    className="text-[11px] font-bold uppercase tracking-wider text-white/35"
                  >
                    Status
                  </label>
                  <select
                    id="jira-transition"
                    value={transitionId}
                    onChange={(event) => setTransitionId(event.target.value)}
                    disabled={busy || transitions.length === 0}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none transition focus:border-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <p className="mt-1.5 text-xs text-amber-200/80">
                      This transition has a Jira screen. If any of its fields are required, Jira
                      may refuse it.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="jira-review"
                    className="text-[11px] font-bold uppercase tracking-wider text-white/35"
                  >
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
                    className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none transition placeholder:text-white/25 focus:border-brand-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-white/35">
                    Posted to Jira by SEOX using the connected Jira account, so everyone watching
                    the ticket sees it.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={busy || !canSubmit}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Update Ticket
                  </button>
                  {!canSubmit && (
                    <span className="text-xs text-white/35">
                      Choose a status, write a review, or both.
                    </span>
                  )}
                </div>
              </form>
            </>
          )}

          <p className="mt-3 text-xs text-white/35">
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
              <span className="break-all font-mono text-xs">{ticket.seox.fingerprint}</span>
            </Field>
            <Field label="Affected URL" wide>
              {ticket.seox.affected_url ? (
                <a
                  href={ticket.seox.affected_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-brand-300 hover:underline"
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
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="font-display text-sm font-bold text-white">No SEOX finding</h3>
            <p className="mt-1 text-xs text-white/45">
              This ticket was raised in Jira rather than filed by SEOX, so there is no SEO
              finding attached to it. It can still be transitioned from here.
            </p>
          </section>
        )}

        {/* --- Jira ---------------------------------------------------- */}
        <Section title="Jira issue" subtitle="What the team is doing about it">
          <Field label="Issue key">
            <span className="font-mono">{ticket.key}</span>
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
                className="text-brand-300 hover:underline"
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
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                {ticket.description}
              </p>
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
                className="break-all text-brand-300 hover:underline"
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
            subtitle={
              ticket.commentCount > ticket.comments.length
                ? `Showing the latest ${ticket.comments.length} of ${ticket.commentCount}`
                : `${ticket.commentCount} on this issue`
            }
          >
            <div className="sm:col-span-2 space-y-3">
              {ticket.comments.map((comment) => (
                <article
                  key={comment.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <header className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="font-semibold text-white/75">
                      {comment.author?.displayName || "Unknown"}
                    </span>
                    <span className="text-white/35">{formatDate(comment.created)}</span>
                    {comment.url && (
                      <a
                        href={comment.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ml-auto text-brand-300 hover:underline"
                      >
                        Open in Jira
                      </a>
                    )}
                  </header>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                    {comment.body}
                  </p>
                </article>
              ))}
            </div>
          </Section>
        )}

        {/* --- Attachments --------------------------------------------- */}
        {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
          <Section title="Attachments" subtitle={`${ticket.attachments.length} file(s)`}>
            <ul className="sm:col-span-2 space-y-2">
              {ticket.attachments.map((attachment) => (
                <li key={attachment.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  {/* The download URL is Jira's own and needs a Jira session.
                      SEOX does not proxy it, because proxying would mean
                      spending the stored credential on serving a file to a
                      browser that was never authenticated against Jira. */}
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-brand-300 hover:underline"
                  >
                    {attachment.filename}
                  </a>
                  <span className="text-white/35">
                    {attachment.size ? `${Math.ceil(attachment.size / 1024)} KB` : ""}
                  </span>
                  <span className="text-white/35">{formatDate(attachment.created)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </aside>
  );
}
