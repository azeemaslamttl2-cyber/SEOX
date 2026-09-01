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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d9cac7] bg-[#E13A27] p-5 shadow-[0_12px_28px_-18px_rgba(225,58,39,0.9)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_30%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              Entities Generator
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Generate SEO entities for your keywords using AI-driven topic clustering and entity discovery.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E13A27]" />
            <span className="text-sm font-bold text-white/80">Keywords</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/60 transition hover:border-white/15 hover:text-white">
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button
              onClick={() => setKeywords("")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-white/60 transition hover:border-white/15 hover:text-white"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>

        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={6}
          className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/80 placeholder:text-white/25 focus:border-[#E13A27] focus:outline-none focus:ring-2 focus:ring-[#E13A27]/15"
          placeholder={"Enter keywords separated by comma or newline...\n\nexample:\nseo tools\nkeyword research\ncontent optimization"}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !keywords.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E13A27] to-[#d93524] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(225,58,39,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate Entities"}
        </button>

        {error && (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[#E13A27]/20 bg-[#fff3f1] px-5 py-3">
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="font-bold text-[#B33221]">Entities Generator:</span> Enter keywords separated by comma or newline, or upload a text file. AI will generate related entities for each keyword that you should mention in your content for better SEO.
        </p>
      </div>

      {!results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-10 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E13A27]/10">
            <Sparkles className="h-6 w-6 text-[#E13A27]/70" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/80">Generate related entities</h3>
          <p className="mt-1 text-sm text-white/45">
            Add a few keywords to uncover the entities worth targeting in your SEO content.
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {results.map((group, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)]">
              <h4 className="mb-3 text-sm font-bold text-white/80">
                <span className="text-[#E13A27]">"{group.keyword}"</span> — Related Entities
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.entities.map((entity, j) => (
                  <span
                    key={j}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/65 transition hover:border-[#E13A27]/40 hover:bg-[#E13A27]/5 hover:text-white"
                  >
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
