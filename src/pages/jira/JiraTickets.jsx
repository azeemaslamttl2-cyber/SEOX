import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SquareKanban,
} from "lucide-react";
import { getJiraAdminToken } from "../../lib/jiraAdminToken.js";
import { fetchJiraProjects, fetchJiraTickets } from "../../lib/jiraTicketsApi.js";
import { presentState } from "../../lib/jiraTicketStates.js";
import { resolveMappedJiraProject } from "../../lib/jiraProjectMapping.js";
import {
  CATEGORY_LABELS,
  CATEGORY_TONE,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  STATUS_VIEWS,
  requestForView,
  applyFilters,
  collectFacets,
  flattenTickets,
  projectsFromFeed,
  relativeTime,
  sortTickets,
} from "../../lib/jiraTickets.js";
import JiraAdminTokenGate from "../../components/jira/JiraAdminTokenGate.jsx";
import JiraTicketDetail from "../../components/jira/JiraTicketDetail.jsx";
import JiraStateNotice from "../../components/jira/JiraStateNotice.jsx";
import { useProjectSelection } from "../../context/CrawlContext.jsx";
import { useProjects } from "../../context/ProjectsContext.jsx";
import { useJiraConnection } from "../../hooks/useJira.js";

/**
 * /jira/tickets - the Jira tickets for a SEOX project, and why there are none
 * when there are none.
 *
 * *** THE RULE THIS PAGE FOLLOWS ***
 * An empty table is only ever shown when SEOX successfully queried Jira and
 * Jira returned nothing. Every other outcome - not connected, not mapped,
 * credentials refused, project invisible, Jira unreachable, SEOX unreachable -
 * is rendered as its own explained state with the action that fixes it. The
 * server sends a `state.code` per project for exactly this purpose; this page
 * never collapses one into `tickets = []`.
 *
 * *** THE SELECTOR PICKS A JIRA PROJECT, NOT A SEOX PROJECT ***
 * A SEOX project is a website (https://ucp.edu.pk/). A Jira project is a
 * board (WUCP / "Web - UCP"). This page lists the latter, from
 * `POST /api/jira/projects`, which asks Jira through the stored credential -
 * the list is never hardcoded and never inferred from a website URL.
 * Selecting one sends its Jira KEY to the ticket API, which queries
 * `project = "<key>"` directly.
 *
 * *** THE JIRA PROJECT FOLLOWS THE ONE CHOSEN AT THE TOP OF THE APP ***
 * The user already said which website they are working on, in the project
 * selector in the top bar, and Settings > Jira already records which Jira
 * board that website is mapped to. Asking them to name the board a second
 * time here was asking a question the application could already answer.
 *
 *     top project selector -> selected SEOX project
 *         -> GET /api/jira/status?projectId -> mapping.jiraProjectKey
 *         -> that key selected in the Jira project dropdown -> tickets
 *
 * THE MAPPING IS READ, NEVER INVENTED. `useJiraConnection` reads the very
 * mapping saved at /settings/general?tab=jira; no Jira key, id or name is
 * hardcoded here and no second mapping mechanism exists. When the chain
 * cannot complete - nothing selected, no mapping, or a mapped board the
 * credential can no longer see - the dropdown is left EMPTY and the reason
 * is rendered. Falling back to "the first board in the list" would show one
 * project's tickets under another project's name, which is worse than
 * showing none.
 *
 * SWITCHING PROJECTS IS A RESET, NOT A MERGE. The selection is cleared the
 * moment the SEOX project changes and is only re-set once the NEW project's
 * mapping has resolved, so a slow response for project A can never land on
 * project B. `useProjectData` keys its cache on the project id, so the
 * mapping this component reads always belongs to the project it is rendering.
 *
 * DATA: one `POST /api/jira/tickets` per selection.
 * The browser holds no Jira credential and makes no Jira call itself.
 */

const PAGE_SIZE = 50;

const SEVERITY_OPTIONS = [
  { value: "", label: "Any SEO severity" },
  { value: "error", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "notice", label: "Notice" },
];

const emptyFilters = { status: "", priority: "", assignee: "", issueType: "", severity: "" };

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex items-center gap-2 text-xs text-white/40">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="settings-input rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 outline-none transition focus:border-brand-400/50"
      >
        {children}
      </select>
    </label>
  );
}

export default function JiraTickets() {
  const [adminToken, setAdminToken] = useState(() => getJiraAdminToken());

  // *** THE INTERNAL (SEOX) PROJECT, FROM THE TOP SELECTOR ***
  // The same context the top bar writes to, so this page follows the user's
  // choice there without a second selector and without a prop drilled
  // through the layout.
  const { project: seoxProject, storageReady } = useProjectSelection();
  const { ready: projectsReady } = useProjects();
  const seoxProjectId = seoxProject?.id ? String(seoxProject.id) : "";
  // The same label the top selector shows. `name` is usually the site URL
  // already; the fallbacks are the other fields a project carries, so the
  // messages below never end up saying "this project" for a project that has
  // a perfectly good name.
  const seoxProjectName =
    seoxProject?.name || seoxProject?.fullUrl || seoxProject?.url || seoxProject?.domain || "";

  // Both must settle before "no project is selected" can be believed: the
  // inventory arrives from `ProjectsContext` and the last selection is
  // rehydrated by `CrawlContext`. On a page refresh, or on a direct visit to
  // /jira/tickets, either can still be in flight - and a premature verdict
  // there is exactly what would make a refresh look unmapped.
  const projectSelectionSettled = storageReady && projectsReady;

  // The Jira mapping for that project, read from the mapping saved in
  // Settings > Jira. `useProjectData` underneath keys its cache on the
  // project id, so `mapping` always belongs to `seoxProjectId` - an answer
  // for a previously selected project cannot arrive late and be mistaken
  // for this one's.
  const {
    connected: jiraConnected,
    mapping,
    fetchStatus: mappingFetchStatus,
    error: mappingError,
    refresh: refreshMapping,
  } = useJiraConnection({ enabled: Boolean(seoxProjectId) });

  const mappedJiraKey = String(mapping?.jiraProjectKey || "").trim();
  const mappedJiraName = String(mapping?.jiraProjectName || "").trim();

  // The Jira project selector.
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraProjectsState, setJiraProjectsState] = useState(null);
  // Whether that list is ALL of them. The server walks Jira's pagination and
  // says when it could not finish; a board missing from an unfinished list
  // must not be read as a board that does not exist.
  const [jiraProjectsComplete, setJiraProjectsComplete] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [view, setView] = useState("pending");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);

  const [feed, setFeed] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // A transport/auth failure that stopped the whole request, as a state
  // object shaped like the server's own so one renderer handles both.
  const [requestError, setRequestError] = useState(null);
  const [selectedKey, setSelectedKey] = useState("");

  const requestRef = useRef(0);

  /**
   * The Jira project list. Fetched once per admin token, not per render, and
   * not per ticket load - a Jira project list changes rarely and the ticket
   * query already costs a Jira call.
   */
  useEffect(() => {
    if (!adminToken) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoadingProjects(true);
      try {
        const result = await fetchJiraProjects({ signal: controller.signal });
        if (cancelled) return;
        const list = Array.isArray(result?.projects) ? result.projects : [];
        setJiraProjects(list);
        setJiraProjectsState(result?.state || null);
        // `!== false` rather than `=== true`, so a response without the field
        // is read as complete rather than as permanently broken.
        setJiraProjectsComplete(result?.complete !== false);
        // *** NOTHING IS AUTO-SELECTED FROM THIS LIST ***
        // It used to fall back to `list[0]`, which is how a project with no
        // mapping - or a mapping the credential cannot see - ended up
        // showing an unrelated board's tickets under its own name. Which
        // board to select is decided from the SEOX project's mapping alone,
        // below.
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setJiraProjects([]);
        setJiraProjectsComplete(true);
        setJiraProjectsState({ ok: false, code: err.code || "UNKNOWN", message: err.message });
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [adminToken]);

  /**
   * *** THE AUTO-SELECTION ***
   *
   * "Which SEOX project is selected" becomes "which Jira board should the
   * dropdown show" - and, when there is none, the reason why, as a state
   * object this page already knows how to render.
   *
   * The decision itself lives in jiraProjectMapping.js, as a pure function of
   * the four asynchronous sources it depends on. It is the part that is easy
   * to get subtly wrong and impossible to check by clicking, so it is tested
   * on its own; what is left here is applying the answer.
   */
  const mappingResolution = useMemo(
    () =>
      resolveMappedJiraProject({
        projectSelectionSettled,
        seoxProjectId,
        seoxProjectName,
        mappingFetchStatus,
        mappingError,
        jiraConnected,
        mappedJiraKey,
        mappedJiraName,
        jiraProjects,
        jiraProjectsState,
        jiraProjectsComplete,
        loadingProjects,
      }),
    [
      jiraConnected,
      jiraProjects,
      jiraProjectsComplete,
      jiraProjectsState,
      loadingProjects,
      mappedJiraKey,
      mappedJiraName,
      mappingError,
      mappingFetchStatus,
      projectSelectionSettled,
      seoxProjectId,
      seoxProjectName,
    ]
  );

  /**
   * Changing the SEOX project drops the previous board IMMEDIATELY.
   *
   * Declared before the effect that applies the new mapping, so within one
   * commit the old key is gone before the new one could be written. Clearing
   * only once the new mapping arrives would leave project A's tickets on
   * screen, labelled with project B's name, for as long as the read takes.
   */
  useEffect(() => {
    setJiraProjectKey("");
  }, [seoxProjectId]);

  /**
   * Apply the resolved mapping.
   *
   * Runs on `status`/`key`, both primitives, so a background refresh of an
   * unchanged mapping does not touch the selection - which is what leaves a
   * manual pick from the dropdown standing until the SEOX project changes.
   * `waiting` deliberately writes nothing: the effect above has already
   * cleared the field, and writing "" again here would fight a user who
   * picked a board while the mapping was still in flight.
   */
  useEffect(() => {
    if (mappingResolution.status === "ready") {
      setJiraProjectKey(mappingResolution.key);
    } else if (mappingResolution.status === "blocked") {
      // Resolved, and the answer is that there is no board to show. The
      // dropdown stays empty rather than falling back to an unrelated one.
      setJiraProjectKey("");
    }
  }, [seoxProjectId, mappingResolution.status, mappingResolution.key]);

  const load = useCallback(
    async ({ pageToken = "" } = {}) => {
      if (!adminToken || !jiraProjectKey) {
        setFeed(null);
        setTickets([]);
        return;
      }
      const ticket = ++requestRef.current;
      if (pageToken) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        // Changing project must never leave the previous project's tickets
        // on screen while the new ones load. They are cleared here, not when
        // the response arrives.
        setFeed(null);
        setTickets([]);
        setSelectedKey("");
      }
      setRequestError(null);

      try {
        // The view is a SERVER-side query, not a filter over a list already
        // downloaded: the feed leaves out resolved tickets unless asked, so
        // Pending never pages through the board's history, and Resolved/All
        // ask for them back explicitly.
        const result = await fetchJiraTickets({
          jiraProjectKey,
          ...requestForView(view),
          limit: PAGE_SIZE,
          pageToken,
        });
        if (requestRef.current !== ticket) return;
        setFeed(result);
        const incoming = sortTickets(flattenTickets(result));
        // "Load more" appends; a fresh load replaces.
        setTickets((current) => (pageToken ? [...current, ...incoming] : incoming));
      } catch (err) {
        if (requestRef.current !== ticket || err?.name === "AbortError") return;
        // NOT turned into an empty list. The page renders this as an error
        // with the server's own code, which is the entire point of the fix.
        setRequestError({ ok: false, code: err.code || "UNKNOWN", message: err.message });
        if (!pageToken) {
          setFeed(null);
          setTickets([]);
        }
      } finally {
        if (requestRef.current === ticket) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [adminToken, jiraProjectKey, view]
  );

  useEffect(() => {
    load();
  }, [load]);

  const facets = useMemo(() => collectFacets(tickets), [tickets]);
  const visible = useMemo(
    () => applyFilters(tickets, { ...filters, view, search }),
    [tickets, filters, view, search]
  );

  const feedProjects = useMemo(() => projectsFromFeed(feed), [feed]);

  // Which project's state notice to show. With one project selected it is
  // that project's; across all projects it is every failing project, so a
  // misconfigured site is never hidden behind a sibling that works.
  const failingProjects = useMemo(
    () => feedProjects.filter((entry) => entry.state && entry.state.ok === false),
    [feedProjects]
  );
  const okProjects = useMemo(
    () => feedProjects.filter((entry) => entry.state?.ok === true),
    [feedProjects]
  );

  const selected = useMemo(
    () => tickets.find((item) => item.key === selectedKey) || null,
    [tickets, selectedKey]
  );

  const nextPageToken = feedProjects.length === 1 ? feedProjects[0].next_page_token : null;

  const selectedProject = useMemo(
    () => jiraProjects.find((project) => project.key === jiraProjectKey) || null,
    [jiraProjects, jiraProjectKey]
  );

  /** Apply a completed transition to the row in place - no reload. */
  const handleUpdated = useCallback((data) => {
    if (!data?.jira_issue_key) return;
    setTickets((current) =>
      current.map((item) =>
        item.key === data.jira_issue_key
          ? {
              ...item,
              // The transition endpoint answers in its own flat shape - it
              // reports one issue, not a ticket list - so its fields are
              // mapped onto the ticket shape here rather than the row being
              // refetched. The values are Jira's own, re-read after the
              // transition, so this is not an optimistic guess.
              status: {
                ...(item.status || {}),
                name: data.new_status || item.status?.name || "",
                category: data.new_status_category || item.status?.category || "",
              },
              resolution: data.jira_resolution
                ? { ...(item.resolution || {}), name: data.jira_resolution }
                : item.resolution,
              priority: data.jira_priority
                ? { ...(item.priority || {}), name: data.jira_priority }
                : item.priority,
              assignee: data.jira_assignee
                ? { ...(item.assignee || {}), displayName: data.jira_assignee }
                : item.assignee,
              updated: data.updated_at || item.updated,
              seoxState: data.seox_state || item.seoxState,
              seoxStateLabel: data.seox_state_label || item.seoxStateLabel,
            }
          : item
      )
    );
  }, []);

  if (!adminToken) {
    return (
      <div className="space-y-4">
        <Header onRefresh={() => load()} loading={loading} disabled />
        <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header
        onRefresh={() => load()}
        loading={loading}
        project={selectedProject}
        seoxProjectName={seoxProjectName}
        count={tickets.length}
      />

      {/* --- Controls ------------------------------------------------- */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-800/60 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {STATUS_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  view === item.id
                    ? "bg-brand-500/20 text-brand-200"
                    : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {item.label}
                {/* Only the ACTIVE view carries a count, because only its
                    tickets have been fetched. Putting a number on the other
                    tabs would mean claiming how many resolved tickets exist
                    without having asked Jira for them. */}
                {view === item.id && tickets.length > 0 && (
                  <span className="ml-1.5 text-[11px] opacity-70">{tickets.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Key, summary, URL, project, assignee…"
              aria-label="Search tickets"
              className="settings-input w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-brand-400/50"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* *** THE JIRA PROJECT SELECTOR ***
              Jira projects, from Jira. The value is the Jira KEY - the stable
              identifier - while the label shows the name for humans. The key
              is what reaches the API; the display name never does.

              It is SET from the selected SEOX project's saved mapping rather
              than chosen by hand. It stays enabled so another board can still
              be inspected ad hoc, and that manual pick holds until the SEOX
              project changes - at which point the new project's mapping wins,
              because the selection belongs to the project, not to the page. */}
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/35">
              Jira project
            </span>
            <select
              value={jiraProjectKey}
              onChange={(event) => setJiraProjectKey(event.target.value)}
              disabled={loadingProjects || jiraProjects.length === 0}
              aria-label="Jira project"
              className="settings-input min-w-[240px] rounded-lg border border-brand-500/30 bg-brand-500/[0.07] px-2.5 py-1.5 text-xs font-semibold text-white outline-none transition focus:border-brand-400 disabled:opacity-50"
            >
              {loadingProjects && <option value="">Loading Jira projects…</option>}
              {!loadingProjects && jiraProjects.length === 0 && (
                <option value="">No Jira projects available</option>
              )}
              {/* NOT SELECTED, said out loud. A <select> whose value matches
                  no option renders blank, which reads as a glitch; this is
                  the same emptiness with a reason attached. It exists only
                  while nothing is selected, so it cannot be chosen back once
                  a real board is in place. */}
              {!loadingProjects && jiraProjects.length > 0 && !jiraProjectKey && (
                <option value="">
                  {mappingResolution.status === "blocked"
                    ? "No Jira project mapped"
                    : "Resolving the mapped Jira project…"}
                </option>
              )}
              {jiraProjects.map((project) => (
                <option key={`${project.base_url}:${project.key}`} value={project.key}>
                  {project.name} ({project.key})
                </option>
              ))}
            </select>
          </label>

          {/* Where that value came from. Without this the dropdown looks like
              a free choice the user forgot to make, rather than an answer
              already recorded in Settings. */}
          {seoxProjectName && (
            <span className="text-[11px] text-white/30">
              {mappingResolution.status === "ready"
                ? `Mapped to ${seoxProjectName}`
                : mappingResolution.status === "blocked"
                ? `Not mapped for ${seoxProjectName}`
                : `Reading the Jira mapping for ${seoxProjectName}…`}
            </span>
          )}

          <Select
            label="Jira status"
            value={filters.status}
            onChange={(value) => setFilters((f) => ({ ...f, status: value }))}
          >
            <option value="">Any Jira status</option>
            {facets.statuses.map((status) => (
              <option key={status.name} value={status.name}>
                {status.name}
              </option>
            ))}
          </Select>

          <Select
            label="Priority"
            value={filters.priority}
            onChange={(value) => setFilters((f) => ({ ...f, priority: value }))}
          >
            <option value="">Any priority</option>
            {facets.priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>

          <Select
            label="Assignee"
            value={filters.assignee}
            onChange={(value) => setFilters((f) => ({ ...f, assignee: value }))}
          >
            <option value="">Any assignee</option>
            {facets.assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </Select>

          <Select
            label="Issue type"
            value={filters.issueType}
            onChange={(value) => setFilters((f) => ({ ...f, issueType: value }))}
          >
            <option value="">Any issue type</option>
            {facets.issueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>

          <Select
            label="SEO severity"
            value={filters.severity}
            onChange={(value) => setFilters((f) => ({ ...f, severity: value }))}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          {(filters.status ||
            filters.priority ||
            filters.assignee ||
            filters.issueType ||
            filters.severity ||
            search) && (
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setSearch("");
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/45 transition hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* --- Body ----------------------------------------------------- */}
      {/* The Jira project list itself failed. Nothing below can work, and
          "no tickets" would be the wrong thing to say. */}
      {jiraProjectsState && jiraProjectsState.ok === false ? (
        <JiraStateNotice state={jiraProjectsState} onRetry={() => setAdminToken(adminToken)} />
      ) : mappingResolution.status === "blocked" ? (
        /* The chain from the selected SEOX project to a Jira board broke, and
           this says where. Nothing below can run, and "no tickets" would be a
           claim about a board that was never queried. */
        <JiraStateNotice
          state={mappingResolution.state}
          onRetry={presentState(mappingResolution.state).retryable ? () => refreshMapping() : null}
        />
      ) : mappingResolution.status === "waiting" ||
        /* Resolved, but the commit that writes the key has not landed yet.
           Without this the page renders one empty frame between knowing the
           board and asking for its tickets. */
        (mappingResolution.status === "ready" && !jiraProjectKey) ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-sm text-white/45 backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingProjects && !jiraProjects.length
            ? "Loading Jira projects…"
            : `Finding the Jira project mapped to ${seoxProjectName || "the selected project"}…`}
        </div>
      ) : loadingProjects && !jiraProjects.length ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-sm text-white/45 backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Jira projects…
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-sm text-white/45 backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {selectedProject ? `${selectedProject.name} (${selectedProject.key})` : "Jira"} tickets…
        </div>
      ) : requestError ? (
        <>
          <JiraStateNotice state={requestError} onRetry={() => load()} />
          {requestError.code === "NO_ADMIN_TOKEN" || requestError.status === 401 ? (
            <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />
          ) : null}
        </>
      ) : (
        <>
          {/* Every project that could NOT be queried says so, by name. This
              is what stops a configuration problem reading as "no tickets". */}
          {failingProjects.map((entry, index) => (
            <JiraStateNotice
              key={entry.project_id || entry.jira?.project_key || index}
              state={entry.state}
              jira={entry.jira}
              projectName={feedProjects.length > 1 ? entry.project_name : ""}
              onRetry={presentState(entry.state).retryable ? () => load() : null}
            />
          ))}

          {/* Only reached when the Jira project WAS queried. */}
          {okProjects.length > 0 &&
            (visible.length === 0 ? (
              <JiraStateNotice
                state={
                  tickets.length === 0
                    ? okProjects[0].state
                    : {
                        ok: true,
                        code: "OK",
                        message:
                          "No ticket on this page matches the current filters. Try the All view or clear the filters.",
                      }
                }
                jira={okProjects[0].jira}
              />
            ) : (
              <>
                <TicketTable tickets={visible} onSelect={setSelectedKey} />

                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-white/40">
                  <span>
                    Showing {visible.length} of {tickets.length} loaded
                    {okProjects[0].jira?.project_key
                      ? ` from Jira project ${okProjects[0].jira.project_key}`
                      : ""}
                  </span>
                  {nextPageToken && (
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => load({ pageToken: nextPageToken })}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Load more from Jira
                    </button>
                  )}
                </div>
              </>
            ))}
        </>
      )}

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedKey("")}
            aria-hidden="true"
          />
          <JiraTicketDetail
            ticket={selected}
            onClose={() => setSelectedKey("")}
            onUpdated={handleUpdated}
          />
        </>
      )}
    </div>
  );
}

function Header({
  onRefresh,
  loading,
  disabled = false,
  project = null,
  seoxProjectName = "",
  count = 0,
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
          <SquareKanban className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-white">
            {project ? `${project.name} — Jira Tickets` : "Jira Tickets"}
          </h1>
          {/* Both names, because they are different things and the page is
              only correct when they line up: the SEOX project chosen at the
              top, and the Jira board its mapping points at. */}
          <p className="text-sm text-white/45">
            {project
              ? `Live from Jira project ${project.key}${
                  seoxProjectName ? ` · mapped to ${seoxProjectName}` : ""
                }${count ? ` · ${count} loaded` : ""}`
              : seoxProjectName
              ? `The Jira project mapped to ${seoxProjectName}.`
              : "Live from Jira. Select a project to see its mapped Jira tickets."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading || disabled}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </header>
  );
}

function TicketTable({ tickets, onSelect }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-3 py-2.5 font-bold">Project</th>
              <th className="px-3 py-2.5 font-bold">Jira key</th>
              <th className="px-3 py-2.5 font-bold">Summary</th>
              <th className="px-3 py-2.5 font-bold">Type</th>
              <th className="px-3 py-2.5 font-bold">SEO severity</th>
              <th className="px-3 py-2.5 font-bold">Priority</th>
              <th className="px-3 py-2.5 font-bold">Status</th>
              <th className="px-3 py-2.5 font-bold">Assignee</th>
              <th className="px-3 py-2.5 font-bold">Updated</th>
              <th className="px-3 py-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {tickets.map((ticket) => {
              const category = String(ticket.status?.category || "").toLowerCase();
              return (
                <tr
                  key={ticket.key}
                  onClick={() => onSelect(ticket.key)}
                  className="cursor-pointer transition hover:bg-white/[0.03]"
                >
                  <td className="max-w-[150px] truncate px-3 py-2.5 text-white/70">
                    {ticket.projectName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold text-brand-300">
                    {ticket.key}
                  </td>
                  <td className="max-w-[300px] truncate px-3 py-2.5 text-white/85">
                    {ticket.summary}
                    {ticket.createdBySeox && (
                      <span
                        className="ml-2 rounded border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-300"
                        title="Filed by SEOX from an SEO finding"
                      >
                        SEOX
                      </span>
                    )}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2.5 text-xs text-white/50">
                    {ticket.issueType?.name || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {ticket.severity ? (
                      <span
                        className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          SEVERITY_TONE[ticket.severity] || SEVERITY_TONE.notice
                        }`}
                      >
                        {SEVERITY_LABELS[ticket.severity] || ticket.severity}
                      </span>
                    ) : (
                      <span className="text-xs text-white/25">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/60">
                    {ticket.priority?.name || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        CATEGORY_TONE[category] || CATEGORY_TONE.new
                      }`}
                      title={CATEGORY_LABELS[category] || ""}
                    >
                      {ticket.status?.name || CATEGORY_LABELS[category] || "Unknown"}
                    </span>
                  </td>
                  <td className="max-w-[130px] truncate px-3 py-2.5 text-xs text-white/60">
                    {ticket.assignee?.displayName || "Unassigned"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/40">
                    {relativeTime(ticket.updated)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <div
                      className="inline-flex items-center gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(ticket.key)}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
                      >
                        View
                      </button>
                      {ticket.url && (
                        <a
                          href={ticket.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="Open in Jira"
                          className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
