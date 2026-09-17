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
  revokeToken,
} from '../../_lib/gbp-client.js';
import { getAccounts, getLocations } from '../../_lib/gbp-service.js';
import { signGbpState, verifyGbpState } from '../../_lib/gbp-state.js';
import {
  STAGES,
  createDiagnostics,
  failurePayload,
  markStage,
  successPayload,
} from '../../_lib/gbp-diagnostics.js';
import {
  attachLocation,
  countLocations,
  deleteConnection,
  getConnection,
  lastSync,
  logSync,
  setConnectionAccount,
  upsertConnection,
  useDatabase,
} from '../../_lib/gbp-repository.js';

/**
 * How far the connection can be carried automatically after consent.
 *
 * Returns, never throws: consent has already been spent by the time this runs,
 * so a Google-side refusal must still leave the connection stored and the page
 * able to explain itself. `next` is the single fact the browser acts on:
 *
 *   'ready'           a profile is attached and its data can be shown
 *   'select-account'  several accounts; the user picks one
 *   'select-location' account pinned, several locations; the user picks one
 *   'no-accounts'     the Google account manages no Business Profile
 *   'no-locations'    the account exists but holds no listing
 *   'error'           Google refused; `accountsError` says how
 */
async function resolveProfiles(env, { userId, projectId, connection, diagnostics }) {
  const result = {
    accounts: [],
    locations: [],
    selectedAccountId: null,
    attachedLocationId: null,
    failure: null,
    next: 'select-account',
  };

  markStage(diagnostics, STAGES.BUSINESS_PROFILE_API);

  try {
    // `refresh` because this is a brand-new authorisation: the cache may hold
    // the previous Google identity's accounts, and the whole point of
    // connecting (or reconnecting) is to read what Google says right now.
    const { accounts, selectedAccountId, quotaError, likelyUnapprovedQuota, retryAfterSeconds } =
      await getAccounts(env, { userId, projectId, refresh: true, userInitiated: true });
    result.accounts = accounts;
    result.selectedAccountId = selectedAccountId;

    if (quotaError) {
      const error = new Error(quotaError);
      error.status = 429;
      error.code = likelyUnapprovedQuota ? 'QUOTA_NOT_APPROVED' : 'QUOTA_EXCEEDED';
      error.retryAfterSeconds = retryAfterSeconds || null;
      result.failure = failurePayload(diagnostics, error);
      // A cached list still lets the user choose; only an empty one is a wall.
      result.next = accounts.length ? 'select-account' : 'error';
      return result;
    }

    markStage(diagnostics, STAGES.BUSINESS_PROFILE_API, { accounts_fetched: true });

    if (accounts.length === 0) {
      result.next = 'no-accounts';
      return result;
    }
    if (accounts.length > 1) {
      result.next = 'select-account';
      return result;
    }

    // Exactly one account: pin it and carry on to its locations.
    await setConnectionAccount(userId, connection.id, accounts[0]);
    result.selectedAccountId = accounts[0].accountId;

    markStage(diagnostics, STAGES.LOCATIONS);
    const locations = await getLocations(env, { userId, projectId });
    result.locations = locations.map(publicLocation);
    markStage(diagnostics, STAGES.LOCATIONS, { locations_fetched: true });

    if (locations.length === 0) {
      result.next = 'no-locations';
      return result;
    }
    if (locations.length > 1) {
      result.next = 'select-location';
      return result;
    }

    // Exactly one location: attach it as the primary profile for the project.
    // This is the write that makes later page loads free - everything the page
    // renders now lives in gbp_locations.
    markStage(diagnostics, STAGES.SAVE);
    const row = await attachLocation(userId, projectId, connection.id, locations[0], {
      isPrimary: true,
    });
    result.attachedLocationId = row?.id || null;
    markStage(diagnostics, STAGES.SAVE, { profile_saved: true });
    result.next = 'ready';
    return result;
  } catch (error) {
    // Consent is already spent and the tokens are stored, so this reports how
    // far the flow got rather than discarding a usable connection.
    result.failure = failurePayload(diagnostics, error);
    result.next = result.accounts.length ? 'select-account' : 'error';
    return result;
  }
}

/** Location fields the browser may see. Never the raw Google payload. */
function publicLocation(location) {
  return {
    locationId: location.locationId,
    placeId: location.placeId,
    businessName: location.businessName,
    storeCode: location.storeCode,
    primaryCategory: location.primaryCategory,
    address: location.formattedAddress,
    phone: location.phone,
    websiteUrl: location.websiteUrl,
    verificationStatus: location.verificationStatus,
    openStatus: location.openStatus,
  };
}

function connectionSummary(connection, locationCount, sync) {
  // Always answered from the database - no Google call is made to render the
  // page. `dataSource` says so explicitly so the UI can label it.
  if (!connection) return { connected: false, connectionStatus: 'disconnected', dataSource: 'database' };
  return {
    connected: connection.status === 'connected',
    status: connection.status,
    // The state machine the UI switches on: connected | needs_reauth |
    // disconnected. 'connecting' and 'failed' are transient and owned by the
    // browser during the OAuth round trip, so they never persist here.
    connectionStatus: connection.status === 'connected' ? 'connected' : connection.status,
    dataSource: 'database',
    // Whether the page can render without asking Google for anything.
    hasSavedProfile: locationCount > 0,
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
    const { action, code, redirectUri, returnTo, state } = body;
    let { projectId } = body;

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
            // Signed, so the projectId Google echoes back cannot be swapped for
            // another project's on the return leg.
            state: await signGbpState({ projectId, returnTo, userId }, env),
          }),
        },
        200,
        headers
      );
    }

    if (action === 'exchange') {
      // Every early exit below carries the same diagnostics shape as a late
      // one, so the callback page has one payload to render rather than two.
      const diagnostics = createDiagnostics();

      if (!clientSecret) {
        return jsonResponse(
          failurePayload(diagnostics, {
            message: 'Google Client Secret is not configured. Add it in Settings > General.',
            status: 500,
            code: 'OAUTH_NOT_CONFIGURED',
          }),
          500,
          headers
        );
      }
      if (!code || !redirectUri) {
        return jsonResponse(
          failurePayload(diagnostics, {
            message: 'Google did not return an authorization code.',
            status: 400,
            code: 'NO_AUTH_CODE',
          }),
          400,
          headers
        );
      }
      // The signed state is the authority on which project this consent was
      // for. Taking it from the request body instead would let a crafted
      // callback URL bind a Google account to a project of the attacker's
      // choosing - which is the exact attack `state` exists to stop.
      if (state) {
        try {
          const verified = await verifyGbpState(state, env, { userId });
          if (verified.projectId) projectId = verified.projectId;
        } catch (error) {
          return jsonResponse(failurePayload(diagnostics, error), error?.status || 400, headers);
        }
      }

      // Google requires the redirect URI on the token exchange to match the one
      // the consent was issued for, so the same check guards this leg.
      if (expectedRedirectUri && redirectUri !== expectedRedirectUri) {
        return jsonResponse(
          failurePayload(diagnostics, {
            message:
              `Google OAuth redirect URI mismatch. The sign-in returned to ${redirectUri}, but the configured Business Profile redirect is ${expectedRedirectUri}.`,
            status: 400,
            code: 'REDIRECT_URI_MISMATCH',
          }),
          400,
          headers
        );
      }
      await requireProject(env, userId, projectId);

      // Consent came back with a code, so authentication itself succeeded.
      markStage(diagnostics, STAGES.TOKEN_EXCHANGE, { authentication: true });

      let tokens;
      try {
        tokens = await exchangeAuthorizationCode(env, { code, redirectUri });
      } catch (error) {
        // A missing scope is caught inside the exchange, so attribute it to the
        // permission stage rather than to the token swap.
        if (error?.code === 'SCOPE_NOT_GRANTED') markStage(diagnostics, STAGES.SCOPE_CHECK);
        return jsonResponse(failurePayload(diagnostics, error), error?.status || 502, headers);
      }

      markStage(diagnostics, STAGES.SCOPE_CHECK, {
        permission_granted: true,
        token_received: true,
      });

      const userInfo = await fetchGoogleUserInfo(tokens.access_token);

      const existing = await getConnection(userId, projectId);
      if (!tokens.refresh_token && !existing?.refresh_token_encrypted) {
        // Without a refresh token the connection dies in an hour and every
        // background sync fails. Better to fail loudly here.
        return jsonResponse(
          failurePayload(diagnostics, {
            message:
              'Google did not return a refresh token. Remove SEOX from your Google account permissions (myaccount.google.com/permissions) and connect again.',
            status: 400,
            code: 'NO_REFRESH_TOKEN',
          }),
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

      // Read what this identity manages, then take the flow as far as it can go
      // without guessing:
      //
      //   one account   -> pin it, and look at its locations
      //   one location  -> attach it as the project's primary profile
      //   several       -> stop, and let the page present the choice
      //   none          -> say so plainly; it is a permissions fact, not a fault
      //
      // Each step is one Google call and only runs when the previous one left
      // exactly one candidate, so a connect never fans out across the quota.
      const outcome = await resolveProfiles(env, { userId, projectId, connection, diagnostics });

      await logSync({
        userId,
        projectId,
        syncType: 'connect',
        status: outcome.failure ? 'partial' : 'success',
        message: outcome.failure?.message || null,
        itemsSynced: outcome.accounts.length,
      });

      // The connection is stored and the tokens are valid either way, so this
      // is always a 200: `success` says whether the profiles came back, and the
      // diagnostics say which stage stopped if they did not.
      const base = outcome.failure
        ? { ...outcome.failure, connected: true }
        : successPayload(diagnostics, {
            connected: true,
            profiles_found: outcome.accounts.length > 0,
          });

      return jsonResponse(
        {
          ...base,
          googleEmail: userInfo.email || null,
          accounts: outcome.accounts,
          // Kept for the existing callers that read these two names.
          accountsError: outcome.failure?.message || null,
          errorCode: outcome.failure?.error_type || null,
          selectedAccountId: outcome.selectedAccountId,
          locations: outcome.locations,
          attachedLocationId: outcome.attachedLocationId,
          // What the browser should do next, so the callback page does not have
          // to re-derive it from array lengths.
          next: outcome.next,
          // Zero accounts is a permissions problem on the Google side, not ours.
          needsAccountAccess: !outcome.failure && outcome.accounts.length === 0,
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
