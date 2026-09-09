import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Globe,
  Loader2,
  Search,
} from "lucide-react";
import {
  ALPHABET,
  AUTOCOMPLETE_REGIONS,
  NUMBERS,
  downloadCsv,
  fetchAutocomplete,
  fetchAutocompleteBatch,
  uniqueKeywords,
} from "../../lib/keywordTools.js";

export default function SuggestKeywords() {
  const [keyword, setKeyword] = useState("");
  const [regionCode, setRegionCode] = useState("US");
  const [results, setResults] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showLetters, setShowLetters] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const region = AUTOCOMPLETE_REGIONS.find((item) => item.gl === regionCode) || AUTOCOMPLETE_REGIONS[0];
  const allKeywords = useMemo(() => {
    if (!results) return [];
    return uniqueKeywords([
      ...results.suggestions,
      ...Object.values(results.letters).flat(),
      ...Object.values(results.numbers).flat(),
    ]);
  }, [results]);

  async function handleGenerate() {
    const seed = keyword.trim();
    if (!seed) return;

    setIsLoading(true);
    setProgress(0);
    setError("");
    setResults(null);

    try {
      const base = await fetchAutocomplete(seed, region);
      const letterTasks = ALPHABET.map((letter) => ({
        key: letter.toUpperCase(),
        query: `${seed} ${letter}`,
        region,
      }));
      const numberTasks = NUMBERS.map((number) => ({
        key: number,
        query: `${seed} ${number}`,
        region,
      }));
      const fetched = await fetchAutocompleteBatch([...letterTasks, ...numberTasks], {
        batchSize: 4,
        onProgress: setProgress,
      });

      setResults({
        suggestions: base,
        letters: Object.fromEntries(ALPHABET.map((letter) => [letter.toUpperCase(), fetched[letter.toUpperCase()] || []])),
        numbers: Object.fromEntries(NUMBERS.map((number) => [number, fetched[number] || []])),
      });
    } catch (err) {
      setError(err?.message || "Could not fetch keyword suggestions");
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }

  async function copyKeywords(key, keywords) {
    await navigator.clipboard.writeText(keywords.join("\n"));
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  }

  function exportCsv() {
    if (!allKeywords.length) return;
    downloadCsv(`${keyword.trim().replace(/\s+/g, "-") || "keyword"}-suggestions.csv`, [
      ["Keyword"],
      ...allKeywords.map((item) => [item]),
    ]);
  }

  return (
    <div className="keyword-suggest-page space-y-5">
      <div className="kw-hero">
        <div className="kw-title-row">
          <span className="edf-tile">
            <Search className="h-5 w-5" />
          </span>
          <div>
            <h1 className="kw-title font-display">Suggest Keywords</h1>
            <p className="kw-description">Generate live A-Z and 0-9 keyword variations from Google autocomplete.</p>
          </div>
        </div>
      </div>

      <div className="kw-panel">
        <div className="kw-fields kw-fields-2">
          <div>
            <label className="kw-label">Base Keyword</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleGenerate()}
              className="kw-input mt-1.5"
              placeholder="Enter your seed keyword, e.g. pakistan"
            />
          </div>
          <div>
            <label className="kw-label">Country</label>
            <div className="kw-select-shell">
              <Globe className="h-4 w-4" />
              <select
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className="kw-bare-select"
              >
                {AUTOCOMPLETE_REGIONS.map((item) => (
                  <option key={item.gl} value={item.gl}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="kw-actions">
          <div className="kw-actions-left">
            <button
              onClick={() => copyKeywords("all", allKeywords)}
              disabled={!allKeywords.length}
              className="ui-button kw-export-button"
            >
              {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy All
            </button>
            <button
              onClick={exportCsv}
              disabled={!allKeywords.length}
              className="ui-button kw-export-button"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !keyword.trim()}
            className="ui-button ui-button-primary kw-search-button"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isLoading ? `Fetching ${progress}%` : "Generate Suggestions"}
          </button>
        </div>

        {isLoading && (
          <div className="kw-progress">
            <div className="kw-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <div className="app-alert app-alert-error mt-3">{error}</div>}
      </div>

      {!results ? (
        <div className="kw-results app-empty-state kw-empty">
          <span className="kw-empty-icon">
            <Search className="h-5 w-5" />
          </span>
          <h3 className="kw-empty-title">How It Works</h3>
          <p className="kw-empty-body">
            Enter a seed keyword and PGC will fetch Google autocomplete suggestions for the base term, A-Z variations, and 0-9 variations.
          </p>
        </div>
      ) : (
        <>
          <KeywordGroup
            accent="emerald"
            copied={copied}
            isOpen={showSuggestions}
            keywords={results.suggestions}
            label={`Suggested Keywords (${results.suggestions.length})`}
            onCopy={() => copyKeywords("base", results.suggestions)}
            onToggle={() => setShowSuggestions((value) => !value)}
          />

          <VariationGrid
            accent="emerald"
            copied={copied}
            groups={results.letters}
            isOpen={showLetters}
            onCopy={copyKeywords}
            onToggle={() => setShowLetters((value) => !value)}
            title="A-Z Letter Variations"
          />

          <VariationGrid
            accent="amber"
            copied={copied}
            groups={results.numbers}
            isOpen={showNumbers}
            onCopy={copyKeywords}
            onToggle={() => setShowNumbers((value) => !value)}
            title="0-9 Number Variations"
          />
        </>
      )}
    </div>
  );
}

function KeywordGroup({ accent, copied, isOpen, keywords, label, onCopy, onToggle }) {
  const accentClass = accent === "emerald" ? "is-success" : "is-warning";
  return (
    <div className={`kw-group ${accentClass}`}>
      <div className="flex items-center justify-between p-4">
        <button onClick={onToggle} className="kw-group-toggle">
          <Search className="kw-group-icon h-4 w-4" />
          <span className="kw-group-title">{label}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onCopy} className="kw-icon-button">
            {copied === "base" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onToggle} className="kw-chevron-button" aria-label={isOpen ? "Collapse" : "Expand"}>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="kw-group-body">
          {keywords.map((item) => (
            <div key={item} className="kw-group-item">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariationGrid({ accent, copied, groups, isOpen, onCopy, onToggle, title }) {
  const headerClass = accent === "emerald" ? "is-success" : "is-warning";
  return (
    <div className="kw-variation">
      <button onClick={onToggle} className="kw-variation-toggle">
        <h3 className="kw-group-title">{title}</h3>
        {isOpen ? <ChevronUp className="kw-chevron h-4 w-4" /> : <ChevronDown className="kw-chevron h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="kw-variation-grid">
          {Object.entries(groups).map(([key, keywords]) => (
            <div key={key} className="kw-var-card">
              <div className={`kw-var-head ${headerClass}`}>
                <span className="text-xs font-bold">+{key}</span>
                <button onClick={() => onCopy(key, keywords)} className="kw-icon-button kw-icon-button-sm">
                  {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="max-h-[200px] space-y-1 overflow-y-auto px-3 py-2">
                {keywords.length ? (
                  keywords.map((item) => (
                    <div key={item} className="kw-var-item" title={item}>
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-white/20">No suggestions</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
