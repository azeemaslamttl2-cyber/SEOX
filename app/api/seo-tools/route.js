import { onRequest } from '../../../../functions/api/seo-tools.js';

export const runtime = 'nodejs';

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const POST = handle;
export const GET = handle;
export const OPTIONS = handle;
