// GET  /api/gbp/automation?projectId=[&resource=sources][&ruleId=]
// POST /api/gbp/automation
//   save-rule | delete-rule | run-rule | approve-source | skip-source
//
// Two rule types. website_to_post turns new pages on the client's site into
// drafted GBP posts; service_gap reports service pages that are missing from
// the GBP service list.
//
// mode decides what a run produces:
//   manual    discover only, nothing is drafted
//   approval  drafts land in the queue and wait for a human   (default)
//   auto      drafts are scheduled straight away

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection, requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  useDatabase,
} from '../../_lib/gbp-repository.js';
import {
  deleteRule,
  getRule,
  listRules,
  listSources,
  markRuleRun,
  markSource,
  parseJson,
  saveRule,
} from '../../_lib/gbp-store.js';
import {
  RULE_MODES,
  RULE_TYPES,
  normaliseRuleConfig,
} from '../../_lib/gbp-automation.js';
import { runRule, summariseRuleRun } from '../../_lib/gbp-automation-runner.js';

function serializeRule(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    ruleType: rule.rule_type,
    name: rule.name,
    enabled: Boolean(rule.enabled),
    mode: rule.mode,
    locationRowId: rule.location_row_id,
    config: parseJson(rule.config, {}),
    lastRunAt: rule.last_run_at,
    lastRunStatus: rule.last_run_status,
    lastRunMessage: rule.last_run_message,
  };
}

function serializeSource(source) {
  return {
    id: source.id,
    ruleId: source.rule_id,
    url: source.url,
    title: source.title,
    status: source.status,
    postId: source.post_id,
    skipReason: source.skip_reason,
    discoveredAt: source.discovered_at,
    processedAt: source.processed_at,
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    const decoded = await verifyAccessToken(request, env);
    const userId = decoded.uid;
    useDatabase(env);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      await requireConnection(env, userId, projectId);

      if (url.searchParams.get('resource') === 'sources') {
        const sources = await listSources(userId, projectId, {
          ruleId: url.searchParams.get('ruleId') || undefined,
          status: url.searchParams.get('status') || undefined,
        });
        return jsonResponse({ sources: sources.map(serializeSource) }, 200, headers);
      }

      const rules = await listRules(userId, projectId);
      return jsonResponse(
        { rules: rules.map(serializeRule), ruleTypes: RULE_TYPES, modes: RULE_MODES },
        200,
        headers
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers);
    }

    const body = await readJson(request);
    const { action, projectId } = body;

    if (action === 'save-rule') {
      await requireConnection(env, userId, projectId);
      const ruleType = body.ruleType || (body.id ? (await getRule(userId, body.id))?.rule_type : null);
      if (!RULE_TYPES.includes(ruleType)) {
        return jsonResponse({ error: `"${ruleType}" is not a supported rule type.` }, 400, headers);
      }
      if (body.mode && !RULE_MODES.includes(body.mode)) {
        return jsonResponse({ error: `"${body.mode}" is not a valid mode.` }, 400, headers);
      }

      const rule = await saveRule({
        id: body.id,
        userId,
        projectId,
        locationRowId: body.locationRowId || null,
        ruleType,
        name: body.name || (ruleType === 'service_gap' ? 'Service gap check' : 'Website to GBP posts'),
        enabled: body.enabled,
        mode: body.mode || 'approval',
        config: normaliseRuleConfig(ruleType, body.config),
      });
      return jsonResponse({ success: true, rule: serializeRule(rule) }, 200, headers);
    }

    if (action === 'delete-rule') {
      await requireConnection(env, userId, projectId);
      const removed = await deleteRule(userId, body.ruleId);
      return jsonResponse({ success: removed }, removed ? 200 : 404, headers);
    }

    if (action === 'run-rule') {
      const connection = await requireConnectionWithAccount(env, userId, projectId);
      const rule = await getRule(userId, body.ruleId);
      if (!rule || rule.project_id !== projectId) {
        return jsonResponse({ error: 'Rule was not found.' }, 404, headers);
      }

      const location = await resolveLocation(userId, projectId, rule.location_row_id);

      try {
        const result = await runRule(env, { userId, projectId, rule, location, connection });
        await markRuleRun(userId, rule.id, 'success', summariseRuleRun(rule.rule_type, result));
        return jsonResponse({ success: true, result }, 200, headers);
      } catch (error) {
        await markRuleRun(userId, rule.id, 'error', error?.message);
        throw error;
      }
    }

    if (action === 'approve-source') {
      await requireConnection(env, userId, projectId);
      if (!body.postId) return jsonResponse({ error: 'postId is required.' }, 400, headers);
      // Approval simply moves the drafted post out of the approval queue; the
      // Posts Manager owns scheduling and publishing from here.
      return jsonResponse(
        { success: true, note: 'Open the post in the Posts Manager to schedule or publish it.' },
        200,
        headers
      );
    }

    if (action === 'skip-source') {
      await requireConnection(env, userId, projectId);
      await markSource(userId, body.sourceId, {
        status: 'skipped',
        skipReason: body.reason || 'Skipped by user.',
      });
      return jsonResponse({ success: true }, 200, headers);
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
