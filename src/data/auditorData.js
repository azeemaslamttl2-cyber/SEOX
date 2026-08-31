// Mock data shaped after a real site audit (inspired by the reference dashboard).
import { issueSlug } from "../lib/auditIssues.js";

export const project = {
  id: "crawlus",
  name: "Crawlus",
  domain: "www.crawlus.com",
  fullUrl: "https://www.crawlus.com",
  crawledOn: "13 May 2026",
  compareTo: "6 May 2026",
  totalUrls: 1615,
  urlLimit: 10000,
  auditScale: 1,
};

export const defaultProjects = [];

export const crawledUrls = {
  total: 1615,
  segments: [
    { label: "Internal", value: 225, color: "#df3c27" }, // brand-500
    { label: "Resources", value: 1390, color: "#60a5fa" }, // blue-400
  ],
};

export const crawlStatus = {
  total: 13524,
  segments: [
    { label: "Crawled", value: 12424, color: "#34d399" }, // emerald-400
    { label: "Uncrawled", value: 1100, color: "#52525b" }, // zinc-600
  ],
};

export const errorDistribution = {
  total: 1619,
  segments: [
    { label: "URLs without errors", value: 1527, color: "#34d399" },
    { label: "URLs with errors", value: 92, color: "#f43f5e" }, // rose-500
  ],
};

export const issuesDistribution = {
  total: 695,
  rows: [
    { label: "Errors", value: 92, max: 600, color: "from-rose-500 to-rose-400" },
    { label: "Warnings", value: 93, max: 600, color: "from-amber-500 to-amber-300" },
    { label: "Notices", value: 510, max: 600, color: "from-brand-500 to-amber-400" },
  ],
};

export const healthScore = {
  score: 94,
  grade: "Excellent",
  trend: [82, 84, 83, 85, 87, 86, 88, 89, 87, 90, 91, 92, 93, 94, 94, 93, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94, 94],
  dates: ["18 Mar", "1 Apr", "8 Apr", "15 Apr", "22 Apr", "13 May"],
};

// HTTP status codes distribution (Image 1)
export const httpStatusCodes = {
  total: 2763,
  segments: [
    { label: "Success (2xx)", value: 1873, color: "#34d399" },
    { label: "Redirect (3xx)", value: 890, color: "#facc15" },
  ],
};

// AI content level distribution (Image 1 - disabled/no data)
export const aiContentLevel = {
  enabled: false,
  label: "Disabled",
};

// HTTP status codes by depth level (Image 1)
export const httpStatusByDepth = [
  { depth: 0, success: 100, redirect: 50 },
  { depth: 1, success: 300, redirect: 150 },
  { depth: 2, success: 500, redirect: 350 },
  { depth: 3, success: 300, redirect: 50 },
  { depth: 4, success: 200, redirect: 600 },
  { depth: 5, success: 500, redirect: 200 },
  { depth: 6, success: 0, redirect: 0 },
];

// Bulk export summary (Image 2)
export const bulkExportSummary = [
  { name: "Internal URLs", desc: "All crawled internal URLs. Includes non-200 pages and resources.", count: 2763 },
  { name: "Uncrawled links", desc: "Links to URLs that our crawler didn't crawl. This could be due to your project settings or website restrictions like robots.txt.", count: 5911 },
  { name: "Anchor texts", desc: "Anchor texts of all hyperlinks found during the crawl.", count: 48367 },
  { name: "Image references without alt texts", desc: "All image references without alt texts found during the crawl.", count: 775 },
  { name: "Links to URLs blocked by robots.txt", desc: "Links to all URLs that our crawler could not access because of instructions in robots.txt.", count: 3 },
  { name: "Links to 4xx (Client error) URLs", desc: "Links to URLs returning client error codes, which means that there was a problem with the request.", count: 0 },
];

export const SEVERITY = {
  error: {
    label: "Error",
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    dotBg: "bg-rose-500",
  },
  warning: {
    label: "Warning",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    dotBg: "bg-amber-400",
  },
  notice: {
    label: "Notice",
    color: "text-sky-400",
    bg: "bg-sky-500/15",
    border: "border-sky-500/30",
    dotBg: "bg-sky-400",
  },
};

// Random-ish sparkline helper (deterministic by seed-ish length)
const spark = (vals) => vals;

// Issue rows
export const whatsNew = [
  {
    slug: "noindex-page-sitemap",
    severity: "error",
    title: "Noindex page in sitemap",
    isNew: true,
    crawled: 2,
    change: 2,
    added: 2,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 1, 2]),
    fixable: true,
  },
  {
    slug: "3xx-redirect-sitemap",
    severity: "error",
    title: "3XX redirect in sitemap",
    isNew: true,
    crawled: 1,
    change: 1,
    added: 1,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 0, 1]),
    fixable: true,
  },
  {
    slug: "multiple-meta-description-tags",
    severity: "error",
    title: "Multiple meta description tags",
    crawled: 84,
    change: 65,
    added: 73,
    new: 0,
    removed: 0,
    missing: 8,
    spark: spark([22, 28, 24, 19, 84]),
    fixable: true,
  },
  {
    slug: "og-tags-incomplete",
    severity: "warning",
    title: "Open Graph tags incomplete",
    isNew: true,
    crawled: 22,
    change: 22,
    added: 22,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 0, 22]),
  },
  {
    slug: "twitter-card-incomplete",
    severity: "warning",
    title: "X (Twitter) card incomplete",
    isNew: true,
    crawled: 22,
    change: 22,
    added: 22,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 0, 22]),
  },
  {
    slug: "meta-description-missing",
    severity: "warning",
    title: "Meta description tag missing or empty",
    isNew: true,
    crawled: 9,
    change: 9,
    added: 9,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 0, 9]),
    fixable: true,
  },
  {
    slug: "page-has-broken-css",
    severity: "warning",
    title: "Page has broken CSS",
    crawled: 3,
    change: 3,
    added: 3,
    new: 0,
    removed: 0,
    missing: 0,
    spark: spark([0, 0, 0, 0, 3]),
  },
];

export const topIssues = [
  {
    slug: "multiple-meta-description-tags",
    severity: "error",
    title: "Multiple meta description tags",
    crawled: 84,
    change: 65,
    added: 73,
    new: 0,
    removed: 0,
    missing: 8,
    spark: spark([22, 28, 24, 19, 84]),
    fixable: true,
  },
  {
    slug: "og-tags-incomplete",
    severity: "warning",
    title: "Open Graph tags incomplete",
    crawled: 22,
    change: 22,
    added: 22,
    spark: spark([0, 0, 0, 0, 22]),
  },
  {
    slug: "twitter-card-incomplete",
    severity: "warning",
    title: "X (Twitter) card incomplete",
    crawled: 22,
    change: 22,
    added: 22,
    spark: spark([0, 0, 0, 0, 22]),
  },
];

// Categorized issues for the All Issues page
// Updated to match tracked issue screenshots (Images 3-10)
export const issueCategories = [
  {
    title: "Internal pages",
    items: [
      { severity: "error", title: "404 page", crawled: 0, change: 0 },
      { severity: "error", title: "4XX page", crawled: 0, change: 0 },
      { severity: "error", title: "500 page", crawled: 0, change: 0 },
      { severity: "error", title: "5XX page", crawled: 0, change: 0 },
      { severity: "error", title: "Timed out", crawled: 0, change: 0 },
      { severity: "warning", title: "HTTPS/HTTP mixed content", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Indexability",
    items: [
      { severity: "error", title: "Canonical points to redirect", fixable: true, crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "error", title: "Canonical points to 4XX", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Canonical points to 5XX", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Page size exceeds Googlebot's 2 MB crawl limit", crawled: 0, change: 0 },
      { severity: "warning", title: "Nofollow page", fixable: true, crawled: 20, change: 0, spark: [18, 19, 20, 20, 20] },
      { severity: "warning", title: "Noindex page", fixable: true, crawled: 10, change: 0, spark: [8, 9, 10, 10, 10], slug: "noindex-page" },
      { severity: "warning", title: "Non-canonical page specified as canonical one", fixable: true, crawled: 5, change: 0, spark: [4, 4, 5, 5, 5] },
      { severity: "warning", title: "Nofollow in HTML and HTTP header", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "Noindex in HTML and HTTP header", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "Noindex follow page", fixable: true, crawled: 7, change: 0, spark: [5, 6, 7, 7, 7] },
      { severity: "warning", title: "Noindex and nofollow page", fixable: true, crawled: 3, change: 0, spark: [2, 2, 3, 3, 3] },
      { severity: "notice", title: "Canonical from HTTP to HTTPS", crawled: 0, change: 0 },
      { severity: "notice", title: "Canonical from HTTPS to HTTP", crawled: 0, change: 0 },
      { severity: "notice", title: "Canonical URL changed", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "Indexable page became non-indexable", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "Noindex page became indexable", fixable: true, crawled: 0, change: 0 },
    ],
  },
  {
    title: "Links",
    subgroups: [
      {
        label: "INDEXABLE",
        items: [
          { severity: "error", title: "Canonical URL has no incoming internal links", fixable: true, crawled: 11, change: 0, spark: [9, 10, 11, 11, 11] },
          { severity: "error", title: "Orphan page (has no incoming internal links)", crawled: 11, change: 0, spark: [9, 10, 11, 11, 11] },
          { severity: "error", title: "HTTPS page has internal links to HTTP", crawled: 0, change: 0 },
          { severity: "error", title: "Page has links to broken page", crawled: 0, change: 0 },
          { severity: "error", title: "Page has no outgoing links", crawled: 0, change: 0 },
          { severity: "warning", title: "Page has links to redirect", crawled: 147, change: 0, spark: [140, 143, 145, 147, 147] },
          { severity: "warning", title: "Page has nofollow incoming internal links only", crawled: 0, change: 0 },
          { severity: "warning", title: "Redirected page has no incoming internal links", crawled: 0, change: 0 },
          { severity: "notice", title: "Page has nofollow outgoing internal links", crawled: 147, change: 0, spark: [140, 143, 145, 147, 147] },
          { severity: "notice", title: "Page has only one dofollow incoming internal link", crawled: 19, change: 0, spark: [16, 17, 18, 19, 19] },
          { severity: "notice", title: "Page has nofollow and dofollow incoming internal links", crawled: 16, change: 0, spark: [13, 14, 15, 16, 16] },
          { severity: "notice", title: "HTTP page has internal links to HTTPS", crawled: 0, change: 0 },
        ],
      },
      {
        label: "NOT INDEXABLE",
        items: [
          { severity: "warning", title: "HTTPS page has internal links to HTTP", crawled: 0, change: 0 },
          { severity: "warning", title: "Orphan page (has no incoming internal links)", crawled: 0, change: 0 },
          { severity: "warning", title: "Page has links to broken page", crawled: 0, change: 0 },
          { severity: "warning", title: "Page has no outgoing links", crawled: 0, change: 0 },
          { severity: "notice", title: "Page has links to redirect", crawled: 969, change: 0, spark: [920, 940, 955, 969, 969] },
          { severity: "notice", title: "Page has nofollow outgoing internal links", crawled: 969, change: 0, spark: [920, 940, 955, 969, 969] },
          { severity: "notice", title: "Redirected page has no incoming internal links", crawled: 867, change: 0, spark: [820, 840, 855, 867, 867] },
          { severity: "notice", title: "Page has only one dofollow incoming internal link", crawled: 8, change: 0, spark: [6, 7, 8, 8, 8] },
          { severity: "notice", title: "Page has nofollow and dofollow incoming internal links", crawled: 7, change: 0, spark: [5, 6, 7, 7, 7] },
          { severity: "notice", title: "HTTP page has internal links to HTTPS", crawled: 0, change: 0 },
          { severity: "notice", title: "Page has nofollow incoming internal links only", crawled: 0, change: 0 },
        ],
      },
    ],
  },
  {
    title: "Redirects",
    items: [
      { severity: "error", title: "Broken redirect", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Redirect chain too long", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Redirect loop", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "3XX redirect", fixable: true, crawled: 890, change: 0, spark: [845, 860, 875, 890, 890] },
      { severity: "warning", title: "302 redirect", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "HTTPS to HTTP redirect", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "HTTP to HTTPS redirect", crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "notice", title: "Meta refresh redirect", crawled: 0, change: 0 },
      { severity: "notice", title: "Redirect chain", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "Redirect target changed", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Content",
    subgroups: [
      {
        label: "INDEXABLE",
        items: [
          { severity: "error", title: "Multiple meta description tags", fixable: true, crawled: 0, change: 0 },
          { severity: "error", title: "Multiple title tags", fixable: true, crawled: 0, change: 0 },
          { severity: "error", title: "Title tag missing or empty", fixable: true, crawled: 0, change: 0 },
          { severity: "warning", title: "Title too long", fixable: true, crawled: 64, change: 0, spark: [55, 58, 61, 64, 64] },
          { severity: "notice", title: "Meta description too long", fixable: true, crawled: 11, change: 0, spark: [8, 9, 10, 11, 11] },
          { severity: "notice", title: "Meta description tag missing or empty", fixable: true, crawled: 7, change: 0, spark: [5, 6, 7, 7, 7] },
          { severity: "notice", title: "H1 tag missing or empty", crawled: 6, change: 0, spark: [4, 5, 6, 6, 6] },
          { severity: "notice", title: "Meta description too short", fixable: true, crawled: 4, change: 0, spark: [2, 3, 4, 4, 4] },
          { severity: "notice", title: "Low word count", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Title too short", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Multiple H1 tags", crawled: 83, change: 0, spark: [75, 78, 81, 83, 83] },
          { severity: "notice", title: "Page and SERP titles do not match", fixable: true, crawled: 79, change: 0, added: 1, missing: 1, spark: [70, 73, 76, 79, 79] },
          { severity: "notice", title: "H1 tag changed", fixable: true, crawled: 1, change: -6, spark: [7, 5, 3, 2, 1] },
          { severity: "notice", title: "Meta description changed", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Pages have high AI content levels", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "SERP title changed", fixable: true, crawled: 0, change: -1, spark: [2, 1, 1, 1, 0] },
          { severity: "notice", title: "Title tag changed", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Word count changed", fixable: true, crawled: 0, change: 0 },
        ],
      },
      {
        label: "NOT INDEXABLE",
        items: [
          { severity: "notice", title: "Meta description tag missing or empty", fixable: true, crawled: 21, change: 0, spark: [18, 19, 20, 21, 21] },
          { severity: "notice", title: "Multiple meta description tags", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Multiple title tags", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Title tag missing or empty", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Title too long", fixable: true, crawled: 59, change: 0, spark: [50, 53, 56, 59, 59] },
          { severity: "notice", title: "H1 tag missing or empty", crawled: 28, change: 0, spark: [22, 24, 26, 28, 28] },
          { severity: "notice", title: "Meta description too short", fixable: true, crawled: 14, change: 0, spark: [10, 11, 13, 14, 14] },
          { severity: "notice", title: "Multiple H1 tags", crawled: 8, change: 0, spark: [6, 7, 8, 8, 8] },
          { severity: "notice", title: "Meta description too long", fixable: true, crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
          { severity: "notice", title: "Low word count", fixable: true, crawled: 0, change: 0 },
          { severity: "notice", title: "Title too short", fixable: true, crawled: 0, change: 0 },
        ],
      },
    ],
  },
  {
    title: "Social tags",
    items: [
      { severity: "warning", title: "Open Graph URL not matching canonical", fixable: true, crawled: 50, change: 0, spark: [42, 45, 48, 50, 50] },
      { severity: "warning", title: "Open Graph tags incomplete", crawled: 2, change: 0, spark: [1, 1, 2, 2, 2] },
      { severity: "notice", title: "X (Twitter) card incomplete", crawled: 0, change: 0 },
      { severity: "notice", title: "Open Graph tags missing", crawled: 0, change: 0 },
      { severity: "notice", title: "X (Twitter) card missing", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Duplicates",
    items: [
      { severity: "error", title: "Duplicate pages without canonical", fixable: true, crawled: 0, change: 0 },
    ],
  },
  {
    title: "Localization",
    items: [
      { severity: "error", title: "Hreflang and HTML lang mismatch", crawled: 0, change: 0 },
      { severity: "error", title: "Hreflang annotation invalid", crawled: 0, change: 0 },
      { severity: "error", title: "Hreflang to non-canonical", crawled: 0, change: 0 },
      { severity: "error", title: "Hreflang to redirect or broken page", crawled: 0, change: 0 },
      { severity: "error", title: "HTML lang attribute invalid", crawled: 0, change: 0 },
      { severity: "error", title: "Missing reciprocal hreflang (no return-tag)", crawled: 0, change: 0 },
      { severity: "error", title: "More than one page for same language in hreflang", crawled: 0, change: 0 },
      { severity: "error", title: "Page referenced for more than one language in hreflang", crawled: 0, change: 0 },
      { severity: "warning", title: "Hreflang defined but HTML lang missing", crawled: 0, change: 0 },
      { severity: "warning", title: "HTML lang attribute missing", crawled: 0, change: 0 },
      { severity: "notice", title: "Self-reference hreflang annotation missing", crawled: 0, change: 0 },
      { severity: "notice", title: "Not all pages from hreflang group were crawled", crawled: 0, change: 0 },
      { severity: "notice", title: "X-default hreflang annotation missing", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Usability and performance",
    items: [
      { severity: "warning", title: "Slow page", crawled: 912, change: -2, added: 26, removed: 28, spark: [900, 905, 910, 914, 912] },
      { severity: "warning", title: "Content is not sized correctly", crawled: 0, change: 0 },
      { severity: "warning", title: "Document uses plugins", crawled: 0, change: 0 },
      { severity: "warning", title: "Font size too small", crawled: 0, change: 0 },
      { severity: "warning", title: "HTML file size too large", crawled: 0, change: 0 },
      { severity: "warning", title: "Not compressed", crawled: 0, change: 0 },
      { severity: "warning", title: "Page stopped passing CWV requirements", crawled: 0, change: 0 },
      { severity: "warning", title: "Pages with poor CLS", crawled: 0, change: 0 },
      { severity: "warning", title: "Pages with poor FID", crawled: 0, change: 0 },
      { severity: "warning", title: "Pages with poor INP", crawled: 0, change: 0 },
      { severity: "warning", title: "Pages with poor LCP", crawled: 0, change: 0 },
      { severity: "warning", title: "Tap targets too small or too close together", crawled: 0, change: 0 },
      { severity: "warning", title: "Viewport not set", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Images",
    items: [
      { severity: "error", title: "Image file size too large", crawled: 3, change: 0, spark: [1, 2, 3, 3, 3] },
      { severity: "error", title: "Image broken", crawled: 0, change: 0 },
      { severity: "error", title: "Page has broken image", crawled: 0, change: 0 },
      { severity: "warning", title: "Missing alt text", crawled: 402, change: 0, spark: [380, 390, 395, 402, 402] },
      { severity: "warning", title: "HTTPS page links to HTTP image", crawled: 0, change: 0 },
      { severity: "warning", title: "Image redirects", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "Page has redirected image", crawled: 0, change: 0 },
    ],
  },
  {
    title: "JavaScript",
    items: [
      { severity: "error", title: "JavaScript broken", crawled: 0, change: 0 },
      { severity: "error", title: "Page has broken JavaScript", crawled: 0, change: 0 },
      { severity: "warning", title: "JavaScript redirects", fixable: true, crawled: 0, change: 0 },
      { severity: "warning", title: "Page has redirected JavaScript", crawled: 0, change: 0 },
    ],
  },
  {
    title: "CSS",
    items: [
      { severity: "warning", title: "CSS file size too large", crawled: 13, change: 2, added: 3, missing: 1, spark: [8, 9, 11, 11, 13] },
      { severity: "notice", title: "CSS broken", crawled: 0, change: 0 },
      { severity: "notice", title: "CSS redirects", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "HTTPS page links to HTTP CSS", crawled: 0, change: 0 },
      { severity: "notice", title: "Page has broken CSS", crawled: 0, change: 0 },
      { severity: "notice", title: "Page has redirected CSS", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Sitemaps",
    items: [
      { severity: "error", title: "3XX redirect in sitemap", fixable: true, crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "error", title: "Non-canonical page in sitemap", fixable: true, crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "error", title: "4XX page in sitemap", crawled: 0, change: 0 },
      { severity: "error", title: "5XX page in sitemap", crawled: 0, change: 0 },
      { severity: "error", title: "Noindex page in sitemap", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Page from sitemap timed out", crawled: 0, change: 0 },
      { severity: "error", title: "Sitemap has syntax error", crawled: 0, change: 0 },
      { severity: "error", title: "Sitemap is not accessible", crawled: 0, change: 0 },
      { severity: "error", title: "Sitemap larger than 50MB", crawled: 0, change: 0 },
      { severity: "error", title: "Sitemap with over 50K URLs", crawled: 0, change: 0 },
      { severity: "warning", title: "Sitemap in the wrong format", crawled: 0, change: 0 },
      { severity: "warning", title: "Sitemap includes URLs out of its scope", crawled: 0, change: 0 },
      { severity: "notice", title: "Indexable page not in sitemap", crawled: 51, change: 0, spark: [42, 45, 48, 51, 51] },
      { severity: "notice", title: "Page in multiple sitemaps", crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "notice", title: "No. of URLs in sitemap decreased", crawled: 0, change: 0 },
      { severity: "notice", title: "Pages added to sitemaps", crawled: 0, change: 0 },
      { severity: "notice", title: "Pages removed from sitemaps", crawled: 0, change: 0 },
    ],
  },
  {
    title: "External pages",
    items: [
      { severity: "notice", title: "External 3XX redirect", fixable: true, crawled: 0, change: 0 },
      { severity: "notice", title: "External 4XX", crawled: 0, change: 0 },
      { severity: "notice", title: "External 5XX", crawled: 0, change: 0 },
      { severity: "notice", title: "External time out", crawled: 0, change: 0 },
    ],
  },
  {
    title: "Other",
    items: [
      { severity: "error", title: "3XX page receives organic traffic", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "403 page receives organic traffic", crawled: 0, change: 0 },
      { severity: "error", title: "4XX page receives organic traffic", crawled: 0, change: 0 },
      { severity: "error", title: "Double slash in URL", crawled: 0, change: 0 },
      { severity: "error", title: "Noindex page receives organic traffic", fixable: true, crawled: 0, change: 0 },
      { severity: "error", title: "Robots.txt has syntax error", crawled: 0, change: 0 },
      { severity: "error", title: "Robots.txt has too many redirects or redirect loop", crawled: 0, change: 0 },
      { severity: "error", title: "Robots.txt is not accessible", crawled: 0, change: 0 },
      { severity: "warning", title: "Robots.txt changed", crawled: 0, change: 0 },
      { severity: "notice", title: "Structured data has schema.org validation error", crawled: 88, change: 0, spark: [75, 80, 84, 88, 88] },
      { severity: "notice", title: "Organic traffic dropped", crawled: 12, change: 3, spark: [5, 7, 9, 9, 12] },
      { severity: "notice", title: "Pages dropped from Top 10", crawled: 2, change: -1, spark: [4, 3, 3, 3, 2] },
      { severity: "notice", title: "Structured data has Google rich results validation error", crawled: 2, change: 0, spark: [1, 1, 2, 2, 2] },
      { severity: "notice", title: "No. of referring domains dropped", crawled: 1, change: 0, spark: [0, 0, 0, 1, 1] },
      { severity: "notice", title: "Pages to submit to IndexNow", fixable: true, crawled: 1, change: -6, spark: [7, 5, 3, 2, 1] },
    ],
  },
];

// Issue detail (Noindex page URLs)
export const issueDetail = {
  slug: "noindex-page",
  title: "Noindex page",
  severity: "warning",
  description:
    "These pages return a noindex directive and won't appear in search results. Review whether this is intentional.",
  fixable: true,
  urls: [
    {
      pr: 49,
      title: "Review Your Scaffolding Order ...",
      url: "https://www.scaxa.ae/cart/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "",
    },
    {
      pr: 24,
      title: "Rana Zain - SCAXA",
      url: "https://www.scaxa.ae/author/rana-zain/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "",
    },
    {
      pr: 0,
      title: "My account - SCAXA",
      url: "https://www.scaxa.ae/my-account/lost-password/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "noindex",
    },
    {
      pr: 0,
      title: "Rana Zain - SCAXA - Page 2 of 3",
      url: "https://www.scaxa.ae/author/rana-zain/page/2/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "",
    },
    {
      pr: 0,
      title: "My account - SCAXA",
      url: "https://www.scaxa.ae/my-account/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "",
    },
    {
      pr: 0,
      title: "Rana Zain - SCAXA - Page 3 of 3",
      url: "https://www.scaxa.ae/author/rana-zain/page/3/",
      traffic: 0,
      status: 200,
      indexable: false,
      noindex: true,
      nofollow: false,
      robots: ["follow", "noindex"],
      headers: "",
    },
  ],
};

const ORIGINAL_AUDIT_ORIGIN = "https://www.scaxa.ae";
const COUNT_KEYS = new Set([
  "total",
  "value",
  "crawled",
  "change",
  "added",
  "new",
  "removed",
  "missing",
]);

export function projectBaseUrl(selectedProject = project) {
  const raw = selectedProject?.fullUrl || selectedProject?.domain || project.fullUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return project.fullUrl;
  }
}

export function projectHost(selectedProject = project) {
  try {
    return new URL(projectBaseUrl(selectedProject)).hostname;
  } catch {
    return selectedProject?.domain || selectedProject?.name || project.name;
  }
}

export function projectIdFor(selectedProject = project) {
  if (selectedProject?.id) return selectedProject.id;
  return projectHost(selectedProject).replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-");
}

export function normalizeProject(selectedProject = project) {
  const baseUrl = projectBaseUrl(selectedProject);
  const host = projectHost(selectedProject);
  return {
    ...selectedProject,
    id: projectIdFor(selectedProject),
    name: selectedProject?.name || host.replace(/^www\./, ""),
    domain: selectedProject?.domain || host,
    fullUrl: baseUrl,
    crawledOn: selectedProject?.crawledOn || project.crawledOn,
    compareTo: selectedProject?.compareTo || project.compareTo,
    totalUrls: selectedProject?.totalUrls || project.totalUrls,
    urlLimit: selectedProject?.urlLimit || project.urlLimit,
  };
}

export function replaceAuditUrl(url, selectedProject = project) {
  if (!url || typeof url !== "string") return url;
  try {
    const source = new URL(url, ORIGINAL_AUDIT_ORIGIN);
    const selected = new URL(projectBaseUrl(selectedProject));
    if (
      source.hostname === "www.scaxa.ae" ||
      source.hostname === "scaxa.ae"
    ) {
      return `${selected.origin}${source.pathname}${source.search}${source.hash}`;
    }
  } catch {
    /* leave malformed/non-URL strings alone */
  }
  return url;
}

export function brandNameFor(selectedProject = project) {
  const host = projectHost(selectedProject).replace(/^www\./, "");
  const [brand] = host.split(".");
  if (!brand) return "Site";
  return brand
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function localizeAuditText(value, selectedProject = project) {
  if (typeof value !== "string") return value;
  const host = projectHost(selectedProject).replace(/^www\./, "");
  const brand = brandNameFor(selectedProject);
  return value
    .replace(/https:\/\/www\.scaxa\.ae/g, projectBaseUrl(selectedProject))
    .replace(/www\.scaxa\.ae/g, projectHost(selectedProject))
    .replace(/scaxa\.ae/g, host)
    .replace(/SCAXA/g, brand.toUpperCase())
    .replace(/Scaxa/g, brand)
    .replace(/scaxa/g, brand.toLowerCase());
}

export function localizeAuditValue(value, selectedProject = project) {
  if (Array.isArray(value)) {
    return value.map((item) => localizeAuditValue(item, selectedProject));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        localizeAuditValue(item, selectedProject),
      ])
    );
  }
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return replaceAuditUrl(value, selectedProject);
  }
  return localizeAuditText(value, selectedProject);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function projectScale(selectedProject) {
  if (typeof selectedProject?.auditScale === "number") return selectedProject.auditScale;
  const seed = projectIdFor(selectedProject)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 0.65 + (seed % 70) / 100;
}

function scaleCount(value, factor) {
  if (typeof value !== "number" || value === 0) return value;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.max(1, Math.round(Math.abs(value) * factor));
}

function scaleIssueRow(row, factor) {
  const scaled = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      COUNT_KEYS.has(key) ? scaleCount(value, factor) : value,
    ])
  );
  return { ...scaled, slug: issueSlug(scaled) };
}

function scaleIssueCategories(categories, factor) {
  return categories.map((category) => {
    if (category.subgroups) {
      return {
        ...category,
        subgroups: category.subgroups.map((group) => ({
          ...group,
          items: group.items.map((item) => scaleIssueRow(item, factor)),
        })),
      };
    }
    return {
      ...category,
      items: category.items.map((item) => scaleIssueRow(item, factor)),
    };
  });
}

function issueSpark(count) {
  if (!count) return [0, 0, 0, 0, 0];
  return [
    Math.max(0, Math.round(count * 0.15)),
    Math.max(0, Math.round(count * 0.35)),
    Math.max(0, Math.round(count * 0.6)),
    Math.max(0, Math.round(count * 0.82)),
    count,
  ];
}

function applyRealIssueFindings(row, auditIssues) {
  const slug = issueSlug(row);
  const finding = auditIssues?.[slug];
  const urls = filterIssueEvidence(slug, finding?.urls || []);
  const count = urls.length;
  return {
    ...row,
    slug,
    severity: finding?.severity || row.severity,
    title: finding?.title || row.title,
    fixable: finding?.fixable ?? row.fixable,
    crawled: count,
    change: count,
    added: count,
    new: row.new && count ? row.new : 0,
    removed: 0,
    missing: row.missing && count ? row.missing : 0,
    isNew: count > 0,
    spark: issueSpark(count),
    urls,
  };
}

function filterIssueEvidence(slug, urls) {
  if (!Array.isArray(urls)) return [];
  const withoutExcludedUrls = urls.filter((item) => !isExcludedIssueEvidenceUrl(item?.url));
  if (!slug.includes("title")) return withoutExcludedUrls;
  return withoutExcludedUrls.filter((item) => {
    const status = Number(item?.status || 0);
    return status >= 200 && status < 300 && item?.indexable !== false;
  });
}

function isExcludedIssueEvidenceUrl(value = "") {
  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();
    return pathname.startsWith("/wp-json/") || pathname === "/xmlrpc.php";
  } catch {
    return false;
  }
}

function categoriesWithRealIssues(categories, auditIssues) {
  return categories.map((category) => {
    if (category.subgroups) {
      return {
        ...category,
        subgroups: category.subgroups.map((group) => ({
          ...group,
          items: group.items.map((item) => applyRealIssueFindings(item, auditIssues)),
        })),
      };
    }
    return {
      ...category,
      items: category.items.map((item) => applyRealIssueFindings(item, auditIssues)),
    };
  });
}

function flattenIssueCategories(categories) {
  return categories.flatMap((category) =>
    category.subgroups
      ? category.subgroups.flatMap((group) => group.items)
      : category.items
  );
}

function issueDistributionFromRows(rows) {
  const uniqueRows = Array.from(
    new Map(rows.map((row) => [row.slug || issueSlug(row), row])).values()
  );
  const counts = uniqueRows.reduce(
    (acc, row) => {
      acc[row.severity] = (acc[row.severity] || 0) + (row.crawled || 0);
      return acc;
    },
    { error: 0, warning: 0, notice: 0 }
  );
  const total = counts.error + counts.warning + counts.notice;
  const max = Math.max(total, 1);
  return {
    total,
    rows: [
      { label: "Errors", value: counts.error, max, color: "from-rose-500 to-rose-400" },
      { label: "Warnings", value: counts.warning, max, color: "from-amber-500 to-amber-300" },
      { label: "Notices", value: counts.notice, max, color: "from-brand-500 to-amber-400" },
    ],
  };
}

function realIssueTables(auditIssues) {
  const issueCategoriesWithCounts = categoriesWithRealIssues(issueCategories, auditIssues);
  const allRows = flattenIssueCategories(issueCategoriesWithCounts);
  const activeRows = Array.from(
    new Map(allRows.map((row) => [row.slug || issueSlug(row), row])).values()
  )
    .filter((row) => (row.crawled || 0) > 0)
    .sort((a, b) => {
      const severityRank = { error: 0, warning: 1, notice: 2 };
      return (
        (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3) ||
        (b.crawled || 0) - (a.crawled || 0)
      );
    });

  return {
    issueCategories: issueCategoriesWithCounts,
    whatsNew: activeRows.slice(0, 8),
    topIssues: activeRows.slice(0, 3),
    issuesDistribution: issueDistributionFromRows(allRows),
  };
}

function auditorContentType(row) {
  const ct = String(row?.contentType || "").toLowerCase();
  const path = (() => {
    try {
      return new URL(row?.url || "").pathname.toLowerCase();
    } catch {
      return String(row?.url || "").toLowerCase();
    }
  })();
  if (/text\/html|application\/xhtml/.test(ct)) return "html";
  if (/image\//.test(ct) || /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)(?:[?#]|$)/i.test(path)) return "image";
  if (/text\/css/.test(ct) || /\.css(?:[?#]|$)/i.test(path)) return "css";
  if (/javascript|ecmascript/.test(ct) || /\.m?js(?:[?#]|$)/i.test(path)) return "javascript";
  if (/xml/.test(ct) || /\.xml(?:[?#]|$)/i.test(path)) return "xml";
  if (!ct && !/\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|avif|bmp|xml|json|woff2?|ttf|eot|pdf|zip)(?:[?#]|$)/i.test(path)) return "html";
  return "other";
}

function httpStatusSegmentsFromRows(rows) {
  const counts = rows.reduce(
    (acc, row) => {
      const status = Number(row.status || 0);
      if (status >= 200 && status < 300) acc.success += 1;
      else if (status >= 300 && status < 400) acc.redirect += 1;
      else if (status >= 400 && status < 500) acc.client += 1;
      else if (status >= 500) acc.server += 1;
      else acc.error += 1;
      return acc;
    },
    { success: 0, redirect: 0, client: 0, server: 0, error: 0 }
  );
  const segments = [
    { label: "Success (2xx)", value: counts.success, color: "#34d399" },
    { label: "Redirect (3xx)", value: counts.redirect, color: "#facc15" },
    { label: "Client error (4xx)", value: counts.client, color: "#df3c27" },
    { label: "Server error (5xx)", value: counts.server, color: "#f43f5e" },
    { label: "Fetch error", value: counts.error, color: "#64748b" },
  ].filter((item) => item.value > 0);
  return {
    total: rows.length,
    segments: segments.length ? segments : [{ label: "No data", value: 0, color: "#64748b" }],
  };
}

function httpStatusByDepthFromRows(rows) {
  const byDepth = new Map();
  rows.forEach((row) => {
    let depth = 0;
    try {
      const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, "");
      depth = Math.min(6, pathname ? pathname.split("/").filter(Boolean).length : 0);
    } catch {
      depth = 0;
    }
    const current = byDepth.get(depth) || { depth, success: 0, redirect: 0 };
    const status = Number(row.status || 0);
    if (status >= 200 && status < 300) current.success += 1;
    if (status >= 300 && status < 400) current.redirect += 1;
    byDepth.set(depth, current);
  });
  return Array.from(byDepth.values()).length
    ? Array.from(byDepth.values()).sort((a, b) => a.depth - b.depth)
    : [{ depth: 0, success: 0, redirect: 0 }];
}

function bulkSummaryFromRows(rows, auditIssues = {}) {
  const html = rows.filter((row) => auditorContentType(row) === "html");
  const links = rows.flatMap((row) => row.links || []);
  const imageRefs = rows.flatMap((row) =>
    (row.resources || []).filter((resource) => {
      const value = typeof resource === "string" ? resource : resource?.url;
      return auditorContentType({ url: value, contentType: "", type: resource?.type }) === "image";
    })
  );
  return [
    { name: "Internal URLs", desc: "All crawled internal URLs. Includes non-200 pages and resources.", count: rows.length },
    { name: "Uncrawled links", desc: "Links to URLs that our crawler didn't crawl. This could be due to your project settings or website restrictions like robots.txt.", count: links.filter((item) => !(typeof item === "string" ? item : item?.status)).length },
    { name: "Anchor texts", desc: "Anchor texts of all hyperlinks found during the crawl.", count: links.filter((item) => typeof item !== "string" && String(item.anchor || "").trim()).length },
    { name: "Image references without alt texts", desc: "All image references without alt texts found during the crawl.", count: Number(auditIssues?.["missing-alt-text"]?.crawled || 0) },
    { name: "Links to URLs blocked by robots.txt", desc: "Links to all URLs that our crawler could not access because of instructions in robots.txt.", count: rows.filter((row) => row.robotsTxtBlocked || row.blockedByRobotsTxt || row.audit?.blockedByRobotsTxt).length },
    { name: "Links to 4xx (Client error) URLs", desc: "Links to URLs returning client error codes, which means that there was a problem with the request.", count: rows.filter((row) => row.status >= 400 && row.status < 500).length },
  ].map((row) => ({
    ...row,
    count: row.name === "Internal URLs" ? rows.length : row.count,
    htmlCount: html.length,
    imageRefs: imageRefs.length,
  }));
}

function emptyLiveAuditData() {
  const realIssueData = realIssueTables({});
  return {
    crawledUrls: {
      total: 0,
      segments: [
        { label: "Internal", value: 0, color: "#df3c27" },
        { label: "Resources", value: 0, color: "#60a5fa" },
      ],
    },
    crawlStatus: {
      total: 0,
      segments: [
        { label: "Crawled", value: 0, color: "#34d399" },
        { label: "Uncrawled", value: 0, color: "#52525b" },
      ],
    },
    errorDistribution: {
      total: 0,
      segments: [
        { label: "URLs without errors", value: 0, color: "#34d399" },
        { label: "URLs with errors", value: 0, color: "#f43f5e" },
      ],
    },
    issuesDistribution: realIssueData.issuesDistribution,
    healthScore: {
      ...healthScore,
      score: 0,
      grade: "No crawl",
      trend: healthScore.trend.map(() => 0),
    },
    whatsNew: [],
    topIssues: [],
    issueCategories: realIssueData.issueCategories,
    httpStatusCodes: { total: 0, segments: [{ label: "No data", value: 0, color: "#64748b" }] },
    httpStatusByDepth: [{ depth: 0, success: 0, redirect: 0 }],
    bulkExportSummary: bulkExportSummary.map((row) => ({ ...row, count: 0 })),
  };
}

function scaleSegments(block, factor) {
  const segments = block.segments.map((segment) => ({
    ...segment,
    value: scaleCount(segment.value, factor),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return { ...block, segments, total };
}

function scaleIssuesDistribution(block, factor) {
  const rows = block.rows.map((row) => ({
    ...row,
    value: scaleCount(row.value, factor),
    max: scaleCount(row.max, factor),
  }));
  return {
    ...block,
    rows,
    total: rows.reduce((sum, row) => sum + row.value, 0),
  };
}

function scaleHealthScore(block, factor) {
  const score = Math.max(
    62,
    Math.min(99, Math.round(block.score - Math.max(0, factor - 1) * 6 + Math.max(0, 1 - factor) * 3))
  );
  const delta = score - block.score;
  return {
    ...block,
    score,
    grade: score >= 90 ? "Excellent" : score >= 75 ? "Good" : "Needs work",
    trend: block.trend.map((value) => Math.max(45, Math.min(100, value + delta))),
  };
}

function liveAuditData(selectedProject, stats) {
  const crawled = Math.max(0, stats?.crawledCount || 0);
  if (!crawled) return null;

  const latestRows = stats?.latestUrls || [];
  const byStatus = stats?.byStatus || {};
  const errors = (byStatus["4xx"] || 0) + (byStatus["5xx"] || 0);
  const redirects = byStatus["3xx"] || 0;
  const warnings = redirects + Math.ceil(errors * 0.8);
  const notices = Math.max(0, Math.round(crawled * 0.08));
  const realIssueData = realIssueTables(stats?.auditIssues || {});
  const issueTotal =
    realIssueData?.issuesDistribution.total || errors + warnings + notices;
  const health = Math.max(35, Math.min(100, Math.round(100 - (errors / Math.max(crawled, 1)) * 100)));
  const factor = Math.max(0.15, Math.min(2.25, crawled / Math.max(project.totalUrls, 1)));
  const htmlCount = latestRows.filter((row) => auditorContentType(row) === "html").length;
  const resourceCount = Math.max(0, latestRows.length - htmlCount);
  const rowTotal = latestRows.length || crawled;

  return {
    crawledUrls: {
      total: rowTotal,
      segments: [
        { label: "Internal", value: htmlCount, color: "#df3c27" },
        { label: "Resources", value: resourceCount, color: "#60a5fa" },
      ],
    },
    crawlStatus: {
      total: crawled + Math.max(0, stats?.scheduled || 0),
      segments: [
        { label: "Crawled", value: crawled, color: "#34d399" },
        { label: "Uncrawled", value: Math.max(0, stats?.scheduled || 0), color: "#52525b" },
      ],
    },
    errorDistribution: {
      total: crawled,
      segments: [
        { label: "URLs without errors", value: Math.max(0, crawled - errors), color: "#34d399" },
        { label: "URLs with errors", value: errors, color: "#f43f5e" },
      ],
    },
    issuesDistribution: realIssueData?.issuesDistribution || {
      total: issueTotal,
      rows: [
        { label: "Errors", value: errors, max: Math.max(issueTotal, 1), color: "from-rose-500 to-rose-400" },
        { label: "Warnings", value: warnings, max: Math.max(issueTotal, 1), color: "from-amber-500 to-amber-300" },
        { label: "Notices", value: notices, max: Math.max(issueTotal, 1), color: "from-brand-500 to-amber-400" },
      ],
    },
    healthScore: {
      ...healthScore,
      score: health,
      grade: health >= 90 ? "Excellent" : health >= 75 ? "Good" : "Needs work",
      trend: [...healthScore.trend.slice(0, -1), health],
    },
    whatsNew: realIssueData?.whatsNew || whatsNew.map((row) => scaleIssueRow(row, factor)),
    topIssues: realIssueData?.topIssues || topIssues.map((row) => scaleIssueRow(row, factor)),
    issueCategories: realIssueData?.issueCategories || scaleIssueCategories(issueCategories, factor),
    httpStatusCodes: httpStatusSegmentsFromRows(latestRows),
    httpStatusByDepth: httpStatusByDepthFromRows(latestRows),
    bulkExportSummary: bulkSummaryFromRows(latestRows, stats?.auditIssues || {}),
  };
}

export function getAuditDataForProject(selectedProject = project, state = {}) {
  const selected = normalizeProject(selectedProject);
  const live = liveAuditData(selected, state.stats);
  const fallback = live || emptyLiveAuditData();
  const totalUrls = fallback.crawledUrls?.total || 0;

  const data = {
    project: {
      ...selected,
      totalUrls,
      crawledOn: selected.crawledOn,
      compareTo: selected.compareTo,
    },
    crawledUrls: fallback.crawledUrls,
    crawlStatus: fallback.crawlStatus,
    errorDistribution: fallback.errorDistribution,
    issuesDistribution: fallback.issuesDistribution,
    healthScore: fallback.healthScore,
    whatsNew: fallback.whatsNew,
    topIssues: fallback.topIssues,
    issueCategories: fallback.issueCategories,
    issueDetail: { ...clone(issueDetail), urls: [] },
    httpStatusCodes: fallback.httpStatusCodes,
    aiContentLevel: clone(aiContentLevel),
    httpStatusByDepth: fallback.httpStatusByDepth,
    bulkExportSummary: fallback.bulkExportSummary,
  };

  return localizeAuditValue(data, selected);
}
