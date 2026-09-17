// Structured account of how far a Business Profile connection got.
//
// The connect flow has several stages and they fail for unrelated reasons, but
// the browser used to receive one flat `{ error: "<message>" }` for all of
// them - which is how a TCP timeout on our own server reached a user as the
// word "Failed", next to a Google consent screen they had just completed
// successfully.
//
// So every stage reports itself. The payload says what succeeded, which stage
// stopped, what Google actually returned, and whose problem it is to fix. None
// of it includes a token, a secret, or anything else the browser should not
// hold: the fields are booleans, an HTTP status, and Google's own text.

export const STAGES = {
  OAUTH_CALLBACK: 'oauth_callback',
  TOKEN_EXCHANGE: 'token_exchange',
  SCOPE_CHECK: 'scope_check',
  BUSINESS_PROFILE_API: 'business_profile_api',
  LOCATIONS: 'locations',
  SAVE: 'save',
  COMPLETE: 'complete',
};

const STAGE_LABEL = {
  [STAGES.OAUTH_CALLBACK]: 'OAuth callback',
  [STAGES.TOKEN_EXCHANGE]: 'Access token exchange',
  [STAGES.SCOPE_CHECK]: 'Business Profile permission',
  [STAGES.BUSINESS_PROFILE_API]: 'Business Profile API (accounts)',
  [STAGES.LOCATIONS]: 'Business Profile API (locations)',
  [STAGES.SAVE]: 'Saving the profile',
  [STAGES.COMPLETE]: 'Complete',
};

/**
 * Who has to act, in a sentence.
 *
 * Deliberately concrete. "Permission denied" tells nobody what to do next;
 * naming the console page or the Business Profile Manager does.
 */
function possibleCause(code, status) {
  switch (code) {
    case 'NETWORK':
      return (
        'This server could not open a connection to Google. Nothing is wrong with the Google ' +
        'account, the permission, or the Cloud project — it is an outbound network problem on ' +
        'the application host, and retrying usually succeeds.'
      );
    case 'SCOPE_NOT_GRANTED':
      return (
        'The consent screen completed without the "Manage your Business Profile" permission. ' +
        'Connect again and leave that checkbox ticked.'
      );
    case 'SERVICE_DISABLED':
      return (
        'The API is not enabled on the Google Cloud project. Enable it in the Cloud Console, ' +
        'wait a few minutes for it to propagate, then connect again.'
      );
    case 'QUOTA_NOT_APPROVED':
      return (
        'The Business Profile APIs ship with a requests-per-minute quota of zero until Google ' +
        'approves the API access request for the Cloud project, so the very first call is ' +
        'refused. This clears when that request is approved — waiting does not help.'
      );
    case 'QUOTA_EXCEEDED':
      return 'Too many Business Profile requests in the current window. It clears on its own shortly.';
    case 'NEEDS_REAUTH':
      return (
        'The stored Google authorisation is no longer valid — usually the access was revoked or ' +
        'the account password changed. Reconnecting fixes it.'
      );
    case 'TOKEN_EXCHANGE_FAILED':
      return (
        'Google rejected the authorization code. This is normally a redirect URI that does not ' +
        'match the one registered on the OAuth client, or a code that was already used.'
      );
    case 'PERMISSION_DENIED':
      return (
        'Google accepted the sign-in but refused this data. The signed-in Google account is ' +
        'probably not an owner or manager of the listing — check it in Business Profile Manager.'
      );
    default:
      if (status === 401) return 'The access token was rejected. Reconnect to issue a new one.';
      if (status === 403) return 'Google refused the request for this account or Cloud project.';
      if (status >= 500) return 'Google returned a server error. This is usually temporary.';
      return 'See the Google error above for the exact reason.';
  }
}

/** Where the fix lives, so the UI can stop blaming the user for our outage. */
function ownerOf(code) {
  if (code === 'NETWORK') return 'application';
  if (code === 'SERVICE_DISABLED' || code === 'QUOTA_NOT_APPROVED' || code === 'QUOTA_EXCEEDED') {
    return 'google_cloud';
  }
  if (code === 'PERMISSION_DENIED') return 'google_account';
  if (code === 'SCOPE_NOT_GRANTED' || code === 'NEEDS_REAUTH') return 'user';
  return 'unknown';
}

/**
 * A progress record for one connect attempt.
 *
 * Starts with everything false and is marked as each stage passes, so a failure
 * payload shows exactly how far the flow got rather than only where it stopped.
 */
export function createDiagnostics() {
  return {
    authentication: false,
    permission_granted: false,
    token_received: false,
    accounts_fetched: false,
    locations_fetched: false,
    profile_saved: false,
    stage: STAGES.OAUTH_CALLBACK,
  };
}

export function markStage(diagnostics, stage, fields = {}) {
  Object.assign(diagnostics, fields, { stage });
  return diagnostics;
}

/**
 * The failure payload for a stage that threw.
 *
 * `details` carries Google's own words - useful, and safe: the GBP client only
 * ever puts Google's `error.message` there, never a request body.
 */
export function failurePayload(diagnostics, error) {
  const code = error?.code || 'GBP_ERROR';
  const status = Number(error?.status) || 500;

  return {
    success: false,
    ...diagnostics,
    stage_label: STAGE_LABEL[diagnostics.stage] || diagnostics.stage,
    error_code: status,
    error_type: code,
    message: error?.message || 'The Business Profile connection could not be completed.',
    details: error?.details || null,
    possible_cause: possibleCause(code, status),
    owner: ownerOf(code),
    retry_after_seconds: error?.retryAfterSeconds || null,
  };
}

export function successPayload(diagnostics, extra = {}) {
  return {
    success: true,
    ...diagnostics,
    stage: STAGES.COMPLETE,
    stage_label: STAGE_LABEL[STAGES.COMPLETE],
    ...extra,
  };
}
