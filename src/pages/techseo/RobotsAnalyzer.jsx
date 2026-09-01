import { useEffect, useState } from "react";
import {
  Bot,
  Search,
  Download,
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Sparkles,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { fetchCrawlTarget } from "../../lib/siteCrawler.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";

const PROXY_PATH = "/api/proxy";
const EMPTY_ROBOTS_RESULT = {
  url: "",
  robotsContent: "",
  sitemaps: [],
  totalChecks: 0,
  passed: 0,
  notFound: 0,
  checks: [],
};

function robotsUrlFor(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Enter a domain or URL to analyze.");
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL("/robots.txt", new URL(base).origin).toString();
}

function hasPattern(text, pattern) {
  return pattern.test(text);
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

async function fetchRobotsText(robotsUrl) {
  const path = `${PROXY_PATH}?url=${encodeURIComponent(robotsUrl)}`;
  let lastError = null;

  for (const endpoint of getApiUrls(path)) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "text/plain,*/*",
          "Cache-Control": "no-cache",
        },
      });
      const text = await response.text();
      if (response.ok) return text;
      if (response.status === 404) return "";
      lastError = new Error(text || `robots.txt fetch failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return "";
}

function extractSitemaps(robotsContent) {
  return Array.from(robotsContent.matchAll(/^sitemap:\s*(.+)$/gim), (match) => match[1].trim()).filter(Boolean);
}

function getRuleGroups(robotsContent) {
  const groups = [];
  let current = { agents: [], allows: [], disallows: [] };

  for (const rawLine of String(robotsContent || "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;

    const [, key = "", value = ""] = line.match(/^([^:]+):\s*(.*)$/) || [];
    const normalizedKey = key.toLowerCase();
    const normalizedValue = value.trim();

    if (normalizedKey === "user-agent") {
      if (current.agents.length && (current.allows.length || current.disallows.length)) {
        groups.push(current);
        current = { agents: [], allows: [], disallows: [] };
      }
      current.agents.push(normalizedValue.toLowerCase());
    } else if (normalizedKey === "allow") {
      current.allows.push(normalizedValue);
    } else if (normalizedKey === "disallow") {
      current.disallows.push(normalizedValue);
    }
  }

  if (current.agents.length || current.allows.length || current.disallows.length) groups.push(current);
  return groups;
}

function groupForBot(groups, bot) {
  const lowered = bot.toLowerCase();
  return groups.find((group) => group.agents.includes(lowered)) || groups.find((group) => group.agents.includes("*"));
}

function isBotBlocked(robotsContent, bot) {
  const group = groupForBot(getRuleGroups(robotsContent), bot);
  if (!group) return false;
  return group.disallows.some((rule) => rule.trim() === "/") && !group.allows.some((rule) => rule.trim() === "/");
}

function blocksAllCrawling(robotsContent) {
  return isBotBlocked(robotsContent, "*");
}

function check(name, desc, passed, passBadge = "Found", failBadge = "Not Found") {
  return {
    name,
    desc,
    status: passed ? "pass" : "notfound",
    badge: passed ? passBadge : failBadge,
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

function buildRobotsResult(input, crawlResult, isWooCommerce) {
  const content = crawlResult.rawText || crawlResult.text || "";
  const robotsContent = content || "# robots.txt not found or not readable";
  const sitemaps = [...new Set([...(crawlResult.sitemaps || []), ...extractSitemaps(robotsContent)])];
  const isAccessible = crawlResult.status >= 200 && crawlResult.status < 300 && Boolean(content.trim());
  const allBlocked = blocksAllCrawling(robotsContent);
  const rules = [
    check("Robots.txt Accessible", "robots.txt should return a successful response", isAccessible, `HTTP ${crawlResult.status}`, `HTTP ${crawlResult.status || 0}`),
    check("Sitemap Declared", "XML sitemap URL is declared in robots.txt", sitemaps.length > 0, `${sitemaps.length} sitemap(s)`),
    check("All Crawling Not Blocked", "The default crawler group should not block the entire site", !allBlocked, "Not blocked", "Blocked"),
    check("Googlebot Allowed", "Googlebot can crawl the site", !isBotBlocked(robotsContent, "googlebot"), "Allowed", "Blocked"),
    check("Search URLs Blocked", "Blocks internal search results from indexing", hasPattern(robotsContent, /disallow:\s*(\/search|\/\?s=|\*s=|\*\?s=)/im)),
    check("WordPress Admin Protected", "Prevents crawling of WordPress admin endpoints", hasPattern(robotsContent, /disallow:\s*\/wp-admin/im)),
    check("WordPress JSON API Blocked", "Prevents crawling of WordPress REST API endpoints", hasPattern(robotsContent, /disallow:\s*\/wp-json/im)),
    check("REST Route Blocked", "Blocks REST route parameter access", hasPattern(robotsContent, /disallow:\s*\/?\?rest_route=/im)),
    check("URL Parameters Blocked", "Prevents crawling of common parameterized URLs", hasPattern(robotsContent, /disallow:\s*(\*?\?.*|.*\*)/im)),
    check("Ahrefs Crawler Blocked", "Blocks Ahrefs SEO crawler", hasPattern(robotsContent, /user-agent:\s*ahrefsbot/im)),
    check("Semrush Crawler Blocked", "Blocks Semrush crawler", hasPattern(robotsContent, /user-agent:\s*semrushbot/im)),
    check("Moz Crawler Blocked", "Blocks Moz SEO crawler", hasPattern(robotsContent, /user-agent:\s*(rogerbot|dotbot)/im)),
    check("Majestic Crawler Blocked", "Blocks Majestic SEO crawler", hasPattern(robotsContent, /user-agent:\s*(mj12bot|majestic)/im)),
    check("Wayback Machine Blocked", "Blocks Archive.org crawler if that is part of your policy", hasPattern(robotsContent, /user-agent:\s*(ia_archiver|archive\.org_bot)/im)),
    check("Bad Bots Blocked", "Blocks known scrapers or aggressive crawlers", hasPattern(robotsContent, /(dotbot|mj12bot|megaindex|barkrowler|bytespider|petalbot)/im)),
    ...(isWooCommerce
      ? [
          check("Cart Blocked", "WooCommerce cart should not be crawled", hasPattern(robotsContent, /disallow:\s*\/cart/im)),
          check("Checkout Blocked", "WooCommerce checkout should not be crawled", hasPattern(robotsContent, /disallow:\s*\/checkout/im)),
          check("My Account Blocked", "WooCommerce account pages should not be crawled", hasPattern(robotsContent, /disallow:\s*\/my-account/im)),
          check("Add-to-cart Parameters Blocked", "WooCommerce cart parameters should not be crawled", hasPattern(robotsContent, /add-to-cart|orderby|filter/im)),
        ]
      : []),
  ];

  return {
    url: robotsUrlFor(input),
    robotsContent,
    sitemaps,
    totalChecks: rules.length,
    passed: rules.filter((item) => item.status === "pass").length,
    notFound: rules.filter((item) => item.status !== "pass").length,
    checks: rules,
  };
}

export default function RobotsAnalyzer() {
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result: d, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "robots",
    project,
    projectUrl,
    emptyResult: EMPTY_ROBOTS_RESULT,
  });
  const [isWooCommerce, setIsWooCommerce] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [projectUrl]);

  function currentRobotsUrl() {
    try {
      return robotsUrlFor(d.url || projectUrl);
    } catch {
      return "";
    }
  }

  function buildReportText() {
    const robotsUrl = currentRobotsUrl();
    return [
      "PGC Robots.txt Analysis",
      robotsUrl ? `URL: ${robotsUrl}` : `Input: ${displayUrl}`,
      `Checks: ${passedCount} passed, ${notFoundCount} not found`,
      "",
      "Checks",
      ...d.checks.map((item) => `- [${item.status === "pass" ? "PASS" : "NOT FOUND"}] ${item.name}: ${item.desc} (${item.badge})`),
      "",
      d.sitemaps?.length ? "Sitemaps" : "",
      ...(d.sitemaps || []).map((item) => `- ${item}`),
      d.sitemaps?.length ? "" : "",
      "robots.txt",
      d.robotsContent,
    ].filter((line, index, lines) => line || lines[index - 1]).join("\n");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(d.robotsContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadTextFile("robots.txt", d.robotsContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownloadReport() {
    downloadTextFile("robots-analysis-report.txt", buildReportText());
  }

  function handleDownloadRobots() {
    downloadTextFile("robots.txt", d.robotsContent);
  }

  function handleOpenRobots() {
    const robotsUrl = currentRobotsUrl();
    if (robotsUrl) window.open(robotsUrl, "_blank", "noopener,noreferrer");
  }

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError("");
    try {
      if (!hasProject) throw new Error("Select a website in the nav before running this audit.");
      const robotsUrl = robotsUrlFor(projectUrl);
      const result = await fetchCrawlTarget(robotsUrl);
      const rawText = await fetchRobotsText(robotsUrl);
      await saveResult(buildRobotsResult(projectUrl, { ...result, rawText }, isWooCommerce));
    } catch (err) {
      setError(err?.message || "Could not fetch robots.txt");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const passedCount = d.checks.filter((c) => c.status === "pass").length;
  const notFoundCount = d.checks.filter((c) => c.status === "notfound").length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="robots-hero rounded-2xl border border-brand-600 bg-brand-500 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Robots.txt Analyzer</h1>
            <p className="text-sm text-white">Fetch and analyze robots.txt files for SEO best practices</p>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleDownloadReport}
            className="ui-button robots-report-button"
          >
            <Download className="h-3.5 w-3.5" /> Download Report
          </button>
        </div>
      </div>

      {/* ─── Generator promo ─── */}
      <div className="robots-promo mt-4 flex items-center justify-between rounded-2xl px-5 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5" />
          <div>
            <span className="text-sm font-semibold">Need a custom robots.txt?</span>
            <span className="ml-2 rounded bg-college-green px-1.5 py-0.5 text-[10px] font-bold text-white">New Tool</span>
            <p className="text-xs">Use our advanced generator to create the perfect robots.txt file for your site</p>
          </div>
        </div>
        <Link
          to="/seo-tools/robots-generator"
          className="robots-promo-button ui-button"
        >
          Try Generator <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* ─── URL Input ─── */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-sm font-semibold text-white/60 mb-3">Enter Domain URL</div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
            <Globe className="h-4 w-4 text-white/40" />
            <input
              value={displayUrl}
              readOnly
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyze();
              }}
              className="flex-1 cursor-not-allowed bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
              placeholder="Select a website in the nav"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !hasProject}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className={`h-4 w-4 ${isAnalyzing ? "animate-pulse" : ""}`} /> {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {(error || persistenceError) && <p className="mt-3 text-xs font-semibold text-rose-300">{error || persistenceError}</p>}
        <label className="mt-3 flex items-center gap-2 text-xs text-white/50">
          <input
            type="checkbox"
            checked={isWooCommerce}
            onChange={(e) => setIsWooCommerce(e.target.checked)}
            className="accent-brand-500 h-3.5 w-3.5 rounded"
          />
          WooCommerce Site
          <span className="text-white/30">(Include cart, checkout, product sitemap checks)</span>
        </label>
      </div>

      {/* ─── Results: Two-column layout ─── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left: Analysis Results */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <div>
              <div className="font-display text-base font-bold">Analysis Results</div>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> {passedCount} passed
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-white/30" /> {notFoundCount} not found
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {d.checks.map((check, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {check.status === "pass" ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-white/25" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">{check.name}</div>
                    <div className="text-[11px] text-white/35">{check.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      check.status === "pass"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {check.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: robots.txt Content */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              <div className="font-display text-base font-bold">robots.txt Content</div>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                {d.robotsContent.split("\n").length} lines
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08]"
              >
                <Copy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownloadRobots}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08]"
              >
                <Download className="h-3 w-3" /> Download
              </button>
              <button
                type="button"
                onClick={handleOpenRobots}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08]"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink-800 overflow-hidden">
            <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-emerald-300/80 font-mono">
              {d.robotsContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
