import { useState } from "react";
import { Scan, Globe, Type, Plus, Sparkles, Trash2 } from "lucide-react";
import { entitiesExtractorData } from "../../data/contentData.js";
import { extractEntitiesFromText, getSourceText } from "../../lib/contentTools.js";

export default function EntitiesExtractor() {
  const d = entitiesExtractorData;
  const [mode, setMode] = useState("url");
  const [urls, setUrls] = useState([""]);
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleExtract() {
    setLoading(true);
    try {
      const source = await getSourceText({ mode, text, urls });
      const joined = Array.isArray(source) ? source.map((item) => item.text).join(" ") : source;
      setResults(extractEntitiesFromText(joined));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Scan className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Entities Extractor</h1>
              <p className="text-sm text-white/60">Extract and analyze semantic entities from content</p>
            </div>
          </div>
          {/* Mode tabs */}
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
        {mode === "url" ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-fuchsia-400" />
                <span className="text-sm font-bold text-white/80">Competitor URLs</span>
              </div>
              <button onClick={() => setUrls([...urls, ""])} className="flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white/60">
                <Plus className="h-3 w-3" /> Add URL
              </button>
            </div>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
                    <Globe className="h-4 w-4 text-white/20" />
                    <input
                      value={url}
                      onChange={(e) => { const c = [...urls]; c[i] = e.target.value; setUrls(c); }}
                      className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
                      placeholder="https://competitor.com/article"
                    />
                  </div>
                  {urls.length > 1 && (
                    <button onClick={() => setUrls(urls.filter((_, idx) => idx !== i))} className="p-2 text-white/20 hover:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Type className="h-4 w-4 text-fuchsia-400" />
              <span className="text-sm font-bold text-white/80">Paste Content</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/60 placeholder:text-white/15 focus:outline-none focus:border-fuchsia-500/25 resize-none"
              placeholder="Paste your content here to extract entities..."
            />
          </>
        )}
        <button
          onClick={handleExtract}
          disabled={loading}
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 transition disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" /> {loading ? "Extracting..." : "Extract"}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          <h3 className="text-sm font-bold text-white/80 mb-4">Extracted Entities ({results.length})</h3>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="grid grid-cols-[2fr_1fr_0.8fr_0.8fr] gap-3 bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Entity</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Type</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Salience</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Mentions</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`grid grid-cols-[2fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-3 hover:bg-white/[0.02] ${i < results.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="text-sm text-white/70 font-medium">{r.entity}</span>
                <span className="text-xs text-fuchsia-300/80 bg-fuchsia-500/10 rounded-full px-2 py-0.5 w-fit">{r.type}</span>
                <span className="text-sm text-white/50 font-mono">{r.salience.toFixed(2)}</span>
                <span className="text-sm text-white/50 font-mono">{r.mentions}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
