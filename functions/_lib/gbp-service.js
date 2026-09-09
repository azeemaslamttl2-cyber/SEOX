// GBPService — the single layer between SEOX and the Google Business Profile
// APIs.
//
//   React / UI  ->  /api/gbp/*  ->  GBPService  ->  Google APIs
//                   background worker  ^
//
// The browser never holds a Google token and never calls Google. Both the HTTP
// endpoints and the background job handlers enter here, so an operation behaves
// the same whether a person triggered it or the scheduler did.
//
// Each function resolves its own connection from (userId, projectId) and
// verifies the location belongs to that user, so a caller cannot pass in a
// location it does not own.

import {
  createLocalPost,
  countMedia,
  deleteLocalPost,
  deleteQuestionAnswer,
  deleteReviewReply,
  fetchQuestions,
  fetchRecentPosts,
  getLocation,
  fetchDailyMetrics,
  fetchReviewSummary,
  fetchSearchKeywords,
  getFullLocation,
  getLocationAttributes,
  listAccounts,
  listAllQuestions,
  listAllReviews,
  listLocalPosts,
  listLocations,
  normaliseLocation,
  patchLocation,
  patchLocationAttributes,
  replyToReview,
  updateLocalPost,
  upsertQuestionAnswer,
} from './gbp-client.js';
import {
  attachLocation,
  getConnection,
  getLocationRow,
  getPrimaryLocation,
  logSync,
  replaceDailyMetrics,
  setConnectionAccount,
  updateLocationSummary,
} from './gbp-repository.js';
import {
  replaceLocationCategories,
  replaceLocationServices,
  replaceLocationAttributes,
  upsertAccounts,
  upsertQuestions,
  upsertReviews,
  upsertSearchKeywords,
} from './gbp-store.js';
import { buildSectionPatch, validateSection } from './gbp-profile.js';
import { sentimentOf, summarise } from './gbp-reviews.js';

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

async function requireConnection(userId, projectId, { needsAccount = true } = {}) {
  const connection = await getConnection(userId, projectId);
  if (!connection) throw httpError('No Business Profile is connected to this project.', 404);
  if (connection.status !== 'connected') {
    throw httpError(
      connection.status_detail || 'Business Profile connection needs to be re-authorised.',
      401,
      'NEEDS_REAUTH'
    );
  }
  if (needsAccount && !connection.account_id) {
    throw httpError('Select a Business Profile account first.', 409);
  }
  return connection;
}

async function requireLocation(userId, projectId, locationRowId) {
  const location = locationRowId
    ? await getLocationRow(userId, locationRowId)
    : await getPrimaryLocation(userId, projectId);
  if (!location || location.project_id !== projectId) {
    throw httpError('No Business Profile location is attached to this project.', 404);
  }
  return location;
}

async function hashKey(value) {
  const data = new TextEncoder().encode(String(value).toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toDateParts(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function shiftDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// --- Connection ------------------------------------------------------------

export async function getAccounts(env, { userId, projectId }) {
  const connection = await requireConnection(userId, projectId, { needsAccount: false });
  const accounts = await listAccounts(env, connection);
  await upsertAccounts(userId, projectId, connection.id, accounts);
  return { accounts, selectedAccountId: connection.account_id || null };
}

export async function selectAccount(env, { userId, projectId, accountId }) {
  const connection = await requireConnection(userId, projectId, { needsAccount: false });
  const accounts = await listAccounts(env, connection);
  const match = accounts.find((account) => account.accountId === accountId);
  if (!match) {
    throw httpError('That Business Profile account is no longer available to this Google login.', 403);
  }
  await upsertAccounts(userId, projectId, connection.id, accounts);
  await setConnectionAccount(userId, connection.id, match);
  return match;
}

export async function getLocations(env, { userId, projectId }) {
  const connection = await requireConnection(userId, projectId);
  return listLocations(env, connection, connection.account_id);
}

// --- Profile ---------------------------------------------------------------

/**
 * Rewrite the normalised category / service / attribute projections from an
 * already-fetched profile. Split out so an endpoint that has just fetched the
 * profile can refresh them without spending a second API call.
 */
export async function projectProfile(userId, locationRowId, profile, attributes) {
  const categories = [];
  const primary = profile.categories?.primaryCategory;
  if (primary?.name) {
    categories.push({ categoryId: primary.name, displayName: primary.displayName, isPrimary: true });
  }
  for (const category of profile.categories?.additionalCategories || []) {
    if (!category?.name) continue;
    categories.push({ categoryId: category.name, displayName: category.displayName, isPrimary: false });
  }
  await replaceLocationCategories(userId, locationRowId, categories);

  const services = [];
  for (const item of profile.serviceItems || []) {
    const structured = item.structuredServiceItem;
    const free = item.freeFormServiceItem;
    const label = free?.label?.displayName || null;
    const serviceTypeId = structured?.serviceTypeId || null;
    // Stable key so a resync updates rather than duplicates a service.
    const key = serviceTypeId || label;
    if (!key) continue;
    services.push({
      serviceKey: await hashKey(key),
      serviceTypeId,
      label,
      description: structured?.description || free?.label?.description || null,
      categoryId: free?.category || null,
      isStructured: Boolean(serviceTypeId),
      priceUnits: item.price?.units ?? null,
      priceCurrency: item.price?.currencyCode ?? null,
    });
  }
  await replaceLocationServices(userId, locationRowId, services);

  if (attributes) {
    await replaceLocationAttributes(
      userId,
      locationRowId,
      (attributes.attributes || []).map((attribute) => ({
        attributeId: attribute.name,
        valueType: attribute.valueType || null,
        values: attribute.values ?? attribute.repeatedEnumValue ?? attribute.uriValues ?? null,
      }))
    );
  }


  return { categories, services };
}

/**
 * Fetch the full profile from Google, refresh the stored copy, and rewrite the
 * normalised projections.
 */
export async function syncProfile(env, { userId, projectId, locationRowId, withAttributes = true }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const started = Date.now();

  const profile = await getFullLocation(env, connection, location.location_id);

  let attributes = null;
  let attributesError = null;
  if (withAttributes) {
    try {
      attributes = await getLocationAttributes(env, connection, location.location_id);
    } catch (error) {
      attributesError = error.message;
    }
  }

  await attachLocation(
    userId,
    projectId,
    connection.id,
    normaliseLocation(profile, connection.account_id),
    { isPrimary: Boolean(location.is_primary) }
  );

  const { categories, services } = await projectProfile(userId, location.id, profile, attributes);

  await logSync({
    userId,
    projectId,
    locationRowId: location.id,
    syncType: 'profile-sync',
    status: attributesError ? 'partial' : 'success',
    message: attributesError,
    itemsSynced: categories.length + services.length,
    durationMs: Date.now() - started,
  });

  return { profile, attributes, attributesError, location, categories, services };
}

export async function updateProfile(env, { userId, projectId, locationRowId, section, value }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);

  const errors = validateSection(section, value);
  if (errors.length) {
    const error = httpError('The change was not sent to Google.', 422);
    error.validationErrors = errors;
    throw error;
  }

  const { body, mask } = buildSectionPatch(section, value);
  await patchLocation(env, connection, location.location_id, body, mask);
  return syncProfile(env, { userId, projectId, locationRowId: location.id });
}

export async function updateAttributes(env, { userId, projectId, locationRowId, attributes }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const mask = attributes.map((attribute) => attribute.name).filter(Boolean);
  if (!mask.length) throw httpError('Each attribute needs a name.', 400);
  return patchLocationAttributes(env, connection, location.location_id, attributes, mask);
}

// --- Reviews ---------------------------------------------------------------

export async function getReviews(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const started = Date.now();

  const data = await listAllReviews(env, connection, connection.account_id, location.location_id);
  const withSentiment = data.reviews.map((review) => ({
    ...review,
    sentiment: sentimentOf(review.starRating),
  }));
  await upsertReviews(userId, projectId, location.id, withSentiment);

  const summary = summarise(withSentiment);
  await updateLocationSummary(userId, location.id, {
    averageRating: data.averageRating ?? summary.averageRating ?? undefined,
    totalReviews: data.totalReviewCount ?? undefined,
    unansweredReviews: summary.counts.unanswered,
  });

  await logSync({
    userId,
    projectId,
    locationRowId: location.id,
    syncType: 'reviews-sync',
    status: data.truncated ? 'partial' : 'success',
    message: data.truncated ? 'Stopped at the page cap; run again for older reviews.' : null,
    itemsSynced: withSentiment.length,
    durationMs: Date.now() - started,
  });

  return { ...data, synced: withSentiment.length, summary };
}

export async function replyReview(env, { userId, projectId, locationRowId, reviewId, comment }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return replyToReview(env, connection, connection.account_id, location.location_id, reviewId, comment);
}

export async function deleteReply(env, { userId, projectId, locationRowId, reviewId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return deleteReviewReply(env, connection, connection.account_id, location.location_id, reviewId);
}

// --- Posts -----------------------------------------------------------------

export async function getPosts(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return listLocalPosts(env, connection, connection.account_id, location.location_id);
}

export async function createPost(env, { userId, projectId, locationRowId, localPost }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return createLocalPost(env, connection, connection.account_id, location.location_id, localPost);
}

export async function updatePost(env, { userId, projectId, googlePostName, localPost, updateMask }) {
  const connection = await requireConnection(userId, projectId);
  return updateLocalPost(env, connection, googlePostName, localPost, updateMask);
}

export async function deletePost(env, { userId, projectId, googlePostName }) {
  const connection = await requireConnection(userId, projectId);
  return deleteLocalPost(env, connection, googlePostName);
}

// --- Q&A -------------------------------------------------------------------

export async function getQuestions(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const started = Date.now();

  const data = await listAllQuestions(env, connection, location.location_id);
  await upsertQuestions(userId, projectId, location.id, data.questions);

  await logSync({
    userId,
    projectId,
    locationRowId: location.id,
    syncType: 'qanda-sync',
    status: data.truncated ? 'partial' : 'success',
    itemsSynced: data.questions.length,
    durationMs: Date.now() - started,
  });
  return data;
}

export async function replyQuestion(env, { userId, projectId, questionName, text }) {
  const connection = await requireConnection(userId, projectId);
  return upsertQuestionAnswer(env, connection, questionName, text);
}

export async function deleteAnswer(env, { userId, projectId, questionName }) {
  const connection = await requireConnection(userId, projectId);
  return deleteQuestionAnswer(env, connection, questionName);
}

/**
 * The single location's live profile, without the projection rewrite. Used by
 * the overview refresh, which already has its own storage path.
 */
export async function getLocationProfile(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return {
    connection,
    location,
    profile: await getLocation(env, connection, connection.account_id, location.location_id),
  };
}

export async function getRecentPosts(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return fetchRecentPosts(env, connection, connection.account_id, location.location_id);
}

/**
 * Everything the health audit scores, gathered in one place.
 *
 * The profile is required; every other signal degrades to null with a warning,
 * which is what lets the audit skip a check instead of failing it.
 */
export async function getAuditSignals(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const warnings = [];

  const profile = await getFullLocation(env, connection, location.location_id);

  const optional = async (label, task) => {
    try {
      return await task();
    } catch (error) {
      warnings.push(`${label}: ${error.message}`);
      return null;
    }
  };

  const [attributes, reviews, posts, media, qanda] = await Promise.all([
    optional('Attributes', () => getLocationAttributes(env, connection, location.location_id)),
    optional('Reviews', () =>
      fetchReviewSummary(env, connection, connection.account_id, location.location_id)
    ),
    optional('Posts', () =>
      fetchRecentPosts(env, connection, connection.account_id, location.location_id)
    ),
    optional('Media', () => countMedia(env, connection, connection.account_id, location.location_id)),
    optional('Q&A', () => fetchQuestions(env, connection, location.location_id)),
  ]);

  return { connection, location, profile, attributes, reviews, posts, media, qanda, warnings };
}

// --- Media -----------------------------------------------------------------

export async function getMedia(env, { userId, projectId, locationRowId }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  return countMedia(env, connection, connection.account_id, location.location_id);
}

// uploadMedia() is deliberately absent: uploading needs an object store for the
// public URL Google fetches from, which is the Media module's work.

// --- Performance -----------------------------------------------------------

export async function getPerformance(env, { userId, projectId, locationRowId, days = 60 }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const started = Date.now();

  // Google publishes performance data a few days late.
  const endDate = shiftDays(new Date(), -3);
  const startDate = shiftDays(endDate, -days);

  const rows = await fetchDailyMetrics(env, connection, location.location_id, { startDate, endDate });
  const saved = await replaceDailyMetrics(userId, location.id, rows);

  await logSync({
    userId,
    projectId,
    locationRowId: location.id,
    syncType: 'metrics-sync',
    status: 'success',
    itemsSynced: saved,
    durationMs: Date.now() - started,
  });

  return { rows: saved, range: { from: toDateParts(startDate), to: toDateParts(endDate) } };
}

export async function getSearchKeywords(env, { userId, projectId, locationRowId, months = 3 }) {
  const connection = await requireConnection(userId, projectId);
  const location = await requireLocation(userId, projectId, locationRowId);
  const started = Date.now();

  // Keyword data is monthly and lags, so the window ends with last month.
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1), 1));

  const keywords = await fetchSearchKeywords(env, connection, location.location_id, {
    startMonth: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 },
    endMonth: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1 },
  });

  const month = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}`;
  const withHashes = [];
  for (const entry of keywords) {
    withHashes.push({ ...entry, keywordHash: await hashKey(entry.keyword) });
  }
  const saved = await upsertSearchKeywords(userId, projectId, location.id, month, withHashes);

  await logSync({
    userId,
    projectId,
    locationRowId: location.id,
    syncType: 'search-keywords',
    status: 'success',
    itemsSynced: withHashes.length,
    durationMs: Date.now() - started,
  });

  return {
    month,
    keywords: withHashes.length,
    saved,
    thresholdOnly: withHashes.filter((entry) => entry.isThreshold).length,
  };
}

// syncNotifications() belongs to the Notifications module: it needs a Cloud
// Pub/Sub topic and an authenticated push endpoint, neither of which exists yet.

export { requireConnection, requireLocation };
