import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SquareKanban,
} from "lucide-react";
import { useProjectSelection } from "../../context/CrawlContext.jsx";
import { useJiraConnection, useJiraLinks } from "../../hooks/useJira.js";
import {
  createJiraIssue,
  syncJiraIssue,
  unlinkJiraIssue,
  verifyJiraIssue,
} from "../../lib/jiraApi.js";
import { invalidateJiraLinks } from "../../lib/jiraCache.js";
import { SEOX_STATE_LABELS, SEOX_STATE_TONE, findingKey } from "../../lib/jiraFindings.js";

/**
 * Jira state and actions for one SEO finding.
 *
 * Takes a finding descriptor rather than reading the crawl context, so the
 * same component drops into the Speed, WordPress Security and Robots pages
 * without being reimplemented - which is also why the create API accepts a
 * self-describing finding payload instead of an id.
 *
 * When Jira is not connected this renders NOTHING. A user who has never set
 * Jira up should not be able to tell the feature exists from the auditor
 * pages: that is the backward-compatibility requirement expressed as a UI
 * rule, not just a nicety.
 */

const CATEGORY_TONE = {
  new: "border-white/15 bg-white/[0.06] text-white/70",
  indeterminate: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  done: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
};

const quietButton =
  "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50";

function relativeTime(value) {
  if (!value) return "never";
  const ts = new Date(`${String(value).replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(ts)) return "unknown";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export default function JiraIssuePanel({ finding, projectId: projectIdProp }) {
  const { project } = useProjectSelection();
  const projectId = projectIdProp || project?.id || "";

  const { connected, mapping } = useJiraConnection({ enabled: Boolean(projectId) });
  const { lookup, refresh: refreshLinks } = useJiraLinks({ enabled: Boolean(projectId) && connected });

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [summaryOverride, setSummaryOverride] = useState("");

  const descriptor = useMemo(() => {
    if (!finding) return null;
    return {
      sourceModule: finding.sourceModule || "auditor",
      findingType: finding.findingType,
      url: finding.url,
      scopeKind: finding.scope?.kind || (finding.url ? "url" : "site"),
    };
  }, [finding]);

  const link = descriptor ? lookup(descriptor) : null;

  useEffect(() => {
    setError("");
    setNote("");
  }, [descriptor && findingKey(descriptor)]);

  const act = useCallback(
    async (name, fn) => {
      setBusy(name);
      setError("");
      setNote("");
      try {
        return await fn();
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setBusy("");
      }
    },
    []
  );

  async function handleCreate() {
    const result = await act("create", () =>
      createJiraIssue({
        projectId,
        finding,
        overrides: summaryOverride.trim() ? { summary: summaryOverride.trim() } : {},
        useAi,
      })
    );
    if (!result) return;
    setShowCreate(false);
    setSummaryOverride("");
    if (result.alreadyLinked) {
      setNote(
        result.adopted
          ? `An existing Jira issue already covered this finding, so SEOX linked to ${result.link?.jiraIssueKey} instead of creating a duplicate.`
          : `This finding was already linked to ${result.link?.jiraIssueKey}.`
      );
    } else if (result.aiNote) {
      setNote(result.aiNote);
    }
    invalidateJiraLinks(projectId);
    refreshLinks();
  }

  async function handleSync() {
    const result = await act("sync", () => syncJiraIssue({ projectId, linkId: link.id }));
    if (!result) return;
    invalidateJiraLinks(projectId);
    refreshLinks();
  }

  async function handleVerify() {
    const result = await act("verify", () => verifyJiraIssue({ projectId, linkId: link.id }));
    if (!result) return;
    setNote("A re-check has been queued. The result appears here once it runs.");
  }

  async function handleUnlink() {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Detach this finding from its Jira issue? The Jira issue itself is not changed or deleted.")) {
      return;
    }
    const result = await act("unlink", () => unlinkJiraIssue({ projectId, linkId: link.id }));
    if (!result) return;
    invalidateJiraLinks(projectId);
    refreshLinks();
  }

  // Jira is optional: with no connection, no mapping or no finding, this
  // component contributes nothing at all to the page.
  if (!connected || !mapping || !finding || !descriptor?.findingType) return null;

  const failedCreate = link && link.state === "failed";
  const isLinked = link && link.state === "linked";

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <SquareKanban className="h-4 w-4 text-blue-300" />
        <h2 className="font-display text-sm font-bold text-white">Jira</h2>
        {isLinked && (
          <>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                CATEGORY_TONE[link.jiraStatusCategory] || CATEGORY_TONE.new
              }`}
            >
              {link.jiraStatus || "Unknown"}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                SEOX_STATE_TONE[link.seoxState] || SEOX_STATE_TONE.open
              }`}
            >
              {SEOX_STATE_LABELS[link.seoxState] || link.seoxState}
            </span>
          </>
        )}
        <span className="ml-auto text-xs text-white/35">{mapping.jiraProjectKey}</span>
      </div>

      <div className="space-y-3 px-4 py-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {note && (
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{note}</span>
          </div>
        )}

        {/* --- Failed create ------------------------------------------- */}
        {failedCreate && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            <p className="font-semibold">Could not create the Jira issue</p>
            <p className="mt-1 text-rose-200/70">{link.lastError}</p>
            <button type="button" className={`${quietButton} mt-2`} onClick={handleCreate} disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Retry
            </button>
          </div>
        )}

        {/* --- Not linked ---------------------------------------------- */}
        {!isLinked && !failedCreate && !showCreate && (
          <button type="button" className={primaryButton} onClick={() => setShowCreate(true)}>
            <SquareKanban className="h-4 w-4" />
            Create Jira issue
          </button>
        )}

        {!isLinked && showCreate && (
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div>
              <label className="text-xs font-semibold text-white/65" htmlFor="jira-summary">
                Summary
              </label>
              <input
                id="jira-summary"
                className="settings-input mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs outline-none"
                value={summaryOverride}
                onChange={(event) => setSummaryOverride(event.target.value)}
                placeholder={`[SEOX] ${finding.title}`}
              />
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs text-white/50">
              <div>
                <dt className="text-white/35">Issue type</dt>
                <dd>{mapping.defaultIssueTypeName || "Default"}</dd>
              </div>
              <div>
                <dt className="text-white/35">Affected URLs</dt>
                <dd>{finding.affectedUrlCount || 1}</dd>
              </div>
            </dl>

            <label className="flex items-start gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={useAi}
                onChange={(event) => setUseAi(event.target.checked)}
              />
              <span>
                Enhance with AI
                <span className="block text-white/35">
                  Uses your DeepSeek key to draft a root cause, a fix and acceptance criteria. If it
                  is unavailable the standard description is used instead.
                </span>
              </span>
            </label>

            <div className="flex gap-2">
              <button type="button" className={primaryButton} onClick={handleCreate} disabled={busy === "create"}>
                {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquareKanban className="h-4 w-4" />}
                {busy === "create" ? "Creating…" : "Create issue"}
              </button>
              <button type="button" className={quietButton} onClick={() => setShowCreate(false)} disabled={busy === "create"}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* --- Linked --------------------------------------------------- */}
        {isLinked && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-white/35">Issue</dt>
                <dd>
                  <a
                    href={link.jiraUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-300 hover:underline"
                  >
                    {link.jiraIssueKey}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Assignee</dt>
                <dd className="text-white/65">{link.assigneeName || "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-white/35">Priority</dt>
                <dd className="text-white/65">{link.jiraPriority || "—"}</dd>
              </div>
              <div>
                <dt className="text-white/35">Last sync</dt>
                <dd className="text-white/65">{relativeTime(link.lastSyncedAt)}</dd>
              </div>
            </dl>

            {/* Verification is the point of the integration, so its result
                gets its own line rather than being buried in the grid. */}
            <VerificationLine link={link} />

            {link.lastComment && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                <p className="text-white/40">
                  {link.lastComment.authorDisplayName} · {relativeTime(link.lastComment.createdAt)}
                </p>
                {/* Plain text only: third-party comment bodies are never
                    rendered as HTML. */}
                <p className="mt-1 whitespace-pre-line text-white/65">{link.lastComment.bodyText}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={link.jiraUrl} target="_blank" rel="noreferrer" className={quietButton}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Jira
              </a>
              <button type="button" className={quietButton} onClick={handleSync} disabled={busy === "sync"}>
                {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sync now
              </button>
              {link.verificationKind !== "manual" && (
                <button type="button" className={quietButton} onClick={handleVerify} disabled={busy === "verify"}>
                  {busy === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Re-check now
                </button>
              )}
              <button type="button" className={quietButton} onClick={handleUnlink} disabled={busy === "unlink"}>
                <Link2Off className="h-3.5 w-3.5" />
                Unlink
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function VerificationLine({ link }) {
  const { seoxState, verification, verifiedAt, verificationKind } = link;

  if (seoxState === "verified") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {verification?.outcome === "manual"
            ? "Marked fixed in Jira. SEOX has no automatic check for this finding type — re-run the audit to confirm."
            : `SEOX re-checked this on ${relativeTime(verifiedAt)} and the issue is gone.`}
        </span>
      </p>
    );
  }

  if (seoxState === "reopened") {
    const failed = (verification?.checks || []).filter((check) => !check.passed);
    return (
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          SEOX re-checked this and the issue is still present
        </p>
        {failed.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-rose-200/70">
            {failed.slice(0, 4).map((check) => (
              <li key={check.type}>
                Expected {check.expected}; found {check.actual}.
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (seoxState === "resolved_pending") {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        {verification?.outcome === "unavailable"
          ? `Jira says this is done, but SEOX could not reach the page to confirm it (${verification.error}). It will try again.`
          : "Jira says this is done. SEOX will re-check the page shortly and confirm."}
      </p>
    );
  }

  if (verificationKind === "manual") {
    return (
      <p className="text-xs text-white/35">
        SEOX cannot verify this finding type automatically — re-run the audit after the fix.
      </p>
    );
  }

  return null;
}
