import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { fetchPageHtml } from '../../_lib/content-fetch.js';
import { analyzeCompetitorContent } from '../../../src/lib/contentAnalyzerService.js';

/** POST /api/content/content-analyzer - same competitor analysis as /content/content-analyzer. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to analyze the competitor content.',
  needsDeepSeek: true,
  message: (result) =>
    result.generated.length
      ? `Competitor content analyzed across ${result.analyzedUrls.length} URL(s).`
      : 'No sections could be generated.',
  run: (body, { apiKey }) =>
    analyzeCompetitorContent({
      urls: body?.urls,
      url: body?.url,
      sections: body?.sections,
      apiKey: apiKey || undefined,
      fetchHtml: fetchPageHtml,
    }),
});

export default onRequest;
