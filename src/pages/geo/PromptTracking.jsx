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

/* One model per column, so the hue is data — but the dark-theme values were
   unreadable on a light surface. Same distinction, legible weights. */
const llmColors = {
  chatgpt: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  gemini: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  claude: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  perplexity: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500" },
  grok: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

export default function PromptTracking() {
  const [url, setUrl] = useState(mockResult.url);
  const [hasResult, setHasResult] = useState(true);
  const [openSections, setOpenSections] = useState({ 0: true, 1: true });

  return (
    <div className="ctool-page space-y-5">

      {/* Hero */}
      <div className="ctool-hero geo-hero">
        <div className="geo-hero-body">
          <div className="flex items-center gap-3">
            <div className="ctool-hero-icon">
              <Crosshair className="h-5 w-5" />
            </div>
            <div>
              <h1 className="ctool-title font-display">Prompt Tracking</h1>
              <p className="ctool-help-text">Find and analyze all the prompts that you are ranking for</p>
            </div>
          </div>

          {/* Run Analysis */}
          <div className="geo-well mt-6">
            <h3 className="stool-title">Run analysis</h3>
            <p className="ctool-help-text mt-1">Project or website URL</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="ctool-field flex-1">
                <Globe className="h-4 w-4" />
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  className="stool-bare-input flex-1"
                  placeholder="https://example.com"
                />
              </div>
              <button
                onClick={() => setHasResult(true)}
                className="ui-button ui-button-primary"
              >
                <Search className="h-4 w-4" /> Scrape & predict prompts
              </button>
            </div>
            <p className="ctool-help-text mt-2">No saved projects found. Enter a page URL to analyze any public URL.</p>
          </div>
        </div>
      </div>

      {hasResult && (
        <>
          {/* History */}
          <div className="ctool-card">
            <div className="flex items-center justify-between">
              <h2 className="geo-section-title font-display">History</h2>
              <button className="schema-addlink">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            <div className="geo-well mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="stool-strong">{mockResult.url}</div>
                  <div className="ctool-help-text">{mockResult.siteName}</div>
                </div>
                <div className="ctool-help-text flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {mockResult.analyzedAt}
                </div>
              </div>

              {/* Extracted Keywords */}
              <div className="mt-4">
                <h4 className="stool-label flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Extracted Keywords
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mockResult.extractedKeywords.map((kw, i) => (
                    <span key={i} className="ctool-chip">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Page Text Sample */}
              <div className="mt-4">
                <h4 className="stool-label flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Page Text Sample (Stored)
                </h4>
                <div className="geo-well geo-scroll mt-2 max-h-[200px] overflow-y-auto">
                  <pre className="geo-sample">{mockResult.pageTextSample}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Prompts by LLM */}
          <div className="ctool-card">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 ctool-accent" />
              <h2 className="geo-section-title font-display">Prompts by LLM</h2>
            </div>
            <p className="ctool-help-text -mt-3 mb-5">Example user prompts per topic where this page might be relevant in each model.</p>

            <div className="space-y-5">
              {mockResult.promptsByLlm.map((group, gi) => (
                <div key={gi} className="geo-panel">
                  <button
                    onClick={() => setOpenSections((p) => ({ ...p, [gi]: !p[gi] }))}
                    className="geo-acc-head"
                  >
                    <h3 className="geo-acc-title">{group.keyword}</h3>
                    {openSections[gi] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {openSections[gi] && (
                    <div className="geo-llm-grid">
                      {Object.entries(group.prompts).map(([llm, prompts]) => {
                        const c = llmColors[llm];
                        return (
                          <div key={llm} className="geo-llm-col">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                              <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{llm}</span>
                            </div>
                            <ul className="space-y-1.5">
                              {prompts.map((p, pi) => (
                                <li key={pi} className="geo-prompt">
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
