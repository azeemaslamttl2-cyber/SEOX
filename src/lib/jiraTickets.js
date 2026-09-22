import { SEOX_STATE_LABELS } from './jiraFindings.js';

/**
 * Turning the /api/jira/issues feed into the rows the Jira Tickets page
 * renders, and deciding which of them still need action.
 *
 * Pure on purpose: the feed's shape (projects[] each carrying issues[]) and
 * the definition of "pending" are the two things most likely to be got
 * subtly wrong, and both are testable here without a browser or a server.
 */

/**
 * WHICH TICKETS ARE PENDING.
 *
 * Decided on Jira's `statusCategory`, never on the status NAME. Status names
 * are per-project and renameable - a team that calls its backlog column
 * "Icebox", or runs a localised Jira, breaks any list of hardcoded names
 * immediately. Every Jira status belongs to exactly one of three categories
 * and those are fixed by Jira itself:
 *
 *   new            To Do     -> actionable
 *   indeterminate  In Progress -> actionable
 *   done           Done      -> not actionable
 *
 * functions/_lib/jira-status-map.js makes the same call on the server, for
 * the same reason. If the two ever disagree the server wins - it is the one
 * talking to Jira.
 */
export const ACTIONABLE_CATEGORIES = Object.freeze(['new', 'indeterminate']);

/**
 * Only 'done' is not actionable. Anything else - including a category SEOX
 * has never seen, or none at all - counts as pending.
 *
 * Deliberately phrased as "not done" rather than "is one of the two
 * actionable categories". The failure modes are not symmetric: showing a
 * ticket that turns out to be finished costs a glance, while hiding one that
 * still needs work means nobody ever looks at it again.
 */
export function isPending(ticket) {
  return String(ticket?.jira_status_category || '').toLowerCase() !== 'done';
}

export const STATUS_VIEWS = Object.freeze([
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Resolved' },
  { id: 'all', label: 'All' },
]);

export function matchesView(ticket, view) {
  const category = String(ticket?.jira_status_category || '').toLowerCase();
  switch (view) {
    case 'pending':
      return isPending(ticket);
    case 'in_progress':
      return category === 'indeterminate';
    case 'done':
      return category === 'done';
    default:
      return true;
  }
}

export const CATEGORY_LABELS = Object.freeze({
  new: 'To Do',
  indeterminate: 'In Progress',
  done: 'Done',
});

export const CATEGORY_TONE = Object.freeze({
  new: 'border-white/15 bg-white/[0.06] text-white/70',
  indeterminate: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  done: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
});

export const SEVERITY_TONE = Object.freeze({
  error: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  notice: 'border-white/15 bg-white/[0.06] text-white/60',
});

export const SEVERITY_LABELS = Object.freeze({
  error: 'Critical',
  warning: 'Warning',
  notice: 'Notice',
});

/**
 * Flatten `projects[].issues[]` into one list, carrying each project's
 * identity onto its rows.
 *
 * Only findings that actually have a Jira issue become tickets. The feed also
 * serves findings that *could* be filed - those belong on the auditor pages,
 * not here, and the request already asks the server to exclude them; this is
 * the belt to that braces.
 */
export function flattenTickets(feed) {
  const projects = Array.isArray(feed?.projects) ? feed.projects : [];
  const tickets = [];

  for (const project of projects) {
    const issues = Array.isArray(project?.issues) ? project.issues : [];
    for (const issue of issues) {
      if (!issue?.jira_created || !issue?.jira_issue_key) continue;
      tickets.push({
        ...issue,
        project_id: project.project_id,
        project_name: project.project_name || project.domain || project.project_id,
        project_url: project.project_url || '',
        project_domain: project.domain || '',
        jira_project_key: project.jira_project_key || '',
        jira_connected: Boolean(project.jira_connected),
        seox_state_label: SEOX_STATE_LABELS[issue.status] || issue.status || '',
      });
    }
  }

  return tickets;
}

/** Every project the feed covered, whether or not it has tickets on this page. */
export function projectsFromFeed(feed) {
  const projects = Array.isArray(feed?.projects) ? feed.projects : [];
  return projects.map((project) => ({
    project_id: project.project_id,
    project_name: project.project_name || project.domain || project.project_id,
    jira_connected: Boolean(project.jira_connected),
    jira_connection_status: project.jira_connection_status || 'not_connected',
    jira_project_key: project.jira_project_key || null,
    jira_mapping_status: project.jira_mapping_status || 'not_mapped',
    jira_created_issue_count: Number(project.jira_created_issue_count || 0),
  }));
}

/**
 * The distinct values actually present, for the filter dropdowns.
 *
 * Built from the data rather than from a fixed list, so a Jira project with a
 * "Needs Design" status or a "Highest" priority offers those and nothing that
 * would match zero rows.
 */
export function collectFacets(tickets) {
  const statuses = new Map();
  const priorities = new Set();
  const assignees = new Set();
  const issueTypes = new Set();

  for (const ticket of tickets) {
    if (ticket.jira_status) {
      statuses.set(ticket.jira_status, ticket.jira_status_category || '');
    }
    if (ticket.jira_priority) priorities.add(ticket.jira_priority);
    if (ticket.jira_assignee) assignees.add(ticket.jira_assignee);
    if (ticket.issue_type) issueTypes.add(ticket.issue_type);
  }

  const byName = (a, b) => a.localeCompare(b);
  return {
    statuses: [...statuses.entries()]
      .map(([name, category]) => ({ name, category }))
      .sort((a, b) => byName(a.name, b.name)),
    priorities: [...priorities].sort(byName),
    assignees: [...assignees].sort(byName),
    issueTypes: [...issueTypes].sort(byName),
  };
}

/**
 * Search across the fields a user would actually type.
 *
 * Client-side, over the page already in memory. That is the right trade here:
 * the feed is paginated server-side, so this never walks an unbounded set,
 * and the alternative - a round trip per keystroke against an endpoint that
 * has no text index - would be slower and would spend the admin's rate limit
 * on typing.
 */
export function matchesSearch(ticket, term) {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    ticket.jira_issue_key,
    ticket.title,
    ticket.url,
    ticket.project_name,
    ticket.project_domain,
    ticket.issue_type,
    ticket.jira_status,
    ticket.jira_assignee,
  ];
  return haystack.some((value) => String(value || '').toLowerCase().includes(needle));
}

export function applyFilters(tickets, { view, search, status, priority, assignee, issueType, severity }) {
  return tickets.filter((ticket) => {
    if (!matchesView(ticket, view)) return false;
    if (status && ticket.jira_status !== status) return false;
    if (priority && ticket.jira_priority !== priority) return false;
    if (assignee && ticket.jira_assignee !== assignee) return false;
    if (issueType && ticket.issue_type !== issueType) return false;
    if (severity && ticket.severity !== severity) return false;
    return matchesSearch(ticket, search);
  });
}

/** Most urgent first, then the ones nobody has touched. */
const SEVERITY_RANK = { error: 0, warning: 1, notice: 2 };
const CATEGORY_RANK = { new: 0, indeterminate: 1, done: 2 };

export function sortTickets(tickets) {
  return [...tickets].sort(
    (a, b) =>
      (CATEGORY_RANK[a.jira_status_category] ?? 1) - (CATEGORY_RANK[b.jira_status_category] ?? 1) ||
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
      String(a.project_name || '').localeCompare(String(b.project_name || '')) ||
      String(a.jira_issue_key || '').localeCompare(String(b.jira_issue_key || ''), undefined, {
        numeric: true,
      })
  );
}

/** "3 h ago". Feed timestamps are ISO 8601 and already UTC. */
export function relativeTime(value) {
  if (!value) return 'never';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'unknown';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(ts).toISOString().slice(0, 10);
}

export function formatDate(value) {
  if (!value) return '—';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}
