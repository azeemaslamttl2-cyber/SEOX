import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { fetchPageHtml } from '../../_lib/content-fetch.js';
import { extractContentNlpKeywords } from '../../../src/lib/nlpService.js';

/** POST /api/content/nlp - same NLP keyword extraction as /content/nlp. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to extract NLP keywords.',
  message: (result) =>
    result.keywordCount
      ? 'NLP keywords extracted successfully.'
      : 'No NLP keywords were found in the supplied content.',
  run: (body) =>
    extractContentNlpKeywords({
      mode: body?.mode,
      text: body?.text,
      content: body?.content,
      url: body?.url,
      fetchHtml: fetchPageHtml,
    }),
});

export default onRequest;
