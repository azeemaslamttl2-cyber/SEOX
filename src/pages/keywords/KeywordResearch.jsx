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
      <div className="dashboard-welcome keyword-research-welcome relative overflow-hidden rounded-2xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float-slow rounded-full bg-college-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 animate-float rounded-full bg-college-yellow/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="keyword-research-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Keyword Research Tool</h1>
            <p className="mt-1 text-sm text-white">Discover high-value keywords with DataForSEO Google Ads data.</p>
          </div>
        </div>
        {results.length > 0 && (
          <div className="keyword-research-stats relative z-10 mt-6 grid gap-3 md:grid-cols-4">
            <Stat icon={Search} label="Keywords Found" value={results.length} />
            <Stat icon={TrendingUp} label="Highest Volume" value={formatNumber(maxVolume)} />
            <Stat icon={DollarSign} label="Max CPC" value={`$${maxCpc.toFixed(2)}`} />
            <Stat icon={BarChart3} label="API Cost" value={`$${apiCost.toFixed(4)}`} />
          </div>
        )}
      </div>

      <div className="keyword-research-panel rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="mb-6 flex items-center gap-1">
          <button
            onClick={() => setMode("seed")}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition ${
              mode === "seed"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/[0.04] text-white/40 hover:bg-white/[0.06]"
            }`}
          >
            <Search className="h-4 w-4" /> Seed Keyword
          </button>
          <button
            onClick={() => setMode("domain")}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition ${
              mode === "domain"
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-white/[0.04] text-white/40 hover:bg-white/[0.06]"
            }`}
          >
            <Globe className="h-4 w-4" /> Domain
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Country</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/70 focus:border-blue-500/30 focus:outline-none"
            >
              {DATAFORSEO_LOCATIONS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.country}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Language</label>
            <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/50">
              {location.language.toUpperCase()} <span className="ml-1 text-[10px] text-white/20">Auto</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {mode === "seed" ? "Seed Keyword" : "Domain"}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSearch()}
                className="flex-1 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/70 placeholder:text-white/20 focus:border-blue-500/30 focus:outline-none"
                placeholder={mode === "seed" ? "e.g. SEO tools" : "e.g. competitor.com"}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isLoading ? "Searching" : "Search"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="keyword-research-results min-h-[300px] rounded-2xl border border-white/[0.08] bg-[#0d1117]">
        {!searched ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Search className="h-7 w-7 text-blue-400/50" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white/30">Start Your Keyword Research</h3>
            <p className="mt-1 max-w-xs text-center text-sm text-white/15">
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
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy Keywords"}
                </button>
                <button
                  onClick={exportCsv}
                  disabled={!sortedResults.length}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40"
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
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                </div>
              ) : sortedResults.length ? (
                sortedResults.map((item, index) => (
                  <div
                    key={`${item.keyword}-${index}`}
                    className={`grid grid-cols-[2fr_0.8fr_0.8fr_0.9fr_0.7fr] gap-3 px-4 py-3 transition hover:bg-white/[0.02] ${
                      index < sortedResults.length - 1 ? "border-b border-white/[0.03]" : ""
                    }`}
                  >
                    <span className="cursor-pointer truncate text-sm text-blue-300 hover:underline">{item.keyword}</span>
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
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-white/60" />
      <div className="mt-2 font-display text-2xl font-black text-white">{value}</div>
      <div className="text-xs text-blue-100/70">{label}</div>
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
          className="flex-1 rounded-sm bg-blue-400/70"
          style={{ height: `${Math.max(10, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
