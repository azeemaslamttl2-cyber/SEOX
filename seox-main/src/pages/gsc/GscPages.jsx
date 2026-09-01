import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
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

export default function GscPages() {
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

  useEffect(() => {
    const decodedSite = siteUrlFromId(siteId);
    if (decodedSite && decodedSite !== selectedSite) setSelectedSite(decodedSite);
  }, [selectedSite, setSelectedSite, siteId]);

  const filtered = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const rows = lowerQuery
      ? selectedData.pages.filter(
          (row) =>
            row.url.toLowerCase().includes(lowerQuery) ||
            row.topKeyword.toLowerCase().includes(lowerQuery)
        )
      : selectedData.pages;

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
  }, [query, selectedData.pages, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    downloadCsv(
      "gsc-pages.csv",
      [
        "URL",
        "Clicks",
        "Click change",
        "Impressions",
        "Impression change",
        "CTR",
        "CTR change",
        "Position",
        "Position change",
        "Keywords",
        "Top keyword",
      ],
      filtered.map((row) => [
        row.url,
        row.clicks,
        row.change,
        row.impressions,
        row.impChange,
        row.ctr,
        row.ctrChange,
        row.position,
        row.posChange,
        row.keywords,
        row.topKeyword,
      ])
    );
  }

  if (!isSignedIn) {
    return (
      <StatePanel
        title="Connect Google Search Console"
        body="Connect GSC to load live page performance."
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
          <h1 className="font-display text-xl font-bold tracking-tight">Pages</h1>
          <p className="mt-1 text-sm text-white/45">
            Landing page performance from Google Search Console.
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
          placeholder="Filter URLs or top keywords..."
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
              <SortableTh label="URL" col="url" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Clicks" col="clicks" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="Impressions" col="impressions" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="CTR" col="ctr" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="Position" col="position" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 text-right font-medium text-white/50">Change</th>
              <SortableTh label="Keywords" col="keywords" numeric sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 font-medium text-white/50">Top keyword</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.url} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                <td className="max-w-[360px] px-3 py-2.5">
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
                    {row.keywords}
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
            {isLoadingSelected ? "Loading page rows..." : "No page rows for this period."}
          </div>
        )}
      </div>
    </div>
  );
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
