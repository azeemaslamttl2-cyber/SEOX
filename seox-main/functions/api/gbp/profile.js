// GET   /api/gbp/profile?projectId=&locationRowId=[&resource=categories|attributes]
// POST  /api/gbp/profile   { action: save | rollback, section, value, snapshotId }
//
// Reads come from Google so the editor never shows stale data. Writes are
// per-section: a snapshot is stored before and after each save, so any edit can
// be rolled back to exactly what Google held beforehand.

import { corsHeaders, emptyResponse, errorResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { verifyAccessToken } from '../../_lib/mysql-storage.js';
import { requireConnectionWithAccount, resolveLocation } from '../../_lib/gbp-request.js';
import {
  getFullLocation,
  getLocationAttributes,
  listAttributeMetadata,
  patchLocation,
  normaliseLocation,
  searchCategories,
} from '../../_lib/gbp-client.js';
import {
  attachLocation,
  logSync,
  useDatabase,
} from '../../_lib/gbp-repository.js';
import { listSnapshots, getSnapshot, saveSnapshot, parseJson } from '../../_lib/gbp-store.js';
import { projectProfile, updateAttributes } from '../../_lib/gbp-service.js';
import {
  EDITABLE_SECTIONS,
  buildSectionPatch,
  diffProfiles,
  toEditableProfile,
  validateSection,
} from '../../_lib/gbp-profile.js';

function regionCodeOf(googleLocation) {
  return googleLocation?.storefrontAddress?.regionCode || 'US';
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
      const locationRowId = url.searchParams.get('locationRowId');
      const resource = url.searchParams.get('resource');

      const connection = await requireConnectionWithAccount(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, locationRowId);
      const googleLocation = await getFullLocation(env, connection, location.location_id);

      // Category and attribute pickers: both depend on the location's country
      // and primary category, so they are served from here rather than guessed.
      if (resource === 'categories') {
        const categories = await searchCategories(env, connection, {
          query: url.searchParams.get('q') || '',
          regionCode: url.searchParams.get('regionCode') || regionCodeOf(googleLocation),
        });
        return jsonResponse(
          {
            categories: categories.map((category) => ({
              id: category.name,
              label: category.displayName,
              serviceTypes: (category.serviceTypes || []).map((type) => ({
                id: type.serviceTypeId,
                label: type.displayName,
              })),
            })),
          },
          200,
          headers
        );
      }

      if (resource === 'attributes') {
        const categoryId =
          url.searchParams.get('categoryId') ||
          googleLocation.categories?.primaryCategory?.name ||
          null;
        if (!categoryId) {
          return jsonResponse({ attributeMetadata: [] }, 200, headers);
        }
        const metadata = await listAttributeMetadata(env, connection, {
          categoryId,
          regionCode: regionCodeOf(googleLocation),
        });
        return jsonResponse({ attributeMetadata: metadata }, 200, headers);
      }

      let attributes = null;
      let attributesError = null;
      try {
        attributes = await getLocationAttributes(env, connection, location.location_id);
      } catch (error) {
        attributesError = error.message;
      }

      // Keep the stored copy and the normalised projections in step with what
      // the editor is showing, reusing the profile already fetched above.
      await attachLocation(userId, projectId, connection.id, normaliseLocation(googleLocation, connection.account_id), {
        isPrimary: Boolean(location.is_primary),
      });
      await projectProfile(userId, location.id, googleLocation, attributes);
      await saveSnapshot({
        userId,
        projectId,
        locationRowId: location.id,
        source: 'sync',
        profile: googleLocation,
        attributes,
      });

      return jsonResponse(
        {
          locationRowId: location.id,
          profile: toEditableProfile(googleLocation, attributes),
          attributesError,
          editableSections: EDITABLE_SECTIONS,
          snapshots: await listSnapshots(userId, location.id, 20),
        },
        200,
        headers
      );
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const { action, projectId, locationRowId } = body;
      const connection = await requireConnectionWithAccount(env, userId, projectId);
      const location = await resolveLocation(userId, projectId, locationRowId);

      if (action === 'save') {
        const { section, value } = body;
        const validationErrors = validateSection(section, value);
        if (validationErrors.length) {
          return jsonResponse(
            { error: 'The change was not sent to Google.', validationErrors },
            422,
            headers
          );
        }

        const before = await getFullLocation(env, connection, location.location_id);
        await saveSnapshot({
          userId,
          projectId,
          locationRowId: location.id,
          source: 'pre-edit',
          profile: before,
          changedFields: [section],
          changedBy: decoded.email || null,
        });

        const { body: patch, mask } = buildSectionPatch(section, value);
        await patchLocation(env, connection, location.location_id, patch, mask);

        const after = await getFullLocation(env, connection, location.location_id);
        const changed = diffProfiles(toEditableProfile(before), toEditableProfile(after));

        await saveSnapshot({
          userId,
          projectId,
          locationRowId: location.id,
          source: 'post-edit',
          profile: after,
          changedFields: changed,
          changedBy: decoded.email || null,
        });
        await attachLocation(
          userId,
          projectId,
          connection.id,
          normaliseLocation(after, connection.account_id),
          { isPrimary: Boolean(location.is_primary) }
        );
        await projectProfile(userId, location.id, after, null);
        await logSync({
          userId,
          projectId,
          locationRowId: location.id,
          syncType: `profile-edit:${section}`,
          status: 'success',
          message: changed.join(', ') || null,
        });

        return jsonResponse(
          { success: true, changedFields: changed, profile: toEditableProfile(after) },
          200,
          headers
        );
      }

      if (action === 'save-attributes') {
        const { attributes } = body;
        if (!Array.isArray(attributes) || attributes.length === 0) {
          return jsonResponse({ error: 'No attributes were supplied.' }, 400, headers);
        }
        const attributeMask = attributes.map((attribute) => attribute.name).filter(Boolean);
        if (!attributeMask.length) {
          return jsonResponse({ error: 'Each attribute needs a name.' }, 400, headers);
        }

        const before = await getLocationAttributes(env, connection, location.location_id);
        await saveSnapshot({
          userId,
          projectId,
          locationRowId: location.id,
          source: 'pre-edit',
          attributes: before,
          changedFields: attributeMask,
          changedBy: decoded.email || null,
        });

        const updated = await updateAttributes(env, {
          userId,
          projectId,
          locationRowId: location.id,
          attributes,
        });
        await saveSnapshot({
          userId,
          projectId,
          locationRowId: location.id,
          source: 'post-edit',
          attributes: updated,
          changedFields: attributeMask,
          changedBy: decoded.email || null,
        });

        return jsonResponse({ success: true, attributes: updated?.attributes || [] }, 200, headers);
      }

      if (action === 'rollback') {
        const snapshot = await getSnapshot(userId, body.snapshotId);
        if (!snapshot || snapshot.location_row_id !== location.id) {
          return jsonResponse({ error: 'Snapshot was not found for this location.' }, 404, headers);
        }
        const stored = parseJson(snapshot.profile);
        if (!stored) {
          return jsonResponse({ error: 'That snapshot holds no profile data.' }, 400, headers);
        }

        const sections = Array.isArray(body.sections) && body.sections.length
          ? body.sections
          : parseJson(snapshot.changed_fields, []) || [];
        const restorable = sections.filter((section) => EDITABLE_SECTIONS.includes(section));
        if (!restorable.length) {
          return jsonResponse(
            { error: 'Nothing in that snapshot maps to an editable section.' },
            400,
            headers
          );
        }

        const editable = toEditableProfile(stored);
        const restored = [];
        for (const section of restorable) {
          const value = sectionValueFrom(editable, section);
          const { body: patch, mask } = buildSectionPatch(section, value);
          await patchLocation(env, connection, location.location_id, patch, mask);
          restored.push(section);
        }

        const after = await getFullLocation(env, connection, location.location_id);
        await saveSnapshot({
          userId,
          projectId,
          locationRowId: location.id,
          source: 'rollback',
          profile: after,
          changedFields: restored,
          changedBy: decoded.email || null,
        });

        return jsonResponse(
          { success: true, restored, profile: toEditableProfile(after) },
          200,
          headers
        );
      }

      return jsonResponse({ error: 'Invalid action' }, 400, headers);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
}

// Map a section name back onto the editable profile shape a rollback must send.
function sectionValueFrom(editable, section) {
  switch (section) {
    case 'name':
      return editable.name;
    case 'storeCode':
      return editable.storeCode;
    case 'categories':
      return {
        primaryCategory: editable.primaryCategory,
        additionalCategories: editable.additionalCategories,
      };
    case 'phone':
      return { primary: editable.phone, additional: editable.additionalPhones };
    case 'website':
      return editable.website;
    case 'address':
      return editable.address;
    case 'serviceArea':
      return editable.serviceArea;
    case 'regularHours':
      return editable.regularHours;
    case 'specialHours':
      return editable.specialHours;
    case 'moreHours':
      return editable.moreHours;
    case 'description':
      return editable.description;
    case 'openingDate':
      return editable.openingDate;
    case 'services':
      return editable.services;
    case 'labels':
      return editable.labels;
    default:
      return null;
  }
}
