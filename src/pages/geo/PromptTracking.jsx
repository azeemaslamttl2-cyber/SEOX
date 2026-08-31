import { useState } from "react";
import {
  Crosshair,
  Globe,
  Search,
  RefreshCw,
  Clock,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

const mockResult = {
  url: "https://learnwirepro.com",
  siteName: "Learnwire",
  analyzedAt: "3/28/2026, 7:58:37 AM",
  extractedKeywords: [
    "AI software reviews", "honest software reviews", "best AI writing tools 2025",
    "AI SEO tools", "YouTube keyword research tools 2026", "AI website builder review",
    "Rybbit review", "Google Analytics alternative", "FormRobin review", "AI form builder",
    "Zebracat AI review", "AI video generator 2025", "Bytes Review 2026",
    "Grapes Studio review", "AI micro-course creator", "software review blog",
    "honest tech reviews", "AI tool reviews", "best AI tools", "software review website",
    "AI marketing tools", "learn about AI software",
  ],
  pageTextSample: `No BS. Just honest software reviews.\n\nBytes Review 2026: Is This AI Micro-Course Creator Worth It? 🎓 Grapes Studio Review: Build Websites in Minutes with an $8/month AI Tool 10 Best YouTube Keyword Research Tools: The 2026 Growth Stack That Actually Works AI SEO is HERE & This Tool DOMINATES (SEMrush One Review) Rybbit Review: A Simplified Google Analytics Alternative That Tracked Users in Real Time FormRobin Review — Build Forms in Seconds with AI Magic! 13 Best AI Writing Tools I've Personally Tested in 2025 What is Zebracat AI? The AI Video Generator Everyone's Talking About in 2025\n\nSign up to receive updates and the latest news from Learnwire.\n\nby David Mills`,
  promptsByLlm: [
    {
      keyword: "AI software reviews",
      prompts: {
        chatgpt: [
          "Where can I find AI software reviews?",
          "Recommend a website for AI software reviews",
          "What are some reliable sources for AI software reviews?",
          "AI software reviews: what should I look for?",
          "Compare AI software review sites.",
        ],
        gemini: [
          "AI software reviews online",
          "Find AI software reviews",
          "Best AI software review sites",
          "Summarize AI software reviews",
          "AI software reviews for small businesses",
        ],
        claude: [
          "Give me a list of websites that review AI software.",
          "Summarize the best AI software reviews.",
          "I need AI software reviews. Where should I look?",
          "What are the top-rated AI software review platforms?",
          "Find unbiased AI software reviews.",
        ],
        perplexity: [
          "AI software review websites",
          "Top AI software review sites",
          "Independent AI software reviews",
          "Are AI software reviews reliable?",
          "How to find trustworthy AI software reviews?",
        ],
        grok: [
          "What are the best AI software reviews sites?",
          "Can you recommend AI software reviews?",
          "Latest AI software reviews for 2025",
          "Where to find trustworthy AI software reviews?",
          "Top AI software reviews blog",
        ],
      },
    },
    {
      keyword: "honest software reviews",
      prompts: {
        chatgpt: [
          "Where can I find honest software reviews?",
          "What are some websites known for honest software reviews?",
          "How to identify honest software reviews?",
          "Best sources for unbiased software reviews?",
        ],
        gemini: [
          "Honest software reviews",
          "Find unbiased software reviews",
          "Best websites for honest software reviews",
          "Software reviews you can trust",
          "How to spot fake software reviews",
        ],
        claude: [
          "List websites that provide honest software reviews.",
          "Summarize the most reliable software review sites.",
          "I need honest software reviews. Where should I go?",
          "What are the top sources for unbiased software reviews?",
        ],
        perplexity: [
          "Unbiased software review sites",
          "Top honest software review sites",
          "Reliable software reviews",
          "How to find honest software reviews",
          "Software reviews with integrity",
        ],
        grok: [
          "Where can I find honest software reviews?",
          "Best sites for honest software reviews",
          "Honest software reviews for productivity tools",
          "Need honest software reviews reddit",
        ],
      },
    },
  ],
};

const llmColors = {
  chatgpt: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400" },
  gemini: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-300", dot: "bg-blue-400" },
  claude: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300", dot: "bg-amber-400" },
  perplexity: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300", dot: "bg-violet-400" },
  grok: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-300", dot: "bg-rose-400" },
};

export default function PromptTracking() {
  const [url, setUrl] = useState(mockResult.url);
  const [hasResult, setHasResult] = useState(true);
  const [openSections, setOpenSections] = useState({ 0: true, 1: true });

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-800">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/[0.08] blur-[100px]" />
          <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-cyan-500/[0.05] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <Crosshair className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-white">Prompt Tracking</h1>
              <p className="text-xs text-white/40">Find and analyze all the prompts that you are ranking for</p>
            </div>
          </div>

          {/* Run Analysis */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-ink-900/60 p-5">
            <h3 className="text-sm font-bold text-white/70">Run analysis</h3>
            <p className="mt-1 text-[11px] text-white/35">Project or website URL</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-2.5">
                <Globe className="h-4 w-4 text-emerald-400/60" />
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                  placeholder="https://example.com"
                />
              </div>
              <button
                onClick={() => setHasResult(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40"
              >
                <Search className="h-4 w-4" /> Scrape & predict prompts
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/25">No saved projects found. Enter a page URL to analyze any public URL.</p>
          </div>
        </div>
      </div>

      {hasResult && (
        <>
          {/* History */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white/90">History</h2>
              <button className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400 hover:text-emerald-300">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-ink-900/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/80">{mockResult.url}</div>
                  <div className="text-[11px] text-white/35">{mockResult.siteName}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                  <Clock className="h-3 w-3" /> {mockResult.analyzedAt}
                </div>
              </div>

              {/* Extracted Keywords */}
              <div className="mt-4">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  <Tag className="h-3 w-3" /> Extracted Keywords
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mockResult.extractedKeywords.map((kw, i) => (
                    <span key={i} className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-300/80">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Page Text Sample */}
              <div className="mt-4">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  <FileText className="h-3 w-3" /> Page Text Sample (Stored)
                </h4>
                <div className="mt-2 max-h-[200px] overflow-y-auto rounded-lg border border-white/[0.04] bg-ink-900/60 p-3">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/50 font-sans">{mockResult.pageTextSample}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Prompts by LLM */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-lg font-bold text-white/90">Prompts by LLM</h2>
            </div>
            <p className="text-[12px] text-white/35 -mt-3 mb-5">Example user prompts per topic where this page might be relevant in each model.</p>

            <div className="space-y-5">
              {mockResult.promptsByLlm.map((group, gi) => (
                <div key={gi} className="rounded-xl border border-white/[0.06] bg-ink-900/30">
                  <button
                    onClick={() => setOpenSections((p) => ({ ...p, [gi]: !p[gi] }))}
                    className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    <h3 className="text-sm font-bold text-emerald-300">{group.keyword}</h3>
                    {openSections[gi] ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
                  </button>
                  {openSections[gi] && (
                    <div className="grid grid-cols-5 gap-px border-t border-white/[0.04] bg-white/[0.02]">
                      {Object.entries(group.prompts).map(([llm, prompts]) => {
                        const c = llmColors[llm];
                        return (
                          <div key={llm} className="bg-ink-900/80 p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                              <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{llm}</span>
                            </div>
                            <ul className="space-y-1.5">
                              {prompts.map((p, pi) => (
                                <li key={pi} className="text-[11px] leading-relaxed text-white/50 hover:text-white/70 transition cursor-default">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
