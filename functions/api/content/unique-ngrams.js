import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { DEEPSEEK_NOT_CONFIGURED } from '../../_lib/deepseek-key.js';
import { generateUniqueNgramPhrases } from '../../../src/lib/uniqueNgramsService.js';

/** POST /api/content/unique-ngrams - same generator as /content/unique-ngrams. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to generate unique n-grams.',
  needsDeepSeek: true,
  message: (result) =>
    result.ai.applied
      ? 'Unique n-grams generated successfully.'
      : 'Unique n-grams generated using the local fallback generator.',
  run: async (body, { apiKey }) => {
    const result = await generateUniqueNgramPhrases({
      topic: body?.topic,
      apiKey: apiKey || undefined,
    });
    if (!apiKey && !result.ai.applied) result.ai.reason = DEEPSEEK_NOT_CONFIGURED;
    return result;
  },
});

export default onRequest;
