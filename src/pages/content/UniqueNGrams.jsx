import { useState } from "react";
import { Sparkles, Lightbulb } from "lucide-react";
import { uniqueNgramsData } from "../../data/contentData.js";
import { generateUniqueNgrams } from "../../lib/contentTools.js";
import { generateUniqueNgramsDeepSeek } from "../../lib/deepseekContent.js";

export default function UniqueNGrams() {
  const d = uniqueNgramsData;
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(await generateUniqueNgramsDeepSeek(topic));
    } catch (err) {
      setResults(generateUniqueNgrams(topic));
      setError(err.message || "DeepSeek could not generate n-grams. Showing local fallback results.");
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
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              Unique N-Grams Generator
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Generate original, high-value word combinations that help your content stand out in search.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#E13A27]" />
          <span className="text-sm font-bold text-white/80">Topic</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 focus:border-[#E13A27] focus:outline-none focus:ring-2 focus:ring-[#E13A27]/15"
            placeholder="Enter a topic (e.g., hot water benefits, laptop maintenance)"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E13A27] to-[#d93524] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(225,58,39,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
            {error}
          </p>
        )}
      </div>

      {!results ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-10 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E13A27]/10">
            <Sparkles className="h-6 w-6 text-[#E13A27]/70" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/80">Generate Unique N-Grams</h3>
          <p className="mt-1 mx-auto max-w-md text-sm text-white/50">
            Enter any topic to generate unique, uncommon word sequences that help your content stand out and rank higher.
          </p>

          <div className="mt-4 mx-auto max-w-lg rounded-xl border border-[#E13A27]/20 bg-[#fff3f1] px-4 py-3 text-left">
            <p className="text-[11px] text-slate-700">
              <span className="mr-1 font-bold text-[#B33221]">Example</span>
              For "health benefits of hot water", instead of generic phrases, get unique ones like "drinking hot water after dinner" or "drinking hot water during winter" that have less competition.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {d.exampleTopics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-[#E13A27]/40 hover:bg-[#E13A27]/5 hover:text-white"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E13A27]/10">
              <Lightbulb className="h-4 w-4 text-[#E13A27]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Generated Unique N-Grams</h3>
              <p className="text-[11px] text-slate-500">{results.length} items generated</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {results.map((ngram, i) => (
              <button
                key={i}
                className="rounded-lg border border-[#E13A27]/10 bg-[#E13A27] px-3 py-2 text-[12px] font-semibold !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-[#fef2f2] hover:!text-[#E13A27]"
                title={ngram}
                style={{ color: '#ffffff' }}
              >
                <span className="!text-white transition-colors duration-200 hover:!text-[#E13A27]" style={{ color: '#ffffff' }}>{ngram}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
