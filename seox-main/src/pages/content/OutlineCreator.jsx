import { useState } from "react";
import { FileText, Globe, Plus, Layers, Trash2, ChevronRight } from "lucide-react";
import { extractOutlineFromUrls } from "../../lib/contentTools.js";
import { improveOutlineWithDeepSeek } from "../../lib/deepseekContent.js";

export default function OutlineCreator() {
  const [urls, setUrls] = useState([""]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addUrl() {
    setUrls([...urls, ""]);
  }

  function updateUrl(i, val) {
    const copy = [...urls];
    copy[i] = val;
    setUrls(copy);
  }

  function removeUrl(i) {
    setUrls(urls.filter((_, idx) => idx !== i));
  }

  async function handleExtract() {
    if (!urls.some((u) => u.trim())) return;
    setLoading(true);
      setError("");
    try {
      const cleanUrls = urls.map((item) => item.trim()).filter(Boolean);
      const outline = await extractOutlineFromUrls(cleanUrls);
      if (!outline.length) {
        setResults([]);
        setError("No headings were found on the supplied URL(s).");
        return;
      }
      try {
        setResults(await improveOutlineWithDeepSeek({ urls: cleanUrls, outline }));
      } catch (err) {
        setResults(outline);
        setError(err.message || "DeepSeek could not improve the outline. Showing extracted headings.");
      }
    } catch (err) {
      setResults([]);
      setError(err.message || "Could not extract outlines from those URLs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-white">Outline Creator</h1>
            <p className="text-sm text-white/60">Extract and combine article outlines from multiple sources</p>
          </div>
        </div>
      </div>

      {/* Source URLs */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-bold text-white/80">Source URLs</span>
          </div>
          <button
            onClick={addUrl}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/50 hover:text-white/70 transition"
          >
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
                  onChange={(e) => updateUrl(i, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
                  placeholder="https://example.com/article"
                />
              </div>
              {urls.length > 1 && (
                <button onClick={() => removeUrl(i)} className="rounded-lg p-2 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleExtract}
          disabled={loading || !urls.some((u) => u.trim())}
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Layers className="h-4 w-4" /> {loading ? "Extracting..." : "Extract + AI Combine"}
        </button>
        {error && (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
            {error}
          </p>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
          <h3 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" /> Extracted Outline
          </h3>
          <div className="space-y-1.5">
            {results.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/[0.02] ${
                  item.tag === "h1" ? "pl-3" : item.tag === "h2" ? "pl-6" : "pl-10"
                }`}
              >
                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  item.tag === "h1" ? "bg-violet-500/20 text-violet-300" :
                  item.tag === "h2" ? "bg-blue-500/20 text-blue-300" :
                  "bg-emerald-500/20 text-emerald-300"
                }`}>{item.tag}</span>
                <ChevronRight className="h-3 w-3 text-white/10" />
                <span className={`text-sm ${item.tag === "h1" ? "text-white/90 font-bold" : "text-white/60"}`}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
