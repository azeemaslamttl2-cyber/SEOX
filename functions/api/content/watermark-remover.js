import { createContentEndpoint } from '../../_lib/content-endpoint.js';
import { cleanAiWatermarks } from '../../../src/lib/watermarkService.js';

/** POST /api/content/watermark-remover - same cleaning as /content/watermark-remover. */
export const onRequest = createContentEndpoint({
  errorMessage: 'Unable to clean the supplied text.',
  message: (result) =>
    result.stats.invisibleCount
      ? 'Watermark characters removed successfully.'
      : 'No watermark characters were found in the supplied text.',
  run: (body) =>
    cleanAiWatermarks({
      text: body?.text,
      content: body?.content,
      normalizeWhitespace: body?.normalizeWhitespace,
      normalizeQuotes: body?.normalizeQuotes,
    }),
});

export default onRequest;
