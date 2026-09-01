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
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Unique N-Grams Generator</h1>
              <p className="text-sm text-white/60">Generate original word sequences for SEO authority</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white/10 border border-white/15 p-3">
            <p className="text-xs text-amber-200 font-semibold mb-1">🌟 Why Use Unique N-Grams?</p>
            <p className="text-[11px] text-white/50">
              Unique n-grams are specific, original sequences of words not commonly found elsewhere. They help your content stand out and signal to search engines that you're providing specialized, valuable information—boosting your authority and ranking potential.
            </p>
          </div>
          {/* Input */}
          <div className="mt-4 flex items-center gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
              placeholder="Enter a topic (e.g., hot water benefits, laptop maintenance)"
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/25 transition disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> {loading ? "..." : "Generate"}
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/80">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Empty / Results */}
      {!results ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-12 flex flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <Sparkles className="h-6 w-6 text-violet-400/50" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/25">Generate Unique N-Grams</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-white/15">
            Enter any topic to generate unique, uncommon word sequences that will help your content stand out and rank higher.
          </p>
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3 max-w-md">
            <p className="text-[11px] text-white/50">
              <span className="text-rose-300 font-bold">🌶 Example</span><br />
              For "health benefits of hot water", instead of generic phrases, get unique ones like "drinking hot water after dinner" or "drinking hot water during winter" that have less competition.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {d.exampleTopics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition"
              >{t}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
          <h3 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" /> Generated Unique N-Grams ({results.length})
          </h3>
          <div className="space-y-2">
            {results.map((ngram, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#010409] px-4 py-3 hover:bg-white/[0.02] transition cursor-pointer">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-300">{i + 1}</span>
                <span className="text-sm text-white/60">{ngram}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
