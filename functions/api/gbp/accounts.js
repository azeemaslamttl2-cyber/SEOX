// GET  /api/gbp/accounts?projectId=...   list the Business Profile accounts the
//                                        connected Google identity can manage
// POST /api/gbp/accounts                 pin one account to the connection
//
// A Google identity can manage several accounts (personal, organisation, agency
// group). The account chosen here scopes every later location fetch.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnection } from '../../_lib/gbp-request.js';
import { getAccounts, selectAccount } from '../../_lib/gbp-service.js';
import { logSync, useDatabase } from '../../_lib/gbp-repository.js';

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
      const connection = await requireConnection(env, userId, projectId);
      // Through the service so the accounts are cached in gbp_accounts, not
      // just returned to the browser and forgotten. Reads that cache unless the
      // caller explicitly asks for a live list, so opening the page costs no
      // Google quota once a connection has been made.
      const result = await getAccounts(env, {
        userId,
        projectId,
        refresh: url.searchParams.get('refresh') === '1',
        // A person pressed Refresh, so allow one attempt through a backoff.
        userInitiated: url.searchParams.get('refresh') === '1',
      });

      return jsonResponse(
        {
          accounts: result.accounts,
          selectedAccountId: result.selectedAccountId,
          googleEmail: connection.google_email || null,
          // Stale list plus the reason, rather than an empty list that reads as
          // "this account manages nothing".
          fromCache: Boolean(result.fromCache),
          // 'database' or 'google', so the page can say where the list came
          // from rather than implying every view is live.
          dataSource: result.dataSource,
          quotaError: result.quotaError || null,
          quotaBlocked: Boolean(result.quotaBlocked),
          likelyUnapprovedQuota: Boolean(result.likelyUnapprovedQuota),
          retryAfterSeconds: result.retryAfterSeconds || null,
          // When the stored list was last confirmed against Google, so the page
          // can label cached data instead of implying it is live.
          syncedAt: result.syncedAt || null,
          neverSynced: Boolean(result.neverSynced),
          // Only a clean read of zero accounts means the identity manages none.
          // A quota refusal and a never-synced cache both say nothing about
          // what this Google account manages.
          needsAccountAccess:
            !result.quotaError && !result.neverSynced && result.accounts.length === 0,
        },
        200,
        headers
      );
    }

    if (request.method === 'POST') {
      const { projectId, accountId } = await readJson(request);
      await requireConnection(env, userId, projectId);
      if (!accountId) return jsonResponse({ error: 'accountId is required.' }, 400, headers);

      // selectAccount re-reads from Google before pinning, so a stale UI cannot
      // attach an account the identity has lost access to.
      const match = await selectAccount(env, { userId, projectId, accountId });
      await logSync({ userId, projectId, syncType: 'select-account', status: 'success', message: match.accountId });

      return jsonResponse({ success: true, account: match }, 200, headers);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
