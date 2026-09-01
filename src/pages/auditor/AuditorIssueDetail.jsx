import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  MoreVertical,
  Search,
  Code2,
  Download,
  Columns3,
  AlertCircle,
} from "lucide-react";
import { useAuditData } from "../../hooks/useAuditData.js";

const filterTabs = [
  "All URLs",
  "Pages",
  "Resources",
  "Content",
  "Links",
  "Redirects",
  "Indexability",
  "Sitemaps",
];

export default function AuditorIssueDetail() {
  const { slug } = useParams();
  const [filter, setFilter] = useState("All URLs");
  const auditData = useAuditData();
  const data = useMemo(
    () => buildIssueDetail(auditData, slug),
    [auditData, slug]
  );
  const resultTabs = [
    { label: "All filter results", count: data.total, active: true },
    { label: "Lost from filter results", count: 0 },
    { label: "Lost", count: 0 },
  ];
  const titleIssue = isTitleIssue(data.slug);
  const missingAltIssue = data.slug === "missing-alt-text";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Breadcrumb header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/auditor/issues"
            className="font-semibold text-white/60 transition hover:text-white"
          >
            Issues
          </Link>
          <ChevronRight className="h-4 w-4 text-white/30" />
          <span className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            {data.title}
          </span>
          <WhyFixTooltip data={data} />
          <span className="ml-2 text-xs text-white/40">· /{slug}</span>
        </div>

      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-ink-800/60 p-1.5 backdrop-blur">
        {filterTabs.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === t
                ? "bg-white/[0.08] text-white"
                : "text-white/55 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {t}
            {["Pages", "Resources", "Content", "Links", "Redirects", "Indexability", "Sitemaps"].includes(t) && (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 px-2">
          <div className="hidden h-8 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs sm:flex">
            <Search className="h-3.5 w-3.5 text-white/40" />
            <input
              type="text"
              placeholder="Word or phrase"
              className="w-32 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <button className="hidden h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs text-white/70 hover:bg-white/[0.08] sm:flex">
            URL <ChevronDown className="h-3 w-3" />
          </button>
          <button className="h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs text-white/70 hover:bg-white/[0.08]">
            Advanced filter
          </button>
        </div>
      </div>

      {/* Crawl history */}
      <details className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-white">
          <span className="flex items-center gap-1">
            Crawl history
            <HelpCircle className="h-3.5 w-3.5 text-white/30" />
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-white/50">
            Show chart
            <ChevronDown className="h-3.5 w-3.5 transition-transform [details[open]_&]:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-white/10 px-4 py-5">
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {data.history.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-brand-500/40 to-amber-400/80"
                style={{ height: `${(v / data.historyMax) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </details>

      {/* Results filter + table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {resultTabs.map((t) => (
              <button
                key={t.label}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  t.active
                    ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {t.label}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    t.active ? "bg-brand-500/30 text-brand-100" : "bg-white/5"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              Patches: Show all <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              Changes: Don't show <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </button>
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Code2 className="h-3.5 w-3.5" /> AI · API
            </button>
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {missingAltIssue ? (
          <MissingAltResults data={data} />
        ) : titleIssue ? (
          <TitleIssueResults data={data} />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="px-3 py-3 font-medium">
                  <span className="flex items-center gap-1">PR <ChevronDown className="h-3 w-3" /></span>
                </th>
                <th className="px-3 py-3 font-medium">URL</th>
                <th className="px-3 py-3 text-right font-medium">Organic traffic</th>
                <th className="px-3 py-3 text-center font-medium">HTTP status code</th>
                <th className="px-3 py-3 text-center font-medium">Is indexable page</th>
                <th className="px-3 py-3 text-center font-medium">Is noindex</th>
                <th className="px-3 py-3 font-medium">Patch it</th>
                <th className="px-3 py-3 text-center font-medium">Is nofollow</th>
                <th className="px-3 py-3 font-medium">Patch it</th>
                <th className="px-3 py-3 font-medium">Meta robots</th>
                <th className="px-3 py-3 font-medium">Robots HTTP headers</th>
                <th className="w-8 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.urls.map((u, i) => (
                <tr
                  key={i}
                  className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.025]"
                >
                  <td className="px-3 py-3">
                    <PRBadge value={u.pr} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-[10px] font-bold text-emerald-300">
                        HTML
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {pageLabelForRow(u)}
                        </p>
                        <FullUrlLink url={u.url} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-white/60">{u.traffic}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      {u.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-white/70">
                    {u.indexable ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-white">
                    {u.noindex ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3">
                    <PatchInput placeholder="Change noindex" />
                  </td>
                  <td className="px-3 py-3 text-center text-white/70">
                    {u.nofollow ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3">
                    <PatchInput placeholder="Change nofollow" />
                  </td>
                  <td className="px-3 py-3">
                    <ul className="space-y-0.5 text-xs text-white/70">
                      {u.robots.map((r) => (
                        <li key={r}>» {r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 text-xs text-white/60">{u.headers || "—"}</td>
                  <td className="py-3 text-right">
                    <button className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="flex items-center justify-center border-t border-white/10 px-4 py-3 text-xs text-white/50">
          Showing {data.urls.length} of {data.total}
        </div>
      </div>
    </div>
  );
}

function MissingAltResults({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
            <th className="px-3 py-3 font-medium">
              <span className="flex items-center gap-1">
                PR <ChevronDown className="h-3 w-3" />
              </span>
            </th>
            <th className="px-3 py-3 font-medium">URL</th>
            <th className="px-3 py-3 text-right font-medium">Organic traffic</th>
            <th className="px-3 py-3 text-center font-medium">HTTP status code</th>
            <th className="px-3 py-3 font-medium">Linked images without alt attribute</th>
            <th className="px-3 py-3 text-center font-medium">
              No. of linked images without alt attribute
            </th>
            <th className="w-8 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.urls.map((u, i) => {
            const images = Array.isArray(u.linkedImagesWithoutAltAttribute)
              ? u.linkedImagesWithoutAltAttribute
              : [];
            return (
              <tr
                key={i}
                className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.025]"
              >
                <td className="px-3 py-3">
                  <PRBadge value={u.pr} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-[10px] font-bold text-emerald-300">
                      HTML
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {pageLabelForRow(u)}
                      </p>
                      <FullUrlLink url={u.url} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-white/60">
                  {u.traffic || 0}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {images.length ? (
                    <ul className="max-w-[460px] space-y-1 text-xs">
                      {images.slice(0, 3).map((imageUrl) => (
                        <li key={imageUrl}>
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-start gap-1 text-brand-300 hover:underline"
                          >
                            <span className="break-all">{imageUrl}</span>
                            <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-white/35">No image URL captured</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center tabular-nums text-brand-300">
                  {u.missingAltImageCount || images.length || 1}
                </td>
                <td className="py-3 text-right">
                  <button className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TitleIssueResults({ data }) {
  const missingIssue = data.slug?.includes("title-tag-missing");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
            <th className="px-3 py-3 font-medium">
              <span className="flex items-center gap-1">
                PR <ChevronDown className="h-3 w-3" />
              </span>
            </th>
            <th className="px-3 py-3 font-medium">URL</th>
            <th className="px-3 py-3 text-right font-medium">Organic traffic</th>
            <th className="px-3 py-3 text-center font-medium">HTTP status code</th>
            <th className="px-3 py-3 font-medium">Title tag</th>
            <th className="px-3 py-3 text-center font-medium">Title length</th>
            <th className="px-3 py-3 text-center font-medium">Is indexable page</th>
            <th className="px-3 py-3 font-medium">Patch it</th>
            <th className="w-8 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.urls.map((u, i) => {
            const titleText = String(
              u.titleTag ?? u.pageTitle ?? (missingIssue ? "" : u.title) ?? ""
            ).trim();
            const titleLength =
              typeof u.titleLength === "number" ? u.titleLength : titleText.length;
            const status = u.titleTagStatus || (titleText ? "Present" : "Missing");
            return (
              <tr
                key={i}
                className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.025]"
              >
                <td className="px-3 py-3">
                  <PRBadge value={u.pr} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-[10px] font-bold text-emerald-300">
                      HTML
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {pageLabelForRow(u)}
                      </p>
                      <FullUrlLink url={u.url} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-white/60">
                  {u.traffic}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {titleText ? (
                    <span className="block max-w-[360px] truncate text-white/80">
                      {titleText}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                        status === "Empty"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center tabular-nums text-white/70">
                  {titleLength}
                </td>
                <td className="px-3 py-3 text-center text-white/70">
                  {u.indexable ? "Yes" : "No"}
                </td>
                <td className="px-3 py-3">
                  <PatchInput
                    placeholder={missingIssue ? "Add title tag" : "Rewrite title"}
                  />
                </td>
                <td className="py-3 text-right">
                  <button className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FullUrlLink({ url, icon = "external" }) {
  const Icon = icon === "search" ? Search : ExternalLink;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-1 text-xs leading-snug text-brand-300 hover:underline"
    >
      <span className="break-all">{url}</span>
      <Icon className="mt-0.5 h-3 w-3 flex-shrink-0" />
    </a>
  );
}

function WhyFixTooltip({ data }) {
  const guidance = getIssueGuidance(data);

  return (
    <span className="group relative ml-1 inline-flex">
      <button
        type="button"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white/80 focus:outline-none focus:ring-1 focus:ring-brand-400/50"
        aria-label={`Why and how to fix: ${data.title}`}
      >
        <HelpCircle className="h-3.5 w-3.5" /> Why and how to fix
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[340px] rounded-lg border border-white/10 bg-ink-950/95 p-3 text-left text-xs leading-relaxed text-white/70 opacity-0 shadow-2xl shadow-black/40 backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-200">
          Why it matters
        </span>
        <span className="mt-1 block">{guidance.why}</span>
        <span className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-brand-200">
          How to fix
        </span>
        <span className="mt-1 block">{guidance.how}</span>
      </span>
    </span>
  );
}

function getIssueGuidance(data) {
  const title = String(data?.title || "This issue");
  const description = String(data?.description || "").trim();
  const slug = String(data?.slug || "").toLowerCase();
  const combined = `${slug} ${title}`.toLowerCase();
  const defaultWhy =
    description ||
    `${title} can make search engines waste crawl budget, misunderstand the page, or show weaker search snippets.`;
  let how =
    "Review the affected URLs, update the CMS/template rule that creates the issue, publish the change, and run another crawl to confirm the issue count drops.";

  if (combined.includes("canonical")) {
    how =
      "Set each affected page to a single indexable canonical URL, avoid canonicals that point to redirects or errors, and make sure the canonical target is the preferred page.";
  } else if (combined.includes("noindex") || combined.includes("nofollow")) {
    how =
      "Check meta robots and X-Robots-Tag rules, remove accidental noindex/nofollow directives from pages that should rank, then recrawl the affected URLs.";
  } else if (combined.includes("title")) {
    how =
      "Add one clear title tag per page, keep it unique, align it with the page intent, and avoid duplicate, empty, or overly long title templates.";
  } else if (combined.includes("description")) {
    how =
      "Add one useful meta description per page, keep it unique, and rewrite empty, duplicate, too short, or too long descriptions in the page template.";
  } else if (combined.includes("redirect") || combined.includes("3xx")) {
    how =
      "Update internal links, canonicals, and sitemap entries to point directly at the final 200 URL, then remove unnecessary redirect hops.";
  } else if (combined.includes("4xx") || combined.includes("broken")) {
    how =
      "Restore the missing page, redirect it to the best replacement, or remove internal links and sitemap entries that still point to the broken URL.";
  } else if (combined.includes("sitemap")) {
    how =
      "Regenerate the sitemap so it only contains canonical, indexable, 200-status URLs, then resubmit it after deployment.";
  } else if (combined.includes("alt")) {
    how =
      "Add concise, descriptive alt text to linked images that communicate meaning, and leave decorative images empty only when they are truly decorative.";
  } else if (combined.includes("word count") || combined.includes("content")) {
    how =
      "Expand thin pages with useful original copy, consolidate near-duplicates, and make sure the page answers the search intent better than competing pages.";
  }

  return { why: defaultWhy, how };
}

function buildIssueDetail(auditData, slug) {
  const issue = findIssueBySlug(auditData, slug) || auditData.issueDetail;
  const total = Math.max(
    0,
    Object.prototype.hasOwnProperty.call(issue, "crawled")
      ? issue.crawled
      : auditData.issueDetail.urls.length
  );
  const urls = Array.isArray(issue.urls) && issue.urls.length > 0
    ? issue.urls
    : [];
  const history = normalizeHistory(issue.spark, total);

  return {
    ...auditData.issueDetail,
    slug: slug || issue.slug,
    title: issue.title || auditData.issueDetail.title,
    severity: issue.severity || auditData.issueDetail.severity,
    description: issue.description || auditData.issueDetail.description,
    fixable: Boolean(issue.fixable),
    total,
    urls,
    history,
    historyMax: Math.max(...history, 1),
  };
}

function isTitleIssue(slug = "") {
  return slug.includes("title");
}

function findIssueBySlug(auditData, slug) {
  const rows = [
    ...auditData.whatsNew,
    ...auditData.topIssues,
    ...auditData.issueCategories.flatMap((category) =>
      category.subgroups
        ? category.subgroups.flatMap((group) => group.items)
        : category.items
    ),
  ];
  return rows.find((row) => row.slug === slug);
}

function normalizeHistory(spark, total) {
  if (Array.isArray(spark) && spark.length > 0) return spark;
  return total > 0 ? [total] : [0];
}

function pageLabelForRow(row) {
  const rawTitle = String(row.pageTitle || row.title || "").trim();
  if (rawTitle && !/^title tag missing or empty/i.test(rawTitle)) return rawTitle;
  try {
    const url = new URL(row.url);
    const path = url.pathname.replace(/^\/|\/$/g, "");
    if (!path) return url.hostname;
    return path
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" / ")
      .replace(/[-_]+/g, " ");
  } catch {
    return rawTitle || "Untitled page";
  }
}

function PRBadge({ value }) {
  // Color the badge by PR value, like Ahrefs DR
  const color =
    value >= 40
      ? "from-emerald-500/30 to-emerald-500/10 text-emerald-200 ring-emerald-500/30"
      : value >= 20
      ? "from-amber-500/30 to-amber-500/10 text-amber-200 ring-amber-500/30"
      : "from-white/[0.06] to-transparent text-white/40 ring-white/10";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold ring-1 ring-inset ${color}`}
    >
      {value}
    </span>
  );
}

function PatchInput({ placeholder }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      className="w-32 rounded-md border border-dashed border-brand-500/30 bg-transparent px-2 py-1 text-xs text-white placeholder:text-brand-400/50 transition focus:border-brand-500/60 focus:outline-none"
    />
  );
}
