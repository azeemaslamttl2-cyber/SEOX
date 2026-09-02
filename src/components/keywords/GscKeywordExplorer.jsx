import { useCallback, useMemo, useState } from "react";
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
import { useAuth } from "../../context/AuthContext.jsx";
import { useGscKeywordData } from "../../hooks/useGscKeywordData.js";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import {
  buildKeywordRows,
  downloadCsv,
  formatDateShort,
  formatNumber,
  formatPctChange,
  getBrandStem,
  getSiteDomain,
} from "../../lib/keywordTools.js";
import { saveProjectData } from "../../lib/projectsApi.js";

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
  blue:   { button: "gke-apply", panel: "gke-panel", text: "gke-text-info" },
  amber:  { button: "gke-apply", panel: "gke-panel", text: "gke-text-warning" },
  rose:   { button: "gke-apply", panel: "gke-panel", text: "gke-text-danger" },
  violet: { button: "gke-apply", panel: "gke-panel", text: "gke-text-brand" },
};

export default function GscKeywordExplorer({ kind }) {
  const config = KIND_CONFIG[kind] || KIND_CONFIG.new;
  const colors = accentClasses[config.accent];
  const { user } = useAuth();
  const userId = user?.uid || user?.id || "";
  const { project } = useSelectedProjectDomain();
  const projectId = project?.id || project?.project_id || "";
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("clicks");
  const [sortDirection, setSortDirection] = useState("desc");

  const persistKeywordSnapshot = useCallback(
    async ({ current, previous, selectedSite, currentStart, currentEnd, previousStart, previousEnd }) => {
      if (!userId || !projectId) return;

      try {
        const keywordRows = buildKeywordRows(current || [], previous || [], selectedSite || "");
        const persistedRows = kind === "low-hanging"
          ? keywordRows.filter((row) => row.isLowHanging)
          : kind === "lost"
            ? keywordRows.filter((row) => row.isLost)
            : kind === "branded"
              ? keywordRows.filter((row) => brandStem && row.keyword.toLowerCase().includes(brandStem))
              : undefined;

        const projectDataKey = kind === "branded"
          ? "branded-keywords"
          : kind === "low-hanging"
            ? "low-hanging-keywords"
            : "lost-keywords";

        await saveProjectData(userId, {
          projectId,
          key: projectDataKey,
          value: {
              kind,
              selectedSite: selectedSite || "",
              currentRows: current || [],
              previousRows: previous || [],
              dateRange: {
                currentStart,
                currentEnd,
                previousStart,
                previousEnd,
              },
              fetchedAt: new Date().toISOString(),
              rows: kind === "branded" ? persistedRows || [] : current || [],
              ...(kind === "low-hanging" && persistedRows ? { lowHangingRows: persistedRows } : {}),
              ...(kind === "lost" && persistedRows ? { lostRows: persistedRows } : {}),
          },
        });
      } catch (error) {
        console.error(`Failed to save ${kind} keyword snapshot:`, error);
        throw error;
      }
    },
    [kind, projectId, userId]
  );

  const gsc = useGscKeywordData(`keywords-${kind}`, {
    onAutoFetchSuccess: ["low-hanging", "lost", "branded"].includes(kind) ? persistKeywordSnapshot : undefined,
  });

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
    return <LoadingState config={config} label="Checking Search Console connection..." />;
  }

  if (!gsc.isSignedIn) {
    return (
      <ConnectState
        config={config}
        error={gsc.error}
        onConnect={gsc.handleSignIn}
        redirectUri={gsc.redirectUri}
      />
    );
  }

  return (
    <div className={`gsc-keyword-explorer gsc-keyword-explorer-${kind} kw-page space-y-5`}>
      <div className="kw-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="kw-title-row">
          <span className="gke-icon">
            <config.Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="kw-title font-display">{config.title}</h1>
            <p className="kw-description">{config.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!filteredRows.length}
            className="ui-button gke-secondary"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={gsc.handleSignOut}
            className="ui-button gke-disconnect"
            title={gsc.gscEmail || "Disconnect Search Console"}
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
        </div>
      </div>

      <div className="gke-filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="gke-field">
            <Globe className="h-4 w-4" />
            <select
              value={gsc.selectedSite}
              onChange={(event) => gsc.setSelectedSite(event.target.value)}
              className="gke-site-select"
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
          <div className="admin-tabs gke-presets">
            {gsc.datePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => gsc.setDatePreset(preset.id)}
                className={`admin-tab ${gsc.datePreset === preset.id ? "active" : ""}`}
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
            onClick={async () => {
              await gsc.fetchAllData({
                onSuccess: async ({ current, previous, selectedSite, currentStart, currentEnd, previousStart, previousEnd }) => {
                  await persistKeywordSnapshot({
                    current,
                    previous,
                    selectedSite,
                    currentStart,
                    currentEnd,
                    previousStart,
                    previousEnd,
                  });
                },
              });
            }}
            disabled={!gsc.selectedSite || gsc.isLoading}
            className={`ui-button ui-button-primary ${colors.button}`}
          >
            {gsc.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Apply
          </button>
        </div>
      </div>

      {gsc.error && (
        <div className="app-alert app-alert-error">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{gsc.error}</span>
          <button onClick={() => gsc.setError("")} className="gke-alert-close" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={`gsc-keyword-highlights rounded-2xl border p-5 ${colors.panel}`}>
        <h3 className="mb-2 text-sm font-bold text-white/70">Highlights</h3>
        <p className="text-xs text-white/45">{highlightText(kind, rows.length, totals, gsc.selectedSite, brandStem)}</p>
      </div>

      <div className="gsc-keyword-results kw-results">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-bold text-white/70">
            {config.title} <span className="text-white/30">({filteredRows.length})</span>
          </h3>
          <div className="kw-search">
            <Search className="h-3.5 w-3.5 text-white/25" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="kw-search-input w-36"
              placeholder="Search..."
            />
          </div>
        </div>

        <div className="gsc-keyword-table-header grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-2 border-b border-white/[0.06] bg-white/[0.01] px-5 py-2.5">
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
              className={`gsc-keyword-row grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${
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

function KeywordHero({ children, config }) {
  return (
    <div className="kw-hero">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="kw-title-row">
          <span className="gke-icon">
            <config.Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="kw-title font-display">{config.title}</h1>
            <p className="kw-description">{config.subtitle}</p>
          </div>
        </div>
        {children ? <div className="flex flex-shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

function ConnectState({ config, error, onConnect, redirectUri }) {
  return (
    <div className="kw-page space-y-5">
      <KeywordHero config={config} />
      <div className="kw-connect-card">
        <span className="kw-connect-icon">
          <Globe className="h-6 w-6" />
        </span>
        <h2 className="kw-connect-title">Connect Google Search Console</h2>
        <p className="kw-connect-text">
          PGC needs readonly Search Console access to fetch keyword clicks, impressions, positions, and page data.
        </p>
        <button
          onClick={onConnect}
          className="ui-button ui-button-primary kw-connect-button"
        >
          <LogIn className="h-4 w-4" />
          Connect Search Console
        </button>
        <p className="kw-connect-meta">
          Google OAuth callback URL: <span className="kw-connect-uri">{redirectUri}</span>
        </p>
        {error && <p className="kw-connect-error">{error}</p>}
      </div>
    </div>
  );
}

function LoadingState({ config, label }) {
  return (
    <div className="kw-page space-y-5">
      {config ? <KeywordHero config={config} /> : null}
      <div className="kw-connect-card kw-loading-card">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="kw-connect-text">{label}</p>
      </div>
    </div>
  );
}

function DatePill({ end, muted, start }) {
  return (
    <div className="gke-field">
      <Calendar className="h-3.5 w-3.5 text-white/30" />
      <span className={`text-xs ${muted ? "text-white/35" : "text-white/50"}`}>
        {formatDateShort(start)} - {formatDateShort(end)}
      </span>
    </div>
  );
}

function DateInput({ label, onChange, value }) {
  return (
    <label className="gke-field gke-datefield">
      <span className="text-[10px] font-bold uppercase tracking-wide text-white/25">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="gke-date-input"
      />
    </label>
  );
}

function TH({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="gke-th"
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
