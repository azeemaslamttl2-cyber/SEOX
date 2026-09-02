import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wrench, Link2, Type, Globe, Hash, Eye, ArrowUpDown, Map, FileCode2,
  FileCode, Database, ChevronRight, Search, Zap, ShieldCheck
} from "lucide-react";

const tools = [
  {
    to: "/seo-tools/url-editor",
    label: "Ultimate URL Editor",
    category: "URL & Domains",
    desc: "Batch normalize, encode/decode, clean tracking parameters, and reformat large lists of URLs.",
    Icon: Link2,
    iconClass: "tool-icon-blue",
    tags: ["URL Cleaning", "Query Stripper", "Batch Mode"],
    featured: true
  },
  {
    to: "/seo-tools/text-editor",
    label: "Universal Text Editor",
    category: "URL & Domains",
    desc: "Clean raw text datasets, remove unwanted HTML tags, apply regex find & replace, and reformat casing.",
    Icon: Type,
    iconClass: "tool-icon-purple",
    tags: ["HTML Stripper", "Regex Replace", "Case Format"]
  },
  {
    to: "/seo-tools/domain-separator",
    label: "Domain Separator",
    category: "URL & Domains",
    desc: "Isolate root domains, subdomains, protocols, and TLD extensions from unformatted URL exports.",
    Icon: Globe,
    iconClass: "tool-icon-indigo",
    tags: ["Root Domains", "Subdomains", "TLD Filter"]
  },
  {
    to: "/seo-tools/word-counter",
    label: "Word Counter",
    category: "Analysis & Metrics",
    desc: "Real-time word, sentence, and character counts with keyword density metrics and reading time calculation.",
    Icon: Hash,
    iconClass: "tool-icon-emerald",
    tags: ["Keyword Density", "Character Stats", "Reading Time"]
  },
  {
    to: "/seo-tools/bot-viewer",
    label: "Bot Viewer",
    category: "Analysis & Metrics",
    desc: "Simulate user-agent HTTP requests from Googlebot, Bingbot, and custom search crawlers to inspect DOM output.",
    Icon: Eye,
    iconClass: "tool-icon-amber",
    tags: ["Googlebot Sim", "User-Agent Header", "DOM Inspection"]
  },
  {
    to: "/seo-tools/da-pa-checker",
    label: "Bulk DA/PA Checker",
    category: "Analysis & Metrics",
    desc: "Verify Domain Authority, Page Authority, and spam scores across bulk domain lists for link prospecting.",
    Icon: ArrowUpDown,
    iconClass: "tool-icon-rose",
    tags: ["Domain Authority", "Spam Score", "Prospecting"],
    featured: true
  },
  {
    to: "/seo-tools/sitemap-generator",
    label: "Sitemap Generator",
    category: "Indexing & Directives",
    desc: "Generate valid search-engine-ready XML and HTML sitemaps with priority, changefreq, and lastmod tags.",
    Icon: Map,
    iconClass: "tool-icon-brand",
    tags: ["XML Sitemap", "Priority Tags", "Google Spec"],
    featured: true
  },
  {
    to: "/seo-tools/robots-generator",
    label: "Robots.txt Generator",
    category: "Indexing & Directives",
    desc: "Create, validate, and test custom robots.txt directives and crawl rules for major search engine user-agents.",
    Icon: FileCode2,
    iconClass: "tool-icon-cyan",
    tags: ["Crawl Rules", "Disallow Syntax", "Bot Directives"]
  },
  {
    to: "/seo-tools/sitemap-extractor",
    label: "XML Sitemap Extractor",
    category: "Indexing & Directives",
    desc: "Fetch and extract all indexable URLs, images, and nested sub-sitemaps from any live XML sitemap URL.",
    Icon: FileCode,
    iconClass: "tool-icon-teal",
    tags: ["URL Extraction", "Nested Sitemaps", "Export CSV"]
  },
  {
    to: "/seo-tools/meta-extractor",
    label: "Bulk Meta Extractor",
    category: "Analysis & Metrics",
    desc: "Scrape and extract page titles, meta descriptions, canonical URLs, and OpenGraph headers in batch.",
    Icon: Database,
    iconClass: "tool-icon-fuchsia",
    tags: ["Meta Tags", "OpenGraph", "Canonical Check"]
  },
];

const categories = ["All Tools", "URL & Domains", "Indexing & Directives", "Analysis & Metrics"];

export default function SeoToolsHub() {
  const [selectedCategory, setSelectedCategory] = useState("All Tools");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesCategory = selectedCategory === "All Tools" || tool.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.label.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="seo-tools-hub-workspace ctool-page space-y-5 pb-8">
      {/* Hero Header */}
      <div className="seo-hub-hero">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="ctool-hero-icon">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="ctool-title font-display">
                  SEO Tools Hub
                </h1>
                <span className="ctool-count-badge">
                  10 Tools Available
                </span>
              </div>
              <p className="ctool-subtitle">
                Essential technical SEO utilities for URL normalization, sitemap generation, bot simulation, and meta data extraction.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="hub-chip">
              <Zap className="h-3.5 w-3.5" /> Fast Execution
            </span>
            <span className="hub-chip">
              <ShieldCheck className="h-3.5 w-3.5" /> Batch Ready
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="ctool-card hub-controls flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sres-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name, tag, or function..."
            className="schema-input pl-10"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cat-filter-btn ${
                selectedCategory === cat
                  ? "cat-filter-btn-active"
                  : "cat-filter-btn-inactive"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      {filteredTools.length === 0 ? (
        <div className="ctool-empty">
          <Wrench className="h-8 w-8 mb-2" />
          <h3 className="ctool-empty-title">No SEO tools matched your search</h3>
          <p className="ctool-empty-text">Try clearing your search query or selecting a different category filter.</p>
          <button
            onClick={() => { setSearchQuery(""); setSelectedCategory("All Tools"); }}
            className="schema-addlink mt-3"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => {
            const Icon = tool.Icon;
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="hub-tool group"
              >
                <div>
                  {/* Top Bar: Icon + Category Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="tool-icon-box">
                      <Icon />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tool.featured && (
                        <span className="app-badge app-badge-warning">
                          ★ Featured
                        </span>
                      )}
                      <span className="hub-cat-badge">
                        {tool.category}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="hub-tool-title font-display">
                    {tool.label}
                  </h3>
                  <p className="hub-tool-desc line-clamp-2">
                    {tool.desc}
                  </p>

                  {/* Feature Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="hub-tag"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="hub-tool-foot">
                  <span className="hub-tool-ready">Ready to use</span>
                  <div className="btn-tool-open">
                    <span>Open Tool</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


