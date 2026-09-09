import { useState } from "react";
import {
  Bold, Italic, Underline, Heading, List, ListOrdered, Image, Link2,
  Sparkles, Globe, ChevronDown, ChevronUp, CheckCircle2, Circle,
  RotateCcw, RotateCw, FileText, Tag, Layers, Check, Loader2, AlertCircle
} from "lucide-react";
import { analyzeContentOptimization } from "../../lib/contentTools.js";
import { generateOptimizationAdviceDeepSeek } from "../../lib/deepseekContent.js";

/* ── Circular Score Ring ── */
function ScoreRing({ score }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const off = c - pct * c;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative h-20 w-20 flex-shrink-0 flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-black text-slate-900 leading-none">{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

export default function ContentOptimization() {
  const [content, setContent] = useState("");
  const [activePanel, setActivePanel] = useState("overview");
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [urlSlug, setUrlSlug] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");

  const analysis = analyzeContentOptimization(content);
  const score = analysis.score;
  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  async function handleAskAi() {
    if (!content.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiAdvice("");
    try {
      const advice = await generateOptimizationAdviceDeepSeek(content);
      setAiAdvice(advice);
      setActivePanel("advice");
    } catch (err) {
      setAiError(err.message || "DeepSeek could not review this content.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="content-optimization-workspace ctool-page space-y-5 pb-6">
      {/* Hero Header */}
      <div className="optimization-hero">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-[90px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-black/10 blur-[80px]" />
        </div>
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              Content Optimization
            </h1>
            <p className="ctool-subtitle">
              Improve readability, topical depth, keyword coverage, and semantic clarity with structured AI feedback.
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_380px]">
        {/* Left Column: Editor & Writing Canvas */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
            <div className="flex items-center gap-1 flex-wrap">
              <button className="toolbar-dropdown-btn">
                Paragraph <ChevronDown className="h-3 w-3" />
              </button>
              <div className="mx-1 h-4 w-px bg-slate-200" />

              <button className="toolbar-btn" title="Bold"><Bold className="h-4 w-4" /></button>
              <button className="toolbar-btn" title="Italic"><Italic className="h-4 w-4" /></button>
              <button className="toolbar-btn" title="Underline"><Underline className="h-4 w-4" /></button>
              <div className="mx-1 h-4 w-px bg-slate-200" />

              <button className="toolbar-btn" title="Heading"><Heading className="h-4 w-4" /></button>
              <button className="toolbar-btn" title="Bullet List"><List className="h-4 w-4" /></button>
              <button className="toolbar-btn" title="Numbered List"><ListOrdered className="h-4 w-4" /></button>
              <div className="mx-1 h-4 w-px bg-slate-200" />

              <button className="toolbar-btn" title="Insert Image"><Image className="h-4 w-4" /></button>
              <button className="toolbar-btn" title="Insert Link"><Link2 className="h-4 w-4" /></button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAskAi}
                disabled={aiLoading || !content.trim()}
                className="btn-ask-ai flex items-center gap-1.5 disabled:opacity-40"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Ask DeepSeek AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metadata Drawer Toggle */}
          <div className="px-6 pt-4">
            <button
              onClick={() => setShowMetaForm(!showMetaForm)}
              className="meta-toggle-btn"
            >
              <Globe className="h-3.5 w-3.5 text-brand-500" />
              <span>URL, Title and Meta Description</span>
              {showMetaForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showMetaForm && (
              <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60 shadow-2xs space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">URL Slug</label>
                  <input
                    type="text"
                    value={urlSlug}
                    onChange={(e) => setUrlSlug(e.target.value)}
                    placeholder="e.g. content-optimization-guide"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Page Title</label>
                    <input
                      type="text"
                      value={pageTitle}
                      onChange={(e) => setPageTitle(e.target.value)}
                      placeholder="e.g. Complete Content Optimization Checklist"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Meta Description</label>
                    <input
                      type="text"
                      value={metaDesc}
                      onChange={(e) => setMetaDesc(e.target.value)}
                      placeholder="e.g. Discover how to optimize content for NLP algorithms..."
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Text Editor Area */}
          <div className="px-6 py-4 flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/40 p-5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition shadow-inner font-sans"
              placeholder="Paste or write your article here to start real-time optimization analysis..."
            />
          </div>

          {/* Editor Footer Status Bar */}
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Target your primary keywords and semantic entities to boost your quality score.
            </span>
            <div className="flex items-center gap-4 font-medium text-slate-700">
              <span>{wordCount} words</span>
              <span>~{readingTime} min read</span>
              <span className="text-slate-400">Live Analysis</span>
            </div>
          </div>
        </div>

        {/* Right Column: Optimization & Score Hub */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col space-y-4 p-5">
          {/* Score Header Card */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <ScoreRing score={score} />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Content Score</span>
                <p className="text-sm font-bold text-college-blue">
                  {score >= 70 ? "Strong Optimization" : score >= 40 ? "Moderate Quality" : "Needs Optimization"}
                </p>
                <span className="text-xs text-slate-500">
                  {analysis.checklist.filter(c => c.done).length} of {analysis.checklist.length} checks met
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <button
              onClick={() => setActivePanel("overview")}
              className={`opt-tab flex-1 ${activePanel === "overview" ? "opt-tab-active" : "opt-tab-inactive"}`}
            >
              Checklist
            </button>
            <button
              onClick={() => setActivePanel("entities")}
              className={`opt-tab flex-1 ${activePanel === "entities" ? "opt-tab-active" : "opt-tab-inactive"}`}
            >
              NLP Entities
            </button>
            <button
              onClick={() => setActivePanel("advice")}
              className={`opt-tab flex-1 ${activePanel === "advice" ? "opt-tab-active" : "opt-tab-inactive"}`}
            >
              AI Advice
            </button>
          </div>

          {/* Tab Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Checklist Tab */}
            {activePanel === "overview" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Optimization Checklist</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {Math.round((analysis.checklist.filter(c => c.done).length / analysis.checklist.length) * 100)}% Complete
                  </span>
                </div>

                <div className="space-y-2">
                  {analysis.checklist.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-xs transition ${
                        item.done
                          ? "border-emerald-200 bg-emerald-50/40 text-slate-800"
                          : "border-slate-200 bg-slate-50/50 text-slate-600"
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={`font-semibold ${item.done ? "text-emerald-950" : "text-slate-700"}`}>
                          {item.item}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {item.done ? "Requirement fulfilled" : "Recommended action"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entities & NLP Tab */}
            {activePanel === "entities" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="h-3.5 w-3.5 text-brand-500" />
                    <h4 className="text-xs font-bold text-slate-900">Detected Semantic Entities ({analysis.entities?.length || 0})</h4>
                  </div>
                  {(!analysis.entities || analysis.entities.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No entities detected yet. Start typing to analyze.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.entities.map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          {e.entity}
                          <span className="text-[9px] font-bold text-blue-500">{(e.salience || 0).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="h-3.5 w-3.5 text-purple-500" />
                    <h4 className="text-xs font-bold text-slate-900">NLP Keyword Coverage ({analysis.nlp?.length || 0})</h4>
                  </div>
                  {(!analysis.nlp || analysis.nlp.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Add more content to uncover NLP keywords.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.nlp.map((n, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                          {n.keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Advice Tab */}
            {activePanel === "advice" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                    <h4 className="text-xs font-bold text-slate-900">DeepSeek AI Recommendations</h4>
                  </div>
                  {aiAdvice && (
                    <button
                      onClick={handleAskAi}
                      disabled={aiLoading}
                      className="text-[11px] font-bold text-brand-600 hover:underline"
                    >
                      Re-analyze
                    </button>
                  )}
                </div>

                {aiLoading && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 animate-pulse flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    <span>DeepSeek AI is reviewing your content structure...</span>
                  </div>
                )}

                {aiError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}

                {!aiAdvice && !aiLoading && !aiError && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      Click the "Ask DeepSeek AI" button above to get bespoke recommendations on improving depth, clarity, and keyword density.
                    </p>
                    <button
                      onClick={handleAskAi}
                      disabled={!content.trim()}
                      className="btn-ask-ai inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Analyze Draft</span>
                    </button>
                  </div>
                )}

                {aiAdvice && (
                  <div className="rounded-xl border border-brand-200/80 bg-brand-50/40 p-4 text-xs leading-relaxed text-slate-800 space-y-2 max-h-[420px] overflow-y-auto">
                    {aiAdvice.split("\n").filter(Boolean).map((line, i) => (
                      <p key={i} className={line.startsWith("#") || line.startsWith("-") || line.startsWith("*") ? "font-semibold text-slate-900" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

