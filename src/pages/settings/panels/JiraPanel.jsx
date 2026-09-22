import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  SquareKanban,
  Unplug,
  Webhook,
} from "lucide-react";
import { useProjectSelection } from "../../../context/CrawlContext.jsx";
import {
  connectJira,
  disconnectJira,
  getJiraActivity,
  listJiraAssignable,
  listJiraComponents,
  listJiraIssueTypes,
  listJiraPriorities,
  listJiraProjects,
  regenerateJiraWebhookSecret,
  retryJiraJob,
  saveJiraMapping,
  testJiraConnection,
} from "../../../lib/jiraApi.js";
import { invalidateJira } from "../../../lib/jiraCache.js";
import { useJiraConnection } from "../../../hooks/useJira.js";

/**
 * Jira panel, shown by the Settings page under the "Jira" tab.
 *
 * Structurally identical to the Stripe and DeepSeek panels: a `panel` tab
 * with its own API and its own storage, rather than an `admin_settings`
 * credential section - Jira is per user AND per project, because an agency
 * may point each client project at a different Jira.
 *
 * The API token is write-only. It is sent once on connect and never comes
 * back, so the field is always empty on load and an empty field means
 * "leave the saved token alone" - the same rule the admin_settings secrets
 * follow.
 */

const SEVERITIES = [
  { key: "error", label: "Error" },
  { key: "warning", label: "Warning" },
  { key: "notice", label: "Notice" },
];

const REOPEN_OPTIONS = [
  { value: "reopen", label: "Reopen the Jira issue", hint: "Falls back to a comment when the workflow has no reopen transition." },
  { value: "comment", label: "Comment only", hint: "Leaves the issue closed and adds a note." },
  { value: "none", label: "Do nothing in Jira", hint: "SEOX still shows the finding as reopened." },
];

const card = "overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]";
const cardHeader = "flex items-center gap-3 border-b border-white/10 px-5 py-4";
const input =
  "settings-input w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none transition";
const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50";
const quietButton =
  "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50";
const label = "block text-sm font-semibold text-white/75";

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

function Banner({ tone, children }) {
  const tones = {
    error: "border-red-400/20 bg-red-500/10 text-red-200",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : AlertCircle;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function JiraPanel() {
  const { project } = useProjectSelection();
  const projectId = project?.id || "";
  const { connected, serverConfigured, status, mapping, counts, health, webhook, isLoading, refresh } =
    useJiraConnection({ enabled: Boolean(projectId) });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");

  // Connect form
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");

  // Webhook URL is returned in full exactly twice: on connect and on
  // regenerate. It is held in component state only, never refetched.
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testResult, setTestResult] = useState(null);

  // Mapping form
  const [form, setForm] = useState(null);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [components, setComponents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [deadJobs, setDeadJobs] = useState([]);

  const flash = useCallback((kind, message) => {
    if (kind === "error") {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }
  }, []);

  // Seed the mapping form from whatever is saved.
  useEffect(() => {
    if (!connected) {
      setForm(null);
      return;
    }
    setForm((current) => {
      if (current) return current;
      return {
        jiraProjectId: mapping?.jiraProjectId || "",
        defaultIssueTypeId: mapping?.defaultIssueTypeId || "",
        defaultPriorityId: mapping?.defaultPriorityId || "",
        defaultAssigneeAccountId: mapping?.defaultAssigneeAccountId || "",
        defaultLabels: (mapping?.defaultLabels || ["seox"]).join(", "),
        components: mapping?.components || [],
        severityPriorityMap: mapping?.severityPriorityMap || {},
        autoCreateEnabled: Boolean(mapping?.autoCreateEnabled),
        autoSyncEnabled: mapping?.autoSyncEnabled !== false,
        postVerificationComments: mapping?.postVerificationComments !== false,
        reopenBehaviour: mapping?.reopenBehaviour || "reopen",
        onDuplicate: mapping?.onDuplicate || "adopt",
        verificationDelayMinutes: mapping?.verificationDelayMinutes ?? 10,
      };
    });
  }, [connected, mapping]);

  // Jira metadata, loaded once the connection exists.
  useEffect(() => {
    if (!connected || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const [projectsPayload, prioritiesPayload] = await Promise.all([
          listJiraProjects(projectId),
          listJiraPriorities(projectId).catch(() => ({ priorities: [] })),
        ]);
        if (cancelled) return;
        setJiraProjects(projectsPayload.projects || []);
        setPriorities(prioritiesPayload.priorities || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, projectId]);

  // Issue types, components and assignees are per Jira project, so they are
  // refetched whenever the selected Jira project changes. An issue type id
  // valid in one project is often invalid in another.
  const selectedJiraProject = useMemo(
    () => jiraProjects.find((entry) => entry.id === form?.jiraProjectId) || null,
    [jiraProjects, form?.jiraProjectId]
  );

  useEffect(() => {
    if (!connected || !projectId || !form?.jiraProjectId) {
      setIssueTypes([]);
      setComponents([]);
      setAssignees([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [types, comps] = await Promise.all([
          listJiraIssueTypes(projectId, form.jiraProjectId),
          listJiraComponents(projectId, form.jiraProjectId).catch(() => ({ components: [] })),
        ]);
        if (cancelled) return;
        setIssueTypes(types.issueTypes || []);
        setComponents(comps.components || []);
        if (selectedJiraProject?.key) {
          const users = await listJiraAssignable(projectId, selectedJiraProject.key).catch(() => ({ users: [] }));
          if (!cancelled) setAssignees(users.users || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, projectId, form?.jiraProjectId, selectedJiraProject?.key]);

  const loadActivity = useCallback(async () => {
    if (!connected || !projectId) return;
    try {
      const payload = await getJiraActivity(projectId, { limit: 10 });
      setActivity(payload.activity || []);
      setDeadJobs(payload.deadJobs || []);
    } catch {
      // The activity card is supplementary; a failure here must not take
      // over the page.
    }
  }, [connected, projectId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function run(name, fn, successMessage) {
    setBusy(name);
    setError("");
    setSuccess("");
    try {
      const result = await fn();
      if (successMessage) setSuccess(successMessage);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function handleConnect(event) {
    event.preventDefault();
    const result = await run(
      "connect",
      () => connectJira({ projectId, baseUrl, email, apiToken }),
      "Jira connected."
    );
    if (!result) return;
    setApiToken("");
    if (result.webhookUrl) setWebhookUrl(result.webhookUrl);
    invalidateJira(projectId);
    refresh();
  }

  async function handleTest() {
    const result = await run("test", () => testJiraConnection(projectId));
    if (!result) return;
    setTestResult(result);
    if (result.ok) flash("success", `Connection verified as ${result.accountDisplayName || "the connected account"}.`);
    else flash("error", result.detail);
    refresh();
  }

  async function handleDisconnect() {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Disconnect Jira from this project? Existing links are kept for history, and no Jira issue is deleted.")) {
      return;
    }
    const result = await run("disconnect", () => disconnectJira(projectId), "Jira disconnected.");
    if (!result) return;
    setWebhookUrl("");
    setTestResult(null);
    setForm(null);
    invalidateJira(projectId);
    refresh();
  }

  async function handleRegenerate() {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Generate a new webhook URL? The current one stops working immediately and must be updated in Jira.")) {
      return;
    }
    const result = await run("webhook", () => regenerateJiraWebhookSecret(projectId), "A new webhook URL was generated.");
    if (result?.webhookUrl) setWebhookUrl(result.webhookUrl);
    refresh();
  }

  async function handleSaveMapping(event) {
    event.preventDefault();
    const payload = {
      projectId,
      jiraProjectId: form.jiraProjectId,
      defaultIssueTypeId: form.defaultIssueTypeId,
      defaultPriorityId: form.defaultPriorityId || null,
      defaultAssigneeAccountId: form.defaultAssigneeAccountId || null,
      defaultLabels: String(form.defaultLabels || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      components: form.components,
      severityPriorityMap: form.severityPriorityMap,
      autoCreateEnabled: form.autoCreateEnabled,
      autoSyncEnabled: form.autoSyncEnabled,
      postVerificationComments: form.postVerificationComments,
      reopenBehaviour: form.reopenBehaviour,
      onDuplicate: form.onDuplicate,
      verificationDelayMinutes: Number(form.verificationDelayMinutes) || 0,
    };
    const result = await run("mapping", () => saveJiraMapping(payload), "Jira project mapping saved.");
    if (!result) return;
    invalidateJira(projectId);
    refresh();
  }

  async function handleRetryJob(jobId) {
    await run(`retry:${jobId}`, () => retryJiraJob({ projectId, jobId }), "The failed job was queued to retry.");
    loadActivity();
  }

  function copyWebhook() {
    navigator.clipboard?.writeText(webhookUrl).then(
      () => flash("success", "Webhook URL copied."),
      () => flash("error", "Could not copy the URL. Select and copy it manually.")
    );
  }

  if (!projectId) {
    return (
      <div className="max-w-3xl">
        <Banner tone="warning">
          Select a project first. Jira is configured per project, so each SEOX project can point at
          its own Jira board.
        </Banner>
      </div>
    );
  }

  if (!serverConfigured) {
    return (
      <div className="max-w-3xl space-y-4">
        <Banner tone="warning">
          Jira integration is not configured on this server. Ask an administrator to set
          JIRA_TOKEN_ENCRYPTION_KEY, which SEOX uses to encrypt stored Jira credentials.
        </Banner>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}

      <p className="text-sm text-white/45">
        Configuring Jira for <span className="font-semibold text-white/70">{project?.name || projectId}</span>.
      </p>

      {/* ---------------- Connection ---------------- */}
      <section className={card}>
        <div className={cardHeader}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
            <SquareKanban className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-base font-bold text-white">Connection</h2>
            <p className="text-xs text-white/40">
              {isLoading
                ? "Checking…"
                : connected
                  ? `${status?.baseUrl} — ${status?.accountDisplayName || status?.accountEmail}`
                  : "Not connected"}
            </p>
          </div>
          {connected && (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                status?.status === "connected"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/15 text-rose-300"
              }`}
            >
              {status?.status === "connected" ? "Connected" : status?.status?.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {!connected ? (
          <form onSubmit={handleConnect} className="space-y-4 p-5">
            <div>
              <label className={label} htmlFor="jira-base-url">Jira URL</label>
              <input
                id="jira-base-url"
                className={`${input} mt-2`}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://your-team.atlassian.net"
                disabled={busy === "connect"}
              />
            </div>
            <div>
              <label className={label} htmlFor="jira-email">Jira account email</label>
              <input
                id="jira-email"
                className={`${input} mt-2`}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={busy === "connect"}
              />
            </div>
            <div>
              <label className={label} htmlFor="jira-token">API token</label>
              <input
                id="jira-token"
                type="password"
                className={`${input} mt-2`}
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder="Create one in Atlassian account settings"
                disabled={busy === "connect"}
              />
              <p className="mt-2 text-xs text-white/40">
                Create a token at{" "}
                <a
                  className="text-brand-300 underline"
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                >
                  id.atlassian.com
                </a>
                . SEOX encrypts it on the server and never sends it back to your browser.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/50">
              <p className="font-semibold text-white/70">What SEOX will and will not do</p>
              <p className="mt-1">
                It creates issues, reads their status, and comments when it has re-checked a fix. It
                never closes, reassigns, reprioritises or deletes anything in Jira.
              </p>
            </div>

            <button type="submit" className={primaryButton} disabled={busy === "connect" || !baseUrl || !email || !apiToken}>
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              {busy === "connect" ? "Connecting…" : "Connect Jira"}
            </button>
          </form>
        ) : (
          <div className="space-y-4 p-5">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-white/40">Connected</dt>
                <dd className="text-white/70">{relativeTime(status?.connectedAt)}</dd>
              </div>
              <div>
                <dt className="text-white/40">Last checked</dt>
                <dd className="text-white/70">{relativeTime(status?.lastCheckedAt)}</dd>
              </div>
              <div>
                <dt className="text-white/40">Last sync</dt>
                <dd className="text-white/70">{relativeTime(status?.lastSyncAt)}</dd>
              </div>
              <div>
                <dt className="text-white/40">Linked findings</dt>
                <dd className="text-white/70">{counts?.linked ?? 0}</dd>
              </div>
            </dl>

            {status?.statusDetail && <Banner tone="warning">{status.statusDetail}</Banner>}
            {testResult && !testResult.ok && <Banner tone="error">{testResult.detail}</Banner>}

            <div className="flex flex-wrap gap-2">
              <button type="button" className={quietButton} onClick={handleTest} disabled={busy === "test"}>
                {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Test connection
              </button>
              <button type="button" className={quietButton} onClick={handleDisconnect} disabled={busy === "disconnect"}>
                <Unplug className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- Mapping ---------------- */}
      {connected && form && (
        <form onSubmit={handleSaveMapping} className={card}>
          <div className={cardHeader}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Jira project mapping</h2>
              <p className="text-xs text-white/40">
                {mapping ? `Mapped to ${mapping.jiraProjectKey}` : "Not mapped yet"}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="jira-project">Jira project</label>
                <select
                  id="jira-project"
                  className={`${input} mt-2`}
                  value={form.jiraProjectId}
                  onChange={(event) => setField("jiraProjectId", event.target.value)}
                >
                  <option value="">Select a project…</option>
                  {jiraProjects.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.key} — {entry.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="jira-issue-type">Default issue type</label>
                <select
                  id="jira-issue-type"
                  className={`${input} mt-2`}
                  value={form.defaultIssueTypeId}
                  onChange={(event) => setField("defaultIssueTypeId", event.target.value)}
                  disabled={!issueTypes.length}
                >
                  <option value="">Select a type…</option>
                  {issueTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="jira-assignee">Default assignee</label>
                <select
                  id="jira-assignee"
                  className={`${input} mt-2`}
                  value={form.defaultAssigneeAccountId}
                  onChange={(event) => setField("defaultAssigneeAccountId", event.target.value)}
                >
                  <option value="">Unassigned (recommended)</option>
                  {assignees.map((user) => (
                    <option key={user.accountId} value={user.accountId}>{user.displayName}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-white/35">
                  Leaving this unset lets the team triage as they normally would.
                </p>
              </div>
              <div>
                <label className={label} htmlFor="jira-labels">Labels</label>
                <input
                  id="jira-labels"
                  className={`${input} mt-2`}
                  value={form.defaultLabels}
                  onChange={(event) => setField("defaultLabels", event.target.value)}
                  placeholder="seox, seo"
                />
                <p className="mt-1 text-xs text-white/35">
                  Comma separated. <code>seox</code> is always applied — sync depends on it.
                </p>
              </div>
            </div>

            <div>
              <span className={label}>Severity to Jira priority</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {SEVERITIES.map((severity) => (
                  <div key={severity.key}>
                    <label className="text-xs text-white/45" htmlFor={`prio-${severity.key}`}>
                      {severity.label}
                    </label>
                    <select
                      id={`prio-${severity.key}`}
                      className={`${input} mt-1`}
                      value={form.severityPriorityMap?.[severity.key] || ""}
                      onChange={(event) =>
                        setField("severityPriorityMap", {
                          ...form.severityPriorityMap,
                          [severity.key]: event.target.value,
                        })
                      }
                    >
                      <option value="">Jira default</option>
                      {priorities.map((priority) => (
                        <option key={priority.id} value={priority.id}>{priority.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {components.length > 0 && (
              <div>
                <label className={label} htmlFor="jira-components">Components</label>
                <select
                  id="jira-components"
                  multiple
                  className={`${input} mt-2 h-24`}
                  value={form.components}
                  onChange={(event) =>
                    setField(
                      "components",
                      [...event.target.selectedOptions].map((option) => option.value)
                    )
                  }
                >
                  {components.map((component) => (
                    <option key={component.id} value={component.id}>{component.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <label className="flex items-start gap-2 text-sm text-white/65">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.autoSyncEnabled}
                  onChange={(event) => setField("autoSyncEnabled", event.target.checked)}
                />
                <span>
                  Keep statuses in sync
                  <span className="block text-xs text-white/35">
                    SEOX reads Jira status changes and re-checks fixes automatically.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-white/65">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.postVerificationComments}
                  onChange={(event) => setField("postVerificationComments", event.target.checked)}
                />
                <span>
                  Comment in Jira when a fix is verified
                  <span className="block text-xs text-white/35">
                    A failed re-check is always commented, since that is news the team needs.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-white/65">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.autoCreateEnabled}
                  onChange={(event) => setField("autoCreateEnabled", event.target.checked)}
                />
                <span>
                  Create issues automatically for critical findings
                  <span className="block text-xs text-amber-300/70">
                    Off by default. A first crawl of a neglected site can produce thousands of
                    findings, so automatic creation is capped and limited to error-severity types.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="jira-reopen">When a fixed finding comes back</label>
                <select
                  id="jira-reopen"
                  className={`${input} mt-2`}
                  value={form.reopenBehaviour}
                  onChange={(event) => setField("reopenBehaviour", event.target.value)}
                >
                  {REOPEN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-white/35">
                  {REOPEN_OPTIONS.find((option) => option.value === form.reopenBehaviour)?.hint}
                </p>
              </div>
              <div>
                <label className={label} htmlFor="jira-delay">Wait before re-checking (minutes)</label>
                <input
                  id="jira-delay"
                  type="number"
                  min="0"
                  max="1440"
                  className={`${input} mt-2`}
                  value={form.verificationDelayMinutes}
                  onChange={(event) => setField("verificationDelayMinutes", event.target.value)}
                />
                <p className="mt-1 text-xs text-white/35">
                  Gives a deploy and any CDN cache time to settle.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className={primaryButton}
              disabled={busy === "mapping" || !form.jiraProjectId || !form.defaultIssueTypeId}
            >
              {busy === "mapping" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save mapping
            </button>
          </div>
        </form>
      )}

      {/* ---------------- Webhook ---------------- */}
      {connected && (
        <section className={card}>
          <div className={cardHeader}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">Webhook</h2>
              <p className="text-xs text-white/40">
                {webhook?.state === "healthy"
                  ? `Receiving events (last ${relativeTime(webhook.lastEventAt)})`
                  : webhook?.state === "quiet"
                    ? `No events for a while (last ${relativeTime(webhook.lastEventAt)})`
                    : "No events received yet — scheduled sync is being used"}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5 text-sm">
            {webhookUrl ? (
              <div>
                <label className={label} htmlFor="jira-webhook-url">Webhook URL</label>
                <div className="mt-2 flex gap-2">
                  <input id="jira-webhook-url" readOnly className={input} value={webhookUrl} />
                  <button type="button" className={quietButton} onClick={copyWebhook}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-amber-300/70">
                  Copy this now. It contains a secret and is shown only once.
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/45">
                The webhook URL contains a secret, so it is shown only when it is created.
                Generate a new one if you no longer have it.
              </p>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/50">
              <p className="font-semibold text-white/70">Setting it up in Jira</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Jira Settings → System → WebHooks → Create a WebHook</li>
                <li>Paste the URL above</li>
                <li>
                  Set the JQL filter to <code>labels = &quot;seox&quot;</code>
                </li>
                <li>Tick: Issue updated, Issue deleted, Comment created</li>
              </ol>
              <p className="mt-2">
                Webhooks need Jira administrator rights. Without one, SEOX falls back to a scheduled
                sync every 30 minutes — slower, but everything still works.
              </p>
            </div>

            <button type="button" className={quietButton} onClick={handleRegenerate} disabled={busy === "webhook"}>
              {busy === "webhook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Generate a new webhook URL
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Activity ---------------- */}
      {connected && (
        <section className={card}>
          <div className={cardHeader}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/60">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-base font-bold text-white">Recent activity</h2>
              <p className="text-xs text-white/40">
                {health?.syncErrors7d
                  ? `${health.syncErrors7d} error(s) in the last 7 days`
                  : "No errors in the last 7 days"}
              </p>
            </div>
            <button type="button" className={quietButton} onClick={loadActivity}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-5">
            {deadJobs.length > 0 && (
              <div className="mb-4 space-y-2">
                {deadJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-rose-200">{job.jobType} failed</p>
                      <p className="truncate text-rose-200/60">{job.lastError}</p>
                    </div>
                    <button
                      type="button"
                      className={quietButton}
                      onClick={() => handleRetryJob(job.id)}
                      disabled={busy === `retry:${job.id}`}
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activity.length === 0 ? (
              <p className="text-xs text-white/35">Nothing yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        entry.result === "error"
                          ? "bg-rose-400"
                          : entry.result === "rate_limited"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-white/65">
                        <span className="font-semibold text-white/80">{entry.action}</span>
                        {entry.jiraIssueKey ? ` · ${entry.jiraIssueKey}` : ""}
                      </p>
                      {entry.message && <p className="text-white/40">{entry.message}</p>}
                    </div>
                    <span className="shrink-0 text-white/30">{relativeTime(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
