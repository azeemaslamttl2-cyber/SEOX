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
    <div className="mx-auto max-w-[900px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_90%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Skip-Gram Dominant Words</h1>
              <p className="text-sm text-white/60">Generate context-aware co-occurring words</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/40 max-w-lg">
            Enter a word to discover dominant co-occurring words for word sense disambiguation, document summarization, and keyword extraction.
          </p>
          {/* Input */}
          <div className="mt-4 flex items-center gap-2">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
              placeholder="Enter a word (e.g., bank, python, cloud)"
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
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-10 flex flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
            <Network className="h-6 w-6 text-indigo-400/50" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/25">Discover Dominant Words</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-white/15">
            Enter any word to generate context-aware co-occurring words using Skip-Gram analysis. Perfect for disambiguation, summarization, and keyword research.
          </p>

          {/* How it works */}
          <div className="mt-6 w-full max-w-lg space-y-3">
            <h4 className="text-xs font-bold text-white/40 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> How It Works
            </h4>
            {d.howItWorks.map((item, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <p className={`text-xs font-bold text-${item.color}-400 mb-0.5 flex items-center gap-1.5`}>
                  {i === 0 ? <Search className="h-3 w-3" /> : i === 1 ? <FileText className="h-3 w-3" /> : <Network className="h-3 w-3" />}
                  {item.title}
                </p>
                <p className="text-[11px] text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {d.exampleWords.map((w) => (
              <button
                key={w}
                onClick={() => setWord(w)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition"
              >{w}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
          <h3 className="text-sm font-bold text-white/80 mb-4">
            Dominant Words for "<span className="text-violet-300">{results.word}</span>"
          </h3>
          <div className="flex flex-wrap gap-2">
            {results.words.map((w, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-[#010409] px-4 py-2.5 text-sm text-white/60 hover:bg-white/[0.03] hover:text-white/80 cursor-pointer transition">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
