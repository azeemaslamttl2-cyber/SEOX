# Firebase Firestore to MySQL Migration Report

## Executive summary

The codebase is currently split between Firebase Authentication and a custom Cloudflare Functions backend that uses Firestore through a REST helper layer. The frontend also imports Firebase web SDK modules directly for auth and content writer persistence. The migration target is to replace Firebase-dependent storage and auth with MySQL-backed API calls while preserving the existing user experience.

## Findings

### 1. Firebase / Firestore usage

Direct Firestore usage is concentrated in:
- [src/lib/firebase.js](src/lib/firebase.js): initializes Firebase app, auth, and Firestore.
- [src/lib/auth.js](src/lib/auth.js): uses Firebase email/password and Google sign-in.
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx): listens to Firebase auth state.
- [src/lib/firestoreProjects.js](src/lib/firestoreProjects.js): wraps project persistence through the projects API.
- [src/pages/content/ContentWriterDashboard.jsx](src/pages/content/ContentWriterDashboard.jsx): reads and writes `project_data` documents.
- [src/pages/content/SemanticContentWriter.jsx](src/pages/content/SemanticContentWriter.jsx): stores draft articles and article states in Firestore.
- [functions/_lib/firebase-rest.js](functions/_lib/firebase-rest.js): central Firestore REST helper used by server routes.
- [functions/api/projects.js](functions/api/projects.js): stores project metadata and tool results in Firestore.
- [functions/api/api-settings.js](functions/api/api-settings.js): stores admin DataForSEO settings in Firestore.
- [functions/api/gsc-token.js](functions/api/gsc-token.js): stores Google Search Console OAuth tokens.
- [functions/api/stripe-connect.js](functions/api/stripe-connect.js): stores Stripe connection state.
- [functions/api/admin-data.js](functions/api/admin-data.js): reads admin-related collections from Firestore.
- [functions/api/admin-stripe.js](functions/api/admin-stripe.js): lists Stripe connection documents.
- [functions/_handlers/proxy.js](functions/_handlers/proxy.js): reads DataForSEO credentials from Firestore.
- [functions/_handlers/webmaster-api.js](functions/_handlers/webmaster-api.js): stores Yandex tokens in Firestore.

### 2. Firestore collections inferred from the code

| Collection / path | Purpose | MySQL target |
| --- | --- | --- |
| `adminSettings` / `apis` | admin DataForSEO credentials | `admin_settings` |
| `stripeConnections` | Stripe account state | `stripe_connections` |
| `users/{uid}/gscConnection` | Google Search Console tokens | `gsc_connections` |
| `users/{uid}/yandexConnection` | Yandex Webmaster tokens | `yandex_connections` |
| `users/{uid}/projects` | project metadata | `user_projects` |
| `users/{uid}/meta` | selected project and deleted project IDs | `user_meta` |
| `users/{uid}/projects/{projectId}/toolResults` | tool result snapshots | `tool_results` |
| `project_data/{uid}` | content writer article list and states | `content_writer_profiles` |
| `paymentRequests` / `payments` / `upgradeRequests` | admin payment records | `admin_payments` |
| `nicheSubmissions` / `niches` / `userNiches` | admin niche submissions | `admin_niches` |
| `affiliates` / `affiliateUsers` / `referrals` | affiliate records | `admin_affiliates` |

### 3. Authentication impact

Firebase Authentication is used for:
- email/password signup and sign-in
- Google OAuth popup sign-in
- session persistence via Firebase auth state listeners
- ID token issuance for backend API authorization

MySQL migration should preserve user identity through a new auth service. If the product still needs social login, the backend can issue its own JWTs or integrate with an existing identity provider. The current Firebase-specific token verification logic should be retired.

### 4. Implementation strategy

1. Introduce MySQL schema and backend data access layer.
2. Replace Firestore helper functions with MySQL repository functions.
3. Introduce new API routes or update existing routes to use MySQL.
4. Replace Firebase client auth with a MySQL-aware auth flow.
5. Migrate existing data from Firestore into MySQL.
6. Validate parity and cut over traffic.

## Suggested MySQL schema

```sql
CREATE TABLE users (
  id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'email',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE user_projects (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  project_data JSON NOT NULL,
  selected_project_id VARCHAR(255) NULL,
  deleted_project_ids JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_user_project (user_id, project_id),
  KEY idx_user_projects_user_id (user_id)
);
```

## Files to modify first

High priority:
- [functions/_lib/firebase-rest.js](functions/_lib/firebase-rest.js)
- [functions/api/projects.js](functions/api/projects.js)
- [functions/api/api-settings.js](functions/api/api-settings.js)
- [functions/api/gsc-token.js](functions/api/gsc-token.js)
- [functions/api/stripe-connect.js](functions/api/stripe-connect.js)
- [functions/_handlers/proxy.js](functions/_handlers/proxy.js)
- [functions/_handlers/webmaster-api.js](functions/_handlers/webmaster-api.js)
- [src/lib/firebase.js](src/lib/firebase.js)
- [src/lib/auth.js](src/lib/auth.js)
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx)

Medium priority:
- [src/pages/content/ContentWriterDashboard.jsx](src/pages/content/ContentWriterDashboard.jsx)
- [src/pages/content/SemanticContentWriter.jsx](src/pages/content/SemanticContentWriter.jsx)
- [src/lib/firestoreProjects.js](src/lib/firestoreProjects.js)
- [src/hooks/useTechSeoToolResult.js](src/hooks/useTechSeoToolResult.js)
- [src/context/CrawlContext.jsx](src/context/CrawlContext.jsx)

## Risks

- Authentication replacement will change token semantics and may affect existing sessions.
- Storing large tool-result payloads directly in MySQL requires careful JSON size and indexing strategy.
- Admin pages that read Firebase user records need a new user-directory integration.
- Existing Firestore data should be migrated in batches to avoid outages.

## Rollback plan

1. Keep the existing Firestore schema and data intact during the migration window.
2. Deploy the MySQL-backed API behind a feature flag.
3. Switch traffic gradually and keep the old service available until parity is confirmed.
4. Roll back by re-enabling the Firestore-backed code path if any critical issue appears.
