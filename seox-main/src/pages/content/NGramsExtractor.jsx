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
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-pink-500 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Hash className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-black text-white">N-Grams Extractor</h1>
                <p className="text-sm text-white/60">Extract, analyze, and optimize n-grams for semantic SEO</p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition">
              <Layers className="h-3.5 w-3.5" /> Compare Articles
            </button>
          </div>
          {/* Mode tabs */}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => setMode("url")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === "url" ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10"}`}>
              <Globe className="h-3.5 w-3.5" /> URL Mode
            </button>
            <button onClick={() => setMode("text")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === "text" ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10"}`}>
              <Type className="h-3.5 w-3.5" /> Text Mode
            </button>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-bold text-white/80">Source Content</span>
        </div>
        {mode === "url" ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
              <Globe className="h-4 w-4 text-white/20" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
                placeholder="https://example.com/article"
              />
            </div>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-40"
            >
              <Hash className="h-4 w-4" /> {loading ? "..." : "Extract"}
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/60 placeholder:text-white/15 focus:outline-none resize-none"
              placeholder="Paste your content here..."
            />
            <button
              onClick={handleExtract}
              disabled={loading}
              className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-40"
            >
              <Hash className="h-4 w-4" /> {loading ? "Extracting..." : "Extract"}
            </button>
          </>
        )}
      </div>

      {/* Generate Unique N-Grams CTA */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-sm font-bold text-white/70">Generate Unique N-Grams</p>
            <p className="text-xs text-white/35">Generate original, niche n-grams to make your content stand out and rank for specific queries</p>
          </div>
        </div>
        <button onClick={handleGenerateUnique} disabled={uniqueLoading || !(text.trim() || url.trim() || results)} className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/15 transition disabled:opacity-40">
          <Sparkles className="h-3.5 w-3.5" /> {uniqueLoading ? "Generating..." : "Generate Unique"}
        </button>
      </div>
      {(uniqueResults.length > 0 || uniqueError) && (
        <div className="rounded-2xl border border-amber-500/20 bg-[#0d1117] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white/80">
            <Sparkles className="h-4 w-4 text-amber-400" /> DeepSeek Unique N-Grams
          </h3>
          {uniqueError && (
            <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
              {uniqueError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {uniqueResults.map((item) => (
              <span key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]">
          <div className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-sm font-semibold transition ${activeTab === tab.key ? "text-indigo-400" : "text-white/30 hover:text-white/50"}`}
              >
                {tab.label} <span className="text-[10px] text-white/20">({results[tab.key].length})</span>
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <div className="grid grid-cols-[2fr_0.6fr_0.6fr] gap-3 bg-white/[0.02] px-4 py-2 border-b border-white/[0.06]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">N-Gram</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Count</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Density</span>
              </div>
              {results[activeTab].map((item, i) => (
                <div key={i} className={`grid grid-cols-[2fr_0.6fr_0.6fr] gap-3 px-4 py-2.5 hover:bg-white/[0.02] ${i < results[activeTab].length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                  <span className="text-sm text-blue-300 font-mono">{item.ngram}</span>
                  <span className="text-sm text-white/50 font-mono">{item.count}</span>
                  <span className="text-sm text-white/40">{item.density}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
