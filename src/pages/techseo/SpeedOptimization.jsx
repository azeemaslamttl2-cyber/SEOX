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
import { buildSpeedResult, normalizeSpeedUrl } from "../../lib/speedTestResult.js";
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
  problems: { css: [], javascript: [], images: [], fonts: [], videos: [], html: [], other: [], all: [] },
  problematic_resources: [],
  problem_summary: {
    total_problematic_resources: 0,
    css: 0,
    javascript: 0,
    images: 0,
    fonts: 0,
    videos: 0,
    html: 0,
    other: 0,
  },
};

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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e5ee" strokeWidth="7" />
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
  const [openAffected, setOpenAffected] = useState({});

  useEffect(() => {
    setPagePath("");
    setOpenSections({});
    setError("");
  }, [projectUrl]);

  function toggleSection(id) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resourcesForCheck(sectionId, checkName) {
    const typeMap = {
      "Remove Unused CSS": "unused_css",
      "Remove Unused JavaScript": "unused_javascript",
      "Avoid Render Blocking": "render_blocking_resource",
      "Properly Size Images": "improperly_sized_image",
      "Serve Next-Gen Formats": "outdated_image_format",
      "Avoid Legacy JavaScript": "legacy_javascript",
      "Enable Text Compression": "uncompressed_resource",
      "Efficient Cache Policy": "short_cache_ttl",
    };
    const problemType = typeMap[checkName];
    const resources = Array.isArray(d.problematic_resources)
      ? d.problematic_resources
      : Object.values(d.problems || {}).flat().filter((item) => item?.resource_url);
    if (!problemType) return [];
    return resources.filter((resource) =>
      resource.problems?.some((problem) => problem.type === problemType)
    );
  }

  function toggleAffected(sectionId, checkName) {
    const key = `${sectionId}:${checkName}`;
    setOpenAffected((prev) => ({ ...prev, [key]: !prev[key] }));
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
        setError(pageSpeedError || "Live crawl completed. PageSpeed metrics need the PageSpeed API key to be configured in Settings > General.");
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
    <div className="">
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
                    {check.affected > 0 && (() => {
                      const affectedKey = `${section.id}:${check.name}`;
                      const affectedResources = resourcesForCheck(section.id, check.name);
                      const isOpen = Boolean(openAffected[affectedKey]);
                      return (
                        <div className="ml-8 mt-1">
                          <button
                            onClick={() => toggleAffected(section.id, check.name)}
                            className="flex items-center gap-1 text-[11px] text-blue-300 hover:underline"
                          >
                            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isOpen ? "Hide" : "Show"} {check.affected} affected resources
                          </button>
                          {isOpen && (
                            <div className="mt-2 space-y-1 border-l border-blue-400/20 pl-3">
                              {affectedResources.length ? affectedResources.map((resource) => (
                                <a
                                  key={resource.resource_url}
                                  href={resource.resource_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-start gap-2 text-[11px] text-white/60 hover:text-blue-200"
                                >
                                  <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block break-all">{resource.resource_url}</span>
                                    <span className="block text-white/35">
                                      {resource.problems?.map((problem) => problem.description).join("; ")}
                                    </span>
                                  </span>
                                </a>
                              )) : (
                                <span className="text-[11px] text-white/40">The affected URLs were not returned for this check.</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
