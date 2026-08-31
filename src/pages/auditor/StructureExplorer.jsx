import { useState, useMemo } from "react";
import { Folder, ChevronRight, ChevronDown, FileText, HelpCircle, Filter } from "lucide-react";
import { useAuditData } from "../../hooks/useAuditData.js";
import { useCrawl } from "../../context/CrawlContext.jsx";

/* ─── Tab definitions ─── */
const TABS = [
  { id: "http", label: "HTTP status code" },
  { id: "content", label: "Content type" },
  { id: "depth", label: "Depth" },
  { id: "indexability", label: "Indexability" },
  { id: "crawled", label: "Crawled URLs" },
];

const TAB_INFO = {
  http: "This report shows you the distribution of HTTP status codes across different sections of your website. If you see a high proportion of 4xx and 5xx HTTP status codes or timeouts, this requires your attention. You might also want to check the necessity of 3xx redirects.",
  content: "This report shows you the distribution of content types, such as HTML pages or resource files, across different sections of your website.",
  depth: "This report shows you which parts of your website have URLs that are most distant from the seed point. You should make sure that your most important pages have the lowest depth.",
  indexability: "This report shows you the distribution of indexable and non-indexable pages across different sections of your website. Pages that are not indexable will not appear in search results.",
  crawled: "This report shows you which sections of your website have been crawled and which haven't. Uncrawled sections may have accessibility issues.",
};

const TAB_LEGENDS = {
  http: [
    { key: "2xx", label: "2xx", color: "#34d399" },
    { key: "3xx", label: "3xx", color: "#fbbf24" },
    { key: "4xx", label: "4xx", color: "#f43f5e" },
    { key: "5xx", label: "5xx", color: "#a855f7" },
    { key: "0xx", label: "Error", color: "#64748b" },
  ],
  content: [
    { key: "page", label: "Page", color: "#34d399" },
    { key: "image", label: "Image", color: "#60a5fa" },
    { key: "javascript", label: "JavaScript", color: "#38bdf8" },
    { key: "css", label: "CSS", color: "#4ade80" },
    { key: "other", label: "Other", color: "#ca8a04" },
  ],
  depth: [
    { key: "0", label: "0", color: "#22c55e" },
    { key: "1", label: "1", color: "#4ade80" },
    { key: "2", label: "2", color: "#a3e635" },
    { key: "3", label: "3", color: "#facc15" },
    { key: "4", label: "4", color: "#ffc600" },
    { key: "5", label: "5", color: "#df3c27" },
    { key: "6+", label: "6+", color: "#ef4444" },
  ],
  indexability: [
    { key: "indexable", label: "Indexable", color: "#34d399" },
    { key: "nonIndexable", label: "Non-indexable", color: "#fbbf24" },
  ],
  crawled: [
    { key: "crawled", label: "Crawled", color: "#34d399" },
    { key: "uncrawled", label: "Uncrawled", color: "#64748b" },
  ],
};

/* ─── Classify content type from HTTP Content-Type header and URL ─── */
function classifyContentType(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  const path = (() => {
    try { return new URL(url).pathname.toLowerCase(); } catch { return ""; }
  })();

  if (/text\/html|application\/xhtml/i.test(ct)) return "page";
  if (/text\/css/i.test(ct) || path.endsWith(".css")) return "css";
  if (/javascript|ecmascript/i.test(ct) || /\.(js|mjs)$/.test(path)) return "javascript";
  if (/image\//i.test(ct) || /\.(png|jpe?g|webp|gif|svg|ico|avif|bmp)$/i.test(path)) return "image";
  if (/text\/xml|application\/xml/i.test(ct) || path.endsWith(".xml")) return "other";
  if (ct.includes("text/") || !ct) return "page"; // treat unknown as page
  return "other";
}

/* ─── Build enriched page list from real crawl data ─── */
function buildPagesFromCrawlData(latestUrls, auditIssues) {
  // Build a set of noindex URLs from audit issue findings
  const noindexUrls = new Set();
  const noindexIssue = auditIssues?.["noindex-page"];
  if (noindexIssue?.urls) {
    noindexIssue.urls.forEach((u) => {
      if (u.url) noindexUrls.add(u.url);
    });
  }

  // Compute depth based on URL path segments
  return latestUrls.map((row) => {
    const url = row.url || "";
    const status = row.status || 0;
    const contentType = row.contentType || "";
    const type = classifyContentType(contentType, url);

    let depth = 0;
    try {
      const pathname = new URL(url).pathname.replace(/^\/|\/$/g, "");
      depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
    } catch { /* default 0 */ }

    // Indexable = successful HTML page that isn't noindex
    const isHtml = type === "page";
    const isSuccess = status >= 200 && status < 300;
    const isNoindex = noindexUrls.has(url);
    const indexable = isHtml && isSuccess && !isNoindex;

    return {
      url,
      status,
      contentType: type,
      depth,
      indexable,
      inlinks: row.outlinks || 0,
      sizeKb: row.sizeKb || 0,
      loadTime: row.loadTime || 0,
    };
  });
}

/* ─── Build tree from flat URL list ─── */
function buildTree(pages, domain) {
  const root = { label: domain, path: "/", total: 0, pages: [], children: {} };

  for (const page of pages) {
    let parts = [];
    try {
      const u = new URL(page.url);
      const pathname = u.pathname.replace(/^\/|\/$/g, "");
      parts = pathname ? pathname.split("/").filter(Boolean) : [];
    } catch { /* skip */ }

    root.pages.push(page);
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const segment = "/" + parts[i];
      if (!node.children[segment]) {
        node.children[segment] = {
          label: segment,
          path: "/" + parts.slice(0, i + 1).join("/"),
          total: 0,
          pages: [],
          children: {},
        };
      }
      node = node.children[segment];
      node.pages.push(page);
    }
  }

  // Convert trie to sorted array structure
  function convertNode(node) {
    const childArray = Object.values(node.children)
      .map(convertNode)
      .sort((a, b) => b.total - a.total);
    return {
      label: node.label,
      total: node.pages.length,
      pages: node.pages,
      children: childArray,
      file: childArray.length === 0 && node.pages.length <= 2,
    };
  }

  const treeRoot = convertNode(root);
  treeRoot.total = pages.length;
  return treeRoot;
}

/* ─── Compute distribution for a node based on active tab ─── */
function computeDistribution(pages, tabId) {
  const dist = {};

  for (const p of pages) {
    switch (tabId) {
      case "http": {
        const s = p.status || 0;
        const code = s === 0 ? "0xx" : s < 300 ? "2xx" : s < 400 ? "3xx" : s < 500 ? "4xx" : "5xx";
        dist[code] = (dist[code] || 0) + 1;
        break;
      }
      case "content": {
        const type = p.contentType || "other";
        dist[type] = (dist[type] || 0) + 1;
        break;
      }
      case "depth": {
        const d = Math.min(p.depth ?? 0, 6);
        const key = d >= 6 ? "6+" : String(d);
        dist[key] = (dist[key] || 0) + 1;
        break;
      }
      case "indexability": {
        const key = p.indexable ? "indexable" : "nonIndexable";
        dist[key] = (dist[key] || 0) + 1;
        break;
      }
      case "crawled": {
        const key = p.status > 0 ? "crawled" : "uncrawled";
        dist[key] = (dist[key] || 0) + 1;
        break;
      }
      default:
        break;
    }
  }

  return dist;
}

export default function StructureExplorer() {
  const [activeTab, setActiveTab] = useState("http");
  const [view, setView] = useState("percentage");
  const { project } = useAuditData();
  const { stats } = useCrawl();

  const domain = project.domain || "example.com";
  const latestUrls = stats?.latestUrls || [];
  const auditIssues = stats?.auditIssues || {};

  // Build pages from real crawl data
  const pages = useMemo(
    () => buildPagesFromCrawlData(latestUrls, auditIssues),
    [latestUrls, auditIssues]
  );

  // Build tree dynamically from page data
  const tree = useMemo(() => buildTree(pages, domain), [pages, domain]);

  const legend = TAB_LEGENDS[activeTab] || TAB_LEGENDS.http;
  const tabInfo = TAB_INFO[activeTab] || TAB_INFO.http;

  const hasData = pages.length > 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
        Structure explorer
        <HelpCircle className="h-4 w-4 text-white/30" />
        <span className="text-xs font-normal text-white/40 ml-1">How to use</span>
      </h1>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-ink-800/60 p-1.5 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === t.id
                ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30"
                : "text-white/55 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setView(view === "percentage" ? "count" : "percentage")}
          className="ml-auto flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/[0.08]"
        >
          Chart ({view}) <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-2xl border border-white/10 bg-ink-800/60 px-4 py-3.5 backdrop-blur">
        <p className="mb-1 text-sm font-semibold text-white">How to use this data</p>
        <p className="text-xs leading-relaxed text-white/65">{tabInfo}</p>
      </div>

      {/* Tree table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        {/* Header */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
            <span className="font-medium">Path</span>
            <div className="flex items-center gap-6">
              <span className="font-medium">Total URLs</span>
              <div className="flex items-center gap-3">
                {legend.map((item) => (
                  <span key={item.key} className="flex items-center gap-1 normal-case">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-white/60">{item.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tree or empty state */}
        <div className="px-4 py-3">
          {hasData ? (
            <TreeNode node={tree} depth={0} view={view} tabId={activeTab} legend={legend} isRoot />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Folder className="h-10 w-10 text-white/20" />
              <p className="text-sm font-medium text-white/50">No crawl data yet</p>
              <p className="text-xs text-white/30">
                Run a crawl on your project to see the website structure broken down by URL path segments.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNode({ node, depth, view, tabId, legend, isRoot }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const dist = useMemo(() => computeDistribution(node.pages, tabId), [node.pages, tabId]);
  const total = node.total;

  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.025]"
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => hasChildren && setOpen(!open)}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${hasChildren ? "hover:bg-white/10" : "invisible"}`}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-white/60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-white/60" />
          )}
        </button>

        {/* Icon */}
        {node.file ? (
          <FileText className="h-4 w-4 flex-shrink-0 text-white/40" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-brand-400" />
        )}

        {/* Label */}
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${isRoot ? "text-brand-300" : "text-white"}`}>
          {node.label}
        </span>

        {/* Filter segment button (root only) */}
        {isRoot && (
          <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/50 hover:bg-white/[0.08]">
            <Filter className="h-3 w-3" /> Filter segment
          </button>
        )}

        {/* Total count */}
        <span className="w-16 text-right tabular-nums text-brand-300">{total.toLocaleString()}</span>

        {/* Distribution bar */}
        <div className="flex h-5 w-[55%] flex-shrink-0 overflow-hidden rounded-md bg-white/[0.02]">
          {legend.map(({ key, color }) => {
            const count = dist[key] || 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            return (
              <span
                key={key}
                className="transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color, minWidth: count > 0 ? 2 : 0 }}
                title={`${key}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Children */}
      {open && hasChildren && node.children.map((c) => (
        <TreeNode key={c.label} node={c} depth={depth + 1} view={view} tabId={tabId} legend={legend} />
      ))}
    </div>
  );
}
