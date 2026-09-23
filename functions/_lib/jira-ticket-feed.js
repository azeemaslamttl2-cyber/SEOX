// Resolving "show me this project's Jira tickets" into either tickets or a
// reason why not.
//
// *** THE RULE THIS MODULE ENFORCES ***
// An empty ticket list is a CLAIM: "SEOX asked Jira and Jira said none". It
// may only be returned when that actually happened. Every other outcome -
// nothing connected, nothing mapped, a rejected credential, a project the
// account cannot see, Jira unreachable - is a distinct state with its own
// code, and the caller is told which one. Collapsing any of them into `[]`
// is how a configuration mistake gets mistaken for a clean site, which is
// exactly the bug this module was written to fix.
//
// The chain, in order. Each step can only be attempted once the one before
// it succeeded, and each has its own failure code:
//
//   SEOX project            -> PROJECT_NOT_FOUND          (resolved by caller)
//   jira_connections row    -> JIRA_NOT_CONFIGURED
//   credential decryptable  -> JIRA_NOT_CONFIGURED (server key missing)
//   credential accepted     -> JIRA_AUTHENTICATION_FAILED
//   jira_project_mappings   -> JIRA_PROJECT_MAPPING_MISSING
//   mapping has a key       -> JIRA_PROJECT_KEY_MISSING
//   Jira project visible    -> JIRA_PROJECT_NOT_FOUND / JIRA_PERMISSION_DENIED
//   Jira reachable          -> JIRA_API_UNAVAILABLE
//   anything else           -> JIRA_API_ERROR
//   all of the above        -> OK, with tickets (possibly zero, honestly)
//
// NOTHING HERE TALKS TO JIRA DIRECTLY. Every call goes through
// jira-client.js (timeouts, retries, 429, SSRF, circuit breaker) and
// jira-search.js (the JQL endpoint that replaced the removed one).
//
// *** WHAT "TICKETS" MEANS BY DEFAULT ***
// Tickets that still need attention. Everything in Jira's `Done` status
// category - Done, Closed, Resolved, Completed, and whatever else that
// project renamed them to - is excluded IN THE JQL, so Jira leaves them out
// across the whole project before the first page is built. A caller that
// wants the finished ones asks for them: `status_category: "done"` for those
// alone, `include_resolved: true` (or `status_category: "all"`) for the whole
// board. resolveStatusFilter() is the single place that decision is made.

import {
  authenticateAdmin,
  httpError,
  parseProjectSelector,
  readAdminToken,
  resolveProjects,
} from './jira-eligible.js';
import { getConnection, getConnectionById, getMapping } from './jira-repository.js';
import { jiraEncryptionConfigured } from './jira-client.js';
import { EXCLUDE_DONE_JQL, projectJql, searchIssues } from './jira-search.js';
import {
  findProjectById,
  findProjectByKey,
  listAllJiraProjectsForUser,
} from './jira-projects.js';
import { listLinks, parseJson } from './jira-store.js';
import { toIso, SEOX_STATE_LABELS } from './jira-status-map.js';
import {
  TICKET_FIELDS,
  customFieldIds,
  describeTicket as describeJiraTicket,
  discoverTicketCustomFields,
} from './jira-ticket-fields.js';
import { jiraRequestForConnection } from './jira-client.js';

export const TICKET_STATES = Object.freeze({
  OK: 'OK',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  JIRA_NOT_CONFIGURED: 'JIRA_NOT_CONFIGURED',
  JIRA_AUTHENTICATION_FAILED: 'JIRA_AUTHENTICATION_FAILED',
  JIRA_PROJECT_MAPPING_MISSING: 'JIRA_PROJECT_MAPPING_MISSING',
  JIRA_PROJECT_KEY_MISSING: 'JIRA_PROJECT_KEY_MISSING',
  JIRA_PROJECT_NOT_FOUND: 'JIRA_PROJECT_NOT_FOUND',
  JIRA_PERMISSION_DENIED: 'JIRA_PERMISSION_DENIED',
  JIRA_API_UNAVAILABLE: 'JIRA_API_UNAVAILABLE',
  JIRA_API_ERROR: 'JIRA_API_ERROR',
});

/**
 * A flag that survives both transports this endpoint accepts.
 *
 * POST sends JSON, so `include_resolved` arrives as a real boolean. GET sends
 * a query string, where the same flag arrives as the STRING "true" - and
 * `Boolean("false")` is `true`, which would turn "do not include resolved
 * tickets" into "include them". So the string forms are matched explicitly and
 * everything else is false.
 */
export function readBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

/**
 * The Jira status categories a caller may ask for by name.
 *
 * These are Jira's own three, not SEOX's. `all` is not one of them - it is
 * this API's way of saying "no status filter at all" - so it is handled
 * separately rather than being smuggled into the same list.
 */
export const STATUS_CATEGORIES = Object.freeze(['new', 'indeterminate', 'done']);

/**
 * WHICH TICKETS A REQUEST WANTS, AND WHY THE DEFAULT EXCLUDES FINISHED ONES.
 *
 * The feed answers "what still needs attention on this board?". A closed
 * ticket does not, and on a board of any age the finished ones outnumber the
 * live ones by an order of magnitude - so returning them by default buries
 * the answer, wastes the page size on rows nobody asked for, and makes the
 * cursor walk through history before it reaches today's work.
 *
 * So the DEFAULT is "everything except Jira's Done category", expressed as a
 * JQL clause: Jira does the excluding, over the whole project, before a
 * single row crosses the wire. Filtering client-side would be wrong twice -
 * it would page through closed tickets to find open ones, and it would leak
 * the board's history to a caller that asked for none of it.
 *
 * Three ways to ask for something else, all explicit:
 *
 *   status_category: 'new' | 'indeterminate' | 'done'
 *                          exactly one category. 'done' is how a caller asks
 *                          for the finished tickets on purpose.
 *   status_category: 'all'  or  include_resolved: true
 *                          no status filter; the whole board.
 *
 * @returns {{statusCategory: string|null, includeResolved: boolean, jql: string}}
 */
export function resolveStatusFilter({ statusCategory = '', includeResolved = false } = {}) {
  const category = String(statusCategory || '').trim().toLowerCase();

  if (STATUS_CATEGORIES.includes(category)) {
    return {
      statusCategory: category,
      // Asking for the done category IS asking for resolved tickets. Saying
      // so here keeps the post-filter below from throwing away the very rows
      // the caller requested.
      includeResolved: category === 'done',
      jql: `statusCategory = "${category}"`,
    };
  }

  if (category === 'all' || includeResolved) {
    return { statusCategory: null, includeResolved: true, jql: '' };
  }

  return { statusCategory: null, includeResolved: false, jql: EXCLUDE_DONE_JQL };
}

/**
 * A second, local pass over what Jira returned.
 *
 * The JQL above is what actually does the work; this is a guarantee, not a
 * filter. The contract this module publishes is "unless you asked for them,
 * the response contains no finished tickets", and a contract that depends
 * entirely on a remote system parsing a clause the way we expect is a
 * contract with a way to fail silently. Each ticket already carries the
 * category Jira reported, so re-checking it costs one string compare and
 * makes the guarantee local.
 */
export function dropResolvedTickets(tickets, includeResolved) {
  if (includeResolved) return tickets;
  return tickets.filter(
    (ticket) => String(ticket?.status?.category || '').toLowerCase() !== 'done'
  );
}

/**
 * The OK message, which has to say WHICH tickets were counted.
 *
 * "Retrieved 0 Jira tickets" is ambiguous when a filter is in play: the
 * board could be empty, or it could be full of closed tickets that were
 * correctly left out. Naming the filter in the sentence is what stops a
 * healthy board with everything resolved from reading like a broken query.
 */
function describeResult(count, projectKey, statusFilter) {
  const scope = statusFilter.statusCategory
    ? ` in the "${statusFilter.statusCategory}" status category`
    : statusFilter.includeResolved
      ? ''
      : ' that are not resolved';

  return count
    ? `Retrieved ${count} Jira ticket${count === 1 ? '' : 's'}${scope} from ${projectKey}.`
    : `Jira project ${projectKey} was queried successfully and returned no issues${scope}.`;
}

/** Does this state mean "the answer is trustworthy"? */
export function isOk(code) {
  return code === TICKET_STATES.OK;
}

function state(code, message, extra = {}) {
  return { ok: code === TICKET_STATES.OK, code, message, ...extra };
}

/**
 * Turn an error from jira-client.js into one of our codes.
 *
 * The client has already normalised transport failures: a connect timeout is
 * 504, an unreachable host is 502, an open circuit breaker is 503, and Jira's
 * own 4xx keeps its status. What is left is deciding which of those the user
 * can act on, and how.
 */
function classifyJiraError(error, { projectKey = '' } = {}) {
  const status = Number(error?.httpStatus || error?.status || 0);
  const code = String(error?.code || '');

  if (status === 401 || code === 'INVALID_CREDENTIALS') {
    return state(
      TICKET_STATES.JIRA_AUTHENTICATION_FAILED,
      'SEOX could not authenticate with Jira. The stored email or API token is no longer valid - reconnect Jira in Settings > Jira.'
    );
  }
  if (status === 403) {
    return state(
      TICKET_STATES.JIRA_PERMISSION_DENIED,
      projectKey
        ? `The connected Jira account does not have permission to browse issues in Jira project ${projectKey}.`
        : 'The connected Jira account does not have permission to perform this search.'
    );
  }
  if (code === 'CIRCUIT_OPEN' || status === 502 || status === 503 || status === 504) {
    return state(
      TICKET_STATES.JIRA_API_UNAVAILABLE,
      'Jira could not be reached. SEOX will keep working; try again shortly.',
      error?.retryAfterSeconds ? { retry_after_seconds: error.retryAfterSeconds } : {}
    );
  }
  if (status === 429 || code === 'RATE_LIMITED') {
    return state(
      TICKET_STATES.JIRA_API_UNAVAILABLE,
      'Jira is rate limiting SEOX. Try again in a minute.',
      error?.retryAfterSeconds ? { retry_after_seconds: error.retryAfterSeconds } : {}
    );
  }
  if (status === 410) {
    // The removed /rest/api/3/search. If this ever appears again it means a
    // call site was missed, and it must not be reported as a vague API error.
    return state(
      TICKET_STATES.JIRA_API_ERROR,
      'SEOX called a Jira API that Atlassian has removed. This is a SEOX bug - please report it.'
    );
  }

  // Jira answered with something we did not anticipate. Its own message is
  // already sanitised by describeJiraFailure() in jira-client.js and is far
  // more useful than a generic string, so it is passed through.
  return state(
    TICKET_STATES.JIRA_API_ERROR,
    error?.message || 'Jira returned an unexpected response.'
  );
}

/**
 * A JQL 400 that names the project field means the key is wrong OR invisible
 * to this account - Jira deliberately does not distinguish those in search.
 * One extra call to the project resource does distinguish them, and it is
 * only ever made on the error path.
 */
async function disambiguateProjectFailure(env, connection, projectKey) {
  try {
    await jiraRequestForConnection(env, connection, {
      path: `/rest/api/3/project/${encodeURIComponent(projectKey)}`,
      kind: 'interactive',
    });
    // The project exists and is readable, so the search failed for some other
    // reason - report the honest, less specific answer.
    return state(
      TICKET_STATES.JIRA_API_ERROR,
      `Jira rejected the issue search for project ${projectKey}, although the project itself is readable.`
    );
  } catch (error) {
    const status = Number(error?.httpStatus || error?.status || 0);
    if (status === 404) {
      return state(
        TICKET_STATES.JIRA_PROJECT_NOT_FOUND,
        `Jira project "${projectKey}" does not exist, or the connected Jira account cannot see it. Check the project mapping in Settings > Jira.`
      );
    }
    if (status === 403) {
      return state(
        TICKET_STATES.JIRA_PERMISSION_DENIED,
        `The connected Jira account does not have permission to view Jira project ${projectKey}.`
      );
    }
    return classifyJiraError(error, { projectKey });
  }
}

function looksLikeUnknownProject(error) {
  const status = Number(error?.httpStatus || error?.status || 0);
  if (status !== 400) return false;
  const text = JSON.stringify(error?.jiraErrors || error?.message || '');
  return /does not exist for the field ['"]?project|no project could be found/i.test(text);
}

// --- shaping ---------------------------------------------------------------

/**
 * One Jira issue, plus whatever SEOX knows about it.
 *
 * `seox` is null for an issue SEOX did not file, and that is the common case
 * here - this feed shows the Jira project's real contents, not only the
 * tickets SEOX created. A ticket raised by hand in Jira is a perfectly valid
 * row; it simply has no finding attached.
 */
/**
 * What SEOX knows about a ticket it filed.
 *
 * `finding_snapshot` is what the finding looked like when the issue was
 * created. It is the only place the current/expected values survive - SEOX
 * has no findings table, so re-deriving them would mean re-running the
 * module - and it is what lets the detail panel show the SEO context beside
 * the Jira fields.
 */
function describeSeoxSide(link) {
  const snapshot = parseJson(link.finding_snapshot, {}) || {};
  return {
    link_id: link.id,
    fingerprint: link.fingerprint,
    finding_title: link.finding_title,
    finding_type: link.finding_type,
    source_module: link.source_module,
    severity: link.severity,
    affected_url: link.affected_url || '',
    affected_url_count: Number(link.affected_url_count || 1),
    current_value: snapshot.currentValue || '',
    expected_value: snapshot.expectedValue || '',
    seox_state: link.seox_state,
    seox_state_label: SEOX_STATE_LABELS[link.seox_state] || link.seox_state,
    verified_at: toIso(link.verified_at),
    reopened_count: Number(link.reopened_count || 0),
    last_synced_at: toIso(link.last_synced_at),
    seox_project_id: link.project_id,
  };
}

/**
 * One ticket: the Jira side from jira-ticket-fields.js, the SEOX side from
 * the link row when there is one.
 *
 * The Jira shaping lives in the other module so that the route, the detail
 * panel and anything added later all describe an issue identically. A second
 * shaper is how one screen gains a `url` and another does not.
 */
function describeTicket(issue, link, baseUrl, customFields) {
  return describeJiraTicket(issue, {
    baseUrl,
    customFields,
    seox: link ? describeSeoxSide(link) : null,
  });
}

/**
 * The exact `fields` parameter for this connection.
 *
 * Sprint and story points are appended by id because their ids are per-site;
 * see discoverTicketCustomFields(). A site with neither yields the base list
 * and no error - that is a Jira configuration, not a fault.
 */
function ticketFieldList(customFields) {
  return [...TICKET_FIELDS, ...customFieldIds(customFields)].join(',');
}

// --- entry point -----------------------------------------------------------

/**
 * Tickets for ONE SEOX project, or the reason there are none.
 *
 * @returns {Promise<{state: object, tickets: object[], jira: object,
 *                    next_page_token: string|null}>}
 */
export async function getProjectTickets(
  env,
  { userId, project, limit = 50, pageToken = '', statusFilter = resolveStatusFilter() }
) {
  const jira = {
    configured: false,
    connected: false,
    base_url: null,
    account_email: null,
    mapped: false,
    project_id: null,
    project_key: null,
    project_name: null,
  };
  const empty = (s) => ({ state: s, tickets: [], jira, next_page_token: null });

  // 1. Is Jira connected for this project at all?
  const connection = await getConnection(userId, project.project_id);
  if (!connection || connection.status === 'disconnected' || !connection.api_token_encrypted) {
    return empty(
      state(
        TICKET_STATES.JIRA_NOT_CONFIGURED,
        `Jira is not connected for "${project.project_name || project.domain}". Connect Jira for this project in Settings > Jira.`
      )
    );
  }

  jira.configured = true;
  jira.base_url = String(connection.base_url || '').replace(/\/+$/, '');
  jira.account_email = connection.account_email || null;

  // The server-side key is what decrypts the stored token. Without it no
  // credential can be used, and that is an operator problem, not a user one.
  if (!jiraEncryptionConfigured(env)) {
    return empty(
      state(
        TICKET_STATES.JIRA_NOT_CONFIGURED,
        'Jira is not configured on this server: JIRA_TOKEN_ENCRYPTION_KEY is not set, so the stored Jira credential cannot be decrypted.'
      )
    );
  }

  if (connection.status === 'invalid_credentials') {
    return empty(
      state(
        TICKET_STATES.JIRA_AUTHENTICATION_FAILED,
        connection.status_detail ||
          'The stored Jira credentials were rejected by Jira. Reconnect Jira in Settings > Jira.'
      )
    );
  }

  jira.connected = true;

  // 2. Is a Jira project mapped to this SEOX project?
  const mapping = await getMapping(userId, project.project_id);
  if (!mapping) {
    return empty(
      state(
        TICKET_STATES.JIRA_PROJECT_MAPPING_MISSING,
        `Jira is connected, but no Jira project is mapped to "${project.project_name || project.domain}". Choose one in Settings > Jira.`
      )
    );
  }

  jira.mapped = true;
  // Jira's own numeric id as well as the key. The key is what a human reads
  // and what JQL takes; the id is what the metadata endpoints and the
  // settings mapping form use, so a caller that has one should not have to
  // make another request to get the other.
  jira.project_id = mapping.jira_project_id ? String(mapping.jira_project_id) : null;
  jira.project_key = mapping.jira_project_key || null;
  jira.project_name = mapping.jira_project_name || null;

  if (!mapping.jira_project_key) {
    return empty(
      state(
        TICKET_STATES.JIRA_PROJECT_KEY_MISSING,
        'This SEOX project is mapped to Jira, but the mapping has no Jira project key. Re-save the mapping in Settings > Jira.'
      )
    );
  }

  // 3. Ask Jira. This is the only place a ticket list can legitimately come
  //    back empty.
  //
  //    The status clause is part of the JQL, so Jira excludes the finished
  //    tickets across the whole project before paging. Doing it here rather
  //    than after the response is what makes "the first page is the work that
  //    is still open" true on a board with ten years of closed issues on it.
  const jql = projectJql(mapping.jira_project_key, { extra: statusFilter.jql });

  // Which custom fields carry sprint and story points on THIS Jira site.
  // Cached per connection, and never fatal: a site without them still has
  // tickets.
  const customFields = await discoverTicketCustomFields(env, connection);

  let page;
  try {
    page = await searchIssues(env, connection, {
      jql,
      fields: ticketFieldList(customFields),
      maxResults: limit,
      pageToken,
      kind: 'interactive',
    });
  } catch (error) {
    if (looksLikeUnknownProject(error)) {
      return empty(await disambiguateProjectFailure(env, connection, mapping.jira_project_key));
    }
    return empty(classifyJiraError(error, { projectKey: mapping.jira_project_key }));
  }

  // 4. Attach SEOX's own knowledge where it has some. One query for the whole
  //    project, indexed in memory - never one lookup per ticket.
  const links = await listLinks(userId, project.project_id, { limit: 1000 });
  const byKey = new Map();
  for (const link of links) {
    if (link.jira_issue_key) byKey.set(String(link.jira_issue_key), link);
  }

  const tickets = dropResolvedTickets(
    page.issues.map((issue) =>
      describeTicket(issue, byKey.get(String(issue?.key || '')) || null, jira.base_url, customFields)
    ),
    statusFilter.includeResolved
  );

  return {
    state: state(
      TICKET_STATES.OK,
      describeResult(tickets.length, mapping.jira_project_key, statusFilter)
    ),
    tickets,
    jira,
    next_page_token: page.isLast ? null : page.nextPageToken,
  };
}

/**
 * Lift the single-project case to the top of the response.
 *
 * The envelope is `projects[]` because a request may legitimately cover
 * several internal projects, and because each one carries its own `state` -
 * the mechanism that keeps "Jira said none" distinguishable from "SEOX could
 * not ask". Neither of those is worth losing.
 *
 * But the overwhelmingly common request names ONE project, and a caller that
 * then has to reach through `projects[0]` to find the tickets it asked for is
 * being made to pay for a generality it did not use. So the one-project case
 * is also published flat: `project`, `jiraProject` and `tickets`. Both views
 * are the same objects, so they cannot disagree.
 */
function withSingleProjectView(payload) {
  const only = Array.isArray(payload.projects) && payload.projects.length === 1
    ? payload.projects[0]
    : null;
  if (!only) return payload;

  return {
    ...payload,
    project: only.project,
    jiraProject: only.jira?.project_key
      ? {
          id: only.jira.project_id || null,
          key: only.jira.project_key,
          name: only.jira.project_name || '',
          baseUrl: only.jira.base_url || '',
        }
      : null,
    // `state` is repeated here deliberately: a caller reading the flat view
    // must not have to know that the honest-failure reporting lives one level
    // down, or it will read `tickets: []` as "nothing to do".
    state: only.state,
    tickets: only.tickets,
    ticketCount: only.ticket_count,
    nextPageToken: only.next_page_token,
  };
}

/**
 * The whole `mode: "tickets"` response for one request.
 *
 * Project selection - all projects, `project_id`, or `url` - goes through
 * jira-eligible.js's own resolver, so this endpoint and the finding feed can
 * never disagree about which SEOX project a URL names.
 *
 * COST: one Jira search per project that is actually connected AND mapped.
 * A project that is not configured costs zero Jira calls, because its answer
 * is decided from the database. In practice a user selects one project and
 * this is one Jira call.
 */
export async function getJiraTicketFeed(env, params = {}) {
  const adminToken = readAdminToken(params);
  const admin = await authenticateAdmin(adminToken);

  const rawLimit = Number(params?.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
  const pageToken = typeof params?.page_token === 'string' ? params.page_token.trim() : '';

  const statusCategory = String(params?.status_category || '').trim().toLowerCase();
  if (statusCategory && ![...STATUS_CATEGORIES, 'all'].includes(statusCategory)) {
    throw httpError('status_category must be one of: new, indeterminate, done, all', 400);
  }

  // Resolved tickets are excluded unless the caller says otherwise. See
  // resolveStatusFilter() for why that is the default rather than an option.
  const statusFilter = resolveStatusFilter({
    statusCategory,
    includeResolved: readBoolean(params?.include_resolved),
  });

  // *** SELECTING BY JIRA PROJECT ***
  //
  // The Jira Tickets page's selector picks a JIRA project (WUCP), not a SEOX
  // project (https://ucp.edu.pk/). When it does, the SEOX side is skipped
  // entirely: no URL is matched against a domain, no mapping is consulted,
  // and the Jira project key is the one Jira itself reported - never
  // inferred from a website address.
  const jiraProjectKey = String(params?.jira_project_key || '').trim();
  const jiraProjectId = String(params?.jira_project_id || '').trim();
  if (jiraProjectKey || jiraProjectId) {
    return getTicketsByJiraProject(env, admin, {
      jiraProjectKey,
      jiraProjectId,
      limit,
      pageToken,
      statusFilter,
    });
  }

  const selector = parseProjectSelector(params);

  // Throws 404 'Project not found' / 'Project not found for the specified URL',
  // and 400 when project_id and url name different projects.
  const projects = await resolveProjects(admin.id, selector);

  // A page token belongs to one project's cursor; applying it across a
  // multi-project request would silently paginate the wrong list.
  if (pageToken && projects.length !== 1) {
    throw httpError('page_token requires a single project_id or url', 400);
  }

  const described = [];
  for (const project of projects) {
    const result = await getProjectTickets(env, {
      userId: admin.id,
      project,
      limit,
      pageToken,
      statusFilter,
    });

    described.push({
      project: {
        project_id: project.project_id,
        project_name: project.project_name,
        project_url: project.full_url,
        domain: project.domain,
      },
      jira: result.jira,
      state: result.state,
      tickets: result.tickets,
      ticket_count: result.tickets.length,
      next_page_token: result.next_page_token,
    });
  }

  const usable = described.filter((entry) => entry.state.ok);
  const failing = described.filter((entry) => !entry.state.ok);

  return withSingleProjectView({
    // `success` describes the REQUEST, not the configuration. Whether the
    // tickets are trustworthy is `state.ok` per project, and the summary
    // below says how many projects could actually be asked.
    success: true,
    mode: 'tickets',
    // Echoed back so the caller can tell WHICH question was answered. A
    // client that does not know the resolved tickets were excluded cannot
    // tell "nothing is open" from "nothing exists".
    filters: {
      project_id: selector.projectId || null,
      url: selector.url || null,
      status_category: statusFilter.statusCategory,
      include_resolved: statusFilter.includeResolved,
    },
    summary: {
      total_projects: described.length,
      projects_queried: usable.length,
      projects_with_errors: failing.length,
      total_tickets: usable.reduce((sum, entry) => sum + entry.ticket_count, 0),
      // The single most useful thing for a caller that asked about one
      // project: what went wrong, if anything.
      first_error: failing.length
        ? { project_id: failing[0].project.project_id, ...failing[0].state }
        : null,
    },
    projects: described,
  });
}

/**
 * Tickets for a Jira project the user picked directly.
 *
 * AUTHORISATION: the project must appear in the list this user's own Jira
 * credentials can see. That list comes from Jira, which applies the
 * credential's own permissions, so a board the user's Jira account cannot
 * read is never in it and a key naming one is refused as not found. No SEOX
 * mapping is required - the page is allowed to read any board the connected
 * account can read, which is exactly what the user asked for.
 *
 * The SEOX side is still attached where it exists: if any SEOX project is
 * mapped to this Jira project, that project's `jira_issue_links` rows are
 * joined in, so a ticket SEOX filed still shows its finding.
 */
async function getTicketsByJiraProject(
  env,
  admin,
  { jiraProjectKey, jiraProjectId, limit, pageToken, statusFilter }
) {
  const { projects, errors, siteCount } = await listAllJiraProjectsForUser(env, admin.id);

  if (!siteCount) {
    return jiraProjectResponse({
      requested: jiraProjectKey || jiraProjectId,
      statusFilter,
      state: state(
        TICKET_STATES.JIRA_NOT_CONFIGURED,
        'No Jira connection is set up for this account. Connect Jira for a project in Settings > Jira.'
      ),
    });
  }

  const match =
    findProjectByKey(projects, jiraProjectKey) || findProjectById(projects, jiraProjectId);

  if (!match) {
    // A listing failure and a genuinely unknown key are different problems.
    if (errors.length && !projects.length) {
      return jiraProjectResponse({
        requested: jiraProjectKey || jiraProjectId,
        statusFilter,
        state: state(
          errors[0].code === 'JIRA_AUTHENTICATION_FAILED'
            ? TICKET_STATES.JIRA_AUTHENTICATION_FAILED
            : TICKET_STATES.JIRA_API_ERROR,
          errors[0].message
        ),
      });
    }
    return jiraProjectResponse({
      requested: jiraProjectKey || jiraProjectId,
      statusFilter,
      state: state(
        TICKET_STATES.JIRA_PROJECT_NOT_FOUND,
        `Jira project "${jiraProjectKey || jiraProjectId}" is not one the connected Jira account can see.`
      ),
    });
  }

  const connection = await getConnectionById(match.connection_id);
  if (!connection || String(connection.user_id) !== String(admin.id)) {
    return jiraProjectResponse({
      requested: match.key,
      statusFilter,
      state: state(
        TICKET_STATES.JIRA_NOT_CONFIGURED,
        'The Jira connection behind this project is no longer available.'
      ),
    });
  }

  const jira = {
    configured: true,
    connected: true,
    base_url: match.base_url,
    account_email: connection.account_email || null,
    mapped: match.seox_projects.length > 0,
    project_id: match.id,
    project_key: match.key,
    project_name: match.name,
    seox_projects: match.seox_projects,
  };

  // Same status clause as the SEOX-project route, for the same reason: the
  // finished tickets are excluded by Jira, not after the fact.
  const jql = projectJql(match.key, { extra: statusFilter.jql });

  const customFields = await discoverTicketCustomFields(env, connection);

  let page;
  try {
    page = await searchIssues(env, connection, {
      jql,
      fields: ticketFieldList(customFields),
      maxResults: limit,
      pageToken,
      kind: 'interactive',
    });
  } catch (error) {
    const failure = looksLikeUnknownProject(error)
      ? await disambiguateProjectFailure(env, connection, match.key)
      : classifyJiraError(error, { projectKey: match.key });
    return jiraProjectResponse({ requested: match.key, jira, statusFilter, state: failure });
  }

  // SEOX findings for whichever SEOX projects map to this Jira project.
  // Usually none, and that is fine - most tickets on a real board were
  // raised by hand.
  const byKey = new Map();
  for (const seoxProjectId of match.seox_projects) {
    const links = await listLinks(admin.id, seoxProjectId, { limit: 1000 });
    for (const link of links) {
      if (link.jira_issue_key) byKey.set(String(link.jira_issue_key), link);
    }
  }

  const tickets = dropResolvedTickets(
    page.issues.map((issue) =>
      describeTicket(issue, byKey.get(String(issue?.key || '')) || null, match.base_url, customFields)
    ),
    statusFilter.includeResolved
  );

  return jiraProjectResponse({
    requested: match.key,
    jira,
    state: state(TICKET_STATES.OK, describeResult(tickets.length, match.key, statusFilter)),
    tickets,
    statusFilter,
    nextPageToken: page.isLast ? null : page.nextPageToken,
  });
}

/**
 * The same envelope the SEOX-project mode returns, so the page renders one
 * shape whichever selector produced it.
 */
function jiraProjectResponse({
  requested,
  jira = null,
  state: entryState,
  tickets = [],
  statusFilter = resolveStatusFilter(),
  nextPageToken = null,
}) {
  const resolved = jira || {
    configured: false,
    connected: false,
    base_url: null,
    account_email: null,
    mapped: false,
    project_id: null,
    project_key: requested || null,
    project_name: null,
    seox_projects: [],
  };

  return withSingleProjectView({
    success: true,
    mode: 'tickets',
    filters: {
      project_id: null,
      url: null,
      jira_project_key: resolved.project_key,
      status_category: statusFilter.statusCategory,
      include_resolved: statusFilter.includeResolved,
    },
    summary: {
      total_projects: 1,
      projects_queried: entryState.ok ? 1 : 0,
      projects_with_errors: entryState.ok ? 0 : 1,
      total_tickets: tickets.length,
      first_error: entryState.ok ? null : { project_id: null, ...entryState },
    },
    projects: [
      {
        // There is no SEOX project in this mode. The Jira project identifies
        // the row, and saying so beats inventing a SEOX project that the
        // user did not choose.
        project: {
          project_id: null,
          project_name: resolved.project_name || resolved.project_key || 'Jira project',
          project_url: '',
          domain: '',
        },
        jira: resolved,
        state: entryState,
        tickets,
        ticket_count: tickets.length,
        next_page_token: nextPageToken,
      },
    ],
  });
}
