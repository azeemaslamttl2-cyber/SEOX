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
      <div className="dashboard-welcome keyword-suggest-welcome relative overflow-hidden rounded-2xl border border-brand-600 bg-brand-500 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float-slow rounded-full bg-college-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 animate-float rounded-full bg-college-yellow/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="keyword-suggest-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <Search className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Suggest Keywords</h1>
            <p className="mt-1 text-sm text-white">Generate live A-Z and 0-9 keyword variations from Google autocomplete.</p>
          </div>
        </div>
      </div>

      <div className="keyword-suggest-panel rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Base Keyword</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleGenerate()}
              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/70 placeholder:text-white/20 focus:border-violet-500/30 focus:outline-none"
              placeholder="Enter your seed keyword, e.g. pakistan"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Country</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
              <Globe className="h-4 w-4 text-blue-400" />
              <select
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className="w-full bg-transparent text-sm text-white/60 focus:outline-none"
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

        <div className="keyword-suggest-actions mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !keyword.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isLoading ? `Fetching ${progress}%` : "Generate Suggestions"}
          </button>
          <button
            onClick={() => copyKeywords("all", allKeywords)}
            disabled={!allKeywords.length}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white/75 disabled:opacity-40"
          >
            {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy All
          </button>
          <button
            onClick={exportCsv}
            disabled={!allKeywords.length}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/50 hover:text-white/75 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>

        {isLoading && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="mt-3 text-xs font-semibold text-rose-300">{error}</p>}
      </div>

      {!results ? (
        <div className="keyword-suggest-empty flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0d1117] p-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10">
            <Search className="h-6 w-6 text-violet-400/50" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/25">How It Works</h3>
          <p className="mt-1 max-w-md text-center text-sm text-white/15">
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
  const accentClass = accent === "emerald" ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]";
  return (
    <div className={`keyword-suggest-group rounded-2xl border ${accentClass}`}>
      <div className="flex items-center justify-between p-4">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          <Search className={`h-4 w-4 ${accent === "emerald" ? "text-emerald-400" : "text-amber-400"}`} />
          <span className="text-sm font-bold text-white/80">{label}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onCopy} className="rounded-md bg-white/[0.04] p-1.5 text-white/30 hover:text-white/50">
            {copied === "base" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onToggle}>
            {isOpen ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="space-y-1 border-t border-white/[0.05] px-5 pb-4 pt-2">
          {keywords.map((item) => (
            <div key={item} className="py-0.5 text-sm text-white/60">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariationGrid({ accent, copied, groups, isOpen, onCopy, onToggle, title }) {
  const headerClass = accent === "emerald" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300";
  return (
    <div className="keyword-suggest-variation rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
      <button onClick={onToggle} className="mb-4 flex w-full items-center justify-between text-left">
        <h3 className="text-sm font-bold text-white/80">{title}</h3>
        {isOpen ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
      </button>
      {isOpen && (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Object.entries(groups).map(([key, keywords]) => (
            <div key={key} className="keyword-suggest-card overflow-hidden rounded-xl border border-white/[0.06] bg-[#010409]">
              <div className={`flex items-center justify-between border-b border-white/[0.06] px-3 py-2 ${headerClass}`}>
                <span className="text-xs font-bold">+{key}</span>
                <button onClick={() => onCopy(key, keywords)} className="text-white/35 hover:text-white/60">
                  {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="max-h-[200px] space-y-1 overflow-y-auto px-3 py-2">
                {keywords.length ? (
                  keywords.map((item) => (
                    <div key={item} className="truncate text-[11px] text-blue-300/70 hover:text-blue-300" title={item}>
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
