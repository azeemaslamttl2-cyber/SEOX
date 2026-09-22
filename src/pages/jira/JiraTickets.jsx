import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SquareKanban,
  Ticket,
} from "lucide-react";
import { useProjects } from "../../context/ProjectsContext.jsx";
import { getJiraAdminToken } from "../../lib/jiraAdminToken.js";
import { fetchJiraTickets } from "../../lib/jiraTicketsApi.js";
import {
  CATEGORY_LABELS,
  CATEGORY_TONE,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  STATUS_VIEWS,
  applyFilters,
  collectFacets,
  flattenTickets,
  isPending,
  projectsFromFeed,
  relativeTime,
  sortTickets,
} from "../../lib/jiraTickets.js";
import JiraAdminTokenGate from "../../components/jira/JiraAdminTokenGate.jsx";
import JiraTicketDetail from "../../components/jira/JiraTicketDetail.jsx";

/**
 * /jira/tickets - the Jira tickets SEOX filed, and the ones still to do.
 *
 * DATA COMES FROM THE EXISTING FEED. One POST to /api/jira/issues per
 * project selection, with `jira_created: true` so the server returns only
 * findings that already have a Jira issue. Nothing here re-derives findings,
 * re-reads jira_issue_links or calls Jira - that endpoint already does all
 * three, in a fixed 8-9 statements and zero Jira calls, and doing it again in
 * the browser would be both slower and a second definition of the truth.
 *
 * Jira is only ever called for a single ticket, on demand: the detail panel
 * reads that issue's transitions when it opens. There is deliberately no
 * per-row Jira call.
 *
 * THE PROJECT LIST IS NOT FETCHED. ProjectsContext already holds it for the
 * whole application; this page reads it rather than issuing another request.
 */

const PAGE_SIZE = 100;

const SEVERITY_OPTIONS = [
  { value: "", label: "Any severity" },
  { value: "error", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "notice", label: "Notice" },
];

const emptyFilters = {
  status: "",
  priority: "",
  assignee: "",
  issueType: "",
  severity: "",
};

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
  const { projects } = useProjects();

  const [adminToken, setAdminToken] = useState(() => getJiraAdminToken());
  const [projectId, setProjectId] = useState("");
  const [view, setView] = useState("pending");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [feed, setFeed] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

  const requestRef = useRef(0);

  // Severity and issue type are pushed to the server, which already supports
  // both, so a narrow filter fetches fewer rows instead of fetching
  // everything and hiding most of it. The rest are per-page and stay local.
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!adminToken) {
        setFeed(null);
        setTickets([]);
        return;
      }
      const ticket = ++requestRef.current;
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await fetchJiraTickets({
          projectId,
          severity: filters.severity,
          issueType: filters.issueType,
          page,
          limit: PAGE_SIZE,
        });
        if (requestRef.current !== ticket) return;
        setFeed(result);
        setTickets(sortTickets(flattenTickets(result)));
      } catch (err) {
        if (requestRef.current !== ticket) return;
        // Jira being unavailable cannot reach this call - the feed never
        // touches Jira - so an error here is SEOX's own, and the page says so
        // without pretending there are no tickets.
        setError(err.message);
        setFeed(null);
        setTickets([]);
      } finally {
        if (requestRef.current === ticket) setLoading(false);
      }
    },
    [adminToken, projectId, filters.severity, filters.issueType, page]
  );

  useEffect(() => {
    load();
  }, [load]);

  // A narrower server-side filter can leave the cursor past the end.
  useEffect(() => {
    setPage(1);
  }, [projectId, filters.severity, filters.issueType]);

  const facets = useMemo(() => collectFacets(tickets), [tickets]);

  const visible = useMemo(
    () => applyFilters(tickets, { ...filters, view, search }),
    [tickets, filters, view, search]
  );

  const counts = useMemo(
    () => ({
      pending: tickets.filter(isPending).length,
      total: tickets.length,
    }),
    [tickets]
  );

  const feedProjects = useMemo(() => projectsFromFeed(feed), [feed]);
  const anyJiraConnected = feedProjects.some((project) => project.jira_connected);

  const selected = useMemo(
    () => tickets.find((item) => item.jira_issue_key === selectedKey) || null,
    [tickets, selectedKey]
  );

  /**
   * Apply a completed transition to the row in place.
   *
   * No refetch and certainly no page reload: the response carries Jira's own
   * post-transition values, so the row can be corrected from it directly. The
   * row then simply stops matching the Pending view and disappears from it,
   * while staying available under "All" and under its new status.
   */
  const handleUpdated = useCallback((data) => {
    if (!data?.jira_issue_key) return;
    setTickets((current) =>
      current.map((item) =>
        item.jira_issue_key === data.jira_issue_key
          ? {
              ...item,
              jira_status: data.new_status || item.jira_status,
              jira_status_category: data.new_status_category || item.jira_status_category,
              jira_resolution: data.jira_resolution ?? item.jira_resolution,
              jira_priority: data.jira_priority ?? item.jira_priority,
              jira_assignee: data.jira_assignee ?? item.jira_assignee,
              jira_synced_at: data.last_synced_at || new Date().toISOString(),
              status: data.seox_state || item.status,
              seox_state_label: data.seox_state_label || item.seox_state_label,
            }
          : item
      )
    );
  }, []);

  const pagination = feed?.pagination || null;
  const showTokenGate = !adminToken;

  return (
    <div className="space-y-4">
      {/* --- Header ---------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <SquareKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Jira Tickets</h1>
            <p className="text-sm text-white/45">
              SEO findings filed in Jira, and the ones still waiting on someone.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading || !adminToken}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {showTokenGate ? (
        <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />
      ) : (
        <>
          {/* --- Controls ---------------------------------------------- */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-800/60 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              {/* Views, counted from what is actually loaded. */}
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
                    {item.id === "pending" && counts.pending > 0 && (
                      <span className="ml-1.5 text-[11px] opacity-70">{counts.pending}</span>
                    )}
                    {item.id === "all" && counts.total > 0 && (
                      <span className="ml-1.5 text-[11px] opacity-70">{counts.total}</span>
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
                  placeholder="Key, title, URL, project, assignee…"
                  aria-label="Search tickets"
                  className="settings-input w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-brand-400/50"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Read from ProjectsContext - no extra request. */}
              <Select label="Project" value={projectId} onChange={setProjectId}>
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name || project.domain || project.id}
                  </option>
                ))}
              </Select>

              <Select
                label="Severity"
                value={filters.severity}
                onChange={(value) => setFilters((f) => ({ ...f, severity: value }))}
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              {/* Everything below is built from the rows on screen, so it can
                  never offer a value that would match nothing. */}
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

          {/* --- Body -------------------------------------------------- */}
          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
              <p className="flex items-start gap-2 text-sm text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </p>
              {/* A rejected token is the most likely cause, so offer the fix. */}
              <div className="mt-4">
                <JiraAdminTokenGate token={adminToken} onChange={setAdminToken} />
              </div>
            </div>
          ) : loading && !tickets.length ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-sm text-white/45 backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Jira tickets…
            </div>
          ) : !feed ? null : !anyJiraConnected && !tickets.length ? (
            <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-center backdrop-blur">
              <Ticket className="mx-auto h-8 w-8 text-white/20" />
              <h2 className="mt-3 font-display text-base font-bold text-white">
                Jira is not connected
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/45">
                Connect Jira and map a Jira project in Settings → Jira, then file a finding from
                the auditor. Tickets appear here once they exist.
              </p>
              <a
                href="/settings/general?tab=jira"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400"
              >
                Open Jira settings
              </a>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-10 text-center backdrop-blur">
              <Ticket className="mx-auto h-8 w-8 text-white/20" />
              <h2 className="mt-3 font-display text-base font-bold text-white">
                {tickets.length === 0
                  ? "No Jira tickets yet"
                  : view === "pending"
                  ? "Nothing pending"
                  : "No tickets match these filters"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/45">
                {tickets.length === 0
                  ? "File a finding from the Site Auditor and it will show up here."
                  : view === "pending"
                  ? "Every Jira ticket in this view has been moved out of a to-do or in-progress status."
                  : "Try widening the filters or clearing the search."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Project</th>
                        <th className="px-3 py-2.5 font-bold">Jira key</th>
                        <th className="px-3 py-2.5 font-bold">Issue</th>
                        <th className="px-3 py-2.5 font-bold">Type</th>
                        <th className="px-3 py-2.5 font-bold">URL</th>
                        <th className="px-3 py-2.5 font-bold">Severity</th>
                        <th className="px-3 py-2.5 font-bold">Priority</th>
                        <th className="px-3 py-2.5 font-bold">Status</th>
                        <th className="px-3 py-2.5 font-bold">Assignee</th>
                        <th className="px-3 py-2.5 font-bold">Last sync</th>
                        <th className="px-3 py-2.5 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {visible.map((ticket) => {
                        const category = String(ticket.jira_status_category || "").toLowerCase();
                        return (
                          <tr
                            key={ticket.jira_issue_key}
                            onClick={() => setSelectedKey(ticket.jira_issue_key)}
                            className="cursor-pointer transition hover:bg-white/[0.03]"
                          >
                            <td className="max-w-[140px] truncate px-3 py-2.5 text-white/70">
                              {ticket.project_name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold text-brand-300">
                              {ticket.jira_issue_key}
                            </td>
                            <td className="max-w-[260px] truncate px-3 py-2.5 text-white/85">
                              {ticket.title}
                            </td>
                            <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-white/50">
                              {ticket.issue_type}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-white/50">
                              {ticket.url || "Site-wide"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                  SEVERITY_TONE[ticket.severity] || SEVERITY_TONE.notice
                                }`}
                              >
                                {SEVERITY_LABELS[ticket.severity] || ticket.severity}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/60">
                              {ticket.jira_priority || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                  CATEGORY_TONE[category] || CATEGORY_TONE.new
                                }`}
                                title={CATEGORY_LABELS[category] || ""}
                              >
                                {ticket.jira_status || CATEGORY_LABELS[category] || "Unknown"}
                              </span>
                            </td>
                            <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-white/60">
                              {ticket.jira_assignee || "Unassigned"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-white/40">
                              {relativeTime(ticket.jira_synced_at)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                              <div
                                className="inline-flex items-center gap-1.5"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedKey(ticket.jira_issue_key)}
                                  className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08]"
                                >
                                  View
                                </button>
                                {ticket.jira_issue_url && (
                                  <a
                                    href={ticket.jira_issue_url}
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

              {/* --- Pagination ---------------------------------------- */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-white/40">
                <span>
                  Showing {visible.length} of {tickets.length} loaded
                  {pagination?.total_issues
                    ? ` · ${pagination.total_issues} filed across ${feed.total_projects} project${
                        feed.total_projects === 1 ? "" : "s"
                      }`
                    : ""}
                </span>
                {pagination && (pagination.page > 1 || pagination.has_more) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1 || loading}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <span>
                      Page {pagination.page} of {pagination.total_pages}
                    </span>
                    <button
                      type="button"
                      disabled={!pagination.has_more || loading}
                      onClick={() => setPage((current) => current + 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
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
