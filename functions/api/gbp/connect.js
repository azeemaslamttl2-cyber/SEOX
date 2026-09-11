// POST /api/gbp/connect
//
// OAuth lifecycle for the Google Business Profile connection.
//
//   auth-url    build the Google consent URL for this project
//   exchange    swap the authorisation code for tokens and store them encrypted
//   status      report whether the project is connected, and to which account
//   disconnect  revoke at Google, then drop the connection and its locations
//
// Approval of the GBP API only grants SEOX the right to ask. The Google account
// that signs in here must itself be an owner or manager of the listing, so a
// successful OAuth with zero accounts is a normal outcome, not an error.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireProject } from '../../_lib/gbp-request.js';
import { decryptSecret, encryptSecret, encryptionKeyConfigured } from '../../_lib/gbp-crypto.js';
import {
  buildAuthUrl,
  exchangeAuthorizationCode,
  fetchGoogleUserInfo,
  getOAuthConfig,
  listAccounts,
  revokeToken,
} from '../../_lib/gbp-client.js';
import {
  countLocations,
  deleteConnection,
  getConnection,
  lastSync,
  logSync,
  setConnectionAccount,
  upsertConnection,
  useDatabase,
} from '../../_lib/gbp-repository.js';

function connectionSummary(connection, locationCount, sync) {
  if (!connection) return { connected: false };
  return {
    connected: connection.status === 'connected',
    status: connection.status,
    statusDetail: connection.status_detail || null,
    googleEmail: connection.google_email || null,
    accountId: connection.account_id || null,
    accountName: connection.account_name || null,
    locationCount,
    connectedAt: connection.connected_at,
    updatedAt: connection.updated_at,
    lastSync: sync
      ? { type: sync.sync_type, status: sync.status, message: sync.message, at: sync.created_at }
      : null,
  };
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers);

  try {
    const decoded = await verifyAccessToken(request, env);
    const userId = decoded.uid;
    const body = await readJson(request);
    const { action, projectId, code, redirectUri, returnTo } = body;

    useDatabase(env);

    const { clientId, clientSecret, redirectUri: expectedRedirectUri } = await getOAuthConfig(env, request);
    if (!clientId) {
      return jsonResponse(
        { error: 'Google OAuth is not configured. Add the Google Client ID in Settings > General.' },
        500,
        headers
      );
    }

    if (action === 'status') {
      await requireProject(env, userId, projectId);
      const connection = await getConnection(userId, projectId);
      const locationCount = connection ? await countLocations(userId, projectId) : 0;
      const sync = connection ? await lastSync(userId, projectId) : null;
      return jsonResponse(connectionSummary(connection, locationCount, sync), 200, headers);
    }

    if (action === 'auth-url') {
      await requireProject(env, userId, projectId);
      if (!redirectUri) return jsonResponse({ error: 'Missing redirect URI.' }, 400, headers);

      // Both sides now derive the same value, so a mismatch means the stored
      // google_gbp_redirect_uri points somewhere other than this app's Business
      // Profile callback. Say which setting is wrong and what it should be.
      if (expectedRedirectUri && redirectUri !== expectedRedirectUri) {
        return jsonResponse(
          {
            error:
              `Google OAuth redirect URI mismatch. This page requested ${redirectUri}, but Settings > General > Google has the Business Profile redirect set to ${expectedRedirectUri}. ` +
              `Set the Business Profile Redirect URI to ${redirectUri} (or clear it to use that value automatically), and add the same URI under Authorized redirect URIs on the Google OAuth client.`,
          },
          400,
          headers
        );
      }

      if (!encryptionKeyConfigured(env)) {
        return jsonResponse(
          {
            error:
              'GBP_TOKEN_ENCRYPTION_KEY is not configured. Business Profile tokens cannot be stored safely without it.',
          },
          500,
          headers
        );
      }

      return jsonResponse(
        {
          success: true,
          authUrl: buildAuthUrl({
            clientId,
            redirectUri,
            state: { projectId, returnTo: returnTo || '/local-seo/gbp' },
          }),
        },
        200,
        headers
      );
    }

    if (action === 'exchange') {
      if (!clientSecret) {
        return jsonResponse(
          { error: 'Google Client Secret is not configured. Add it in Settings > General.' },
          500,
          headers
        );
      }
      if (!code || !redirectUri) {
        return jsonResponse({ error: 'Missing authorization code or redirect URI.' }, 400, headers);
      }
      // Google requires the redirect URI on the token exchange to match the one
      // the consent was issued for, so the same check guards this leg.
      if (expectedRedirectUri && redirectUri !== expectedRedirectUri) {
        return jsonResponse(
          {
            error:
              `Google OAuth redirect URI mismatch. The sign-in returned to ${redirectUri}, but the configured Business Profile redirect is ${expectedRedirectUri}.`,
          },
          400,
          headers
        );
      }
      await requireProject(env, userId, projectId);

      const tokens = await exchangeAuthorizationCode(env, { code, redirectUri });
      const userInfo = await fetchGoogleUserInfo(tokens.access_token);

      const existing = await getConnection(userId, projectId);
      if (!tokens.refresh_token && !existing?.refresh_token_encrypted) {
        // Without a refresh token the connection dies in an hour and every
        // background sync fails. Better to fail loudly here.
        return jsonResponse(
          {
            error:
              'Google did not return a refresh token. Remove SEOX from your Google account permissions (myaccount.google.com/permissions) and connect again.',
          },
          400,
          headers
        );
      }

      const connection = await upsertConnection({
        userId,
        projectId,
        googleUserId: userInfo.id || null,
        googleEmail: userInfo.email || null,
        accessTokenEncrypted: await encryptSecret(env, tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? await encryptSecret(env, tokens.refresh_token)
          : null,
        tokenExpiry: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
        scope: tokens.scope || null,
        // Authorisation record: which Google identity granted access, and when.
        authorizedByEmail: userInfo.email || null,
      });

      let accounts = [];
      let accountsError = null;
      try {
        accounts = await listAccounts(env, connection);
        if (accounts.length === 1) {
          await setConnectionAccount(userId, connection.id, accounts[0]);
        }
      } catch (error) {
        accountsError = error?.message || 'Could not read Business Profile accounts.';
      }

      await logSync({
        userId,
        projectId,
        syncType: 'connect',
        status: accountsError ? 'partial' : 'success',
        message: accountsError,
        itemsSynced: accounts.length,
      });

      return jsonResponse(
        {
          success: true,
          connected: true,
          googleEmail: userInfo.email || null,
          accounts,
          accountsError,
          // Zero accounts is a permissions problem on the Google side, not ours.
          needsAccountAccess: !accountsError && accounts.length === 0,
        },
        200,
        headers
      );
    }

    if (action === 'disconnect') {
      await requireProject(env, userId, projectId);
      const connection = await getConnection(userId, projectId);
      if (connection) {
        try {
          const refreshToken = await decryptSecret(env, connection.refresh_token_encrypted);
          await revokeToken(refreshToken);
        } catch {
          // A token that cannot be decrypted cannot be revoked; still drop it.
        }
        await deleteConnection(userId, projectId);
        await logSync({ userId, projectId, syncType: 'disconnect', status: 'success' });
      }
      return jsonResponse({ success: true, connected: false }, 200, headers);
    }

    return jsonResponse({ error: 'Invalid action' }, 400, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
