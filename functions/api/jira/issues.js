// GET  /api/jira/issues   list links, or look up specific fingerprints
// POST /api/jira/issues   create | sync | unlink | retry | verify
//
// POST with an `admin_token` field in the body is a THIRD, read-only mode:
// the feed of every SEO finding that could become a Jira issue. It is
// dispatched before the session guard and before the action switch, so it can
// never reach create/sync/unlink/verify. (The same feed is also served by GET
// with ?admin_token=, but POST is preferred: a query string ends up in access
// logs, proxy logs and browser history, and the token does not belong there.)
//
// This is the core of the integration. The create path implements the
// duplicate-prevention algorithm: reserve the fingerprint in the database
// FIRST, then call Jira. The UNIQUE index on (user_id, fingerprint) is what
// actually guarantees one issue per finding - two concurrent clicks race to
// INSERT, one wins, and the loser is served the winner's row rather than
// creating a second Jira issue.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  errorResponse,
  jsonResponse,
  readJson,
} from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import {
  requireJiraMapping,
  requireJiraProject,
  resolveAppUrl,
  httpError,
} from '../../_lib/jira-request.js';
import { describeMapping, getConnectionById } from '../../_lib/jira-repository.js';
import {
  getLinkByFingerprint,
  getLinkById,
  isDuplicateKey,
  listLinks,
  listLinksByFingerprints,
  countLinksByState,
  logSync,
  markLinkCreated,
  markLinkFailed,
  parseJson,
  pushPreviousIssueKey,
  reserveLink,
  reuseLink,
  unlinkLink,
} from '../../_lib/jira-store.js';
import { jiraRequestForConnection } from '../../_lib/jira-client.js';
import { buildCreateIssuePayload } from '../../_lib/jira-issue-builder.js';
import { buildFindingSnapshot, normalizeFindingPayload } from '../../_lib/jira-finding.js';
import { draftJiraIssueContent } from '../../_lib/jira-ai.js';
import { applyIssueToLink, fetchIssue } from '../../_lib/jira-sync.js';
import { readIssueFields, toIso } from '../../_lib/jira-status-map.js';
import { enqueueVerification, enqueueReconcile } from '../../_lib/jira-jobs.js';
import { getJiraEligibleIssues } from '../../_lib/jira-eligible.js';

const MAX_FINGERPRINT_LOOKUPS = 200;

/** The link shape every endpoint returns. Never includes a credential. */
function describeLink(row, baseUrl) {
  if (!row) return null;
  const issueUrl =
    row.jira_issue_url ||
    (baseUrl && row.jira_issue_key ? `${baseUrl}/browse/${row.jira_issue_key}` : '');

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    sourceModule: row.source_module,
    findingType: row.finding_type,
    findingTitle: row.finding_title,
    severity: row.severity,
    scopeKind: row.scope_kind,
    affectedUrl: row.affected_url || '',
    affectedUrlCount: Number(row.affected_url_count || 1),
    jiraIssueId: row.jira_issue_id || '',
    jiraIssueKey: row.jira_issue_key || '',
    jiraUrl: issueUrl,
    jiraStatus: row.jira_status || '',
    jiraStatusCategory: row.jira_status_category || '',
    jiraResolution: row.jira_resolution || '',
    jiraPriority: row.jira_priority || '',
    assigneeName: row.jira_assignee_name || '',
    state: row.state,
    seoxState: row.seox_state,
    creationMode: row.creation_mode,
    aiUsed: Boolean(row.ai_used),
    verification: parseJson(row.verification_result, null),
    verificationKind: parseJson(row.verification_spec, {})?.kind || 'manual',
    verifiedAt: toIso(row.verified_at),
    reopenedCount: Number(row.reopened_count || 0),
    lastComment: parseJson(row.last_comment, null),
    commentCount: Number(row.comment_count || 0),
    lastError: row.last_error || '',
    lastSyncedAt: toIso(row.last_synced_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Best-effort remote duplicate check.
 *
 * SEOX's own link row is the primary guard; this covers the case where the
 * row was lost, or a colleague on the same Jira project filed the finding
 * from a different SEOX account. The fingerprint is written into the issue
 * description precisely so it is searchable.
 *
 * Never allowed to block creation: a JQL failure is logged and ignored.
 */
async function findAdoptableIssue(env, connection, mapping, fingerprint) {
  try {
    const jql = `project = "${mapping.jira_project_key}" AND labels = "seox" AND description ~ "${fingerprint}" ORDER BY created DESC`;
    const { data } = await jiraRequestForConnection(env, connection, {
      path: '/rest/api/3/search',
      query: { jql, fields: 'status,resolution,assignee,priority,updated,created,summary', maxResults: 5 },
      kind: 'interactive',
    });
    const issues = Array.isArray(data?.issues) ? data.issues : [];
    return (
      issues.find((issue) => issue?.fields?.status?.statusCategory?.key !== 'done') || null
    );
  } catch (error) {
    console.warn('Jira duplicate pre-flight search failed:', error?.message || error);
    return null;
  }
}

async function handleCreate({ env, request, user, body }) {
  await consumeRateLimit(user.id, 'jira:create');

  const project = await requireJiraProject(user.id, body.projectId);
  const { connection, mapping } = await requireJiraMapping(user.id, project.project_id);

  // 1. Normalise and validate the finding, and derive its fingerprint and
  //    verification spec.
  const { finding, fingerprint, scopeKey, scopeKeyHash, verification } =
    normalizeFindingPayload(body.finding, project.project_id);

  const overrides = body.overrides && typeof body.overrides === 'object' ? body.overrides : {};
  const creationMode = body.creationMode === 'auto' ? 'auto' : 'manual';

  // 2. Have we already filed this?
  const existing = await getLinkByFingerprint(user.id, fingerprint);
  if (existing && ['linked', 'creating'].includes(existing.state)) {
    return {
      status: 200,
      payload: {
        created: false,
        alreadyLinked: true,
        adopted: false,
        link: describeLink(existing, connection.base_url),
      },
    };
  }

  // 3. Has someone else, in the same Jira project?
  if (!existing && mapping.on_duplicate !== 'block') {
    const adoptable = await findAdoptableIssue(env, connection, mapping, fingerprint);
    if (adoptable) {
      const remote = readIssueFields(adoptable);
      const linkId = await reserveLink({
        userId: user.id,
        projectId: project.project_id,
        connectionId: connection.id,
        fingerprint,
        sourceModule: finding.sourceModule,
        findingType: finding.findingType,
        scopeKind: finding.scopeKind,
        scopeKey,
        scopeKeyHash,
        findingTitle: finding.title,
        severity: finding.severity,
        affectedUrl: finding.url,
        affectedUrlCount: finding.affectedUrlCount,
        findingSnapshot: buildFindingSnapshot(finding),
        verificationSpec: verification,
        createdBy: user.email,
        creationMode,
      });
      await markLinkCreated(linkId, {
        ...remote,
        url: `${connection.base_url}/browse/${remote.key}`,
      });
      const adopted = await getLinkById(user.id, linkId);

      await logSync({
        userId: user.id,
        projectId: project.project_id,
        linkId,
        action: 'issue.create',
        result: 'skipped',
        jiraIssueKey: remote.key,
        message: `An existing Jira issue already covers this finding; linked to ${remote.key} instead of creating a duplicate.`,
        actorEmail: user.email,
        actorKind: 'user',
      });

      return {
        status: 200,
        payload: {
          created: false,
          alreadyLinked: true,
          adopted: true,
          link: describeLink(adopted, connection.base_url),
        },
      };
    }
  }

  if (existing && mapping.on_duplicate === 'block' && existing.state !== 'failed') {
    throw httpError(
      `This SEO finding is already linked to Jira issue ${existing.jira_issue_key}.`,
      409
    );
  }

  // 4. Reserve the fingerprint. The unique index is the real guarantee: a
  //    concurrent create loses the race here and is served the winner's row.
  const reservation = {
    userId: user.id,
    projectId: project.project_id,
    connectionId: connection.id,
    fingerprint,
    sourceModule: finding.sourceModule,
    findingType: finding.findingType,
    scopeKind: finding.scopeKind,
    scopeKey,
    scopeKeyHash,
    findingTitle: finding.title,
    severity: finding.severity,
    affectedUrl: finding.url,
    affectedUrlCount: finding.affectedUrlCount,
    findingSnapshot: buildFindingSnapshot(finding),
    verificationSpec: verification,
    createdBy: user.email,
    creationMode,
    aiUsed: false,
  };

  let linkId;
  if (existing) {
    // A previously failed or unlinked row is reused, so its history and its
    // previous issue keys survive.
    linkId = existing.id;
    if (existing.jira_issue_key) await pushPreviousIssueKey(existing.id, existing.jira_issue_key);
    await reuseLink(existing.id, reservation);
  } else {
    try {
      linkId = await reserveLink(reservation);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const winner = await getLinkByFingerprint(user.id, fingerprint);
      return {
        status: 200,
        payload: {
          created: false,
          alreadyLinked: true,
          adopted: false,
          link: describeLink(winner, connection.base_url),
        },
      };
    }
  }

  // 5. Optional AI enrichment. Never allowed to fail the create.
  let ai = null;
  let aiNote = '';
  if (body.useAi) {
    try {
      await consumeRateLimit(user.id, 'ai:generate');
      const drafted = await draftJiraIssueContent({ env, user, finding, project });
      ai = drafted.fields;
      aiNote = drafted.reason;
    } catch (error) {
      aiNote = error?.status === 429
        ? 'The AI rate limit was reached, so the standard description was used.'
        : 'AI drafting was unavailable, so the standard description was used.';
    }
  }

  // 6. Create in Jira.
  const payload = buildCreateIssuePayload({
    finding,
    mapping: describeMapping(mapping),
    overrides,
    fingerprint,
    ai,
    verification,
    appUrl: resolveAppUrl(env, request),
    projectName: project.project_name,
    actorEmail: user.email,
    creationMode,
  });

  const started = Date.now();
  let created;
  try {
    const response = await jiraRequestForConnection(env, connection, {
      path: '/rest/api/3/issue',
      method: 'POST',
      body: payload,
      kind: 'interactive',
    });
    created = response.data;
  } catch (error) {
    await markLinkFailed(linkId, error?.message);
    await logSync({
      userId: user.id,
      projectId: project.project_id,
      linkId,
      action: 'issue.create',
      result: 'error',
      message: error?.message,
      httpStatus: error?.httpStatus || error?.status,
      durationMs: Date.now() - started,
      actorEmail: user.email,
      actorKind: 'user',
      context: { findingType: finding.findingType },
    });
    throw error;
  }

  // Read the issue back so the stored status and priority are Jira's own
  // values rather than what we asked for - a workflow can override both.
  let remote = { id: String(created?.id || ''), key: String(created?.key || '') };
  try {
    const issue = await fetchIssue(env, connection, remote.id || remote.key);
    if (issue) remote = readIssueFields(issue);
  } catch {
    /* The issue exists; enriching it is a nicety, not a requirement. */
  }

  await markLinkCreated(linkId, {
    ...remote,
    url: `${connection.base_url}/browse/${remote.key}`,
  });

  await logSync({
    userId: user.id,
    projectId: project.project_id,
    linkId,
    action: 'issue.create',
    result: 'success',
    jiraIssueKey: remote.key,
    message: `Created ${remote.key} for "${finding.title}".`,
    durationMs: Date.now() - started,
    actorEmail: user.email,
    actorKind: creationMode === 'auto' ? 'system' : 'user',
    context: {
      findingType: finding.findingType,
      severity: finding.severity,
      aiUsed: Boolean(ai),
      verificationKind: verification.kind,
    },
  });

  const link = await getLinkById(user.id, linkId);
  return {
    status: 201,
    payload: {
      created: true,
      alreadyLinked: false,
      aiUsed: Boolean(ai),
      aiNote,
      link: describeLink(link, connection.base_url),
    },
  };
}

async function handleSync({ env, user, body }) {
  await consumeRateLimit(user.id, 'jira:sync');
  const project = await requireJiraProject(user.id, body.projectId);
  const { connection, mapping } = await requireJiraMapping(user.id, project.project_id);

  // A whole-project sync is queued, never run inline: it can page through
  // hundreds of issues and must not hold an HTTP request open.
  if (!body.linkId) {
    const jobId = await enqueueReconcile({ userId: user.id, projectId: project.project_id });
    return { queued: true, jobId: jobId || null };
  }

  const link = await getLinkById(user.id, body.linkId);
  if (!link) throw httpError('That Jira link was not found.', 404);
  if (!link.jira_issue_id && !link.jira_issue_key) {
    throw httpError('That finding has no Jira issue to sync.', 409);
  }

  const started = Date.now();
  const issue = await fetchIssue(env, connection, link.jira_issue_id || link.jira_issue_key);
  if (!issue) {
    await logSync({
      userId: user.id,
      projectId: project.project_id,
      linkId: link.id,
      action: 'issue.sync',
      result: 'error',
      jiraIssueKey: link.jira_issue_key,
      message: 'The Jira issue no longer exists.',
      actorEmail: user.email,
      actorKind: 'user',
    });
    throw httpError('That Jira issue no longer exists.', 404);
  }

  const applied = await applyIssueToLink(link, issue);
  if (applied.applied && applied.shouldVerify) {
    const refreshed = await getLinkById(user.id, link.id);
    await enqueueVerification({ link: refreshed || link, mapping });
  }

  await logSync({
    userId: user.id,
    projectId: project.project_id,
    linkId: link.id,
    action: 'issue.sync',
    direction: 'inbound',
    result: 'success',
    jiraIssueKey: link.jira_issue_key,
    message: applied.stale ? 'Already up to date.' : 'Synced from Jira.',
    durationMs: Date.now() - started,
    actorEmail: user.email,
    actorKind: 'user',
  });

  const updated = await getLinkById(user.id, link.id);
  return { synced: true, link: describeLink(updated, connection.base_url) };
}

async function handleUnlink({ user, body }) {
  const project = await requireJiraProject(user.id, body.projectId);
  const link = await getLinkById(user.id, body.linkId);
  if (!link) throw httpError('That Jira link was not found.', 404);

  // The Jira issue is deliberately left alone. SEOX must never delete data
  // in another system.
  await unlinkLink(user.id, link.id);
  await logSync({
    userId: user.id,
    projectId: project.project_id,
    linkId: link.id,
    action: 'issue.unlink',
    result: 'success',
    jiraIssueKey: link.jira_issue_key,
    message: 'The finding was detached from its Jira issue. The Jira issue was not changed.',
    actorEmail: user.email,
    actorKind: 'user',
  });

  return { unlinked: true };
}

async function handleVerify({ user, body }) {
  const project = await requireJiraProject(user.id, body.projectId);
  const { mapping } = await requireJiraMapping(user.id, project.project_id);

  const link = await getLinkById(user.id, body.linkId);
  if (!link) throw httpError('That Jira link was not found.', 404);

  const spec = parseJson(link.verification_spec, null);
  if (!spec || spec.kind === 'manual') {
    throw httpError('SEOX cannot verify this finding type automatically.', 409);
  }

  const jobId = await enqueueVerification({ link, mapping, delayMinutes: 0 });
  return { queued: true, jobId: jobId || null };
}

/**
 * The read-only Jira-eligible issue feed - admin_token ONLY.
 *
 * A mode of this route rather than a separate one, so the documented endpoint
 * stays a single URL. It is dispatched BEFORE the session guard and BEFORE the
 * action switch, and shares nothing with either: an admin_token request never
 * falls back to a session, a session request never reaches this code, and no
 * `action` in the body can steer it into a write. It only reads.
 *
 * @param {object} params  the POST JSON body, or the GET query string
 */
async function handleAdminEligibleIssues(params, headers) {
  try {
    const payload = await getJiraEligibleIssues(params);
    return jsonResponse(payload, 200, headers);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    // Errors we raise carry a status, so their message is safe to return.
    // Anything else is a driver or runtime failure: log it, return nothing.
    if (status >= 500) console.error('Jira eligible issues failed:', error?.message || error);
    return jsonResponse(
      {
        success: false,
        error: status >= 500 ? 'Failed to retrieve Jira-eligible issues' : error.message,
      },
      status,
      headers
    );
  }
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, POST, OPTIONS'),
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    configureMysqlConnection(env);

    // The body can only be read once, so it is read here and handed to
    // whichever mode claims the request.
    const body = request.method === 'POST' ? await readJson(request) : null;

    // admin_token mode is resolved first, so the two authentication schemes can
    // never blend into each other. Presence of the field - not a truthy value -
    // selects the mode, so a blank token is a 400 rather than silently becoming
    // an anonymous request.
    if (request.method === 'POST' && body && Object.hasOwn(body, 'admin_token')) {
      return await handleAdminEligibleIssues(body, headers);
    }
    if (request.method === 'GET') {
      const adminUrl = new URL(request.url);
      if (adminUrl.searchParams.has('admin_token')) {
        return await handleAdminEligibleIssues(
          Object.fromEntries(adminUrl.searchParams.entries()),
          headers
        );
      }
    }

    const user = await verifyAccessToken(request, env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const project = await requireJiraProject(user.id, url.searchParams.get('projectId'));

      const fingerprints = url.searchParams
        .getAll('fingerprint')
        .slice(0, MAX_FINGERPRINT_LOOKUPS);

      const rows = fingerprints.length
        ? await listLinksByFingerprints(user.id, project.project_id, fingerprints)
        : await listLinks(user.id, project.project_id, {
            limit: Math.min(Number(url.searchParams.get('limit')) || 500, 1000),
          });

      // The base URL is only needed to build browse links; when Jira has
      // been disconnected the stored jira_issue_url still works.
      const connection = rows.length
        ? await getConnectionById(rows[0].connection_id)
        : null;

      return jsonResponse(
        {
          links: rows.map((row) => describeLink(row, connection?.base_url)),
          total: rows.length,
          counts: await countLinksByState(user.id, project.project_id),
        },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const action = String(body?.action || 'create');

    switch (action) {
      case 'create':
      case 'retry': {
        const result = await handleCreate({ env, request, user, body });
        return jsonResponse(result.payload, result.status, headers);
      }
      case 'sync':
        return jsonResponse(await handleSync({ env, user, body }), 200, headers);
      case 'unlink':
        return jsonResponse(await handleUnlink({ user, body }), 200, headers);
      case 'verify':
        return jsonResponse(await handleVerify({ user, body }), 200, headers);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400, headers);
    }
  } catch (error) {
    return errorResponse(error, headers);
  }
}
