import { useState, useMemo } from "react";
import {
  Scan, Globe, Type, Plus, Sparkles, Trash2, Loader2,
  Search, Copy, Check, Filter, Layers, HelpCircle, ArrowRight,
  TrendingUp, BarChart3, Tag
} from "lucide-react";
import { entitiesExtractorData } from "../../data/contentData.js";
import { extractEntitiesFromText, getSourceText } from "../../lib/contentTools.js";

export default function EntitiesExtractor() {
  const [mode, setMode] = useState("url");
  const [urls, setUrls] = useState([""]);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [copied, setCopied] = useState(false);

  async function handleExtract() {
    setLoading(true);
    try {
      const source = await getSourceText({ mode, text, urls });
      const joined = Array.isArray(source) ? source.map((item) => item.text).join(" ") : source;
      const extracted = extractEntitiesFromText(joined);
      setResults(extracted || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults(null);
    setFilterQuery("");
    setSelectedType("all");
    if (mode === "url") {
      setUrls([""]);
    } else {
      setText("");
    }
  }

  // Filtered entity list
  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter((item) => {
      const matchesQuery = item.entity.toLowerCase().includes(filterQuery.toLowerCase());
      const matchesType = selectedType === "all" || item.type.toLowerCase() === selectedType.toLowerCase();
      return matchesQuery && matchesType;
    });
  }, [results, filterQuery, selectedType]);

  // Distinct entity types
  const entityTypes = useMemo(() => {
    if (!results || !results.length) return [];
    const set = new Set(results.map((r) => r.type));
    return Array.from(set);
  }, [results]);

  // Average Salience
  const avgSalience = useMemo(() => {
    if (!results || !results.length) return 0;
    const sum = results.reduce((acc, r) => acc + (r.salience || 0), 0);
    return Math.round((sum / results.length) * 100);
  }, [results]);

  // Copy entities as CSV
  function copyCsv() {
    if (!results || !results.length) return;
    const header = "Entity,Type,Salience,Mentions\n";
    const body = results.map((r) => `"${r.entity}","${r.type}",${r.salience},${r.mentions}`).join("\n");
    navigator.clipboard.writeText(header + body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Type badge color mapping
  function getTypeBadgeClass(type) {
    const t = (type || "").toLowerCase();
    if (t.includes("org")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (t.includes("loc") || t.includes("place")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (t.includes("per") || t.includes("author")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (t.includes("event") || t.includes("date")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (t.includes("concept") || t.includes("topic")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <div className="entities-extractor-workspace ctool-page space-y-6">
      {/* Hero Header */}
      <div className="extractor-hero ctool-hero">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="ctool-hero-row">
            <div className="ctool-hero-icon">
              <Scan className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="ctool-title font-display">
                Entities Extractor
              </h1>
              <p className="ctool-subtitle">
                Extract, classify, and calculate Google NLP Knowledge Graph salience scores from content and URLs.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="ctool-seg">
            <button
              onClick={() => setMode("url")}
              className={`ui-button transition ${
                mode === "url"
                  ? "ctool-seg-btn active"
                  : "ctool-seg-btn"
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>URL Mode</span>
            </button>
            <button
              onClick={() => setMode("text")}
              className={`ui-button transition ${
                mode === "text"
                  ? "ctool-seg-btn active"
                  : "ctool-seg-btn"
              }`}
            >
              <Type className="h-4 w-4" />
              <span>Direct Text</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Panel Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(45,43,111,0.06)]">
        {mode === "url" ? (
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Globe className="ctool-card-icon h-4 w-4" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Target URLs for Entity Extraction
                </h3>
              </div>
              <button
                onClick={() => setUrls([...urls, ""])}
                className="ui-button ctool-tool-btn btn-add-url"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Another URL</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {urls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="ctool-field flex-1">
                    <Globe className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const c = [...urls];
                        c[i] = e.target.value;
                        setUrls(c);
                      }}
                      className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      placeholder="https://example.com/blog/seo-guide"
                    />
                  </div>
                  {urls.length > 1 && (
                    <button
                      onClick={() => setUrls(urls.filter((_, idx) => idx !== i))}
                      className="btn-icon-del"
                      title="Remove URL"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Type className="ctool-card-icon h-4 w-4" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Paste Content for Semantic Extraction
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {text.trim().split(/\s+/).filter(Boolean).length} words ({text.length} chars)
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="ctool-textarea"
              placeholder="Paste article paragraphs, competitor content, or keyword briefs here..."
            />
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtract}
              disabled={loading || (mode === "url" ? !urls.some((u) => u.trim()) : !text.trim())}
              className="ui-button ui-button-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting Entities...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Extract Entities</span>
                </>
              )}
            </button>

            {results && (
              <button
                onClick={handleReset}
                className="ui-button ctool-tool-btn"
              >
                Clear Results
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400">
            Powered by Deep Semantic NER & Salience Modeling
          </div>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)] space-y-5">
          {/* Results Summary Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Extracted Entities
                </h3>
                <span className="ctool-count-badge">
                  {results.length} Total
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Sorted by NLP salience score and frequency of mention in the content.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyCsv}
                className="ui-button ctool-tool-btn"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied CSV" : "Export CSV"}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics & Filter Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Entities</span>
                <p className="text-lg font-bold text-slate-900">{results.length}</p>
              </div>
              <div className="ctool-empty-icon h-9 w-9">
                <Tag className="h-4 w-4" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Salience</span>
                <p className="text-lg font-bold text-emerald-700">{avgSalience}%</p>
              </div>
              <div className="ctool-empty-icon h-9 w-9">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entity Types</span>
                <p className="text-lg font-bold text-slate-900">{entityTypes.length}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <Layers className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter entities..."
                className="ctool-input w-full pl-9"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedType("all")}
                className={`ui-button transition ${
                  selectedType === "all"
                    ? "ctool-pill active"
                    : "ctool-pill"
                }`}
              >
                All ({results.length})
              </button>
              {entityTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`ui-button transition ${
                    selectedType === type
                      ? "ctool-pill active"
                      : "ctool-pill"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Entities Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="grid grid-cols-[2.5fr_1.2fr_1.5fr_1fr] gap-3 bg-slate-50 px-4 py-3 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>Entity Name</span>
              <span>Classification</span>
              <span>Salience Score</span>
              <span className="text-right">Mentions</span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No entities matched your current filter criteria.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredResults.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2.5fr_1.2fr_1.5fr_1fr] items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition"
                  >
                    {/* Entity Name */}
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {r.entity}
                    </div>

                    {/* Classification Type */}
                    <div>
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTypeBadgeClass(r.type)}`}>
                        {r.type || "Concept"}
                      </span>
                    </div>

                    {/* Salience Bar & Value */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.round((r.salience || 0) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700 w-10 text-right">
                        {(r.salience || 0).toFixed(2)}
                      </span>
                    </div>

                    {/* Mentions */}
                    <div className="text-right font-mono text-xs font-bold text-slate-800">
                      {r.mentions} <span className="text-[10px] font-normal text-slate-400">times</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Educational Knowledge Card */}
      {!results && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="flex items-center gap-2.5 mb-3">
            <HelpCircle className="ctool-card-icon h-4 w-4" />
            <h3 className="font-display text-sm font-bold text-slate-900">
              Why Entity Optimization Matters in Modern SEO
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <h4 className="text-xs font-bold text-college-blue mb-1.5">Google Knowledge Graph</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Search engines index entities (people, places, concepts, organizations) rather than just raw keywords to evaluate topical authority.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <h4 className="text-xs font-bold text-college-blue mb-1.5">Salience Score</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Salience determines the centrality of an entity to the overall document. Higher salience indicates the primary subject matter.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <h4 className="text-xs font-bold text-college-blue mb-1.5">Competitor Gap Analysis</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Extract competitor URLs to discover semantic entities they cover that your content may be missing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

