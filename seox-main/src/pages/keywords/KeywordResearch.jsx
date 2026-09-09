import { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Copy,
  DollarSign,
  Download,
  Globe,
  Loader2,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  DATAFORSEO_LOCATIONS,
  downloadCsv,
  formatNumber,
} from "../../lib/keywordTools.js";

export default function KeywordResearch() {
  const [mode, setMode] = useState("seed");
  const [query, setQuery] = useState("");
  const [countryCode, setCountryCode] = useState("2840");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState("search_volume");
  const [sortDirection, setSortDirection] = useState("desc");
  const [copied, setCopied] = useState(false);
  const [apiCost, setApiCost] = useState(0);

  const location =
    DATAFORSEO_LOCATIONS.find((item) => String(item.code) === countryCode) ||
    DATAFORSEO_LOCATIONS[0];
  const sortedResults = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...results].sort((a, b) => {
      if (sortField === "keyword") {
        return String(a.keyword || "").localeCompare(String(b.keyword || "")) * direction;
      }
      return (Number(a[sortField] || 0) - Number(b[sortField] || 0)) * direction;
    });
  }, [results, sortDirection, sortField]);
  const maxVolume = Math.max(...results.map((item) => Number(item.search_volume || 0)), 0);
  const maxCpc = Math.max(...results.map((item) => Number(item.cpc || 0)), 0);

  async function handleSearch() {
    const term = query.trim();
    if (!term) return;

    setIsLoading(true);
    setError("");
    setSearched(true);
    setResults([]);

    try {
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "dataforseo",
          action: mode === "domain" ? "keywords_for_site" : "keyword_suggestions",
          keyword: mode === "seed" ? term : undefined,
          domain: mode === "domain" ? term : undefined,
          location_code: location.code,
          language_code: location.language,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.message || data.status_message || data.error || "Keyword research failed");
      }

      setResults(data.results || []);
      setApiCost(Number(data.cost || 0));
    } catch (err) {
      setError(err?.message || "Keyword research failed");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "keyword" ? "asc" : "desc");
    }
  }

  async function copyKeywords() {
    await navigator.clipboard.writeText(sortedResults.map((item) => item.keyword).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function exportCsv() {
    if (!sortedResults.length) return;
    downloadCsv(`${query.trim().replace(/\s+/g, "-") || "keywords"}-research.csv`, [
      ["Keyword", "Volume", "CPC", "Competition", "Competition Index", "Low Bid", "High Bid"],
      ...sortedResults.map((item) => [
        item.keyword,
        item.search_volume || 0,
        item.cpc || 0,
        item.competition || "",
        item.competition_index || "",
        item.low_top_of_page_bid || "",
        item.high_top_of_page_bid || "",
      ]),
    ]);
  }

  return (
    <div className="keyword-research-page space-y-5">
      <div className="kw-hero">
        <div className="kw-title-row">
          <span className="edf-tile">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="kw-title font-display">Keyword Research Tool</h1>
            <p className="kw-description">Discover high-value keywords with DataForSEO Google Ads data.</p>
          </div>
        </div>
        {results.length > 0 && (
          <div className="kw-stats">
            <Stat icon={Search} label="Keywords Found" value={results.length} />
            <Stat icon={TrendingUp} label="Highest Volume" value={formatNumber(maxVolume)} />
            <Stat icon={DollarSign} label="Max CPC" value={`$${maxCpc.toFixed(2)}`} />
            <Stat icon={BarChart3} label="API Cost" value={`$${apiCost.toFixed(4)}`} />
          </div>
        )}
      </div>

      <div className="kw-panel">
        <div className="admin-tabs kw-modes">
          <button
            onClick={() => setMode("seed")}
            className={`admin-tab ${mode === "seed" ? "active" : ""}`}
          >
            <Search className="h-4 w-4" /> Seed Keyword
          </button>
          <button
            onClick={() => setMode("domain")}
            className={`admin-tab ${mode === "domain" ? "active" : ""}`}
          >
            <Globe className="h-4 w-4" /> Domain
          </button>
        </div>

        <div className="kw-fields">
          <div>
            <label className="kw-label">Country</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="kw-input mt-1.5"
            >
              {DATAFORSEO_LOCATIONS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="kw-label">Language</label>
            <div className="kw-static-field">
              {location.language.toUpperCase()} <span className="ml-1 text-[10px] text-white/20">Auto</span>
            </div>
          </div>
          <div>
            <label className="kw-label">
              {mode === "seed" ? "Seed Keyword" : "Domain"}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSearch()}
                className="kw-input flex-1"
                placeholder={mode === "seed" ? "e.g. SEO tools" : "e.g. competitor.com"}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="ui-button ui-button-primary kw-search-button"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isLoading ? "Searching" : "Search"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="app-alert app-alert-error mt-4">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="kw-results">
        {!searched ? (
          <div className="app-empty-state kw-empty">
            <span className="kw-empty-icon">
              <Search className="h-5 w-5" />
            </span>
            <h3 className="kw-empty-title">Start Your Keyword Research</h3>
            <p className="kw-empty-body">
              Enter a seed keyword or domain to fetch keyword data, CPC, competition, and search volume.
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white/80">
                Keywords <span className="text-white/30">({sortedResults.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyKeywords}
                  disabled={!sortedResults.length}
                  className="ui-button kw-export-button"
                >
                  <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy Keywords"}
                </button>
                <button
                  onClick={exportCsv}
                  disabled={!sortedResults.length}
                  className="ui-button kw-export-button"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <div className="grid grid-cols-[2fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <TH label="Keyword" onClick={() => handleSort("keyword")} />
                <TH label="Volume" onClick={() => handleSort("search_volume")} />
                <TH label="CPC" onClick={() => handleSort("cpc")} />
                <TH label="Competition" onClick={() => handleSort("competition_index")} />
                <TH label="Trend" />
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="kw-spinner h-6 w-6 animate-spin" />
                </div>
              ) : sortedResults.length ? (
                sortedResults.map((item, index) => (
                  <div
                    key={`${item.keyword}-${index}`}
                    className={`grid grid-cols-[2fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-3 px-4 py-3 transition hover:bg-white/[0.02] ${
                      index < sortedResults.length - 1 ? "border-b border-white/[0.03]" : ""
                    }`}
                  >
                    <span className="kw-keyword">{item.keyword}</span>
                    <span className="font-mono text-sm text-white/60">{formatNumber(item.search_volume || 0)}</span>
                    <span className="font-mono text-sm text-emerald-400">${Number(item.cpc || 0).toFixed(2)}</span>
                    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${competitionClass(item.competition)}`}>
                      {item.competition || "N/A"}
                    </span>
                    <MiniSparkline data={item.monthly_searches} />
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-sm text-white/25">No keyword data returned for this search.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="kw-stat">
      <div className="kw-stat-head">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="kw-stat-value">{value}</div>
    </div>
  );
}

function TH({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left text-[10px] font-bold uppercase tracking-wider text-white/30 hover:text-white/50 disabled:hover:text-white/30"
      disabled={!onClick}
    >
      {label}
    </button>
  );
}

function competitionClass(value) {
  const competition = String(value || "").toLowerCase();
  if (competition === "high") return "bg-rose-500/15 text-rose-300";
  if (competition === "medium") return "bg-amber-500/15 text-amber-300";
  if (competition === "low") return "bg-emerald-500/15 text-emerald-300";
  return "bg-white/[0.05] text-white/35";
}

function MiniSparkline({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <span className="text-sm text-white/20">-</span>;
  }

  const values = data.slice(-12).map((item) => Number(item.search_volume || 0));
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-5 w-16 items-end gap-0.5">
      {values.map((value, index) => (
        <span
          key={index}
          className="kw-bar flex-1 rounded-sm"
          style={{ height: `${Math.max(10, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
