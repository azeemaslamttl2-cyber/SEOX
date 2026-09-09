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
      // just returned to the browser and forgotten.
      const { accounts, selectedAccountId } = await getAccounts(env, { userId, projectId });

      return jsonResponse(
        {
          accounts,
          selectedAccountId,
          googleEmail: connection.google_email || null,
          // Google returned a valid token but no manageable accounts.
          needsAccountAccess: accounts.length === 0,
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
