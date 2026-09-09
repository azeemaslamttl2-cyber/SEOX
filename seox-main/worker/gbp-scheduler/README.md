# GBP scheduler worker

Cloudflare Pages Functions cannot run cron triggers, so all recurring GBP work
is driven by this separate Worker. It holds no business logic: every five
minutes it calls `POST /api/gbp/jobs` on the Pages deployment.

```
Cron (this worker)
      |
      v
POST /api/gbp/jobs
      |
      +--> publish posts whose scheduled_at has passed
      +--> enqueue recurring syncs that are due
      +--> run claimed jobs  ->  GBPService  ->  Google APIs  ->  DB
                    |
                    +-- fails --> retry (60s, 5m, 30m) --> dead letter --> alert
```

## Recurring sync cadence

Set in `functions/_lib/gbp-jobs.js`. These intervals are what keeps a
multi-tenant install inside the shared GBP quota — reviews change often and are
cheap to poll, keyword data is monthly and pointless to poll daily.

| Job | Interval |
| --- | --- |
| `sync_reviews` | 30 minutes |
| `sync_qanda` | 2 hours |
| `sync_metrics` | daily |
| `sync_profile` | weekly |
| `sync_keywords` | monthly |

A job is only queued if the last successful sync of that type for that location
is older than its interval, and if no job for the same location and type is
already pending or running. Two overlapping cron ticks therefore cannot double
the quota spend.

## Failure handling

- Transient failures retry three times with 60s / 5m / 30m backoff.
- Quota exhaustion always waits the longest backoff instead of hammering.
- `NEEDS_REAUTH` never retries: no number of attempts fixes a revoked token.
- After the last attempt the job is dead-lettered and a row is written to
  `gbp_job_alerts`, visible on `GET /api/gbp/jobs`.
- A worker that dies mid-job leaves its rows locked; they are released after 15
  minutes and picked up again.

## Deploy

```bash
npx wrangler secret put GBP_SCHEDULER_TOKEN --config worker/gbp-scheduler/wrangler.jsonc
npx wrangler deploy --config worker/gbp-scheduler/wrangler.jsonc
```

Set `SEOX_BASE_URL` in `wrangler.jsonc` to the Pages URL, and set the same
`GBP_SCHEDULER_TOKEN` value on the Pages project so the two sides agree.

## Without this worker

The endpoint is a plain authenticated POST, so any external scheduler works:

```bash
curl -X POST https://your-domain.example/api/gbp/jobs \
  -H "X-GBP-Scheduler-Token: $GBP_SCHEDULER_TOKEN"
```

Nothing publishes or syncs on a schedule until something calls that endpoint on
a timer.
