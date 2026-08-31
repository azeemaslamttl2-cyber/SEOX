import { useState } from "react";
import { Network, Sparkles, BookOpen, FileText, Search } from "lucide-react";
import { skipGramData } from "../../data/contentData.js";
import { generateSkipGramWords } from "../../lib/contentTools.js";
import { generateSkipGramWordsDeepSeek } from "../../lib/deepseekContent.js";

export default function SkipGramWords() {
  const d = skipGramData;
  const [word, setWord] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!word.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults({ word, words: await generateSkipGramWordsDeepSeek(word) });
    } catch (err) {
      setResults({ word, words: generateSkipGramWords(word) });
      setError(err.message || "DeepSeek could not generate skip-gram words. Showing local fallback results.");
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
            <Network className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              Skip-Gram Dominant Words
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Generate context-aware co-occurring words for disambiguation, summarization, and SEO insight.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-[#E13A27]" />
          <span className="text-sm font-bold text-white/80">Word</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 focus:border-[#E13A27] focus:outline-none focus:ring-2 focus:ring-[#E13A27]/15"
            placeholder="Enter a word (e.g., bank, python, cloud)"
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
            <Network className="h-6 w-6 text-[#E13A27]/70" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/80">Discover Dominant Words</h3>
          <p className="mt-1 mx-auto max-w-md text-sm text-white/50">
            Enter any word to generate context-aware co-occurring words using Skip-Gram analysis.
          </p>

          <div className="mt-6 mx-auto w-full max-w-xl space-y-3 text-left">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white/60">
              <BookOpen className="h-3.5 w-3.5" /> How it works
            </h4>
            {d.howItWorks.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#E13A27]">
                  {i === 0 ? <Search className="h-3 w-3" /> : i === 1 ? <FileText className="h-3 w-3" /> : <Network className="h-3 w-3" />}
                  {item.title}
                </p>
                <p className="text-[11px] text-white/50">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {d.exampleWords.map((w) => (
              <button
                key={w}
                onClick={() => setWord(w)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:border-[#E13A27]/40 hover:bg-[#E13A27]/5 hover:text-white"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E13A27]/10">
              <Network className="h-4 w-4 text-[#E13A27]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Dominant Words for "<span className="text-[#E13A27]">{results.word}</span>"
              </h3>
              <p className="text-[11px] text-slate-500">{results.words.length} related terms</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {results.words.map((w, i) => (
              <button
                key={i}
                className="rounded-lg border border-[#E13A27]/10 bg-[#E13A27] px-3 py-2 text-[12px] font-semibold !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:bg-[#fef2f2] hover:!text-[#E13A27]"
                style={{ color: '#ffffff' }}
              >
                <span className="!text-white transition-colors duration-200 hover:!text-[#E13A27]" style={{ color: '#ffffff' }}>{w}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
