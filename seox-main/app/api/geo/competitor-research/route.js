import { onRequest } from '../../../../functions/api/geo/competitor-research.js';

export const runtime = 'nodejs';

function handle(request) {
  return onRequest({ request, env: process.env });
}

export const POST = handle;
export const OPTIONS = handle;
