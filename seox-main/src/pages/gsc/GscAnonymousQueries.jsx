import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  EyeOff,
  Search,
} from "lucide-react";
import {
  siteUrlFromId,
  useGscInsights,
} from "../../context/GscInsightsContext.jsx";

function formatNum(n) {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function GscAnonymousQueries() {
  const { siteId } = useParams();
  const {
    datePreset,
    datePresets,
    device,
    deviceOptions,
    error,
    handleSignIn,
    isLoadingSelected,
    isSignedIn,
    searchType,
    searchTypeOptions,
    selectedData,
    selectedSite,
    setDatePreset,
    setDevice,
    setSearchType,
    setSelectedSite,
  } = useGscInsights();
  const [sortCol, setSortCol] = useState("hiddenClicks");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const decodedSite = siteUrlFromId(siteId);
    if (decodedSite && decodedSite !== selectedSite) setSelectedSite(decodedSite);
  }, [selectedSite, setSelectedSite, siteId]);

  const anonymousRows = useMemo(() => buildAnonymousRows(selectedData), [selectedData]);
  const totals = useMemo(() => {
    const hiddenClicks = anonymousRows.reduce((sum, row) => sum + row.hiddenClicks, 0);
    const hiddenImpressions = anonymousRows.reduce((sum, row) => sum + row.hiddenImpressions, 0);
    const reportedQueryClicks = selectedData.queryRows.reduce(
      (sum, row) => sum + (Number(row.clicks) || 0),
      0
    );
    const totalClicks = selectedData.summary?.totalClicks || 0;

    return {
      hiddenClicks,
      hiddenImpressions,
      reportedQueryClicks,
      totalClicks,
    };
  }, [anonymousRows, selectedData.queryRows, selectedData.summary]);

  const filtered = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const rows = lowerQuery
      ? anonymousRows.filter(
          (row) =>
            row.url.toLowerCase().includes(lowerQuery) ||
            row.topKeyword.toLowerCase().includes(lowerQuery)
        )
      : anonymousRows;

    return [...rows].sort((a, b) => {
      const av = getSortValue(a, sortCol);
      const bv = getSortValue(b, sortCol);
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "desc"
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [anonymousRows, query, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    downloadCsv(
      "gsc-unreported-query-gaps.csv",
      [
        "URL",
        "Unreported clicks",
        "Unreported impressions",
        "Page clicks",
        "Page impressions",
        "Reported keyword rows",
        "Top reported keyword",
      ],
      filtered.map((row) => [
        row.url,
        row.hiddenClicks,
        row.hiddenImpressions,
        row.pageClicks,
        row.pageImpressions,
        row.reportedKeywords,
        row.topKeyword,
      ])
    );
  }

  if (!isSignedIn) {
    return (
      <StatePanel
        title="Connect Google Search Console"
        body="Connect GSC to calculate unreported query gaps from live page and query data."
        actionLabel="Connect GSC"
        onAction={handleSignIn}
        error={error}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight">
              Anonymous queries
            </h1>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/40"
              title="Google Search Console does not expose anonymized query text through the API. This report uses live GSC data to estimate unreported query gaps by page."
            >
              ?
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-white/45">
            GSC does not provide the hidden query text through its API. This page
            shows the actual gap between total page performance and reported
            query/page rows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label={datePresets.find((preset) => preset.id === datePreset)?.label || "Date"}
            options={datePresets}
            value={datePreset}
            onChange={setDatePreset}
            optionLabel={(option) => option.label}
            optionValue={(option) => option.id}
          />
          <FilterPill
            label={`Search type: ${searchType}`}
            options={searchTypeOptions}
            value={searchType}
            onChange={setSearchType}
          />
          <FilterPill
            label={device === "All" ? "Device" : device}
            options={deviceOptions}
            value={device}
            onChange={setDevice}
          />
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total page clicks" value={formatNum(totals.totalClicks)} />
        <StatCard label="Reported query clicks" value={formatNum(totals.reportedQueryClicks)} />
        <StatCard label="Unreported click gap" value={formatNum(totals.hiddenClicks)} highlight />
        <StatCard label="Unreported impression gap" value={formatNum(totals.hiddenImpressions)} highlight />
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input
          type="text"
          placeholder="Filter URLs or reported keywords..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <span className="text-xs text-white/35">
          {filtered.length.toLocaleString()} pages
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <SortableTh label="URL" col="url" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Unreported clicks" col="hiddenClicks" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Unreported impressions" col="hiddenImpressions" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Page clicks" col="pageClicks" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Reported keywords" col="reportedKeywords" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 font-medium text-white/50">Top reported keyword</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.url} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                <td className="max-w-[380px] px-3 py-2.5">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-1 text-blue-300/80 hover:text-blue-300"
                  >
                    <span className="truncate">{row.url}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  </a>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-amber-200">
                  {formatNum(row.hiddenClicks)}
                </td>
                <td className="px-3 py-2.5 text-right text-white/70">
                  {formatNum(row.hiddenImpressions)}
                </td>
                <td className="px-3 py-2.5 text-right text-white/70">
                  {formatNum(row.pageClicks)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-200">
                    {row.reportedKeywords}
                  </span>
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <span className="block truncate text-white/60">
                    {row.topKeyword || "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-14 text-center text-sm text-white/40">
            {isLoadingSelected
              ? "Calculating query gaps..."
              : "No unreported query gap was found for this period."}
          </div>
        )}
      </div>
    </div>
  );
}

function buildAnonymousRows(selectedData) {
  const queryPageByUrl = new Map();

  selectedData.queryPageRows.forEach((row) => {
    const query = row.keys?.[0] || "";
    const url = row.keys?.[1] || "";
    if (!url) return;
    const current =
      queryPageByUrl.get(url) ||
      {
        clicks: 0,
        impressions: 0,
        keywords: new Map(),
      };
    const clicks = Number(row.clicks) || 0;
    const impressions = Number(row.impressions) || 0;
    current.clicks += clicks;
    current.impressions += impressions;
    const keyword = current.keywords.get(query) || { keyword: query, clicks: 0 };
    keyword.clicks += clicks;
    current.keywords.set(query, keyword);
    queryPageByUrl.set(url, current);
  });

  return selectedData.pages
    .map((page) => {
      const reported = queryPageByUrl.get(page.url) || {
        clicks: 0,
        impressions: 0,
        keywords: new Map(),
      };
      const topKeyword = [...reported.keywords.values()].sort(
        (a, b) => b.clicks - a.clicks
      )[0];

      return {
        url: page.url,
        hiddenClicks: Math.max(0, Math.round(page.clicks - reported.clicks)),
        hiddenImpressions: Math.max(
          0,
          Math.round(page.impressions - reported.impressions)
        ),
        pageClicks: page.clicks,
        pageImpressions: page.impressions,
        reportedKeywords: reported.keywords.size,
        topKeyword: topKeyword?.keyword || page.topKeyword || "",
      };
    })
    .filter((row) => row.hiddenClicks > 0 || row.hiddenImpressions > 0)
    .sort((a, b) => b.hiddenClicks - a.hiddenClicks);
}

function getSortValue(row, column) {
  if (column === "url") return row.url;
  return Number(row[column]) || 0;
}

function SortIcon({ active, sortDir }) {
  if (!active) return null;
  return sortDir === "desc" ? (
    <ChevronDown className="inline h-3 w-3 text-brand-300" />
  ) : (
    <ChevronUp className="inline h-3 w-3 text-brand-300" />
  );
}

function SortableTh({ label, col, numeric, sortCol, sortDir, onSort }) {
  return (
    <th className={`px-3 py-3 font-medium text-white/50 ${numeric ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 hover:text-white ${numeric ? "justify-end" : ""}`}
      >
        {label}
        <SortIcon active={sortCol === col} sortDir={sortDir} />
      </button>
    </th>
  );
}

function FilterPill({
  label,
  options,
  value,
  onChange,
  optionLabel = (option) => option,
  optionValue = (option) => option,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((state) => !state)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/[0.08]"
      >
        {label}
        <ChevronDown className="h-3 w-3 text-white/40" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 min-w-[170px] overflow-hidden rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl">
          {options.map((option) => {
            const nextValue = optionValue(option);
            return (
              <button
                key={nextValue}
                onClick={() => {
                  onChange(nextValue);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-lg px-3 py-1.5 text-xs transition ${
                  nextValue === value
                    ? "bg-brand-500/15 text-brand-200"
                    : "text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {optionLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <EyeOff className={`h-3.5 w-3.5 ${highlight ? "text-amber-300" : "text-brand-300"}`} />
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold ${highlight ? "text-amber-200" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function StatePanel({ title, body, actionLabel, onAction, error }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/50">{body}</p>
      {error && (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function downloadCsv(filename, headers, rows) {
  const csvRows = [headers, ...rows].map((row) =>
    row
      .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
