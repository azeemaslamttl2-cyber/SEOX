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
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d9cac7] bg-[#E13A27] p-5 shadow-[0_12px_28px_-18px_rgba(225,58,39,0.9)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_30%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Brain className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              NLP Extractor
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Extract SEO-optimizing NLP keywords from content and rank them by relevance, type, and sentiment.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#E13A27]" />
            <span className="text-sm font-bold text-white/80">Enter {mode === "url" ? "URL" : "Text"}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setMode("url")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "url" ? "bg-[#E13A27]" : "text-white/60 hover:text-white"
              }`}
              style={mode === "url" ? { color: "#fff" } : undefined}
            >
              <Globe className={`h-3.5 w-3.5 ${mode === "url" ? "text-white" : "text-white/60"}`} />
              <span style={{ color: mode === "url" ? "#fff" : "rgba(255,255,255,0.6)" }}>URL</span>
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === "text" ? "bg-[#E13A27]" : "text-white/60 hover:text-white"
              }`}
              style={mode === "text" ? { color: "#fff" } : undefined}
            >
              <Type className={`h-3.5 w-3.5 ${mode === "text" ? "text-white" : "text-white/60"}`} />
              <span style={{ color: mode === "text" ? "#fff" : "rgba(255,255,255,0.6)" }}>Text</span>
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
              <Brain className="h-4 w-4" /> {loading ? "..." : "Extract NLP"}
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
              <Brain className="h-4 w-4" /> {loading ? "Extracting..." : "Extract NLP"}
            </button>
          </>
        )}
      </div>

      {results && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <Zap className="h-4 w-4 text-[#E13A27]" />
            <h3 className="text-sm font-bold text-slate-800">NLP Keywords ({results.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid grid-cols-[2fr_0.9fr_0.8fr_0.8fr] gap-3 bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Keyword</span>
                <span>Relevance</span>
                <span>Type</span>
                <span>Sentiment</span>
              </div>

              {results.map((r, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[2fr_0.9fr_0.8fr_0.8fr] gap-3 px-4 py-3 text-sm ${
                    i < results.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <span className="text-slate-700">{r.keyword}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-full max-w-[65px] rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#E13A27]" style={{ width: `${r.relevance}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{r.relevance}%</span>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-[#E13A27]/10 px-2 py-0.5 text-[10px] font-semibold text-[#B33221]">
                    {r.type}
                  </span>
                  <span className={`text-xs font-semibold ${r.sentiment === "Positive" ? "text-emerald-600" : "text-slate-500"}`}>
                    {r.sentiment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
