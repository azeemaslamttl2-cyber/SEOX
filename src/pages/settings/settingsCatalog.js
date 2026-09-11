import { BrainCircuit, CreditCard, Gauge, Globe, KeyRound, Search, ShieldCheck } from "lucide-react";

/**
 * Catalog for the central Settings page (`/settings/general`).
 *
 * The application's settings live in three existing stores and this file is the
 * only place that describes how they are presented:
 *
 *   admin_settings        -> /api/settings/general  (application-wide credentials)
 *   deepseek_api_settings -> /api/deepseek-settings (per-user AI provider key)
 *   stripe_connections    -> /api/stripe-connect    (per-user payouts account)
 *
 * Nothing here stores a value. Tabs only decide which existing UI is shown, so
 * every setting keeps the single source of truth it already had.
 */

/**
 * Credential sections backed by `admin_settings`. These are the sections the
 * General Settings page has always rendered; they are unchanged apart from
 * being addressable by tab.
 */
export const CREDENTIAL_SECTIONS = [
  {
    id: "pagespeed",
    title: "PageSpeed",
    description: "Google PageSpeed Insights key used by the speed and project audits.",
    icon: Gauge,
    accent: "bg-amber-500/15 text-amber-300",
    keys: ["pagespeed_api_key"],
  },
  {
    id: "bing",
    title: "Bing Webmaster",
    description: "Key used by the Bing Webmaster Tools integration.",
    icon: Search,
    accent: "bg-sky-500/15 text-sky-300",
    keys: ["bing_webmaster_api_key"],
  },
  {
    id: "dataforseo",
    title: "DataForSEO",
    description:
      "Credentials for keyword research, Brand Radar, plagiarism and the other DataForSEO-backed tools.",
    icon: KeyRound,
    accent: "bg-violet-500/15 text-violet-300",
    keys: ["dataforseo_login", "dataforseo_password"],
  },
  {
    id: "google-oauth",
    title: "Google OAuth / Search Console",
    description:
      "One Google OAuth client serves Search Console, Google sign-in and Business Profile. Each flow uses its own redirect URI below.",
    icon: ShieldCheck,
    accent: "bg-emerald-500/15 text-emerald-300",
    keys: ["google_client_id", "google_client_secret", "google_gsc_redirect_uri"],
  },
  {
    id: "google-flows",
    title: "Google Authentication / Business Profile",
    description:
      "Redirect URIs for the remaining Google flows. Each must match a redirect registered on the OAuth client.",
    icon: Globe,
    accent: "bg-rose-500/15 text-rose-300",
    keys: ["google_auth_redirect_uri", "google_gbp_redirect_uri"],
  },
];

export const SECTION_BY_ID = new Map(CREDENTIAL_SECTIONS.map((section) => [section.id, section]));

export const HINTS = {
  pagespeed_api_key: "Google Cloud API key with PageSpeed Insights enabled.",
  bing_webmaster_api_key: "Found in Bing Webmaster Tools under Settings > API access.",
  dataforseo_login: "Usually the account email address.",
  dataforseo_password: "The DataForSEO API password, not the dashboard password.",
  google_client_id: "Ends in .apps.googleusercontent.com.",
  google_client_secret: "Never leaves the server; it is only used for token exchange.",
  google_gsc_redirect_uri:
    "Must be exactly https://your-domain/gsc/oauth-callback and registered on the OAuth client.",
  google_auth_redirect_uri:
    "Must be exactly https://your-domain/api/auth/google/callback and registered on the OAuth client.",
  google_gbp_redirect_uri:
    "Must be exactly https://your-domain/gbp/oauth-callback. Leave blank to use that automatically - do not reuse the Search Console or sign-in URI, they return to different pages.",
};

/**
 * The tabs, grouped by what each credential actually powers rather than by
 * which page used to host it.
 *
 * - `sections` : rendered by the shared admin_settings credential panel
 * - `panel`    : a self-contained integration panel with its own API
 */
export const SETTINGS_TABS = [
  {
    id: "seo-apis",
    label: "SEO APIs",
    icon: KeyRound,
    description:
      "Credentials for the SEO data providers: PageSpeed Insights, Bing Webmaster Tools and DataForSEO.",
    sections: ["pagespeed", "bing", "dataforseo"],
  },
  {
    id: "google",
    label: "Google",
    icon: ShieldCheck,
    description:
      "One Google OAuth client powers sign-in, Search Console and Business Profile. Each flow uses its own redirect URI.",
    sections: ["google-oauth", "google-flows"],
  },
  {
    id: "stripe",
    label: "Stripe & Payments",
    icon: CreditCard,
    description: "Stripe Connect onboarding, payout status and account requirements.",
    panel: "stripe",
  },
  {
    id: "deepseek",
    label: "DeepSeek AI",
    icon: BrainCircuit,
    description: "The DeepSeek API key used by the AI-powered SEO and content tools.",
    panel: "deepseek",
  },
];

export const DEFAULT_TAB_ID = SETTINGS_TABS[0].id;

/**
 * Older links, bookmarks and the tab names suggested by the previous page
 * layout all keep working.
 */
const TAB_ALIASES = {
  general: "seo-apis",
  api: "seo-apis",
  apis: "seo-apis",
  seo: "seo-apis",
  "seo-api": "seo-apis",
  pagespeed: "seo-apis",
  bing: "seo-apis",
  dataforseo: "seo-apis",
  oauth: "google",
  gsc: "google",
  gbp: "google",
  payment: "stripe",
  payments: "stripe",
  ai: "deepseek",
};

const TAB_IDS = new Set(SETTINGS_TABS.map((tab) => tab.id));

/** Maps any incoming `?tab=` value onto a real tab, falling back to the first. */
export function resolveTabId(value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (TAB_IDS.has(candidate)) return candidate;
  return TAB_ALIASES[candidate] || DEFAULT_TAB_ID;
}

export function getTab(id) {
  const resolved = resolveTabId(id);
  return SETTINGS_TABS.find((tab) => tab.id === resolved) || SETTINGS_TABS[0];
}

/** Every `admin_settings` key a credential tab is responsible for saving. */
export function keysForTab(tab) {
  return (tab.sections || []).flatMap((id) => SECTION_BY_ID.get(id)?.keys || []);
}
