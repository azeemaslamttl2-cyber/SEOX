import { useState } from "react";
import { Sparkles, Upload, Trash2 } from "lucide-react";
import { entitiesGeneratorData } from "../../data/contentData.js";
import { generateEntitiesForKeywords } from "../../lib/contentTools.js";
import { generateEntityGroupsDeepSeek } from "../../lib/deepseekContent.js";

export default function EntitiesGenerator() {
  const d = entitiesGeneratorData;
  const [keywords, setKeywords] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!keywords.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(await generateEntityGroupsDeepSeek(keywords));
    } catch (err) {
      setResults(generateEntitiesForKeywords(keywords));
      setError(err.message || "DeepSeek could not generate entities. Showing local fallback results.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-orange-400 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-white">Entities Generator</h1>
            <p className="text-sm text-white/60">Generate SEO entities for your keywords using AI</p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-bold text-white/80">Keywords</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white/60">
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button onClick={() => setKeywords("")} className="flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white/60">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/60 placeholder:text-white/15 focus:outline-none focus:border-rose-500/25 resize-none"
          placeholder={"Enter keywords separated by comma or newline...\n\nexample:\nseo tools\nkeyword research\ncontent optimization"}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !keywords.trim()}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:shadow-rose-500/30 disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate Entities"}
        </button>
        {error && (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
            {error}
          </p>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] px-5 py-3">
        <p className="text-xs text-white/50">
          <span className="font-bold text-rose-300">Entities Generator:</span> Enter keywords separated by comma or newline, or upload a text file. AI will generate related entities for each keyword that you should mention in your content for better SEO.
        </p>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          {results.map((group, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
              <h4 className="text-sm font-bold text-white/70 mb-3">
                <span className="text-rose-300">"{group.keyword}"</span> — Related Entities
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.entities.map((entity, j) => (
                  <span key={j} className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06] cursor-pointer transition">
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
