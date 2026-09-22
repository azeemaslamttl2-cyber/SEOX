// POST /api/jira/webhook?t=<secret>
//
// Public by necessity - Atlassian's servers must reach it, so there is no
// SEOX session. Authentication is a 32-byte secret in the query string,
// generated per connection and compared in constant time.
//
// Jira Cloud's plain WebHooks do NOT sign their payloads (only Connect and
// Forge apps get signed requests), so the URL secret plus the defence in
// depth below is the control.
//
// The endpoint stores and acknowledges; it does not process. Jira's webhook
// timeout is short, and a slow endpoint gets events dropped - so the real
// work happens in the jira_webhook job.

import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { configureMysqlConnection } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse } from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import {
  getConnectionByWebhookLookup,
  touchConnectionEvent,
} from '../../_lib/jira-repository.js';
import { getLinkByIssueId, recordWebhookEvent } from '../../_lib/jira-store.js';
import { decryptJiraSecret } from '../../_lib/jira-client.js';

const MAX_BODY_BYTES = 1024 * 1024;

const SUPPORTED_EVENTS = new Set([
  'jira:issue_updated',
  'jira:issue_created',
  'jira:issue_deleted',
  'comment_created',
  'comment_updated',
]);

/**
 * Constant-time comparison. A naive === leaks the secret through timing
 * given enough attempts, and a length mismatch must not short-circuit in a
 * way that reveals the length.
 */
function secretsMatch(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) {
    // Still burn a comparison so the timing of a length mismatch does not
    // differ noticeably from a content mismatch.
    nodeTimingSafeEqual(left, left);
    return false;
  }
  return nodeTimingSafeEqual(left, right);
}

function eventKey({ issueId, eventType, timestamp, changeId }) {
  return createHash('sha256')
    .update([issueId, eventType, timestamp, changeId].join(''), 'utf8')
    .digest('hex');
}

/**
 * Keep only what SEOX consumes.
 *
 * A raw Jira payload embeds the entire issue including every custom field and
 * the reporter's email address. Storing that wholesale is a size problem and
 * a privacy one.
 */
function trimPayload(body) {
  const issue = body?.issue || {};
  const fields = issue.fields || {};
  return {
    webhookEvent: body?.webhookEvent || '',
    issue: {
      id: String(issue.id || ''),
      key: String(issue.key || ''),
      fields: {
        status: fields.status
          ? {
              name: fields.status.name,
              statusCategory: { key: fields.status.statusCategory?.key },
            }
          : undefined,
        resolution: fields.resolution ? { name: fields.resolution.name } : null,
        priority: fields.priority ? { name: fields.priority.name } : null,
        assignee: fields.assignee
          ? { accountId: fields.assignee.accountId, displayName: fields.assignee.displayName }
          : null,
        created: fields.created,
        updated: fields.updated,
        summary: typeof fields.summary === 'string' ? fields.summary.slice(0, 500) : undefined,
      },
    },
    changelogItems: Array.isArray(body?.changelog?.items)
      ? body.changelog.items.slice(0, 10).map((item) => ({
          field: item.field,
          fromString: String(item.fromString ?? '').slice(0, 200),
          toString: String(item.toString ?? '').slice(0, 200),
        }))
      : [],
    comment: body?.comment
      ? {
          id: String(body.comment.id || ''),
          author: {
            accountId: body.comment.author?.accountId || null,
            displayName: body.comment.author?.displayName || '',
          },
          created: body.comment.created,
          body: body.comment.body,
        }
      : null,
  };
}

export async function onRequest({ request, env }) {
  // Server-to-server; CORS is irrelevant but OPTIONS is answered politely.
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  }

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('t') || '';
    // No detail in the response: the endpoint must not help someone work out
    // whether a token is close to valid.
    if (!token || token.length < 32 || token.length > 128) {
      return jsonResponse(null, 401, headers);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return jsonResponse({ error: 'Malformed payload' }, 400, headers);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload too large' }, 413, headers);
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: 'Malformed payload' }, 400, headers);
    }

    configureMysqlConnection(env);

    // The token is stored encrypted, so the row is found by a non-reversible
    // lookup hash and the secret itself is then compared in constant time.
    const lookup = createHash('sha256').update(token, 'utf8').digest('hex');
    const connection = await getConnectionByWebhookLookup(lookup);
    if (!connection || connection.status === 'disconnected') {
      return jsonResponse(null, 401, headers);
    }

    let storedSecret;
    try {
      storedSecret = await decryptJiraSecret(env, connection.webhook_secret_encrypted);
    } catch {
      return jsonResponse(null, 401, headers);
    }
    if (!secretsMatch(token, storedSecret)) {
      return jsonResponse(null, 401, headers);
    }

    // An optional second factor, for deployments whose proxy can inject a
    // header. Unset means not required.
    const globalSecret = String(env?.JIRA_WEBHOOK_SECRET || '').trim();
    if (globalSecret && !secretsMatch(request.headers.get('x-seox-webhook-secret'), globalSecret)) {
      return jsonResponse(null, 401, headers);
    }

    const eventType = String(body?.webhookEvent || '');
    const issueId = String(body?.issue?.id || '');
    if (!eventType || !issueId) {
      return jsonResponse({ error: 'Malformed payload' }, 400, headers);
    }

    // Flood protection. Dropping is safe because the reconcile sweep catches
    // anything missed, and a 200 stops Jira retrying an event we chose to
    // discard.
    try {
      await consumeRateLimit(connection.id, 'jira:webhook');
    } catch (error) {
      if (error?.status === 429) return jsonResponse({ received: true, throttled: true }, 200, headers);
      throw error;
    }

    await touchConnectionEvent(connection.id);

    if (!SUPPORTED_EVENTS.has(eventType)) {
      return jsonResponse({ received: true, ignored: 'unsupported_event' }, 200, headers);
    }

    // The issue is resolved from SEOX's own tables, never from the payload -
    // the payload is data, not authorisation. An unknown issue is
    // acknowledged and dropped: a non-200 would make Jira retry forever for
    // an event that will never become relevant, and answering differently
    // would leak which issues SEOX tracks.
    const link = await getLinkByIssueId(connection.id, issueId);
    if (!link) {
      return jsonResponse({ received: true, ignored: 'not_linked' }, 200, headers);
    }

    const key = eventKey({
      issueId,
      eventType,
      timestamp: String(body?.timestamp || body?.issue?.fields?.updated || ''),
      changeId: String(body?.changelog?.id || body?.comment?.id || ''),
    });

    const eventId = await recordWebhookEvent({
      connectionId: connection.id,
      userId: link.user_id,
      projectId: link.project_id,
      eventKey: key,
      eventType,
      jiraIssueId: issueId,
      jiraIssueKey: String(body?.issue?.key || ''),
      linkId: link.id,
      payload: trimPayload(body),
    });

    // A null id means the UNIQUE index rejected a duplicate - already seen,
    // nothing more to do.
    return jsonResponse(
      { received: true, duplicate: eventId === null },
      200,
      headers
    );
  } catch (error) {
    // The only case where Jira SHOULD retry: SEOX could not durably store the
    // event. The URL carries the secret, so nothing about the request is
    // logged beyond the message.
    console.error('Jira webhook storage failed:', error?.message || error);
    return jsonResponse({ error: 'Storage unavailable' }, 503, headers);
  }
}
