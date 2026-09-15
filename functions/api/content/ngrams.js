import { emptyResponse, jsonResponse, readJson } from '../../_lib/http.js';
import { adminApiHeaders, apiErrorResponse, requireAdminToken } from '../../_lib/admin-auth.js';
import { DEEPSEEK_NOT_CONFIGURED, resolveDeepSeekApiKey } from '../../_lib/deepseek-key.js';
import { fetchPageHtml } from '../../_lib/content-fetch.js';
import { extractContentNgrams } from '../../../src/lib/ngramsService.js';

/**
 * POST /api/content/ngrams
 *
 * JSON interface to the same logic behind the /content/ngrams page: stop-word
 * filtered unigram/bigram/trigram extraction from a URL or raw text, plus the
 * page's optional DeepSeek "unique n-grams" step.
 *
 * Extraction itself is fully local; DeepSeek is only used when the caller opts
 * in with includeUnique. The only database use is admin_token validation, which
 * must succeed before any processing runs.
 */

function apiError(error, headers) {
  return apiErrorResponse(error, headers, 'Unable to extract n-grams.');
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

    const includeUnique = body?.includeUnique === true;
    const apiKey = includeUnique ? await resolveDeepSeekApiKey(adminUser, env) : '';

    const result = await extractContentNgrams({
      mode: body?.mode,
      text: body?.text,
      content: body?.content,
      url: body?.url,
      sizes: body?.sizes,
      n: body?.n,
      includeUnique,
      apiKey: apiKey || undefined,
      fetchHtml: fetchPageHtml,
    });

    if (includeUnique && !apiKey && !result.unique.applied && !result.unique.reason) {
      result.unique.reason = DEEPSEEK_NOT_CONFIGURED;
    }

    const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0);

    return jsonResponse(
      {
        success: true,
        status: 'success',
        message: total
          ? 'N-grams extracted successfully.'
          : 'No n-grams were found in the supplied content.',
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
