import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export default function GscKeywords() {
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
  const [sortCol, setSortCol] = useState("clicks");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const decodedSite = siteUrlFromId(siteId);
    if (decodedSite && decodedSite !== selectedSite) setSelectedSite(decodedSite);
  }, [selectedSite, setSelectedSite, siteId]);

  const filtered = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const rows = lowerQuery
      ? selectedData.keywords.filter(
          (row) =>
            row.keyword.toLowerCase().includes(lowerQuery) ||
            row.topUrl.toLowerCase().includes(lowerQuery)
        )
      : selectedData.keywords;

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
  }, [query, selectedData.keywords, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, pageSize]);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, device, query, searchType, selectedSite, sortCol, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function handleSort(col) {
    if (sortCol === col) setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    downloadCsv(
      "gsc-keywords.csv",
      [
        "Keyword",
        "Clicks",
        "Click change",
        "Impressions",
        "Impression change",
        "CTR",
        "CTR change",
        "Position",
        "Position change",
        "URLs",
        "Top URL",
      ],
      filtered.map((row) => [
        row.keyword,
        row.clicks,
        row.change,
        row.impressions,
        row.impChange,
        row.ctr,
        row.ctrChange,
        row.position,
        row.posChange,
        row.urls,
        row.topUrl,
      ])
    );
  }

  if (!isSignedIn) {
    return (
      <StatePanel
        title="Connect Google Search Console"
        body="Connect GSC to load live keyword data."
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
          <h1 className="font-display text-xl font-bold tracking-tight">Keywords</h1>
          <p className="mt-1 text-sm text-white/45">
            Query performance from Google Search Console.
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

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input
          type="text"
          placeholder="Filter keywords or top URLs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <span className="text-xs text-white/35">
          {filtered.length.toLocaleString()} rows
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <SortableTh label="Keyword" col="keyword" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Clicks" col="clicks" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="Impressions" col="impressions" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="CTR" col="ctr" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="Position" col="position" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="URLs" col="urls" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 font-medium text-white/50">Top URL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.keyword} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                <td className="max-w-[260px] px-3 py-2.5">
                  <span className="block truncate text-white/90">{row.keyword}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-medium">{formatNum(row.clicks)}</td>
                <td className="px-3 py-2.5 text-right"><ChangeCell value={row.change} /></td>
                <td className="px-3 py-2.5 text-right text-white/70">{formatNum(row.impressions)}</td>
                <td className="px-3 py-2.5 text-right"><ChangeCell value={row.impChange} /></td>
                <td className="px-3 py-2.5 text-right text-white/70">{row.ctr}%</td>
                <td className="px-3 py-2.5 text-right"><ChangeCell value={row.ctrChange} suffix="%" /></td>
                <td className="px-3 py-2.5 text-right text-white/70">{row.position}</td>
                <td className="px-3 py-2.5 text-right"><PositionChange value={row.posChange} /></td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-200">
                    {row.urls}
                  </span>
                </td>
                <td className="max-w-[280px] px-3 py-2.5">
                  {row.topUrl ? (
                    <a
                      href={row.topUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1 text-blue-300/80 hover:text-blue-300"
                    >
                      <span className="truncate">{row.topUrl}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                    </a>
                  ) : (
                    <span className="text-white/30">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-6 py-14 text-center text-sm text-white/40">
            {isLoadingSelected ? "Loading keyword rows..." : "No keyword rows for this period."}
          </div>
        )}
        {filtered.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            pageEnd={pageEnd}
            pageSize={pageSize}
            pageStart={pageStart}
            setCurrentPage={setCurrentPage}
            setPageSize={setPageSize}
            totalPages={totalPages}
            totalRows={filtered.length}
          />
        )}
      </div>
    </div>
  );
}

function getSortValue(row, column) {
  if (column === "keyword") return row.keyword;
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

function ChangeCell({ value, suffix = "" }) {
  const numeric = Number(value) || 0;
  if (numeric === 0) return <span className="text-white/30">-</span>;
  const positive = numeric > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${positive ? "text-emerald-400" : "text-rose-400"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {Math.abs(numeric) >= 1000 ? formatNum(numeric) : numeric}
      {suffix}
    </span>
  );
}

function PositionChange({ value }) {
  const numeric = Number(value) || 0;
  if (numeric === 0) return <span className="text-white/30">-</span>;
  const improved = numeric < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${improved ? "text-emerald-400" : "text-rose-400"}`}>
      {improved ? "Up" : "Down"} {Math.abs(numeric)}
    </span>
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

function PaginationControls({
  currentPage,
  pageEnd,
  pageSize,
  pageStart,
  setCurrentPage,
  setPageSize,
  totalPages,
  totalRows,
}) {
  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-3 text-xs text-white/50 lg:flex-row lg:items-center lg:justify-between">
      <div>
        Showing{" "}
        <span className="font-semibold text-white">
          {pageStart.toLocaleString()}-{pageEnd.toLocaleString()}
        </span>{" "}
        of <span className="font-semibold text-white">{totalRows.toLocaleString()}</span> keywords
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-white/45">
          Rows
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs font-semibold text-white focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-white/35">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`h-8 min-w-[2rem] rounded-lg border px-2 text-xs font-semibold transition ${
                  page === currentPage
                    ? "border-brand-400/40 bg-brand-500/20 text-brand-100"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {page}
              </button>
            )
          )}

          <button
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
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
