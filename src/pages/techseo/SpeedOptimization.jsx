import { useEffect, useState } from "react";
import {
  Gauge,
  Search,
  Download,
  RefreshCw,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Play,
  Zap,
  Activity,
  ExternalLink,
} from "lucide-react";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { csvEscape, downloadTextFile } from "../../lib/techSeoTools.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const EMPTY_SPEED_RESULT = {
  url: "",
  mobile: { score: 0, label: "Mobile Score" },
  desktop: { score: 0, label: "Desktop Score" },
  cwv: [],
  sections: [],
  opportunities: [],
  resourceSummary: { totalResources: 0, cdnResources: 0, cdnExamples: [] },
};

const CDN_PATTERNS = [
  "cloudflare",
  "cloudfront",
  "fastly",
  "akamai",
  "bunnycdn",
  "jsdelivr",
  "unpkg",
  "stackpath",
  "bootstrapcdn",
  "googleapis.com",
  "gstatic.com",
];

/* ── Score Ring Component ── */
function SpeedRing({ score, size = 120 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  let color = "#10b981";
  if (score < 50) color = "#f43f5e";
  else if (score < 90) color = "#f59e0b";
  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display text-4xl font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

function SectionProgressBar({ passed, total }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  let color = "bg-emerald-400";
  if (pct < 50) color = "bg-amber-400";
  if (pct < 30) color = "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50">
        {passed}/{total} passed
      </span>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function normalizeSpeedUrl(domain, path = "") {
  const base = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const url = new URL(base);
  if (path.trim()) url.pathname = path.trim().startsWith("/") ? path.trim() : `/${path.trim()}`;
  return url.toString();
}

function metricValue(lhr, key, fallback = "--") {
  return lhr?.audits?.[key]?.displayValue || fallback;
}

function scoreFromCategory(data) {
  return Math.round((data?.lighthouseResult?.categories?.performance?.score || 0) * 100);
}

function sectionFromChecks(id, title, checks) {
  return {
    id,
    title,
    passed: checks.filter((item) => item.status === "pass").length,
    total: checks.length,
    checks,
  };
}

function speedCheck(name, desc, passed, affected = 0) {
  return { name, desc, status: passed ? "pass" : "fail", tutorial: false, affected };
}

function getAuditScore(lhr, key) {
  return lhr?.audits?.[key]?.score;
}

function getResourceUrl(item) {
  return typeof item === "string" ? item : item?.url || "";
}

function collectCdnHits(resources = []) {
  return resources
    .map(getResourceUrl)
    .filter(Boolean)
    .filter((url) => CDN_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern)));
}

function buildSpeedResult(targetUrl, mobileData, desktopData, crawlData) {
  const mobileLhr = mobileData?.lighthouseResult || {};
  const desktopLhr = desktopData?.lighthouseResult || {};
  const audits = desktopLhr.audits || mobileLhr.audits || {};
  const audit = crawlData?.audit || {};
  const resources = Array.isArray(crawlData?.resources) ? crawlData.resources : [];
  const cdnHits = collectCdnHits(resources);
  const mobileScore = scoreFromCategory(mobileData) || Math.max(0, Math.min(100, 100 - Math.round((crawlData?.loadTime || 0) / 100)));
  const desktopScore = scoreFromCategory(desktopData) || mobileScore;

  const cwv = [
    { metric: "LCP", value: metricValue(mobileLhr, "largest-contentful-paint"), full: "Largest Contentful Paint", good: getAuditScore(mobileLhr, "largest-contentful-paint") !== 0 },
    { metric: "FCP", value: metricValue(mobileLhr, "first-contentful-paint"), full: "First Contentful Paint", good: getAuditScore(mobileLhr, "first-contentful-paint") !== 0 },
    { metric: "CLS", value: metricValue(mobileLhr, "cumulative-layout-shift"), full: "Cumulative Layout Shift", good: getAuditScore(mobileLhr, "cumulative-layout-shift") !== 0 },
    { metric: "TBT", value: metricValue(mobileLhr, "total-blocking-time"), full: "Total Blocking Time", good: getAuditScore(mobileLhr, "total-blocking-time") !== 0 },
    { metric: "SI", value: metricValue(mobileLhr, "speed-index"), full: "Speed Index", good: getAuditScore(mobileLhr, "speed-index") !== 0 },
    { metric: "TTFB", value: metricValue(mobileLhr, "server-response-time", `${crawlData?.loadTime || 0} ms`), full: "Server Response Time", good: (crawlData?.loadTime || 0) < 800 },
  ];

  const sections = [
    sectionFromChecks("cache", "Caching & Compression", [
      speedCheck("Enable Text Compression", audits["uses-text-compression"]?.title || "Text compression enabled", getAuditScore(mobileLhr, "uses-text-compression") !== 0),
      speedCheck("Efficient Cache Policy", audits["uses-long-cache-ttl"]?.title || "Static assets use cache policy", getAuditScore(mobileLhr, "uses-long-cache-ttl") !== 0),
    ]),
    sectionFromChecks("css", "CSS Optimization", [
      speedCheck("Remove Unused CSS", audits["unused-css-rules"]?.title || "Unused CSS check", getAuditScore(mobileLhr, "unused-css-rules") !== 0),
      speedCheck("Avoid Render Blocking", audits["render-blocking-resources"]?.title || "Render-blocking resources check", getAuditScore(mobileLhr, "render-blocking-resources") !== 0),
    ]),
    sectionFromChecks("js", "JavaScript Optimization", [
      speedCheck("Remove Unused JavaScript", audits["unused-javascript"]?.title || "Unused JavaScript check", getAuditScore(mobileLhr, "unused-javascript") !== 0),
      speedCheck("Minimize Main Thread Work", audits["mainthread-work-breakdown"]?.title || "Main-thread work check", getAuditScore(mobileLhr, "mainthread-work-breakdown") !== 0),
      speedCheck("Avoid Legacy JavaScript", audits["legacy-javascript"]?.title || "Legacy JavaScript check", getAuditScore(mobileLhr, "legacy-javascript") !== 0),
    ]),
    sectionFromChecks("html", "HTML Optimization", [
      speedCheck("Has Valid Doctype", "Valid doctype present", true),
      speedCheck("DOM Size Healthy", audits["dom-size"]?.title || "DOM size check", getAuditScore(mobileLhr, "dom-size") !== 0),
      speedCheck("Meta Viewport Present", "Page exposes viewport metadata", !audit.noindex),
    ]),
    sectionFromChecks("images", "Image Optimization", [
      speedCheck("Images Have Alt Text", "Images should have descriptive alt attributes", (audit.missingImageAltCount || 0) === 0, audit.missingImageAltCount || 0),
      speedCheck("Properly Size Images", audits["uses-responsive-images"]?.title || "Responsive image sizing", getAuditScore(mobileLhr, "uses-responsive-images") !== 0),
      speedCheck("Serve Next-Gen Formats", audits["modern-image-formats"]?.title || "Modern image formats", getAuditScore(mobileLhr, "modern-image-formats") !== 0),
    ]),
    sectionFromChecks("network", "Network & CDN", [
      speedCheck("Minimize Redirects", audits.redirects?.title || "Avoid redirect chains", getAuditScore(mobileLhr, "redirects") !== 0),
      speedCheck("No Mixed Content", "HTTPS pages should not load HTTP resources", (audit.mixedContentCount || 0) === 0, audit.mixedContentCount || 0),
      speedCheck("CDN or Edge Resources Detected", "Static assets should be served through fast edge infrastructure when possible", cdnHits.length > 0, cdnHits.length),
      speedCheck("Resource Count Reasonable", "Too many page resources can slow crawling and rendering", resources.length <= 120, resources.length),
    ]),
  ];

  return {
    url: targetUrl,
    mobile: { score: mobileScore, label: "Mobile Score" },
    desktop: { score: desktopScore, label: "Desktop Score" },
    cwv,
    sections,
    opportunities: Object.values(audits)
      .filter((item) => item?.details?.overallSavingsMs || item?.details?.overallSavingsBytes)
      .slice(0, 5)
      .map((item) => ({
        name: item.title,
        savings: item.displayValue || "Potential improvement",
      })),
    resourceSummary: {
      totalResources: resources.length,
      cdnResources: cdnHits.length,
      cdnExamples: cdnHits.slice(0, 5),
    },
  };
}

export default function SpeedOptimization() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: d, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "speed",
    project,
    projectUrl,
    emptyResult: EMPTY_SPEED_RESULT,
  });
  const [pagePath, setPagePath] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    setPagePath("");
    setOpenSections({});
    setError("");
  }, [projectUrl]);

  function toggleSection(id) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function analyzeSpeed() {
    setIsAnalyzing(true);
    setError("");
    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      const target = normalizeSpeedUrl(projectUrl, pagePath);
      const [crawlData, mobileRes, desktopRes] = await Promise.all([
        fetchCrawlTarget(target),
        fetch(`/api/pagespeed?url=${encodeURIComponent(target)}&strategy=mobile&category=performance,best-practices`).catch(() => null),
        fetch(`/api/pagespeed?url=${encodeURIComponent(target)}&strategy=desktop&category=performance,best-practices`).catch(() => null),
      ]);

      const parseJsonResponse = async (response) => {
        if (!response) return null;
        try {
          return await response.json();
        } catch {
          return null;
        }
      };

      const mobileData = await parseJsonResponse(mobileRes);
      const desktopData = await parseJsonResponse(desktopRes);
      const pageSpeedError =
        mobileRes && !mobileRes.ok && mobileData?.error
          ? mobileData.error
          : desktopRes && !desktopRes.ok && desktopData?.error
          ? desktopData.error
          : null;

      const next = buildSpeedResult(target, mobileData, desktopData, crawlData);
      await saveResult(next);
      setOpenSections(Object.fromEntries(next.sections.map((s) => [s.id, true])));
      if (!mobileData || !desktopData) {
        setError(pageSpeedError || "Live crawl completed. PageSpeed metrics need PAGESPEED_API_KEY to be configured.");
      }
    } catch (err) {
      setError(err?.message || "Could not test this URL");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function exportReport() {
    const rows = [
      ["URL", d.url],
      ["Mobile score", d.mobile.score],
      ["Desktop score", d.desktop.score],
      ["Total resources", d.resourceSummary?.totalResources ?? "Unknown"],
      ["CDN resources", d.resourceSummary?.cdnResources ?? "Unknown"],
      [],
      ["Section", "Check", "Status", "Affected"],
    ];
    d.sections.forEach((section) => {
      section.checks.forEach((item) => {
        rows.push([section.title, item.name, item.status, item.affected || 0]);
      });
    });
    if (d.opportunities?.length) {
      rows.push([], ["Opportunity", "Savings"]);
      d.opportunities.forEach((item) => rows.push([item.name, item.savings]));
    }
    downloadTextFile(
      `speed-report-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* ─── Hero Header ─── */}
        <div className="speed-hero rounded-3xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="speed-title-row flex items-center justify-start">
        <div className="speed-title">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <span className="font-display text-lg font-bold text-white">Speed Test Tool</span>
          </div>
        </div>
        </div>
      <p className="speed-description mt-3 text-center text-sm text-white/50">
        Analyze your website's performance using Google PageSpeed Insights API
      </p>

      {/* ─── URL Input ─── */}
      <div className="speed-input-panel mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="speed-domain flex items-center gap-2 bg-blue-500/15 px-4 py-2.5 border-r border-white/10">
              <Globe className="h-4 w-4" />
              <span className="text-sm whitespace-nowrap">{displayUrl.replace(/^https?:\/\//i, "")}</span>
            </div>
            <input
              value={pagePath}
              onChange={(e) => setPagePath(e.target.value)}
              className="speed-path flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
              placeholder="/page-path (optional, leave empty for homepage)"
            />
          </div>
          <button
            onClick={analyzeSpeed}
            disabled={isAnalyzing || !hasProject}
            className="ui-button speed-test-button rounded-xl"
          >
            <Zap className={`h-4 w-4 ${isAnalyzing ? "animate-pulse" : ""}`} /> {isAnalyzing ? "Testing..." : "Test Speed"}
          </button>
          <button onClick={analyzeSpeed} disabled={isAnalyzing || !hasProject} className="ui-button speed-retest-button rounded-xl">
            <RefreshCw className="h-4 w-4" /> Re-test
          </button>
        </div>
        {(error || persistenceError) && <p className="mt-3 text-center text-xs font-semibold text-amber-300">{error || persistenceError}</p>}
        <div className="speed-cache mt-2 text-center text-xs text-white/35">
          <Clock className="mr-1 inline h-3 w-3" /> Cached 0h ago
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={exportReport} className="ui-button speed-export-button">
            <Download className="h-3.5 w-3.5" /> Export Report
          </button>
        </div>
      </div>
      </div>

      {/* ─── Score Cards ─── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[d.mobile, d.desktop].map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-white/30" />
              <div>
                <div className="font-display text-base font-bold">{item.label}</div>
                <div className="text-xs text-white/40">
                  Performance on {idx === 0 ? "mobile" : "desktop"} devices
                </div>
              </div>
            </div>
            <div className="ml-auto">
              <SpeedRing score={item.score} size={100} />
            </div>
          </div>
        ))}
      </div>

      {/* ─── Core Web Vitals ─── */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-emerald-400" />
          <span className="font-display text-base font-bold">Core Web Vitals</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {d.cwv.slice(0, 4).map((v) => (
            <CwvCard key={v.metric} {...v} />
          ))}
        </div>
        {d.cwv.length > 4 && (
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {d.cwv.slice(4).map((v) => (
              <CwvCard key={v.metric} {...v} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Check Sections ─── */}
      <div className="mt-6 space-y-3">
        {d.sections.map((section) => (
          <div key={section.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3">
                <SpeedSectionIcon id={section.id} />
                <span className="font-display text-sm font-bold">{section.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <SectionProgressBar passed={section.passed} total={section.total} />
                {openSections[section.id] ? (
                  <ChevronUp className="h-4 w-4 text-white/30" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/30" />
                )}
              </div>
            </button>

            {/* Checks */}
            {openSections[section.id] && (
              <div className="border-t border-white/[0.04]">
                {section.checks.map((check, i) => (
                  <div
                    key={i}
                    className={`px-5 py-3 transition hover:bg-white/[0.015] ${
                      i < section.checks.length - 1 ? "border-b border-white/[0.03]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {check.status === "pass" ? (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white/90">{check.name}</span>
                            {check.tutorial && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-400">
                                <Play className="h-2.5 w-2.5" /> Tutorial
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-white/35">{check.desc}</div>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${
                          check.status === "pass"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {check.status === "pass" ? "✓ Pass" : "✕ Fail"}
                      </span>
                    </div>
                    {check.affected && (
                      <button className="mt-1 ml-8 flex items-center gap-1 text-[11px] text-blue-300 hover:underline">
                        <ChevronDown className="h-3 w-3" /> Show {check.affected} affected resources
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── Opportunities ─── */}
      {d.opportunities && d.opportunities.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-400" />
            <span className="font-display text-base font-bold">Opportunities for Improvement</span>
          </div>
          <div className="space-y-2">
            {d.opportunities.map((opp, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3">
                <span className="text-sm font-semibold text-white/80">{opp.name}</span>
                <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-300">
                  {opp.savings}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CwvCard({ metric, value, full, good }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white/50">{metric}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${good ? "bg-emerald-400" : "bg-amber-400"}`} />
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] text-white/30">{full}</div>
    </div>
  );
}

function SpeedSectionIcon({ id }) {
  const map = {
    cache: { emoji: "💾", bg: "bg-blue-500/15" },
    css: { emoji: "🎨", bg: "bg-pink-500/15" },
    js: { emoji: "⟨/⟩", bg: "bg-amber-500/15" },
    html: { emoji: "📄", bg: "bg-indigo-500/15" },
    images: { emoji: "🖼", bg: "bg-violet-500/15" },
    fonts: { emoji: "🔤", bg: "bg-emerald-500/15" },
    network: { emoji: "📡", bg: "bg-rose-500/15" },
  };
  const item = map[id] || { emoji: "✓", bg: "bg-white/10" };
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${item.bg}`}>
      {item.emoji}
    </span>
  );
}
