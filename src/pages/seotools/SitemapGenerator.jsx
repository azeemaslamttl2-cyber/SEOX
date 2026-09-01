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
    <div className="space-y-4">
      <ToolHeader title="Sitemap Generator" Icon={Map} gradient="from-slate-800 via-fuchsia-800 to-violet-700" subtitle="Crawl your website and generate a sitemap.xml automatically" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <div className="flex flex-col items-center text-center mb-4">
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-1.5">
            <Map className="h-4 w-4 text-white" />
            <span className="text-xs font-bold text-white">Sitemap Generator</span>
          </div>
          <p className="mt-2 text-xs text-white/40">Crawl your website and generate a sitemap.xml automatically</p>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
            <Globe className="h-4 w-4 text-white/20" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
              placeholder="Enter website URL (e.g., example.com)"
            />
          </div>
          <button
            onClick={start}
            disabled={crawling}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-fuchsia-600/20 transition hover:shadow-fuchsia-600/30 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> {crawling ? "Crawling..." : "Start Crawl"}
          </button>
        </div>

        <button onClick={() => setAdvancedOpen(!advancedOpen)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-white/40 hover:text-white/60">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /> Advanced Settings
        </button>
        {advancedOpen && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-[#010409] p-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Max Pages</label>
              <input id="sitemap-max-pages" type="number" defaultValue="50" className="mt-1 w-full bg-transparent text-sm text-white/60 focus:outline-none" />
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-[#010409] p-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Crawl Depth</label>
              <input type="number" defaultValue="5" className="mt-1 w-full bg-transparent text-sm text-white/60 focus:outline-none" />
            </div>
          </div>
        )}
      </div>

      {!results ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-10 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fuchsia-500/10">
            <Map className="h-6 w-6 text-fuchsia-400/50" />
          </div>
          <h3 className="mt-3 text-base font-bold text-white/55">Generate Your Sitemap</h3>
          <p className="mt-1 max-w-sm text-xs text-white/30">Enter your website URL above and click "Start Crawl" to discover all pages and generate a sitemap.xml file.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          {saveError && <p className="mb-3 text-xs text-rose-300">{saveError}</p>}
          <h3 className="text-sm font-bold text-white/80 mb-3">Discovered {results.count} pages</h3>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#010409] p-4 text-[11px] text-white/60 font-mono">
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
