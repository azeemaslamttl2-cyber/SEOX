import { useEffect, useState } from "react";
import { Map, Play, ChevronDown, Globe } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import { collectDiscoveredUrls, fetchCrawlTarget, normalizeCrawlUrl } from "../../lib/siteCrawler.js";
import { loadToolResult, saveToolResult } from "../../lib/projectsApi.js";

export default function SitemapGenerator() {
  const { user } = useAuth();
  const { project, projectUrl } = useSelectedProjectDomain();
  const [url, setUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [crawling, setCrawling] = useState(false);
  const [saveError, setSaveError] = useState("");
  const userId = user?.uid || user?.id || "";

  useEffect(() => {
    setUrl(projectUrl || "");
    setResults(null);
    setSaveError("");

    if (!userId || !project?.id) return undefined;

    let cancelled = false;
    loadToolResult(userId, { projectId: project.id, toolKey: "sitemap" })
      .then((storedResult) => {
        if (cancelled || !storedResult || !Array.isArray(storedResult.pages)) return;
        setResults({
          url: storedResult.url || projectUrl,
          count: Number(storedResult.count ?? storedResult.pages.length),
          pages: storedResult.pages,
        });
      })
      .catch((error) => {
        if (!cancelled) setSaveError(error?.message || "Could not load sitemap result.");
      });

    return () => {
      cancelled = true;
    };
  }, [project?.id, projectUrl, userId]);

  async function start() {
    if (!url.trim()) return;
    setCrawling(true);
    setSaveError("");
    try {
      const root = normalizeCrawlUrl(url);
      const rootUrl = new URL(root);
      const fallbackProjectId = rootUrl.hostname.replace(/^www\./, "").toLowerCase();
      const max = Number(document.querySelector("#sitemap-max-pages")?.value || 50);
      const seen = new Set([root]);
      const queue = [root, new URL("/sitemap.xml", rootUrl.origin).toString()];
      const pages = [];
      while (queue.length && pages.length < max) {
        const next = queue.shift();
        try {
          const result = await fetchCrawlTarget(next);
          if (String(result.contentType || "").includes("html") || next.endsWith(".xml")) {
            pages.push({ loc: result.finalUrl || next, priority: pages.length === 0 ? 1.0 : 0.7, freq: pages.length === 0 ? "daily" : "weekly" });
          }
          collectDiscoveredUrls(result).forEach((raw) => {
            const normalized = normalizeCrawlUrl(raw);
            if (!normalized || seen.has(normalized)) return;
            if (new URL(normalized).hostname.replace(/^www\./, "") !== rootUrl.hostname.replace(/^www\./, "")) return;
            seen.add(normalized);
            if (queue.length + pages.length < max) queue.push(normalized);
          });
        } catch {
          /* continue */
        }
      }
      const crawlResult = { url: root, count: pages.length, pages };
      setResults(crawlResult);

      if (userId) {
        try {
          await saveToolResult(userId, {
            projectId: project?.id || fallbackProjectId,
            projectUrl: projectUrl || root,
            toolKey: "sitemap",
            result: crawlResult,
          });
        } catch (error) {
          setSaveError(error?.message || "Could not save sitemap result.");
        }
      }
    } finally {
      setCrawling(false);
    }
  }

  return (
    <div className="ctool-page space-y-4">
      <ToolHeader title="Sitemap Generator" Icon={Map} gradient="from-slate-800 via-fuchsia-800 to-violet-700" subtitle="Crawl your website and generate a sitemap.xml automatically" />

      <div className="stool-card">
        <div className="flex flex-col items-start mb-4">
          <div className="app-badge app-badge-brand">
            <Map className="h-3.5 w-3.5" />
            <span>Sitemap Generator</span>
          </div>
          <p className="ctool-help-text mt-2">Crawl your website and generate a sitemap.xml automatically</p>
        </div>

        <div className="flex gap-2">
          <div className="ctool-field flex-1">
            <Globe className="h-4 w-4" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="stool-bare-input flex-1"
              placeholder="Enter website URL (e.g., example.com)"
            />
          </div>
          <button
            onClick={start}
            disabled={crawling}
            className="ui-button ui-button-primary"
          >
            <Play className="h-4 w-4" /> {crawling ? "Crawling..." : "Start Crawl"}
          </button>
        </div>

        <button onClick={() => setAdvancedOpen(!advancedOpen)} className="schema-addlink mt-3">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /> Advanced Settings
        </button>
        {advancedOpen && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="stool-well">
              <label className="stool-label">Max Pages</label>
              <input id="sitemap-max-pages" type="number" defaultValue="50" className="stool-bare-input mt-1 w-full" />
            </div>
            <div className="stool-well">
              <label className="stool-label">Crawl Depth</label>
              <input type="number" defaultValue="5" className="stool-bare-input mt-1 w-full" />
            </div>
          </div>
        )}
      </div>

      {!results ? (
        <div className="ctool-empty">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/10">
            <Map className="h-6 w-6 text-fuchsia-400/50" />
          </div>
          <h3 className="mt-3 text-base font-bold text-white/55">Generate Your Sitemap</h3>
          <p className="mt-1 max-w-sm text-xs text-white/30">Enter your website URL above and click "Start Crawl" to discover all pages and generate a sitemap.xml file.</p>
        </div>
      ) : (
        <div className="stool-card">
          {saveError && <p className="mb-3 text-xs text-rose-300">{saveError}</p>}
          <h3 className="stool-title mb-3">Discovered {results.count} pages</h3>
          <pre className="stool-code overflow-x-auto">
{`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${results.pages.map((p) => `  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`}
          </pre>
        </div>
      )}
    </div>
  );
}
