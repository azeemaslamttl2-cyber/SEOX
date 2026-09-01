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
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-3 text-sm text-white/35">Checking Search Console connection...</p>
        </div>
      </div>
    );
  }

  if (!gsc.isSignedIn) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-8 text-center">
          <Globe className="mx-auto h-12 w-12 text-white/20" />
          <h2 className="mt-4 text-lg font-bold text-white/80">Connect Google Search Console</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/35">
            PGC needs query and page data to detect when multiple URLs compete for the same keyword.
          </p>
          <button
            onClick={gsc.handleSignIn}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg"
          >
            <LogIn className="h-4 w-4" />
            Connect Search Console
          </button>
          <p className="mx-auto mt-4 max-w-lg text-[11px] text-white/20">
            Google OAuth callback URL: <span className="font-mono text-white/35">{gsc.redirectUri}</span>
          </p>
          {gsc.error && <p className="mt-4 text-xs font-semibold text-rose-300">{gsc.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="keyword-cannibalization-page space-y-5">
      <div className="keyword-cannibalization-header flex items-center justify-between gap-3">
        <Header />
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
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="keyword-cannibalization-info flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0d1117] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30" />
          <p className="flex-1 text-xs text-white/50">
            <span className="font-semibold text-white/70">About Keyword Cannibalization.</span>{" "}
            Keyword cannibalization happens when two or more pages rank for the same query, splitting impressions and confusing search intent.
          </p>
          <button onClick={() => setShowInfo(false)} className="text-white/20 hover:text-white/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="keyword-cannibalization-filters rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4">
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
            onClick={applyCannibalization}
            disabled={!gsc.selectedSite || gsc.isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {gsc.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Apply
          </button>
        </div>
        {saveStatus && <p className="mt-3 text-xs font-semibold text-emerald-300">{saveStatus}</p>}
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

      <div className="keyword-cannibalization-results rounded-2xl border border-white/[0.08] bg-[#0d1117]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <h3 className="text-sm font-bold text-white/70">
            Keyword Cannibalization <span className="text-white/30">({filteredRows.length})</span>
          </h3>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#010409] px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/25" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-40 bg-transparent text-xs text-white/60 placeholder:text-white/20 focus:outline-none"
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
                <span className="block truncate text-sm text-blue-300" title={row.keyword}>{row.keyword}</span>
                <div className="mt-1 space-y-0.5">
                  {row.pages.slice(0, 4).map((page) => (
                    <a
                      key={page.url}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1 truncate text-[10px] text-white/35 hover:text-blue-300"
                      title={page.url}
                    >
                      <span className="truncate">{page.display}</span>
                      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
              <span className="w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">{row.pageCount}</span>
              <span className="font-mono text-xs text-white/60">{formatNumber(row.impressions)}</span>
              <Pct value={row.impressionsPct} />
              <span className="font-mono text-xs text-white/60">{row.position.toFixed(1)}</span>
              <span className={`text-[10px] font-bold ${row.positionChange > 0 ? "text-emerald-400" : row.positionChange < 0 ? "text-rose-400" : "text-white/30"}`}>
                {row.positionChange > 0 ? "+" : ""}{row.positionChange.toFixed(1)}
              </span>
              <span className="font-mono text-xs text-white/60">{formatNumber(row.clicks)}</span>
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
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15">
        <Copy className="h-5 w-5 text-rose-400" />
      </div>
      <div>
        <h1 className="font-display text-xl font-black text-white">Keyword Cannibalization</h1>
        <p className="text-xs text-white/35">Find queries where multiple URLs compete for the same ranking opportunity.</p>
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
      {onClick && <ChevronDown className="ml-1 inline h-3 w-3 opacity-40" />}
    </button>
  );
}

function Pct({ value }) {
  const cls = value > 0 ? "text-emerald-400" : value < 0 ? "text-rose-400" : "text-white/30";
  return <span className={`text-[10px] font-bold ${cls}`}>{formatPctChange(value)}</span>;
}
