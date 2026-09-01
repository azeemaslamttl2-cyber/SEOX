import { useEffect, useState } from "react";
import {
  Zap,
  Search,
  Download,
  RefreshCw,
  Clock,
  Globe,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Code,
  ExternalLink,
  AlertTriangle,
  Info,
} from "lucide-react";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { downloadTextFile, fetchPageHtml, normalizeToolUrl, csvEscape } from "../../lib/techSeoTools.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_CRAWL_RESULT = {
  url: "",
  pageSourceSize: "0 KB",
  totalChecks: 0,
  clean: 0,
  highPriority: 0,
  medium: 0,
  low: 0,
  sections: [],
};

const CRAWL_CHECKS = [
  { id: "shortlinks", name: "Shortlinks Tags", pattern: /<link[^>]*rel=["']shortlink["'][^>]*>/gi, priority: "HIGH", category: "metadata", desc: "Shortlinks add unnecessary code and potential redirect chains" },
  { id: "rest_api_tag", name: "REST API Tag", pattern: /<link[^>]*rel=["']https:\/\/api\.w\.org\/["'][^>]*>/gi, priority: "MEDIUM", category: "metadata", desc: "Exposes WordPress REST API endpoint in HTML" },
  { id: "rsd_wlw", name: "RSD / WLW Link Tags", pattern: /<link[^>]*rel=["'](EditURI|wlwmanifest)["'][^>]*>/gi, priority: "LOW", category: "metadata", desc: "Legacy blog editing protocol links" },
  { id: "oembed", name: "oEmbed Links", pattern: /<link[^>]*(type=["']application\/(json|xml)\+oembed["']|title=["']oEmbed)[^>]*>/gi, priority: "HIGH", category: "metadata", desc: "oEmbed discovery links for embedding content" },
  { id: "generator", name: "Generator Meta Tag", pattern: /<meta[^>]*name=["']generator["'][^>]*>/gi, priority: "MEDIUM", category: "metadata", desc: "Reveals CMS/platform version information" },
  { id: "pingback", name: "Pingback Link", pattern: /<link[^>]*rel=["']pingback["'][^>]*>/gi, priority: "LOW", category: "metadata", desc: "Pingback URL for trackbacks" },
  { id: "rss_feed", name: "RSS Feed Links", pattern: /<link[^>]*type=["']application\/rss\+xml["'][^>]*>/gi, priority: "MEDIUM", category: "feeds", desc: "RSS feed auto-discovery links in page head" },
  { id: "comments_feed", name: "Comments Feed Links", pattern: /comments\/feed|Comments Feed/gi, priority: "MEDIUM", category: "feeds", desc: "Comments RSS feed links" },
  { id: "emoji_scripts", name: "WordPress Emoji Scripts", pattern: /wp-emoji-release\.min\.js|window\._wpemojiSettings|twemoji/gi, priority: "HIGH", category: "scripts", desc: "WordPress emoji scripts" },
  { id: "wp_embed", name: "WP Embed Script", pattern: /wp-embed\.min\.js/gi, priority: "MEDIUM", category: "scripts", desc: "WordPress embed functionality script" },
  { id: "search_url_format", name: "Search URL Uses /search/ Format", pattern: /href=["'][^"']*\/search\/[a-zA-Z0-9]/gi, priority: "MEDIUM", category: "redirects", desc: "Search URLs should usually canonicalize to a single format" },
  { id: "external_ga", name: "External Google Analytics", pattern: /googletagmanager\.com\/gtag|google-analytics\.com\/analytics/gi, priority: "LOW", category: "redirects", desc: "Consider self-hosting analytics to reduce DNS lookups" },
];

const SECTION_TITLES = {
  metadata: "Unnecessary Metadata",
  feeds: "Feed Links",
  scripts: "Scripts & Styles",
  redirects: "Redirect Optimizations",
  technical: "Indexability & Crawlability",
};

function PriorityBadge({ level }) {
  const styles = {
    HIGH: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    LOW: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${styles[level] || styles.LOW}`}>{level}</span>;
}

function issueCheck(name, desc, priority, passed, detail = "") {
  return { name, desc, priority, status: passed ? "clean" : "found", detail };
}

function regexCheck(definition, html) {
  const matches = Array.from(String(html || "").matchAll(new RegExp(definition.pattern.source, definition.pattern.flags)));
  return issueCheck(
    definition.name,
    definition.desc,
    definition.priority,
    matches.length === 0,
    matches.length ? `${matches.length} occurrence(s) found` : ""
  );
}

function buildCrawlAudit(target, crawlData, html) {
  const audit = crawlData.audit || {};
  const regexSections = CRAWL_CHECKS.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(regexCheck(item, html));
    return acc;
  }, {});

  const sections = [
    ...Object.entries(regexSections).map(([id, checks]) => ({ id, title: SECTION_TITLES[id], checks })),
    {
      id: "technical",
      title: SECTION_TITLES.technical,
      checks: [
        issueCheck("HTTP Status OK", "Page should return a crawlable 2xx status", "HIGH", crawlData.status >= 200 && crawlData.status < 300, `HTTP ${crawlData.status || 0}`),
        issueCheck("No Meta Refresh Redirect", "Meta refresh redirects waste crawl signals", "HIGH", !audit.metaRefreshRedirect, audit.metaRefreshRedirect ? "Meta refresh found" : ""),
        issueCheck("Robots Indexable", "Robots meta should not block indexing", "HIGH", !audit.noindex, audit.robotsMeta || "Noindex detected"),
        issueCheck("Canonical URL Set", "Canonical consolidates duplicate URLs", "MEDIUM", Boolean(audit.canonicalUrl), audit.canonicalUrl || "Missing canonical"),
        issueCheck("Sitemap Links Discovered", "Sitemaps help search engines discover URLs", "MEDIUM", (crawlData.sitemaps?.length || 0) > 0 || /sitemap\.xml/i.test(html), `${crawlData.sitemaps?.length || 0} sitemap(s)`),
        issueCheck("Internal Links Found", "Pages need crawlable internal links", "MEDIUM", (audit.linksCount || 0) > 0, `${audit.linksCount || 0} link(s)`),
        issueCheck("No Mixed Content", "HTTP resources on HTTPS pages reduce quality", "HIGH", (audit.mixedContentCount || 0) === 0, `${audit.mixedContentCount || 0} mixed resources`),
        issueCheck("Images Have Alt Text", "Missing alt text weakens image SEO", "LOW", (audit.missingImageAltCount || 0) === 0, `${audit.missingImageAltCount || 0} missing alt`),
        issueCheck("Reasonable HTML Size", "Huge HTML can slow crawling", "LOW", Number(crawlData.sizeKb || 0) < 500, `${crawlData.sizeKb || 0} KB`),
      ],
    },
  ];

  const all = sections.flatMap((section) => section.checks);
  return {
    url: crawlData.finalUrl || target,
    pageSourceSize: `${Math.round((html.length / 1024) * 10) / 10} KB`,
    totalChecks: all.length,
    clean: all.filter((item) => item.status === "clean").length,
    highPriority: all.filter((item) => item.status !== "clean" && item.priority === "HIGH").length,
    medium: all.filter((item) => item.status !== "clean" && item.priority === "MEDIUM").length,
    low: all.filter((item) => item.status !== "clean" && item.priority === "LOW").length,
    sections,
  };
}

export default function CrawlOptimization() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: d, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "crawlOptimization",
    project,
    projectUrl,
    emptyResult: EMPTY_CRAWL_RESULT,
  });
  const [source, setSource] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    setSource("");
    setShowSource(false);
    setOpenSections({});
    setError("");
  }, [projectUrl]);

  function toggleSection(id) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      const target = normalizeToolUrl(projectUrl);
      const [crawlData, htmlData] = await Promise.all([fetchCrawlTarget(target), fetchPageHtml(target)]);
      const next = buildCrawlAudit(target, crawlData, htmlData.html || "");
      await saveResult(next);
      setSource(htmlData.html || "");
      setOpenSections(Object.fromEntries(next.sections.map((s) => [s.id, true])));
    } catch (err) {
      setError(err?.message || "Could not analyze URL");
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    const rows = [["Section", "Check", "Priority", "Status", "Detail"]];
    d.sections.forEach((section) => {
      section.checks.forEach((item) => {
        rows.push([section.title, item.name, item.priority, item.status, item.detail || ""]);
      });
    });
    downloadTextFile(
      `crawl-optimization-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="crawl-hero rounded-3xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="crawl-title-row flex items-center justify-start">
          <div className="crawl-title">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <span className="font-display text-lg font-bold text-white">Crawl Optimization Checker</span>
            </div>
          </div>
        </div>
        <p className="crawl-description mt-3 text-sm text-white/50">
          Analyze source code for unnecessary metadata, WordPress crawl bloat, feeds, redirects, and indexability issues.
        </p>

        <div className="crawl-actions mt-4 flex items-center gap-3">
          <button onClick={downloadReport} className="ui-button crawl-secondary-button">
            <Download className="h-3.5 w-3.5" /> Download Report
          </button>
          <button onClick={analyze} disabled={loading || !hasProject} className="ui-button crawl-primary-button">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Re-analyze
          </button>
          <span className="crawl-meta flex items-center gap-1 text-xs text-white/40">
            <Clock className="h-3 w-3" /> Live source fetch
          </span>
        </div>

      <div className="crawl-input-panel mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2">
          <div className="crawl-url-field flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
            <Globe className="h-4 w-4" />
            <input
              value={displayUrl}
              readOnly
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              className="flex-1 cursor-not-allowed bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
              placeholder="Select a website in the nav"
            />
          </div>
          <button onClick={analyze} disabled={loading || !hasProject} className="ui-button crawl-analyze-button rounded-xl">
            <Search className="h-4 w-4" /> {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {(error || persistenceError) && <p className="mt-3 text-xs font-semibold text-rose-300">{error || persistenceError}</p>}
        <button onClick={() => setShowSource((value) => !value)} className="crawl-source-button mt-2 flex items-center gap-1 text-xs text-blue-300 hover:underline">
          <Code className="h-3 w-3" /> {showSource ? "Hide" : "View"} Page Source ({d.pageSourceSize})
        </button>
        {showSource && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-ink-950 p-4 text-[11px] text-white/55">
            {source || "Run an analysis to load the current page source."}
          </pre>
        )}
      </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-violet-400" />
          <span className="font-display text-base font-bold">Analysis Summary</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{d.totalChecks ? "Complete" : "Not run"}</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3">
          <SummaryCard value={d.totalChecks} label="Total Checks" />
          <SummaryCard value={d.clean} label="Clean" color="text-emerald-400" />
          <SummaryCard value={d.highPriority} label="High Priority" color="text-rose-400" />
          <SummaryCard value={d.medium} label="Medium" color="text-amber-400" />
          <SummaryCard value={d.low} label="Low" color="text-blue-400" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {d.sections.map((section) => (
          <div key={section.id} className="crawl-section overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]">
            <button onClick={() => toggleSection(section.id)} className="crawl-section-button flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]">
              <SectionIcon id={section.id} />
              <span className="font-display text-sm font-bold">{section.title}</span>
              <div className="ml-auto">
                {openSections[section.id] ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
              </div>
            </button>
            {openSections[section.id] && (
              <div className="border-t border-white/[0.04]">
                {section.checks.map((item, i) => (
                  <div key={`${item.name}-${i}`} className={`px-5 py-3 transition hover:bg-white/[0.015] ${i < section.checks.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.status === "clean" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white/90">{item.name}</span>
                            <PriorityBadge level={item.priority} />
                          </div>
                          <div className="text-[11px] text-white/35">{item.desc}</div>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${item.status === "clean" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {item.status === "clean" ? "Clean" : "Found"}
                        </span>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-400">
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                    {item.detail && <div className="mt-2 ml-8 rounded-lg bg-ink-800 px-3 py-2 text-xs font-mono text-white/50">{item.detail}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ value, label, color = "text-white" }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-center">
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-white/40">{label}</div>
    </div>
  );
}

function SectionIcon({ id }) {
  const map = {
    metadata: { label: "M", bg: "bg-violet-500/15 text-violet-200" },
    feeds: { label: "F", bg: "bg-amber-500/15 text-amber-200" },
    scripts: { label: "JS", bg: "bg-blue-500/15 text-blue-200" },
    redirects: { label: "R", bg: "bg-emerald-500/15 text-emerald-200" },
    technical: { label: "T", bg: "bg-rose-500/15 text-rose-200" },
  };
  const item = map[id] || { label: "OK", bg: "bg-white/10 text-white/60" };
  return <span className={`crawl-section-icon flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${item.bg}`}>{item.label}</span>;
}
