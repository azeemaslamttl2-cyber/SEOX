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
    <div className="ctool-page space-y-6">
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <Network className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              Skip-Gram Dominant Words
            </h1>
            <p className="ctool-subtitle">
              Generate context-aware co-occurring words for disambiguation, summarization, and SEO insight.
            </p>
          </div>
        </div>
      </div>

      <div className="ctool-card">
        <div className="mb-3 flex items-center gap-2">
          <Network className="ctool-card-icon h-4 w-4" />
          <span className="ctool-card-title">Word</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="ctool-input flex-1"
            placeholder="Enter a word (e.g., bank, python, cloud)"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="ui-button ui-button-primary"
          >
            <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && (
          <p className="app-alert app-alert-warning mt-3">
            {error}
          </p>
        )}
      </div>

      {!results ? (
        <div className="ctool-empty">
          <div className="ctool-empty-icon">
            <Network className="h-6 w-6" />
          </div>
          <h3 className="ctool-empty-title">Discover Dominant Words</h3>
          <p className="ctool-empty-text">
            Enter any word to generate context-aware co-occurring words using Skip-Gram analysis.
          </p>

          <div className="mt-6 mx-auto w-full max-w-xl space-y-3 text-left">
            <h4 className="ctool-section-label">
              <BookOpen className="h-3.5 w-3.5" /> How it works
            </h4>
            {d.howItWorks.map((item, i) => (
              <div key={i} className="ctool-card">
                <p className="ctool-group-title mb-1 flex items-center gap-1.5">
                  {i === 0 ? <Search className="h-3 w-3" /> : i === 1 ? <FileText className="h-3 w-3" /> : <Network className="h-3 w-3" />}
                  {item.title}
                </p>
                <p className="ctool-help-text">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {d.exampleWords.map((w) => (
              <button
                key={w}
                onClick={() => setWord(w)}
                className="ctool-chip"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="ctool-empty-icon h-9 w-9">
              <Network className="ctool-card-icon h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Dominant Words for "<span className="ctool-group-keyword">{results.word}</span>"
              </h3>
              <p className="text-[11px] text-slate-500">{results.words.length} related terms</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {results.words.map((w, i) => (
              <button
                key={i}
                className="ctool-chip ctool-chip-btn"
              >
                <span>{w}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
