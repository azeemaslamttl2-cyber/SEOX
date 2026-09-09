// GET  /api/gbp/locations?projectId=...&source=attached|google
// POST /api/gbp/locations   { action: attach | detach | set-primary | resync }
//
// "attached" reads the SEOX copy and costs no quota; "google" hits the Business
// Information API and is only called when the user opens the picker or asks for
// a resync.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { consumeRateLimit } from '../../_lib/rate-limit.js';
import { getLocations } from '../../_lib/gbp-service.js';
import { requireConnection, requireConnectionWithAccount } from '../../_lib/gbp-request.js';
import {
  attachLocation,
  detachLocation,
  listLocations,
  logSync,
  setPrimaryLocation,
  useDatabase,
} from '../../_lib/gbp-repository.js';

function serializeLocation(row) {
  return {
    id: row.id,
    locationId: row.location_id,
    accountId: row.account_id,
    placeId: row.place_id,
    businessName: row.business_name,
    storeCode: row.store_code,
    primaryCategory: row.primary_category,
    address: row.formatted_address,
    phone: row.phone,
    websiteUrl: row.website_url,
    mapsUri: row.maps_uri,
    verificationStatus: row.verification_status,
    openStatus: row.open_status,
    isPrimary: Boolean(row.is_primary),
    hasGoogleUpdates: Boolean(row.has_google_updates),
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    totalReviews: row.total_reviews,
    unansweredReviews: row.unanswered_reviews,
    healthScore: row.health_score,
    profileCompleteness: row.profile_completeness,
    lastSyncAt: row.last_sync_at,
  };
}

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
      const source = url.searchParams.get('source') || 'attached';

      if (source === 'google') {
        const connection = await requireConnectionWithAccount(env, userId, projectId);
        const googleLocations = await getLocations(env, { userId, projectId });
        const attached = await listLocations(userId, projectId);
        const attachedIds = new Set(attached.map((row) => row.location_id));

        return jsonResponse(
          {
            source: 'google',
            accountId: connection.account_id,
            locations: googleLocations.map((location) => ({
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
              hasGoogleUpdates: location.hasGoogleUpdates,
              attached: attachedIds.has(location.locationId),
            })),
          },
          200,
          headers
        );
      }

      await requireConnection(env, userId, projectId);
      const rows = await listLocations(userId, projectId);
      return jsonResponse(
        { source: 'attached', locations: rows.map(serializeLocation) },
        200,
        headers
      );
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const { action, projectId, locationIds, locationRowId } = body;

      if (action === 'attach') {
        const connection = await requireConnectionWithAccount(env, userId, projectId);
        const wanted = Array.isArray(locationIds) ? locationIds : [locationIds].filter(Boolean);
        if (!wanted.length) {
          return jsonResponse({ error: 'Select at least one location.' }, 400, headers);
        }

        // Re-read from Google so the stored copy is the live profile, not what
        // the browser happened to be showing.
        const googleLocations = await getLocations(env, { userId, projectId });
        const byId = new Map(googleLocations.map((location) => [location.locationId, location]));

        const attached = [];
        const missing = [];
        for (const locationId of wanted) {
          const location = byId.get(locationId);
          if (!location) {
            missing.push(locationId);
            continue;
          }
          attached.push(
            serializeLocation(await attachLocation(userId, projectId, connection.id, location))
          );
        }

        await logSync({
          userId,
          projectId,
          syncType: 'attach-locations',
          status: missing.length ? 'partial' : 'success',
          message: missing.length ? `Not found in Google account: ${missing.join(', ')}` : null,
          itemsSynced: attached.length,
        });

        return jsonResponse({ success: true, attached, missing }, 200, headers);
      }

      if (action === 'resync') {
        await consumeRateLimit(userId, 'gbp:resync-locations');
        const connection = await requireConnectionWithAccount(env, userId, projectId);
        const googleLocations = await getLocations(env, { userId, projectId });
        const byId = new Map(googleLocations.map((location) => [location.locationId, location]));

        const rows = await listLocations(userId, projectId);
        const refreshed = [];
        const lost = [];
        for (const row of rows) {
          const location = byId.get(row.location_id);
          if (!location) {
            // Still attached in SEOX but no longer returned by Google: access
            // was removed, or the listing was merged or suspended.
            lost.push(row.location_id);
            continue;
          }
          refreshed.push(
            serializeLocation(
              await attachLocation(userId, projectId, connection.id, location, {
                isPrimary: Boolean(row.is_primary),
              })
            )
          );
        }

        await logSync({
          userId,
          projectId,
          syncType: 'resync-locations',
          status: lost.length ? 'partial' : 'success',
          message: lost.length ? `No longer visible in Google: ${lost.join(', ')}` : null,
          itemsSynced: refreshed.length,
        });

        return jsonResponse({ success: true, locations: refreshed, lost }, 200, headers);
      }

      if (action === 'detach') {
        await requireConnection(env, userId, projectId);
        if (!locationRowId) return jsonResponse({ error: 'locationRowId is required.' }, 400, headers);
        const removed = await detachLocation(userId, locationRowId);
        if (!removed) return jsonResponse({ error: 'Location was not found.' }, 404, headers);
        return jsonResponse({ success: true }, 200, headers);
      }

      if (action === 'set-primary') {
        await requireConnection(env, userId, projectId);
        if (!locationRowId) return jsonResponse({ error: 'locationRowId is required.' }, 400, headers);
        await setPrimaryLocation(userId, projectId, locationRowId);
        const rows = await listLocations(userId, projectId);
        return jsonResponse({ success: true, locations: rows.map(serializeLocation) }, 200, headers);
      }

      return jsonResponse({ error: 'Invalid action' }, 400, headers);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}
