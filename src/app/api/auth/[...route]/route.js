import { onRequestGet, onRequestPost } from '../../../../../functions/api/auth.js';

export async function GET(request) {
  return onRequestGet({ request, env: process.env });
}

export async function POST(request) {
  try {
    return await onRequestPost({ request, env: process.env });
  } catch (error) {
    console.error('API auth route error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || 'Internal auth error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
