// Google Business Profile API client.
//
// GBP is federated across several hosts, so every call goes through gbpFetch()
// which refreshes the access token when needed, records the call against the
// shared quota, and normalises Google's error shapes into thrown errors with a
// usable .status and .code.
//
//   Account Management   accounts
//   Business Information locations, categories, attributes
//   Performance          daily metric time series
//   My Business v4       reviews, local posts, media  (still the only endpoint)

import { decryptSecret, encryptSecret } from './gbp-crypto.js';
import { markConnectionStatus, recordApiUsage, updateConnectionTokens } from './gbp-repository.js';
import { getAdminSettings } from './app-settings.js';
import { googleRedirectUri } from './google-redirects.js';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

const HOSTS = {
  accountManagement: 'https://mybusinessaccountmanagement.googleapis.com/v1',
  businessInformation: 'https://mybusinessbusinessinformation.googleapis.com/v1',
  performance: 'https://businessprofileperformance.googleapis.com/v1',
  legacy: 'https://mybusiness.googleapis.com/v4',
  qanda: 'https://mybusinessqanda.googleapis.com/v1',
};

export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const GBP_SCOPES = [GBP_SCOPE, 'https://www.googleapis.com/auth/userinfo.email', 'openid'];

// Fields the Business Information API requires in readMask. Requesting only
// what the dashboard renders keeps the response small and the quota cheap.
const LOCATION_READ_MASK = [
  'name',
  'title',
  'storeCode',
  'phoneNumbers',
  'categories',
  'storefrontAddress',
  'websiteUri',
  'regularHours',
  'specialHours',
  'serviceArea',
  'profile',
  'labels',
  'latlng',
  'openInfo',
  'metadata',
].join(',');

export const DAILY_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_CONVERSATIONS',
];

function apiError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/**
 * Business Profile OAuth configuration, read from admin_settings.
 *
 * The application deliberately uses a single Google OAuth client across Search
 * Console, Google sign-in and Business Profile; only the redirect URI differs
 * per flow.
 *
 * The redirect used to fall back to the GSC and then the sign-in redirect. That
 * is never correct: those URIs point at *other routes* (/gsc/oauth-callback and
 * /api/auth/google/callback), so a Business Profile consent would return to a
 * page that knows nothing about the pending connection. Worse, the browser fell
 * back to `<origin>/gbp/oauth-callback` instead, so with google_gbp_redirect_uri
 * unset the two sides disagreed and every connect attempt failed with
 * "redirect URI mismatch".
 *
 * `request` lets the URI be derived from the application origin when no value
 * is configured, exactly as the sign-in flow does.
 */
export async function getOAuthConfig(env, request = null) {
  const settings = await getAdminSettings(['google_client_id', 'google_client_secret'], env);

  return {
    clientId: settings.google_client_id || '',
    clientSecret: settings.google_client_secret || '',
    redirectUri: request ? await googleRedirectUri('gbp', request, env) : '',
  };
}

export function encodeState(payload) {
  const json = JSON.stringify(payload || {});
  return typeof btoa === 'function' ? btoa(json) : Buffer.from(json, 'utf8').toString('base64');
}

export function buildAuthUrl({ clientId, redirectUri, state }) {
  if (!clientId) throw new Error('Google OAuth client ID is missing.');
  if (!redirectUri) throw new Error('Google OAuth redirect URI is missing.');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GBP_SCOPES.join(' '),
    access_type: 'offline',
    // GBP needs a durable refresh token; without consent Google omits it on
    // every authorisation after the first.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: encodeState(state),
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(env, { code, redirectUri }) {
  const { clientId, clientSecret } = await getOAuthConfig(env);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw apiError(
      data?.error_description || data?.error || 'Google rejected the authorization code.',
      400,
      'TOKEN_EXCHANGE_FAILED'
    );
  }
  if (!String(data.scope || '').includes(GBP_SCOPE)) {
    throw apiError(
      'The Business Profile permission was not granted. Re-run the connection and keep the "Manage your Business Profile" checkbox ticked.',
      400,
      'SCOPE_NOT_GRANTED'
    );
  }
  return data;
}

export async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

export async function revokeToken(token) {
  if (!token) return;
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Local disconnect must still succeed when Google is unreachable.
  }
}

// --- Access token lifecycle ------------------------------------------------

const EXPIRY_SKEW_MS = 120000;

export async function resolveAccessToken(env, connection) {
  const expiresAt = connection.token_expiry ? new Date(`${connection.token_expiry}Z`).getTime() : 0;
  if (connection.access_token_encrypted && expiresAt > Date.now() + EXPIRY_SKEW_MS) {
    return decryptSecret(env, connection.access_token_encrypted);
  }

  const refreshToken = await decryptSecret(env, connection.refresh_token_encrypted);
  if (!refreshToken) {
    await markConnectionStatus(
      connection.user_id,
      connection.id,
      'needs_reauth',
      'No refresh token stored.'
    );
    throw apiError('Business Profile session expired. Reconnect to continue.', 401, 'NEEDS_REAUTH');
  }

  const { clientId, clientSecret } = await getOAuthConfig(env);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // invalid_grant means the user revoked access or changed their password;
    // the stored refresh token will never work again.
    await markConnectionStatus(
      connection.user_id,
      connection.id,
      'needs_reauth',
      data?.error_description || data?.error || 'Refresh failed.'
    );
    throw apiError(
      'Business Profile access was revoked in the Google account. Reconnect to continue.',
      401,
      'NEEDS_REAUTH'
    );
  }

  const tokenExpiry = new Date(Date.now() + Number(data.expires_in || 3600) * 1000);
  await updateConnectionTokens(connection.user_id, connection.id, {
    accessTokenEncrypted: await encryptSecret(env, data.access_token),
    refreshTokenEncrypted: data.refresh_token ? await encryptSecret(env, data.refresh_token) : null,
    tokenExpiry,
  });

  connection.token_expiry = tokenExpiry.toISOString().slice(0, 19).replace('T', ' ');
  return data.access_token;
}

// --- Core request ----------------------------------------------------------

export async function gbpFetch(env, connection, { api, path, query: search, method = 'GET', body }) {
  const base = HOSTS[api];
  if (!base) throw apiError(`Unknown GBP API "${api}".`, 500, 'UNKNOWN_API');

  const accessToken = await resolveAccessToken(env, connection);
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(search || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((entry) => url.searchParams.append(key, entry));
    else url.searchParams.set(key, String(value));
  }

  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    await recordApiUsage({
      userId: connection.user_id,
      projectId: connection.project_id,
      api,
      endpoint: path,
      statusCode: 0,
      errorCode: 'NETWORK',
      durationMs: Date.now() - startedAt,
    });
    throw apiError(`Could not reach Google (${cause?.message || 'network error'}).`, 502, 'NETWORK');
  }

  const durationMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => ({}));
  const googleError = payload?.error;

  await recordApiUsage({
    userId: connection.user_id,
    projectId: connection.project_id,
    api,
    endpoint: path,
    statusCode: response.status,
    errorCode: googleError?.status || null,
    durationMs,
  });

  if (response.ok) return payload;

  const detail = googleError?.message || `Google returned ${response.status}.`;

  if (response.status === 401) {
    await markConnectionStatus(connection.user_id, connection.id, 'needs_reauth', detail);
    throw apiError('Business Profile authorisation is no longer valid. Reconnect to continue.', 401, 'NEEDS_REAUTH');
  }
  if (response.status === 403) {
    // Either the Google account is not a manager of this listing, or the API is
    // not enabled / has zero quota on the Cloud project.
    throw apiError(detail, 403, googleError?.status || 'PERMISSION_DENIED');
  }
  if (response.status === 429) {
    // A 429 on the very first call is usually not throttling at all: a Cloud
    // project that has not been granted Business Profile API access has a
    // per-minute quota of zero, and every request comes back 429 forever. The
    // generic 'try later' wording sent people off to wait for a window that
    // never opens, so Google's own detail is kept - it names the quota metric
    // and the limit, which is what distinguishes the two cases.
    throw apiError(
      `Google Business Profile API quota exhausted. Requests are throttled until the quota window resets. Google returned: ${detail}`,
      429,
      'QUOTA_EXCEEDED'
    );
  }
  throw apiError(detail, response.status >= 500 ? 502 : response.status, googleError?.status || 'GBP_ERROR');
}

// --- Resource helpers ------------------------------------------------------

export async function listAccounts(env, connection) {
  const accounts = [];
  let pageToken;
  do {
    const page = await gbpFetch(env, connection, {
      api: 'accountManagement',
      path: '/accounts',
      query: { pageSize: 20, pageToken },
    });
    accounts.push(...(page.accounts || []));
    pageToken = page.nextPageToken;
  } while (pageToken && accounts.length < 100);

  return accounts.map((account) => ({
    accountId: account.name,
    accountName: account.accountName || account.name,
    accountType: account.type || account.accountType || null,
    verificationState: account.verificationState || null,
    role: account.role || null,
  }));
}

export async function listLocations(env, connection, accountId) {
  const locations = [];
  let pageToken;
  do {
    const page = await gbpFetch(env, connection, {
      api: 'businessInformation',
      path: `/${accountId}/locations`,
      query: { readMask: LOCATION_READ_MASK, pageSize: 100, pageToken },
    });
    locations.push(...(page.locations || []));
    pageToken = page.nextPageToken;
  } while (pageToken && locations.length < 500);

  return locations.map((location) => normaliseLocation(location, accountId));
}

export async function getLocation(env, connection, accountId, locationId) {
  const bare = String(locationId).replace(/^locations\//, '');
  const location = await gbpFetch(env, connection, {
    api: 'businessInformation',
    path: `/locations/${bare}`,
    query: { readMask: LOCATION_READ_MASK },
  });
  return normaliseLocation(location, accountId);
}

export function normaliseLocation(location, accountId) {
  const address = location.storefrontAddress;
  const formattedAddress = address
    ? [...(address.addressLines || []), address.locality, address.administrativeArea, address.postalCode]
        .filter(Boolean)
        .join(', ')
    : null;

  return {
    accountId,
    locationId: location.name,
    placeId: location.metadata?.placeId || null,
    businessName: location.title || location.name,
    storeCode: location.storeCode || null,
    primaryCategory: location.categories?.primaryCategory?.displayName || null,
    formattedAddress,
    phone: location.phoneNumbers?.primaryPhone || null,
    websiteUrl: location.websiteUri || null,
    mapsUri: location.metadata?.mapsUri || null,
    verificationStatus: resolveVerificationStatus(location),
    openStatus: location.openInfo?.status || null,
    hasGoogleUpdates: Boolean(location.metadata?.hasPendingEdits),
    raw: location,
  };
}

function resolveVerificationStatus(location) {
  const metadata = location.metadata || {};
  if (metadata.hasVoiceOfMerchant === true) return 'VERIFIED';
  if (metadata.hasVoiceOfMerchant === false) return 'UNVERIFIED';
  if (metadata.canOperateLocalPost) return 'VERIFIED';
  return 'UNKNOWN';
}

// --- Performance -----------------------------------------------------------

function toDateParts(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export async function fetchDailyMetrics(env, connection, locationId, { startDate, endDate }) {
  const start = toDateParts(startDate);
  const end = toDateParts(endDate);
  const payload = await gbpFetch(env, connection, {
    api: 'performance',
    path: `/${locationId}:fetchMultiDailyMetricsTimeSeries`,
    query: {
      dailyMetrics: DAILY_METRICS,
      'dailyRange.start_date.year': start.year,
      'dailyRange.start_date.month': start.month,
      'dailyRange.start_date.day': start.day,
      'dailyRange.end_date.year': end.year,
      'dailyRange.end_date.month': end.month,
      'dailyRange.end_date.day': end.day,
    },
  });

  const rows = [];
  for (const entry of payload.multiDailyMetricTimeSeries || []) {
    for (const series of entry.dailyMetricTimeSeries || []) {
      const metric = series.dailyMetric;
      for (const point of series.timeSeries?.datedValues || []) {
        const { year, month, day } = point.date || {};
        if (!year || !month || !day) continue;
        rows.push({
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          metric,
          value: Number(point.value || 0),
        });
      }
    }
  }
  return rows;
}

// --- Reviews and posts (legacy v4) ----------------------------------------

function legacyLocationPath(accountId, locationId) {
  // Business Information returns "locations/123"; v4 needs the account prefix.
  const bare = String(locationId).replace(/^locations\//, '');
  return `/${accountId}/locations/${bare}`;
}

export async function fetchReviewSummary(env, connection, accountId, locationId) {
  const payload = await gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/reviews`,
    query: { pageSize: 50, orderBy: 'updateTime desc' },
  });

  const reviews = payload.reviews || [];
  return {
    averageRating: payload.averageRating ?? null,
    totalReviews: payload.totalReviewCount ?? reviews.length,
    // Only the first page is inspected: on a listing with thousands of reviews
    // the unanswered figure is the recent backlog, which is what the dashboard
    // asks the user to act on. Full counts arrive with the reviews module.
    unansweredInRecent: reviews.filter((review) => !review.reviewReply).length,
    inspectedCount: reviews.length,
    latest: reviews.slice(0, 5).map((review) => ({
      reviewId: review.reviewId || review.name || null,
      reviewer: review.reviewer?.displayName || 'Anonymous',
      starRating: review.starRating || null,
      comment: review.comment || '',
      createTime: review.createTime || null,
      replied: Boolean(review.reviewReply),
    })),
  };
}

export async function fetchRecentPosts(env, connection, accountId, locationId) {
  const payload = await gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/localPosts`,
    query: { pageSize: 50 },
  });

  const posts = payload.localPosts || [];
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const times = posts.map((post) => new Date(post.createTime || 0).getTime()).filter(Boolean);

  return {
    totalFetched: posts.length,
    postsLast30Days: times.filter((time) => time >= cutoff).length,
    lastPostAt: times.length ? new Date(Math.max(...times)) : null,
  };
}

// --- Full profile (Profile Manager) ---------------------------------------

// Everything the profile editor can write, plus the read-only metadata it needs
// to decide what is editable. serviceItems and moreHours are omitted from the
// dashboard mask because they are large and only the editor uses them.
const FULL_LOCATION_READ_MASK = [
  LOCATION_READ_MASK,
  'moreHours',
  'serviceItems',
  'languageCode',
  'relationshipData',
].join(',');

export async function getFullLocation(env, connection, locationId) {
  const bare = String(locationId).replace(/^locations\//, '');
  return gbpFetch(env, connection, {
    api: 'businessInformation',
    path: `/locations/${bare}`,
    query: { readMask: FULL_LOCATION_READ_MASK },
  });
}

// updateMask is required and must list only writable fields; sending a mask
// with a read-only field (metadata, name) makes Google reject the whole patch.
export async function patchLocation(env, connection, locationId, patch, updateMask) {
  const bare = String(locationId).replace(/^locations\//, '');
  return gbpFetch(env, connection, {
    api: 'businessInformation',
    path: `/locations/${bare}`,
    method: 'PATCH',
    query: { updateMask: updateMask.join(',') },
    body: patch,
  });
}

export async function getLocationAttributes(env, connection, locationId) {
  const bare = String(locationId).replace(/^locations\//, '');
  return gbpFetch(env, connection, {
    api: 'businessInformation',
    path: `/locations/${bare}/attributes`,
  });
}

export async function patchLocationAttributes(env, connection, locationId, attributes, attributeMask) {
  const bare = String(locationId).replace(/^locations\//, '');
  return gbpFetch(env, connection, {
    api: 'businessInformation',
    path: `/locations/${bare}/attributes`,
    method: 'PATCH',
    query: { attributeMask: attributeMask.join(',') },
    body: { name: `locations/${bare}/attributes`, attributes },
  });
}

// Which attributes Google offers for this category and country. Attribute sets
// are category-specific, so this is never hard-coded.
export async function listAttributeMetadata(env, connection, { categoryId, regionCode, languageCode = 'en' }) {
  const payload = await gbpFetch(env, connection, {
    api: 'businessInformation',
    path: '/attributes',
    query: {
      categoryName: categoryId,
      regionCode,
      languageCode,
      showAll: false,
      pageSize: 200,
    },
  });
  return payload.attributeMetadata || [];
}

export async function searchCategories(env, connection, { query: term, regionCode, languageCode = 'en' }) {
  const payload = await gbpFetch(env, connection, {
    api: 'businessInformation',
    path: '/categories',
    query: {
      regionCode,
      languageCode,
      filter: term ? `displayName=${term}` : undefined,
      view: 'FULL',
      pageSize: 50,
    },
  });
  return payload.categories || [];
}

// --- Local posts (Posts Manager) ------------------------------------------

export async function listLocalPosts(env, connection, accountId, locationId, pageSize = 100) {
  const payload = await gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/localPosts`,
    query: { pageSize },
  });
  return payload.localPosts || [];
}

export async function createLocalPost(env, connection, accountId, locationId, localPost) {
  return gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/localPosts`,
    method: 'POST',
    body: localPost,
  });
}

export async function updateLocalPost(env, connection, googlePostName, localPost, updateMask) {
  return gbpFetch(env, connection, {
    api: 'legacy',
    path: `/${String(googlePostName).replace(/^\/+/, '')}`,
    method: 'PATCH',
    query: { updateMask: updateMask.join(',') },
    body: localPost,
  });
}

export async function deleteLocalPost(env, connection, googlePostName) {
  return gbpFetch(env, connection, {
    api: 'legacy',
    path: `/${String(googlePostName).replace(/^\/+/, '')}`,
    method: 'DELETE',
  });
}

// --- Audit signals ---------------------------------------------------------

export async function countMedia(env, connection, accountId, locationId) {
  const payload = await gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/media`,
    query: { pageSize: 100 },
  });
  const items = payload.mediaItems || [];
  const byCategory = {};
  for (const item of items) {
    const category = item.locationAssociation?.category || 'UNCATEGORIZED';
    byCategory[category] = (byCategory[category] || 0) + 1;
  }
  return { total: payload.totalMediaItemCount ?? items.length, byCategory };
}

export async function fetchQuestions(env, connection, locationId) {
  const bare = String(locationId).replace(/^locations\//, '');
  const payload = await gbpFetch(env, connection, {
    api: 'qanda',
    path: `/locations/${bare}/questions`,
    query: { pageSize: 50, answersPerQuestion: 1 },
  });
  const questions = payload.questions || [];
  return {
    total: payload.totalSize ?? questions.length,
    answered: questions.filter((question) => (question.topAnswers || []).length > 0).length,
    unanswered: questions.filter((question) => (question.topAnswers || []).length === 0).length,
  };
}

// --- Reviews (legacy v4) ---------------------------------------------------

/**
 * Page through every review on a location.
 *
 * Google has added fields to the review resource over time (reply moderation
 * state, policy violations, review media, a direct reply URL). Those are read
 * defensively: whatever the API returns is normalised, and anything absent
 * stays null rather than being invented.
 */
export async function listAllReviews(env, connection, accountId, locationId, { maxPages = 20 } = {}) {
  const reviews = [];
  let pageToken;
  let pages = 0;
  let averageRating = null;
  let totalReviewCount = null;

  do {
    const payload = await gbpFetch(env, connection, {
      api: 'legacy',
      path: `${legacyLocationPath(accountId, locationId)}/reviews`,
      query: { pageSize: 50, orderBy: 'updateTime desc', pageToken },
    });

    if (averageRating === null) averageRating = payload.averageRating ?? null;
    if (totalReviewCount === null) totalReviewCount = payload.totalReviewCount ?? null;

    reviews.push(...(payload.reviews || []));
    pageToken = payload.nextPageToken;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return {
    averageRating,
    totalReviewCount: totalReviewCount ?? reviews.length,
    truncated: Boolean(pageToken),
    reviews: reviews.map(normaliseReview),
  };
}

const STAR_NUMBERS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function normaliseReview(review) {
  const reply = review.reviewReply || null;
  const media = review.reviewMedia || review.media || [];

  return {
    reviewId: review.reviewId || String(review.name || '').split('/').pop(),
    reviewName: review.name || null,
    reviewerName: review.reviewer?.displayName || null,
    reviewerPhotoUrl: review.reviewer?.profilePhotoUrl || null,
    isAnonymous: Boolean(review.reviewer?.isAnonymous),
    starRating: STAR_NUMBERS[String(review.starRating || '').toUpperCase()] || 0,
    comment: review.comment || '',
    createTime: review.createTime || null,
    updateTime: review.updateTime || null,
    replyComment: reply?.comment || null,
    replyUpdateTime: reply?.updateTime || null,
    // Present only on API versions that expose them.
    replyModerationState: reply?.moderationState || review.replyModerationState || null,
    policyViolation: review.policyViolation || reply?.policyViolation || null,
    reviewReplyUri: review.reviewReplyUri || review.replyUri || null,
    media: Array.isArray(media) ? media : [],
    raw: review,
  };
}

export async function replyToReview(env, connection, accountId, locationId, reviewId, comment) {
  return gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/reviews/${reviewId}/reply`,
    method: 'PUT',
    body: { comment },
  });
}

export async function deleteReviewReply(env, connection, accountId, locationId, reviewId) {
  return gbpFetch(env, connection, {
    api: 'legacy',
    path: `${legacyLocationPath(accountId, locationId)}/reviews/${reviewId}/reply`,
    method: 'DELETE',
  });
}

// --- Q&A -------------------------------------------------------------------

export async function listAllQuestions(env, connection, locationId, { maxPages = 10 } = {}) {
  const bare = String(locationId).replace(/^locations\//, '');
  const questions = [];
  let pageToken;
  let pages = 0;
  let totalSize = null;

  do {
    const payload = await gbpFetch(env, connection, {
      api: 'qanda',
      path: `/locations/${bare}/questions`,
      query: { pageSize: 50, answersPerQuestion: 10, pageToken },
    });
    if (totalSize === null) totalSize = payload.totalSize ?? null;
    questions.push(...(payload.questions || []));
    pageToken = payload.nextPageToken;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return {
    totalSize: totalSize ?? questions.length,
    truncated: Boolean(pageToken),
    questions: questions.map(normaliseQuestion),
  };
}

export function normaliseQuestion(question) {
  const answers = question.topAnswers || [];
  // The merchant's own answer is the one authored as MERCHANT.
  const ownerAnswer = answers.find(
    (answer) => String(answer.author?.type || '').toUpperCase() === 'MERCHANT'
  );

  return {
    questionName: question.name,
    authorName: question.author?.displayName || null,
    authorType: question.author?.type || null,
    text: question.text || '',
    createTime: question.createTime || null,
    updateTime: question.updateTime || null,
    upvoteCount: Number(question.upvoteCount || 0),
    totalAnswerCount: Number(question.totalAnswerCount || answers.length),
    ownerAnswer: ownerAnswer?.text || null,
    ownerAnswerTime: ownerAnswer?.updateTime || ownerAnswer?.createTime || null,
    topAnswers: answers.map((answer) => ({
      text: answer.text || '',
      authorName: answer.author?.displayName || null,
      authorType: answer.author?.type || null,
      upvoteCount: Number(answer.upvoteCount || 0),
      updateTime: answer.updateTime || null,
    })),
    raw: question,
  };
}

// Upsert replaces the merchant answer rather than adding another one.
export async function upsertQuestionAnswer(env, connection, questionName, text) {
  return gbpFetch(env, connection, {
    api: 'qanda',
    path: `/${String(questionName).replace(/^\/+/, '')}/answers:upsert`,
    method: 'POST',
    body: { answer: { text } },
  });
}

export async function deleteQuestionAnswer(env, connection, questionName) {
  return gbpFetch(env, connection, {
    api: 'qanda',
    path: `/${String(questionName).replace(/^\/+/, '')}/answers:delete`,
    method: 'DELETE',
  });
}

// --- Search keywords (Performance API) -------------------------------------

/**
 * Monthly search keyword impressions.
 *
 * Google returns either an exact `value` or a `threshold`, which means "fewer
 * than this". The two are kept apart so a floor is never treated as a count.
 */
export async function fetchSearchKeywords(env, connection, locationId, { startMonth, endMonth }) {
  const bare = String(locationId).replace(/^locations\//, '');
  const keywords = [];
  let pageToken;
  let pages = 0;

  do {
    const payload = await gbpFetch(env, connection, {
      api: 'performance',
      path: `/locations/${bare}/searchkeywords/impressions/monthly`,
      query: {
        'monthlyRange.start_month.year': startMonth.year,
        'monthlyRange.start_month.month': startMonth.month,
        'monthlyRange.end_month.year': endMonth.year,
        'monthlyRange.end_month.month': endMonth.month,
        pageSize: 100,
        pageToken,
      },
    });

    for (const entry of payload.searchKeywordsCounts || []) {
      const insights = entry.insightsValue || {};
      const exact = insights.value !== undefined && insights.value !== null;
      keywords.push({
        keyword: entry.searchKeyword,
        impressions: Number(exact ? insights.value : insights.threshold) || 0,
        isThreshold: !exact,
      });
    }

    pageToken = payload.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 10);

  return keywords;
}
