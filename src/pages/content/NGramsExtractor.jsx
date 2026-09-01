import { useState } from "react";
import { Hash, Globe, Type, Layers, Sparkles } from "lucide-react";
import { ngramsData } from "../../data/contentData.js";
import { extractNgramsFromText, generateUniqueNgrams, getSourceText } from "../../lib/contentTools.js";
import { generateUniqueNgramsDeepSeek } from "../../lib/deepseekContent.js";

export default function NGramsExtractor() {
  const d = ngramsData;
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("unigrams");
  const [uniqueResults, setUniqueResults] = useState([]);
  const [uniqueLoading, setUniqueLoading] = useState(false);
  const [uniqueError, setUniqueError] = useState("");

  async function handleExtract() {
    setLoading(true);
    try {
      const source = await getSourceText({ mode, text, url });
      setResults(extractNgramsFromText(source));
    } catch {
      setResults({ unigrams: [], bigrams: [], trigrams: [] });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateUnique() {
    const extractedSeed = results
      ? ["unigrams", "bigrams", "trigrams"].flatMap((key) => results[key].slice(0, 8).map((item) => item.ngram)).join(", ")
      : "";
    const seed = text.trim() || url.trim() || extractedSeed;
    if (!seed.trim()) return;

    setUniqueLoading(true);
    setUniqueError("");
    try {
      setUniqueResults(await generateUniqueNgramsDeepSeek(seed));
    } catch (err) {
      setUniqueResults(generateUniqueNgrams(seed));
      setUniqueError(err.message || "DeepSeek could not generate unique n-grams. Showing local fallback results.");
    } finally {
      setUniqueLoading(false);
    }
  }

  const tabs = [
    { key: "unigrams", label: "1-gram" },
    { key: "bigrams", label: "2-gram" },
    { key: "trigrams", label: "3-gram" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d9cac7] bg-[#E13A27] p-5 shadow-[0_12px_28px_-18px_rgba(225,58,39,0.9)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_30%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Hash className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              N-Grams Extractor
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Extract, analyze, and optimize n-grams for semantic SEO and content relevance.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#E13A27]" />
            <span className="text-sm font-bold text-white/80">Source Content</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setMode("url")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "url" ? "bg-[#E13A27] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Globe className="h-3.5 w-3.5" /> URL Mode
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "text" ? "bg-[#E13A27] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Type className="h-3.5 w-3.5" /> Text Mode
            </button>
          </div>
        </div>

        {mode === "url" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
              <Globe className="h-4 w-4 text-white/25" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 focus:outline-none"
                placeholder="https://example.com/article"
              />
            </div>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E13A27] to-[#d93524] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(225,58,39,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Hash className="h-4 w-4" /> {loading ? "..." : "Extract"}
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/80 placeholder:text-white/25 focus:border-[#E13A27] focus:outline-none focus:ring-2 focus:ring-[#E13A27]/15"
              placeholder="Paste your content here..."
            />
            <button
              onClick={handleExtract}
              disabled={loading}
              className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#E13A27] to-[#d93524] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(225,58,39,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Hash className="h-4 w-4" /> {loading ? "Extracting..." : "Extract"}
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-[#E13A27]/20 bg-[#fff3f1] px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[#E13A27]" />
            <div>
              <p className="text-sm font-bold text-slate-800">Generate Unique N-Grams</p>
              <p className="text-xs text-slate-600">Generate original, niche n-grams to make your content stand out and rank for specific queries.</p>
            </div>
          </div>
          <button
            onClick={handleGenerateUnique}
            disabled={uniqueLoading || !(text.trim() || url.trim() || results)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E13A27]/30 bg-[#E13A27]/10 px-4 py-2 text-xs font-bold text-[#B33221] transition hover:bg-[#E13A27]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" /> {uniqueLoading ? "Generating..." : "Generate Unique"}
          </button>
        </div>
      </div>

      {(uniqueResults.length > 0 || uniqueError) && (
        <div className="rounded-2xl border border-[#E13A27]/20 bg-[#fffaf8] p-5 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Sparkles className="h-4 w-4 text-[#E13A27]" /> DeepSeek Unique N-Grams
          </h3>
          {uniqueError && (
            <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              {uniqueError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {uniqueResults.map((item) => (
              <span key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-sm font-semibold transition ${
                  activeTab === tab.key ? "text-[#E13A27]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label} <span className="text-[10px] text-slate-400">({results[tab.key].length})</span>
              </button>
            ))}
          </div>

          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[2fr_0.8fr_0.8fr] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>N-Gram</span>
                <span>Count</span>
                <span>Density</span>
              </div>

              {results[activeTab].map((item, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[2fr_0.8fr_0.8fr] gap-3 px-4 py-2.5 text-sm ${
                    i < results[activeTab].length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <span className="font-mono text-slate-700">{item.ngram}</span>
                  <span className="font-mono text-slate-600">{item.count}</span>
                  <span className="text-slate-600">{item.density}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
