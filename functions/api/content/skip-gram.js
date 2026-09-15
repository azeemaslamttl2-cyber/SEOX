import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { DEEPSEEK_NOT_CONFIGURED } from '../../_lib/deepseek-key.js';
import { generateSkipGramDominantWords } from '../../../src/lib/skipGramService.js';

/** POST /api/content/skip-gram - same skip-gram words as /content/skip-gram. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to generate skip-gram words.',
  needsDeepSeek: true,
  message: (result) =>
    result.ai.applied
      ? 'Skip-gram words generated successfully.'
      : 'Skip-gram words generated using the local fallback generator.',
  run: async (body, { apiKey }) => {
    const result = await generateSkipGramDominantWords({
      word: body?.word,
      apiKey: apiKey || undefined,
    });
    if (!apiKey && !result.ai.applied) result.ai.reason = DEEPSEEK_NOT_CONFIGURED;
    return result;
  },
});

export default onRequest;
