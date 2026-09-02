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
    <div className="ctool-page space-y-6">
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              Unique N-Grams Generator
            </h1>
            <p className="ctool-subtitle">
              Generate original, high-value word combinations that help your content stand out in search.
            </p>
          </div>
        </div>
      </div>

      <div className="ctool-card">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="ctool-card-icon h-4 w-4" />
          <span className="ctool-card-title">Topic</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="ctool-input flex-1"
            placeholder="Enter a topic (e.g., hot water benefits, laptop maintenance)"
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
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="ctool-empty-title">Generate Unique N-Grams</h3>
          <p className="ctool-empty-text">
            Enter any topic to generate unique, uncommon word sequences that help your content stand out and rank higher.
          </p>

          <div className="ctool-note mt-4 mx-auto max-w-lg text-left">
            <p className="text-[11px] text-slate-700">
              <span className="ctool-note-lead mr-1">Example</span>
              For "health benefits of hot water", instead of generic phrases, get unique ones like "drinking hot water after dinner" or "drinking hot water during winter" that have less competition.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {d.exampleTopics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="ctool-chip"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_-12px_rgba(17,24,39,0.18)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="ctool-empty-icon h-9 w-9">
              <Lightbulb className="ctool-card-icon h-4 w-4" />
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
                className="ctool-chip ctool-chip-btn"
                title={ngram}
              >
                <span>{ngram}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
