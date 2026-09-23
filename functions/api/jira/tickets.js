// GET  /api/jira/tickets   the Jira tickets for the selected internal project
// POST /api/jira/tickets   the same, with the admin_token out of the URL
//
// THE ENDPOINT THE TICKETS UI TALKS TO. It replaces `POST /api/jira/issues`
// with `mode: "tickets"`, which was a mode of a route whose other two modes
// are about something else entirely - SEOX's own findings and the
// finding-to-issue links. One URL answering three different questions meant
// the ticket list could not be read from its path, and every caller had to
// know a magic `mode` string to get it.
//
// WHAT IT DOES NOT DO is fetch anything itself. The whole chain -
//
//     internal project -> jira_connections -> jira_project_mappings
//         -> Jira project key -> /rest/api/3/search/jql -> tickets
//
// - is resolved by functions/_lib/jira-ticket-feed.js, which is the same code
// the old mode used and the only place that chain exists. This file is
// authentication, method handling and error shaping; a second copy of the
// resolution logic is exactly the duplication the integration is built to
// avoid.
//
// AUTHENTICATION IS admin_token AND NOTHING ELSE, matching the status-update
// route next door. No Authorization header is read, no cookie, no session.
//
// NO JIRA CREDENTIAL CAN LEAVE THROUGH HERE. The browser never sees the API
// token, the account password, an authorization header or the encryption key:
// every Jira call is made server-side with the stored credential, and the
// response is built from `issue.fields` alone.
//
// POST is preferred over GET for a reason the token makes concrete: a query
// string lands in access logs, proxy logs and browser history, and an admin
// credential does not belong in any of them. GET is kept because it is useful
// from a terminal and because the transitions endpoint accepts one.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { getJiraTicketFeed } from '../../_lib/jira-ticket-feed.js';

/**
 * Serve one request, whichever verb carried it.
 *
 * `params` is the POST body or the parsed query string; jira-ticket-feed.js
 * reads the same field names from either, so the two verbs cannot drift
 * apart.
 */
async function serve(env, params, headers) {
  try {
    return jsonResponse(await getJiraTicketFeed(env, params), 200, headers);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;

    // Errors raised inside the integration carry a status, and their messages
    // are already written for a user to read. Anything else is a driver or
    // runtime failure: log it server-side and say nothing that could describe
    // the server's internals, the SQL it ran, or the Jira credential it used.
    if (status >= 500) {
      console.error('Jira ticket feed failed:', error?.message || error);
    }

    return jsonResponse(
      {
        success: false,
        error: status >= 500 ? 'Failed to retrieve Jira tickets' : error.message,
        // The first link in the chain the feed reports on, so it carries a
        // code like every later failure does.
        ...(status === 404 ? { code: 'PROJECT_NOT_FOUND' } : {}),
        ...(error?.code ? { code: error.code } : {}),
      },
      status,
      headers
    );
  }
}

export async function onRequest({ request, env }) {
  const headers = {
    ...corsHeaders('GET, POST, OPTIONS'),
    // A ticket list is per-credential and changes constantly. It must never
    // sit in a shared cache.
    'Cache-Control': 'no-store',
  };

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);

  try {
    configureMysqlConnection(env);

    if (request.method === 'POST') {
      const body = await readJson(request);
      return await serve(env, body || {}, headers);
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      return await serve(env, Object.fromEntries(url.searchParams.entries()), headers);
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    // Reaching here means the request could not even be parsed - a malformed
    // JSON body, or a database that cannot be configured.
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error('Jira tickets route failed:', error?.message || error);
    return jsonResponse(
      { success: false, error: status >= 500 ? 'Failed to retrieve Jira tickets' : error.message },
      status,
      headers
    );
  }
}
