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
    <div className="ctool-page space-y-5">

      {/* Hero */}
      <div className="ctool-hero geo-hero">
        <div className="geo-hero-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="ctool-hero-icon">
                <Link2 className="h-5 w-5 ctool-accent" />
              </div>
              <div>
                <h1 className="ctool-title font-display">Website Crawler</h1>
                <p className="ctool-help-text">Discover internal linking patterns and identify orphan pages for better GEO</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <div className="ctool-field flex-1">
              <Globe className="h-4 w-4" />
              <input
                value={url} onChange={(e) => setUrl(e.target.value)}
                className="stool-bare-input flex-1"
                placeholder="https://example.com"
              />
            </div>
            <button className="ui-button ui-button-primary">
              <Search className="h-4 w-4" /> Start Crawl
            </button>
          </div>
          <p className="ctool-help-text mt-2">Enter a website URL. GEO Crawl will use the website sitemap to analyze the link structure. Analyzes up to 100 pages.</p>
        </div>
      </div>

      {hasResult && (
        <>
          {/* Status Banners */}
          <div className="app-alert app-alert-success">
            <CheckCircle2 className="h-4 w-4" />
            <div className="flex-1">
              <strong>Saved crawl results loaded from database</strong> — Crawl completed on {mockCrawl.completedAt}
            </div>
          </div>

          {/* Crawl Analysis Banner */}
          <div className="geo-summary">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="geo-acc-title">Crawl Analysis Completed</h3>
                <p className="ctool-help-text mt-1">
                  Crawled {mockCrawl.summary.pagesCrawled} pages • Found {mockCrawl.summary.internalLinks} internal links • {mockCrawl.summary.orphanPages} orphan pages
                </p>
                <p className="ctool-help-text">
                  Max Depth: {mockCrawl.summary.maxDepth} • Avg Internal Links: {mockCrawl.summary.avgInternalLinks}
                </p>
                <p className="ctool-help-text">Internal Linking Score: {mockCrawl.summary.linkingScore}</p>
              </div>
              <div className="geo-summary-figure">
                <span className="geo-summary-num font-display">{mockCrawl.summary.pagesCrawled}</span>
              </div>
            </div>
          </div>

          {/* Internal Link Analysis Report */}
          <div className="geo-summary">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="geo-summary-title">Internal Linking Analysis Report</h3>
                <p className="ctool-help-text mt-1">Comprehensive crawl analysis for {mockCrawl.url}</p>
                <p className="ctool-help-text">Analyzed {mockCrawl.summary.pagesCrawled} pages • {mockCrawl.summary.internalLinks} internal links • {mockCrawl.summary.orphanPages} orphan pages detected</p>
              </div>
              <div className="text-right">
                <div className="geo-summary-num">{mockCrawl.summary.pagesCrawled}</div>
                <div className="ctool-help-text">Pages Crawled</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="ctool-seg geo-tabs">
            {mockCrawl.tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`ui-button ctool-seg-btn ${activeTab === tab ? "active" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Internal Link Structure */}
          <div className="ctool-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 ctool-accent" />
                <h2 className="geo-section-title font-display">Internal Link Structure</h2>
              </div>
              <span className="ctool-help-text">{mockCrawl.summary.pagesCrawled} pages analyzed</span>
            </div>

            <div className="space-y-3">
              {mockCrawl.pages.map((page, i) => (
                <div key={i} className="geo-well">
                  <div className="flex items-center justify-between mb-2">
                    <div className="geo-page-url truncate">{page.url}</div>
                    <span className="ctool-help-text flex-shrink-0 ml-3">{page.links} links</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {page.outbound.map((link, li) => (
                      <span key={li} className="geo-link-chip">
                        {link}
                      </span>
                    ))}
                    {page.links > page.outbound.length && (
                      <span className="geo-link-chip geo-link-more">
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
