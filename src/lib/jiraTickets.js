/**
 * Turning the `/api/jira/tickets` response into the rows the Jira Tickets page
 * renders, and deciding which of them still need action.
 *
 * Pure on purpose: the response shape (projects[], each with its own `state`
 * and `tickets[]`) and the definition of "pending" are the two things most
 * likely to be got subtly wrong, and both are testable here without a browser
 * or a server.
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
  return String(ticket?.status?.category || '').toLowerCase() !== 'done';
}

export const STATUS_VIEWS = Object.freeze([
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Resolved' },
  { id: 'all', label: 'All' },
]);

/**
 * The SERVER-SIDE query behind each view.
 *
 * The views are not four ways of slicing one downloaded list any more. The
 * feed excludes resolved tickets unless asked, because on a board of any age
 * the closed ones outnumber the open ones and a client-side filter would
 * page through all of them to find this week's work. So switching view
 * re-asks Jira, with the filter Jira itself can apply.
 *
 * `matchesView()` below still runs over the result. That is deliberate
 * belt-and-braces, not duplication: after a transition the page updates the
 * affected row in place rather than reloading, so a ticket just resolved from
 * the Pending view has to stop matching it without another round trip.
 */
export function requestForView(view) {
  switch (view) {
    case 'in_progress':
      return { statusCategory: 'indeterminate', includeResolved: false };
    case 'done':
      // The one view that asks for the finished tickets on purpose.
      return { statusCategory: 'done', includeResolved: true };
    case 'all':
      return { statusCategory: '', includeResolved: true };
    default:
      // Pending: the feed's own default - everything not in Jira's Done
      // category, decided by Jira, not by this list.
      return { statusCategory: '', includeResolved: false };
  }
}

export function matchesView(ticket, view) {
  const category = String(ticket?.status?.category || '').toLowerCase();
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
 * Flatten the `/api/jira/tickets` response into one list of rows.
 *
 * Every ticket here came back from a live Jira query, so a ticket that was
 * raised by hand in Jira is a first-class row - it simply has `seox: null`
 * because no SEOX finding produced it. That is the whole difference from the
 * old behaviour, which could only ever show tickets SEOX itself had filed and
 * therefore showed nothing at all on a real, busy Jira board.
 */
export function flattenTickets(feed) {
  const projects = Array.isArray(feed?.projects) ? feed.projects : [];
  const tickets = [];

  for (const entry of projects) {
    const project = entry?.project || {};
    const rows = Array.isArray(entry?.tickets) ? entry.tickets : [];
    for (const ticket of rows) {
      // `key` is what identifies a ticket everywhere - in the table, in the
      // detail panel, in the transition call. A row without one cannot be
      // acted on, so it is not a row.
      if (!ticket?.key) continue;
      const seox = ticket.seox || null;
      tickets.push({
        // The ticket as /api/jira/tickets returned it, unflattened: `url`,
        // `summary`, `status`, `priority`, `assignee`, `issueType`, `labels`,
        // `components`, `fixVersions`, `comments`, `attachments`, `sprints`,
        // `storyPoints`, `description`. Spread rather than picked, so a field
        // added server-side reaches the UI without a second edit here.
        ...ticket,
        // Which INTERNAL project this row belongs to. The Jira issue knows
        // its Jira project; only the feed knows the SEOX one.
        projectId: project.project_id,
        projectName: project.project_name || project.domain || project.project_id,
        projectUrl: project.project_url || '',
        projectDomain: project.domain || '',
        jiraProjectKey: ticket.project?.key || entry?.jira?.project_key || '',
        // The SEO finding behind the ticket, if SEOX filed it. Lifted to the
        // row because the table renders one flat shape per column.
        severity: seox?.severity || '',
        affectedUrl: seox?.affected_url || '',
        sourceModule: seox?.source_module || '',
        seoxState: seox?.seox_state || '',
        seoxStateLabel: seox?.seox_state_label || '',
      });
    }
  }

  return tickets;
}

/** Every project the feed covered, with the state each one reported. */
export function projectsFromFeed(feed) {
  const projects = Array.isArray(feed?.projects) ? feed.projects : [];
  return projects.map((entry) => ({
    ...(entry?.project || {}),
    jira: entry?.jira || null,
    state: entry?.state || null,
    ticket_count: Number(entry?.ticket_count || 0),
    next_page_token: entry?.next_page_token || null,
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
    if (ticket.status?.name) {
      statuses.set(ticket.status.name, ticket.status.category || '');
    }
    if (ticket.priority?.name) priorities.add(ticket.priority.name);
    if (ticket.assignee?.displayName) assignees.add(ticket.assignee.displayName);
    if (ticket.issueType?.name) issueTypes.add(ticket.issueType.name);
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
    ticket.key,
    ticket.summary,
    ticket.affectedUrl,
    ticket.projectName,
    ticket.projectDomain,
    ticket.issueType?.name,
    ticket.status?.name,
    ticket.assignee?.displayName,
    ...(Array.isArray(ticket.labels) ? ticket.labels : []),
    // The SEO finding's own title, for a ticket SEOX filed - the Jira summary
    // is often an AI-rewritten version of it, so searching one is not
    // searching the other.
    ticket.seox?.finding_title,
  ];
  return haystack.some((value) => String(value || '').toLowerCase().includes(needle));
}

export function applyFilters(tickets, { view, search, status, priority, assignee, issueType, severity }) {
  return tickets.filter((ticket) => {
    if (!matchesView(ticket, view)) return false;
    if (status && ticket.status?.name !== status) return false;
    if (priority && ticket.priority?.name !== priority) return false;
    if (assignee && ticket.assignee?.displayName !== assignee) return false;
    if (issueType && ticket.issueType?.name !== issueType) return false;
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
      (CATEGORY_RANK[a.status?.category] ?? 1) - (CATEGORY_RANK[b.status?.category] ?? 1) ||
      // A ticket with no SEO severity is not "least severe" - it simply has
      // none, so it sorts after the graded ones rather than above notices.
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
      String(a.projectName || '').localeCompare(String(b.projectName || '')) ||
      String(b.updated || '').localeCompare(String(a.updated || '')) ||
      String(a.key || '').localeCompare(String(b.key || ''), undefined, {
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
