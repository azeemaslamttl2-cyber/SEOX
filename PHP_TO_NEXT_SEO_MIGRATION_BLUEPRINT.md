# PHP SEO Codebase to Current SEO Platform
## Migration Analysis and Product Roadmap

**Analysis date:** 2026-08-24  
**Legacy source:** `D:\wamp64\www\seo_php\code`  
**Current source:** `D:\wamp64\www\code-step-mysql`

## Executive Finding

The legacy application is a Laravel PHP content-production product with a small but real SEO-review subsystem. Its verified SEO capabilities are:

- AI-assisted article SEO/content review through SEO Review Tools.
- Helpful-content analysis.
- Bulk keyword statistics through SEO Review Tools.
- Keyword, title, meta-description, outline, topic, and image generation workflows.
- XML sitemap generation from `APP_URL`.
- WordPress REST publishing, media, taxonomy, search, update, and delete operations.
- Article and SEO-report persistence, plus subscription/usage accounting.

The current application is **not a Next.js application** despite the migration request wording. It is a Vite + React 18 frontend with Cloudflare Pages-style function handlers and a MySQL repository. It already contains a much broader SEO platform: project crawling, technical reports, GSC/Bing integrations, keyword tools, content/AI tools, backlinks, PageSpeed, Brand Radar, and project-scoped persistence.

Therefore, the migration is not a PHP-to-Next rewrite. It is primarily a selective port of PHP content workflows and WordPress publishing into the existing Vite/React + Functions architecture, followed by security and scalability improvements.

## Evidence and Scope

The PHP tree contains approximately 24,600 files, including vendor/assets. The analysis prioritized executable application code, routes, controllers, services, models, migrations, SQL, jobs, scheduled commands, Blade/AJAX code, and integration modules. Static/vendor files were not counted as product features.

The current application was checked through `src/pages`, `src/components`, `src/hooks`, `src/lib`, `functions/api`, `functions/_handlers`, `migration/mysql`, and `package.json`. A feature is marked complete only where a usable UI and a working backend or local implementation were found; a page name alone is not treated as proof.

## Legacy PHP Feature Inventory

### Article SEO Review and Helpful Content

**Locations**

- `app/Services/Business/SeoReviewToolService.php`
- `app/Services/Business/SeoService.php`
- `app/Services/Action/SeoCheckerActionService.php`
- `app/Http/Controllers/Admin/Seo/SeoCheckerController.php`
- `resources/views/backend/admin/seo/article/js.blade.php`

**Verified behavior**

`SeoReviewToolService` submits article title, meta description, body content, focus keyword, and related keywords to SEO Review Tools. It parses title, heading, keyword-use, content-length, overview, errors, warnings, feedback, and score data. The helpful-content method sends article text and parses category scores plus detailed ratings. The controller/action layer validates article ownership in active POST flows, prepares the request, and returns rendered Blade report fragments. The browser uses AJAX and updates ApexCharts score meters.

**Important transformations**

- Article whitespace is collapsed before submission.
- Focus keyword is truncated to the first three words.
- Related keywords require at least three comma-separated values and become a pipe-delimited string.
- API scores are converted using the shared percentage helper.
- Feedback is classified using API-provided positive/negative classes.

**Assessment:** Real, valuable workflow. It is the clearest PHP capability missing from the current platform.

### Keyword, Title, Meta Description, Outline, Topic, and Image Generation

**Locations**

- `app/Http/Controllers/Admin/Generator/GeneratorController.php`
- `app/Services/Model/Article/ArticleService.php`
- `app/Models/Article.php`
- `app/Models/ArticleSEO.php`
- `app/Services/IntegrationService.php` or its referenced integration implementation

**Verified behavior**

Generator controller methods create keyword lists, titles, meta descriptions, outlines, topics, and images through the integration layer. Selected values are stored on articles, including `focus_keyword`, `selected_keyword`, `selected_title`, and `selected_meta_description`. This is AI/provider orchestration rather than a local keyword-difficulty or ranking algorithm.

**Assessment:** The current app has overlapping AI/content tools, but not proven parity with this article-centric workflow and its selection persistence.

### Bulk Keyword Statistics

**Location:** `app/Services/Business/SeoReviewToolService.php`

**Verified behavior:** keyword arrays are sent to the SEO Review Tools keyword-statistics endpoint. Country and language are hard-coded to United States and English.

**Assessment:** Current app has stronger DataForSEO research and autocomplete tooling. The PHP implementation should not be copied as-is; its location/language contract should be generalized if the workflow is needed.

### XML Sitemap Generation

**Location:** `routes/web.php`

**Verified behavior:** `GET /generate-sitemap` invokes `Spatie\\Sitemap\\SitemapGenerator` against `env('APP_URL')`, writes `public/sitemap.xml`, and downloads the file.

**Assessment:** The current app already has sitemap generator/extractor tools and crawler sitemap reporting. The PHP-specific shared-file download implementation should not be migrated; only a concrete missing export behavior should be added if product requirements identify one.

### WordPress Publishing

**Locations**

- `Modules/WordpressBlog/Services/WpBasicAuthService.php`
- `Modules/WordpressBlog/Services/Posts/WpBlogPostPublishedService.php`
- `Modules/WordpressBlog/Services/Posts/WpPostService.php`
- `Modules/WordpressBlog/routes/web.php`
- `Modules/WordpressBlog/routes/api.php`

**Verified behavior**

The module supports WordPress Basic Auth REST calls for posts, tags, categories, authors, media, search, create, update, and delete. The publishing service converts article content to HTML, creates a slug, uploads featured media, publishes the post, and records synchronization metadata.

**Assessment:** Not found as a complete equivalent in the current app. High business value for a content platform, but it requires credential storage, permissions, retries, idempotency, media handling, and audit history.

### Article and SEO Persistence

**Locations**

- `database/migrations/2024_03_27_043922_create_articles_table.php`
- `database/migrations/2025_01_08_135733_create_article_s_e_o_s_table.php`
- `app/Models/Article.php`
- `app/Models/ArticleSEO.php`
- `SQL/writerap.sql`

**Verified data**

`articles` stores article title/topic, selected and focus keywords, meta description, body, generated-content references, publication status, and WordPress synchronization fields. `article_s_e_o_s` stores the source article JSON, SEO request body, SEO JSON, operator URL, article relationship, and creator.

**Assessment:** Current app uses project JSON plus `tool_results`, not an article/SEO-report relational model. A separate content domain is recommended rather than putting large articles into `user_projects.project_data`.

### Usage Accounting and Subscription Support

**Locations:** legacy subscription migrations/models/services and `app/Console/Commands/SubscriptionExpire.php`

**Verified behavior:** subscription plans, user subscriptions, usage records, generated-content records, pending activation, and expiration are present. The scheduler runs `subscription:expire` daily.

**Assessment:** Current app has Stripe/admin/payment surfaces, but exact parity of article generation quota accounting is not proven. Add feature-level usage metering before migrating expensive AI workflows.

### Jobs and Automation

The PHP scheduler only verified a daily subscription-expiration command. `EmailConfirmationJob` is asynchronous. No verified SEO crawl, sitemap refresh, backlink polling, rank-tracking, or report-generation job was found.

## Current Application Inventory

### Platform and Architecture

- `package.json` defines Vite build/dev scripts and React dependencies; it does not define a Next.js build.
- `src/App.jsx` contains the client route surface.
- `functions/api` contains server handlers deployed as platform functions.
- `functions/_lib/mysql.js` and `functions/_lib/mysql-repository.js` provide MySQL access.
- `functions/_lib/auth-token.js` provides signed JWT sessions and user verification.
- `migration/mysql/app_schema.sql` defines MySQL tables.

### Projects and Persistence

**Status: Complete for current project/tool model.**

- `functions/api/projects.js` handles project inventory, save, delete, metadata, tool results, and project-data updates.
- `src/lib/projectsApi.js` calls those handlers with the session bearer token.
- `user_projects.project_data` is JSON; `tool_results` is a dedicated per-project/per-tool JSON table.
- `saveProjectData` reads existing JSON, merges a named top-level key, and writes it back with owner scoping. This is used by keyword snapshots and cannibalization.
- `functions/api/project-info.js` loads project data and saved tool results.

Recommendation: retain the project boundary, but move large/high-cardinality histories out of JSON into typed tables.

### Keyword SEO

**Status: Complete/partial depending on feature.**

- Keyword research UI: `src/pages/keywords/KeywordResearch.jsx`; backend: `functions/api/keywords/research.js` and proxy logic. DataForSEO supports seed and domain modes with location/language validation.
- Suggestions/Ubersuggest: `src/pages/keywords/SuggestKeywords.jsx`, `src/pages/keywords/Ubersuggest.jsx`, `functions/api/keywords/ubersuggest.js`, `functions/api/autocomplete.js`.
- Branded keywords: `src/pages/keywords/BrandedKeywords.jsx`, `src/components/keywords/GscKeywordExplorer.jsx`; stores `branded-keywords` project data.
- New, lost, and low-hanging keywords: corresponding pages and shared keyword utilities.
- Cannibalization: `src/pages/keywords/KeywordCannibalization.jsx`, `src/lib/keywordTools.js`, `src/hooks/useGscKeywordData.js`; groups GSC query/page rows, retains queries with more than one page, aggregates clicks/impressions/weighted positions, calculates period deltas, and saves under `project_data.cannibalization`.
- Rank history/tracking: GSC pages and snapshots exist, but a scheduled independent rank-tracking system was not verified.
- Difficulty/CPC/competition: DataForSEO response support exists where exposed by the keyword UI; the PHP app's SEO Review Tools bulk endpoint is not required for parity.

### Technical SEO and Crawling

**Status: Broadly implemented.**

- Crawler: `functions/_handlers/crawler-fetch.js`, `functions/api/crawler/fetch.js`.
- Project/audit UI: `src/pages/auditor/*`, `src/components/auditor/*`.
- Reports include content, CSS, duplicates, external/internal pages, images, indexability, JavaScript, links, localization, performance, redirects, sitemap, social tags, and other issues.
- Separate tools include robots, sitemap, redirects, duplicate, speed/PageSpeed, schema-related and metadata utilities.
- PageSpeed backend: `functions/_handlers/pagespeed.js`, `functions/api/pagespeed.js`.

This is substantially more developed than the verified PHP SEO audit surface.

### GSC and Bing

**Status: Implemented with integration-specific limitations.**

- GSC OAuth and token persistence: `functions/api/gsc-token.js`, `src/pages/gsc/*`, `src/lib/gscSession.js`.
- GSC query/page/overview/keyword reports use Search Analytics API.
- Bing: `functions/api/webmaster-api.js`, `src/pages/techseo/BingWebmaster.jsx`.
- The PHP source did not show equivalent GSC/Bing SEO reporting, so these are current-app additions, not migration gaps.

### Backlinks and Off-Page Tools

**Status: Implemented/partial.**

- Backlink analysis: `functions/api/tech-seo/backlinks/analyze.js`, `src/pages/techseo/BacklinksAudit.jsx`, `src/pages/tech-seo/backlinks.jsx`.
- Cleaner, indexer, and expired-domain tools: `functions/api/off-page/*` and `src/pages/offpage/*`.
- Data source and long-term backlink history should be verified before calling this a full backlink database product.

The PHP inventory did not verify these features, so they should not be described as migrated PHP functionality.

### Content and AI

**Status: Broadly implemented, but not PHP parity.**

Current pages include content optimization, AI content helper, semantic writer, outline creator, grammar, NLP/entity/N-gram extractors, plagiarism, and related tools. Backends include `functions/api/content-writer.js`, `functions/_handlers/openai.js`, and `functions/_handlers/deepseek.js`.

The current app has content tooling, but the PHP article SEO review request/response schema, helpful-content score categories, Blade report output, article record model, and WordPress publish lifecycle are not proven equivalents.

### Brand Radar and GEO

**Status: Current-app addition.**

`src/pages/brandradar/*` and `src/pages/geo/*` provide AI visibility, cited pages, topics, sentiment, competitor research, prompt tracking, and related workflows. These were not verified in the PHP source.

### Reports, Exports, and Admin

**Status: Implemented in current app.**

Auditor report pages, CSV exports, project history, admin users/payments/APIs, Stripe settings, and project selection are present. The current reporting model is project/tool oriented rather than PHP article/SEO-report oriented.

## Feature Comparison

| Feature | PHP | Current app | Status | Difficulty to align |
|---|---|---|---|---|
| Article SEO scoring | Yes, SEO Review Tools | Content tools, no verified PHP-equivalent report contract | Partial | Medium |
| Helpful-content scoring | Yes | No verified equivalent | Missing | Medium |
| Bulk keyword statistics | Yes | DataForSEO keyword research | Complete by capability, different provider | Easy |
| Keyword suggestions | Not verified | Yes | Current addition | N/A |
| Branded keywords | Not verified | Yes | Current addition | N/A |
| Keyword cannibalization | Not verified | Yes, GSC query/page grouping | Current addition | N/A |
| Rank history | Not verified | GSC snapshots/pages | Partial | High |
| Technical crawl audit | Not verified | Yes, crawler and report pages | Current addition | N/A |
| Robots/sitemap analysis | Sitemap generation only | Yes, generators/extractors/reports | Current app broader | N/A |
| PageSpeed/Core Web Vitals | Not verified | Yes | Current addition | N/A |
| Backlink analysis | Not verified | Yes/partial | Current addition | N/A |
| Competitor/GEO intelligence | Not verified | Yes/partial | Current addition | N/A |
| Article generator workflow | Yes | AI/content tools, different model | Partial | Medium |
| Article SEO persistence | Yes, relational article tables | Project JSON/tool results | Partial | Medium |
| WordPress publishing | Yes | No complete equivalent found | Missing | High |
| Server sitemap generation/download | Yes | Sitemap tools and sitemap reporting | Complete by capability; different implementation | N/A |
| Subscription expiry job | Yes | Stripe/admin, exact quota job not verified | Partial | Medium |
| Scheduled SEO jobs | No verified implementation | No verified implementation | Not found in either | N/A |

## Business Logic to Reuse or Rewrite

### Reuse Conceptually

1. **Article analysis request preparation**
   - Inputs: article fields, focus keyword, related keywords.
   - Outputs: normalized provider request.
   - Rewrite as a typed TypeScript function such as `buildArticleSeoReviewRequest()`.
   - Preserve the three-word focus-keyword rule only if product requirements still support it; make it configurable.

2. **Provider response normalization**
   - Inputs: provider JSON.
   - Outputs: stable score, category, issue, warning, feedback, and metadata objects.
   - Use runtime validation (for example Zod or explicit validators) so provider changes cannot corrupt project data.

3. **Helpful-content classification**
   - Preserve the mapping of provider feedback classes to positive/warning/error categories.
   - Store normalized findings, not opaque provider payloads alone.

4. **WordPress slug/content conversion**
   - Preserve slug normalization and Markdown/article-to-HTML conversion behavior only after sanitization.
   - Add idempotency keys and publish-state transitions.

### Do Not Reuse Directly

- cURL calls with disabled TLS verification.
- API keys appended to URLs or written to logs.
- Shared fixed cache filenames.
- Hard-coded US/English keyword location.
- Unscoped article lookup patterns.
- Raw search terms concatenated into WordPress URLs.
- Large article/report blobs copied into `user_projects.project_data`.

## API and Service Mapping

| Legacy PHP | Recommended current architecture |
|---|---|
| `SeoReviewToolService` | `functions/_handlers/seo-review.js` plus provider client under `functions/_lib/providers/` |
| `SeoService` facade | Thin TypeScript service only if multiple providers remain |
| `SeoCheckerController` | Authenticated function route, for example `/api/content/seo-review` |
| Blade AJAX report | React client component consuming normalized JSON |
| `Article` / `ArticleSEO` | `articles`, `article_seo_reviews`, and `article_generations` MySQL tables/repositories |
| `GeneratorController` | Existing content API handlers with typed generation actions |
| `WpBasicAuthService` | Server-only WordPress client with encrypted credentials and retry policy |
| `WpBlogPostPublishedService` | Publish orchestration service plus persisted publish attempts |
| `GET /generate-sitemap` | Authenticated/project-scoped function route or explicit export job |
| PHP daily command | Cloudflare scheduled function or external worker/cron |
| PHP subscription usage tables | Existing billing domain plus feature usage ledger |

## External API Assessment

### SEO Review Tools

- **Purpose:** article SEO review, helpful-content review, bulk keyword statistics.
- **PHP location:** `app/Services/Business/SeoReviewToolService.php`.
- **Authentication:** provider key in request construction; exact credential names are intentionally omitted.
- **Migration:** call only from a server function; use POST where supported; keep secrets in deployment configuration; redact URLs, headers, and bodies in logs; add timeouts, retry limits, provider error normalization, and rate limiting.
- **Decision:** migrate only if its score/report output is a product requirement. Current DataForSEO and current content/AI services already cover adjacent capabilities.

### DataForSEO

- **Current location:** `functions/api/keywords/research.js` and proxy handling.
- **Purpose:** seed suggestions/domain keyword research and metrics.
- **Migration:** retain server-side calls and admin/user authorization; never expose credentials in Vite client variables.

### Google Search Console

- **Current location:** `functions/api/gsc-token.js`, GSC pages/hooks.
- **Purpose:** sites, query/page analytics, keyword and cannibalization reports.
- **Migration:** retain OAuth refresh-token storage and project/user authorization; add refresh failure states and scheduled snapshot jobs if rank history is required.

### Bing Webmaster

- **Current location:** `functions/api/webmaster-api.js`, `src/pages/techseo/BingWebmaster.jsx`.
- **Purpose:** Bing site/statistics operations.
- **Migration:** retain server proxy and per-user/project authorization. Do not place keys in query strings where avoidable.

### Google PageSpeed

- **Current location:** `functions/_handlers/pagespeed.js`, `functions/api/pagespeed.js`.
- **Purpose:** Lighthouse/PageSpeed analysis.
- **Migration:** retain server-only key, timeout, response-size, and URL-security controls. Store normalized metrics separately from full provider payloads.

### OpenAI/DeepSeek

- **Current location:** `functions/_handlers/openai.js`, `functions/_handlers/deepseek.js`, content APIs.
- **Purpose:** content generation and AI analysis.
- **Migration:** use provider adapters and a common structured-output contract; validate all model output before persistence.

### WordPress REST API

- **PHP location:** `Modules/WordpressBlog/Services/WpBasicAuthService.php`.
- **Purpose:** posts, media, taxonomy, authors, search, publish/update/delete.
- **Migration:** server-only encrypted credentials, URL encoding, HTML sanitization, idempotency, retries, webhook/poll reconciliation, and an audit trail.

## Database Recommendation

### Keep

- `users` and `user_projects` for identity and project ownership.
- `tool_results` for bounded per-tool snapshots.
- `gsc_connections` and `yandex_connections` for integration credentials/tokens, with encryption and strict access controls.
- `admin_settings` only for non-secret configuration or encrypted secret references.

### Add for PHP-derived content workflows

```text
articles
  id, user_id, project_id, title, topic, body, status,
  focus_keyword, selected_keyword, meta_description,
  created_at, updated_at

article_seo_reviews
  id, article_id, user_id, provider, request_hash,
  score, normalized_result_json, created_at

article_generations
  id, article_id, user_id, generation_type,
  prompt_version, provider, result_json, created_at

wordpress_connections
  id, user_id, project_id, site_url,
  encrypted_credentials, status, created_at, updated_at

wordpress_publications
  id, article_id, connection_id, remote_post_id,
  status, remote_url, request_hash, error_json,
  published_at, updated_at

usage_ledger
  id, user_id, project_id, feature, units,
  provider, request_id, created_at
```

### JSON policy

Use JSON for provider payloads, normalized report details, and flexible tool metadata. Use typed columns and indexes for ownership, project, status, timestamps, remote IDs, request hashes, and queryable metrics. Do not store unlimited article histories or large crawl payloads in `user_projects.project_data`.

## Architecture Recommendation

Keep the current deployment model unless there is a separate strategic reason to move to Next.js:

```text
src/pages and src/components   React UI and route-level workflows
src/lib                        API clients and pure SEO utilities
functions/api                  authenticated route handlers
functions/_handlers            provider/crawl/content orchestration
functions/_lib                 auth, MySQL, HTTP, URL security, repositories
workers/jobs                   scheduled snapshots and long-running publishing/crawls
MySQL                          typed domain tables plus bounded JSON payloads
```

If a future Next.js migration is required, map `src/pages` to App Router client/server components and map `functions/api` to Route Handlers. Do not migrate framework labels before separating provider clients, domain services, persistence, and UI.

Required cross-cutting controls:

- Server-only secrets and encrypted OAuth/WordPress credentials.
- Project ownership checks on every read/write.
- Per-user and per-provider rate limits.
- Request IDs and redacted structured logs.
- Abortable HTTP calls and bounded response sizes.
- Queue/worker execution for crawl, bulk AI, WordPress media, and report generation.
- Idempotent job keys and retry/dead-letter state.
- Typed provider contracts and schema validation.
- Metrics for provider latency, failures, quota, and usage.

## Quick Wins

1. Add a normalized article SEO review endpoint using the existing content/API patterns. Reuse PHP request preparation and feedback mapping, but fix TLS/logging and use a per-request cache key.
2. Add helpful-content scoring as another report tab using the same normalized finding model.
3. Add feature usage records around existing AI/content routes before opening expensive workflows to all plans.
4. Add provider adapter tests using sanitized fixture responses from the PHP behavior.

## High-Value Features

- Article SEO review plus actionable recommendations.
- Helpful-content analysis tied to article versions.
- WordPress publishing with preview, scheduling, rollback metadata, and publish reconciliation.
- Scheduled GSC snapshots and rank-history charts.
- Cross-tool recommendations that combine crawl issues, GSC queries, and content records.

The current app’s cannibalization, Brand Radar, crawler, and audit work are already stronger competitive assets than the verified PHP SEO feature set; prioritize reliability, persistence, and workflow integration over rebuilding them.

## PHP Features That Should Be Improved

### SEO provider client
The PHP client disables TLS verification, exposes keys in URLs/logs, and lacks a strong normalized contract. Use secure HTTPS verification, secret headers where supported, redacted logs, schema validation, circuit breaking, and bounded retries.

### Cache/report files
Fixed filenames such as `get_helpful_content_analysis.json` can leak data across users and race under concurrent requests. Replace them with database/object-storage records keyed by user, project, article, provider, and request hash.

### Ownership and IDOR protection
Some article lookup methods are not owner-scoped even though selected controllers validate ownership. Make ownership part of repository queries, not a controller convention.

### WordPress calls
URL-encode search values, sanitize HTML, never log Basic Auth options, encrypt credentials, and persist remote IDs/request hashes for idempotent retries.

### Sitemap route
Require authorization or make the public contract explicit, add throttling, avoid writing to a shared web root in a multi-instance deployment, and generate from a controlled URL set.

### Subscription/usage logic
Use a transactional usage ledger and provider request IDs. Do not rely on mutable counters alone for expensive AI actions.

## Features That Should Not Be Migrated

- Shared demo/cache files.
- Disabled TLS settings.
- Hard-coded US/English defaults as hidden behavior.
- Unauthenticated operational routes unless public behavior is intentional.
- Framework-specific Blade/ApexCharts rendering; migrate the normalized data contract, not the view implementation.
- Legacy generated-content tables that duplicate article state without a clear audit/history purpose.
- Any hard-coded third-party credentials or credential-like constants.

# SEO FEATURES NOT INCLUDED IN OUR NEXT.JS APP

This section lists only PHP capabilities that were verified in the legacy source and were not found as complete equivalents in the current application. Features that are broader current-app additions are intentionally excluded.

## A. Missing — Critical

| Feature | PHP location | Current status | What it does | Difficulty | Effort | Business value | Priority | Recommended implementation |
|---|---|---|---|---|---|---|---|---|
| Article SEO review report | `app/Services/Business/SeoReviewToolService.php`; `app/Http/Controllers/Admin/Seo/SeoCheckerController.php` | Partial; current content tools do not prove this report contract | Scores title, headings, keyword use, content length, warnings, errors, and feedback for an article | Medium | Medium | High | Critical | Add authenticated `/api/content/seo-review`; normalize provider response; render a React report; persist versioned review rows |
| Helpful-content analysis | `app/Services/Business/SeoReviewToolService.php` | Not implemented as a verified equivalent | Produces helpful-content score, category ratings, and detailed feedback | Medium | Medium | High | Critical | Add as a second action on the article review service and persist normalized categories/findings |

## B. Missing — High Priority

| Feature | PHP location | Current status | What it does | Difficulty | Effort | Business value | Priority | Recommended implementation |
|---|---|---|---|---|---|---|---|---|
| WordPress article publishing | `Modules/WordpressBlog/Services/Posts/WpBlogPostPublishedService.php` | No complete equivalent found | Converts article content, uploads media, creates slug, publishes, and records sync | High | High | High | High | Build server-only WordPress connector, encrypted credentials, preview/publish/update/delete, idempotency, retries, and publication history |
| WordPress content administration | `Modules/WordpressBlog/Services/WpBasicAuthService.php` | No complete equivalent found | Posts, tags, categories, authors, media, search, create, update, delete | High | High | High | High | Implement typed client methods behind authenticated project-scoped routes; add remote-ID mapping |
| Article-centric SEO persistence | `database/migrations/2024_03_27_043922_create_articles_table.php`; `database/migrations/2025_01_08_135733_create_article_s_e_o_s_table.php` | Current app has content tools and project JSON, but no verified article/report model | Stores article versions, selected SEO fields, full requests/results, and creator ownership | Medium | Medium | High | High | Add `articles`, `article_seo_reviews`, and `article_generations`; keep project JSON for small summaries only |

## C. Missing — Medium Priority

Only PHP functionality without an equivalent working current-app module is listed here.

| Feature | PHP location | Current status | What it does | Difficulty | Effort | Business value | Priority | Recommended implementation |
|---|---|---|---|---|---|---|---|---|
| Article generation selection workflow | `app/Http/Controllers/Admin/Generator/GeneratorController.php` | Current AI/content tools exist, but PHP article selection/persistence parity is incomplete | Generates keywords/titles/meta/outlines and stores selected values on an article | Medium | Medium | Medium/High | Medium | Add article workspace with versioned suggestions and explicit selection persistence |

## D. Missing — Low Priority

| Feature | PHP location | Current status | What it does | Difficulty | Effort | Business value | Priority | Recommended implementation |
|---|---|---|---|---|---|---|---|---|
| PHP-specific SEO operator/report metadata | `database/migrations/2025_01_08_135733_create_article_s_e_o_s_table.php` | Not represented as a dedicated current domain model | Stores provider request JSON, response JSON, operator URL, and creator | Easy | Low | Low/Medium | Low | Store sanitized provider metadata and request hash only when auditability requires it |
| Legacy article generated-content references | `database/migrations/2024_03_27_043922_create_articles_table.php` | No direct parity model | Connects generated content records to article state | Medium | Medium | Low | Low | Do not copy wholesale; replace with `article_generations` and version metadata |

## E. Partially Implemented — Needs Completion

| Feature | PHP location | Current status | Gap | Difficulty | Effort | Priority | Recommended implementation |
|---|---|---|---|---|---|---|---|
| Article SEO checker workflow | `app/Http/Controllers/Admin/Seo/SeoCheckerController.php`; `resources/views/backend/admin/seo/article/js.blade.php` | Current app has content optimization pages and AI handlers | No verified article-owned request, normalized score schema, report history, and AJAX-equivalent workflow | Medium | Medium | High | Add article domain, server review action, React report, and persisted review history |
| Subscription usage controls for content tools | Legacy subscription tables and `SubscriptionExpire.php` | Current app has Stripe/admin surfaces | Exact per-feature AI usage ledger and expiry behavior are not verified | Medium | Medium | High | Add transactional usage ledger, plan limits, and scheduled expiry/renewal reconciliation |

## Final Development Backlog

### Phase 1 — Quick Wins

| Rank | Feature | Current status | Value | Effort | Priority | Recommended phase |
|---:|---|---|---|---|---|---|
| 1 | Article SEO review API/report | Partial | High | Medium | Critical | Phase 1 |
| 2 | Helpful-content analysis | Missing | High | Medium | Critical | Phase 1 |
| 3 | Provider response fixtures and schema validation | Missing | High | Low | Critical | Phase 1 |
| 4 | Usage ledger around AI calls | Partial | High | Medium | High | Phase 1 |
| 5 | Article generation selection workflow | Partial | Medium/High | Medium | Medium | Phase 1 |

### Phase 2 — Core SEO Features

| Rank | Feature | Current status | Value | Effort | Priority | Recommended phase |
|---:|---|---|---|---|---|---|
| 6 | Article workspace and versioned SEO persistence | Partial | High | Medium | High | Phase 2 |
| 7 | WordPress connection and publish flow | Missing | High | High | High | Phase 2 |
| 8 | WordPress media/taxonomy/search administration | Missing | High | High | High | Phase 2 |
| 9 | Scheduled GSC snapshots/rank history | Partial | High | High | High | Phase 2 |
| 10 | Cross-tool SEO recommendation model | Partial | High | Medium/High | High | Phase 2 |

### Phase 3 — Advanced SEO Intelligence

| Rank | Feature | Current status | Value | Effort | Priority | Recommended phase |
|---:|---|---|---|---|---|---|
| 11 | Combine article review with crawl/GSC findings | Partial | High | High | High | Phase 3 |
| 12 | Content gap and keyword-to-article mapping | Partial | High | Medium/High | High | Phase 3 |
| 13 | Provider-agnostic SEO scoring and explainable recommendations | Partial | High | Medium | Medium | Phase 3 |

### Phase 4 — Automation and Scalability

| Rank | Feature | Current status | Value | Effort | Priority | Recommended phase |
|---:|---|---|---|---|---|---|
| 14 | Queue-backed bulk content analysis | Not implemented | High | High | High | Phase 4 |
| 15 | Scheduled sitemap/crawl/report jobs | Not implemented | Medium/High | High | High | Phase 4 |
| 16 | WordPress publish reconciliation and retry queue | Missing | High | High | High | Phase 4 |
| 17 | Usage/quota analytics and provider cost reporting | Partial | Medium/High | Medium | Medium | Phase 4 |

## Final Executive Summary

1. **Most valuable verified PHP features:** article SEO review, helpful-content analysis, article generator workflow, and WordPress publishing.
2. **Already available in the current app:** a broader crawler/auditor, GSC/Bing, keyword research, branded and cannibalization analysis, PageSpeed, backlinks, content/AI tools, Brand Radar, project persistence, exports, and admin/billing surfaces.
3. **Important PHP-derived gaps:** a dedicated article SEO review/helpful-content report contract, article/report persistence, complete WordPress publishing, and the article generation selection workflow.
4. **Quick migrations:** normalized article review/helpful-content endpoints, provider fixtures, usage metering, and article-generation selection persistence.
5. **Significant development:** WordPress publishing, article versioning, scheduled rank history, queues, retries, and cross-tool recommendations.
6. **Improve instead of copy:** TLS handling, secret management, logging, cache files, ownership checks, URL encoding, sitemap deployment, and mutable usage counters.
7. **Skip:** shared demo files, insecure cURL behavior, hard-coded provider defaults, and legacy duplicate tables without an audit requirement.
8. **Build first:** article SEO review plus helpful-content analysis, backed by an article domain and usage ledger; then WordPress publishing.
9. **Competitive advantage:** connect the current crawler, GSC/cannibalization, Brand Radar, and content review into one project-aware recommendation and publishing loop.

The direct answer to the final question is: **the PHP application provides article-level SEO/helpful-content review, an article-centered generation/selection workflow, and WordPress publishing that are not yet available as complete equivalents in the current application. Build article SEO review and helpful-content analysis first, then add article persistence and WordPress publishing.**
