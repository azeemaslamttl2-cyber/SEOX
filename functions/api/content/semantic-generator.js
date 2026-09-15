import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { generateSemanticKeywordAnalysis } from '../../../src/lib/semanticGeneratorService.js';

/** POST /api/content/semantic-generator - same six-section analysis as /content/semantic-generator. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to generate the semantic keyword analysis.',
  needsDeepSeek: true,
  message: (result) =>
    result.generated.length
      ? `Semantic analysis generated for ${result.generated.length} of ${result.sections.length} sections.`
      : 'No sections could be generated.',
  run: (body, { apiKey }) =>
    generateSemanticKeywordAnalysis({
      keyword: body?.keyword,
      sections: body?.sections,
      apiKey: apiKey || undefined,
    }),
});

export default onRequest;
