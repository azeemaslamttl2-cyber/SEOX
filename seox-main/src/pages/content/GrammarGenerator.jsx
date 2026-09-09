import { useState, useRef } from "react";
import { BookOpen, Sparkles, Copy, Check, Download, Tag, ArrowRight } from "lucide-react";
import { grammarData } from "../../data/contentData.js";
import { generateGrammarRelations } from "../../lib/contentTools.js";
import { generateGrammarRelationsDeepSeek } from "../../lib/deepseekContent.js";

/* Eight categories, previously eight hues driving a coloured dot, a tinted
   count badge and a blurred glow behind each card. The label already names
   the category, so the colour was decoration. */
const CATEGORIES = [
  { key: "properNouns", label: "Proper Nouns" },
  { key: "commonNouns", label: "Common Nouns" },
  { key: "synonyms", label: "Synonyms" },
  { key: "antonyms", label: "Antonyms" },
  { key: "hyponyms", label: "Hyponyms" },
  { key: "hypernyms", label: "Hypernyms" },
  { key: "meronyms", label: "Meronyms" },
  { key: "holonyms", label: "Holonyms" },
];

export default function GrammarGenerator() {
  const d = grammarData;
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedWord, setCopiedWord] = useState(null);
  const [copiedCategory, setCopiedCategory] = useState(null);
  const resultsRef = useRef(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(await generateGrammarRelationsDeepSeek(topic));
    } catch (err) {
      setResults(generateGrammarRelations(topic));
      setError(err.message || "DeepSeek could not generate relationships. Showing local fallback results.");
    } finally {
      setLoading(false);
    }
  }

  function copyWord(word) {
    navigator.clipboard.writeText(word);
    setCopiedWord(word);
    setTimeout(() => setCopiedWord(null), 1500);
  }

  function copyCategoryWords(key, words) {
    navigator.clipboard.writeText(words.join(", "));
    setCopiedCategory(key);
    setTimeout(() => setCopiedCategory(null), 1500);
  }

  function exportAll() {
    if (!results) return;
    const lines = CATEGORIES.map(({ key, label }) => {
      const words = results[key] || [];
      return `${label}:\n${words.map((w) => `  • ${w}`).join("\n")}`;
    });
    const text = `Grammar Relations for "${topic}"\n${"=".repeat(40)}\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grammar-relations-${topic.replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalWords = results
    ? CATEGORIES.reduce((sum, { key }) => sum + (results[key]?.length || 0), 0)
    : 0;

  return (
    <div className="ctool-page space-y-6">
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              Grammar Generator
            </h1>
            <p className="ctool-subtitle">
              Generate semantic word relationships for SEO, content strategy, and topical depth analysis.
            </p>
          </div>
        </div>
      </div>

      <div className="ctool-card">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="ctool-card-icon h-4 w-4" />
          <span className="ctool-card-title">Topic</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="ctool-input flex-1"
            placeholder="Enter a topic (e.g., Laptop, Coffee, Marketing)"
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

      {!results && (
        <div className="ctool-empty">
          <div className="ctool-empty-icon">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="ctool-empty-title">Discover Word Relationships</h3>
          <p className="ctool-empty-text">
            Enter any topic to generate proper nouns, synonyms, antonyms, hyponyms, and more for comprehensive SEO content.
          </p>
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
      )}

      {results && (
        <div ref={resultsRef} className="space-y-4">
          <div className="ctool-card gram-summary flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="ctool-empty-icon h-9 w-9">
                <Tag className="ctool-card-icon h-4 w-4" />
              </div>
              <div>
                <h2 className="gram-summary-title">
                  Results for "<span className="ctool-group-keyword">{topic}</span>"
                </h2>
                <p className="ctool-help-text">{totalWords} words across {CATEGORIES.length} categories</p>
              </div>
            </div>
            <button
              onClick={exportAll}
              className="ui-button ui-button-primary"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export All</span>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {CATEGORIES.map(({ key, label }) => {
              const words = results[key] || [];
              if (words.length === 0) return null;
              return (
                <div key={key} className="gram-card group">
                  <div className="gram-card-head">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="gram-card-title">{label}</h4>
                      <span className="ctool-count-badge">{words.length}</span>
                    </div>
                    <button
                      onClick={() => copyCategoryWords(key, words)}
                      className="ui-button ctool-tool-btn"
                      title="Copy all words"
                    >
                      {copiedCategory === key ? (
                        <><Check className="h-3 w-3 chat-copied" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy all</>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {words.map((word, i) => (
                      <button
                        key={i}
                        onClick={() => copyWord(word)}
                        className="ctool-chip ctool-chip-btn"
                        title={`Click to copy "${word}"`}
                      >
                        <span className="relative z-10">
                          {word}
                        </span>
                        {copiedWord === word && (
                          <span className="ctool-copied-overlay">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
