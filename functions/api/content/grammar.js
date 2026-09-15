import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { DEEPSEEK_NOT_CONFIGURED } from '../../_lib/deepseek-key.js';
import { generateGrammarRelationships } from '../../../src/lib/grammarService.js';

/** POST /api/content/grammar - same grammar relationships as /content/grammar. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to generate grammar relationships.',
  needsDeepSeek: true,
  message: (result) =>
    result.ai.applied
      ? 'Grammar relationships generated successfully.'
      : 'Grammar relationships generated using the local fallback generator.',
  run: async (body, { apiKey }) => {
    const result = await generateGrammarRelationships({
      topic: body?.topic,
      apiKey: apiKey || undefined,
    });
    if (!apiKey && !result.ai.applied) result.ai.reason = DEEPSEEK_NOT_CONFIGURED;
    return result;
  },
});

export default onRequest;
