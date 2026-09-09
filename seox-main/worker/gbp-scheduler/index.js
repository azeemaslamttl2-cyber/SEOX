// Cron-only Worker. It exists because Pages Functions have no cron trigger.
//
// All logic lives in POST /api/gbp/jobs on the Pages deployment; this worker
// only calls it on a timer and logs the outcome.

async function drain(env) {
  const baseUrl = String(env.SEOX_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('SEOX_BASE_URL is not set.');
  if (!env.GBP_SCHEDULER_TOKEN) throw new Error('GBP_SCHEDULER_TOKEN secret is not set.');

  const response = await fetch(`${baseUrl}/api/gbp/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GBP-Scheduler-Token': env.GBP_SCHEDULER_TOKEN,
    },
    body: JSON.stringify({ trigger: 'cron' }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Job drain failed (${response.status}): ${payload?.error || 'unknown error'}`);
  }
  return payload;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      drain(env)
        .then((result) => {
          console.log('GBP drain', JSON.stringify(result));
        })
        .catch((error) => {
          console.error('GBP drain failed:', error.message);
        })
    );
  },

  // Manual trigger for testing: same token as the cron path uses.
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('POST with X-GBP-Scheduler-Token to run a drain.', { status: 405 });
    }
    if (request.headers.get('x-gbp-scheduler-token') !== env.GBP_SCHEDULER_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      return Response.json(await drain(env));
    } catch (error) {
      return Response.json({ error: error.message }, { status: 502 });
    }
  },
};
