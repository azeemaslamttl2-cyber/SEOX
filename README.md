# SEOX — SEO SaaS Homepage

A premium, animated homepage for **SEOX**, an AI-native SEO SaaS. Built with React, Vite, TailwindCSS, Framer Motion and Lucide icons. Orange-themed dark UI with glassmorphism, animated audit demo, comparison tables, pricing, testimonials, FAQ and a high-converting CTA.

## ✨ Highlights

- **Animated Hero** with floating gradient orbs and a live mini-dashboard preview
- **Live E-E-A-T Audit Scanner** with auto-running progress bars and result rows
- **Brand marquee** of inspiration sources (Ahrefs, SEMrush, Moz, Surfer SEO…)
- **Animated stats counters** (active marketers, sites audited, traffic lift)
- **12 feature cards** in a tilt-on-hover grid covering NLP, AEO, schema and more
- **Issues vs Solutions** dual comparison panel with auto-fix arrow
- **3-step Workflow** explainer (Audit → Strategy → Rankings)
- **Testimonials grid** with rating stars
- **Pricing** with monthly/yearly toggle and 20% savings indicator
- **Animated FAQ accordion**
- **High-impact CTA** + premium footer with newsletter and status pill

## 🚀 Quickstart

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## 📦 Build

```bash
npm run build
npm run preview
```

## Cloudflare Pages

Cloudflare Pages is the production deployment target. It serves the Vite app
from `dist` and the backend routes from `functions/api`.

```bash
npm run cloudflare:dev
npm run cloudflare:deploy
```

See [CLOUDFLARE.md](CLOUDFLARE.md) for build settings, environment variables,
and route verification.

## Project details API

Apply [`migration/mysql/20260804_add_admin_token_hash.sql`](migration/mysql/20260804_add_admin_token_hash.sql)
before using the endpoint. It adds `users.admin_token` for administrator API access.

```
GET /api/project-details?admin_token=<token>&project_id=<project-id>
```

The API returns `project_id`, `project_data`, `full_url`, and `project_name`.

To create or update a project, send a `POST` request to:

```
POST /api/add-project-detail
```

The POST body should include `admin_token`, `project_id`, `project_name`,
`full_url`, and optional `project_data`.

It returns `401` for an invalid token, `404` for a missing project, `400` for
missing/invalid input, and `500` for unexpected server errors.

For an Express server, register the same route with:

```js
import express from 'express';
import { registerProjectDetailsRoute } from './server/project-details-api.js';

const app = express();
registerProjectDetailsRoute(app);
app.listen(3000);
```

## 🎨 Design system

- **Brand color**: Tailwind `brand` palette (orange 50–900, primary `#f97316`)
- **Surface**: deep ink near-black (`ink-900` `#08080b`)
- **Typography**: Inter for body, Space Grotesk for display
- **Effects**: `gradient-text`, `feature-card`, `glass`, `grid-bg`, custom animations (`float`, `gradient-x`, `scroll-x`, `glow`)

## 🗂 Project structure

```
src/
├─ App.jsx
├─ index.css
├─ main.jsx
└─ components/
   ├─ Navbar.jsx        Sticky glassy nav with upgrade CTA
   ├─ Hero.jsx          Headline + dashboard preview
   ├─ Brands.jsx        Marquee of inspiration brands
   ├─ AuditDemo.jsx     Live E-E-A-T scanner
   ├─ Stats.jsx         Animated counters
   ├─ Features.jsx      12 feature cards
   ├─ Comparison.jsx    Issues vs Solutions
   ├─ Workflow.jsx      3-step workflow
   ├─ Testimonials.jsx  Customer reviews
   ├─ Pricing.jsx       3-tier pricing with toggle
   ├─ FAQ.jsx           Accordion
   ├─ CTA.jsx           Final conversion section
   ├─ Footer.jsx        Links, social, newsletter
   └─ Logo.jsx           SVG mark
```

## 🧠 Notes

- All animations use `framer-motion` with `viewport={{ once: true }}` for performance.
- All sections are responsive (mobile → wide desktop).
- Color scheme is fully orange + amber — no teal/cyan from the original mockups.
