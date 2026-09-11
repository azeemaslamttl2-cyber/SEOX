import { emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { adminApiHeaders, apiErrorResponse, requireAdminToken } from '../../_lib/admin-auth.js';
import { fetchPageHtml } from '../../_lib/content-fetch.js';
import { extractContentEntities } from '../../../src/lib/entitiesExtractorService.js';

/**
 * POST /api/content/entities-extractor
 *
 * JSON interface to the same logic behind the /content/entities-extractor page.
 * Extraction is fully local (no AI provider, no database) - the only database
 * use is admin_token validation, which must succeed before any extraction runs.
 */

function apiError(error, headers) {
  return apiErrorResponse(error, headers, 'Unable to extract entities.');
}

export async function onRequest({ request, env }) {
  // admin_token body field only - no Authorization header is read or accepted.
  const headers = adminApiHeaders();

  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return apiError(
      Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }),
      headers
    );
  }

  try {
    const body = await readJson(request);

    // Authentication first - nothing below runs for an unauthenticated caller.
    await requireAdminToken(body, env);

    const result = await extractContentEntities({
      mode: body?.mode,
      content: body?.content,
      text: body?.text,
      urls: body?.urls,
      url: body?.url,
      limit: body?.limit,
      fetchHtml: fetchPageHtml,
    });

    return jsonResponse(
      {
        success: true,
        status: 'success',
        message: result.entityCount
          ? 'Entities extracted successfully.'
          : 'No entities were found in the supplied content.',
        data: result,
      },
      200,
      headers
    );
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
