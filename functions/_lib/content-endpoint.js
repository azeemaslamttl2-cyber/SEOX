import { emptyResponse, jsonResponse, readJson } from './http.js';
import { adminApiHeaders, apiErrorResponse, requireAdminToken } from './admin-auth.js';
import { resolveDeepSeekApiKey } from './deepseek-key.js';

/**
 * Factory for the content tool JSON endpoints.
 *
 * Every one of them shares the same contract: POST only, admin_token body field
 * as the ONLY authentication (validated before any business logic runs), the
 * project's JSON envelope, and no leaking of internals. Building them from one
 * place keeps that contract identical across endpoints.
 *
 * @param {object} config
 * @param {string} config.errorMessage generic message used for unexpected 5xx
 * @param {(body: object, ctx: { apiKey: string, env: object }) => Promise<any>} config.run
 * @param {boolean} [config.needsDeepSeek] resolve a DeepSeek key before running
 * @param {(result: any) => string} [config.message] success message builder
 */
export function createContentEndpoint({
  errorMessage,
  run,
  needsDeepSeek = false,
  message = () => 'Request completed successfully.',
}) {
  return async function onRequest({ request, env }) {
    // admin_token body field only - no Authorization header is read or accepted.
    const headers = adminApiHeaders();

    if (request.method === 'OPTIONS') return emptyResponse(204, headers);
    if (request.method !== 'POST') {
      return apiErrorResponse(
        Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }),
        headers,
        errorMessage
      );
    }

    try {
      const body = await readJson(request);

      // Authentication first - nothing below runs for an unauthenticated caller.
      const adminUser = await requireAdminToken(body, env);

      const apiKey = needsDeepSeek ? await resolveDeepSeekApiKey(adminUser, env) : '';
      const result = await run(body, { apiKey, env });

      return jsonResponse(
        { success: true, status: 'success', message: message(result), data: result },
        200,
        headers
      );
    } catch (error) {
      return apiErrorResponse(error, headers, errorMessage);
    }
  };
}
