# Cloudflare Pages deployment

Cloudflare Pages is the deployment target for the React app and all existing
`/api/*` routes. Pages Functions live under `functions/api`, with shared
server-side handlers and runtime helpers kept inside `functions`.

## Cloudflare build settings

- Framework preset: `React (Vite)`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: leave blank

The checked-in `wrangler.jsonc` sets the Pages output directory and enables the
Node.js compatibility layer required by the shared handler adapter and Stripe.
If the Pages project is not named `seox`, update the `name` value before using
the Wrangler deployment command.

## Environment variables

Add these in **Workers & Pages > your project > Settings > Variables and
Secrets** for both Production and Preview where appropriate.

Public Vite build variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_ADMIN_API_BASE
```

`VITE_ADMIN_API_BASE` is optional. Leave it blank when the frontend and Pages
Functions are served from the same Cloudflare Pages project. It is useful only
when a separate frontend origin needs to call the Pages Functions origin.

Server secrets:

```text
DEEPSEEK_API_KEY
PAGESPEED_API_KEY
DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD
FIREBASE_SERVICE_ACCOUNT_KEY
STRIPE_SECRET_KEY
AUTH_JWT_SECRET
```

`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` power keyword tools and the
DataForSEO-backed Brand Radar API calls. Users can still provide credentials in
the app for local testing, but server secrets are preferred for production.

Server configuration:

```text
FIREBASE_PROJECT_ID
ADMIN_EMAILS
APP_URL
AUTH_JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_AUTH_REDIRECT_URI
ADMIN_PAYMENTS_COLLECTION
ADMIN_NICHES_COLLECTION
ADMIN_AFFILIATES_COLLECTION
```

`FIREBASE_PROJECT_ID` must match `VITE_FIREBASE_PROJECT_ID` and the
`project_id` in the service-account JSON.

`FIREBASE_SERVICE_ACCOUNT_KEY` should contain the complete service-account JSON
as one secret. As an alternative, configure `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` separately.

`APP_URL` should be the production origin, for example
`https://aismart.thetowertech.com`. It may be omitted for initial testing because the
Stripe route falls back to the request origin.

`AUTH_JWT_SECRET` must be the same random value used by the login and API
functions, and must be at least 32 characters. If it changes, users must sign
in again because existing sessions become invalid.

For Google login in production, set `APP_URL` to the public site origin, for
example `https://aismart.thetowertech.com`, and register this callback URL in
Google Cloud Console:

```text
https://aismart.thetowertech.com/api/auth/google/callback
```

Do not set `GOOGLE_AUTH_REDIRECT_URI` or `GOOGLE_OAUTH_REDIRECT_URI` to a
`localhost` or `127.0.0.1` URL in the Production environment.

Do not prefix server-only variables with `VITE_`. Vite-prefixed values are
embedded in the browser bundle.

## Local verification

Copy `.dev.vars.example` to `.dev.vars`, add development secrets, then run:

```bash
npm run cloudflare:dev
```

Wrangler serves the built frontend and Pages Functions together, normally at
`http://localhost:8788`.

## Deployment

For Git-connected deployments, use the build settings above. For a direct
Wrangler deployment, run:

```bash
npm run cloudflare:deploy
```

After deployment, test login, AI tools, PageSpeed, URL proxying, crawling,
admin data, and Stripe Connect on the generated `pages.dev` domain and the
production custom domain.

## Route mapping

```text
/api/deepseek
/api/proxy
/api/pagespeed
/api/fetch-url-meta
/api/check-redirects
/api/crawler/fetch
/api/admin-data
/api/admin-stripe
/api/stripe-connect
```

The first six routes use shared Node-style handlers through a Pages adapter.
Administrative Firebase operations use Firebase Authentication and Firestore
REST APIs, and Stripe uses its fetch-based HTTP client.
