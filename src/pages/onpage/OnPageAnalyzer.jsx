import { useEffect, useState } from "react";
import {
  Search,
  Globe,
  Download,
  Code2,
  Target,
  Type,
  Heading1,
  Link,
  Zap,
  Image,
  Settings2,
  LayoutGrid,
  List,
  FileCode2,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";
import { onPageResult } from "../../data/onPageSeoData.js";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { fetchPageHtml } from "../../lib/techSeoTools.js";
import { getSessionToken } from "../../lib/authSession.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { saveProjectData } from "../../lib/projectsApi.js";
import { useAuth } from "../../context/AuthContext.jsx";

/* ── Score Ring ── */
function ScoreRing({ score, size = 160 }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  let color = "#10b981";
  if (score < 50) color = "#ef4444";
  else if (score < 75) color = "#f59e0b";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 40px ${color}25` }} />
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e5ee" strokeWidth="12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-black" style={{ color }}>{score}</span>
        <span className="text-xs text-white/40">Score</span>
      </div>
    </div>
  );
}

/* ── Section progress bar ── */
function SectionBar({ passed, total }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  let color = "bg-emerald-400";
  if (pct < 40) color = "bg-rose-400";
  else if (pct < 75) color = "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50">{passed}/{total} passed</span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Icon map for sections ── */
const sectionIcons = {
  target: Target,
  type: Type,
  heading: Heading1,
  link: Link,
  zap: Zap,
  image: Image,
  settings: Settings2,
  layout: LayoutGrid,
  list: List,
  code: FileCode2,
  file: FileText,
};

function normalizeAnalyzeUrl(domain, path = "") {
  const base = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const url = new URL(base);
  if (path.trim()) {
    url.pathname = path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`;
  }
  return url.toString();
}

function includesNeedle(value = "", needle = "") {
  return Boolean(needle.trim()) && value.toLowerCase().includes(needle.trim().toLowerCase());
}

function check(name, desc, passed, detail, extra = {}) {
  return {
    name,
    desc,
    detail,
    status: passed ? "pass" : "fail",
    hasDetails: Boolean(detail),
    ...extra,
  };
}

function parseAttributes(value = "") {
  const attrs = {};
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of value.matchAll(attrRe)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractMetaTags(html = "") {
  return Array.from(String(html).matchAll(/<meta\b([^>]*)>/gi), (match, index) => {
    const attrs = parseAttributes(match[1] || "");
    const key =
      attrs.name ||
      attrs.property ||
      attrs["http-equiv"] ||
      (attrs.charset ? "charset" : `meta-${index + 1}`);
    const value = attrs.content || attrs.charset || "";
    return {
      key,
      value,
      attrs,
      tag: match[0].replace(/\s+/g, " ").trim(),
    };
  });
}

function findMetaTags(metaTags, terms) {
  const needles = terms.map((term) => term.toLowerCase());
  return metaTags.filter((tag) => {
    const haystack = `${tag.key} ${tag.value} ${JSON.stringify(tag.attrs)}`.toLowerCase();
    return needles.some((term) => haystack.includes(term));
  });
}

function metaDetail(title, metaTags) {
  return {
    detailTitle: title,
    metaTags,
  };
}

function section(id, title, icon, checks) {
  return {
    id,
    title,
    icon,
    passed: checks.filter((item) => item.status === "pass").length,
    total: checks.length,
    checks,
  };
}

function buildAnalyzedResult(result, keyword, html = "") {
  const audit = result.audit || {};
  const currentUrl = result.finalUrl || result.url;
  const parsed = new URL(currentUrl);
  const slugWords = parsed.pathname.split(/[/-]+/).filter(Boolean);
  const title = audit.titleText || "";
  const meta = audit.metaDescriptionText || "";
  const h1 = audit.h1Text || "";
  const wordCount = audit.wordCount || 0;
  const imageCount = audit.imageCount || 0;
  const missingAlt = audit.missingImageAltCount || 0;
  const keywordIn = (value) => includesNeedle(value, keyword);
  const schemaText = JSON.stringify(audit.ogTags || {}) + JSON.stringify(audit.twitterTags || {});
  const hasSchema = /application\/ld\+json|"@type"|schema\.org/i.test(`${schemaText} ${html}`);
  const metaTags = extractMetaTags(html);
  const descriptionTags = findMetaTags(metaTags, ["description"]);
  const robotsTags = findMetaTags(metaTags, ["robots"]);
  const ogTags = findMetaTags(metaTags, ["og:"]);
  const twitterTags = findMetaTags(metaTags, ["twitter:"]);
  const schemaTags = findMetaTags(metaTags, ["schema", "json", "ld"]);
  const allMetaDetail = metaDetail("Extracted meta tags", metaTags);

  const sections = [
    section("keyword", "Primary Keyword Optimization", "target", [
      check("Keyword in H1 Tag", "Primary keyword should appear in the main H1 heading", keywordIn(h1), h1 ? `H1: "${h1}"` : "No H1 found"),
      check("Keyword in Title Tag", "Primary keyword should be present in the page title", keywordIn(title), title ? `Title: "${title}"` : "No title found"),
      check("Keyword in Meta Description", "Meta description should include the primary keyword", keywordIn(meta), meta ? `Meta: "${meta}"` : "No meta description found", metaDetail("Extracted description meta tag(s)", descriptionTags)),
      check("Keyword in URL", "URL slug should contain the primary keyword", keywordIn(parsed.pathname), `Path: ${parsed.pathname || "/"}`),
    ]),
    section("title", "Title Tag Optimization", "type", [
      check("Has Title Tag", "Page should have a title tag", audit.titleCount === 1 && title.length > 0, `Found ${audit.titleCount || 0} title tag(s)`),
      check("Title 50-60 Characters", "Optimal title length for search display", title.length >= 50 && title.length <= 60, `Title length: ${title.length}`),
      check("Title Has Numbers", "Numbers can improve search-result clarity", /\d/.test(title), /\d/.test(title) ? "Number found in title" : "No number in title"),
      check("Title Has Current Year", "Freshness signals can help time-sensitive pages", /20(2[4-9]|3\d)/.test(title), /20(2[4-9]|3\d)/.test(title) ? "Recent year found" : "No recent year in title"),
    ]),
    section("h1", "H1 Tag Optimization", "heading", [
      check("Only One H1 Tag", "Page should have exactly one H1 heading", audit.h1Count === 1, `Found ${audit.h1Count || 0} H1 tag(s)`),
      check("H1 Length 20-70 Characters", "H1 should be descriptive but not too long", h1.length >= 20 && h1.length <= 70, `H1 length: ${h1.length}`),
    ]),
    section("url", "URL Structure", "link", [
      check("Uses Hyphens", "URLs should use hyphens as word separators", !parsed.pathname.includes("_"), `Path: ${parsed.pathname}`),
      check("URL is Lowercase", "Avoid capital letters in URLs", parsed.pathname === parsed.pathname.toLowerCase(), `Path: ${parsed.pathname}`),
      check("URL Max 4 Words", "Keep URLs short and focused", slugWords.length <= 4, `URL slug has ${slugWords.length} word(s)`),
      check("URL Without Dates", "Permalinks should not include dates", !/\/20\d{2}\//.test(parsed.pathname), "Date folder not detected"),
    ]),
    section("core", "Core SEO Factors", "zap", [
      check("Has Internal Links", "Include links to other pages on your site", (audit.linksCount || 0) >= 2, `${audit.linksCount || 0} link(s) discovered`),
      check("Page is Indexable", "No noindex meta tag or robots blocking", !audit.noindex, audit.noindex ? "Noindex found" : "Page appears indexable", metaDetail("Extracted robots meta tag(s)", robotsTags)),
      check("Canonical URL Set", "Page has a canonical link element", Boolean(audit.canonicalUrl), audit.canonicalUrl || "No canonical URL found"),
      check("Meta Description Present", "Search snippets need a concise description", audit.metaDescriptionCount === 1, `Found ${audit.metaDescriptionCount || 0} meta description tag(s)`, metaDetail("Extracted description meta tag(s)", descriptionTags)),
    ]),
    section("image", "Image SEO", "image", [
      check("Images Have ALT Text", "All images should have descriptive alt attributes", imageCount === 0 || missingAlt === 0, `${imageCount} images, ${missingAlt} missing alt`),
      check("Low Missing ALT Ratio", "At least 80% of images should have alt text", imageCount === 0 || missingAlt / imageCount <= 0.2, `${imageCount - missingAlt}/${imageCount} images have alt text`),
    ]),
    section("advanced", "Advanced On-Page", "settings", [
      check("Meta Description 120-160 Chars", "Meta descriptions should be descriptive without being truncated", meta.length >= 120 && meta.length <= 160, `Meta description length: ${meta.length}`, metaDetail("Extracted description meta tag(s)", descriptionTags)),
      check("Open Graph Tags", "Social platforms need Open Graph metadata", (audit.ogMissingCount || 0) < 5, `${5 - (audit.ogMissingCount || 5)}/5 key OG tags found`, metaDetail("Extracted Open Graph meta tag(s)", ogTags)),
      check("Twitter Tags", "Twitter/X previews need card metadata", (audit.twitterMissingCount || 0) < 4, `${4 - (audit.twitterMissingCount || 4)}/4 key Twitter tags found`, metaDetail("Extracted Twitter/X meta tag(s)", twitterTags)),
      check("No Mixed Content", "HTTPS pages should not load HTTP resources", (audit.mixedContentCount || 0) === 0, `${audit.mixedContentCount || 0} mixed-content resources`),
    ]),
    section("schema", "Schema Markup Detection", "code", [
      check("Has Structured Data Signals", "Page should expose schema or rich social metadata", hasSchema || !audit.ogMissingAll, hasSchema ? "Schema-like data detected" : "Using social metadata fallback", schemaTags.length ? metaDetail("Schema-related meta tag(s)", schemaTags) : allMetaDetail),
      check("Open Graph Complete", "Core Open Graph tags improve sharing", (audit.ogMissingCount || 0) === 0, `${audit.ogMissingCount || 0} key OG tag(s) missing`, metaDetail("Extracted Open Graph meta tag(s)", ogTags)),
    ]),
    section("content", "Content Depth", "file", [
      check("Visible Content 300+ Words", "Thin pages usually underperform", wordCount >= 300, `${wordCount} visible word(s)`),
      check("Visible Content 800+ Words", "Deep pages usually cover intent better", wordCount >= 800, `${wordCount} visible word(s)`),
    ]),
  ];

  const totalChecks = sections.reduce((sum, item) => sum + item.total, 0);
  const passed = sections.reduce((sum, item) => sum + item.passed, 0);
  const failed = totalChecks - passed;

  return {
    url: currentUrl,
    pagePath: parsed.pathname === "/" ? "" : parsed.pathname,
    keyword,
    pageSource: `${Number(result.sizeKb || 0).toLocaleString()} KB`,
    score: Math.round((passed / Math.max(totalChecks, 1)) * 100),
    totalChecks,
    passed,
    failed,
    manual: 0,
    sections,
  };
}

export default function OnPageAnalyzer() {
  const { user } = useAuth();
  const { project, projectUrl } = useSelectedProjectDomain();
  const [d, setResult] = useState(onPageResult);
  const [url, setUrl] = useState("");
  const [pagePath, setPagePath] = useState(d.pagePath);
  const [keyword, setKeyword] = useState(d.keyword);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState(
    Object.fromEntries(d.sections.map((s) => [s.id, true]))
  );
  const [openDetails, setOpenDetails] = useState({});

  useEffect(() => {
    setUrl(projectUrl);

    const savedAnalysis = project?.project_data?.onPageAnalysis;
    if (!savedAnalysis) return;

    setResult(savedAnalysis);
    setPagePath(savedAnalysis.pagePath || "");
    setKeyword(savedAnalysis.keyword || "");
    setOpenSections(
      Object.fromEntries((savedAnalysis.sections || []).map((section) => [section.id, true]))
    );
    setOpenDetails({});
  }, [project?.id, project?.project_data?.onPageAnalysis, projectUrl]);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError("");
    try {
      const target = normalizeAnalyzeUrl(url, pagePath);
      const token = getSessionToken();
      const requestOptions = { headers: { Authorization: token ? `Bearer ${token}` : "" } };
      const [result, page] = await Promise.all([
        fetchCrawlTarget(target, requestOptions),
        fetchPageHtml(target, requestOptions).catch(() => ({ html: "" })),
      ]);
      const analyzed = buildAnalyzedResult(result, keyword, page.html || "");
      if (user?.uid && project?.id) {
        await saveProjectData(user.uid, {
          projectId: project.id,
          key: "onPageAnalysis",
          value: {
            ...analyzed,
            analyzedAt: new Date().toISOString(),
          },
        });
      }
      setResult(analyzed);
      setUrl(projectUrl);
      setPagePath(analyzed.pagePath);
      setOpenSections(Object.fromEntries(analyzed.sections.map((s) => [s.id, true])));
      setOpenDetails({});
    } catch (err) {
      setError(err?.message || "Could not analyze this URL");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function toggleSection(id) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleDetails(sectionId, checkIndex) {
    const key = `${sectionId}-${checkIndex}`;
    setOpenDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="on-page-analyzer mx-auto max-w-5xl">

      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        {/* Ambient effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/[0.06] blur-[80px]" />
          <div className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-amber-500/[0.04] blur-[60px]" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
          />
        </div>

        <div className="relative z-10 p-6 lg:p-8">
          {/* Title */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-amber-500 shadow-lg shadow-brand-500/20">
              <Search className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight text-white">
              On-Page SEO Analyzer
            </h1>
          </div>
          <p className="mt-2 text-center text-sm text-white/40">
            Enter a URL and your target keyword to analyze 40+ on-page SEO factors across 9 categories
          </p>

          {/* Input fields */}
          <div className="mt-6 flex items-stretch gap-px overflow-hidden rounded-2xl border border-white/[0.08]">
            {/* URL */}
            <div className="flex flex-1 items-center gap-2 bg-ink-900/80 px-4 py-3">
              <Globe className="h-4 w-4 text-brand-400" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                placeholder="https://www.example.com"
              />
            </div>
            {/* Page path */}
            <div className="flex items-center bg-ink-900/60 px-4 py-3 border-l border-white/[0.06]">
              <input
                value={pagePath}
                onChange={(e) => setPagePath(e.target.value)}
                className="w-44 bg-transparent text-sm text-white/60 placeholder:text-white/20 focus:outline-none"
                placeholder="/page-path (optional, leave empty for homepage)"
              />
            </div>
            {/* Keyword */}
            <div className="flex items-center gap-2 bg-ink-900/60 px-4 py-3 border-l border-white/[0.06]">
              <Target className="h-4 w-4 text-amber-400/60" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-52 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
                placeholder="Enter primary keyword (e.g., best running shoes)"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? <RefreshIcon /> : <Search className="h-4 w-4" />} {isAnalyzing ? "Analyzing..." : "Analyze On-Page SEO"}
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/[0.07]">
              <Download className="h-4 w-4" /> Download Report
            </button>
          </div>

          {/* View source link */}
          <div className="mt-3 flex justify-center">
            <button className="analyzer-source-button flex items-center gap-1.5 text-xs text-brand-300 hover:underline">
              <Code2 className="h-3.5 w-3.5" /> View Page Source ({d.pageSource})
            </button>
          </div>
          {error && <p className="mt-3 text-center text-xs font-semibold text-rose-300">{error}</p>}
        </div>
      </div>

      {/* ─── Score + Summary ─── */}
      <div className="mt-6 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-white/90">SEO Analysis Score</h2>
          <span className="analyzer-complete-status flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </span>
        </div>

        <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
          {/* Score Ring */}
          <div className="flex justify-center lg:justify-start">
            <ScoreRing score={d.score} />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 flex-1 max-w-lg">
            <SummaryCard value={d.totalChecks} label="Total Checks" color="text-white/80" bg="border-white/[0.06]" />
            <SummaryCard value={d.passed} label="Passed" color="text-emerald-400" bg="border-emerald-500/20 bg-emerald-500/[0.03]" />
            <SummaryCard value={d.failed} label="Failed" color="text-rose-400" bg="border-rose-500/20 bg-rose-500/[0.03]" />
            <SummaryCard value={d.manual} label="Manual Review" color="text-amber-400" bg="border-amber-500/20 bg-amber-500/[0.03]" />
          </div>
        </div>
      </div>

      {/* ─── Sections ─── */}
      <div className="mt-6 space-y-3">
        {d.sections.map((section) => {
          const Icon = sectionIcons[section.icon] || Zap;
          return (
            <div key={section.id} className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-[13px] font-bold text-white/90">{section.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <SectionBar passed={section.passed} total={section.total} />
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
                  {section.checks.map((check, i) => (
                    <div
                      key={i}
                      className={`group px-5 py-4 transition hover:bg-white/[0.015] ${
                        i < section.checks.length - 1 ? "border-b border-white/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          {check.status === "pass" ? (
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            </span>
                          ) : (
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                              <XCircle className="h-4 w-4 text-rose-400" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white/85">{check.name}</span>
                              {check.isManual && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Manual Check</span>
                              )}
                              {(check.hasDetails || check.metaTags?.length > 0) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDetails(section.id, i);
                                  }}
                                  className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-300 ring-1 ring-brand-500/20 hover:bg-brand-500/20"
                                >
                                  {openDetails[`${section.id}-${i}`] ? "Hide Details" : "Show Details"}
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-white/35">{check.desc}</p>
                            {check.detail && (
                              <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                                <Info className="h-3 w-3 flex-shrink-0 text-white/25" />
                                <span className="text-[11px] text-white/50">{check.detail}</span>
                              </div>
                            )}
                            {openDetails[`${section.id}-${i}`] && (
                              <DetailsPanel check={check} />
                            )}
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            check.status === "pass"
                              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                              : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20"
                          }`}
                        >
                          {check.status === "pass" ? "Pass" : "Fail"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return <Search className="h-4 w-4 animate-pulse" />;
}

function DetailsPanel({ check }) {
  const metaTags = Array.isArray(check.metaTags) ? check.metaTags : [];

  return (
    <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand-200">
          {check.detailTitle || "Check Details"}
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/45">
          {metaTags.length} meta tag{metaTags.length === 1 ? "" : "s"}
        </span>
      </div>

      {check.detail && (
        <p className="mt-2 rounded-lg bg-ink-900/60 px-3 py-2 text-[11px] text-white/55">
          {check.detail}
        </p>
      )}

      {metaTags.length > 0 ? (
        <div className="mt-3 space-y-2">
          {metaTags.map((tag, index) => (
            <div key={`${tag.key}-${index}`} className="rounded-lg border border-white/[0.06] bg-ink-950/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-emerald-300">{tag.key}</span>
                {tag.value && <span className="max-w-full break-words text-right text-[11px] text-white/65">{tag.value}</span>}
              </div>
              <code className="mt-2 block whitespace-pre-wrap break-words rounded bg-black/20 px-2 py-1.5 text-[10px] leading-relaxed text-white/40">
                {tag.tag}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-white/[0.05] bg-ink-950/50 px-3 py-2 text-[11px] text-white/35">
          No extracted meta tags are attached to this check yet. Run Analyze to fetch the current page HTML.
        </p>
      )}
    </div>
  );
}

function SummaryCard({ value, label, color, bg }) {
  return (
    <div className={`rounded-xl border ${bg} p-3 text-center`}>
      <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-white/35">{label}</div>
    </div>
  );
}
