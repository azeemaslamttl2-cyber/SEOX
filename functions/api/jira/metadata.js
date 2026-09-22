// GET /api/jira/metadata?projectId=<seoxId>&resource=<name>
//
//   projects      the Jira projects the connected account can see
//   issue-types   the types creatable in ONE Jira project
//   statuses      that project's workflow statuses (for display only)
//   priorities    the instance priority scheme
//   assignable    users assignable on that project
//   components    that project's components
//
// One file rather than six near-identical ones: they share the auth guard,
// the rate limit, the cache and the client, and six copies of that would be
// exactly the duplicated logic this integration is meant to avoid.
//
// Results are cached per connection for a few minutes. Jira project lists
// change rarely and the settings page asks for them on every open.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, errorResponse, jsonResponse } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { requireJiraConnection, requireJiraProject, httpError } from '../../_lib/jira-request.js';
import { jiraRequestForConnection } from '../../_lib/jira-client.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  // Bounded so a long-lived process cannot accumulate one entry per
  // connection per resource indefinitely.
  if (cache.size > 200) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function listProjects(env, connection, query) {
  const { data } = await jiraRequestForConnection(env, connection, {
    path: '/rest/api/3/project/search',
    query: { maxResults: 50, query: query || undefined, orderBy: 'name' },
    kind: 'interactive',
  });
  return {
    projects: (data?.values || []).map((project) => ({
      id: String(project.id),
      key: project.key,
      name: project.name,
      projectTypeKey: project.projectTypeKey || '',
    })),
    total: Number(data?.total || 0),
  };
}

async function listIssueTypes(env, connection, jiraProjectId) {
  if (!jiraProjectId) throw httpError('A Jira project is required.', 400);

  // createmeta is the only form that reflects the project's own issue type
  // scheme. The global /rest/api/3/issuetype list happily offers types that
  // then fail at create time.
  const { data } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/issue/createmeta/${encodeURIComponent(jiraProjectId)}/issuetypes`,
    query: { maxResults: 100 },
    kind: 'interactive',
  });

  const values = Array.isArray(data?.issueTypes) ? data.issueTypes : data?.values || [];
  return {
    issueTypes: values
      // Subtasks are filtered out: SEOX has no parent issue to attach one to.
      .filter((type) => !type.subtask)
      .map((type) => ({
        id: String(type.id),
        name: type.name,
        description: type.description || '',
        iconUrl: type.iconUrl || '',
      })),
  };
}

async function listStatuses(env, connection, jiraProjectId) {
  if (!jiraProjectId) throw httpError('A Jira project is required.', 400);
  const { data } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/project/${encodeURIComponent(jiraProjectId)}/statuses`,
    kind: 'interactive',
  });

  const seen = new Map();
  for (const type of Array.isArray(data) ? data : []) {
    for (const status of type.statuses || []) {
      if (seen.has(status.id)) continue;
      seen.set(status.id, {
        id: String(status.id),
        name: status.name,
        statusCategory: status.statusCategory?.key || '',
      });
    }
  }
  return { statuses: [...seen.values()] };
}

async function listPriorities(env, connection) {
  const { data } = await jiraRequestForConnection(env, connection, {
    path: '/rest/api/3/priority',
    kind: 'interactive',
  });
  return {
    priorities: (Array.isArray(data) ? data : []).map((priority) => ({
      id: String(priority.id),
      name: priority.name,
      iconUrl: priority.iconUrl || '',
    })),
  };
}

async function listAssignable(env, connection, jiraProjectKey, query) {
  if (!jiraProjectKey) throw httpError('A Jira project key is required.', 400);
  const { data } = await jiraRequestForConnection(env, connection, {
    path: '/rest/api/3/user/assignable/search',
    query: { project: jiraProjectKey, query: query || undefined, maxResults: 30 },
    kind: 'interactive',
  });
  return {
    // Deliberately no emailAddress: a Jira user's email is third-party
    // personal data SEOX has no need for and therefore never stores or
    // forwards to the browser.
    users: (Array.isArray(data) ? data : []).map((user) => ({
      accountId: String(user.accountId),
      displayName: user.displayName || '',
      avatarUrl: user.avatarUrls?.['24x24'] || '',
    })),
  };
}

async function listComponents(env, connection, jiraProjectId) {
  if (!jiraProjectId) throw httpError('A Jira project is required.', 400);
  const { data } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/project/${encodeURIComponent(jiraProjectId)}/components`,
    query: { maxResults: 100 },
    kind: 'interactive',
  });
  const values = Array.isArray(data) ? data : data?.values || [];
  return {
    components: values.map((component) => ({
      id: String(component.id),
      name: component.name,
    })),
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  try {
    configureMysqlConnection(env);
    const user = await verifyAccessToken(request, env);

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const resource = String(url.searchParams.get('resource') || 'projects');
    const jiraProjectId = url.searchParams.get('jiraProjectId') || '';
    const jiraProjectKey = url.searchParams.get('jiraProjectKey') || '';
    const search = url.searchParams.get('query') || '';

    const project = await requireJiraProject(user.id, projectId);
    const connection = await requireJiraConnection(user.id, project.project_id);

    // A search term makes the result per-query, so it is not cached.
    const cacheKey = search ? null : `${connection.id}:${resource}:${jiraProjectId}${jiraProjectKey}`;
    const cached = cacheKey ? cacheGet(cacheKey) : null;
    if (cached) return jsonResponse({ ...cached, cached: true }, 200, headers);

    await consumeRateLimit(user.id, 'jira:metadata');

    let payload;
    switch (resource) {
      case 'projects':
        payload = await listProjects(env, connection, search);
        break;
      case 'issue-types':
        payload = await listIssueTypes(env, connection, jiraProjectId);
        break;
      case 'statuses':
        payload = await listStatuses(env, connection, jiraProjectId);
        break;
      case 'priorities':
        payload = await listPriorities(env, connection);
        break;
      case 'assignable':
        payload = await listAssignable(env, connection, jiraProjectKey, search);
        break;
      case 'components':
        payload = await listComponents(env, connection, jiraProjectId);
        break;
      default:
        return jsonResponse({ error: 'Unknown resource' }, 400, headers);
    }

    if (cacheKey) cacheSet(cacheKey, payload);
    return jsonResponse({ ...payload, cached: false }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
