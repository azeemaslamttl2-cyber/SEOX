import { emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { adminApiHeaders, apiErrorResponse, requireAdminToken } from '../../_lib/admin-auth.js';
import { DEEPSEEK_NOT_CONFIGURED, resolveDeepSeekApiKey } from '../../_lib/deepseek-key.js';
import { fetchPageHtml } from '../../_lib/content-fetch.js';
import { generateContentOutline } from '../../../src/lib/outlineService.js';

function apiError(error, headers) {
  return apiErrorResponse(error, headers, 'Unable to generate content outline.');
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

    const adminUser = await requireAdminToken(body, env);
    const apiKey = await resolveDeepSeekApiKey(adminUser, env);

    const result = await generateContentOutline({
      urls: body?.urls ?? body?.url,
      apiKey: apiKey || undefined,
      fetchHtml: fetchPageHtml,
    });

    if (!apiKey && !result.ai.applied && !result.message) {
      result.ai.reason = DEEPSEEK_NOT_CONFIGURED;
    }

    return jsonResponse(
      {
        success: true,
        status: 'success',
        message: result.message || 'Content outline generated successfully.',
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
