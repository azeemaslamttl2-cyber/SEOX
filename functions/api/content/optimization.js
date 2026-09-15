import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { DEEPSEEK_NOT_CONFIGURED } from '../../_lib/deepseek-key.js';
import { analyzeContentForOptimization } from '../../../src/lib/optimizationService.js';

/** POST /api/content/optimization - same analysis as /content/optimization. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to analyze content.',
  needsDeepSeek: true,
  message: () => 'Content analyzed successfully.',
  run: async (body, { apiKey }) => {
    const result = await analyzeContentForOptimization({
      content: body?.content,
      text: body?.text,
      includeAdvice: body?.includeAdvice,
      apiKey: apiKey || undefined,
    });
    if (result.advice.requested && !apiKey && !result.advice.applied) {
      result.advice.reason = DEEPSEEK_NOT_CONFIGURED;
    }
    return result;
  },
});

export default onRequest;
