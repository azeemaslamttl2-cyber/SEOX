import { useState } from "react";
import { Bold, Italic, Underline, Heading, List, ListOrdered, Image, Link, Sparkles, MoreHorizontal } from "lucide-react";
import { analyzeContentOptimization } from "../../lib/contentTools.js";
import { generateOptimizationAdviceDeepSeek } from "../../lib/deepseekContent.js";

export default function ContentOptimization() {
  const [content, setContent] = useState("");
  const analysis = analyzeContentOptimization(content);
  const score = analysis.score;
  const [activePanel, setActivePanel] = useState("overview");
  const [aiAdvice, setAiAdvice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function handleAskAi() {
    setAiLoading(true);
    setAiError("");
    setAiAdvice("");
    try {
      setAiAdvice(await generateOptimizationAdviceDeepSeek(content));
      setActivePanel("optimization");
    } catch (err) {
      setAiError(err.message || "DeepSeek could not review this content.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="grid grid-cols-[1fr_320px] gap-4 h-[calc(100vh-120px)]">
        {/* Editor */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-1">
              {[Bold, Italic, Underline].map((Icon, i) => (
                <button key={i} className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <div className="h-5 w-px bg-white/[0.06] mx-1" />
              <button className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                <Heading className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                <List className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                <ListOrdered className="h-4 w-4" />
              </button>
              <div className="h-5 w-px bg-white/[0.06] mx-1" />
              <button className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                <Image className="h-4 w-4" />
              </button>
              <button className="rounded-md p-2 text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition">
                <Link className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAskAi}
                disabled={aiLoading}
                className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-3 py-1.5 text-[11px] font-bold text-violet-300 hover:bg-violet-500/20 transition disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? "Asking..." : "Ask AI"}
              </button>
              <button className="rounded-md p-2 text-white/30 hover:text-white/50">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full min-h-[400px] bg-transparent text-white/70 text-base leading-relaxed placeholder:text-white/15 focus:outline-none resize-none"
              placeholder="Article Title..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
            <span className="text-[11px] text-white/25">
              Target your primary keywords and use the entities listed in the sidebar to improve your content score.
            </span>
            <div className="flex items-center gap-3 text-[11px] text-white/30">
              <span>Words: {wordCount}</span>
              <span>Last saved just now</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] flex flex-col overflow-hidden">
          {/* Score */}
          <div className="flex flex-col items-center py-6 border-b border-white/[0.06]">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="absolute inset-0" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                <circle cx="40" cy="40" r="34" stroke="rgba(99,102,241,0.5)" strokeWidth="6" fill="none"
                  strokeDasharray={`${(score / 100) * 214} 214`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                />
              </svg>
              <span className="text-2xl font-black text-white/80">{score}</span>
            </div>
            <p className="mt-2 text-[11px] text-white/30">Keep optimizing to improve your score.</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            <button
              onClick={() => setActivePanel("overview")}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${activePanel === "overview" ? "text-blue-400 border-b-2 border-blue-400" : "text-white/30"}`}
            >Overview</button>
            <button
              onClick={() => setActivePanel("optimization")}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${activePanel === "optimization" ? "text-blue-400 border-b-2 border-blue-400" : "text-white/30"}`}
            >Optimization Section</button>
          </div>

          {/* Checklist */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Optimization Checklist</span>
              <span className="text-[10px] text-blue-400 font-semibold">NLP Enabled</span>
            </div>
            <div className="space-y-1.5">
              {analysis.checklist.map((item, i) => (
                <label key={i} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.02] cursor-pointer transition group">
                  <input type="checkbox" defaultChecked={item.done} className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-blue-500" />
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition">{item.item}</span>
                </label>
              ))}
            </div>
            {(aiAdvice || aiError || aiLoading) && (
              <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  <Sparkles className="h-3 w-3" /> DeepSeek Advice
                </div>
                {aiLoading && <p className="text-xs text-white/40">Reviewing your draft...</p>}
                {aiError && <p className="text-xs text-amber-200/80">{aiError}</p>}
                {aiAdvice && (
                  <div className="space-y-2 text-xs leading-relaxed text-white/60">
                    {aiAdvice.split("\n").filter(Boolean).map((line, i) => (
                      <p key={i}>{line}</p>
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
