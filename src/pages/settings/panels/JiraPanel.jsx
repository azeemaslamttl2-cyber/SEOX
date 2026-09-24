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

/* The shared settings vocabulary, named once here so every control in this
   long panel keeps the same treatment. The rules live in index.css. */
const card = "settings-card";
const cardHeader = "settings-card-head";
const input = "settings-input";
const primaryButton = "settings-btn is-primary";
const quietButton = "settings-btn";
const label = "settings-label";

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
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : AlertCircle;
  return (
    <p className="settings-banner" data-tone={tone}>
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </p>
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

  /**
   * How the Jira project list is doing, tracked separately from `error`.
   *
   * An empty `jiraProjects` is three different situations and the user has to
   * be told which: still loading, the request failed, or Jira genuinely
   * reports no visible projects. Before this, all three rendered as a select
   * containing only "Select a project…", so a failed request was
   * indistinguishable from a working one - and the connection badge above it
   * still said "Connected", because that comes from a different endpoint
   * which was perfectly happy.
   */
  const [projectsState, setProjectsState] = useState({
    status: "idle",
    error: "",
    // Whether the list below is ALL of the account's Jira projects. The
    // server answers this per request; a false here is rendered as a visible
    // error, because a partial list is the one failure that looks exactly
    // like success.
    complete: true,
  });
  const [reloadToken, setReloadToken] = useState(0);

  const flash = useCallback((kind, message) => {
    if (kind === "error") {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }
  }, []);

  /**
   * *** EVERYTHING BELOW BELONGS TO ONE INTERNAL PROJECT ***
   *
   * Jira is configured per project, so every list on this screen - the Jira
   * projects, the issue types, the priorities, the components, the assignees
   * and the mapping form itself - describes the project that was selected
   * when it was fetched. None of it may survive a change of project.
   *
   * Without this, switching from A to B left A's values on screen until B's
   * requests came back, and kept them forever if a request failed. The
   * visible result was the mapping card saying "Mapped to WZC" above a
   * dropdown showing "WUCP - Web - UCP", with the WUCP issue types loaded
   * underneath - and pressing Save would then have written A's Jira project
   * onto B's mapping, silently repointing a correctly configured project at
   * the wrong board.
   *
   * Cleared on `projectId` alone, deliberately: not on `connected`, which
   * does not change when both projects are connected, and which is exactly
   * why the stale values used to get through.
   */
  useEffect(() => {
    setForm(null);
    setJiraProjects([]);
    setIssueTypes([]);
    setPriorities([]);
    setAssignees([]);
    setComponents([]);
    setActivity([]);
    setDeadJobs([]);
    setProjectsState({ status: "idle", error: "", complete: true });
    // The webhook URL and the test result name the previous project's Jira
    // connection too, and the banners refer to an action taken on it.
    setWebhookUrl("");
    setTestResult(null);
    setError("");
    setSuccess("");
  }, [projectId]);

  // Seed the mapping form from whatever is saved.
  //
  // THE FORM CARRIES THE PROJECT IT WAS BUILT FOR. That field is what lets
  // everything downstream tell "this form describes the selected project"
  // from "this form is left over from the previous one" - a distinction that
  // cannot be made from the values alone, and that React cannot make for us:
  // state survives a prop change, and `projectId` changing does not unmount
  // anything. It also distinguishes the two reasons `mapping` changes: a
  // different project was selected (re-seed) versus this project's mapping
  // was just saved and refetched (keep the user's unsaved edits).
  useEffect(() => {
    if (!connected) {
      setForm(null);
      return;
    }
    setForm((current) => {
      if (current && current.projectId === projectId) return current;
      return {
        projectId,
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
  }, [connected, projectId, mapping]);

  /**
   * The Jira project list for the SELECTED internal project.
   *
   * The whole chain - which Jira site, which credential, which projects that
   * credential can see - is resolved server-side from `projectId` by
   * /api/jira/metadata. Nothing here knows a Jira URL or a token, and the
   * project id is the only thing that decides which connection is used.
   *
   * Its outcome is recorded in `projectsState` rather than only in the page
   * banner, because the dropdown itself has to say what happened. Priorities
   * are fetched alongside but are NOT allowed to fail the project list: they
   * populate a different, optional field, and coupling them through
   * Promise.all once meant a priorities hiccup emptied the project dropdown.
   */
  useEffect(() => {
    if (!connected || !projectId) return undefined;

    // *** STALE REQUESTS ARE CANCELLED, NOT JUST IGNORED ***
    // `cancelled` alone already made a late answer harmless - the guards
    // below drop it - but the request carried on running and spending one of
    // sixty metadata calls an hour. Switching internal project three times in
    // a row left three project walks in flight against three different Jira
    // connections. The controller ends them; the flag remains because an
    // abort races with a response already in the microtask queue, and only
    // the flag can settle that.
    const controller = new AbortController();
    let cancelled = false;
    setProjectsState({ status: "loading", error: "", complete: true });

    (async () => {
      // Kicked off together so the two requests overlap, but settled
      // independently so neither can take the other down.
      const projectsPromise = listJiraProjects(projectId, "", { signal: controller.signal });
      const prioritiesPromise = listJiraPriorities(projectId, {
        signal: controller.signal,
      }).catch(() => ({ priorities: [] }));

      try {
        const payload = await projectsPromise;
        if (cancelled) return;
        const list = Array.isArray(payload?.projects) ? payload.projects : [];
        setJiraProjects(list);
        // *** A PARTIAL LIST IS NOT A LOADED LIST ***
        // The server walks Jira's pagination and says whether it finished.
        // `complete !== false` rather than `=== true` so an older server that
        // does not send the field is read as complete rather than as
        // permanently broken.
        setProjectsState({
          status: "ready",
          error: "",
          complete: payload?.complete !== false,
        });
      } catch (err) {
        // An abort is this component's own doing, not a Jira failure. Showing
        // "Unable to load Jira projects" for it would blame Jira for the user
        // changing project.
        if (cancelled || err?.name === "AbortError") return;
        setJiraProjects([]);
        // The server's own message is the useful one - "Jira is not
        // connected", "The Jira credentials are no longer valid", a 429 - and
        // it is already sanitised server-side, so it is shown rather than
        // replaced with a generic string.
        setProjectsState({
          status: "error",
          complete: true,
          error:
            err?.message ||
            "Unable to load Jira projects. Please try again.",
        });
      }

      const prioritiesPayload = await prioritiesPromise;
      if (!cancelled) setPriorities(prioritiesPayload?.priorities || []);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [connected, projectId, reloadToken]);

  /**
   * The Jira project whose details the dependent lists should describe - and
   * an empty string while the form still belongs to the PREVIOUS internal
   * project.
   *
   * Effects declared in this component all run in the same commit, so an
   * effect that only reset `form` could not stop the effects below from
   * firing once with the old form still in scope. That sent a request for the
   * previous project's Jira id against the newly selected project: three
   * wasted calls per switch out of an hourly metadata budget of 60, and a
   * question about a board the new project is not mapped to. Reading the
   * form's own `projectId` closes that window, because it is part of the same
   * render rather than something an effect has yet to apply.
   */
  const activeJiraProjectId = form?.projectId === projectId ? form.jiraProjectId : "";

  // Issue types, components and assignees are per Jira project, so they are
  // refetched whenever the selected Jira project changes. An issue type id
  // valid in one project is often invalid in another.
  const selectedJiraProject = useMemo(
    () => jiraProjects.find((entry) => entry.id === activeJiraProjectId) || null,
    [jiraProjects, activeJiraProjectId]
  );

  useEffect(() => {
    if (!connected || !projectId || !activeJiraProjectId) {
      setIssueTypes([]);
      setComponents([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const [types, comps] = await Promise.all([
          listJiraIssueTypes(projectId, activeJiraProjectId),
          listJiraComponents(projectId, activeJiraProjectId).catch(() => ({ components: [] })),
        ]);
        if (cancelled) return;
        setIssueTypes(types.issueTypes || []);
        setComponents(comps.components || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, projectId, activeJiraProjectId]);

  /**
   * Assignees, in an effect of their own.
   *
   * They are the only thing here keyed on the Jira project KEY rather than
   * its id, and the key only becomes known once the project list has loaded.
   * While they shared the effect above, that effect ran twice on every load -
   * once before the list arrived and again when `selectedJiraProject?.key`
   * went from undefined to "WZC" - refetching the issue types and components
   * identically both times. That is two wasted calls per project switch out
   * of an hourly metadata budget of 60, which is a budget this screen can
   * genuinely exhaust.
   */
  useEffect(() => {
    if (!connected || !projectId || !selectedJiraProject?.key) {
      setAssignees([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const users = await listJiraAssignable(projectId, selectedJiraProject.key).catch(() => ({
        users: [],
      }));
      if (!cancelled) setAssignees(users.users || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, projectId, selectedJiraProject?.key]);

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
      <div className="settings-measure">
        <Banner tone="warning">
          Select a project first. Jira is configured per project, so each SEOX project can point at
          its own Jira board.
        </Banner>
      </div>
    );
  }

  if (!serverConfigured) {
    return (
      <div className="settings-measure settings-panel">
        <Banner tone="warning">
          Jira integration is not configured on this server. Ask an administrator to set
          JIRA_TOKEN_ENCRYPTION_KEY, which SEOX uses to encrypt stored Jira credentials.
        </Banner>
      </div>
    );
  }

  return (
    <div className="settings-measure settings-panel">
      {error && <Banner tone="error">{error}</Banner>}
      {success && <Banner tone="success">{success}</Banner>}

      {/* CONNECTED IS NOT THE SAME AS WORKING.
          The badge below comes from /api/jira/status, which only reports that
          a credential is stored and was accepted. Listing the projects is a
          separate call to Jira that can fail on its own - a revoked token, a
          permission change, a rate limit, Jira being unreachable - and when it
          does, "Connected" on its own is a misleading answer to "is my Jira
          set up?". So the two are stated separately. */}
      {connected && projectsState.status === "error" && (
        <Banner tone="warning">
          Jira is connected, but its project list could not be loaded, so no Jira project can be
          mapped yet. {projectsState.error}
        </Banner>
      )}

      <p className="settings-lede">
        Configuring Jira for <strong>{project?.name || projectId}</strong>.
      </p>

      {/* ---------------- Connection ---------------- */}
      <section className={card}>
        <div className={cardHeader}>
          <span className="settings-card-icon" data-tone="navy" aria-hidden="true">
            <SquareKanban />
          </span>
          <div className="settings-card-titles">
            <h2>Connection</h2>
            <p>
              {isLoading
                ? "Checking…"
                : connected
                  ? `${status?.baseUrl} — ${status?.accountDisplayName || status?.accountEmail}`
                  : "Not connected"}
              {connected && projectsState.status === "error" && " · project list unavailable"}
            </p>
          </div>
          {connected && (
            <div className="settings-card-aside">
              <span
                className="settings-pill"
                data-tone={status?.status === "connected" ? "success" : "error"}
              >
                {status?.status === "connected" ? "Connected" : status?.status?.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>

        {!connected ? (
          <form onSubmit={handleConnect} className="settings-card-body">
            <div className="settings-field">
              <label className={label} htmlFor="jira-base-url">Jira URL</label>
              <input
                id="jira-base-url"
                className={input}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://your-team.atlassian.net"
                disabled={busy === "connect"}
              />
            </div>
            <div className="settings-field">
              <label className={label} htmlFor="jira-email">Jira account email</label>
              <input
                id="jira-email"
                className={input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={busy === "connect"}
              />
            </div>
            <div className="settings-field">
              <label className={label} htmlFor="jira-token">API token</label>
              <input
                id="jira-token"
                type="password"
                className={input}
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder="Create one in Atlassian account settings"
                disabled={busy === "connect"}
              />
              <p className="settings-hint">
                Create a token at{" "}
                <a
                  className="settings-link"
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                >
                  id.atlassian.com
                </a>
                . SEOX encrypts it on the server and never sends it back to your browser.
              </p>
            </div>

            <div className="settings-note">
              <p className="settings-note-title">What SEOX will and will not do</p>
              <p>
                It creates issues, reads their status, and comments when it has re-checked a fix. It
                never closes, reassigns, reprioritises or deletes anything in Jira.
              </p>
            </div>

            <div className="settings-actions">
              <button type="submit" className={primaryButton} disabled={busy === "connect" || !baseUrl || !email || !apiToken}>
                {busy === "connect" ? <Loader2 className="animate-spin" /> : <PlugZap />}
                {busy === "connect" ? "Connecting…" : "Connect Jira"}
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-card-body">
            <dl className="settings-kv">
              <div>
                <dt>Connected</dt>
                <dd>{relativeTime(status?.connectedAt)}</dd>
              </div>
              <div>
                <dt>Last checked</dt>
                <dd>{relativeTime(status?.lastCheckedAt)}</dd>
              </div>
              <div>
                <dt>Last sync</dt>
                <dd>{relativeTime(status?.lastSyncAt)}</dd>
              </div>
              <div>
                <dt>Linked findings</dt>
                <dd>{counts?.linked ?? 0}</dd>
              </div>
            </dl>

            {status?.statusDetail && <Banner tone="warning">{status.statusDetail}</Banner>}
            {testResult && !testResult.ok && <Banner tone="error">{testResult.detail}</Banner>}

            <div className="settings-actions">
              <button type="button" className={quietButton} onClick={handleTest} disabled={busy === "test"}>
                {busy === "test" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Test connection
              </button>
              <button
                type="button"
                className={`${quietButton} is-danger`}
                onClick={handleDisconnect}
                disabled={busy === "disconnect"}
              >
                <Unplug />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- Mapping ---------------- */}
      {connected && form?.projectId === projectId && (
        <form onSubmit={handleSaveMapping} className={card}>
          <div className={cardHeader}>
            <span className="settings-card-icon" data-tone="navy" aria-hidden="true">
              <Link2 />
            </span>
            <div className="settings-card-titles">
              <h2>Jira project mapping</h2>
              <p>{mapping ? `Mapped to ${mapping.jiraProjectKey}` : "Not mapped yet"}</p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="settings-grid">
              <div className="settings-field">
                <label className={label} htmlFor="jira-project">Jira project</label>
                <select
                  id="jira-project"
                  className={input}
                  value={form.jiraProjectId}
                  onChange={(event) => setField("jiraProjectId", event.target.value)}
                  disabled={projectsState.status !== "ready" || !jiraProjects.length}
                >
                  {/* The placeholder says which of the three situations this
                      is. An empty list is not self-explanatory: loading,
                      failed and genuinely-none look identical otherwise, and
                      the user is left staring at a dropdown that will not
                      open with no idea why. */}
                  <option value="">
                    {projectsState.status === "loading"
                      ? "Loading Jira projects…"
                      : projectsState.status === "error"
                        ? "Jira projects could not be loaded"
                        : jiraProjects.length
                          ? "Select a project…"
                          : "No Jira projects are visible to this account"}
                  </option>
                  {jiraProjects.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.key} — {entry.name}
                    </option>
                  ))}
                </select>

                {projectsState.status === "error" && (
                  <p className="settings-field-problem">
                    <AlertCircle aria-hidden="true" />
                    <span>{projectsState.error}</span>
                    <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                      Try again
                    </button>
                  </p>
                )}

                {/* Loaded, but not all of it. Rendered as an error rather
                    than a hint: the dropdown looks completely normal in this
                    state, so nothing else would tell the user that the board
                    they are hunting for is missing rather than absent. */}
                {projectsState.status === "ready" && !projectsState.complete && (
                  <p className="settings-field-problem">
                    <AlertCircle aria-hidden="true" />
                    <span>
                      Unable to load the complete Jira project list — this Jira site has more
                      projects than SEOX could list in one pass, so some are missing below.
                    </span>
                    <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                      Try again
                    </button>
                  </p>
                )}

                {projectsState.status === "ready" && !jiraProjects.length && (
                  <p className="settings-field-problem" data-tone="warning">
                    <AlertCircle aria-hidden="true" />
                    <span>
                      Jira answered, but the connected account
                      {status?.accountEmail ? ` (${status.accountEmail})` : ""} can see no projects
                      on {status?.baseUrl || "this Jira site"}. Grant it access to a project in
                      Jira, then try again.
                    </span>
                  </p>
                )}
              </div>
              <div className="settings-field">
                <label className={label} htmlFor="jira-issue-type">Default issue type</label>
                <select
                  id="jira-issue-type"
                  className={input}
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

            <div className="settings-grid">
              <div className="settings-field">
                <label className={label} htmlFor="jira-assignee">Default assignee</label>
                <select
                  id="jira-assignee"
                  className={input}
                  value={form.defaultAssigneeAccountId}
                  onChange={(event) => setField("defaultAssigneeAccountId", event.target.value)}
                >
                  <option value="">Unassigned (recommended)</option>
                  {assignees.map((user) => (
                    <option key={user.accountId} value={user.accountId}>{user.displayName}</option>
                  ))}
                </select>
                <p className="settings-hint">
                  Leaving this unset lets the team triage as they normally would.
                </p>
              </div>
              <div className="settings-field">
                <label className={label} htmlFor="jira-labels">Labels</label>
                <input
                  id="jira-labels"
                  className={input}
                  value={form.defaultLabels}
                  onChange={(event) => setField("defaultLabels", event.target.value)}
                  placeholder="seox, seo"
                />
                <p className="settings-hint">
                  Comma separated. <code>seox</code> is always applied — sync depends on it.
                </p>
              </div>
            </div>

            <div className="settings-field">
              <span className={label}>Severity to Jira priority</span>
              <div className="settings-grid-3">
                {SEVERITIES.map((severity) => (
                  <div key={severity.key} className="settings-field">
                    <label className="settings-sublabel" htmlFor={`prio-${severity.key}`}>
                      {severity.label}
                    </label>
                    <select
                      id={`prio-${severity.key}`}
                      className={input}
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
              <div className="settings-field">
                <label className={label} htmlFor="jira-components">Components</label>
                <select
                  id="jira-components"
                  multiple
                  className={input}
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

            <div className="settings-checks">
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={form.autoSyncEnabled}
                  onChange={(event) => setField("autoSyncEnabled", event.target.checked)}
                />
                <span className="settings-check-text">
                  Keep statuses in sync
                  <span className="settings-check-note">
                    SEOX reads Jira status changes and re-checks fixes automatically.
                  </span>
                </span>
              </label>

              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={form.postVerificationComments}
                  onChange={(event) => setField("postVerificationComments", event.target.checked)}
                />
                <span className="settings-check-text">
                  Comment in Jira when a fix is verified
                  <span className="settings-check-note">
                    A failed re-check is always commented, since that is news the team needs.
                  </span>
                </span>
              </label>

              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={form.autoCreateEnabled}
                  onChange={(event) => setField("autoCreateEnabled", event.target.checked)}
                />
                <span className="settings-check-text">
                  Create issues automatically for critical findings
                  <span className="settings-check-note" data-tone="warning">
                    Off by default. A first crawl of a neglected site can produce thousands of
                    findings, so automatic creation is capped and limited to error-severity types.
                  </span>
                </span>
              </label>
            </div>

            <div className="settings-grid">
              <div className="settings-field">
                <label className={label} htmlFor="jira-reopen">When a fixed finding comes back</label>
                <select
                  id="jira-reopen"
                  className={input}
                  value={form.reopenBehaviour}
                  onChange={(event) => setField("reopenBehaviour", event.target.value)}
                >
                  {REOPEN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="settings-hint">
                  {REOPEN_OPTIONS.find((option) => option.value === form.reopenBehaviour)?.hint}
                </p>
              </div>
              <div className="settings-field">
                <label className={label} htmlFor="jira-delay">Wait before re-checking (minutes)</label>
                <input
                  id="jira-delay"
                  type="number"
                  min="0"
                  max="1440"
                  className={input}
                  value={form.verificationDelayMinutes}
                  onChange={(event) => setField("verificationDelayMinutes", event.target.value)}
                />
                <p className="settings-hint">Gives a deploy and any CDN cache time to settle.</p>
              </div>
            </div>

            <div className="settings-actions">
              <button
                type="submit"
                className={primaryButton}
                disabled={busy === "mapping" || !form.jiraProjectId || !form.defaultIssueTypeId}
              >
                {busy === "mapping" ? <Loader2 className="animate-spin" /> : <Save />}
                Save mapping
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ---------------- Webhook ---------------- */}
      {connected && (
        <section className={card}>
          <div className={cardHeader}>
            <span className="settings-card-icon" data-tone="warning" aria-hidden="true">
              <Webhook />
            </span>
            <div className="settings-card-titles">
              <h2>Webhook</h2>
              <p>
                {webhook?.state === "healthy"
                  ? `Receiving events (last ${relativeTime(webhook.lastEventAt)})`
                  : webhook?.state === "quiet"
                    ? `No events for a while (last ${relativeTime(webhook.lastEventAt)})`
                    : "No events received yet — scheduled sync is being used"}
              </p>
            </div>
            <div className="settings-card-aside">
              <span
                className="settings-pill"
                data-tone={
                  webhook?.state === "healthy"
                    ? "success"
                    : webhook?.state === "quiet"
                      ? "warning"
                      : undefined
                }
              >
                {webhook?.state === "healthy"
                  ? "Healthy"
                  : webhook?.state === "quiet"
                    ? "Quiet"
                    : "Not set up"}
              </span>
            </div>
          </div>

          <div className="settings-card-body">
            {webhookUrl ? (
              <div className="settings-field">
                <label className={label} htmlFor="jira-webhook-url">Webhook URL</label>
                <div className="settings-field-row">
                  <input id="jira-webhook-url" readOnly className={input} value={webhookUrl} />
                  <button
                    type="button"
                    className={`${quietButton} is-icon`}
                    onClick={copyWebhook}
                    aria-label="Copy webhook URL"
                  >
                    <Copy />
                  </button>
                </div>
                <p className="settings-field-problem" data-tone="warning">
                  <AlertTriangle aria-hidden="true" />
                  <span>Copy this now. It contains a secret and is shown only once.</span>
                </p>
              </div>
            ) : (
              <p className="settings-hint">
                The webhook URL contains a secret, so it is shown only when it is created.
                Generate a new one if you no longer have it.
              </p>
            )}

            <div className="settings-note">
              <p className="settings-note-title">Setting it up in Jira</p>
              <ol>
                <li>Jira Settings → System → WebHooks → Create a WebHook</li>
                <li>Paste the URL above</li>
                <li>
                  Set the JQL filter to <code>labels = &quot;seox&quot;</code>
                </li>
                <li>Tick: Issue updated, Issue deleted, Comment created</li>
              </ol>
              <p>
                Webhooks need Jira administrator rights. Without one, SEOX falls back to a scheduled
                sync every 30 minutes — slower, but everything still works.
              </p>
            </div>

            <div className="settings-actions">
              <button type="button" className={quietButton} onClick={handleRegenerate} disabled={busy === "webhook"}>
                {busy === "webhook" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Generate a new webhook URL
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Activity ---------------- */}
      {connected && (
        <section className={card}>
          <div className={cardHeader}>
            <span
              className="settings-card-icon"
              data-tone={health?.syncErrors7d ? "error" : "success"}
              aria-hidden="true"
            >
              <RefreshCw />
            </span>
            <div className="settings-card-titles">
              <h2>Recent activity</h2>
              <p>
                {health?.syncErrors7d
                  ? `${health.syncErrors7d} error(s) in the last 7 days`
                  : "No errors in the last 7 days"}
              </p>
            </div>
            <div className="settings-card-aside">
              <button
                type="button"
                className={`${quietButton} is-small is-icon`}
                onClick={loadActivity}
                aria-label="Reload activity"
              >
                <RefreshCw />
              </button>
            </div>
          </div>

          <div className="settings-card-body">
            {deadJobs.length > 0 &&
              deadJobs.map((job) => (
                <div key={job.id} className="settings-job">
                  <div className="settings-job-main">
                    <p className="settings-job-title">{job.jobType} failed</p>
                    <p className="settings-job-error">{job.lastError}</p>
                  </div>
                  <button
                    type="button"
                    className={`${quietButton} is-small`}
                    onClick={() => handleRetryJob(job.id)}
                    disabled={busy === `retry:${job.id}`}
                  >
                    Retry
                  </button>
                </div>
              ))}

            {activity.length === 0 ? (
              <p className="settings-empty">Nothing yet.</p>
            ) : (
              <ul className="settings-activity">
                {activity.map((entry) => (
                  <li key={entry.id}>
                    <span className="settings-activity-dot" data-result={entry.result} />
                    <div className="settings-activity-main">
                      <p className="settings-activity-action">
                        <strong>{entry.action}</strong>
                        {entry.jiraIssueKey ? ` · ${entry.jiraIssueKey}` : ""}
                      </p>
                      {entry.message && <p className="settings-activity-message">{entry.message}</p>}
                    </div>
                    <span className="settings-activity-time">{relativeTime(entry.createdAt)}</span>
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
