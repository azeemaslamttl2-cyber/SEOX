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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d9cac7] bg-[#E13A27] p-5 shadow-[0_12px_28px_-18px_rgba(225,58,39,0.9)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_30%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2.5rem] font-black leading-none tracking-[-0.05em] text-white sm:text-[3rem]">
              Grammar Generator
            </h1>
            <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-[#ffeae7]">
              Generate semantic word relationships for SEO, content strategy, and topical depth analysis.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)] sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#E13A27]" />
          <span className="text-sm font-bold text-white/80">Topic</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 text-sm text-white/85 placeholder:text-white/25 focus:border-[#E13A27] focus:outline-none focus:ring-2 focus:ring-[#E13A27]/15"
            placeholder="Enter a topic (e.g., Laptop, Coffee, Marketing)"
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

      {!results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-10 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,0.9)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E13A27]/10">
            <BookOpen className="h-6 w-6 text-[#E13A27]/70" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white/80">Discover Word Relationships</h3>
          <p className="mt-1 max-w-md mx-auto text-sm text-white/50">
            Enter any topic to generate proper nouns, synonyms, antonyms, hyponyms, and more for comprehensive SEO content.
          </p>
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
      )}

      {results && (
        <div ref={resultsRef} className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[22px] border border-[#dfe3e8] bg-[#f4f4f5] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E13A27]/10">
                <Tag className="h-4 w-4 text-[#E13A27]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1f2b3d]">
                  Results for "<span className="text-[#E13A27]">{topic}</span>"
                </h2>
                <p className="text-[11px] text-slate-500">{totalWords} words across {CATEGORIES.length} categories</p>
              </div>
            </div>
            <button
              onClick={exportAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E13A27] px-4 py-2.5 text-sm font-semibold !text-white shadow-[0_8px_20px_-12px_rgba(225,58,39,0.9)] transition hover:bg-[#d9362b]"
              style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
            >
              <Download className="h-3.5 w-3.5" style={{ color: '#ffffff' }} />
              <span style={{ color: '#ffffff' }}>Export All</span>
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {CATEGORIES.map(({ key, label, color, bg }, catIdx) => {
              const words = results[key] || [];
              if (words.length === 0) return null;
              return (
                <div
                  key={key}
                  className="group relative overflow-hidden rounded-[18px] border border-[#dfe3e8] bg-[#f4f4f5] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-300"
                  style={{ animationDelay: `${catIdx * 60}ms` }}
                >
                  <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20" style={{ background: color }} />

                  <div className="relative mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <h4 className="text-[12px] font-black uppercase tracking-[0.08em] text-[#1f2b3d]">{label}</h4>
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-[#1f2b3d]" style={{ background: bg }}>
                        {words.length}
                      </span>
                    </div>
                    <button
                      onClick={() => copyCategoryWords(key, words)}
                      className="flex items-center gap-1 rounded-lg border border-[#dfe3e8] bg-white px-2 py-1 text-[10px] font-semibold text-[#1f2b3d] transition hover:border-[#E13A27]/30 hover:bg-[#fff6f5]"
                      title="Copy all words"
                    >
                      {copiedCategory === key ? (
                        <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy all</>
                      )}
                    </button>
                  </div>

                  <div className="relative flex flex-wrap gap-1.5">
                    {words.map((word, i) => (
                      <button
                        key={i}
                        onClick={() => copyWord(word)}
                        className="group relative rounded-lg border border-[#E13A27]/10 bg-[#E13A27] px-2.5 py-1.5 text-[12px] font-semibold !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition duration-200 hover:border-[#E13A27]/20 hover:bg-[#fef2f2] hover:!text-[#E13A27]"
                        title={`Click to copy "${word}"`}
                        style={{ color: '#ffffff' }}
                      >
                        <span className="relative z-10 !text-white transition-colors duration-200 group-hover:!text-[#E13A27]" style={{ color: '#ffffff' }}>
                          {word}
                        </span>
                        {copiedWord === word && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-emerald-500/20 text-[10px] font-bold text-white">
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
