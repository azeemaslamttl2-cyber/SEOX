import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useProjects } from "../../context/ProjectsContext.jsx";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { useClientPagination } from "../../hooks/useClientPagination.js";
import {
  PROTOCOLS,
  SCHEDULES,
  SCOPES,
  USER_AGENTS,
  applyFormValuesToProject,
  projectToFormValues,
  validateProjectForm,
} from "../../lib/projectFormFields.js";

const PAGE_SIZE = 10;

const STATUS_STYLES = {
  crawling: { label: "Crawling", cls: "bg-amber-500/15 text-amber-300" },
  complete: { label: "Audited", cls: "bg-emerald-500/15 text-emerald-300" },
  idle: { label: "Not audited", cls: "bg-white/[0.06] text-white/50" },
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "complete", label: "Audited" },
  { value: "crawling", label: "Crawling" },
  { value: "idle", label: "Not audited" },
];

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function projectUrlOf(project) {
  return project?.fullUrl || project?.full_url || project?.url || "";
}

function StatusBadge({ status, crawledCount }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.idle;
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.cls}`}>
        {status === "crawling" && <Loader2 className="h-3 w-3 animate-spin" />}
        {config.label}
      </span>
      {crawledCount > 0 && (
        <span className="text-[11px] text-white/30">{crawledCount.toLocaleString()} URLs</span>
      )}
    </div>
  );
}

/* ================================================================
   Edit dialog - reuses the project field helpers shared with creation
   ================================================================ */
function EditProjectDialog({ project, projects, saving, error, fieldErrors, onCancel, onSave }) {
  const [values, setValues] = useState(() => projectToFormValues(project));

  useEffect(() => {
    setValues(projectToFormValues(project));
  }, [project]);

  const set = (key) => (event) => {
    const target = event.target;
    setValues((current) => ({
      ...current,
      [key]: target.type === "checkbox" ? target.checked : target.value,
    }));
  };

  function submit(event) {
    event.preventDefault();
    onSave(values);
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-400/60 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Edit project</h2>
            <p className="text-xs text-white/40">
              Changes are saved to the database first, then applied everywhere in the app.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-name">
                Project name
              </label>
              <input
                id="project-name"
                value={values.name}
                onChange={set("name")}
                disabled={saving}
                placeholder="Defaults to the website domain"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-domain">
                Website
              </label>
              <input
                id="project-domain"
                value={values.domain}
                onChange={set("domain")}
                disabled={saving}
                placeholder="example.com"
                className={inputClass}
              />
              {fieldErrors.domain && (
                <p className="mt-1 text-[11px] text-red-300">{fieldErrors.domain}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-protocol">
                Protocol
              </label>
              <select id="project-protocol" value={values.protocol} onChange={set("protocol")} disabled={saving} className={inputClass}>
                {PROTOCOLS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-scope">
                Scope
              </label>
              <select id="project-scope" value={values.scope} onChange={set("scope")} disabled={saving} className={inputClass}>
                {SCOPES.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-schedule">
                Schedule
              </label>
              <select id="project-schedule" value={values.schedule} onChange={set("schedule")} disabled={saving} className={inputClass}>
                {SCHEDULES.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-user-agent">
                User agent
              </label>
              <select id="project-user-agent" value={values.userAgent} onChange={set("userAgent")} disabled={saving} className={inputClass}>
                {USER_AGENTS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-url-limit">
                URL limit
              </label>
              <input
                id="project-url-limit"
                type="number"
                min="1"
                value={values.urlLimit}
                onChange={set("urlLimit")}
                disabled={saving}
                className={inputClass}
              />
              {fieldErrors.urlLimit && (
                <p className="mt-1 text-[11px] text-red-300">{fieldErrors.urlLimit}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/75" htmlFor="project-folder">
                Folder
              </label>
              <input
                id="project-folder"
                value={values.folder}
                onChange={set("folder")}
                disabled={saving}
                placeholder="none"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <label className="flex items-center gap-2.5 text-sm text-white/70">
              <input type="checkbox" checked={values.renderJs} onChange={set("renderJs")} disabled={saving} />
              Render JavaScript while crawling
            </label>
            <label className="flex items-center gap-2.5 text-sm text-white/70">
              <input type="checkbox" checked={values.respectRobots} onChange={set("respectRobots")} disabled={saving} />
              Respect robots.txt
            </label>
            <label className="flex items-center gap-2.5 text-sm text-white/70">
              <input type="checkbox" checked={values.notifyEmail} onChange={set("notifyEmail")} disabled={saving} />
              Email me when an audit finishes
            </label>
          </div>

          <p className="text-[11px] text-white/30">
            {projects.length > 1
              ? "Each project must use a different website."
              : "Changing the website affects future audits for this project."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================
   Delete confirmation
   ================================================================ */
function DeleteProjectDialog({ project, deleting, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Delete project</h2>
            <p className="text-xs text-white/40">This cannot be undone.</p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-sm text-white/65">
            Delete <span className="font-semibold text-white">{project?.name || project?.domain}</span> and
            its saved audit data? Other pages will stop showing this project immediately.
          </p>
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Project listing
   ================================================================ */
export default function ProjectsList() {
  // The shared inventory - the same context every other page reads, so no
  // extra /api/projects request is made when this page mounts.
  const { projects, loading, ready, error, selectedProjectId, updateProject, removeProject, refreshProjects } =
    useProjects();
  // Crawl runtime state is a separate, page-specific concern.
  const { projectStates } = useCrawl();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const statusOf = useCallback(
    (project) => projectStates?.[project?.id]?.status || "idle",
    [projectStates]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (statusFilter !== "all" && statusOf(project) !== statusFilter) return false;
        if (!term) return true;
        return [project.name, project.project_name, project.domain, projectUrlOf(project)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => {
        const left = new Date(a.created_at || a.createdAt || 0).getTime();
        const right = new Date(b.created_at || b.createdAt || 0).getTime();
        return right - left;
      });
  }, [projects, search, statusFilter, statusOf]);

  const { page, setPage, totalPages, pageRows, total } = useClientPagination(
    rows,
    `${search}|${statusFilter}`,
    PAGE_SIZE
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshProjects(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave(values) {
    const problems = validateProjectForm(values, {
      projects,
      currentProjectId: editing?.id,
    });
    setFieldErrors(problems);
    if (Object.keys(problems).length) return;

    setSaving(true);
    setDialogError("");
    try {
      // The context persists to the database and only then updates the shared
      // state, so a failure here leaves every page on the previous value.
      await updateProject(applyFormValuesToProject(editing, values));
      setEditing(null);
      setNotice({ tone: "success", text: `"${values.name || values.domain}" updated.` });
    } catch (err) {
      setDialogError(err?.message || "Could not save this project. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setRemoving(true);
    setDialogError("");
    const label = deleting?.name || deleting?.domain || "Project";
    try {
      await removeProject(deleting.id);
      setDeleting(null);
      setNotice({ tone: "success", text: `"${label}" deleted.` });
    } catch (err) {
      setDialogError(err?.message || "Could not delete this project. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  const isLoading = loading || !ready;

  return (
    <section className="pb-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight text-white">
            <Globe className="h-6 w-6 text-brand-400" />
            Projects
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Manage every website connected to your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/auditor/new"
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-400"
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/20 bg-red-500/10 text-red-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {notice.text}
          </span>
          <button onClick={() => setNotice(null)} className="text-current/60 transition hover:text-current" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 transition focus-within:border-brand-500/40 sm:max-w-md">
          <Search className="h-4 w-4 flex-shrink-0 text-white/30" />
          <input
            type="text"
            placeholder="Search by name or website..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70 outline-none transition focus:border-brand-500/40"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value} className="bg-ink-900">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Project</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Website</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Created</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Updated</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-white/40">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading projects...
                  </td>
                </tr>
              )}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="text-sm text-white/45">
                      {projects.length === 0 ? "No projects yet." : "No projects match your filters."}
                    </p>
                    {projects.length === 0 && (
                      <Link
                        to="/auditor/new"
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create your first project
                      </Link>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading &&
                pageRows.map((project) => {
                  const url = projectUrlOf(project);
                  const state = projectStates?.[project.id];
                  return (
                    <tr key={project.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-300">
                            {String(project.name || project.domain || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-semibold text-white">
                                {project.name || project.domain || "Untitled"}
                              </span>
                              {project.id === selectedProjectId && (
                                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-white/50">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[11px] text-white/35">
                              {project.folder && project.folder !== "none" ? project.folder : project.scope || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex max-w-[220px] items-center gap-1.5 truncate text-[13px] text-white/60 transition hover:text-brand-300"
                          >
                            <span className="truncate">{project.domain || url}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={statusOf(project)} crawledCount={state?.stats?.crawledCount || 0} />
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-white/50">
                        {formatDate(project.created_at || project.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-white/50">
                        {formatDate(project.updated_at || project.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditing(project);
                              setDialogError("");
                              setFieldErrors({});
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeleting(project);
                              setDialogError("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
            <span className="text-[11px] text-white/35">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:text-white disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-white/45">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:text-white disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditProjectDialog
          project={editing}
          projects={projects}
          saving={saving}
          error={dialogError}
          fieldErrors={fieldErrors}
          onCancel={() => {
            if (saving) return;
            setEditing(null);
            setDialogError("");
            setFieldErrors({});
          }}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          deleting={removing}
          error={dialogError}
          onCancel={() => {
            if (removing) return;
            setDeleting(null);
            setDialogError("");
          }}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}
