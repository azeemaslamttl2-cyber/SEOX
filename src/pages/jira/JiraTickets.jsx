import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SquareKanban,
  UserRound,
  X,
} from "lucide-react";
import { getJiraAdminToken } from "../../lib/jiraAdminToken.js";
import { fetchJiraProjects, fetchJiraTickets } from "../../lib/jiraTicketsApi.js";
import { presentState } from "../../lib/jiraTicketStates.js";
import { resolveMappedJiraProject } from "../../lib/jiraProjectMapping.js";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_VIEWS,
  requestForView,
  applyFilters,
  avatarTint,
  categoryTone,
  collectFacets,
  flattenTickets,
  initialsOf,
  projectsFromFeed,
  relativeTime,
  severityTone,
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

/**
 * One labelled facet filter.
 *
 * The label is visible rather than screen-reader-only: five unlabelled
 * dropdowns in a row is a guessing game, and a column of small caps labels
 * above them costs one line of height and removes it.
 */
function Select({ label, value, onChange, children }) {
  return (
    <label className="jira-field">
      <span className="jira-field-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className={`jira-select${value ? " is-active" : ""}`}
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

  // How many facets are narrowing the list right now. Presentational only -
  // it drives the count on the "Clear filters" control so a filtered view
  // never looks like an empty board.
  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.assignee,
    filters.issueType,
    filters.severity,
    search,
  ].filter(Boolean).length;

  if (!adminToken) {
    return (
      <div className="jira-page">
        <Header onRefresh={() => load()} loading={loading} disabled />
        <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />
      </div>
    );
  }

  return (
    <div className="jira-page">
      <Header
        onRefresh={() => load()}
        loading={loading}
        project={selectedProject}
        seoxProjectName={seoxProjectName}
        count={tickets.length}
        mappingStatus={mappingResolution.status}
      />

      {/* A read of the rows already in state - no extra request, and the
          label says "loaded" rather than "total" because that is what it
          counts. */}
      {tickets.length > 0 && <TicketStats tickets={tickets} />}

      {/* --- Controls ------------------------------------------------- */}
      <section className="jira-toolbar" aria-label="Ticket views and filters">
        <div className="jira-toolbar-primary">
          <div className="jira-segment">
            {STATUS_VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-pressed={view === item.id}
                className={`jira-segment-btn${view === item.id ? " is-active" : ""}`}
              >
                {item.label}
                {/* Only the ACTIVE view carries a count, because only its
                    tickets have been fetched. Putting a number on the other
                    tabs would mean claiming how many resolved tickets exist
                    without having asked Jira for them. */}
                {view === item.id && tickets.length > 0 && (
                  <span className="jira-segment-count">{tickets.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="jira-search">
            <Search className="jira-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Key, summary, URL, project, assignee…"
              aria-label="Search tickets"
              className="jira-search-input"
            />
          </div>
        </div>

        <div className="jira-toolbar-filters">
          {/* *** THE JIRA PROJECT SELECTOR ***
              Jira projects, from Jira. The value is the Jira KEY - the stable
              identifier - while the label shows the name for humans. The key
              is what reaches the API; the display name never does.

              It is SET from the selected SEOX project's saved mapping rather
              than chosen by hand. It stays enabled so another board can still
              be inspected ad hoc, and that manual pick holds until the SEOX
              project changes - at which point the new project's mapping wins,
              because the selection belongs to the project, not to the page. */}
          <label className="jira-field jira-field-board">
            <span className="jira-field-label">Jira project</span>
            <select
              value={jiraProjectKey}
              onChange={(event) => setJiraProjectKey(event.target.value)}
              disabled={loadingProjects || jiraProjects.length === 0}
              aria-label="Jira project"
              className="jira-select jira-select-board"
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

          <span className="jira-filter-divider" aria-hidden="true" />

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

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setSearch("");
              }}
              className="jira-clear"
            >
              <X className="jira-clear-icon" aria-hidden="true" />
              Clear
              <span className="jira-clear-count">{activeFilterCount}</span>
            </button>
          )}
        </div>

        {/* Where the board above came from. Without this the dropdown looks
            like a free choice the user forgot to make, rather than an answer
            already recorded in Settings. */}
        {seoxProjectName && (
          <p className="jira-mapping-note" data-status={mappingResolution.status}>
            <span className="jira-mapping-dot" aria-hidden="true" />
            {mappingResolution.status === "ready"
              ? `Mapped to ${seoxProjectName}`
              : mappingResolution.status === "blocked"
              ? `Not mapped for ${seoxProjectName}`
              : `Reading the Jira mapping for ${seoxProjectName}…`}
          </p>
        )}
      </section>

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
        <TableSkeleton
          label={
            loadingProjects && !jiraProjects.length
              ? "Loading Jira projects…"
              : `Finding the Jira project mapped to ${seoxProjectName || "the selected project"}…`
          }
        />
      ) : loadingProjects && !jiraProjects.length ? (
        <TableSkeleton label="Loading Jira projects…" />
      ) : loading ? (
        <TableSkeleton
          label={`Loading ${
            selectedProject ? `${selectedProject.name} (${selectedProject.key})` : "Jira"
          } tickets…`}
        />
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

                <div className="jira-footer">
                  <span className="jira-footer-count">
                    Showing <strong>{visible.length}</strong> of <strong>{tickets.length}</strong>{" "}
                    loaded
                    {okProjects[0].jira?.project_key ? (
                      <>
                        {" from "}
                        <span className="jira-key jira-key-inline">
                          {okProjects[0].jira.project_key}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {nextPageToken && (
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => load({ pageToken: nextPageToken })}
                      className="jira-loadmore"
                    >
                      {loadingMore ? (
                        <Loader2 className="jira-loadmore-icon animate-spin" />
                      ) : (
                        <ChevronRight className="jira-loadmore-icon" />
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
            className="jira-drawer-backdrop"
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

/* ------------------------------------------------------------------ */
/*  Page header                                                        */
/*                                                                     */
/*  Built to the dashboard header recipe: a white surface with two     */
/*  very low-opacity brand washes, a brand tile carrying the icon, and */
/*  the supporting facts on a meta row below a hairline rather than    */
/*  crammed into one sentence.                                         */
/* ------------------------------------------------------------------ */
function Header({
  onRefresh,
  loading,
  disabled = false,
  project = null,
  seoxProjectName = "",
  count = 0,
  mappingStatus = "",
}) {
  const mappingTone =
    mappingStatus === "ready" ? "success" : mappingStatus === "blocked" ? "error" : "info";

  return (
    <header className="jira-hero">
      <div className="jira-hero-top">
        <span className="jira-hero-icon" aria-hidden="true">
          <SquareKanban />
        </span>

        <div className="jira-hero-copy">
          <p className="jira-hero-eyebrow">Jira integration</p>
          <h1 className="jira-hero-title">
            {project ? project.name : "Jira Tickets"}
            {project && <span className="jira-key jira-hero-key">{project.key}</span>}
          </h1>
          <p className="jira-hero-sub">
            {project
              ? "Live from Jira — every issue on this board, whether SEOX filed it or someone raised it by hand."
              : seoxProjectName
              ? `The Jira project mapped to ${seoxProjectName}.`
              : "Live from Jira. Select a project to see its mapped Jira tickets."}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || disabled}
          className="jira-refresh"
        >
          <RefreshCw className={`jira-refresh-icon${loading ? " animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Both names, because they are different things and the page is only
          correct when they line up: the SEOX project chosen at the top, and
          the Jira board its mapping points at. */}
      {(project || seoxProjectName || count > 0) && (
        <div className="jira-hero-meta">
          {project && (
            <span className="jira-chip" data-tone="brand">
              <SquareKanban className="jira-chip-icon" aria-hidden="true" />
              Board {project.key}
            </span>
          )}
          {seoxProjectName && (
            <span className="jira-chip" data-tone={mappingTone}>
              <span className="jira-chip-dot" aria-hidden="true" />
              {mappingStatus === "blocked" ? "Not mapped to " : "Mapped to "}
              {seoxProjectName}
            </span>
          )}
          {count > 0 && (
            <span className="jira-chip" data-tone="neutral">
              {count} loaded
            </span>
          )}
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary tiles                                                      */
/*                                                                     */
/*  A read of the rows already in state. Nothing is fetched for these  */
/*  and nothing is inferred beyond them, so the label is "loaded", not */
/*  "total" - the board may hold far more than this page asked for.    */
/* ------------------------------------------------------------------ */
function TicketStats({ tickets }) {
  const counts = useMemo(() => {
    let critical = 0;
    let inProgress = 0;
    let done = 0;
    let unassigned = 0;
    for (const ticket of tickets) {
      if (ticket.severity === "error") critical += 1;
      const category = String(ticket.status?.category || "").toLowerCase();
      if (category === "indeterminate") inProgress += 1;
      else if (category === "done") done += 1;
      if (!ticket.assignee?.displayName) unassigned += 1;
    }
    return { critical, inProgress, done, unassigned };
  }, [tickets]);

  const tiles = [
    { key: "loaded", label: "Loaded", value: tickets.length, tone: "neutral", Icon: SquareKanban },
    { key: "critical", label: "Critical", value: counts.critical, tone: "error", Icon: AlertTriangle },
    { key: "progress", label: "In progress", value: counts.inProgress, tone: "info", Icon: CircleDot },
    { key: "done", label: "Done", value: counts.done, tone: "success", Icon: CheckCircle2 },
    { key: "unassigned", label: "Unassigned", value: counts.unassigned, tone: "warning", Icon: UserRound },
  ];

  return (
    <div className="jira-stats">
      {tiles.map(({ key, label, value, tone, Icon }) => (
        <div key={key} className="jira-stat" data-tone={tone}>
          <span className="jira-stat-icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="jira-stat-value">{value}</span>
          <span className="jira-stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Presentation helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Priority read as a rank, for the dot beside the name.
 *
 * Jira lets a site rename its priorities, so this matches on the words that
 * survive renaming and falls back to an unranked dot rather than guessing.
 * "highest" and "lowest" are tested before "high" and "low" because each
 * contains the other.
 */
function priorityRank(name) {
  const value = String(name || "").toLowerCase();
  if (!value) return "none";
  if (value.includes("highest") || value.includes("blocker") || value.includes("critical")) {
    return "highest";
  }
  if (value.includes("lowest") || value.includes("trivial")) return "lowest";
  if (value.includes("high") || value.includes("major") || value.includes("urgent")) return "high";
  if (value.includes("low") || value.includes("minor")) return "low";
  if (value.includes("medium") || value.includes("normal")) return "medium";
  return "none";
}

/* ------------------------------------------------------------------ */
/*  Loading placeholder                                                */
/*                                                                     */
/*  A shaped skeleton rather than a lone spinner in a box: the page    */
/*  keeps its height, so the table does not jump into place when the   */
/*  rows arrive.                                                       */
/* ------------------------------------------------------------------ */
function TableSkeleton({ label }) {
  const widths = ["14%", "9%", "38%", "12%", "10%", "17%"];
  return (
    <div className="jira-skeleton" role="status" aria-live="polite">
      <div className="jira-skeleton-head">
        <Loader2 className="jira-skeleton-spinner animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="jira-skeleton-body" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="jira-skeleton-row">
            {widths.map((width, cell) => (
              <span key={cell} className="jira-skeleton-bar" style={{ width }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ticket table                                                       */
/* ------------------------------------------------------------------ */
function TicketTable({ tickets, onSelect }) {
  return (
    <div className="jira-table-card">
      <div className="jira-table-scroll">
        <table className="jira-table">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Jira key</th>
              <th scope="col">Summary</th>
              <th scope="col">Type</th>
              <th scope="col">SEO severity</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Assignee</th>
              <th scope="col">Updated</th>
              <th scope="col" className="jira-col-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const category = String(ticket.status?.category || "").toLowerCase();
              const assignee = ticket.assignee?.displayName || "";
              return (
                <tr key={ticket.key} onClick={() => onSelect(ticket.key)} className="jira-row">
                  <td className="jira-cell-project" title={ticket.projectName}>
                    {ticket.projectName}
                  </td>

                  <td className="jira-cell-key">
                    <span className="jira-key">{ticket.key}</span>
                  </td>

                  <td className="jira-cell-summary">
                    <span className="jira-summary-line">
                      <span className="jira-summary-text" title={ticket.summary}>
                        {ticket.summary}
                      </span>
                      {ticket.createdBySeox && (
                        <span className="jira-badge-seox" title="Filed by SEOX from an SEO finding">
                          SEOX
                        </span>
                      )}
                    </span>
                    {ticket.affectedUrl && (
                      <span className="jira-summary-url" title={ticket.affectedUrl}>
                        {ticket.affectedUrl}
                      </span>
                    )}
                  </td>

                  <td className="jira-cell-type">{ticket.issueType?.name || "—"}</td>

                  <td>
                    {ticket.severity ? (
                      <span className="jira-pill" data-tone={severityTone(ticket.severity)}>
                        {SEVERITY_LABELS[ticket.severity] || ticket.severity}
                      </span>
                    ) : (
                      <span className="jira-dash">—</span>
                    )}
                  </td>

                  <td className="jira-cell-priority">
                    {ticket.priority?.name ? (
                      <span className="jira-priority" data-rank={priorityRank(ticket.priority.name)}>
                        <span className="jira-priority-dot" aria-hidden="true" />
                        {ticket.priority.name}
                      </span>
                    ) : (
                      <span className="jira-dash">—</span>
                    )}
                  </td>

                  <td>
                    <span
                      className="jira-pill"
                      data-tone={categoryTone(category)}
                      title={CATEGORY_LABELS[category] || ""}
                    >
                      {ticket.status?.name || CATEGORY_LABELS[category] || "Unknown"}
                    </span>
                  </td>

                  <td className="jira-cell-assignee">
                    {assignee ? (
                      <span className="jira-assignee" title={assignee}>
                        <span
                          className="jira-avatar"
                          data-tint={avatarTint(assignee)}
                          aria-hidden="true"
                        >
                          {initialsOf(assignee)}
                        </span>
                        <span className="jira-assignee-name">{assignee}</span>
                      </span>
                    ) : (
                      <span className="jira-assignee is-empty">
                        <span className="jira-avatar is-empty" aria-hidden="true" />
                        <span className="jira-assignee-name">Unassigned</span>
                      </span>
                    )}
                  </td>

                  <td className="jira-cell-updated">{relativeTime(ticket.updated)}</td>

                  <td className="jira-cell-actions">
                    <div className="jira-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSelect(ticket.key)}
                        className="jira-action"
                      >
                        View
                      </button>
                      {ticket.url && (
                        <a
                          href={ticket.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="Open in Jira"
                          className="jira-action jira-action-icon"
                        >
                          <ExternalLink />
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
