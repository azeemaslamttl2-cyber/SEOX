import { useState, useRef } from "react";
import { BookOpen, Sparkles, Copy, Check, Download, Tag, ArrowRight } from "lucide-react";
import { grammarData } from "../../data/contentData.js";
import { generateGrammarRelations } from "../../lib/contentTools.js";
import { generateGrammarRelationsDeepSeek } from "../../lib/deepseekContent.js";

const CATEGORIES = [
  { key: "properNouns", label: "Proper Nouns", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { key: "commonNouns", label: "Common Nouns", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  { key: "synonyms", label: "Synonyms", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { key: "antonyms", label: "Antonyms", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  { key: "hyponyms", label: "Hyponyms", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { key: "hypernyms", label: "Hypernyms", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  { key: "meronyms", label: "Meronyms", color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  { key: "holonyms", label: "Holonyms", color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
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
    <div className="mx-auto max-w-[960px] space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent)]" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Grammar Generator</h1>
              <p className="text-sm text-white/70">Generate semantic word relationships for SEO</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/55 max-w-lg">
            Enter a topic to generate proper nouns, common nouns, synonyms, antonyms, hyponyms, hypernyms, meronyms, and holonyms.
          </p>
          {/* Input inline */}
          <div className="mt-4 flex items-center gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 backdrop-blur-sm"
              placeholder="Enter a topic (e.g., Laptop, Coffee, Marketing)"
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/25 backdrop-blur-sm transition disabled:opacity-40"
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

      {/* Empty State */}
      {!results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-12 flex flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10">
            <BookOpen className="h-6 w-6 text-brand-400/50" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/25">Discover Word Relationships</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-white/15">
            Enter any topic to generate proper nouns, synonyms, antonyms, hyponyms, and more for comprehensive SEO content.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {d.exampleTopics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 hover:text-brand-300 hover:border-brand-500/30 hover:bg-brand-500/5 transition"
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div ref={resultsRef} className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15">
                <Tag className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white/90">
                  Results for "<span className="text-brand-400">{topic}</span>"
                </h2>
                <p className="text-[11px] text-white/40">{totalWords} words across {CATEGORIES.length} categories</p>
              </div>
            </div>
            <button
              onClick={exportAll}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/50 hover:text-brand-300 hover:border-brand-500/30 transition"
            >
              <Download className="h-3.5 w-3.5" /> Export All
            </button>
          </div>

          {/* Category Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {CATEGORIES.map(({ key, label, color, bg }, catIdx) => {
              const words = results[key] || [];
              if (words.length === 0) return null;
              return (
                <div
                  key={key}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d1117] p-4 transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20"
                  style={{
                    animationDelay: `${catIdx * 60}ms`,
                  }}
                >
                  {/* Subtle glow top-left */}
                  <div
                    className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40"
                    style={{ background: color }}
                  />

                  {/* Category header */}
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: color }}
                      />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">{label}</h4>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: bg, color }}
                      >
                        {words.length}
                      </span>
                    </div>
                    <button
                      onClick={() => copyCategoryWords(key, words)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition"
                      title="Copy all words"
                    >
                      {copiedCategory === key ? (
                        <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy all</>
                      )}
                    </button>
                  </div>

                  {/* Word tags */}
                  <div className="relative flex flex-wrap gap-1.5">
                    {words.map((word, i) => (
                      <button
                        key={i}
                        onClick={() => copyWord(word)}
                        className="group/word relative rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white/55 hover:text-white/80 hover:border-white/[0.12] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
                        title={`Click to copy "${word}"`}
                      >
                        <span className="relative z-10">{word}</span>
                        {copiedWord === word && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
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
