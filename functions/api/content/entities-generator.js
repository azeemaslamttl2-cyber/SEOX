import { emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { adminApiHeaders, apiErrorResponse, requireAdminToken } from '../../_lib/admin-auth.js';
import { DEEPSEEK_NOT_CONFIGURED, resolveDeepSeekApiKey } from '../../_lib/deepseek-key.js';
import { generateEntityGroups } from '../../../src/lib/entitiesGeneratorService.js';

/**
 * POST /api/content/entities-generator
 *
 * JSON interface to the same logic behind the /content/entities-generator page:
 * DeepSeek-generated SEO entities per keyword, with the page's local generator
 * as the fallback when DeepSeek is unavailable.
 */

function apiError(error, headers) {
  return apiErrorResponse(error, headers, 'Unable to generate entities.');
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
    const adminUser = await requireAdminToken(body, env);
    const apiKey = await resolveDeepSeekApiKey(adminUser, env);

    const result = await generateEntityGroups({
      keywords: body?.keywords,
      apiKey: apiKey || undefined,
    });

    if (!apiKey && !result.ai.applied) {
      result.ai.reason = DEEPSEEK_NOT_CONFIGURED;
    }

    return jsonResponse(
      {
        success: true,
        status: 'success',
        message: result.ai.applied
          ? 'Entities generated successfully.'
          : 'Entities generated using the local fallback generator.',
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
