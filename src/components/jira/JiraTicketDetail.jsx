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
 * per ticket.
 */

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
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [note, setNote] = useState("");

  const issueKey = ticket?.jira_issue_key || "";
  const projectId = ticket?.project_id || "";

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
    loadTransitions(controller.signal);
    return () => controller.abort();
  }, [loadTransitions]);

  async function runTransition(transition) {
    setBusyId(transition.id);
    setActionError("");
    setNote("");
    try {
      const result = await updateJiraTicketStatus({
        issueKey,
        projectId,
        transitionId: transition.id,
      });
      const data = result?.data || {};
      setNote(
        `${data.jira_issue_key} moved from "${data.previous_status || "unknown"}" to "${
          data.new_status || transition.to_status
        }" in Jira.` +
          (data.awaiting_verification
            ? " SEOX has queued a re-check of the affected URL; the finding stays awaiting verification until that confirms it."
            : "")
      );
      onUpdated?.(data);
      await loadTransitions();
    } catch (error) {
      const available = error?.payload?.data?.available_transitions;
      if (Array.isArray(available)) setTransitions(available);
      setActionError(error.message);
    } finally {
      setBusyId("");
    }
  }

  if (!ticket) return null;

  const category = String(ticket.jira_status_category || "").toLowerCase();

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
              {ticket.jira_status || CATEGORY_LABELS[category] || "Unknown"}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                SEVERITY_TONE[ticket.severity] || SEVERITY_TONE.notice
              }`}
            >
              {SEVERITY_LABELS[ticket.severity] || ticket.severity}
            </span>
          </div>
          <h2 className="mt-1.5 font-display text-base font-bold leading-snug text-white">
            {ticket.title}
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
                Only the transitions this issue&apos;s workflow actually offers right now.
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
              {ticket.jira_issue_url && (
                <a
                  href={ticket.jira_issue_url}
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
          ) : transitionError ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
              {transitionError}
            </p>
          ) : transitions.length === 0 ? (
            <p className="text-sm text-white/45">
              Jira offers no transitions on this issue for the connected account.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((transition) => {
                const toCategory = String(transition.to_status_category || "").toLowerCase();
                const isDone = toCategory === "done";
                return (
                  <button
                    key={transition.id}
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => runTransition(transition)}
                    title={
                      transition.has_screen
                        ? "This transition has a Jira screen; required fields may make Jira reject it."
                        : `Move to ${transition.to_status}`
                    }
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDone
                        ? "bg-brand-500 text-white hover:bg-brand-400"
                        : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                    }`}
                  >
                    {busyId === transition.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : null}
                    {transition.name}
                    {transition.to_status && transition.to_status !== transition.name && (
                      <span className="text-[11px] font-medium opacity-60">
                        → {transition.to_status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-xs text-white/35">
            Resolving the Jira ticket does not mark the SEO issue fixed. SEOX re-checks the
            affected URL and only then records the finding as verified — or reopens it.
          </p>
        </section>

        {/* --- SEOX ---------------------------------------------------- */}
        <Section title="SEOX finding" subtitle="What SEOX measured">
          <Field label="Project">{ticket.project_name}</Field>
          <Field label="Project URL">{ticket.project_url}</Field>
          <Field label="Finding ID">
            <span className="break-all font-mono text-xs">{ticket.finding_id}</span>
          </Field>
          <Field label="Fingerprint">
            <span className="break-all font-mono text-xs">{ticket.fingerprint}</span>
          </Field>
          <Field label="Issue type">{ticket.issue_type}</Field>
          <Field label="Category">{ticket.category}</Field>
          <Field label="SEO severity">{SEVERITY_LABELS[ticket.severity] || ticket.severity}</Field>
          <Field label="Source module">{ticket.source_label || ticket.source_module}</Field>
          <Field label="SEOX state">{ticket.seox_state_label || ticket.status}</Field>
          <Field label="First detected">{formatDate(ticket.detected_at)}</Field>
          <Field label="Last detected">{formatDate(ticket.last_detected_at)}</Field>
          <Field label="Affected URL" wide>
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
          <Field label="Current value" wide>
            {ticket.current_value}
          </Field>
          <Field label="Expected value" wide>
            {ticket.expected_value}
          </Field>
          <Field label="Description" wide>
            {ticket.description}
          </Field>
          <Field label="Recommendation" wide>
            {ticket.recommendation}
          </Field>
          <Field label="Suggested fix" wide>
            {ticket.suggested_fix && ticket.suggested_fix !== ticket.recommendation
              ? ticket.suggested_fix
              : ""}
          </Field>
        </Section>

        {/* --- Jira ---------------------------------------------------- */}
        <Section title="Jira issue" subtitle="What the team is doing about it">
          <Field label="Issue key">
            <span className="font-mono">{ticket.jira_issue_key}</span>
          </Field>
          <Field label="Jira project">{ticket.jira_project_key}</Field>
          <Field label="Status">{ticket.jira_status}</Field>
          <Field label="Status category">
            {CATEGORY_LABELS[category] || ticket.jira_status_category}
          </Field>
          <Field label="Resolution">{ticket.jira_resolution}</Field>
          <Field label="Priority">{ticket.jira_priority}</Field>
          <Field label="Assignee">{ticket.jira_assignee || "Unassigned"}</Field>
          <Field label="Last synchronisation">
            {ticket.jira_synced_at ? `${relativeTime(ticket.jira_synced_at)} (${formatDate(ticket.jira_synced_at)})` : ""}
          </Field>
          <Field label="Issue URL" wide>
            {ticket.jira_issue_url ? (
              <a
                href={ticket.jira_issue_url}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-brand-300 hover:underline"
              >
                {ticket.jira_issue_url}
              </a>
            ) : (
              ""
            )}
          </Field>
        </Section>
      </div>
    </aside>
  );
}
