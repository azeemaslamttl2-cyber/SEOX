import { useState } from "react";
import {
  Link2,
  Globe,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
  Layers,
  Network,
  Unlink,
  BarChart3,
} from "lucide-react";

const mockCrawl = {
  url: "https://learnwirepro.com",
  completedAt: "3/28/2026 at 08:10 AM",
  summary: {
    pagesCrawled: 34,
    internalLinks: 1632,
    orphanPages: 0,
    maxDepth: 3,
    avgInternalLinks: 48.0,
    linkingScore: "86/100",
  },
  tabs: ["Overview", "Link Structure", "Orphan Pages", "Scoring"],
  pages: [
    { url: "https://learnwirepro.com", links: 55, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/about/", "https://learnwirepro.com/recommended/", "https://learnwirepro.com/courses/"] },
    { url: "https://learnwirepro.com/", links: 55, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/about/", "https://learnwirepro.com/recommended/", "https://learnwirepro.com/courses/"] },
    { url: "https://learnwirepro.com/about/", links: 39, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/recommended/", "https://learnwirepro.com/courses/"] },
    { url: "https://learnwirepro.com/courses/", links: 42, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/about/", "https://learnwirepro.com/recommended/"] },
    { url: "https://learnwirepro.com/recommended/", links: 36, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/about/", "https://learnwirepro.com/courses/"] },
    { url: "https://learnwirepro.com/blog/", links: 28, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/about/"] },
    { url: "https://learnwirepro.com/blog/rybbit-review", links: 22, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/blog/"] },
    { url: "https://learnwirepro.com/blog/ai-writing-tools", links: 24, outbound: ["https://learnwirepro.com/", "https://learnwirepro.com/blog/"] },
  ],
};

export default function InternalLinksCrawl() {
  const [url, setUrl] = useState(mockCrawl.url);
  const [hasResult, setHasResult] = useState(true);
  const [activeTab, setActiveTab] = useState("Link Structure");

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-blue-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 ring-1 ring-cyan-500/30">
                <Link2 className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight text-white">Website Crawler</h1>
                <p className="text-xs text-white/40">Discover internal linking patterns and identify orphan pages for better GEO</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
              <Globe className="h-4 w-4 text-cyan-400/60" />
              <input
                value={url} onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                placeholder="https://example.com"
              />
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-cyan-500/40">
              <Search className="h-4 w-4" /> Start Crawl
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/25">Enter a website URL. GEO Crawl will use the website sitemap to analyze the link structure. Analyzes up to 100 pages.</p>
        </div>
      </div>

      {hasResult && (
        <>
          {/* Status Banners */}
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div className="text-[12px] text-emerald-300/80">
              <strong>Saved crawl results loaded from database</strong> — Crawl completed on {mockCrawl.completedAt}
            </div>
          </div>

          {/* Crawl Analysis Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-emerald-300">Crawl Analysis Completed</h3>
                <p className="mt-1 text-[12px] text-white/50">
                  Crawled {mockCrawl.summary.pagesCrawled} pages • Found {mockCrawl.summary.internalLinks} internal links • {mockCrawl.summary.orphanPages} orphan pages
                </p>
                <p className="text-[11px] text-white/35">
                  Max Depth: {mockCrawl.summary.maxDepth} • Avg Internal Links: {mockCrawl.summary.avgInternalLinks}
                </p>
                <p className="text-[11px] text-white/35">Internal Linking Score: {mockCrawl.summary.linkingScore}</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15">
                <span className="font-display text-2xl font-black text-emerald-300">{mockCrawl.summary.pagesCrawled}</span>
              </div>
            </div>
          </div>

          {/* Internal Link Analysis Report */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)", backgroundSize: "16px 16px" }} />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Internal Linking Analysis Report</h3>
                <p className="mt-1 text-[12px] text-white/60">Comprehensive crawl analysis for {mockCrawl.url}</p>
                <p className="text-[11px] text-white/40">Analyzed {mockCrawl.summary.pagesCrawled} pages • {mockCrawl.summary.internalLinks} internal links • {mockCrawl.summary.orphanPages} orphan pages detected</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-white">{mockCrawl.summary.pagesCrawled}</div>
                <div className="text-[11px] text-white/50">Pages Crawled</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1.5">
            {mockCrawl.tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-[12px] font-semibold transition ${activeTab === tab ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30" : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Internal Link Structure */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-cyan-400" />
                <h2 className="font-display text-lg font-bold text-white/90">Internal Link Structure</h2>
              </div>
              <span className="text-[11px] text-white/30">{mockCrawl.summary.pagesCrawled} pages analyzed</span>
            </div>

            <div className="space-y-3">
              {mockCrawl.pages.map((page, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-ink-900/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[13px] font-semibold text-white/80 truncate">{page.url}</div>
                    <span className="text-[11px] text-white/30 flex-shrink-0 ml-3">{page.links} links</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {page.outbound.map((link, li) => (
                      <span key={li} className="rounded-full bg-gradient-to-r from-cyan-500/15 to-blue-500/15 px-2.5 py-1 text-[10px] font-medium text-cyan-300/80 ring-1 ring-cyan-500/20">
                        {link}
                      </span>
                    ))}
                    {page.links > page.outbound.length && (
                      <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/30">
                        +{page.links - page.outbound.length} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
