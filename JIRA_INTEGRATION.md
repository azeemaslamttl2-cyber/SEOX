# SEOX ↔ Jira integration

Operator and developer reference for the Jira integration. The design rationale
lives in [`SEOX_JIRA_INTEGRATION_PLAN.txt`](SEOX_JIRA_INTEGRATION_PLAN.txt);
this file covers what was actually built and how to run it.

**Jira is optional.** With nothing configured, every SEOX screen, API and crawl
behaves exactly as before and no Jira affordance appears anywhere in the UI.

---

## 1. Architecture

```
Browser (auditor / settings)
   │  src/lib/jiraApi.js         Bearer session token, never a Jira credential
   │  src/lib/jiraCache.js       projectDataStore, per-key, single-flight
   ▼
/api/jira/*                      mounted by vite.config.js for BOTH
                                 configureServer and configurePreviewServer
   │  functions/api/jira/*.js    auth → project ownership → rate limit
   ▼
functions/_lib/jira-*.js         fingerprint, issue builder, AI, repository,
                                 store, client (timeout/retry/429/SSRF/breaker)
   ▼
Jira Cloud REST API v3
```

Inbound:

```
Jira ──webhook(?t=secret)──▶ /api/jira/webhook
                               │ constant-time secret check, size/shape checks
                               │ INSERT jira_webhook_events (UNIQUE event_key)
                               ▼ 200 OK in < 1s
                             jira_jobs ──▶ jira-sync ──▶ jira-verify
                               (driven by POST /api/jira/jobs on a timer)
                               ▼
                             jira_issue_links ──▶ SEOX UI
```

A 30-minute JQL reconcile sweep runs as a floor, so the system stays correct
even if no webhook is ever delivered.

### The five decisions that matter

| Decision | Why |
|---|---|
| Every route registers `configurePreviewServer` too | Production is `vite preview` on :4173. A dev-only route 404s in production. |
| Dedupe on a server-computed fingerprint + `UNIQUE` index | Titles are edited, AI-rewritten and truncated. Only a DB constraint is correct under concurrency. |
| Map on Jira `statusCategory`, never the status *name* | Status names are per-project and renameable; the category is not. |
| `verification_spec` stored at creation time | The crawler runs in the **browser**; nobody is watching when a ticket closes at 2am. |
| Zero Jira calls on any pre-existing request path | Jira can never make SEOX slow or take it down. |

---

## 2. Setup

### 2.1 Database

Review and run the Jira section of [`migration.txt`](migration.txt). It creates
six tables and alters nothing. **It has not been executed.**

```bash
mysqldump -u <user> -p code-step-mysql > backup-before-jira.sql
# then apply the statements in migration.txt
```

Until it is applied, every Jira read degrades to "not connected" — the app does
not error and does not create tables itself.

### 2.2 Environment variables

Server-side only. Never `VITE_`-prefixed (that would inline them into the
browser bundle). Documented in `.env.example` and `.dev.vars.example`.

| Variable | Required | Purpose |
|---|---|---|
| `JIRA_TOKEN_ENCRYPTION_KEY` | to use Jira at all | AES-GCM key for the stored API token and webhook secret. `openssl rand -base64 32` |
| `JIRA_SCHEDULER_TOKEN` | for background sync | Shared secret for `POST /api/jira/jobs`. **Unset = runner disabled**, never open. |
| `APP_URL` | already present | Used to build the webhook URL shown in settings. Must be correct in production. |
| `JIRA_WEBHOOK_SECRET` | optional | Extra `X-SEOX-Webhook-Secret` header requirement. |
| `JIRA_DEFAULT_TIMEOUT_MS` | optional | Default `15000`. |
| `JIRA_INTERACTIVE_TIMEOUT_MS` | optional | Default `8000`, for calls inside a user request. |
| `JIRA_MAX_RETRIES` | optional | Default `2`. |
| `JIRA_ALLOW_INSECURE_BASE_URL` | testing only | Permits `http://`/private Jira hosts. **Ignored when `NODE_ENV=production`.** |

Because Vite does not copy `.env` into `process.env`, handlers read `env` from
`onRequest({ request, env })`, which `loadDevApiEnv()` assembles per request.
Placing the variables in the server's `.env` therefore works. **Never read
`process.env` directly in Jira code.**

Losing or rotating `JIRA_TOKEN_ENCRYPTION_KEY` invalidates every stored
credential; users must reconnect. There is no re-encryption path (GBP has the
same limitation).

### 2.3 Connect

`Settings → Jira`, per project. Needs the Jira base URL, the account email and
an API token from
<https://id.atlassian.com/manage-profile/security/api-tokens>.

The token is validated against `GET /rest/api/3/myself` **before** it is stored —
an unverified credential is never persisted — then encrypted. It is never
returned to the browser.

### 2.4 Map a Jira project

Same screen. Every id is validated against Jira on save: issue-type schemes and
component lists are per project, so an id valid in one Jira project can be
rejected by another. Catching that here means the user finds out on the settings
screen, not weeks later.

### 2.5 Webhook (optional but recommended)

The settings panel shows the URL **once**, because the secret is in it.

In Jira: **Settings → System → WebHooks → Create a WebHook**
- URL: the one shown
- JQL filter: `labels = "seox"`
- Events: *Issue updated*, *Issue deleted*, *Comment created*

Creating a webhook needs Jira administrator rights. Without one, the 30-minute
reconcile sweep keeps everything correct — slower, but complete. The settings
panel reports which mode is actually active, based on whether events have
arrived, not on whether a URL was displayed.

### 2.6 Schedule the job runner

Nothing in-process drives the queue (that would break under multiple instances
and die silently with the process). Use a system cron on the app host:

```cron
*/2 * * * * curl -fsS -m 60 -X POST \
  -H "X-Jira-Scheduler-Token: $JIRA_SCHEDULER_TOKEN" \
  -H "Content-Type: application/json" -d '{"trigger":"cron"}' \
  http://127.0.0.1:4173/api/jira/jobs >/dev/null
```

It calls `127.0.0.1` directly, bypassing nginx and the public internet. One tick
drains webhook events, schedules due reconciles, and runs claimed jobs.

---

## 3. API reference

All routes are session-authenticated (`Authorization: Bearer <jwt>`) and scoped
to a project the caller owns, **except** the webhook (own URL secret) and the
job drain (`X-Jira-Scheduler-Token`). Errors use the standard envelope
`{ "error": "..." }`.

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/jira/connect` | `connect` / `test` / `disconnect` / `regenerate-webhook-secret` | Session |
| GET | `/api/jira/status?projectId=` | Connection, mapping, counts, health | Session |
| GET | `/api/jira/metadata?projectId=&resource=` | `projects`, `issue-types`, `statuses`, `priorities`, `assignable`, `components` | Session |
| GET/POST | `/api/jira/mapping` | Read / save the project mapping | Session |
| GET | `/api/jira/issues?projectId=[&fingerprint=]` | Link list, or specific fingerprints | Session |
| POST | `/api/jira/issues` with `admin_token` in the body | **Read-only** feed of every Jira-eligible SEO finding (§3.1) | `admin_token` |
| POST | `/api/jira/issues` | `create` / `sync` / `unlink` / `retry` / `verify` | Session |
| GET | `/api/jira/issues/status?admin_token=&jira_issue_key=` | Transitions this issue can make now (§3.2) | `admin_token` |
| POST | `/api/jira/issues/status` | **Perform a transition, in Jira** (§3.2) | `admin_token` |
| POST | `/api/jira/webhook?t=<secret>` | Receive Jira events | URL secret |
| GET | `/api/jira/jobs?projectId=` | Queue stats, dead jobs, activity | Session |
| POST | `/api/jira/jobs` | Drain the queue / `retry-job` | Scheduler token / Session |

### 3.1 The Jira-eligible issue feed

```
POST /api/jira/issues
Content-Type: application/json

{ "admin_token": "YOUR_ADMIN_TOKEN" }
```

Read-only. It lists the SEO findings that **could** become Jira issues, grouped
by project, and says which ones already are. It never creates, updates or
deletes anything, in SEOX or in Jira.

**POST, with the token in the body.** A query string is recorded in access
logs, proxy logs and browser history, and an admin credential does not belong
in any of them. The equivalent `GET /api/jira/issues?admin_token=` is still
served for convenience, but POST is the documented form.

**Authentication is `admin_token` and nothing else.** It is resolved before the
session guard *and* before the action switch, and the modes never mix: an
`admin_token` request never falls back to a session, a request without the
field is handled by the existing session route exactly as before, and no
`action` in the body can steer the feed into `create`/`sync`/`unlink`/`verify`.
There is no anonymous access.

Presence of the field - not a truthy value - selects the mode, so
`{"admin_token": ""}` is a 400 rather than a silent fall-through.

| Mode | Body |
|---|---|
| All projects | `{"admin_token":"xxx"}` |
| One project by id | `{"admin_token":"xxx","project_id":"proj_123"}` |
| One project by URL | `{"admin_token":"xxx","url":"https://example.com"}` |

Body values may be JSON scalars rather than strings - `{"limit": 250,
"jira_created": false}` works as written, and so does the string form a query
string would produce.

```bash
curl -s http://localhost:3000/api/jira/issues \
  -H 'Content-Type: application/json' \
  -d '{"admin_token":"xxx","project_id":"proj_123","jira_created":false,"limit":100}'
```

Scope is the projects owned by the user the token belongs to
(`users.admin_token`, the same lookup `/api/project-details` uses).

URL matching reuses `normalizeProjectDomain()` from
`functions/_handlers/project-details.js` and matches `user_projects.domain`, so
scheme, `www.`, case and a trailing slash all resolve to the same project. No
second normalisation scheme was introduced.

**`project_id` + `url` together are validated, not silently reconciled.** If
they name different projects the request is rejected with
`project_id and url refer to different projects` (400). Quietly preferring one
would serve another project's issues under the identifier the caller did not
choose, and a Jira ticket filed against the wrong site is expensive to undo.

**Filters** (all optional, combinable, body fields): `issue_type`, `severity`,
`status`, `jira_created`, `jira_eligible`. `severity` is normalised onto the auditor's
scale, so `critical` and `high` both mean `error`.

**Pagination**: `page` (default 1) and `limit` (default 100, max 500). It is
**global** across the flattened, project-ordered issue list in every mode, so
the two parameters mean one thing rather than two. Every in-scope project is
still listed with its full counts; one whose issues fall outside the window
simply carries an empty `issues` array and `returned_issue_count: 0`.

#### Eligibility

`jira_eligible` answers "may this be filed now?", and
`jira_eligibility_reason` says why:

| Link state | `jira_eligible` | Reason |
|---|---|---|
| no link row | yes | `not_linked` |
| `seox_state = wont_fix` | **no** | `marked_wont_fix` - someone declined it |
| `state = unlinked` | yes | `previously_unlinked` |
| `state = failed` | yes | `previous_attempt_failed` |
| `seox_state = reopened` | yes | `reopened_still_present` - reuse is correct |
| `state = linked` / `creating` | **no** | `already_linked` |

A finding that cannot be fingerprinted is omitted entirely rather than offered
as a possible duplicate.

`issue_id` **is** the fingerprint `POST /api/jira/issues {action:"create"}`
computes, so a caller can hand a finding from this feed straight to the create
path and land on the row reported here - the `UNIQUE (user_id, fingerprint)`
index is what makes that exact rather than approximate.

#### Issue sources

Only what SEOX actually stores. SEOX has no findings table - the crawler runs
in the browser - so findings are derived from the stored module results by
`functions/_lib/jira-eligible-sources.js`:

| Source | Stored in | Becomes a finding when | Module |
|---|---|---|---|
| E-E-A-T Audit | `tool_results.eeat` | check `status: fail` | `eeat` |
| Robots.txt | `tool_results.robots` | check `status: fail` / `notfound` | `robots` |
| Speed / PageSpeed | `tool_results.speed` | check `fail`; `cwv[].good === false`; each `opportunities[]` | `speed` |
| Crawl Optimization | `tool_results.crawlOptimization` | check `status: found` (severity from its `priority`) | `auditor` |
| Semantic Audit | `tool_results.semantic` | `seoAnalysis[]` / `performance[]` `fail` or `warning` | `semantic` |
| W3C Validator | `tool_results['w3c-validation']` | `messages[]` of type `error`/`warning`, grouped per distinct message | `w3c` |
| Duplicate Checker | `tool_results.duplicate` | a page with real overlap (`duplicateWords > 0` or `matches`) | `duplicate` |
| Plagiarism | `tool_results.plagiarism` | `matches[]` non-empty | `duplicate` |
| On-Page Analyzer | `project_data.onPageAnalysis` | check `status: fail` | `auditor` |
| Site crawl | `project_data.auditIssues` | every entry, one per affected URL | `auditor` |
| Screaming Frog | `screaming_frog_url_reports` | each `report_data.findings[]`, newest scan only | `auditor` |
| WordPress Security | `wp_security_findings` | every row of the newest scan | `wpscan` |

The legacy `project_data` copies of these modules
(`speed_test`, `semantic_audit`, `crawl_optimization`, `w3_validation`, ...)
are read too, so a project whose results predate `tool_results` is not reported
as clean. A result present in both places collapses on its fingerprint.

Screaming Frog's own check ids are folded onto the auditor's slugs where they
name the same defect (`title_missing` -> `title-tag-missing-or-empty`), because
aliasing the *module* alone would still leave two fingerprints for one problem.
Threshold checks are deliberately not merged: `title_over_60` is not the
auditor's 70-character `title-too-long`.

**Not issue sources**, and why: `dashboardChecks` (reports that a check could
not *run* - operational, not an SEO defect), `sitemap` and `llmsTxt` (inventory
and generator output, no verdict), `backlinks` (verdicts are computed in the
browser and never persisted), `aiModelChecker` / `aiCompatibility` (advisory
scores with no stable check identity), `gsc` / `bing` (metric series, no
per-finding records).

#### Cost

One request issues **8 statements** (9 when a WordPress scan exists), whether
it covers one project or every project - verified by instrumenting the pool.
Every lookup is batched over the whole project set and grouped in memory; there
is no per-project or per-issue query.

It makes **zero Jira API calls**. The Jira state served here is what SEOX
already stores, kept current by the webhook and the 30-minute reconcile sweep,
so the endpoint stays fast and keeps working while Jira is down.

Note the queries over `user_projects` and `screaming_frog_url_reports` are
deliberately unsorted in SQL and ordered in memory: those rows carry JSON
columns, and sorting them server-side is the documented cause of the
"Out of sort memory" failure in [`SORT_BUFFER_FIX.md`](SORT_BUFFER_FIX.md).

#### Errors

All JSON, all `{ "success": false, "error": "..." }`, and never a SQL
statement, credential or stack trace. A failure without an authored status is
logged server-side and reported as a generic message.

| Status | `error` |
|---|---|
| 400 | `admin_token is required` |
| 401 | `Invalid admin_token` |
| 404 | `Project not found` |
| 404 | `Project not found for the specified URL` |
| 400 | `project_id and url refer to different projects` |
| 500 | `Failed to retrieve Jira-eligible issues` |

### 3.2 Updating a ticket's status

```
POST /api/jira/issues/status
Content-Type: application/json

{ "admin_token": "YOUR_ADMIN_TOKEN", "jira_issue_key": "SEO-123" }
```

**This calls Jira.** It is the one endpoint that changes a Jira issue because a
user asked it to. It does not write a status into `jira_issue_links` and call
the ticket resolved — the local row is updated *afterwards*, from what Jira
reports back, and only if Jira accepted the transition. If Jira is down,
nothing changes anywhere.

`admin_token` and nothing else, exactly as in §3.1. A session Bearer header is
not read, and a request without the field is a 400 rather than a fall-through.

**Naming the target.** Three forms, in precedence order:

| Field | Meaning |
|---|---|
| `transition_id` | An id read from the GET above. Preferred. |
| `status` | A destination status name, e.g. `"Done"`, `"In Progress"`. |
| `action` | An intent: `resolve` (the default), `reopen`, `in progress`, `open`. |

**Transition ids are never hardcoded and never assumed.** They are per
project, per workflow and per the issue's *current* status, so every request
reads `GET /rest/api/3/issue/{key}/transitions` first and resolves the target
against that live list. A `transition_id` that is not on it is refused rather
than sent. A `status` is matched on the destination status name, then on the
transition's own label, and only then — if the word is one SEOX recognises —
on the destination's `statusCategory`, which is the sole part of a Jira
workflow that is stable across projects. An unrecognised name is an error, not
a guess.

There is no assumption that a "Resolved" status exists. `action: "resolve"`
finds the transition whose destination is in the **done** category, which
works on a board whose done column is called "Shipped to prod". If the only
done transitions decline the work ("Won't Do", "Duplicate"), it refuses with
`ONLY_DECLINING_TRANSITIONS` rather than recording a fix that never happened —
those remain available by explicit `transition_id`.

**Authorisation is four checks**, because an `admin_token` identifies a SEOX
user, not a right to drive somebody's board:

1. the issue has a `jira_issue_links` row owned by this user — otherwise 404,
   never 403, which would confirm the issue exists
2. that project still has a usable connection and an active mapping
3. the issue key's prefix matches `jira_project_mappings.jira_project_key`
4. the issue Jira actually serves is still in that project — this catches an
   issue **moved** between Jira projects after SEOX linked it

So an arbitrary key such as `OPS-9` cannot be used to close a ticket on a board
SEOX was never pointed at.

**Success** carries Jira's own values, re-read after the transition, because a
post-function can set a resolution, reassign, or route the issue somewhere
other than the transition's nominal destination:

```json
{
  "success": true,
  "message": "Jira ticket SEO-123 updated successfully",
  "data": {
    "jira_issue_key": "SEO-123",
    "previous_status": "In Progress",
    "new_status": "Done",
    "new_status_category": "done",
    "jira_resolution": "Done",
    "jira_issue_url": "https://company.atlassian.net/browse/SEO-123",
    "transition_id": "31",
    "transition_name": "Done",
    "seox_state": "resolved_pending",
    "seox_state_label": "Awaiting verification",
    "awaiting_verification": true,
    "updated_at": "2026-09-22T16:00:00.000Z"
  }
}
```

**Note `seox_state`.** Resolving the Jira ticket moves the finding to
*Awaiting verification* and queues the re-check — it never writes `verified`.
Only the verification job decides between `verified` and `reopened`. That is
the same path a webhook-delivered transition takes; both go through
`applyRemoteState()`, so the two cannot disagree.

**Errors**, all `{ "success": false, "error": "...", "code": "..." }`:

| Status | `error` | `code` |
|---|---|---|
| 400 | `admin_token is required` | |
| 401 | `Invalid admin_token` | |
| 400 | `jira_issue_key is required` | |
| 404 | `Jira issue not found` | |
| 409 | `Jira integration is not configured` | `NOT_CONNECTED` |
| 401 | credentials no longer valid | `INVALID_CREDENTIALS` |
| 409 | no Jira project mapped | `NO_MAPPING` |
| 403 | issue is not in the mapped Jira project | `WRONG_JIRA_PROJECT` |
| 403 | issue was moved to another Jira project | `ISSUE_MOVED` |
| 400 | `The requested Jira status transition is not available` | `TRANSITION_UNAVAILABLE` |
| 400 | `No valid Jira transition is available to resolve this issue.` | `TRANSITION_UNAVAILABLE` |
| 400 | only declining transitions on offer | `ONLY_DECLINING_TRANSITIONS` |
| 429 | rate limited (`jira:transition`, 120/hour) | |
| 502/504 | Jira unreachable — nothing was changed | |

A `TRANSITION_UNAVAILABLE` response includes `data.available_transitions`, so
the caller can offer what does exist instead of guessing again.

### 3.3 The Jira Tickets page

`/jira/tickets`, in the sidebar under **Jira → Tickets**. Lazy-loaded like
every other page; `src/App.jsx` imports it dynamically, so a Jira-less install
never downloads it.

It reads **the existing feed** — one `POST /api/jira/issues` with
`jira_created: true` per project selection — and adds no retrieval logic of
its own. The project list comes from `ProjectsContext`, which the application
already holds, so selecting a project costs one request and not two. Jira
itself is called for exactly one thing: the transitions of the single ticket
whose detail panel is open. There is no per-row Jira call.

Default view is **Pending**, decided on `jira_status_category` being anything
other than `done` — never on a list of status names, which are per-project and
renameable. After a successful resolve the row is rewritten in place from the
response and simply stops matching Pending; nothing reloads.

**It asks for an admin token.** The ticket APIs accept `admin_token` and refuse
every other credential, and nothing hands the browser one — so the page has a
token field, stored in `localStorage` under `seox.jira.adminToken`, the same
pattern Settings uses for the DeepSeek API key. Adding an endpoint that minted
an admin token from a session was considered and rejected: it would quietly
undo the separation these endpoints exist to keep.

### Notable status codes

- `200 { "connected": false }` — Jira not set up. **Normal**, not an error.
- `200 { "created": false, "alreadyLinked": true }` — duplicate prevented.
- `409` — no mapping, or mapping invalid.
- `429` — rate limited; `retryAfterSeconds` included.
- `503` vs `401` — a database outage is distinguished from a bad token
  (inherited from `auth-token.js`).

`POST /api/jira/issues {action:"create"}` follows the algorithm in §4.4 of the
plan: fingerprint → local check → optional remote JQL adoption → reserve row →
call Jira → record. `ER_DUP_ENTRY` on the reservation is treated as success and
the winner's row is returned.

---

## 4. Rate limits

Added to `LIMITS` in `functions/_lib/rate-limit.js`, using the existing
`api_rate_limits` table:

| Bucket | Limit |
|---|---|
| `jira:connect` | 10 / hour |
| `jira:test` | 20 / hour |
| `jira:create` | 100 / hour |
| `jira:sync` | 60 / hour |
| `jira:metadata` | 60 / hour |
| `jira:transition` | 120 / hour |
| `jira:webhook` | 600 / hour, **per connection** |

AI enrichment spends the existing `ai:generate` bucket — no Jira-specific AI
budget.

Jira's own 429 is handled separately: in a request it surfaces with
`Retry-After`; in a job it reschedules **without consuming an attempt**, because
burning retries on a throttle is how a brief rate limit becomes a dead-lettered
job.

---

## 5. Security

- **Credentials**: AES-GCM at rest (`functions/_lib/secret-crypto.js`), envelope
  `v1.<iv>.<ciphertext>`. Never returned to the browser, never logged.
- **Webhook**: 32-byte per-connection secret in the URL, located by a
  non-reversible `sha256` lookup column, then compared in **constant time**.
  Jira Cloud's plain webhooks are unsigned, so this is the control.
  Unknown issues are acknowledged-and-dropped (a different answer would leak
  which issues SEOX tracks).
- **SSRF**: the user supplies the Jira base URL and the server then calls it.
  `normalizeJiraBaseUrl` enforces https + public host on **every call**, not just
  at connect, and cross-host redirects are never followed. Finding URLs go
  through the existing `parsePublicHttpUrl`.
- **IDOR**: link ids are sequential bigints, so every query pins `user_id`.
- **Third-party PII**: Jira users' email addresses are never stored or
  forwarded; only `accountId` and `displayName`. Webhook payloads are trimmed
  before storage. Comment bodies render as **plain text only**.
- **CSRF**: not applicable — auth is a Bearer token from `localStorage`, not a
  cookie. Do not move the session to a cookie without revisiting this.

---

## 6. Reliability

`functions/_lib/jira-client.js` is the only code that calls Jira. It carries the
three guards `google-fetch.js` documents (this host has no global IPv6 and high
RTT to some endpoints, so a bare `fetch()` can fail with `ETIMEDOUT`):

- connect timeout — 8s interactive, 15s background
- bounded retries — 2, 400ms base, **connect errors and 5xx only**
- a circuit breaker — 5 consecutive connect failures pauses that connection for
  5 minutes, so a Jira outage plus a full queue cannot fill the single Node
  process with 15-second timeouts

HTTP 4xx is **never** retried — Jira has answered.

Jobs: `[60, 300, 1800]` second backoff, 3 attempts, then dead-letter with a
`jira_sync_logs` row and a **Retry** button in Settings → Jira.

**A verification that cannot reach the site is not a failed verification.** The
finding stays *awaiting verification* and nothing is said in Jira — SEOX must
never accuse a developer because of its own network problem.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/jira/*` returns 404 in production | Route missing `configurePreviewServer` | `npx node --test tests/jiraPreviewMount.test.js` |
| "Jira integration is not configured on this server" | `JIRA_TOKEN_ENCRYPTION_KEY` unset | Set it and restart |
| "encrypted with a different JIRA_TOKEN_ENCRYPTION_KEY" | Key changed | Reconnect Jira |
| Statuses never update | Webhook not registered **and** runner not scheduled | Check `SELECT status, COUNT(*) FROM jira_jobs GROUP BY status;` and the cron entry |
| "the Jira job runner is disabled" | `JIRA_SCHEDULER_TOKEN` unset | Set it — unset means disabled, deliberately |
| Webhook shows "no events received yet" | Not registered, or URL/query string rewritten by the proxy | The secret is in `?t=` — any config dropping the query string breaks auth silently |
| Create fails with a field error | Jira project has a required custom field | The Jira message is surfaced verbatim; add the field in Jira or pick another issue type |
| Issue reopened but shouldn't be | Verification found the finding still present | Read the failing check in the panel or the Jira comment |

Useful queries:

```sql
SELECT result, COUNT(*) FROM jira_sync_logs
 WHERE created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) GROUP BY result;

SELECT * FROM jira_jobs WHERE status = 'dead' ORDER BY updated_at DESC;

SELECT * FROM jira_webhook_events
 WHERE status = 'pending' AND received_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE);

SELECT seox_state, COUNT(*) FROM jira_issue_links
 WHERE state = 'linked' GROUP BY seox_state;
```

---

## 8. Testing

```bash
npx node --test tests/jiraPreviewMount.test.js    # production-parity mounting
npx node --test tests/jiraFingerprint.test.js     # duplicate prevention
npx node --test tests/jiraStatusMap.test.js       # status/resolution mapping
npx node --test tests/jiraIssueBuilder.test.js    # ADF, labels, truncation
npx node --test tests/jiraVerification.test.js    # verification specs
npx node --test tests/jiraSecurity.test.js        # auth, SSRF, secrets
npx node --test tests/jiraBackwardCompat.test.js  # SEOX works without Jira
npx node --test tests/jiraTransitions.test.js     # transition resolution rules
npx node --test tests/jiraIssueStatus.test.js     # status endpoint auth
npx node --test tests/jiraTicketsView.test.js     # what counts as pending
npx node --test tests/                            # everything
```

No HTTP server and no live Jira are needed — handlers are called directly with a
`Request` and a stub `env`, matching the existing convention.

---

## 9. File map

**Backend libraries** (`functions/_lib/`)

| File | Role |
|---|---|
| `secret-crypto.js` | Generalised AES-GCM (refactored out of `gbp-crypto.js`, which now re-exports it) |
| `jira-client.js` | The only code that calls Jira: timeouts, retries, 429, SSRF, breaker |
| `jira-repository.js` | `jira_connections`, `jira_project_mappings` |
| `jira-store.js` | `jira_issue_links`, `jira_sync_logs`, `jira_webhook_events`, `jira_jobs` |
| `jira-request.js` | Auth + project-ownership guards |
| `jira-fingerprint.js` | Duplicate identity (pure) |
| `jira-finding.js` | Validates and normalises a submitted finding |
| `jira-status-map.js` | `statusCategory` → SEOX state, timestamp handling (pure) |
| `jira-verification.js` | Derives the verification spec (pure) |
| `jira-verify.js` | Executes it against the live URL |
| `jira-issue-builder.js` | ADF description, labels, payload (pure) |
| `jira-sync.js` | Apply Jira state; the three writes back |
| `jira-jobs.js` | Handlers, retry/dead-letter, reconcile scheduler |
| `jira-ai.js` | DeepSeek enrichment, reusing `deepseek-key.js` |
| `jira-transitions.js` | Reading and resolving workflow transitions (pure selection) |

**Routes** (`functions/api/jira/`): `connect.js`, `status.js`, `metadata.js`,
`mapping.js`, `issues.js`, `issues/status.js`, `webhook.js`, `jobs.js`

> `issues/status.js` MUST be registered before `issues.js` in
> `JIRA_ROUTES` (vite.config.js). Connect matches a mount path as a prefix, so
> `/api/jira/issues` also matches `/api/jira/issues/status` and would swallow
> it. `tests/jiraPreviewMount.test.js` asserts the ordering.

**Frontend**: `src/lib/jiraApi.js`, `src/lib/jiraCache.js`,
`src/lib/jiraFindings.js`, `src/lib/jiraTickets.js`,
`src/lib/jiraTicketsApi.js`, `src/lib/jiraAdminToken.js`,
`src/hooks/useJira.js`, `src/pages/settings/panels/JiraPanel.jsx`,
`src/pages/jira/JiraTickets.jsx`,
`src/components/auditor/JiraIssuePanel.jsx`,
`src/components/jira/JiraTicketDetail.jsx`,
`src/components/jira/JiraAdminTokenGate.jsx`

Two clients on purpose: `jiraApi.js` sends the session Bearer token to the
session-authenticated routes, `jiraTicketsApi.js` sends `admin_token` to the
two ticket routes. One module that sometimes sends one and sometimes the other
is how a request ends up carrying the wrong credential.

**Modified**: `vite.config.js` (route registration), `rate-limit.js` (buckets),
`gbp-crypto.js` (re-export), `settingsCatalog.js` + `SettingsPage.jsx` (tab),
`AuditorIssueDetail.jsx` (panel), `src/App.jsx` (lazy `/jira/tickets` route),
`DashboardSidebar.jsx` (Jira section), `jira-sync.js` +
`jira-store.js` + `jira-eligible.js` (shared helpers),
`.env.example`, `.dev.vars.example`

---

## 10. Not built yet

Deferred per the plan's phasing, and **not** stubbed:

- **Phase 4** — automatic issue creation. `auto_create_enabled` and
  `auto_create_rules` exist in the schema and the settings UI, but no
  `jira_auto_scan` handler runs yet, so the toggle currently has no effect.
- **Phase 6** — the dashboard Jira card and the resolution-metrics funnel.
  `GET /api/jira/status` already returns the counts they need.
- Comment mirroring is wired end-to-end in the data model
  (`last_comment`, `comment_count`, the `comment_created` webhook event) but
  nothing yet writes the cache, so the panel's comment block stays empty.
- Batch ("one issue for N URLs") creation — the fingerprint supports it; no UI.
- The panel is currently rendered only on `/auditor/issues/:slug`. It takes a
  self-describing finding, so adding it to Speed, WordPress Security or Robots
  is a props change, not new logic.
- OAuth 2.0 3LO — the `jira_connections` columns exist; API-token auth is what
  is implemented.
