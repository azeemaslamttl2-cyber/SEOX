import {
  analyzeDuplicatePages,
  discoverInternalPages,
  fetchDuplicatePages,
  fetchPageHtml,
  fetchText,
  formatNumber,
  normalizeToolUrl,
  stripHtml,
  wordCount,
} from "./techSeoTools.js";
import { fetchCrawlTarget } from "./siteCrawler.js";
import { fetchProjectGscPerformance } from "./gscPerformance.js";

const STORAGE_PREFIX = "seox.projectToolChecks.";
const BING_KEY_STORAGE = "bing_webmaster_api_key";
const CHECK_VERSION = 1;
const CHECK_TTL_MS = 1000 * 60 * 60 * 12;

export const PROJECT_TOOL_DEFS = [
  { key: "speed", label: "Speed Optimization", href: "/tech-seo/speed", group: "Technical SEO" },
  { key: "eeat", label: "E-E-A-T Audit", href: "/tech-seo/eeat", group: "Technical SEO" },
  { key: "semantic", label: "Semantic Audit", href: "/tech-seo/semantic", group: "Technical SEO" },
  { key: "crawlOptimization", label: "Crawl Optimization", href: "/tech-seo/crawl", group: "Technical SEO" },
  { key: "robots", label: "Robots.txt Analyzer", href: "/tech-seo/robots", group: "Technical SEO" },
  { key: "duplicate", label: "Duplicate Checker", href: "/tech-seo/duplicate", group: "Content & Links" },
  { key: "gsc", label: "GSC Audit", href: "/tech-seo/gsc-audit", group: "Search Console" },
  { key: "bing", label: "Bing Webmaster", href: "/tech-seo/bing", group: "Search Console" },
  { key: "backlinks", label: "Backlinks Audit", href: "/tech-seo/backlinks", group: "Content & Links" },
  { key: "plagiarism", label: "Plagiarism Checker", href: "/tech-seo/plagiarism", group: "Content & Links" },
];

const CRAWL_PATTERNS = [
  { name: "Shortlinks Tags", pattern: /<link[^>]*rel=["']shortlink["'][^>]*>/gi, priority: "HIGH" },
  { name: "REST API Tag", pattern: /<link[^>]*rel=["']https:\/\/api\.w\.org\/["'][^>]*>/gi, priority: "MEDIUM" },
  { name: "RSD / WLW Link Tags", pattern: /<link[^>]*rel=["'](EditURI|wlwmanifest)["'][^>]*>/gi, priority: "LOW" },
  { name: "oEmbed Links", pattern: /<link[^>]*(type=["']application\/(json|xml)\+oembed["']|title=["']oEmbed)[^>]*>/gi, priority: "HIGH" },
  { name: "Generator Meta Tag", pattern: /<meta[^>]*name=["']generator["'][^>]*>/gi, priority: "MEDIUM" },
  { name: "WordPress Emoji Scripts", pattern: /wp-emoji-release\.min\.js|window\._wpemojiSettings|twemoji/gi, priority: "HIGH" },
  { name: "WP Embed Script", pattern: /wp-embed\.min\.js/gi, priority: "MEDIUM" },
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeProjectUrl(project) {
  const raw = String(project?.fullUrl || project?.url || project?.domain || "").trim();
  if (!raw) return "";
  return normalizeToolUrl(raw);
}

function projectId(project) {
  return project?.id || hostFromUrl(normalizeProjectUrl(project)) || "";
}

function hostFromUrl(rawUrl) {
  if (!rawUrl) return "";
  if (String(rawUrl).startsWith("sc-domain:")) return String(rawUrl).replace("sc-domain:", "").replace(/^www\./i, "").toLowerCase();
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(rawUrl).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function storageKey(project) {
  const id = typeof project === "string" ? project : projectId(project);
  return id ? `${STORAGE_PREFIX}${id}` : "";
}

function baseTool(def, status = "queued") {
  return {
    key: def.key,
    label: def.label,
    href: def.href,
    group: def.group,
    status,
    score: null,
    summary: status === "queued" ? "Waiting to run" : "",
    detail: "",
    updatedAt: null,
  };
}

function skippedTool(key, summary, detail = "") {
  const def = PROJECT_TOOL_DEFS.find((item) => item.key === key);
  return {
    ...baseTool(def, "skipped"),
    summary,
    detail,
    updatedAt: nowIso(),
  };
}

export function createEmptyProjectToolChecks(project) {
  const projectUrl = normalizeProjectUrl(project);
  return {
    version: CHECK_VERSION,
    projectId: projectId(project),
    projectUrl,
    status: projectUrl ? "idle" : "blocked",
    startedAt: null,
    updatedAt: null,
    completedAt: null,
    metrics: {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    },
    tools: Object.fromEntries(PROJECT_TOOL_DEFS.map((def) => [def.key, baseTool(def, projectUrl ? "queued" : "skipped")])),
  };
}

export function loadProjectToolChecks(project) {
  const key = storageKey(project);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CHECK_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProjectToolChecks(project, data) {
  const key = storageKey(project);
  if (!key || !data) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // sessionStorage quota or private mode should not break the dashboard.
  }
}

export function shouldRunProjectToolChecks(project, data) {
  if (!project || !normalizeProjectUrl(project)) return false;
  if (!data?.completedAt) return true;
  if (data.projectUrl !== normalizeProjectUrl(project)) return true;
  return Date.now() - new Date(data.completedAt).getTime() > CHECK_TTL_MS;
}

function parseHtml(html) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(String(html || ""), "text/html");
}

function countMatches(html, pattern) {
  return Array.from(String(html || "").matchAll(new RegExp(pattern.source, pattern.flags))).length;
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function scoreFromChecks(checks) {
  return pct(checks.filter((item) => item.pass).length, checks.length);
}

function toolResult(score, summary, detail = "", extra = {}) {
  return {
    status: "complete",
    score: Math.max(0, Math.min(100, Math.round(score || 0))),
    summary,
    detail,
    updatedAt: nowIso(),
    ...extra,
  };
}

function errorTool(error) {
  return {
    status: "error",
    score: null,
    summary: "Could not run this check",
    detail: error?.message || "The tool check failed.",
    updatedAt: nowIso(),
  };
}

async function homepageSnapshot(projectUrl) {
  const [crawl, page] = await Promise.allSettled([
    fetchCrawlTarget(projectUrl),
    fetchPageHtml(projectUrl),
  ]);
  const crawlData = crawl.status === "fulfilled" ? crawl.value : null;
  const pageData = page.status === "fulfilled" ? page.value : null;
  if (!crawlData && !pageData) {
    throw new Error(crawl.reason?.message || page.reason?.message || "Could not fetch homepage.");
  }
  const html = pageData?.html || crawlData?.html || "";
  const finalUrl = pageData?.finalUrl || crawlData?.finalUrl || crawlData?.url || projectUrl;
  const text = stripHtml(html || crawlData?.contentText || "");
  return { crawlData, pageData, html, finalUrl, text, doc: parseHtml(html) };
}

function runEeat(snapshot) {
  const { crawlData, doc, finalUrl, html, text } = snapshot;
  const links = Array.from(doc?.querySelectorAll("a[href]") || []).map((node) => `${node.getAttribute("href")} ${node.textContent || ""}`.toLowerCase());
  const images = Array.from(doc?.querySelectorAll("img") || []);
  const imagesWithAlt = images.filter((img) => String(img.getAttribute("alt") || "").trim()).length;
  const htmlLower = String(html || "").toLowerCase();
  const title = doc?.querySelector("title")?.textContent?.trim() || crawlData?.audit?.titleText || "";
  const description = doc?.querySelector('meta[name="description"]')?.getAttribute("content") || crawlData?.audit?.metaDescriptionText || "";
  const checks = [
    { pass: /^https:/i.test(finalUrl), label: "HTTPS" },
    { pass: title.length >= 10, label: "Descriptive title" },
    { pass: description.length >= 40, label: "Meta description" },
    { pass: Boolean(doc?.querySelector("h1") || crawlData?.audit?.h1Text), label: "H1" },
    { pass: wordCount(text) >= 250, label: "Substantial content" },
    { pass: /schema\.org|application\/ld\+json/i.test(html), label: "Structured data" },
    { pass: links.some((link) => link.includes("about")), label: "About signal" },
    { pass: links.some((link) => link.includes("contact") || link.includes("mailto:") || link.includes("tel:")), label: "Contact signal" },
    { pass: links.some((link) => link.includes("privacy")), label: "Privacy policy" },
    { pass: /(facebook|linkedin|twitter|instagram|youtube)\.com/i.test(htmlLower), label: "Social profiles" },
    { pass: !images.length || pct(imagesWithAlt, images.length) >= 80, label: "Image alt coverage" },
  ];
  const failed = checks.filter((item) => !item.pass).map((item) => item.label);
  const score = scoreFromChecks(checks);
  return toolResult(score, `${checks.length - failed.length}/${checks.length} trust signals passed`, failed.length ? `Needs: ${failed.slice(0, 4).join(", ")}` : "Core E-E-A-T signals were found.");
}

function runSemantic(snapshot) {
  const { doc, html, text } = snapshot;
  const words = wordCount(text);
  const headings = Array.from(doc?.querySelectorAll("h1,h2,h3") || []);
  const semanticTags = Array.from(doc?.querySelectorAll("main,article,section,header,footer,nav,aside") || []);
  const links = Array.from(doc?.querySelectorAll("a[href]") || []);
  const language = doc?.documentElement?.getAttribute("lang") || "";
  const images = Array.from(doc?.querySelectorAll("img") || []);
  const imagesWithAlt = images.filter((img) => String(img.getAttribute("alt") || "").trim()).length;
  const checks = [
    { pass: words >= 300, label: "Enough page text" },
    { pass: Boolean(doc?.querySelector("h1")), label: "H1 present" },
    { pass: headings.length >= 3, label: "Heading structure" },
    { pass: semanticTags.length >= 3, label: "Semantic HTML" },
    { pass: links.length >= 3, label: "Contextual links" },
    { pass: Boolean(language), label: "Language set" },
    { pass: /application\/ld\+json|schema\.org/i.test(html), label: "Entity/schema signals" },
    { pass: !images.length || pct(imagesWithAlt, images.length) >= 80, label: "Image context" },
  ];
  const failed = checks.filter((item) => !item.pass).map((item) => item.label);
  const score = scoreFromChecks(checks);
  return toolResult(score, `${formatNumber(words)} words, ${headings.length} headings`, failed.length ? `Needs: ${failed.slice(0, 4).join(", ")}` : "Semantic structure looks healthy.");
}

async function runRobots(projectUrl) {
  const robotsUrl = new URL("/robots.txt", new URL(projectUrl).origin).toString();
  const text = await fetchText(robotsUrl);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasUserAgent = /^user-agent:/im.test(text);
  const hasSitemap = /^sitemap:/im.test(text);
  const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(?:#.*)?$/im.test(text);
  const checks = [
    { pass: lines.length > 0, label: "robots.txt accessible" },
    { pass: hasUserAgent, label: "User-agent directives" },
    { pass: hasSitemap, label: "Sitemap declared" },
    { pass: !blocksAll, label: "Site not fully blocked" },
  ];
  const score = scoreFromChecks(checks);
  return toolResult(score, hasSitemap ? "robots.txt found with sitemap" : "robots.txt found", blocksAll ? "Robots.txt appears to block all crawlers." : `${lines.length} directive lines found.`);
}

function runCrawlOptimization(snapshot) {
  const { crawlData, html } = snapshot;
  const audit = crawlData?.audit || {};
  const checks = CRAWL_PATTERNS.map((item) => ({
    pass: countMatches(html, item.pattern) === 0,
    label: item.name,
    priority: item.priority,
  }));
  checks.push({ pass: !audit.noindex, label: "Robots indexable", priority: "HIGH" });
  checks.push({ pass: !audit.metaRefreshRedirect, label: "No meta refresh", priority: "HIGH" });
  checks.push({ pass: Boolean(audit.canonicalUrl || /rel=["']canonical["']/i.test(html)), label: "Canonical present", priority: "MEDIUM" });
  const found = checks.filter((item) => !item.pass);
  const score = scoreFromChecks(checks);
  return toolResult(score, `${checks.length - found.length}/${checks.length} crawl checks clean`, found.length ? `Found: ${found.slice(0, 4).map((item) => item.label).join(", ")}` : "No obvious crawl bloat detected.");
}

async function runSpeed(projectUrl, snapshot) {
  let lighthouse = null;
  try {
    const response = await fetch(`/api/pagespeed?url=${encodeURIComponent(projectUrl)}&strategy=mobile&category=performance,best-practices`);
    if (response.ok) lighthouse = await response.json();
  } catch {
    lighthouse = null;
  }
  const lighthouseScore = lighthouse?.lighthouseResult?.categories?.performance?.score;
  const loadTime = snapshot.crawlData?.loadTime || 0;
  const resources = Array.isArray(snapshot.crawlData?.resources) ? snapshot.crawlData.resources.length : 0;
  const fallbackScore = Math.max(20, 100 - Math.round(loadTime / 80) - Math.max(0, resources - 80));
  const score = Number.isFinite(lighthouseScore) ? lighthouseScore * 100 : fallbackScore;
  const lcp = lighthouse?.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue;
  return toolResult(score, lcp ? `LCP ${lcp}` : `${loadTime || "Unknown"} ms crawler response`, resources ? `${resources} resources discovered.` : "PageSpeed API unavailable; score uses live crawler timing.");
}

async function runDuplicate(projectUrl) {
  const pagesToScan = await discoverInternalPages(projectUrl, 6);
  const { pages, skipped } = await fetchDuplicatePages(pagesToScan);
  if (pages.length < 2) {
    return toolResult(100, `${pages.length} crawlable page found`, skipped.length ? `${skipped.length} page(s) skipped.` : "Not enough pages for duplicate comparison.");
  }
  const analyzed = analyzeDuplicatePages(pages);
  return toolResult(analyzed.summary.uniquePercent, `${analyzed.summary.uniquePercent}% unique content`, `${analyzed.summary.pagesScanned} pages scanned, ${analyzed.summary.pagesWithDups} with repeated text.`, {
    summaryData: analyzed.summary,
  });
}

function findMatchingSite(entries, projectUrl) {
  const host = hostFromUrl(projectUrl);
  const origin = new URL(projectUrl).origin.replace(/\/$/, "").toLowerCase();
  const match = entries.find((entry) => {
    const siteUrl = entry?.siteUrl || entry?.url || entry;
    if (String(siteUrl).startsWith("sc-domain:")) return hostFromUrl(siteUrl) === host;
    return hostFromUrl(siteUrl) === host || String(siteUrl || "").replace(/\/$/, "").toLowerCase() === origin;
  });
  return match?.siteUrl || match?.url || match || "";
}

async function runGsc(projectUrl, userId) {
  const result = await fetchProjectGscPerformance(projectUrl, { userId });
  if (result.status !== "complete") {
    return skippedTool("gsc", result.summary || "Connect GSC", result.detail || "Search Console data is not available.");
  }
  return toolResult(100, `${formatNumber(result.metrics.clicks)} clicks from GSC`, `${formatNumber(result.metrics.impressions)} impressions in the last ${result.range.days} days.`, {
    siteUrl: result.siteUrl,
    metrics: result.metrics,
    previousMetrics: result.previousMetrics,
    deltas: result.deltas,
  });
}

async function bingApi(action, apiKey, params = {}) {
  const url = new URL("/api/webmaster-api", window.location.origin);
  url.searchParams.set("service", "bing");
  url.searchParams.set("action", action);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Bing API returned HTTP ${response.status}`);
  return payload;
}

async function runBing(projectUrl) {
  const apiKey = sessionStorage.getItem(BING_KEY_STORAGE);
  if (!apiKey) return skippedTool("bing", "Add Bing API key", "Bing Webmaster requires an API key.");
  const sitesPayload = await bingApi("getSites", apiKey);
  const siteUrl = findMatchingSite(sitesPayload.d || sitesPayload.sites || [], projectUrl);
  if (!siteUrl) return skippedTool("bing", "No matching Bing site", `Verify ${hostFromUrl(projectUrl)} in Bing Webmaster.`);
  const statsPayload = await bingApi("getStats", apiKey, { siteUrl });
  const rows = statsPayload.d || statsPayload.queries || [];
  const totals = rows.reduce((acc, row) => {
    acc.clicks += row.Clicks || row.clicks || 0;
    acc.impressions += row.Impressions || row.impressions || 0;
    return acc;
  }, { clicks: 0, impressions: 0 });
  return toolResult(100, `${formatNumber(totals.clicks)} Bing clicks`, `${formatNumber(totals.impressions)} impressions from Bing Webmaster.`, {
    siteUrl,
    metrics: totals,
  });
}

export async function runProjectToolChecks(project, { userId, onUpdate } = {}) {
  const projectUrl = normalizeProjectUrl(project);
  let state = createEmptyProjectToolChecks(project);
  state.status = "running";
  state.startedAt = nowIso();
  state.updatedAt = state.startedAt;

  const publish = () => {
    state = { ...state, tools: { ...state.tools }, metrics: { ...state.metrics } };
    saveProjectToolChecks(project, state);
    onUpdate?.(state);
  };

  const setTool = (key, update) => {
    state.tools[key] = { ...state.tools[key], ...update };
    if (key === "gsc" && update.metrics) state.metrics = update.metrics;
    state.updatedAt = nowIso();
    publish();
  };

  const runTool = async (key, runner) => {
    setTool(key, { status: "running", summary: "Running check", detail: "", updatedAt: nowIso() });
    try {
      const result = await runner();
      setTool(key, result);
    } catch (error) {
      setTool(key, errorTool(error));
    }
  };

  publish();

  let snapshot = null;
  const getSnapshot = async () => {
    if (!snapshot) snapshot = await homepageSnapshot(projectUrl);
    return snapshot;
  };

  await runTool("robots", () => runRobots(projectUrl));
  await runTool("eeat", async () => runEeat(await getSnapshot()));
  await runTool("semantic", async () => runSemantic(await getSnapshot()));
  await runTool("crawlOptimization", async () => runCrawlOptimization(await getSnapshot()));
  await runTool("speed", async () => runSpeed(projectUrl, await getSnapshot()));
  await runTool("duplicate", () => runDuplicate(projectUrl));
  await runTool("gsc", () => runGsc(projectUrl, userId));
  await runTool("bing", () => runBing(projectUrl));

  setTool("backlinks", skippedTool("backlinks", "Upload backlink export", "Backlinks Audit needs an Ahrefs, Semrush, CSV, or TSV export."));
  setTool("plagiarism", skippedTool("plagiarism", "Credentials required", "Plagiarism Checker needs DataForSEO credentials or server configuration."));

  state.status = "complete";
  state.completedAt = nowIso();
  state.updatedAt = state.completedAt;
  publish();
  return state;
}

export function averageCompletedScore(tools = {}) {
  const scores = Object.values(tools)
    .map((tool) => (tool?.status === "complete" && Number.isFinite(tool.score) ? tool.score : null))
    .filter((score) => score !== null);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
}
