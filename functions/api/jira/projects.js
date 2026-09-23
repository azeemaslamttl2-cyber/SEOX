// GET|POST /api/jira/projects   the Jira projects this admin_token can read
//
// Feeds the Jira project selector on /jira/tickets. A JIRA project is a board
// (WUCP / "Web - UCP"); a SEOX project is a website (https://ucp.edu.pk/).
// The selector on that page picks the former, and this is where the list
// comes from - never a hardcoded array, and never derived from a SEOX
// project's URL.
//
// AUTHENTICATION IS admin_token AND NOTHING ELSE, matching the rest of the
// Jira ticket surface. The lookup is jira-eligible.js's, not a second copy.
//
// SCOPE: the projects visible to the Jira credentials THIS SEOX user has
// stored, across all of their connections. Jira itself decides visibility
// from the credential, so a user can never be shown a board their own Jira
// account cannot read. A user with no Jira connection gets an empty list and
// a state saying why - not an error, and not silence.
//
// NO CREDENTIAL IS RETURNED. The response carries project id/key/name, the
// Jira site URL (which the user typed themselves) and an opaque connection
// id. The API token and the webhook secret never leave the server.

import { configureMysqlConnection } from '../../_lib/mysql.js';
import {
  corsHeaders,
  emptyResponse,
  jsonResponse,
  readJson,
} from '../../_lib/http.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { authenticateAdmin, readAdminToken } from '../../_lib/jira-eligible.js';
import { jiraEncryptionConfigured } from '../../_lib/jira-client.js';
import { listAllJiraProjectsForUser } from '../../_lib/jira-projects.js';

function pick(params, key) {
  const value = params?.[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

async function handle(env, params) {
  const admin = await authenticateAdmin(readAdminToken(params));
  await consumeRateLimit(admin.id, 'jira:metadata');

  // The server-side key decrypts every stored credential. Without it nothing
  // can be listed, and that is an operator problem the user cannot fix -
  // saying "no projects" would send them hunting in the wrong place.
  if (!jiraEncryptionConfigured(env)) {
    return {
      success: true,
      projects: [],
      state: {
        ok: false,
        code: 'JIRA_NOT_CONFIGURED',
        message:
          'Jira is not configured on this server: JIRA_TOKEN_ENCRYPTION_KEY is not set, so no stored Jira credential can be used.',
      },
      errors: [],
    };
  }

  const search = pick(params, 'query') || pick(params, 'q');
  const { projects, errors, siteCount } = await listAllJiraProjectsForUser(env, admin.id, {
    query: search,
  });

  // No connection at all is a configuration state, not an empty result.
  if (!siteCount) {
    return {
      success: true,
      projects: [],
      state: {
        ok: false,
        code: 'JIRA_NOT_CONFIGURED',
        message:
          'No Jira connection is set up for this account. Connect Jira for a project in Settings > Jira.',
      },
      errors: [],
    };
  }

  // Every site failed to list. The user has a connection but it is not
  // working, which is a different problem from having none.
  if (!projects.length && errors.length) {
    return {
      success: true,
      projects: [],
      state: {
        ok: false,
        code: errors[0].code || 'JIRA_API_ERROR',
        message: errors[0].message,
      },
      errors,
    };
  }

  // Every page of every site was walked, or it was not. A list that stopped
  // early is still worth showing - it is most of the boards - but it is not
  // the whole answer and must not be reported as one.
  const complete = !errors.some((entry) => entry.code === 'JIRA_PROJECT_LIST_TRUNCATED');

  return {
    success: true,
    projects,
    complete,
    state: {
      ok: true,
      code: 'OK',
      message: complete
        ? `${projects.length} Jira project${projects.length === 1 ? '' : 's'} available across ${siteCount} Jira site${siteCount === 1 ? '' : 's'}.`
        : `Showing ${projects.length} Jira project${projects.length === 1 ? '' : 's'} across ${siteCount} Jira site${siteCount === 1 ? '' : 's'}. This is not the complete list - one or more sites have more projects than SEOX will list in one pass.`,
    },
    // A site that could not be listed while others could, or one whose list
    // was cut short: either way the list is still useful, it is just not
    // complete, and the caller is told so.
    errors,
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

    let params;
    if (request.method === 'GET') {
      params = Object.fromEntries(new URL(request.url).searchParams.entries());
    } else if (request.method === 'POST') {
      params = (await readJson(request)) || {};
    } else {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
    }

    return jsonResponse(await handle(env, params), 200, headers);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error('Jira project list failed:', error?.message || error);
    return jsonResponse(
      {
        success: false,
        error: status >= 500 ? 'Failed to list Jira projects' : error.message,
        ...(error?.code ? { code: error.code } : {}),
      },
      status,
      headers
    );
  }
}
