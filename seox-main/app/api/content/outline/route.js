import { onRequest } from '../../../../functions/api/content/outline.js';

export const runtime = 'nodejs';

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
