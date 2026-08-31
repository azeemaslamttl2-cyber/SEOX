import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Globe,
  FileText,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  Shield,
  Code2,
  FileCheck,
  Footprints,
  Share2,
  Eye,
  UserCircle,
  Home,
  Settings2,
} from "lucide-react";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_EEAT_RESULT = {
  url: "",
  score: 0,
  rating: "Not run",
  passedChecks: 0,
  failedChecks: 0,
  totalAutomated: 0,
  manualCompleted: 0,
  manualTotal: 47,
  cachedAgo: "Not run",
  sections: [],
};

const EEAT_DETAIL_LIBRARY = {
  "SSL Certificate (HTTPS)": {
    sourceName: "SSL Certificate (HTTPS)",
    description: "Website uses secure HTTPS connection",
    tutorial: "https://www.youtube.com/watch?v=hBr-C9OXgjg",
    recommendation: "Serve the site over HTTPS, redirect HTTP to HTTPS, and keep the certificate valid.",
  },
  "Canonical Tag Set": {
    sourceName: "Canonical Tag Set",
    description: "Canonical URL defined for page",
    tutorial: "https://youtu.be/HU5gxX55ebA",
    recommendation: "Add a canonical tag that points to the preferred URL for this page.",
  },
  "Open Graph Tags": {
    sourceName: "Open Graph Tags",
    description: "OG meta tags for social sharing",
    tutorial: "https://youtu.be/YcDBP9mThwg",
    recommendation: "Add core Open Graph tags such as og:title, og:description, og:url, and og:image.",
  },
  "Organization Schema": {
    sourceName: "Organization Schema",
    description: "Business/company structured data",
    tutorial: "https://youtu.be/xuXEHngLbZk",
    recommendation: "Add Organization or WebSite JSON-LD with brand, logo, sameAs, and contact details.",
  },
  "BreadcrumbList Schema": {
    sourceName: "BreadcrumbList Schema",
    description: "Navigation breadcrumb markup",
    tutorial: "https://www.youtube.com/watch?v=lyzqOVOgxmI",
    recommendation: "Add BreadcrumbList schema on pages where breadcrumbs are visible.",
  },
  "LocalBusiness Schema": {
    sourceName: "LocalBusiness Schema",
    description: "Local business information",
    tutorial: "https://youtu.be/S4pGo2bVFJ0",
    recommendation: "Use LocalBusiness schema only when the site represents a local business with address and phone data.",
  },
  "Privacy Policy Page": {
    sourceName: "Privacy Policy Page",
    description: "Link to privacy policy found",
    tutorial: "https://www.youtube.com/watch?v=2eJZElqfn0k",
    recommendation: "Expose a crawlable privacy policy link in the footer or primary trust navigation.",
  },
  "Terms of Service Page": {
    sourceName: "Terms of Service Page",
    description: "Link to terms of service found",
    tutorial: "https://www.youtube.com/watch?v=Je7FE83dczA",
    recommendation: "Expose terms, conditions, or legal pages from a stable footer or policy area.",
  },
  "About Us Page": {
    sourceName: "About Us Page",
    description: "Link to about page found",
    tutorial: "https://youtu.be/GCVKjUwMOZc",
    recommendation: "Link to an About page that explains who runs the site, what it does, and why it is credible.",
  },
  "Contact Us Page": {
    sourceName: "Contact Us Page",
    description: "Link to contact page found",
    tutorial: "https://www.youtube.com/watch?v=AR-cgCAhBXA",
    recommendation: "Add a crawlable contact path with at least one clear way for users to reach the business.",
  },
  "Authors/Team Page": {
    sourceName: "Authors/Team Page",
    description: "Link to authors or team page found",
    tutorial: "https://youtu.be/yFAn4yTi0aY",
    recommendation: "Surface author, team, staff, or expert profiles when content depends on expertise.",
  },
  "Editorial Guidelines": {
    sourceName: "Editorial Guidelines",
    description: "Link to editorial guidelines found",
    tutorial: "https://youtu.be/IZwoXq3MKyc",
    recommendation: "Publish an editorial policy, review process, or fact-checking page for content-heavy sites.",
  },
  "HTML Sitemap": {
    sourceName: "HTML Sitemap",
    description: "Link to HTML sitemap found",
    tutorial: "https://youtu.be/Rx3l4h6T0Es",
    recommendation: "Add a human-readable sitemap or important crawl paths when the site has many pages.",
  },
  "Copyright Notice": {
    sourceName: "Copyright Notice",
    description: "Copyright text found in footer",
    tutorial: "https://www.youtube.com/watch?v=R1BL4dz8kqE",
    recommendation: "Include ownership/legal text in the footer and keep it consistent across templates.",
  },
  "Copyright Current Year": {
    sourceName: "Copyright Current Year",
    description: "Copyright shows 2024/2025",
    tutorial: "https://youtu.be/YV3y3Le3mfM",
    recommendation: "Keep footer copyright year current or recent so users see the site is maintained.",
  },
  "Physical Address": {
    sourceName: "Physical Address",
    description: "Address information in footer",
    tutorial: "https://youtu.be/ilCA2XoVQxw",
    recommendation: "Show a physical address or location signal when it is relevant to the organization.",
  },
  "Contact Email": {
    sourceName: "Contact Email",
    description: "Email address visible",
    tutorial: "https://youtu.be/ilCA2XoVQxw",
    recommendation: "Make a support or business email visible on contact, footer, or policy pages.",
  },
  "Phone Number": {
    sourceName: "Phone Number",
    description: "Phone number visible",
    tutorial: "https://youtu.be/ilCA2XoVQxw",
    recommendation: "Show a phone number where direct contact is expected for the business model.",
  },
  "Social Links": {
    sourceName: "Social Links in Footer",
    description: "Social media links present",
    tutorial: "https://youtu.be/6rKWbiKIj0s",
    recommendation: "Link to real social profiles so users can verify the brand outside the website.",
  },
  "Footer Menu Links": {
    sourceName: "Footer Menu Links",
    description: "Footer has links to About, Contact, Terms, etc",
    tutorial: "https://youtu.be/4ViFSeSuLrw",
    recommendation: "Keep footer trust links visible on every page: About, Contact, Privacy, Terms, and Sitemap.",
  },
  "Short Website Description": {
    sourceName: "Short Website Description",
    description: "Footer contains a brief site description",
    tutorial: "https://youtu.be/w-LF42WwUAc",
    recommendation: "Add short, plain copy that describes the brand or website purpose.",
  },
  "Parent Company Listed": {
    sourceName: "Parent Company Listed",
    description: "Parent company or business entity mentioned",
    tutorial: "https://youtu.be/woxGyvD9DlU",
    recommendation: "Mention the company, agency, studio, group, or legal entity behind the site.",
  },
  "Search Functionality": {
    sourceName: "Search Functionality",
    description: "Search bar/form present",
    tutorial: "https://youtu.be/FjK9aeQkG9s",
    recommendation: "Add search for content-heavy sites so users can find articles, products, or resources.",
  },
  "Back to Top Button": {
    sourceName: "Back to Top Button",
    description: "Scroll to top button",
    tutorial: "https://youtu.be/GB0JCrbweNc",
    recommendation: "Use a back-to-top control on long templates where it improves navigation.",
  },
  "External Links New Tab": {
    sourceName: "External Links New Tab",
    description: "External links open in new tab",
    tutorial: "https://youtu.be/nZA7W6latJA",
    recommendation: "Set target=\"_blank\" with rel=\"noopener noreferrer\" for appropriate external links.",
  },
  "Images Have Alt Text": {
    sourceName: "Images Have Alt Text",
    description: "All images have alt attributes",
    tutorial: "https://youtu.be/2PLVWkGid6A",
    recommendation: "Add descriptive alt text to meaningful images and empty alt text to decorative images.",
  },
  "Homepage Not Noindexed": {
    sourceName: "Homepage Not Noindexed",
    description: "Homepage is indexable by search engines",
    tutorial: "https://youtu.be/TByjQWfAXpY",
    recommendation: "Remove noindex directives from the homepage unless intentionally blocking search.",
  },
  'Homepage Title Not "Home"': {
    sourceName: 'Homepage Title Not "Home"',
    description: 'Title tag is descriptive, not just "Home"',
    tutorial: "https://youtu.be/d1VnNWjTK6k",
    recommendation: "Use a descriptive homepage title that names the brand and core offer.",
  },
  "Homepage Content Visible": {
    sourceName: "Homepage Content Visible",
    description: "Homepage has substantial visible content",
    tutorial: "https://youtu.be/1W_oNRLzAnk",
    recommendation: "Ensure the homepage has crawlable text that explains the website, offer, and trust signals.",
  },
  "No Empty # Links": {
    sourceName: "No Empty # Links",
    description: 'No placeholder href="#" links',
    tutorial: "https://youtu.be/UFzAJhGngMg",
    recommendation: "Replace placeholder links with real destinations or buttons that do not pretend to be links.",
  },
  "Links Look Like Links": {
    sourceName: "Links Look Like Links",
    description: "Links should have underline or distinct color styling",
    recommendation: "Make clickable text visually distinct enough for users to recognize links.",
  },
  "No Content as Background Images": {
    sourceName: "No Content as Background Images",
    description: "Important images should use img tags, not CSS backgrounds",
    recommendation: "Use img elements for meaningful visual content so crawlers and assistive tools can inspect it.",
  },
  "External Links Not All Nofollow": {
    sourceName: "External Links Not All Nofollow",
    description: "Some external links should be followed for link equity",
    recommendation: "Use nofollow/sponsored where appropriate, but avoid blanket nofollow on all cited sources.",
  },
  "Menu/Footer Links Not Nofollow": {
    sourceName: "Menu/Footer Links Not Nofollow",
    description: "Navigation links should not have nofollow attribute",
    recommendation: "Keep internal navigation links followable so authority and discovery can flow through the site.",
  },
  "Robots Sitemap Not Broken": {
    sourceName: "Robots Sitemap Not Broken",
    description: "XML sitemap URL in robots.txt is accessible",
    recommendation: "Declare a valid sitemap URL in robots.txt and verify it returns a successful response.",
  },
};

function getEeatDetail(checkItem) {
  const source = EEAT_DETAIL_LIBRARY[checkItem.name] || {};
  return {
    sourceName: source.sourceName || checkItem.name,
    description: source.description || checkItem.desc,
    tutorial: source.tutorial || "",
    recommendation:
      source.recommendation ||
      (checkItem.status === "pass"
        ? "This signal is present. Keep it visible, crawlable, and consistent across important templates."
        : "Add or fix this signal so users and search engines can verify the site more easily."),
  };
}

/* ── Large hero score gauge (brand-orange theme) ── */
function HeroGauge({ score, size = 140 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Glow */}
      <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-2xl" />
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))" }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#df3c27" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-black text-white">{score}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">/ 100</span>
      </div>
    </div>
  );
}

/* ── Section progress arc (small) ── */
function MiniArc({ percent, size = 36 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  let color = "#10b981";
  if (percent < 50) color = "#f43f5e";
  else if (percent < 80) color = "#f59e0b";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/70">
        {percent}%
      </span>
    </div>
  );
}

const FETCH_META_PATH = "/api/fetch-url-meta";

function normalizeAuditUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Enter a domain or URL to analyze.");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  parsed.hash = "";
  return parsed.toString();
}

function getApiUrls(path) {
  if (
    import.meta.env?.DEV &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "5173"
  ) {
    return [path, `http://127.0.0.1:8788${path}`];
  }

  return [path];
}

async function fetchPageHtml(url) {
  const path = `${FETCH_META_PATH}?url=${encodeURIComponent(url)}&returnHtml=true`;
  let lastError = null;

  for (const endpoint of getApiUrls(path)) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.html) return payload.html;
      if (response.ok && payload?.success === false) return "";
      lastError = new Error(payload?.error || `HTML fetch failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) console.warn("EEAT HTML fetch unavailable:", lastError.message);
  return "";
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(value = "") {
  const attrs = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of value.matchAll(attrRe)) {
    attrs[match[1].toLowerCase()] = match[2] || match[3] || match[4] || "";
  }
  return attrs;
}

function parseAnchors(html, baseUrl) {
  const anchors = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of String(html || "").matchAll(re)) {
    const attrs = parseAttributes(match[1] || "");
    const rawHref = attrs.href || "";
    let href = rawHref;
    try {
      href = href ? new URL(href, baseUrl).toString() : "";
    } catch {
      href = rawHref;
    }
    anchors.push({
      href,
      rawHref,
      rel: String(attrs.rel || "").toLowerCase(),
      target: String(attrs.target || "").toLowerCase(),
      text: stripTags(match[2] || ""),
    });
  }

  return anchors;
}

function collectCrawlLinks(crawlData) {
  return Array.isArray(crawlData?.links)
    ? crawlData.links.map((item) =>
      typeof item === "string"
        ? { href: item, rawHref: item, text: item, rel: "", target: "" }
        : {
          href: item.url || "",
          rawHref: item.href || item.url || "",
          text: item.anchor || item.url || "",
          rel: item.rel || "",
          target: item.target || "",
        }
    )
    : [];
}

function collectResources(crawlData) {
  return Array.isArray(crawlData?.resources)
    ? crawlData.resources.map((item) => (typeof item === "string" ? { url: item } : item))
    : [];
}

function textIncludesAny(value, terms) {
  const haystack = String(value || "").toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function findLink(links, terms) {
  return links.find((link) => textIncludesAny(`${link.href} ${link.text}`, terms));
}

function countLinks(links, terms) {
  return links.filter((link) => textIncludesAny(`${link.href} ${link.text}`, terms)).length;
}

function collectSchemaTypes(value, output = new Set()) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSchemaTypes(item, output));
    return output;
  }
  if (typeof value !== "object") return output;

  const type = value["@type"];
  if (Array.isArray(type)) type.forEach((item) => output.add(String(item).toLowerCase()));
  else if (type) output.add(String(type).toLowerCase());

  Object.values(value).forEach((item) => collectSchemaTypes(item, output));
  return output;
}

function getSchemaTypes(html) {
  const types = new Set();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const match of String(html || "").matchAll(re)) {
    const attrs = parseAttributes(match[1] || "");
    if (!String(attrs.type || "").toLowerCase().includes("ld+json")) continue;
    try {
      collectSchemaTypes(JSON.parse((match[2] || "").trim()), types);
    } catch {
      // Keep the JSON-LD presence signal even if one block is malformed.
    }
  }

  return Array.from(types);
}

function check(name, desc, passed, passBadge, failBadge = "Not found") {
  return {
    name,
    desc,
    status: passed ? "pass" : "fail",
    badge: passed ? passBadge : failBadge,
  };
}

function section(id, title, checks) {
  const passed = checks.filter((item) => item.status === "pass").length;
  const total = checks.length;
  return {
    id,
    title,
    passed,
    total,
    percent: total ? Math.round((passed / total) * 100) : 0,
    checks,
  };
}

function ratingFromScore(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "Needs Work";
  return "Poor";
}

function sameHostname(left, right) {
  try {
    return (
      new URL(left).hostname.replace(/^www\./, "") ===
      new URL(right).hostname.replace(/^www\./, "")
    );
  } catch {
    return false;
  }
}

function isPlaceholderHref(link) {
  const rawHref = String(link.rawHref ?? link.href ?? "").trim().toLowerCase();
  return (
    !rawHref ||
    rawHref === "#" ||
    rawHref === "/#" ||
    rawHref.startsWith("javascript:void(0") ||
    rawHref === "javascript:;"
  );
}

function buildEeatResult(targetUrl, crawlData, robotsData, html) {
  const audit = crawlData.audit || {};
  const finalUrl = crawlData.finalUrl || crawlData.url || targetUrl;
  const parsedUrl = new URL(finalUrl);
  const crawlLinks = collectCrawlLinks(crawlData);
  const htmlLinks = parseAnchors(html, finalUrl);
  const links = htmlLinks.length ? htmlLinks : crawlLinks;
  const resources = collectResources(crawlData);
  const bodyText = stripTags(html);
  const bodyLower = bodyText.toLowerCase();
  const htmlLower = String(html || "").toLowerCase();
  const schemaTypes = getSchemaTypes(html);
  const schemaSet = new Set(schemaTypes);
  const year = new Date().getFullYear();
  const previousYear = year - 1;
  const externalLinks = links.filter((link) => {
    try {
      const linkUrl = new URL(link.href);
      return linkUrl.hostname.replace(/^www\./, "") !== parsedUrl.hostname.replace(/^www\./, "");
    } catch {
      return false;
    }
  });
  const targetBlankLinks = externalLinks.filter((link) => link.target === "_blank");
  const nofollowExternalLinks = externalLinks.filter((link) => /\bnofollow\b/.test(link.rel));
  const emptyLinks = links.filter(isPlaceholderHref);
  const socialPlatforms = ["twitter", "x.com", "facebook", "linkedin", "youtube", "instagram", "pinterest", "tiktok"];
  const socialCount = countLinks(links, socialPlatforms);
  const hasHtml = Boolean(html);

  const sections = [
    section("authority", "Authority & Technical", [
      check("SSL Certificate (HTTPS)", "Website uses a secure HTTPS connection", parsedUrl.protocol === "https:", "HTTPS enabled", "Not using HTTPS"),
      check("HTTP Status OK", "Homepage returns a crawlable 2xx status", crawlData.status >= 200 && crawlData.status < 300, `HTTP ${crawlData.status}`, `HTTP ${crawlData.status || 0}`),
      check("Canonical Tag Set", "Canonical URL is defined for the page", Boolean(audit.canonicalUrl), "Canonical URL set"),
      check("Descriptive Title", "Title tag is present and more useful than just Home", audit.titleLength >= 10 && !/^home$/i.test(audit.titleText || ""), `${audit.titleLength || 0} characters`, audit.titleText ? "Title is too short/generic" : "Title missing"),
      check("H1 Present", "Homepage has a clear H1 heading", audit.h1Count >= 1, `${audit.h1Count} H1 tag(s)`, "No H1 found"),
      check("Meta Description", "Meta description is present", audit.metaDescriptionCount > 0, `${audit.metaDescriptionLength || 0} characters`),
      check("Sitemap Discoverable", "XML sitemap is linked or declared in robots.txt", (robotsData?.sitemaps?.length || 0) > 0 || Boolean(findLink(links, ["sitemap"])), `${robotsData?.sitemaps?.length || countLinks(links, ["sitemap"])} sitemap signal(s)`),
      check("Robots Indexable", "Homepage is not blocked by robots meta or X-Robots-Tag", !audit.noindex && !/noindex/i.test(crawlData.xRobotsTag || ""), "Indexable", audit.robotsMeta || crawlData.xRobotsTag || "Noindex detected"),
      check("Open Graph Tags", "Social sharing metadata is present", !audit.ogMissingAll, `${Object.keys(audit.ogTags || {}).length} OG tag(s)`),
      check("Substantial Visible Content", "Homepage has enough visible text to demonstrate context", (audit.wordCount || bodyText.split(/\s+/).filter(Boolean).length) >= 250, `${audit.wordCount || bodyText.split(/\s+/).filter(Boolean).length} words`, "Thin homepage content"),
    ]),
    section("schema", "Schema Markup", [
      check("JSON-LD Present", "Structured data is included with JSON-LD", schemaTypes.length > 0 || /application\/ld\+json/i.test(html), `${Math.max(schemaTypes.length, 1)} JSON-LD signal(s)`),
      check("Organization Schema", "Organization or WebSite schema exists", schemaSet.has("organization") || schemaSet.has("website") || htmlLower.includes("schema.org/organization"), "Organization/WebSite schema found"),
      check("BreadcrumbList Schema", "Breadcrumb structured data exists", schemaSet.has("breadcrumblist") || htmlLower.includes("breadcrumblist"), "Breadcrumb schema found"),
      check("LocalBusiness Schema", "Local business structured data exists where relevant", schemaSet.has("localbusiness") || htmlLower.includes("localbusiness"), "LocalBusiness schema found"),
    ]),
    section("eeat-pages", "EEAT Pages", [
      check("Privacy Policy Page", "Link to a privacy policy is visible", Boolean(findLink(links, ["privacy"])), "Privacy link found"),
      check("Terms of Service Page", "Link to terms or conditions is visible", Boolean(findLink(links, ["terms", "conditions"])), "Terms link found"),
      check("About Us Page", "Link to an about page is visible", Boolean(findLink(links, ["about"])), "About link found"),
      check("Contact Us Page", "Link to a contact page is visible", Boolean(findLink(links, ["contact"])), "Contact link found"),
      check("Authors/Team Page", "Author, team, staff, or expert pages are visible", Boolean(findLink(links, ["author", "team", "staff", "expert"])), "Author/team signal found"),
      check("Editorial Guidelines", "Editorial policy or review process is linked", Boolean(findLink(links, ["editorial", "review policy", "fact-check", "fact check"])), "Editorial signal found"),
      check("HTML Sitemap", "Human-readable sitemap is linked", Boolean(findLink(links, ["sitemap"])), "Sitemap link found"),
    ]),
    section("footer", "Footer EEAT", [
      check("Copyright Notice", "Copyright or legal ownership is visible", /copyright|©|&copy;/i.test(html), "Copyright notice found"),
      check("Copyright Current Year", "Copyright year is current or recent", new RegExp(`(${year}|${previousYear})`).test(html), "Current/recent year found"),
      check("Physical Address", "Address or location information is visible", textIncludesAny(bodyLower, ["address", "street", "suite", "floor", "city", "location"]), "Address/location signal found"),
      check("Contact Email", "Email address is visible", /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(html), "Email found"),
      check("Phone Number", "Phone number is visible", /(?:\+?\d[\d\s().-]{7,}\d)/.test(bodyText), "Phone number found"),
      check("Social Links", "Social media profiles are linked", socialCount > 0, `${socialCount} social link(s)`),
      check("Footer Menu Links", "Footer includes trust or utility links", countLinks(links, ["about", "contact", "privacy", "terms", "sitemap", "support"]) >= 2, `${countLinks(links, ["about", "contact", "privacy", "terms", "sitemap", "support"])} essential link(s)`),
      check("Short Website Description", "Homepage has enough descriptive copy", (audit.metaDescriptionLength || 0) >= 50 || (audit.wordCount || 0) >= 250, "Description/content found"),
      check("Parent Company Listed", "Company or brand entity is mentioned", textIncludesAny(bodyLower, ["company", "llc", "ltd", "inc", "agency", "group", "studio"]), "Company/entity signal found"),
      check("DMCA or Legal Signal", "DMCA, legal, or policy signal is visible", textIncludesAny(bodyLower, ["dmca", "legal", "policy"]), "Legal/policy signal found"),
    ]),
    section("social", "Social Presence", [
      check("Twitter/X Link", "Twitter/X profile is linked", Boolean(findLink(links, ["twitter", "x.com"])), "Twitter/X link found"),
      check("Facebook Link", "Facebook page is linked", Boolean(findLink(links, ["facebook"])), "Facebook link found"),
      check("LinkedIn Link", "LinkedIn profile is linked", Boolean(findLink(links, ["linkedin"])), "LinkedIn link found"),
      check("YouTube Link", "YouTube channel is linked", Boolean(findLink(links, ["youtube", "youtu.be"])), "YouTube link found"),
      check("Instagram Link", "Instagram profile is linked", Boolean(findLink(links, ["instagram"])), "Instagram link found"),
      check("Pinterest Link", "Pinterest profile is linked", Boolean(findLink(links, ["pinterest"])), "Pinterest link found"),
      check("TikTok Link", "TikTok profile is linked", Boolean(findLink(links, ["tiktok"])), "TikTok link found"),
      check("RSS Feed", "RSS or Atom feed is available", resources.some((item) => /rss|atom|feed/i.test(`${item.url} ${item.type || ""}`)) || Boolean(findLink(links, ["rss", "feed"])), "RSS/feed signal found"),
    ]),
    section("ux", "UX Elements", [
      check("Search Functionality", "Search form or search link is present", /type=["']search["']|role=["']search["']|\/search|\?s=/.test(htmlLower), "Search signal found"),
      check("Back to Top Button", "Back-to-top or top anchor exists", /back-to-top|scroll-top|href=["']#top["']|id=["']top["']/.test(htmlLower), "Back-to-top signal found"),
      check("External Links New Tab", "External links open in a new tab where appropriate", externalLinks.length === 0 || targetBlankLinks.length / externalLinks.length >= 0.5, `${targetBlankLinks.length}/${externalLinks.length} external links use _blank`),
      check("Images Have Alt Text", "Images include alt attributes", (audit.missingImageAltCount || 0) === 0, `${audit.imageCount || 0}/${audit.imageCount || 0} have alt text`, `${audit.missingImageAltCount || 0} missing alt`),
      check("No Mixed Content", "HTTPS pages do not load HTTP resources", (audit.mixedContentCount || 0) === 0, "No mixed content", `${audit.mixedContentCount || 0} mixed resources`),
    ]),
    section("about", "About Us Signals", [
      check("About Page Linked", "About page is visible from homepage", Boolean(findLink(links, ["about"])), "About link found"),
      check("Who We Are Signal", "Page copy explains who the business is", textIncludesAny(bodyLower, ["who we are", "about us", "our story"]), "Identity/story signal found"),
      check("What We Do Signal", "Page copy explains services or expertise", textIncludesAny(bodyLower, ["what we do", "services", "solutions", "expertise"]), "Services/expertise signal found"),
      check("Trust Statement", "Trust, quality, or credibility language is visible", textIncludesAny(bodyLower, ["trusted", "certified", "award", "experience", "expert", "verified"]), "Trust language found"),
      check("Team or Author Signal", "Team, author, expert, or staff signal is visible", textIncludesAny(bodyLower, ["team", "author", "expert", "staff", "founder"]), "Team/author signal found"),
      check("Testimonials or Reviews", "Social proof is visible", textIncludesAny(bodyLower, ["testimonial", "review", "case study", "client", "rating"]), "Social proof found"),
      check("Contact Path", "Users can find a contact path", Boolean(findLink(links, ["contact", "support", "help"])), "Contact/support link found"),
      check("Partner or Featured Signal", "Partners, clients, or featured mentions are visible", textIncludesAny(bodyLower, ["partner", "featured", "as seen", "clients"]), "Partner/featured signal found"),
      check("Substantial Copy", "Page has enough visible text for trust evaluation", (audit.wordCount || 0) >= 250, `${audit.wordCount || 0} words`, "Thin page content"),
    ]),
    section("homepage", "Homepage Checks", [
      check("Homepage Loads", "Homepage can be crawled", crawlData.status >= 200 && crawlData.status < 300, `HTTP ${crawlData.status}`, `HTTP ${crawlData.status || 0}`),
      check("Homepage Not Noindexed", "Homepage is indexable", !audit.noindex, "Homepage is indexable", audit.robotsMeta || "Noindex detected"),
      check('Homepage Title Not "Home"', "Title tag is descriptive", audit.titleText && !/^home$/i.test(audit.titleText), `Title: ${audit.titleText || ""}`.slice(0, 80), "Title is missing/generic"),
      check("Homepage Content Visible", "Homepage has visible copy", (audit.wordCount || 0) >= 150, `${audit.wordCount || 0} words`, "Low visible word count"),
      check("No Homepage Meta Refresh", "Homepage does not use meta refresh redirects", !audit.metaRefreshRedirect, "No meta refresh", "Meta refresh found"),
    ]),
    section("onsite", "EEAT On Site Check", [
      check("No Empty # Links", 'No placeholder href="#" links are present', emptyLinks.length === 0, "No empty links", `${emptyLinks.length} empty link(s)`),
      check("No Staging URLs", "Navigation does not point to staging/dev URLs", !textIncludesAny(htmlLower, ["staging.", "dev.", "localhost", "127.0.0.1"]), "No staging URLs found"),
      check("Links Look Like Links", "Homepage contains meaningful crawlable links", links.length >= 3, `${links.length} link(s)`),
      check("No Content as Background Images", "Images are available as crawlable image resources", (audit.imageCount || 0) > 0 || !/background-image/.test(htmlLower), `${audit.imageCount || 0} image tag(s)`),
      check("External Links Not All Nofollow", "Not every external link is nofollow", externalLinks.length === 0 || nofollowExternalLinks.length < externalLinks.length, `${nofollowExternalLinks.length}/${externalLinks.length} external nofollow`),
      check("Menu/Footer Links Not Nofollow", "Internal navigation links are not all nofollow", links.filter((link) => /\bnofollow\b/.test(link.rel)).length < Math.max(links.length, 1), "Navigation followable"),
      check("Robots Sitemap Not Broken", "Robots sitemap URL is discoverable", (robotsData?.sitemaps?.length || 0) > 0, `${robotsData?.sitemaps?.length || 0} sitemap(s)`),
      check("No Meta Refresh Redirect", "Avoid meta refresh redirects", !audit.metaRefreshRedirect, "No meta refresh"),
      check("Canonical Matches Site", "Canonical points to this domain", !audit.canonicalUrl || sameHostname(audit.canonicalUrl, finalUrl), "Canonical host matches"),
      check("Open Graph URL Set", "OG URL is present", Boolean(audit.ogTags?.["og:url"]), "OG URL found"),
      check("Twitter Card Set", "Twitter card metadata is present", Boolean(audit.twitterTags?.["twitter:card"]), "Twitter card found"),
      check("No HTTP Images on HTTPS", "Images do not downgrade to HTTP", (audit.httpImageCount || 0) === 0, "No HTTP images", `${audit.httpImageCount || 0} HTTP image(s)`),
      check("Crawlable Internal Links", "Homepage exposes internal links for discovery", links.some((link) => {
        try {
          return new URL(link.href).hostname.replace(/^www\./, "") === parsedUrl.hostname.replace(/^www\./, "");
        } catch {
          return false;
        }
      }), "Internal links found"),
      check("HTML Was Parsed", "Analyzer could inspect the homepage HTML", hasHtml, "HTML parsed", "HTML unavailable"),
    ]),
  ];

  const allChecks = sections.flatMap((item) => item.checks);
  const passedChecks = allChecks.filter((item) => item.status === "pass").length;
  const totalAutomated = allChecks.length;
  const score = totalAutomated ? Math.round((passedChecks / totalAutomated) * 100) : 0;

  return {
    url: finalUrl,
    score,
    rating: ratingFromScore(score),
    passedChecks,
    failedChecks: totalAutomated - passedChecks,
    totalAutomated,
    manualCompleted: 0,
    manualTotal: 47,
    cachedAgo: "Just now",
    sections,
  };
}

export default function EeatAudit() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "eeat",
    project,
    projectUrl,
    emptyResult: EMPTY_EEAT_RESULT,
  });
  const d = result;
  const [tab, setTab] = useState("automated");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({});
  const [openCheckDetails, setOpenCheckDetails] = useState({});

  useEffect(() => {
    setOpenSections({});
    setOpenCheckDetails({});
    setError("");
  }, [projectUrl]);

  function toggleSection(id) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleCheckDetails(sectionId, checkIndex) {
    const key = `${sectionId}-${checkIndex}`;
    setOpenCheckDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function analyze() {
    setLoading(true);
    setError("");

    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      let target = normalizeAuditUrl(projectUrl);
      let crawlData = await fetchCrawlTarget(target);

      if (crawlData.redirectedTo && crawlData.status >= 300 && crawlData.status < 400) {
        target = crawlData.redirectedTo;
        crawlData = await fetchCrawlTarget(target);
      }

      const finalUrl = crawlData.finalUrl || crawlData.url || target;
      const robotsUrl = new URL("/robots.txt", new URL(finalUrl).origin).toString();
      const [robotsData, html] = await Promise.all([
        fetchCrawlTarget(robotsUrl).catch(() => null),
        fetchPageHtml(finalUrl),
      ]);
      const next = buildEeatResult(finalUrl, crawlData, robotsData, html);

      await saveResult(next);
      setOpenSections(Object.fromEntries(next.sections.map((sectionItem) => [sectionItem.id, true])));
      setOpenCheckDetails({});
      setTab("automated");
    } catch (err) {
      setError(err?.message || "Could not run the EEAT audit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">

      {/* ─────────── HERO: Split layout ─────────── */}
      <div className="eeat-hero relative overflow-hidden rounded-3xl border border-brand-600 bg-brand-500">
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-amber-500/[0.05] blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-8">
          {/* Left column */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
                <ShieldCheck className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight text-white">
                  EEAT Audit
                </h1>
                <p className="text-xs text-white/40">
                  Experience · Expertise · Authority · Trust
                </p>
              </div>
            </div>

            {/* URL bar */}
            <div className="mt-5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/70 bg-white px-4 py-2.5">
                <Globe className="h-4 w-4 text-brand-400/60" />
                <input
                  value={displayUrl}
                  readOnly
                  onKeyDown={(e) => {
                    if (e.key === "Enter") analyze();
                  }}
                  className="flex-1 cursor-not-allowed bg-transparent text-sm text-college-blue placeholder:text-college-blue/60 focus:outline-none"
                  placeholder="Select a website in the nav"
                />
              </div>
              <button
                onClick={analyze}
                disabled={loading || !hasProject}
                className="ui-button eeat-analyze-button rounded-xl"
              >
                <Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
            {(error || persistenceError) && (
              <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
                {error || persistenceError}
              </p>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              <button className="ui-button eeat-secondary-button">
                <Download className="h-3 w-3" /> Export PDF
              </button>
              <button
                onClick={analyze}
                disabled={loading || !hasProject}
                className="ui-button eeat-secondary-button"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Re-scan
              </button>
              <span className="ml-1 text-[11px] text-white">
                <Clock className="mr-0.5 inline h-3 w-3" /> {d.cachedAgo}
              </span>
            </div>
          </div>

          {/* Right column — Score gauge */}
          <div className="flex flex-col items-center gap-2 lg:pr-4">
            <HeroGauge score={d.score} />
            <span className="eeat-rating rounded-full bg-brand-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-300">
              {d.rating}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────── Metric Strip ─────────── */}
      <div className="mt-4 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <MetricTile
          value={d.passedChecks}
          label="Passed"
          sub={`of ${d.totalAutomated}`}
          accent="text-emerald-400"
          dotColor="bg-emerald-400"
        />
        <MetricTile
          value={d.failedChecks}
          label="Failed"
          sub="need attention"
          accent="text-rose-400"
          dotColor="bg-rose-400"
        />
        <MetricTile
          value={d.totalAutomated}
          label="Automated"
          sub="total checks"
          accent="text-brand-300"
          dotColor="bg-brand-400"
        />
        <MetricTile
          value={`${d.manualCompleted}/${d.manualTotal}`}
          label="Manual"
          sub="completed"
          accent="text-violet-400"
          dotColor="bg-violet-400"
        />
      </div>

      {/* ─────────── Tabs ─────────── */}
      <div className="mt-8 flex items-center gap-1">
        <button
          onClick={() => setTab("automated")}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition ${tab === "automated"
              ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30"
              : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            }`}
        >
          Automated Checks ({d.totalAutomated})
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition ${tab === "manual"
              ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30"
              : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            }`}
        >
          Manual Review ({d.manualCompleted}/{d.manualTotal})
        </button>
      </div>

      {/* ─────────── Sections ─────────── */}
      {tab === "automated" && (
        <div className="mt-4 space-y-3">
          {d.sections.map((section) => (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]"
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <SectionIcon id={section.id} />
                  <div>
                    <div className="font-display text-[13px] font-bold text-white/90">
                      {section.title}
                    </div>
                    <div className="text-[11px] text-white/30">
                      {section.passed} of {section.total} passed
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MiniArc percent={section.percent} />
                  {openSections[section.id] ? (
                    <ChevronUp className="h-4 w-4 text-white/20" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/20" />
                  )}
                </div>
              </button>

              {/* Checks */}
              {openSections[section.id] && (
                <div className="border-t border-white/[0.04]">
                  {section.checks.map((check, i) => {
                    const detailKey = `${section.id}-${i}`;
                    const isDetailOpen = Boolean(openCheckDetails[detailKey]);

                    return (
                      <div
                        key={i}
                        className={`group px-5 py-3 transition hover:bg-white/[0.02] ${i < section.checks.length - 1
                            ? "border-b border-white/[0.03]"
                            : ""
                          }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {check.status === "pass" ? (
                              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                                <XCircle className="h-4 w-4 text-rose-400" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-white/85">
                                {check.name}
                              </div>
                              <div className="text-[11px] text-white/30">
                                {check.desc}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${check.status === "pass"
                                  ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20"
                                }`}
                            >
                              {check.badge}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleCheckDetails(section.id, i)}
                              aria-expanded={isDetailOpen}
                              aria-label={`${isDetailOpen ? "Hide" : "Show"} details for ${check.name}`}
                              className={`flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/80 text-white transition hover:bg-brand-400 ${isDetailOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                            >
                              <ArrowRight className={`h-3 w-3 transition-transform ${isDetailOpen ? "rotate-90" : ""}`} />
                            </button>
                          </div>
                        </div>
                        {isDetailOpen && <EeatDetailsPanel checkItem={check} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "manual" && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.01] py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
            <ClipboardCheck className="h-8 w-8 text-brand-400/40" />
          </div>
          <p className="mt-4 text-sm text-white/35">
            No manual checklists completed yet.
          </p>
          <button className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40">
            <Sparkles className="h-4 w-4" /> Start Manual Review
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Metric tile for the strip ── */
function MetricTile({ value, label, sub, accent, dotColor }) {
  return (
    <div className="relative px-5 py-4 text-center border-r border-white/[0.04] last:border-r-0">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-black ${accent}`}>{value}</div>
      <div className="text-[10px] text-white/25">{sub}</div>
    </div>
  );
}

/* ── Section icons (Lucide-based, no emoji) ── */
function SectionIcon({ id }) {
  const map = {
    authority: { Icon: Shield, bg: "bg-sky-500/10 text-sky-400" },
    schema: { Icon: Code2, bg: "bg-violet-500/10 text-violet-400" },
    "eeat-pages": { Icon: FileCheck, bg: "bg-amber-500/10 text-amber-400" },
    footer: { Icon: Footprints, bg: "bg-emerald-500/10 text-emerald-400" },
    social: { Icon: Share2, bg: "bg-pink-500/10 text-pink-400" },
    ux: { Icon: Eye, bg: "bg-cyan-500/10 text-cyan-400" },
    about: { Icon: UserCircle, bg: "bg-green-500/10 text-green-400" },
    homepage: { Icon: Home, bg: "bg-indigo-500/10 text-indigo-400" },
    onsite: { Icon: Settings2, bg: "bg-brand-500/10 text-brand-400" },
  };
  const item = map[id] || { Icon: CheckCircle2, bg: "bg-white/10 text-white/50" };
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bg}`}>
      <item.Icon className="h-4.5 w-4.5" />
    </span>
  );
}

function EeatDetailsPanel({ checkItem }) {
  const detail = getEeatDetail(checkItem);
  const passed = checkItem.status === "pass";

  return (
    <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-brand-200">
            SemanticsX EEAT Detail
          </div>
          <div className="mt-1 text-sm font-semibold text-white/80">{detail.sourceName}</div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            passed
              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
              : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20"
          }`}
        >
          {passed ? "Passed" : "Needs attention"}: {checkItem.badge}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/[0.05] bg-ink-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/30">What this checks</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55">{detail.description}</p>
        </div>
        <div className="rounded-lg border border-white/[0.05] bg-ink-950/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/30">Recommended action</div>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55">{detail.recommendation}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-ink-900/60 px-3 py-2 text-[11px] text-white/45">
        Current evidence: <span className="font-semibold text-white/65">{checkItem.desc}</span>
      </div>

      {detail.tutorial && (
        <a
          href={detail.tutorial}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-[11px] font-bold text-brand-200 hover:bg-brand-500/20"
        >
          View SemanticsX tutorial
          <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
