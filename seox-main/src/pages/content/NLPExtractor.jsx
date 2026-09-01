import { useState } from "react";
import { Brain, Globe, Type, Zap } from "lucide-react";
import { nlpData } from "../../data/contentData.js";
import { extractNlpKeywords, getSourceText } from "../../lib/contentTools.js";

export default function NLPExtractor() {
  const d = nlpData;
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleExtract() {
    setLoading(true);
    try {
      const source = await getSourceText({ mode, text, url });
      setResults(extractNlpKeywords(source));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_10%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">NLP Extractor</h1>
              <p className="text-sm text-white/60">Extract SEO-optimizing NLP keywords from content</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => setMode("url")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === "url" ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10"}`}>
              <Globe className="h-3.5 w-3.5" /> URL
            </button>
            <button onClick={() => setMode("text")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === "text" ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10"}`}>
              <Type className="h-3.5 w-3.5" /> Text
            </button>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-bold text-white/80">Enter {mode === "url" ? "URL" : "Text"}</span>
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
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 disabled:opacity-40"
            >
              <Brain className="h-4 w-4" /> {loading ? "..." : "Extract NLP"}
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
              className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 disabled:opacity-40"
            >
              <Brain className="h-4 w-4" /> {loading ? "Extracting..." : "Extract NLP"}
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          <h3 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-400" /> NLP Keywords ({results.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="grid grid-cols-[2fr_0.7fr_0.8fr_0.8fr] gap-3 bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Keyword</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Relevance</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Type</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Sentiment</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`grid grid-cols-[2fr_0.7fr_0.8fr_0.8fr] gap-3 px-4 py-3 hover:bg-white/[0.02] ${i < results.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="text-sm text-white/70">{r.keyword}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-[60px] rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${r.relevance}%` }} />
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">{r.relevance}%</span>
                </div>
                <span className="text-xs text-indigo-300/80 bg-indigo-500/10 rounded-full px-2 py-0.5 w-fit">{r.type}</span>
                <span className={`text-xs ${r.sentiment === "Positive" ? "text-emerald-400" : "text-white/40"}`}>{r.sentiment}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
