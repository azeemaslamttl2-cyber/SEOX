# GBP schema

Apply in order:

```
20260908_gbp_connection_module.sql
20260909_gbp_profile_audit_posts.sql
20260910_gbp_reviews_qanda.sql
20260911_gbp_recommendations.sql
20260912_gbp_schema_completion.sql
```

## Specified tables

| Table | Status |
| --- | --- |
| `gbp_connections` | ✅ one Google authorisation per (user, project); tokens AES-GCM encrypted |
| `gbp_accounts` | ✅ every account the identity manages; the *selected* one stays on `gbp_connections.account_id` |
| `gbp_locations` | ✅ multi-location per project, one flagged `is_primary` |
| `gbp_profile_snapshots` | ✅ written before and after every edit, so any save can be rolled back |
| `gbp_categories` | ✅ queryable projection of `gbp_locations.raw_profile`, rewritten on each profile sync |
| `gbp_services` | ✅ same |
| `gbp_attributes` | ✅ same |
| `gbp_posts` | ✅ one row per occurrence, with `status` + `scheduled_at` |
| `gbp_post_schedule` | ✅ the recurrence *definition*, so a whole series can be cancelled |
| `gbp_reviews` | ✅ cached inbox; a resync never overwrites a draft reply in progress |
| `gbp_review_replies` | ✅ append-only log of every draft and publish, with who approved it |
| `gbp_questions` | ✅ merchant answer plus `top_answers` — see note below |
| `gbp_answers` | ⚠️ merged into `gbp_questions` — see note below |
| `gbp_media` | ❌ not created: the Media module is not built |
| `gbp_daily_metrics` | ✅ one row per (location, date, metric) |
| `gbp_search_keywords` | ✅ monthly, with `is_threshold` separating a floor from a count |
| `gbp_notifications` | ❌ not created: the Pub/Sub notifications module is not built |
| `gbp_audits` | ✅ append-only; carries a flat `signals.snapshot` for history diffing |
| `gbp_audit_issues` | ✅ one row per check per audit |
| `gbp_automation_rules` | ✅ |
| `gbp_jobs` | ✅ durable queue with retry, dead letter and an idempotency key |
| `gbp_sync_logs` | ✅ append-only; also the source of "when did this last sync" |

## Additional tables

Built alongside the modules that need them.

| Table | Why |
| --- | --- |
| `gbp_api_usage` | every outbound Google call, so the shared quota is measurable |
| `gbp_job_alerts` | a job that exhausts its retries raises an alert instead of failing silently |
| `gbp_automation_sources` | seen-URL ledger, so one blog post becomes one GBP post |
| `gbp_post_templates` | reusable post shapes |
| `gbp_review_insights` | one row per Review Intelligence run |
| `gbp_recommendations`, `gbp_recommendation_runs` | recommendations with the evidence they were derived from |

## Two deliberate merges

**`gbp_answers` into `gbp_questions`.** The Q&A API upserts the merchant answer:
there is exactly one per question, and writing it replaces the previous one.
A separate table would hold at most one row per question and would need the same
uniqueness constraint to stay correct. Answers written by *other* users are kept
in `gbp_questions.top_answers`, since they are read-only context, never
something SEOX writes. Split it out if per-answer history is ever needed.

**Scheduling stays on `gbp_posts`.** `status` + `scheduled_at` on the post row is
what the worker publishes from, so there is one source of truth for "is this due".
`gbp_post_schedule` holds the recurrence definition above it and links to its
occurrences through `gbp_posts.schedule_id`; it is not a second queue.

## Two tables deliberately not created

`gbp_media` and `gbp_notifications` are not in any migration. Creating tables
that no code reads or writes leaves a schema that looks finished and is not —
and their real shape depends on decisions those modules have not made yet
(object storage for media, the Pub/Sub subscription for notifications). They
land with their modules.
