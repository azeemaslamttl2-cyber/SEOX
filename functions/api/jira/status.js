// GET /api/jira/status?projectId=<id>
//
// Everything the settings panel, the finding panel and any dashboard tile
// need, in one call. Reads only SEOX's own tables - no Jira API call is made
// here, so this endpoint stays fast and keeps working while Jira is down.
//
// "Not connected" is a normal state and answers 200 with
// { connected: false }, not a 404. The UI must be able to treat the absence
// of Jira as unremarkable, which is what keeps every Jira affordance hidden
// for users who have never set it up.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, errorResponse, jsonResponse } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireJiraProject } from '../../_lib/jira-request.js';
import {
  describeMapping,
  getConnection,
  getMapping,
} from '../../_lib/jira-repository.js';
import {
  countLinksByState,
  countPendingWebhookEvents,
  countSyncErrors,
  listDeadJobs,
} from '../../_lib/jira-store.js';
import { jiraEncryptionConfigured } from '../../_lib/jira-client.js';
import { toEpochMs, toIso } from '../../_lib/jira-status-map.js';

const WEBHOOK_QUIET_HOURS = 24;

// mysql2 hands back DATETIME columns as Date objects, so every timestamp is
// normalised to ISO before it leaves the server. String() would render a
// host-local string that the browser cannot reliably parse.
const isoOrEmpty = toIso;

function hoursSince(value) {
  const ts = toEpochMs(value);
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / 3600000;
}

/**
 * Webhook health, reported honestly.
 *
 * A webhook URL having been displayed proves nothing. Only a received event
 * proves delivery works, so "configured" means "we have actually seen an
 * event", and everything else says so plainly.
 */
function describeWebhook(connection) {
  if (!connection?.webhook_secret_encrypted) {
    return { configured: false, state: 'not_generated', lastEventAt: '' };
  }
  const age = hoursSince(connection.last_event_at);
  if (age === null) {
    return { configured: false, state: 'no_events_yet', lastEventAt: '' };
  }
  return {
    configured: true,
    state: age > WEBHOOK_QUIET_HOURS ? 'quiet' : 'healthy',
    lastEventAt: isoOrEmpty(connection.last_event_at),
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
    const project = await requireJiraProject(user.id, projectId);

    const connection = await getConnection(user.id, project.project_id);
    const serverConfigured = jiraEncryptionConfigured(env);

    if (!connection || connection.status === 'disconnected' || !connection.api_token_encrypted) {
      return jsonResponse(
        {
          connected: false,
          serverConfigured,
          projectId: project.project_id,
          projectName: project.project_name || '',
        },
        200,
        headers
      );
    }

    const mapping = await getMapping(user.id, project.project_id);
    const counts = await countLinksByState(user.id, project.project_id);

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const syncErrors = await countSyncErrors(user.id, project.project_id, since);
    const deadJobs = await listDeadJobs(user.id, project.project_id, 5);
    const pendingEvents = await countPendingWebhookEvents(connection.id);

    return jsonResponse(
      {
        connected: true,
        serverConfigured,
        projectId: project.project_id,
        projectName: project.project_name || '',
        baseUrl: connection.base_url,
        accountEmail: connection.account_email || '',
        accountDisplayName: connection.account_display_name || '',
        status: connection.status,
        statusDetail: connection.status_detail || '',
        connectedAt: isoOrEmpty(connection.connected_at),
        lastCheckedAt: isoOrEmpty(connection.last_checked_at),
        lastSyncAt: isoOrEmpty(connection.last_sync_at),
        // The secret itself is never included - only whether one exists and
        // whether events are arriving.
        webhook: describeWebhook(connection),
        mapping: describeMapping(mapping),
        counts,
        health: {
          syncErrors7d: syncErrors,
          deadJobs: deadJobs.length,
          pendingWebhookEvents: pendingEvents,
        },
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
