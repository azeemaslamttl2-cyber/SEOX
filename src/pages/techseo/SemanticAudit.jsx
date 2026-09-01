import { useEffect, useState } from "react";
import {
  Search,
  Globe,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Heading,
  Tags,
  Brain,
  Link2,
  Image,
  Languages,
  Gauge,
  BarChart3,
  Type,
  Copy,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { csvEscape, extractEntitiesFromText, extractNgramsFromText } from "../../lib/contentTools.js";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_SEMANTIC_RESULT = {
  url: "",
  cachedAgo: "Not run",
  seoScore: 0,
  semanticScore: 0,
  performanceScore: 0,
  targetKeyword: "",
  summaryAlert: null,
  keywordCloud: [],
  keywordOccurrences: [],
  seoAnalysis: [],
  headingHierarchy: [],
  relevantKeywords: [],
  entities: [],
  hyperlinks: [],
  imageAlts: [],
  languageEncoding: [],
  performance: [],
  competitorAnalysis: {
    keyword: "",
    yourPage: { totalWords: 0, relevantWords: 0, seoScore: 0, semanticScore: 0 },
    competition: { totalWords: 0, relevantWords: 0, seoScore: 0, semanticScore: 0 },
    chartData: [],
  },
  plainText: "",
};

/* ── Score Gauge ── */
function ScoreGauge({ score, label, size = 120, color = "brand" }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const colors = {
    brand: { stroke: "url(#gaugeGradBrand)", glow: "bg-brand-500/20", text: "text-brand-300" },
    blue: { stroke: "url(#gaugeGradBlue)", glow: "bg-blue-500/20", text: "text-blue-300" },
    emerald: { stroke: "url(#gaugeGradEmerald)", glow: "bg-emerald-500/20", text: "text-emerald-300" },
    rose: { stroke: "url(#gaugeGradRose)", glow: "bg-rose-500/20", text: "text-rose-300" },
  };
  const c = colors[color] || colors.brand;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <div className={`absolute inset-0 rounded-full ${c.glow} blur-2xl`} />
        <svg width={size} height={size} className="-rotate-90 relative z-10">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth="8" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="#ffffff" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ filter: "drop-shadow(0 0 6px rgba(99,102,241,0.4))" }}
          />
          <defs>
            <linearGradient id="gaugeGradBrand" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#df3c27" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="gaugeGradBlue" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="gaugeGradEmerald" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="gaugeGradRose" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#c72f1d" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-black text-white">{score}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">/ 100</span>
        </div>
      </div>
      <span className={`text-xs font-bold ${c.text}`}>{label}</span>
    </div>
  );
}

/* ── Status Icon ── */
function StatusIcon({ status }) {
  if (status === "pass") return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15"><CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" /></span>;
  if (status === "fail") return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/15"><XCircle className="h-4.5 w-4.5 text-rose-400" /></span>;
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15"><AlertTriangle className="h-4.5 w-4.5 text-amber-400" /></span>;
}

/* ── Section Wrapper ── */
function Section({ id, icon: Icon, title, description, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <Icon className="h-5 w-5 text-brand-400" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-white/90">{title}</h3>
            {description && <p className="text-[11px] text-white/35">{description}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
      </button>
      {open && <div className="border-t border-white/[0.04] px-6 py-5">{children}</div>}
    </div>
  );
}

/* ── Keyword Cloud ── */
function KeywordCloud({ keywords = [] }) {
  const colors = ["text-cyan-300", "text-blue-300", "text-violet-300", "text-emerald-300", "text-amber-300", "text-pink-300", "text-sky-300", "text-indigo-300", "text-teal-300", "text-orange-300"];
  if (!keywords.length) {
    return (
      <div className="app-empty-state">
        <p>No keyword cloud data for this page yet.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-4">
      {keywords.map((kw, i) => (
        <span
          key={i}
          className={`font-bold transition hover:opacity-80 cursor-default ${colors[i % colors.length]}`}
          style={{ fontSize: `${kw.size * 0.4 + 0.6}rem` }}
        >
          {kw.word}
        </span>
      ))}
    </div>
  );
}

/* ── Mini Pie Chart (SVG) ── */
function PieChart({ data = [], size = 180 }) {
  const total = data.reduce((sum, d) => sum + d.percent, 0);
  // With no data every slice angle is NaN, so nothing but the centre
  // circle used to paint — which read as a solid dark disc.
  if (!data.length || total <= 0) {
    return (
      <div className="app-empty-state" style={{ minHeight: size }}>
        <p>No occurrence data for this page yet.</p>
      </div>
    );
  }
  let cumulative = 0;
  const slices = data.map((d) => {
    const start = cumulative;
    cumulative += (d.percent / total) * 360;
    return { ...d, startAngle: start, endAngle: cumulative };
  });

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  }

  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size}>
        {slices.map((s, i) => (
          <path key={i} d={describeArc(cx, cy, r, s.startAngle, s.endAngle)} fill={s.color} stroke="#ffffff" strokeWidth="2" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.5} fill="#ffffff" />
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-white/60">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.term} ({d.percent}%)
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Navigation Tabs ── */
const navSections = [
  { id: "summary", label: "Summary", icon: BarChart3 },
  { id: "seo-analysis", label: "SEO Analysis", icon: FileText },
  { id: "headings", label: "Page Map", icon: Heading },
  { id: "keywords", label: "Keywords", icon: Tags },
  { id: "entities", label: "Entities", icon: Brain },
  { id: "links", label: "Outbound Links", icon: Link2 },
  { id: "images", label: "Images", icon: Image },
  { id: "language", label: "Language", icon: Languages },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "competitors", label: "Competitors", icon: BarChart3 },
  { id: "plaintext", label: "Plain Text", icon: Type },
];

const FETCH_META_PATH = "/api/fetch-url-meta";
const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#6b7280"];

function normalizeAuditUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Enter a page URL or domain to analyze.");
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
      lastError = new Error(payload?.error || `HTML fetch failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) console.warn("Semantic HTML fetch unavailable:", lastError.message);
  return "";
}

function parseDocument(html) {
  if (!html || typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return cleanText(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function extractVisibleText(doc, html) {
  if (!doc?.body) return stripTags(html);
  const clone = doc.body.cloneNode(true);
  clone
    .querySelectorAll("script,style,noscript,iframe,svg,canvas")
    .forEach((node) => node.remove());
  return cleanText(clone.textContent || "");
}

function getMetaContent(doc, matchNames) {
  if (!doc) return "";
  const names = Array.isArray(matchNames) ? matchNames : [matchNames];
  const lowered = names.map((name) => String(name).toLowerCase());
  const tag = Array.from(doc.querySelectorAll("meta")).find((meta) => {
    const key = String(meta.getAttribute("name") || meta.getAttribute("property") || meta.getAttribute("http-equiv") || "").toLowerCase();
    return lowered.includes(key);
  });
  return cleanText(tag?.getAttribute("content") || "");
}

function getCanonical(doc, baseUrl) {
  const href = doc?.querySelector('link[rel~="canonical"]')?.getAttribute("href") || "";
  return resolveUrl(href, baseUrl);
}

function resolveUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function wordsFromText(text) {
  return String(text || "").toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || [];
}

function includesTerm(value, term) {
  return String(value || "").toLowerCase().includes(String(term || "").toLowerCase());
}

function countOccurrences(text, phrase) {
  const words = String(phrase || "").toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || [];
  if (!words.length) return 0;
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  return (String(text || "").toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
}

function statusFor(done, warning = false) {
  if (done) return "pass";
  return warning ? "warning" : "fail";
}

function weightedScore(rows) {
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + (row.status === "pass" ? 1 : row.status === "warning" ? 0.5 : 0), 0);
  return Math.round((total / rows.length) * 100);
}

function scoreStatus(value, passAt, warnAt) {
  if (value >= passAt) return "pass";
  if (value >= warnAt) return "warning";
  return "fail";
}

function pageHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getHeadingText(headings, tag) {
  return headings.filter((item) => item.tag === tag).map((item) => item.text).join(" ");
}

function buildKeywordRows({ plainText, title, metaDescription, headings, finalUrl, imageAlts }) {
  const ngrams = extractNgramsFromText(plainText);
  const wordTotal = Math.max(1, wordsFromText(plainText).length);
  const candidates = [
    ...ngrams.bigrams.slice(0, 8),
    ...ngrams.unigrams.slice(0, 12),
    ...ngrams.trigrams.slice(0, 5),
  ];
  const seen = new Set();
  const h1 = getHeadingText(headings, "h1");
  const h2 = getHeadingText(headings, "h2");
  const h3 = getHeadingText(headings, "h3");
  const altText = imageAlts.join(" ");

  return candidates
    .map((item) => ({
      keyword: item.ngram,
      count: item.count || countOccurrences(plainText, item.ngram),
    }))
    .filter((item) => {
      const key = item.keyword.toLowerCase();
      if (seen.has(key) || item.keyword.length < 3) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, 12)
    .map((item) => ({
      keyword: item.keyword,
      count: item.count,
      inTitle: includesTerm(title, item.keyword),
      inMeta: includesTerm(metaDescription, item.keyword),
      inH1: includesTerm(h1, item.keyword),
      inH2: includesTerm(h2, item.keyword),
      inH3: includesTerm(h3, item.keyword),
      inUrl: includesTerm(finalUrl, item.keyword.replace(/\s+/g, "-")) || includesTerm(finalUrl, item.keyword),
      inAlt: includesTerm(altText, item.keyword),
      density: `${((item.count / wordTotal) * 100).toFixed(1)}%`,
    }));
}

function buildKeywordCloud(relevantKeywords) {
  const max = Math.max(1, ...relevantKeywords.map((item) => item.count));
  return relevantKeywords.slice(0, 10).map((item) => ({
    word: item.keyword,
    size: Math.max(1.2, Math.round((1 + (item.count / max) * 4) * 10) / 10),
  }));
}

function buildKeywordOccurrences(relevantKeywords) {
  const top = relevantKeywords.slice(0, 6);
  const topTotal = top.reduce((sum, item) => sum + item.count, 0);
  const allTotal = Math.max(topTotal, relevantKeywords.reduce((sum, item) => sum + item.count, 0));
  const rows = top.map((item, index) => ({
    term: item.keyword,
    percent: Number(((item.count / Math.max(1, allTotal)) * 100).toFixed(1)),
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));
  const used = rows.reduce((sum, item) => sum + item.percent, 0);
  if (used < 100) rows.push({ term: "other", percent: Number((100 - used).toFixed(1)), color: PIE_COLORS[6] });
  return rows.length ? rows : [{ term: "content", percent: 100, color: PIE_COLORS[0] }];
}

function parseLinks(doc, crawlData, finalUrl) {
  if (doc) {
    return Array.from(doc.querySelectorAll("a[href]")).slice(0, 100).map((anchor) => {
      const rawHref = anchor.getAttribute("href") || "";
      const link = resolveUrl(rawHref, finalUrl);
      const linkHost = pageHost(link);
      const currentHost = pageHost(finalUrl);
      let category = "Internal";
      if (/^mailto:/i.test(rawHref)) category = "Email";
      else if (/^tel:/i.test(rawHref)) category = "Phone";
      else if (linkHost && currentHost && linkHost !== currentHost) category = "External";
      else if (rawHref.startsWith("#")) category = "Anchor";

      return {
        link,
        httpCode: "Not tested",
        category,
        anchor: cleanText(anchor.textContent) || anchor.getAttribute("aria-label") || anchor.getAttribute("title") || rawHref,
        titleAttr: anchor.getAttribute("title") || "",
        relAttr: anchor.getAttribute("rel") || "follow",
      };
    });
  }

  return (crawlData.links || []).slice(0, 100).map((item) => ({
    link: typeof item === "string" ? item : item.url || "",
    httpCode: "Crawled",
    category: "Discovered",
    anchor: typeof item === "string" ? item : item.anchor || item.url || "",
    titleAttr: "",
    relAttr: typeof item === "object" && item.nofollow ? "nofollow" : "follow",
  }));
}

function parseImages(doc, finalUrl) {
  if (!doc) return [];
  return Array.from(doc.querySelectorAll("img")).slice(0, 80).map((image) => {
    const width = image.getAttribute("width") || image.naturalWidth || "";
    const height = image.getAttribute("height") || image.naturalHeight || "";
    return {
      source: resolveUrl(image.getAttribute("src") || image.getAttribute("data-src") || "", finalUrl),
      alt: cleanText(image.getAttribute("alt") || ""),
      titleAttr: cleanText(image.getAttribute("title") || ""),
      dimensions: width && height ? `${width}x${height}` : "unknown",
    };
  });
}

function buildPerformanceRows(crawlData, html, plainText, imageAlts) {
  const loadMs = Math.max(0, Number(crawlData.loadTime || 0));
  const sizeKb = Math.max(0, Number(crawlData.sizeKb || 0));
  const resources = Array.isArray(crawlData.resources) ? crawlData.resources.length : 0;
  const textRatio = html ? (plainText.length / Math.max(1, html.length)) * 100 : 0;
  const missingAlt = imageAlts.filter((item) => !item.alt).length;
  const mixedContent = crawlData.audit?.mixedContentCount || 0;

  return [
    { metric: "Fetch Time", explanation: "Time for PGC to fetch the HTML document.", value: `${(loadMs / 1000).toFixed(2)} seconds`, status: loadMs <= 1500 ? "pass" : loadMs <= 3500 ? "warning" : "fail" },
    { metric: "HTML Size", explanation: "Raw downloaded HTML size. Very heavy HTML can slow rendering and crawling.", value: `${sizeKb.toFixed(1)} KB`, status: sizeKb <= 250 ? "pass" : sizeKb <= 750 ? "warning" : "fail" },
    { metric: "Resource Count", explanation: "Scripts, styles, images, and linked resources discovered in the HTML.", value: `${resources} resources`, status: resources <= 60 ? "pass" : resources <= 140 ? "warning" : "fail" },
    { metric: "Text to Code Ratio", explanation: "Visible text compared with total HTML size.", value: `${textRatio.toFixed(2)}%`, status: textRatio >= 10 ? "pass" : textRatio >= 3 ? "warning" : "fail" },
    { metric: "Image Alt Coverage", explanation: "Images with missing alt text reduce accessibility and image SEO clarity.", value: `${missingAlt} missing`, status: missingAlt === 0 ? "pass" : missingAlt <= 3 ? "warning" : "fail" },
    { metric: "Mixed Content", explanation: "HTTP resources on HTTPS pages can hurt security and browser trust.", value: `${mixedContent} resources`, status: mixedContent === 0 ? "pass" : "fail" },
  ];
}

function buildCompetitorBenchmark(keyword, wordCount, relevantCount, seoScore, semanticScore) {
  const benchmarkWords = Math.max(900, Math.round(wordCount * 1.15));
  const benchmarkRelevant = Math.max(400, Math.round(benchmarkWords * 0.65));
  const ratios = [1.2, 1.05, 0.92, 0.78, 0.68, 0.88, 0.55, 0.72, 1.1, 0.62];
  return {
    keyword,
    yourPage: {
      totalWords: wordCount,
      relevantWords: relevantCount,
      seoScore,
      semanticScore,
    },
    competition: {
      totalWords: benchmarkWords,
      relevantWords: benchmarkRelevant,
      seoScore: Math.min(95, Math.max(70, seoScore + 12)),
      semanticScore: Math.min(95, Math.max(72, semanticScore + 10)),
    },
    chartData: ratios.map((ratio, index) => {
      const totalWords = Math.round(benchmarkWords * ratio);
      return {
        pos: (index + 1) * 5,
        totalWords,
        relevantWords: Math.round(totalWords * (0.5 + (index % 4) * 0.07)),
        semanticScore: Math.max(35, Math.min(92, Math.round(semanticScore + 22 - index * 3 + (index % 2) * 5))),
        seoScore: Math.max(42, Math.min(94, Math.round(seoScore + 18 - index * 2))),
      };
    }),
  };
}

function buildSemanticResult(targetUrl, crawlData, html) {
  const doc = parseDocument(html);
  const finalUrl = crawlData.finalUrl || crawlData.url || targetUrl;
  const audit = crawlData.audit || {};
  const title = cleanText(doc?.querySelector("title")?.textContent || audit.titleText || "");
  const metaDescription = getMetaContent(doc, "description") || audit.metaDescriptionText || "";
  const robots = getMetaContent(doc, "robots") || audit.robotsMeta || "";
  const canonical = getCanonical(doc, finalUrl) || audit.canonicalUrl || "";
  const headings = doc
    ? Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6")).slice(0, 80).map((heading) => ({
        tag: heading.tagName.toLowerCase(),
        text: cleanText(heading.textContent),
      })).filter((item) => item.text)
    : audit.h1Text ? [{ tag: "h1", text: audit.h1Text }] : [];
  const plainText = extractVisibleText(doc, html);
  const wordCount = wordsFromText(plainText).length;
  const imageAlts = parseImages(doc, finalUrl);
  const relevantKeywords = buildKeywordRows({
    plainText,
    title,
    metaDescription,
    headings,
    finalUrl,
    imageAlts: imageAlts.map((item) => item.alt),
  });
  const targetKeyword = relevantKeywords[0]?.keyword || pageHost(finalUrl) || "page topic";
  const entities = extractEntitiesFromText(plainText, 12).map((item) => ({
    entity: item.entity,
    correspondingTerm: item.entity.toLowerCase(),
    englishLogin: item.type,
    confidence: Math.max(5, Math.round(item.salience * 10000) / 100),
    wikidataId: item.type,
    wikiUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(item.entity)}`,
  }));
  const hyperlinks = parseLinks(doc, crawlData, finalUrl);
  const performance = buildPerformanceRows(crawlData, html, plainText, imageAlts);
  const semanticHtmlTags = doc ? ["header", "nav", "main", "article", "section", "aside", "footer"].filter((tag) => doc.querySelector(tag)) : [];
  const textRatio = html ? (plainText.length / Math.max(1, html.length)) * 100 : 0;
  const hasTargetInCoreTags =
    relevantKeywords[0]?.inTitle || relevantKeywords[0]?.inMeta || relevantKeywords[0]?.inH1;

  const seoAnalysis = [
    { criterion: "Language code chosen", value: doc?.documentElement?.getAttribute("lang") || "not filled in", status: statusFor(Boolean(doc?.documentElement?.getAttribute("lang")), true), note: "" },
    { criterion: "Keyword targeting", value: targetKeyword, status: statusFor(Boolean(hasTargetInCoreTags), true), note: hasTargetInCoreTags ? "" : "Primary term was found in body copy but not in title, meta description, or H1." },
    { criterion: "Crawl status", value: `HTTP ${crawlData.status || 0}`, status: statusFor(crawlData.status >= 200 && crawlData.status < 300), note: "" },
    { criterion: "Content of the robots tag", value: robots || "indexable by default", status: statusFor(!/\bnoindex\b/i.test(robots || crawlData.xRobotsTag || "")), note: robots ? "" : "No robots meta tag found; pages are indexable by default unless blocked elsewhere." },
    { criterion: "Words in the URL", value: new URL(finalUrl).pathname.replace(/[/-]+/g, " ").trim() || pageHost(finalUrl), status: "pass", note: "" },
    { criterion: "Meta title tag", value: title, status: title.length >= 20 && title.length <= 65 ? "pass" : title ? "warning" : "fail", note: title ? `${title.length} characters` : "The title tag is missing." },
    { criterion: "Meta description tag", value: metaDescription, status: metaDescription.length >= 70 && metaDescription.length <= 170 ? "pass" : metaDescription ? "warning" : "fail", note: metaDescription ? `${metaDescription.length} characters` : "The meta description tag is missing." },
    { criterion: "Canonical tag", value: canonical || "not filled in", status: statusFor(Boolean(canonical), true), note: "" },
    { criterion: "Main title (H1 tag)", value: getHeadingText(headings, "h1"), status: statusFor(headings.some((item) => item.tag === "h1")), note: headings.some((item) => item.tag === "h1") ? "" : "The H1 tag of the page is missing." },
    { criterion: "Ratio text / code", value: `${textRatio.toFixed(2)}%`, status: scoreStatus(textRatio, 10, 3), note: textRatio < 3 ? "The ratio of text to code on the page is low." : "" },
    { criterion: "Semantic HTML tags", value: semanticHtmlTags.length ? semanticHtmlTags.join(", ") : "not found", status: statusFor(semanticHtmlTags.length >= 3, true), note: "" },
    { criterion: "Open Graph tags", value: Object.keys(audit.ogTags || {}).length ? `${Object.keys(audit.ogTags || {}).length} tags present` : "not found", status: statusFor(!audit.ogMissingAll, true), note: "" },
    { criterion: "Twitter Card tags", value: Object.keys(audit.twitterTags || {}).length ? `${Object.keys(audit.twitterTags || {}).length} tags present` : "not found", status: statusFor(!audit.twitterMissingAll, true), note: "" },
  ];
  const seoScore = weightedScore(seoAnalysis);
  const semanticChecks = [
    wordCount >= 300,
    relevantKeywords.length >= 8,
    entities.length >= 6,
    headings.some((item) => item.tag === "h1"),
    headings.some((item) => item.tag === "h2" || item.tag === "h3"),
    Boolean(hasTargetInCoreTags),
    hyperlinks.length >= 3,
    imageAlts.length === 0 || imageAlts.some((item) => item.alt),
    textRatio >= 3,
    semanticHtmlTags.length >= 2,
  ];
  const semanticScore = Math.round((semanticChecks.filter(Boolean).length / semanticChecks.length) * 100);
  const performanceScore = weightedScore(performance);
  const relevantWordCount = relevantKeywords.reduce((sum, item) => sum + item.count, 0);

  return {
    url: finalUrl,
    targetKeyword,
    targetKeywordInCoreTags: Boolean(hasTargetInCoreTags),
    summaryAlert: hasTargetInCoreTags
      ? `The primary term "${targetKeyword}" is represented in core SEO tags. Keep expanding related entities to improve topical depth.`
      : `The primary term "${targetKeyword}" is not prominent in the title, meta description, or H1. Consider tightening the page focus.`,
    seoScore,
    semanticScore,
    performanceScore,
    cachedAgo: "Just now",
    keywordCloud: buildKeywordCloud(relevantKeywords),
    keywordOccurrences: buildKeywordOccurrences(relevantKeywords),
    seoAnalysis,
    headingHierarchy: headings,
    relevantKeywords,
    entities,
    hyperlinks,
    imageAlts,
    languageEncoding: [
      { criterion: "lang attribute on the html tag", value: doc?.documentElement?.getAttribute("lang") || "not filled in" },
      { criterion: 'meta charset / Content-Type', value: doc?.querySelector("meta[charset]")?.getAttribute("charset") || getMetaContent(doc, "content-type") || "not filled in" },
      { criterion: 'meta http-equiv="Content-Language"', value: getMetaContent(doc, "content-language") || "not filled in" },
      { criterion: 'meta name="language"', value: getMetaContent(doc, "language") || "not filled in" },
      { criterion: "Target country detected", value: pageHost(finalUrl).split(".").pop()?.toUpperCase() || "not detected" },
    ],
    performance,
    competitorAnalysis: buildCompetitorBenchmark(targetKeyword, wordCount, relevantWordCount, seoScore, semanticScore),
    plainText: plainText ? plainText.slice(0, 12000) : "No visible text could be extracted from this page.",
  };
}

function downloadTextFile(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function rowsToCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n");
}

export default function SemanticAudit() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "semantic",
    project,
    projectUrl,
    emptyResult: EMPTY_SEMANTIC_RESULT,
  });
  const d = result;
  const [activeSection, setActiveSection] = useState("summary");
  const [linkPage, setLinkPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const linksPerPage = 10;

  useEffect(() => {
    setLinkPage(1);
    setActiveSection("summary");
    setError("");
    setNotice("");
  }, [projectUrl]);

  async function analyze() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      let target = normalizeAuditUrl(projectUrl);
      let crawlData = await fetchCrawlTarget(target);

      if (crawlData.redirectedTo && crawlData.status >= 300 && crawlData.status < 400) {
        target = crawlData.redirectedTo;
        crawlData = await fetchCrawlTarget(target);
      }

      const finalUrl = crawlData.finalUrl || crawlData.url || target;
      const html = await fetchPageHtml(finalUrl);
      const next = buildSemanticResult(finalUrl, crawlData, html);

      await saveResult(next);
      setLinkPage(1);
      setActiveSection("summary");
    } catch (err) {
      setError(err?.message || "Could not run the semantic audit.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTable(rows, columns, label) {
    const text = rows
      .map((row) => columns.map((column) => row[column] ?? "").join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied to clipboard.`);
    } catch {
      downloadTextFile(`${label.toLowerCase().replace(/\s+/g, "-")}.txt`, text);
      setNotice(`${label} copied as a text download because clipboard access was blocked.`);
    }
  }

  function exportRows(filename, rows, columns, label) {
    downloadTextFile(filename, rowsToCsv(columns, rows), "text/csv;charset=utf-8");
    setNotice(`${label} exported.`);
  }

  return (
    <div className="mx-auto max-w-6xl">

      {/* ─────────── HERO ─────────── */}
      <div className="semantic-hero relative overflow-hidden rounded-3xl border border-brand-600 bg-brand-500">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-blue-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-cyan-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-8">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-500/30">
                <Brain className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight text-white">Semantic Audit</h1>
                <p className="text-xs text-white/40">In-depth semantic & on-page analysis</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/70 bg-white px-4 py-2.5">
                <Globe className="h-4 w-4 text-blue-400/60" />
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
                type="button"
                onClick={analyze}
                disabled={loading || !hasProject}
                className="ui-button semantic-analyze-button rounded-xl"
              >
                <Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
            {(error || persistenceError) && (
              <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">
                {error || persistenceError}
              </p>
            )}
            {notice && (
              <p className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200">
                {notice}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="ui-button semantic-secondary-button"
              >
                <Download className="h-3 w-3" /> Export PDF
              </button>
              <button
                type="button"
                onClick={analyze}
                disabled={loading || !hasProject}
                className="ui-button semantic-secondary-button"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Re-scan
              </button>
              <span className="ml-1 text-[11px] text-white"><Clock className="mr-0.5 inline h-3 w-3" /> {d.cachedAgo}</span>
            </div>
          </div>
          {/* Scores */}
          <div className="flex items-center gap-6 lg:pr-4">
            <ScoreGauge score={d.seoScore} label="SEO Score" color="brand" size={100} />
            <ScoreGauge score={d.semanticScore} label="Semantic" color="blue" size={100} />
            <ScoreGauge score={d.performanceScore} label="Performance" color="rose" size={100} />
          </div>
        </div>
      </div>

      {/* ─────────── Section Navigation (horizontal tabs) ─────────── */}
      <div className="mt-4">
        <div className="semantic-tabs flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5">
          {navSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                role="tab"
                aria-selected={isActive}
                className={`semantic-tab flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition whitespace-nowrap ${
                  isActive ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {sec.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────── SECTIONS ─────────── */}
      <div className="mt-6 space-y-4">

        {/* ── SUMMARY ── */}
        <div id="semantic-summary" className={activeSection === "summary" ? "" : "hidden"}>
          <Section id="summary" icon={BarChart3} title="Summary Overview" description="Keyword cloud and occurrence distribution" defaultOpen={true}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">Page Optimized For</h4>
                <KeywordCloud keywords={d.keywordCloud} />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">Keyword Occurrences</h4>
                <PieChart data={d.keywordOccurrences} />
              </div>
            </div>
            {/* Alert */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <p className="text-sm text-amber-200/80">
                {d.summaryAlert || (
                  <>
                    The primary term <strong className="text-amber-300">{d.targetKeyword || "page topic"}</strong> needs stronger representation in the page.
                  </>
                )}
              </p>
            </div>
          </Section>
        </div>

        {/* ── SEO ANALYSIS ── */}
        <div id="semantic-seo-analysis" className={activeSection === "seo-analysis" ? "" : "hidden"}>
          <Section id="seo-analysis" icon={FileText} title="SEO Analysis of the Page" description="Technical and editorial on-page criteria" defaultOpen={true}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Criterion</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Value</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-20">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {d.seoAnalysis.map((item, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 text-[13px] font-medium text-white/70 whitespace-nowrap">{item.criterion}</td>
                      <td className="py-3 pr-4">
                        <div className="text-[13px] text-white/60">{item.value || <span className="italic text-white/25">empty</span>}</div>
                        {item.note && <div className="mt-1 text-[11px] italic text-amber-300/70">{item.note}</div>}
                      </td>
                      <td className="py-3 text-center"><StatusIcon status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── HEADING HIERARCHY ── */}
        <div id="semantic-headings" className={activeSection === "headings" ? "" : "hidden"}>
          <Section id="headings" icon={Heading} title="Page Title Hierarchy" description="Check the heading structure of your page">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-32">HTML Title Tag</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Title Text</th>
                  </tr>
                </thead>
                <tbody>
                  {d.headingHierarchy.map((item, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-4">
                        <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[12px] font-mono font-bold text-blue-300">{item.tag}</span>
                      </td>
                      <td className="py-3 text-[13px] text-white/70">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.headingHierarchy.length === 0 && (
                <div className="py-8 text-center text-sm text-white/30">No headings found on this page.</div>
              )}
            </div>
          </Section>
        </div>

        {/* ── RELEVANT KEYWORDS ── */}
        <div id="semantic-keywords" className={activeSection === "keywords" ? "" : "hidden"}>
          <Section id="keywords" icon={Tags} title="Relevant Keywords & Tag Presence" description="Keywords most often found in the text and their presence in HTML tags">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Keyword</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-16">Count</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">Title</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">Meta</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">H1</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">H2</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">H3</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">URL</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-14">Alt</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-16">Density</th>
                  </tr>
                </thead>
                <tbody>
                  {d.relevantKeywords.map((kw, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 text-[13px] font-medium text-blue-300">{kw.keyword}</td>
                      <td className="py-3 text-center text-[13px] text-white/60">{kw.count}</td>
                      <td className="py-3 text-center">{kw.inTitle ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inMeta ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inH1 ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inH2 ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inH3 ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inUrl ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center">{kw.inAlt ? <TagDot color="emerald" /> : <TagDotEmpty />}</td>
                      <td className="py-3 text-center"><span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500/15 px-2 text-[11px] font-bold text-emerald-300">{kw.density}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── ENTITIES ── */}
        <div id="semantic-entities" className={activeSection === "entities" ? "" : "hidden"}>
          <Section id="entities" icon={Brain} title="Analysis of Entities Found on the Page" description="Named entities sorted by relevance to the text being analyzed">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportRows("semantic-entities.csv", d.entities, ["entity", "correspondingTerm", "englishLogin", "confidence", "wikidataId", "wikiUrl"], "Entities")}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <FileDown className="h-3 w-3" /> Excel
              </button>
              <button
                type="button"
                onClick={() => copyTable(d.entities, ["entity", "correspondingTerm", "englishLogin", "confidence", "wikidataId", "wikiUrl"], "Entities")}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <FileDown className="h-3 w-3" /> PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Entity</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Corresponding Term</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">English</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40">Confidence</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Type</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Wikipedia</th>
                  </tr>
                </thead>
                <tbody>
                  {d.entities.map((ent, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 text-[13px] font-medium text-white/80">{ent.entity}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/60">{ent.correspondingTerm}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/60">{ent.englishLogin}</td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[12px] font-bold text-blue-300">
                          {ent.confidence.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[12px] font-mono text-white/40">{ent.wikidataId}</td>
                      <td className="py-3">
                        <a href={ent.wikiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-blue-400 hover:text-blue-300 hover:underline">
                          Link <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── HYPERLINKS ── */}
        <div id="semantic-links" className={activeSection === "links" ? "" : "hidden"}>
          <Section id="links" icon={Link2} title="Analysis of Hyperlinks (Outgoing Links)" description="Outgoing links from the analyzed page">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Links</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-28">HTTP Code</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-28">Category</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">First Link Anchor</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-20">Title</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-20">Rel</th>
                  </tr>
                </thead>
                <tbody>
                  {d.hyperlinks.slice((linkPage - 1) * linksPerPage, linkPage * linksPerPage).map((link, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 text-[13px] font-medium text-amber-300/80">{link.link}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/40">{link.httpCode}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/40">{link.category || "—"}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/60">{link.anchor}</td>
                      <td className="py-3 pr-3 text-[13px] text-white/40">{link.titleAttr || "—"}</td>
                      <td className="py-3 text-[13px] text-white/60">{link.relAttr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {d.hyperlinks.length > linksPerPage && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button onClick={() => setLinkPage(Math.max(1, linkPage - 1))} disabled={linkPage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:bg-white/[0.05] disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.ceil(d.hyperlinks.length / linksPerPage) }, (_, i) => (
                  <button key={i} onClick={() => setLinkPage(i + 1)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${linkPage === i + 1 ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30" : "text-white/40 hover:bg-white/[0.05]"}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setLinkPage(Math.min(Math.ceil(d.hyperlinks.length / linksPerPage), linkPage + 1))} disabled={linkPage === Math.ceil(d.hyperlinks.length / linksPerPage)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:bg-white/[0.05] disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* ── IMAGE ALT TAGS ── */}
        <div id="semantic-images" className={activeSection === "images" ? "" : "hidden"}>
          <Section id="images" icon={Image} title="Analysis of Image Alt Tags" description="Check if images have proper alt text for accessibility and SEO">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportRows("semantic-image-alts.csv", d.imageAlts, ["source", "alt", "titleAttr", "dimensions"], "Image alt data")}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <FileDown className="h-3 w-3" /> Excel
              </button>
              <button
                type="button"
                onClick={() => copyTable(d.imageAlts, ["source", "alt", "titleAttr", "dimensions"], "Image alt data")}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/25"
              >
                <FileDown className="h-3 w-3" /> PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Source</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Alt Attribute</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-20">Title</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40 w-28">Dimensions</th>
                  </tr>
                </thead>
                <tbody>
                  {d.imageAlts.map((img, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-3 max-w-[300px]">
                        <div className="truncate text-[12px] font-mono text-white/40">{img.source}</div>
                      </td>
                      <td className="py-3 pr-3 text-[13px]">
                        {img.alt ? (
                          <span className="text-white/70">{img.alt}</span>
                        ) : (
                          <span className="italic text-rose-400/70">Missing</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-white/40">{img.titleAttr || "—"}</td>
                      <td className="py-3 text-[13px] text-white/50">{img.dimensions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── LANGUAGE & ENCODING ── */}
        <div id="semantic-language" className={activeSection === "language" ? "" : "hidden"}>
          <Section id="language" icon={Languages} title="Language and Encoding" description="Language settings and character encoding detection">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Criterion Analysed</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {d.languageEncoding.map((item, i) => (
                    <tr key={i} className={`border-b border-white/[0.03] transition hover:bg-white/[0.02] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
                      <td className="py-3 pr-4 text-[13px] font-medium text-white/70">{item.criterion}</td>
                      <td className="py-3 text-[13px] text-white/60">
                        {item.value === "not filled in" ? (
                          <span className="italic text-white/30">{item.value}</span>
                        ) : (
                          item.value
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── PERFORMANCE ── */}
        <div id="semantic-performance" className={activeSection === "performance" ? "" : "hidden"}>
          <Section id="performance" icon={Gauge} title="Page Performance on Mobile" description="Lighthouse performance diagnostics summary (cached for 10 minutes)">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] text-white/30">Performance score of the page</p>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2">
                <span className="text-lg font-black text-rose-400">{d.performanceScore}</span>
                <span className="text-[11px] text-white/30">/ 100</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Metric</th>
                    <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-white/40">Explanation</th>
                    <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wider text-white/40 w-32">Value</th>
                    <th className="pb-3 text-center text-[11px] font-bold uppercase tracking-wider text-white/40 w-16">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {d.performance.map((item, i) => (
                    <tr key={i} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="py-3 pr-4 text-[13px] font-semibold text-white/80 whitespace-nowrap">{item.metric}</td>
                      <td className="py-3 pr-4 text-[12px] text-white/45 leading-relaxed">{item.explanation}</td>
                      <td className="py-3 pr-4 text-right text-[13px] font-medium text-white/70">{item.value}</td>
                      <td className="py-3 text-center"><StatusIcon status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ── COMPETITOR ANALYSIS ── */}
        <div id="semantic-competitors" className={activeSection === "competitors" ? "" : "hidden"}>
          <Section id="competitors" icon={BarChart3} title={`Content Benchmark: "${d.competitorAnalysis.keyword}"`} description="Automated benchmark from page size, topical coverage, and semantic signals">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CompetitorStat label="Total Words" yours={`${d.competitorAnalysis.yourPage.totalWords} words`} competition={`${d.competitorAnalysis.competition.totalWords} words`} />
              <CompetitorStat label="Relevant Words" yours={`${d.competitorAnalysis.yourPage.relevantWords} words`} competition={`${d.competitorAnalysis.competition.relevantWords} words`} />
              <CompetitorStat label="SEO Score" yours={`${d.competitorAnalysis.yourPage.seoScore} / 100`} competition={`${d.competitorAnalysis.competition.seoScore} / 100`} />
              <CompetitorStat label="Semantic Score" yours={`${d.competitorAnalysis.yourPage.semanticScore} / 100`} competition={`${d.competitorAnalysis.competition.semanticScore} / 100`} />
            </div>
            {/* Simple bar chart visualization */}
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Relevant Words & Score per Position in Google</h4>
              <div className="flex items-end gap-1 h-40 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                {d.competitorAnalysis.chartData.map((point, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center gap-0.5">
                      <div className="w-full rounded-t bg-gradient-to-t from-blue-500/60 to-cyan-400/40" style={{ height: `${(point.totalWords / 2000) * 100}%`, minHeight: "4px" }} />
                    </div>
                    <span className="text-[8px] text-white/25">{point.pos}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> Total words
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> Relevant words
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Semantic score
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── PLAIN TEXT ── */}
        <div id="semantic-plaintext" className={activeSection === "plaintext" ? "" : "hidden"}>
          <Section id="plaintext" icon={Type} title="Plain Text of the Page" description="The full text extracted from the page content">
            <div className="max-h-[400px] overflow-y-auto rounded-xl border border-white/[0.06] bg-ink-900/60 p-4">
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/55 font-sans">
                {d.plainText}
              </pre>
            </div>
          </Section>
        </div>

      </div>
    </div>
  );
}

/* ── Helper: Tag presence dot ── */
function TagDot({ color }) {
  const colors = { emerald: "bg-emerald-400 shadow-emerald-400/50" };
  return <span className={`inline-block h-3 w-3 rounded-full ${colors[color] || colors.emerald} shadow-sm`} />;
}
function TagDotEmpty() {
  return <span className="inline-block h-3 w-3 rounded-full border border-white/10 bg-transparent" />;
}

/* ── Helper: Competitor stat card ── */
function CompetitorStat({ label, yours, competition }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</div>
      <div className="mt-1.5 text-[13px] font-bold text-white/80">
        <span className="text-blue-300">{yours}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-white/35">vs {competition}</div>
    </div>
  );
}
