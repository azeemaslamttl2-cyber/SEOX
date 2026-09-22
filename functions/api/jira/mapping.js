// GET  /api/jira/mapping?projectId=<id>   read the mapping
// POST /api/jira/mapping                  create or update it
//
// The mapping is validated against Jira before it is saved. Issue type
// schemes and component lists are per project, so an id that is valid in one
// Jira project can be rejected by another - catching that here means the
// user finds out while they are on the settings screen, not three weeks
// later when someone tries to file a finding.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireJiraConnection, requireJiraProject, httpError } from '../../_lib/jira-request.js';
import { describeMapping, getMapping, upsertMapping } from '../../_lib/jira-repository.js';
import { logSync } from '../../_lib/jira-store.js';
import { jiraRequestForConnection } from '../../_lib/jira-client.js';
import { sanitizeLabel, REQUIRED_LABEL } from '../../_lib/jira-issue-builder.js';

const REOPEN_BEHAVIOURS = new Set(['reopen', 'comment', 'none']);
const DUPLICATE_BEHAVIOURS = new Set(['adopt', 'block']);
const SEVERITIES = ['error', 'warning', 'notice'];

function cleanLabels(value) {
  const labels = Array.isArray(value) ? value : [];
  const cleaned = labels.map(sanitizeLabel).filter(Boolean);
  // "seox" is what the webhook JQL filter and the reconcile query select on,
  // so it is not the user's to remove.
  if (!cleaned.includes(REQUIRED_LABEL)) cleaned.unshift(REQUIRED_LABEL);
  return [...new Set(cleaned)].slice(0, 20);
}

function cleanSeverityMap(value) {
  const map = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const severity of SEVERITIES) {
    const id = map[severity];
    if (id) out[severity] = String(id).slice(0, 64);
  }
  return out;
}

/** Confirm every id the user picked actually exists in the target project. */
async function validateAgainstJira(env, connection, body) {
  const jiraProjectId = String(body.jiraProjectId || '').trim();
  if (!jiraProjectId) throw httpError('Select a Jira project.', 400);

  let project;
  try {
    const { data } = await jiraRequestForConnection(env, connection, {
      path: `/rest/api/3/project/${encodeURIComponent(jiraProjectId)}`,
      kind: 'interactive',
    });
    project = data;
  } catch (error) {
    if (error?.httpStatus === 404) {
      throw httpError('That Jira project no longer exists, or the account cannot see it.', 400);
    }
    if (error?.status === 403) {
      throw httpError(
        'The connected Jira account does not have Browse Projects permission on that project.',
        403
      );
    }
    throw error;
  }

  const issueTypeId = String(body.defaultIssueTypeId || '').trim();
  if (!issueTypeId) throw httpError('Select a default issue type.', 400);

  const { data: typeData } = await jiraRequestForConnection(env, connection, {
    path: `/rest/api/3/issue/createmeta/${encodeURIComponent(jiraProjectId)}/issuetypes`,
    query: { maxResults: 100 },
    kind: 'interactive',
  });
  const types = Array.isArray(typeData?.issueTypes) ? typeData.issueTypes : typeData?.values || [];
  const issueType = types.find((type) => String(type.id) === issueTypeId && !type.subtask);
  if (!issueType) {
    throw httpError(
      `That issue type is not available in project ${project.key}. Pick one of: ${types
        .filter((type) => !type.subtask)
        .map((type) => type.name)
        .join(', ') || 'none found'}.`,
      400
    );
  }

  let assigneeName = '';
  const assigneeId = String(body.defaultAssigneeAccountId || '').trim();
  if (assigneeId) {
    const { data: users } = await jiraRequestForConnection(env, connection, {
      path: '/rest/api/3/user/assignable/search',
      query: { project: project.key, accountId: assigneeId, maxResults: 1 },
      kind: 'interactive',
    });
    const match = (Array.isArray(users) ? users : []).find(
      (user) => String(user.accountId) === assigneeId
    );
    if (!match) {
      throw httpError('That user cannot be assigned issues on the selected Jira project.', 400);
    }
    assigneeName = match.displayName || '';
  }

  return {
    projectKey: project.key,
    projectName: project.name,
    issueTypeName: issueType.name,
    assigneeName,
  };
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    configureMysqlConnection(env);
    const user = await verifyAccessToken(request, env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const project = await requireJiraProject(user.id, url.searchParams.get('projectId'));
      const mapping = await getMapping(user.id, project.project_id);
      return jsonResponse({ mapping: describeMapping(mapping) }, 200, headers);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);
    const project = await requireJiraProject(user.id, body.projectId);
    const connection = await requireJiraConnection(user.id, project.project_id);

    const validated = await validateAgainstJira(env, connection, body);

    const reopenBehaviour = REOPEN_BEHAVIOURS.has(body.reopenBehaviour)
      ? body.reopenBehaviour
      : 'reopen';
    const onDuplicate = DUPLICATE_BEHAVIOURS.has(body.onDuplicate) ? body.onDuplicate : 'adopt';
    const delay = Number(body.verificationDelayMinutes);

    const saved = await upsertMapping({
      userId: user.id,
      projectId: project.project_id,
      connectionId: connection.id,
      jiraProjectId: String(body.jiraProjectId),
      jiraProjectKey: validated.projectKey,
      jiraProjectName: validated.projectName,
      defaultIssueTypeId: String(body.defaultIssueTypeId),
      defaultIssueTypeName: validated.issueTypeName,
      defaultPriorityId: body.defaultPriorityId ? String(body.defaultPriorityId) : null,
      prioritySupported: body.prioritySupported !== false,
      defaultAssigneeAccountId: body.defaultAssigneeAccountId || null,
      defaultAssigneeDisplayName: validated.assigneeName,
      defaultLabels: cleanLabels(body.defaultLabels),
      components: Array.isArray(body.components)
        ? body.components.map((id) => String(id)).slice(0, 20)
        : [],
      severityPriorityMap: cleanSeverityMap(body.severityPriorityMap),
      autoCreateEnabled: Boolean(body.autoCreateEnabled),
      autoSyncEnabled: body.autoSyncEnabled !== false,
      postVerificationComments: body.postVerificationComments !== false,
      reopenBehaviour,
      onDuplicate,
      verificationDelayMinutes: Number.isFinite(delay)
        ? Math.max(0, Math.min(delay, 1440))
        : 10,
      autoCreateRules: body.autoCreateRules || null,
      status: 'active',
      statusDetail: null,
    });

    await logSync({
      userId: user.id,
      projectId: project.project_id,
      action: 'mapping.save',
      result: 'success',
      message: `Mapped to Jira project ${validated.projectKey} (${validated.issueTypeName}).`,
      actorEmail: user.email,
      actorKind: 'user',
      context: {
        jiraProjectKey: validated.projectKey,
        autoCreateEnabled: Boolean(body.autoCreateEnabled),
        autoSyncEnabled: body.autoSyncEnabled !== false,
      },
    });

    return jsonResponse({ mapping: describeMapping(saved), validated: true }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
