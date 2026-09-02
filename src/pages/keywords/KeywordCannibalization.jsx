import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useGscKeywordData } from "../../hooks/useGscKeywordData.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import {
  buildCannibalizationRows,
  downloadCsv,
  formatDateShort,
  formatNumber,
  formatPctChange,
  getSiteDomain,
} from "../../lib/keywordTools.js";
import { saveProjectData } from "../../lib/projectsApi.js";

export default function KeywordCannibalization() {
  const { user } = useAuth();
  const { project } = useSelectedProjectDomain();
  const gsc = useGscKeywordData("keyword-cannibalization");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("impressions");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showInfo, setShowInfo] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  const rows = useMemo(
    () => buildCannibalizationRows(gsc.currentRows, gsc.previousRows, gsc.selectedSite),
    [gsc.currentRows, gsc.previousRows, gsc.selectedSite]
  );
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const direction = sortDirection === "asc" ? 1 : -1;
    return rows
      .filter((row) => !query || row.keyword.toLowerCase().includes(query) || row.pages.some((page) => page.display.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortField === "keyword") return a.keyword.localeCompare(b.keyword) * direction;
        return (Number(a[sortField] || 0) - Number(b[sortField] || 0)) * direction;
      });
  }, [rows, searchTerm, sortDirection, sortField]);

  async function persistCannibalization(current, previous, selectedSite) {
    const userId = user?.uid || user?.id || "";
    const projectId = project?.id || project?.project_id || "";
    if (!userId) throw new Error("You must be signed in to save Cannibalization results.");
    if (!projectId) throw new Error("Select a project before applying Cannibalization results.");

    const result = buildCannibalizationRows(current || [], previous || [], selectedSite || "");
    const response = await saveProjectData(userId, {
      projectId,
      key: "cannibalization",
      value: result,
    });
    if (!response?.success) throw new Error("Cannibalization results could not be saved.");
    setSaveStatus("Cannibalization results saved.");
  }

  async function applyCannibalization() {
    setSaveStatus("");
    await gsc.fetchAllData({
      onSuccess: ({ current, previous, selectedSite }) =>
        persistCannibalization(current, previous, selectedSite),
    });
  }

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
    downloadCsv(`keyword-cannibalization-${getSiteDomain(gsc.selectedSite) || "gsc"}.csv`, [
      ["Keyword", "Pages", "Page URLs", "Impressions", "Impression Change", "Position", "Position Change", "Clicks", "Click Change"],
      ...filteredRows.map((row) => [
        row.keyword,
        row.pageCount,
        row.pages.map((page) => page.url).join(" | "),
        row.impressions,
        formatPctChange(row.impressionsPct),
        row.position.toFixed(1),
        row.positionChange.toFixed(1),
        row.clicks,
        formatPctChange(row.clicksPct),
      ]),
    ]);
  }

  if (gsc.isCheckingConnection) {
    return (
      <div className="keyword-cannibalization-page kw-page space-y-5">
        <Hero />
        <div className="kw-connect-card kw-loading-card">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="kw-connect-text">Checking Search Console connection...</p>
        </div>
      </div>
    );
  }

  if (!gsc.isSignedIn) {
    return (
      <div className="keyword-cannibalization-page kw-page space-y-5">
        <Hero />
        <div className="kw-connect-card">
          <span className="kw-connect-icon">
            <Globe className="h-6 w-6" />
          </span>
          <h2 className="kw-connect-title">Connect Google Search Console</h2>
          <p className="kw-connect-text">
            PGC needs query and page data to detect when multiple URLs compete for the same keyword.
          </p>
          <button
            onClick={gsc.handleSignIn}
            className="ui-button ui-button-primary kw-connect-button"
          >
            <LogIn className="h-4 w-4" />
            Connect Search Console
          </button>
          <p className="kw-connect-meta">
            Google OAuth callback URL: <span className="kw-connect-uri">{gsc.redirectUri}</span>
          </p>
          {gsc.error && <p className="kw-connect-error">{gsc.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="keyword-cannibalization-page kw-page space-y-5">
      <div className="kw-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <Header />
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
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
        </div>
      </div>

      {showInfo && (
        <div className="app-alert app-alert-info kc-info">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="flex-1">
            <span className="kc-info-lead">About Keyword Cannibalization.</span>{" "}
            Keyword cannibalization happens when two or more pages rank for the same query, splitting impressions and confusing search intent.
          </p>
          <button onClick={() => setShowInfo(false)} className="gke-alert-close" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="keyword-cannibalization-filters gke-filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 gke-field">
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
            onClick={applyCannibalization}
            disabled={!gsc.selectedSite || gsc.isLoading}
            className="ui-button ui-button-primary gke-apply"
          >
            {gsc.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Apply
          </button>
        </div>
        {saveStatus && <p className="mt-3 text-xs font-semibold text-emerald-300">{saveStatus}</p>}
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

      <div className="keyword-cannibalization-results kw-results">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-bold text-white/70">
            Keyword Cannibalization <span className="text-white/30">({filteredRows.length})</span>
          </h3>
          <div className="kw-search">
            <Search className="h-3.5 w-3.5 text-white/25" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="kw-search-input w-40"
              placeholder="Filter keywords..."
            />
          </div>
        </div>

        <div className="keyword-cannibalization-table-header grid grid-cols-[2fr_0.5fr_0.9fr_0.8fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 border-b border-white/[0.06] bg-white/[0.01] px-5 py-2.5">
          <TH label="Keyword" onClick={() => handleSort("keyword")} />
          <TH label="Pages" onClick={() => handleSort("pageCount")} />
          <TH label="Impressions" onClick={() => handleSort("impressions")} />
          <TH label="% Change" />
          <TH label="Pos." onClick={() => handleSort("position")} />
          <TH label="Change" />
          <TH label="Clicks" onClick={() => handleSort("clicks")} />
          <TH label="% Change" />
        </div>

        {gsc.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : filteredRows.length ? (
          filteredRows.map((row, index) => (
            <div
              key={row.keyword}
              className={`keyword-cannibalization-row grid grid-cols-[2fr_0.5fr_0.9fr_0.8fr_0.7fr_0.7fr_0.7fr_0.8fr] gap-2 px-5 py-3 transition hover:bg-white/[0.02] ${
                index < filteredRows.length - 1 ? "border-b border-white/[0.03]" : ""
              }`}
            >
              <div className="min-w-0">
                <span className="kc-keyword block truncate" title={row.keyword}>{row.keyword}</span>
                <div className="mt-1 space-y-0.5">
                  {row.pages.slice(0, 4).map((page) => (
                    <a
                      key={page.url}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kc-page-link flex min-w-0 items-center gap-1 truncate"
                      title={page.url}
                    >
                      <span className="truncate">{page.display}</span>
                      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
              <span className="kc-pages">{row.pageCount}</span>
              <span className="kc-num">{formatNumber(row.impressions)}</span>
              <Pct value={row.impressionsPct} />
              <span className="kc-num">{row.position.toFixed(1)}</span>
              <span className={`kc-delta ${row.positionChange > 0 ? "is-up" : row.positionChange < 0 ? "is-down" : ""}`}>
                {row.positionChange > 0 ? "+" : ""}{row.positionChange.toFixed(1)}
              </span>
              <span className="kc-num">{formatNumber(row.clicks)}</span>
              <Pct value={row.clicksPct} />
            </div>
          ))
        ) : (
          <div className="py-16 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-white/[0.06]" />
            <p className="mt-3 text-sm text-white/25">
              {gsc.currentRows.length ? "No keyword cannibalization found." : "Connect a property and apply a date range to analyze cannibalization."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="kw-title-row">
      <span className="gke-icon">
        <Copy className="h-5 w-5" />
      </span>
      <div>
        <h1 className="kw-title font-display">Keyword Cannibalization</h1>
        <p className="kw-description">Find queries where multiple URLs compete for the same ranking opportunity.</p>
      </div>
    </div>
  );
}

/* Banner shell for the states that carry no header actions, so the
   disconnected and loading screens keep the same banner as the loaded one. */
function Hero() {
  return (
    <div className="kw-hero">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Header />
      </div>
    </div>
  );
}

function DatePill({ end, muted, start }) {
  return (
    <div className="flex items-center gap-2 gke-field">
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
      {onClick && <ChevronDown className="ml-1 inline h-3 w-3 opacity-40" />}
    </button>
  );
}

function Pct({ value }) {
  const cls = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-white/30";
  return <span className={`text-[10px] font-bold ${cls}`}>{formatPctChange(value)}</span>;
}
