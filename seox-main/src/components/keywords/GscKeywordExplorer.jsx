import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Calendar,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Tag,
  TrendingDown,
  X,
} from "lucide-react";
import { useGscKeywordData } from "../../hooks/useGscKeywordData.js";
import {
  buildKeywordRows,
  downloadCsv,
  formatDateShort,
  formatNumber,
  formatPctChange,
  getBrandStem,
  getSiteDomain,
} from "../../lib/keywordTools.js";

const KIND_CONFIG = {
  new: {
    title: "New Keywords",
    subtitle: "Keywords your site started ranking for in the current period.",
    Icon: ArrowUpRight,
    accent: "blue",
    empty: "No new keywords found for this period.",
  },
  "low-hanging": {
    title: "Low Hanging Keywords",
    subtitle: "Keywords ranking around page 1-3 that are close enough to optimize.",
    Icon: ArrowUp,
    accent: "amber",
    empty: "No low-hanging opportunities found for this period.",
  },
  lost: {
    title: "Lost Keywords",
    subtitle: "Keywords your site ranked for previously but no longer ranks for now.",
    Icon: TrendingDown,
    accent: "rose",
    empty: "No lost keywords found for this period.",
  },
  branded: {
    title: "Branded Keywords",
    subtitle: "Queries containing your brand name that drive Search Console performance.",
    Icon: Tag,
    accent: "violet",
    empty: "No branded keywords found for this period.",
  },
};

const accentClasses = {
  blue: {
    icon: "bg-blue-500/15 text-blue-400",
    button: "from-blue-500 to-indigo-500",
    panel: "border-blue-500/20 bg-blue-500/[0.04]",
    text: "text-blue-300",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-400",
    button: "from-amber-500 to-orange-500",
    panel: "border-amber-500/20 bg-amber-500/[0.04]",
    text: "text-amber-300",
  },
  rose: {
    icon: "bg-rose-500/15 text-rose-400",
    button: "from-rose-500 to-pink-500",
    panel: "border-rose-500/20 bg-rose-500/[0.04]",
    text: "text-rose-300",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-400",
    button: "from-violet-500 to-purple-500",
    panel: "border-violet-500/20 bg-violet-500/[0.04]",
    text: "text-violet-300",
  },
};

export default function GscKeywordExplorer({ kind }) {
  const config = KIND_CONFIG[kind] || KIND_CONFIG.new;
  const colors = accentClasses[config.accent];
  const gsc = useGscKeywordData(`keywords-${kind}`);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("clicks");
  const [sortDirection, setSortDirection] = useState("desc");

  const allRows = useMemo(
    () => buildKeywordRows(gsc.currentRows, gsc.previousRows, gsc.selectedSite),
    [gsc.currentRows, gsc.previousRows, gsc.selectedSite]
  );
  const brandStem = getBrandStem(gsc.selectedSite);
  const rows = useMemo(() => {
    if (kind === "new") return allRows.filter((row) => row.isNew);
    if (kind === "low-hanging") return allRows.filter((row) => row.isLowHanging);
    if (kind === "lost") return allRows.filter((row) => row.isLost);
    if (kind === "branded") {
      return allRows.filter((row) => brandStem && row.keyword.toLowerCase().includes(brandStem));
    }
    return allRows;
  }, [allRows, brandStem, kind]);
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const direction = sortDirection === "asc" ? 1 : -1;
    return rows
      .filter((row) => !query || row.keyword.toLowerCase().includes(query) || row.topPageDisplay.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortField === "keyword") return a.keyword.localeCompare(b.keyword) * direction;
        if (sortField === "position") return (displayPosition(a) - displayPosition(b)) * direction;
        return (Number(a[sortField] || 0) - Number(b[sortField] || 0)) * direction;
      });
  }, [rows, searchTerm, sortDirection, sortField]);
  const totals = useMemo(
    () => ({
      clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      impressions: rows.reduce((sum, row) => sum + row.impressions, 0),
      previousImpressions: rows.reduce((sum, row) => sum + row.prevImpressions, 0),
    }),
    [rows]
  );

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "keyword" || field === "position" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    if (!filteredRows.length) return;
    downloadCsv(`${kind}-keywords-${getSiteDomain(gsc.selectedSite) || "gsc"}.csv`, [
      ["Keyword", "Top Page", "Position", "Position Change", "Clicks", "Click Change", "Impressions", "Impression Change"],
      ...filteredRows.map((row) => [
        row.keyword,
        row.topPage || row.topPageDisplay,
        displayPosition(row).toFixed(1),
        row.positionDelta.toFixed(1),
        row.clicks,
        formatPctChange(row.clicksPct),
        row.impressions,
        formatPctChange(row.impressionsPct),
      ]),
    ]);
  }

  if (gsc.isCheckingConnection) {
    return <LoadingState label="Checking Search Console connection..." />;
  }

  if (!gsc.isSignedIn) {
    return (
      <ConnectState
        colors={colors}
        config={config}
        error={gsc.error}
        onConnect={gsc.handleSignIn}
        redirectUri={gsc.redirectUri}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.icon}`}>
            <config.Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-white">{config.title}</h1>
            <p className="text-xs text-white/35">{config.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!filteredRows.length}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/50 transition hover:text-white/70 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={gsc.handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/40 transition hover:text-rose-300"
            title={gsc.gscEmail || "Disconnect Search Console"}
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-2.5">
            <Globe className="h-4 w-4 text-blue-400" />
            <select
              value={gsc.selectedSite}
              onChange={(event) => gsc.setSelectedSite(event.target.value)}
              className="w-full bg-transparent text-sm text-white/60 focus:outline-none"
            >
              {gsc.sites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {site.siteUrl}
                </option>
              ))}
            </select>
          </div>
          <DatePill start={gsc.currentStart} end={gsc.currentEnd} />
          <span className="text-xs text-white/20">vs</span>
          <DatePill start={gsc.previousStart} end={gsc.previousEnd} muted />
          <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
            {gsc.datePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => gsc.setDatePreset(preset.id)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${
                  gsc.datePreset === preset.id ? "bg-blue-500 text-white" : "text-white/30 hover:text-white/50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <DateInput
            label="Start"
            value={gsc.customStartDate}
            onChange={(value) => {
              gsc.setDatePreset("custom");
              gsc.setCustomStartDate(value);
            }}
          />
          <DateInput
            label="End"
            value={gsc.customEndDate}
            onChange={(value) => {
              gsc.setDatePreset("custom");
              gsc.setCustomEndDate(value);
            }}
          />
          <button
            onClick={gsc.fetchAllData}
            disabled={!gsc.selectedSite || gsc.isLoading}
            className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${colors.button}`}
          >
            {gsc.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Apply
          </button>
        </div>
      </div>

      {gsc.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{gsc.error}</span>
          <button onClick={() => gsc.setError("")} className="text-rose-200/60 hover:text-rose-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={`rounded-2xl border p-5 ${colors.panel}`}>
        <h3 className="mb-2 text-sm font-bold text-white/70">Highlights</h3>
        <p className="text-xs text-white/45">{highlightText(kind, rows.length, totals, gsc.selectedSite, brandStem)}</p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-bold text-white/70">
            {config.title} <span className="text-white/30">({filteredRows.length})</span>
          </h3>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#010409] px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/25" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-36 bg-transparent text-xs text-white/60 placeholder:text-white/20 focus:outline-none"
              placeholder="Search..."
            />
          </div>
        </div>

        <div className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-2 border-b border-white/[0.06] bg-white/[0.01] px-5 py-2.5">
          <TH label="Keyword" onClick={() => handleSort("keyword")} />
          <TH label="Top Page" />
          <TH label="Position" onClick={() => handleSort("position")} />
          <TH label="Change" />
          <TH label="Clicks" onClick={() => handleSort("clicks")} />
          <TH label="% Change" />
          <TH label="Impressions" onClick={() => handleSort("impressions")} />
          <TH label="% Change" />
        </div>

        {gsc.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : filteredRows.length ? (
          filteredRows.map((row, index) => (
            <div
              key={`${row.keyword}-${index}`}
              className={`grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${
                index < filteredRows.length - 1 ? "border-b border-white/[0.03]" : ""
              }`}
            >
              <span className="truncate text-sm text-blue-300" title={row.keyword}>{row.keyword}</span>
              <TopPage row={row} />
              <span className="font-mono text-xs text-white/60">{displayPosition(row) ? displayPosition(row).toFixed(1) : "-"}</span>
              <PositionDelta row={row} />
              <span className="font-mono text-xs text-white/60">{formatNumber(row.clicks)}</span>
              <Pct value={row.clicksPct} />
              <span className="font-mono text-xs text-white/60">{formatNumber(row.impressions)}</span>
              <Pct value={row.impressionsPct} />
            </div>
          ))
        ) : (
          <div className="py-16 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-white/[0.06]" />
            <p className="mt-3 text-sm text-white/25">{gsc.currentRows.length || gsc.previousRows.length ? config.empty : "Connect a property and apply a date range to load keyword data."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function displayPosition(row) {
  return row.isLost && row.prevPosition ? row.prevPosition : row.position;
}

function highlightText(kind, count, totals, siteUrl, brandStem) {
  const site = getSiteDomain(siteUrl) || "this property";
  if (kind === "new") {
    return `${site} started ranking for ${formatNumber(count)} new keywords with ${formatNumber(totals.impressions)} impressions and ${formatNumber(totals.clicks)} clicks in the current period.`;
  }
  if (kind === "low-hanging") {
    return `${formatNumber(count)} keywords are ranking between positions 8 and 30, where focused updates and internal links can often move the needle.`;
  }
  if (kind === "lost") {
    return `${site} lost ${formatNumber(count)} keywords that had ${formatNumber(totals.previousImpressions)} previous-period impressions.`;
  }
  return `${formatNumber(count)} branded keywords containing "${brandStem || site}" were found for ${site}.`;
}

function ConnectState({ colors, config, error, onConnect, redirectUri }) {
  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.icon}`}>
          <config.Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-white">{config.title}</h1>
          <p className="text-xs text-white/35">{config.subtitle}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-8 text-center">
        <Globe className="mx-auto h-12 w-12 text-white/20" />
        <h2 className="mt-4 text-lg font-bold text-white/80">Connect Google Search Console</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/35">
          AI Smart Seo needs readonly Search Console access to fetch keyword clicks, impressions, positions, and page data.
        </p>
        <button
          onClick={onConnect}
          className={`mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r px-6 py-3 text-sm font-bold text-white shadow-lg ${colors.button}`}
        >
          <LogIn className="h-4 w-4" />
          Connect Search Console
        </button>
        <p className="mx-auto mt-4 max-w-lg text-[11px] text-white/20">
          Google OAuth callback URL: <span className="font-mono text-white/35">{redirectUri}</span>
        </p>
        {error && <p className="mt-4 text-xs font-semibold text-rose-300">{error}</p>}
      </div>
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
        <p className="mt-3 text-sm text-white/35">{label}</p>
      </div>
    </div>
  );
}

function DatePill({ end, muted, start }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-2.5">
      <Calendar className="h-3.5 w-3.5 text-white/30" />
      <span className={`text-xs ${muted ? "text-white/35" : "text-white/50"}`}>
        {formatDateShort(start)} - {formatDateShort(end)}
      </span>
    </div>
  );
}

function DateInput({ label, onChange, value }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-white/25">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-xs text-white/55 outline-none [color-scheme:dark]"
      />
    </label>
  );
}

function TH({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="text-left text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/50 disabled:hover:text-white/30"
    >
      {label}
    </button>
  );
}

function TopPage({ row }) {
  if (!row.topPage) return <span className="truncate text-xs text-white/25">-</span>;
  return (
    <a
      href={row.topPage}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-white/40 hover:text-blue-300"
      title={row.topPage}
    >
      <span className="truncate">{row.topPageDisplay}</span>
      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
    </a>
  );
}

function PositionDelta({ row }) {
  if (row.isNew) return <span className="text-[10px] font-bold text-emerald-400">New</span>;
  if (row.isLost) return <span className="text-[10px] font-bold text-rose-400">Lost</span>;
  if (!row.positionDelta) return <span className="text-[10px] font-bold text-white/25">0</span>;
  const improved = row.positionDelta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${improved ? "text-emerald-400" : "text-rose-400"}`}>
      {improved ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(row.positionDelta).toFixed(1)}
    </span>
  );
}

function Pct({ value }) {
  const text = formatPctChange(value);
  const cls = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-white/30";
  return <span className={`text-[10px] font-bold ${cls}`}>{text}</span>;
}
