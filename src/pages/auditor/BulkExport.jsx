import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Eye, Search } from "lucide-react";
import { useAuditData } from "../../hooks/useAuditData.js";
import { useCrawl } from "../../context/CrawlContext.jsx";
import { downloadTextFile, rowsToCsv, slugForFilename } from "../../lib/auditorExport.js";
import {
  classifyContentType,
  duplicateClusters,
  htmlRows,
  itemUrl,
  linkStats,
} from "../../lib/auditor/reports/liveReportData.js";

const SECTIONS = [
  {
    title: "Issues",
    rows: [
      { name: "All issues", desc: "All issues reports. Exported to CSV and zipped.", count: null, zip: true },
    ],
  },
  {
    title: "URLs",
    rows: [
      { name: "Internal URLs", desc: "All crawled internal URLs. Includes non-200 pages and resources.", count: 0 },
      { name: "Internal HTML URLs, status code 200", desc: "Crawled URLs with HTML content type and status code 200.", count: 0 },
      { name: "Duplicate content", desc: "URLs with content that nearly matches the content of at least one other URL found during the crawl.", count: 0 },
      { name: "Redirect chains", desc: "URLs with a redirect that passes through at least one intermediate redirect before reaching its destination.", count: 0 },
      { name: "Orphan pages", desc: "HTML URLs with status code 200 that don't have any incoming internal links.", count: 0 },
    ],
  },
  {
    title: "Links",
    rows: [
      { name: "All links", desc: "All links found during the crawl. Includes links to uncrawled URLs.", count: 0 },
      { name: "Crawled links", desc: "Links to URLs that our crawler crawled.", count: 0 },
      { name: "Uncrawled links", desc: "Links to URLs that our crawler didn't crawl. This could be due to your project settings or website restrictions like robots.txt.", count: 0 },
      { name: "Anchor texts", desc: "Anchor texts of all hyperlinks found during the crawl.", count: 0 },
      { name: "Alt texts", desc: "Alt texts of all image references found during the crawl.", count: 0 },
      { name: "Image references", desc: "All image references found during the crawl. Includes uncrawled URLs.", count: 0 },
      { name: "Image references without alt texts", desc: "All image references without alt texts found during the crawl.", count: 0 },
      { name: "Mixed content", desc: "Links from HTTP to HTTPS.", count: 0 },
      { name: "External links", desc: "All links to external URLs found during the crawl. Includes links to uncrawled URLs.", count: 0 },
      { name: "Links to URLs blocked by robots.txt", desc: "Links to all URLs that our crawler could not access because of instructions in robots.txt.", count: 0 },
      { name: "Links to 2xx (Success) URLs", desc: "Links to URLs returning success codes, which means that the crawler request was received, understood, and processed by the server.", count: 0 },
      { name: "Links to 3xx (Redirection) URLs", desc: "Links to URLs returning redirection codes, which means that further action might be needed to get to the destination URL.", count: 0 },
      { name: "Links to 4xx (Client error) URLs", desc: "Links to URLs returning client error codes, which means that there was a problem with the request.", count: 0 },
      { name: "Links to 5xx (Server error) URLs", desc: "Links to URLs returning server error codes, which means that the server failed to fulfill an apparently valid request.", count: 0 },
      { name: "Links to No response URLs", desc: "Links to URLs that didn't respond under timeout value, which means that the server returned no information to the client and closed the connection.", count: 0 },
    ],
  },
  {
    title: "Robots directives",
    rows: [
      { name: "Links to Index URLs", desc: 'Links to URLs that allow indexation. A URL can disallow indexation with the "noindex" or "none" robots directive.', count: 0 },
      { name: "Link to Noindex URLs", desc: 'Links to URLs that disallow indexation. A URL can disallow indexation with the "noindex" or "none" robots directive.', count: 0 },
      { name: "Dofollow links", desc: "Links that pass ranking credit to the target URL. This can be disallowed by using the nofollow, ugc or sponsored attributes.", count: 0 },
      { name: "Nofollow links", desc: "Links that don't pass ranking credit to the target URL. This is done by using the nofollow, ugc or sponsored attributes.", count: 0 },
    ],
  },
  {
    title: "Canonical",
    rows: [
      { name: "Canonical links", desc: "All canonical links found. Canonical links on a page specify another page as the main version to be indexed. This is set by canonical tags or in HTTP header tags.", count: 0 },
      { name: "Canonical links to non-200 URLs", desc: "Canonical links found leading to URLs with a non-200 status code. Canonical links on a page specify another page as the main version to be indexed. This is set by canonical tags or in HTTP header tags.", count: 0 },
    ],
  },
];

export default function BulkExport() {
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(null);
  const navigate = useNavigate();
  const { issuesDistribution } = useAuditData();
  const auditData = useAuditData();
  const { stats } = useCrawl();

  const sections = useMemo(() => {
    const latestUrls = stats?.latestUrls || [];
    const auditIssues = stats?.auditIssues || {};
    const pages = htmlRows(latestUrls);
    const links = linkStats(latestUrls);
    const statusByUrl = new Map(latestUrls.map((row) => [row.url, row.status ?? null]));
    const imageResources = latestUrls.flatMap((row) =>
      (row.resources || []).filter((resource) =>
        classifyContentType("", itemUrl(resource), resource?.type) === "image"
      )
    );
    const missingAlt = Number(auditIssues?.["missing-alt-text"]?.crawled || 0) ||
      latestUrls.reduce((sum, row) => sum + Number(row.audit?.missingImageAltCount || 0), 0);
    const duplicateUrls = new Set(
      duplicateClusters(latestUrls, "content").flatMap((cluster) => cluster.rows.map((row) => row.url))
    );
    const incomingTargets = new Set(links.rows.filter((row) => row.internal).map((row) => row.target));
    const mixedContent = latestUrls.reduce((sum, row) => sum + Number(row.audit?.mixedContentCount || 0), 0);
    const canonicalRows = pages.filter((row) => row.canonicalUrl || row.audit?.canonicalUrl);
    const canonicalNon200 = canonicalRows.filter((row) => {
      const canonical = row.canonicalUrl || row.audit?.canonicalUrl;
      const status = statusByUrl.get(canonical);
      return status !== undefined && (status === 0 || Number(status) < 200 || Number(status) >= 300);
    }).length;
    const statusLinkCount = (predicate) =>
      links.rows.filter((row) => row.targetStatus !== null && predicate(Number(row.targetStatus))).length;

    return SECTIONS.map((section) => ({
      ...section,
      rows: section.rows.map((row) => {
        const counts = {
          "All issues": issuesDistribution.total,
          "Internal URLs": latestUrls.length,
          "Internal HTML URLs, status code 200": pages.filter((item) => item.status >= 200 && item.status < 300).length,
          "Duplicate content": duplicateUrls.size,
          "Redirect chains": Number(auditIssues?.["redirect-chain"]?.crawled || 0),
          "Orphan pages": pages.filter((item) => !incomingTargets.has(item.url)).length,
          "All links": links.rows.length,
          "Crawled links": links.rows.filter((item) => item.targetStatus !== null).length,
          "Uncrawled links": links.rows.filter((item) => item.targetStatus === null).length,
          "Anchor texts": links.rows.filter((item) => String(item.anchor || "").trim()).length,
          "Alt texts": Math.max(0, imageResources.length - missingAlt),
          "Image references": imageResources.length,
          "Image references without alt texts": missingAlt,
          "Mixed content": mixedContent,
          "External links": links.external,
          "Links to URLs blocked by robots.txt": links.rows.filter((item) => item.robotsTxtBlocked).length,
          "Links to 2xx (Success) URLs": statusLinkCount((status) => status >= 200 && status < 300),
          "Links to 3xx (Redirection) URLs": statusLinkCount((status) => status >= 300 && status < 400),
          "Links to 4xx (Client error) URLs": statusLinkCount((status) => status >= 400 && status < 500),
          "Links to 5xx (Server error) URLs": statusLinkCount((status) => status >= 500),
          "Links to No response URLs": links.rows.filter((item) => item.targetStatus === 0).length,
          "Links to Index URLs": links.rows.filter((item) => item.targetStatus !== 0).length,
          "Link to Noindex URLs": Number(auditIssues?.["noindex-page"]?.crawled || 0),
          "Dofollow links": links.rows.filter((item) => !item.nofollow).length,
          "Nofollow links": links.rows.filter((item) => item.nofollow).length,
          "Canonical links": canonicalRows.length,
          "Canonical links to non-200 URLs": canonicalNon200,
        };
        return row.name in counts ? { ...row, count: counts[row.name] } : row;
      }),
    }));
  }, [issuesDistribution.total, stats]);

  const filter = (rows) =>
    rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  const exportRowsFor = (row) => {
    const latestUrls = stats?.latestUrls || [];
    const issueRows = auditData.issueCategories.flatMap((category) =>
      category.subgroups
        ? category.subgroups.flatMap((group) => group.items)
        : category.items
    );
    if (row.name === "All issues") {
      return {
        headers: ["severity", "title", "crawled", "change"],
        rows: issueRows.map((item) => ({
          severity: item.severity,
          title: item.title,
          crawled: item.crawled || 0,
          change: item.change || 0,
        })),
      };
    }
    if (row.name.toLowerCase().includes("link") || row.name.includes("Anchor texts")) {
      const links = linkStats(latestUrls).rows;
      return {
        headers: ["source", "target", "targetStatus", "anchor", "type", "nofollow"],
        rows: links.map((item) => ({
          source: item.source,
          target: item.target,
          targetStatus: item.targetStatus ?? "",
          anchor: item.anchor || "",
          type: item.type,
          nofollow: item.nofollow ? "yes" : "no",
        })),
      };
    }
    return {
      headers: ["url", "status", "contentType", "title"],
      rows: (latestUrls.length ? latestUrls : []).map((item) => ({
        url: item.url,
        status: item.status,
        contentType: item.contentType,
        title: item.title,
      })),
    };
  };

  const handleExport = (key, row) => {
    setExporting(key);
    const { headers, rows } = exportRowsFor(row);
    const filename = `${slugForFilename(row.name)}.${row.zip ? "zip.csv" : "csv"}`;
    downloadTextFile(filename, rowsToCsv(headers, rows));
    setTimeout(() => setExporting(null), 350);
  };

  const handleView = (row) => {
    const routes = {
      "All issues": "/auditor/issues",
      "Internal URLs": "/auditor/pages",
      "Internal HTML URLs, status code 200": "/auditor/pages",
      "Duplicate content": "/auditor/reports/duplicates",
      "Redirect chains": "/auditor/reports/redirects",
      "Orphan pages": "/auditor/pages?q=orphan",
      "All links": "/auditor/links",
      "Crawled links": "/auditor/links",
      "Uncrawled links": "/auditor/links",
      "Anchor texts": "/auditor/links",
      "Alt texts": "/auditor/issues/missing-alt-text",
      "Image references": "/auditor/reports/images",
      "Image references without alt texts": "/auditor/issues/missing-alt-text",
      "Mixed content": "/auditor/issues/https-http-mixed-content",
      "External links": "/auditor/links",
    };
    navigate(routes[row.name] || "/auditor/pages");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight">Bulk export</h1>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter exports…"
            className="w-56 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
      </div>

      {sections.map((section) => {
        const rows = filter(section.rows);
        if (rows.length === 0) return null;
        return (
          <section
            key={section.title}
            className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur"
          >
            <header className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">
                {section.title}
              </h2>
            </header>
            <ul>
              {rows.map((r, i) => {
                const key = `${section.title}-${r.name}`;
                const disabled = false;
                return (
                  <li
                    key={key}
                    className="group flex flex-col gap-2 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.02] sm:flex-row sm:items-center"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-300 hover:underline">
                        {r.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/55">
                        {r.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-shrink-0">
                      {r.count !== null && (
                        <span
                          className={`min-w-[60px] text-right text-sm tabular-nums ${
                            r.count > 0 ? "text-white font-semibold" : "text-white/30"
                          }`}
                        >
                          {r.count.toLocaleString()}
                        </span>
                      )}
                      <button
                        disabled={disabled}
                        onClick={() => !disabled && handleExport(key, r)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                          disabled
                            ? "border-white/5 bg-white/[0.02] text-white/25 cursor-not-allowed"
                            : "border-white/10 bg-white/[0.04] text-white/80 hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-200"
                        }`}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exporting === key ? "Preparing…" : r.zip ? "Export ZIP" : "Export CSV"}
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => !disabled && handleView(r)}
                        className={`flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium transition ${
                          disabled
                            ? "text-white/25 cursor-not-allowed"
                            : "text-white/80 hover:bg-white/[0.08]"
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
