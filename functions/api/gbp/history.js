// GET /api/gbp/history?projectId=&locationRowId=[&compare=<auditId>]
//
// Audit History: the score timeline plus a signal-level diff between two runs.
//
// Nothing here recomputes anything. It reads the append-only gbp_audits rows,
// so the history is what was actually measured at the time rather than today's
// numbers projected backwards.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection, resolveLocation } from '../../_lib/gbp-request.js';
import { useDatabase } from '../../_lib/gbp-repository.js';
import { auditHistory, getAudit, latestAudit, parseJson } from '../../_lib/gbp-store.js';
import { diffSignals } from '../../_lib/gbp-audit.js';

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('GET, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405, headers);

  try {
    const decoded = await verifyAccessToken(request, env);
    const userId = decoded.uid;
    useDatabase(env);

    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    await requireConnection(env, userId, projectId);
    const location = await resolveLocation(userId, projectId, url.searchParams.get('locationRowId'));

    const rows = await auditHistory(userId, location.id, 30);
    if (!rows.length) {
      return jsonResponse(
        { locationRowId: location.id, businessName: location.business_name, timeline: [], diff: null, needsFirstRun: true },
        200,
        headers
      );
    }

    // Timeline is oldest-first so a chart reads left to right.
    const timeline = [...rows]
      .reverse()
      .map((entry) => {
        const signals = parseJson(entry.signals, {}) || {};
        return {
          id: entry.id,
          score: entry.score,
          createdAt: entry.created_at,
          counts: {
            critical: entry.critical_count,
            high: entry.high_count,
            medium: entry.medium_count,
            low: entry.low_count,
            opportunity: entry.opportunity_count,
          },
          snapshot: signals.snapshot || null,
        };
      });

    // Compare the newest run against the one the caller named, or the previous.
    const currentRow = await latestAudit(userId, location.id);
    const compareId = url.searchParams.get('compare');
    const previousRow = compareId
      ? await getAudit(userId, compareId)
      : rows.find((entry) => entry.id !== currentRow?.id) || null;

    const diff =
      currentRow && previousRow && previousRow.id !== currentRow.id
        ? diffSignals(currentRow, previousRow)
        : null;

    return jsonResponse(
      {
        locationRowId: location.id,
        businessName: location.business_name,
        timeline,
        current: currentRow
          ? { id: currentRow.id, score: currentRow.score, createdAt: currentRow.created_at }
          : null,
        comparedWith: previousRow
          ? { id: previousRow.id, score: previousRow.score, createdAt: previousRow.created_at }
          : null,
        diff,
        // Only one run so far: there is nothing to compare it against yet.
        needsSecondRun: rows.length < 2,
      },
      200,
      headers
    );
  } catch (error) {
    return errorResponse(error, headers);
  }
}
