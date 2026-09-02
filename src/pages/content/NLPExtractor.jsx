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
    <div className="ctool-page space-y-6">
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <Brain className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              NLP Extractor
            </h1>
            <p className="ctool-subtitle">
              Extract SEO-optimizing NLP keywords from content and rank them by relevance, type, and sentiment.
            </p>
          </div>
        </div>
      </div>

      <div className="ctool-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="ctool-card-icon h-4 w-4" />
            <span className="ctool-card-title">Enter {mode === "url" ? "URL" : "Text"}</span>
          </div>
          <div className="ctool-seg">
            <button
              onClick={() => setMode("url")}
              className={`ui-button transition ${
                mode === "url" ? "ctool-seg-btn active" : "ctool-seg-btn"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>URL</span>
            </button>
            <button
              onClick={() => setMode("text")}
              className={`ui-button transition ${
                mode === "text" ? "ctool-seg-btn active" : "ctool-seg-btn"
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              <span>Text</span>
            </button>
          </div>
        </div>

        {mode === "url" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="ctool-field flex-1">
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
              className="ui-button ui-button-primary"
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
              className="ctool-textarea"
              placeholder="Paste your content here..."
            />
            <button
              onClick={handleExtract}
              disabled={loading}
              className="ui-button ui-button-primary mt-3"
            >
              <Brain className="h-4 w-4" /> {loading ? "Extracting..." : "Extract NLP"}
            </button>
          </>
        )}
      </div>

      {results && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <Zap className="ctool-card-icon h-4 w-4" />
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
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${r.relevance}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{r.relevance}%</span>
                  </div>
                  <span className="app-badge app-badge-brand">
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
