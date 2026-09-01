// Mock URL pool used by the live-crawl simulator.
// Domain-agnostic: paths are generic so they make sense for any project.

const TYPES = [
  { ct: "text/html; charset=utf-8", weight: 60, sizeMin: 40, sizeMax: 90 },
  { ct: "application/xml", weight: 5, sizeMin: 1, sizeMax: 6 },
  { ct: "image/jpeg", weight: 15, sizeMin: 30, sizeMax: 300 },
  { ct: "image/png", weight: 10, sizeMin: 20, sizeMax: 180 },
  { ct: "text/css", weight: 5, sizeMin: 4, sizeMax: 40 },
  { ct: "application/javascript", weight: 5, sizeMin: 6, sizeMax: 120 },
];

// Generic, brand-neutral paths that look believable for almost any site.
const SLUGS = [
  "sitemap.xml",
  "sitemap_index.xml",
  "robots.txt",
  "about/",
  "about/team/",
  "about/careers/",
  "contact/",
  "pricing/",
  "pricing/plans/",
  "features/",
  "features/analytics/",
  "features/automation/",
  "solutions/",
  "solutions/enterprise/",
  "solutions/startups/",
  "services/",
  "services/consulting/",
  "services/onboarding/",
  "products/",
  "products/category-a/",
  "products/category-b/",
  "products/item-101/",
  "products/item-102/",
  "products/item-103/",
  "products/item-104/",
  "products/item-105/",
  "products/item-106/",
  "products/item-107/",
  "products/item-108/",
  "blog/",
  "blog/getting-started/",
  "blog/best-practices/",
  "blog/case-studies/",
  "blog/release-notes/",
  "blog/seo-checklist/",
  "blog/launch-announcement/",
  "docs/",
  "docs/quickstart/",
  "docs/api/",
  "docs/guides/",
  "resources/",
  "resources/whitepaper/",
  "resources/templates/",
  "customers/",
  "customers/case-1/",
  "customers/case-2/",
  "login/",
  "signup/",
  "account/",
  "account/settings/",
  "account/billing/",
  "legal/privacy/",
  "legal/terms/",
  "legal/cookies/",
  "category/news/",
  "category/updates/",
  "tag/launch/",
  "tag/feature/",
  "author/team-blog/",
  "author/team-blog/page/2/",
  "assets/uploads/2024/hero.jpg",
  "assets/uploads/2024/cover.jpg",
  "assets/uploads/2024/og-image.jpg",
  "assets/uploads/2024/logo.png",
  "assets/uploads/2024/icon-192.png",
  "assets/css/main.css",
  "assets/css/theme.css",
  "assets/js/app.js",
  "assets/js/vendor.js",
];

// Deterministic pick using a counter so output is repeatable across reloads.
let counter = 0;
let idCounter = 0;

function pickType() {
  const total = TYPES.reduce((s, t) => s + t.weight, 0);
  let r = (counter * 7) % total;
  for (const t of TYPES) {
    if (r < t.weight) return t;
    r -= t.weight;
  }
  return TYPES[0];
}

function rand(min, max) {
  counter += 1;
  const x = Math.sin(counter * 9999) * 10000;
  const f = x - Math.floor(x);
  return Math.floor(min + f * (max - min));
}

/**
 * Build a normalized base URL from whatever the user typed in the wizard.
 * - strips trailing slashes
 * - prepends https:// if missing
 */
function normalizeBase(domain) {
  if (!domain) return "https://www.example.com";
  let d = String(domain).trim();
  if (!/^https?:\/\//i.test(d)) d = `https://${d}`;
  return d.replace(/\/+$/, "");
}

export function nextUrl(domain = "https://www.example.com") {
  counter += 1;
  idCounter += 1;
  const base = normalizeBase(domain);
  const slug = SLUGS[counter % SLUGS.length];
  const type = pickType();

  // Mostly 200, occasional 3xx / 4xx for realism.
  const dice = counter % 23;
  let status = 200;
  if (dice === 17) status = 301;
  else if (dice === 19) status = 302;
  else if (dice === 22) status = 404;

  return {
    // Stable, monotonically-increasing id so React keys never collide.
    id: `crawl-${idCounter}`,
    time: new Date(),
    url: `${base}/${slug}`,
    status,
    contentType: type.ct,
    loadTime: rand(35, 220), // ms
    sizeKb: rand(type.sizeMin, type.sizeMax) + (counter % 10) / 10,
    outlinks: type.ct.startsWith("text/html") ? rand(8, 95) : 0,
  };
}

export function resetCounter() {
  counter = 0;
  // Don't reset idCounter — keeping it monotonic across resets ensures
  // that React keys never get reused for different URLs.
}
