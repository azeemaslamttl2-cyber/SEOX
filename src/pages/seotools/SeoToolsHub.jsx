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
    <div className="seo-tools-hub-workspace space-y-6 pb-8">
      {/* Hero Header */}
      <div className="seo-hub-hero relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-[90px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-black/10 blur-[80px]" />
        </div>
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-brand-500 shadow-inner flex-shrink-0">
              <Wrench className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-black text-white sm:text-3xl">
                  SEO Tools Hub
                </h1>
                <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  10 Tools Available
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#fff4f2]">
                Essential technical SEO utilities for URL normalization, sitemap generation, bot simulation, and meta data extraction.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-white/90">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 backdrop-blur-sm">
              <Zap className="h-3.5 w-3.5 text-amber-300" /> Fast Execution
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Batch Ready
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools by name, tag, or function..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <h3 className="font-bold text-sm text-slate-800">No SEO tools matched your search</h3>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting a different category filter.</p>
          <button
            onClick={() => { setSearchQuery(""); setSelectedCategory("All Tools"); }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
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
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-brand-500/40 hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon + Category Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className={`tool-icon-box ${tool.iconClass}`}>
                      <Icon />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tool.featured && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          ★ Featured
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {tool.category}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-display text-sm font-bold text-slate-900 group-hover:text-college-blue transition">
                    {tool.label}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {tool.desc}
                  </p>

                  {/* Feature Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">Ready to use</span>
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


