import { useState, useRef, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Code, Link2, AlignLeft,
  AlignCenter, AlignRight, List, ListOrdered, ChevronDown, ChevronUp, Send,
  Plus, Sparkles, MessageSquare, Type, FileText, Heading, Users,
  RotateCcw, RotateCw, X, Check, ArrowRight, ExternalLink, Globe,
} from "lucide-react";
import {
  askDeepSeekContent,
  generateMetaDescriptionsDeepSeek,
  generateTitleIdeasDeepSeek,
} from "../../lib/deepseekContent.js";

/* ── mock data ── */
const TOPICS = [
  { title:"Benefits and Use Cases", score:0, desc:"This topic explores the advantages of using duplicate word finder tools, such as improving text clarity and reducing redundancy.", terms:["clarity","duplicate phrasing","grammar suggestions","keyword density","line breaks","readability","repetition","sentence structure","writing flow"] },
  { title:"How to Use Duplicate Word Finder Tools", score:0, desc:"This topic addresses the steps or instructions on how to utilize these tools effectively, including inputting text and interpreting results.", terms:["copywritely","hemingway editor","duplicate sentences","highlight duplicate words","highlight patterns in text","input form","output area","regular expression","remove duplicate lines","repeated words","show line numbers"] },
  { title:"Online Availability and Accessibility", score:0, desc:"This topic covers where and how users can access duplicate word finder tools online.", terms:["browser-based","free online tool","no installation","web application","cross-platform"] },
];

const TITLE_IDEAS = [
  { text:"Duplicate Word Finder – Instantly Find Repeated Words", chars:53 },
  { text:"Duplicate Word Finder Tool – Spot Repeated Words Online", chars:55 },
  { text:"Find Duplicate Words in Text – Free Online Word Finder", chars:54 },
  { text:"Duplicate Word Finder – Remove Repeated Words Easily", chars:52 },
];

const META_IDEAS = [
  { text:"Use our duplicate word finder to instantly spot and remove repeated words in your text. Improve clarity and polish your writing for free.", chars:137 },
  { text:"Find duplicate words in any text with our easy-to-use duplicate word finder. Paste your content, highlight repeats, and enhance your writing.", chars:141 },
  { text:"Quickly identify and eliminate repeated words using our duplicate word finder. Perfect tool for writers, students, and professionals.", chars:133 },
];

const COMPETITORS = [
  { url:"duplicateword.com", score:0, rank:1 },
  { url:"codepen.io", score:0, rank:2 },
  { url:"phrasefix.com", score:32, rank:3, desc:"Free online tool that checks for words that are duplicated in a sentence or text." },
  { url:"onlinetexttools.com", score:52, rank:4, desc:"Super simple, free and fast browser-based utility." },
  { url:"textcompare.org", score:41, rank:5, desc:"Advanced duplicate word detection with highlighting." },
];

const AI_SUGGESTIONS = [
  "Compare my article to competitors",
  "Identify confusing parts",
  "Suggest a structure for my article",
  "Suggest examples or clarifications",
  "Identify weak arguments",
];

const TABS = ["Topics","AI chat","Title tag","Meta description","Headings","Competitors"];

/* ── toolbar config ── */
const TOOLBAR = [
  { cmd:"bold", icon:Bold, label:"Bold" },
  { cmd:"italic", icon:Italic, label:"Italic" },
  { cmd:"underline", icon:Underline, label:"Underline" },
  { cmd:"strikeThrough", icon:Strikethrough, label:"Strikethrough" },
  { sep:true },
  { cmd:"insertUnorderedList", icon:List, label:"Bullet list" },
  { cmd:"insertOrderedList", icon:ListOrdered, label:"Numbered list" },
  { sep:true },
  { cmd:"justifyLeft", icon:AlignLeft, label:"Align left" },
  { cmd:"justifyCenter", icon:AlignCenter, label:"Align center" },
  { cmd:"justifyRight", icon:AlignRight, label:"Align right" },
];

/* ── Content Score Ring ── */
function ScoreRing({ score, max=100 }) {
  const r=24, c=2*Math.PI*r, pct=score/max, off=c-(pct*c);
  const color = score > 60 ? "#10b981" : score > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-14 w-14 max-h-14 max-w-14 flex-shrink-0 flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4.5"/>
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{transition:"stroke-dashoffset 0.8s ease"}}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-sm font-bold text-slate-800">{score}</span>
      </div>
    </div>
  );
}

/* ── Tab content components ── */
function TopicsPanel({ keyword, content }) {
  const [answers, setAnswers] = useState({});
  const [loadingTopic, setLoadingTopic] = useState("");

  async function askAboutTopic(topic) {
    setLoadingTopic(topic.title);
    setAnswers((prev) => ({ ...prev, [topic.title]: "" }));
    try {
      const text = await askDeepSeekContent({
        keyword,
        content,
        context: "Topic coverage panel inside the SEO content helper.",
        message: `Review the draft for this topic: "${topic.title}". Explain what to add, what entities to include, and how to cover the intent better.`,
      });
      setAnswers((prev) => ({ ...prev, [topic.title]: text }));
    } catch (err) {
      setAnswers((prev) => ({ ...prev, [topic.title]: err.message || "DeepSeek could not review this topic." }));
    } finally {
      setLoadingTopic("");
    }
  }

  return (
    <div className="space-y-3.5">
      <p className="text-xs text-slate-500 leading-relaxed">
        Refine your draft to address the key questions your audience is searching for. Comprehensive topic coverage improves organic search visibility and user satisfaction.
      </p>
      {TOPICS.map((t,i)=>(
        <div key={i} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2.5 transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900">{t.title}</h4>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600">{t.score}</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{t.desc}</p>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Relevant terms</div>
          <div className="flex flex-wrap gap-1.5">
            {t.terms.map(term=>(
              <span key={term} className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 cursor-pointer transition shadow-2xs">
                {term} ›
              </span>
            ))}
          </div>
          <button onClick={() => askAboutTopic(t)} disabled={loadingTopic === t.title} className="btn-ask-ai mt-1 disabled:opacity-40">
            <Sparkles className="h-3.5 w-3.5"/>{loadingTopic === t.title ? "Asking AI..." : "Ask AI"}
          </button>
          {answers[t.title] && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-xs leading-relaxed text-slate-800 mt-2">
              {answers[t.title].split("\n").filter(Boolean).map((line, j) => <p key={j} className={j > 0 ? "mt-1.5" : ""}>{line}</p>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AIChatPanel({ keyword, content }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([
    { role:"assistant", text:"I'm your SEO content writing assistant. I can inspect your draft, compare it with top ranking competitors, and provide instant optimization suggestions.\n\nHow can I help you refine your content today?" }
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(text = msg) {
    const clean = text.trim();
    if (!clean || loading) return;
    setMsg("");
    setLoading(true);
    setMessages((prev) => [...prev, { role:"user", text:clean }]);
    try {
      const answer = await askDeepSeekContent({
        keyword,
        content,
        context: "SEO content writing assistant chat. Give concise, practical writing and optimization advice.",
        message: clean,
      });
      setMessages((prev) => [...prev, { role:"assistant", text:answer || "DeepSeek returned an empty response." }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role:"assistant", text:err.message || "DeepSeek could not answer right now." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.map((m,i)=>(
          <div key={i} className={`rounded-xl p-3.5 text-xs leading-relaxed ${m.role==="assistant"?"border border-slate-200/80 bg-slate-50 text-slate-800 shadow-2xs":"bg-brand-500 text-white font-medium shadow-sm"}`}>
            {m.text.split("\n").map((line,j)=><p key={j} className={j>0?"mt-1.5":""}>{line}</p>)}
          </div>
        ))}
        {messages.length===1 && (
          <div className="space-y-1.5 pt-1">
            {AI_SUGGESTIONS.map(s=>(
              <button key={s} onClick={()=>sendMessage(s)} className="suggestion-btn flex w-full items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-brand-500 flex-shrink-0"/>{s}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-500 animate-pulse flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-500 animate-spin" />
            <span>AI Assistant is generating suggestions...</span>
          </div>
        )}
      </div>
      <div className="border-t border-slate-200/80 pt-3 mt-auto">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">📄 6 competitors</span>
          <span className="flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">📝 Live Document</span>
        </div>
        <div className="relative">
          <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Ask AI anything about your content..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 shadow-sm"/>
          <button onClick={()=>sendMessage()} disabled={loading || !msg.trim()} className="send-btn absolute right-2.5 top-1/2 -translate-y-1/2 disabled:opacity-30"><Send className="h-4 w-4"/></button>
        </div>
      </div>
    </div>
  );
}

function TitleTagPanel({ keyword, content }) {
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState("Ideas");
  const [ideas, setIdeas] = useState(TITLE_IDEAS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const nextIdeas = await generateTitleIdeasDeepSeek({ keyword, content });
      if (nextIdeas.length) setIdeas(nextIdeas);
    } catch (err) {
      setError(err.message || "DeepSeek could not generate title ideas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        The title tag appears in search engine results and browser tabs, providing a direct hook that drives click-through rate (CTR).
      </p>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
        <h4 className="text-xs font-bold text-slate-900 mb-2">Recommendations</h4>
        <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
          <li>Accurately describe the topic of your post</li>
          <li>Include your primary keyword near the beginning</li>
          <li>Keep your title between 50–60 characters</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-900 mb-1.5">Your Title Tag</h4>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add your article title tag..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 shadow-sm"/>
        {title && <p className="mt-1 text-[11px] font-semibold text-slate-500">{title.length} characters</p>}
      </div>
      <button onClick={handleGenerate} disabled={loading} className="btn-generate-ai inline-flex items-center gap-2 disabled:opacity-40">
        <Sparkles className="h-3.5 w-3.5"/>{loading ? "Generating..." : "Generate with DeepSeek"}
      </button>
      {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{error}</p>}
      <div className="flex gap-4 border-b border-slate-200 pt-2 pb-0">
        {["Ideas","Competitors"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`pb-2 text-xs font-bold border-b-2 transition ${tab===t?"border-brand-500 text-brand-600":"border-transparent text-slate-500 hover:text-slate-800"}`}>{t}</button>
        ))}
      </div>
      {tab==="Ideas" && (
        <div className="space-y-2.5">
          {ideas.map((idea,i)=>(
            <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-brand-300 transition">
              <div>
                <p className="text-xs font-semibold text-slate-800">{idea.text}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">{idea.chars} ch.</p>
              </div>
              <button onClick={()=>setTitle(idea.text)} className="btn-action-text whitespace-nowrap ml-3">Use Title</button>
            </div>
          ))}
        </div>
      )}
      {tab==="Competitors" && <p className="text-xs text-slate-500">Competitor title tags will appear here after analysis.</p>}
    </div>
  );
}

function MetaDescPanel({ keyword, content }) {
  const [desc, setDesc] = useState("");
  const [tab, setTab] = useState("Ideas");
  const [ideas, setIdeas] = useState(META_IDEAS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const nextIdeas = await generateMetaDescriptionsDeepSeek({ keyword, content });
      if (nextIdeas.length) setIdeas(nextIdeas);
    } catch (err) {
      setError(err.message || "DeepSeek could not generate meta descriptions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        A meta description is a brief summary that appears in search results to help readers understand your post and encourage clicks.
      </p>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
        <h4 className="text-xs font-bold text-slate-900 mb-2">Recommendations</h4>
        <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
          <li>Match the description directly to user search intent</li>
          <li>Include target keyword naturally</li>
          <li>Keep your description between 110–160 characters</li>
          <li>Include a clear call to action</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-900 mb-1.5">Your Meta Description</h4>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Add your article meta description..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 shadow-sm resize-none"/>
        {desc && <p className="mt-1 text-[11px] font-semibold text-slate-500">{desc.length} characters</p>}
      </div>
      <button onClick={handleGenerate} disabled={loading} className="btn-generate-ai inline-flex items-center gap-2 disabled:opacity-40">
        <Sparkles className="h-3.5 w-3.5"/>{loading ? "Generating..." : "Generate with DeepSeek"}
      </button>
      {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{error}</p>}
      <div className="flex gap-4 border-b border-slate-200 pt-2 pb-0">
        {["Ideas","Competitors"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`pb-2 text-xs font-bold border-b-2 transition ${tab===t?"border-brand-500 text-brand-600":"border-transparent text-slate-500 hover:text-slate-800"}`}>{t}</button>
        ))}
      </div>
      {tab==="Ideas" && (
        <div className="space-y-2.5">
          {ideas.map((idea,i)=>(
            <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-brand-300 transition">
              <div>
                <p className="text-xs font-medium text-slate-800 leading-relaxed">{idea.text}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">{idea.chars} ch.</p>
              </div>
              <button onClick={()=>setDesc(idea.text)} className="btn-action-text whitespace-nowrap ml-3">Use This</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadingsPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">Create a structured outline that fulfills search intent and helps readers easily navigate your content.</p>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
        <h4 className="text-xs font-bold text-slate-900 mb-2">Recommendations</h4>
        <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
          <li>Ensure H1 is used as the single main title</li>
          <li>Keep sub-headings (H2, H3) clear, concise, and structured</li>
          <li>Maintain logical semantic hierarchy across sections</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-900 mb-2">Detected Heading Structure</h4>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-xs text-slate-400 italic">Start writing in the editor to view live heading hierarchy...</p>
        </div>
      </div>
    </div>
  );
}

function CompetitorsPanel() {
  return (
    <div className="space-y-3">
      {COMPETITORS.map((c,i)=>(
        <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">#{c.rank}</span>
              <span className="text-xs font-bold text-college-blue">{c.url}</span>
            </div>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${c.score>0?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-slate-100 text-slate-500 border border-slate-200"}`}>{c.score}</span>
          </div>
          {c.desc && <p className="text-xs text-slate-600 leading-relaxed mt-1">{c.desc}</p>}
          {!c.desc && c.score===0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Data pending analysis</span>
              <button className="btn-action-text inline-flex items-center gap-1"><RotateCcw className="h-3 w-3"/>Retry</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */
export default function AIContentHelper() {
  const [activeTab, setActiveTab] = useState("Topics");
  const [keyword, setKeyword] = useState("duplicate word finder");
  const [wordCount, setWordCount] = useState(0);
  const [editorText, setEditorText] = useState("");
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [urlSlug, setUrlSlug] = useState("duplicate-word-finder");
  const [pageTitle, setPageTitle] = useState("Duplicate Word Finder – Free Online Word Checker");
  const [metaDesc, setMetaDesc] = useState("Check and highlight repeated words instantly to enhance content quality.");
  const editorRef = useRef(null);

  const TAB_ICONS = { Topics:FileText, "AI chat":MessageSquare, "Title tag":Type, "Meta description":FileText, Headings:Heading, Competitors:Users };

  const handleInput = useCallback(()=>{
    if(!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    setEditorText(text);
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(words.length);
  },[]);

  const execCmd = (cmd)=>{ document.execCommand(cmd, false, null); editorRef.current?.focus(); };

  const targetWords = "0-1K";

  return (
    <div className="ai-content-helper-workspace flex h-[calc(100vh-3.5rem)] overflow-hidden -mx-4 -my-6 lg:-mx-8 bg-slate-100/60">
      {/* ── Editor Panel ── */}
      <div className="flex flex-1 flex-col min-w-0 bg-slate-50/70">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4 py-2 shadow-xs flex-wrap">
          <button onClick={()=>execCmd("undo")} className="toolbar-btn" title="Undo"><RotateCcw className="h-4 w-4"/></button>
          <button onClick={()=>execCmd("redo")} className="toolbar-btn" title="Redo"><RotateCw className="h-4 w-4"/></button>
          <div className="mx-1 h-4 w-px bg-slate-200"/>
          
          <button onClick={()=>execCmd("formatBlock", "<p>")} className="toolbar-dropdown-btn">
            Paragraph <ChevronDown className="h-3 w-3"/>
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200"/>
          
          {TOOLBAR.map((t,i)=> t.sep ? <div key={i} className="mx-1 h-4 w-px bg-slate-200"/> : (
            <button key={i} onClick={()=>execCmd(t.cmd)} className="toolbar-btn" title={t.label}>
              <t.icon className="h-4 w-4"/>
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-slate-200"/>
          <button onClick={()=>execCmd("createLink")} className="toolbar-btn" title="Add Link"><Link2 className="h-4 w-4"/></button>
          <button onClick={()=>execCmd("formatBlock", "<pre>")} className="toolbar-btn" title="Code block"><Code className="h-4 w-4"/></button>
        </div>

        {/* Metadata Toggle & Inputs */}
        <div className="px-8 pt-4">
          <button
            onClick={() => setShowMetaForm(!showMetaForm)}
            className="meta-toggle-btn"
          >
            <Globe className="h-3.5 w-3.5 text-brand-500" />
            <span>URL, Title and Meta Description</span>
            {showMetaForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showMetaForm && (
            <div className="mt-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">URL Slug</label>
                <input
                  type="text"
                  value={urlSlug}
                  onChange={(e) => setUrlSlug(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Page Title</label>
                  <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Meta Description</label>
                  <input
                    type="text"
                    value={metaDesc}
                    onChange={(e) => setMetaDesc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Editor area with Paper Canvas */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          <div className="w-full">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              className="ach-canvas"
              data-placeholder="Start typing or pasting your content here..."
            />
          </div>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="flex w-[390px] flex-shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
        {/* Tab selector + Content score */}
        <div className="border-b border-slate-100 p-4 space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map(tab=>{
              const Icon = TAB_ICONS[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={()=>setActiveTab(tab)}
                  className={`helper-tab ${isActive ? "helper-tab-active" : "helper-tab-inactive"}`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0"/>
                  <span>{tab}</span>
                </button>
              );
            })}
          </div>

          {/* Score & Word Count Bar */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 p-3">
            <div className="flex items-center gap-3">
              <ScoreRing score={wordCount > 0 ? Math.min(Math.round(wordCount/10), 95) : 0}/>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Content Score</span>
                <span className="text-xs font-bold text-slate-700">Quality Index</span>
              </div>
            </div>
            <div className="text-right border-l border-slate-200 pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Words</span>
              <p className="text-sm font-bold text-slate-800">
                {wordCount} <span className="text-xs font-normal text-slate-500">/ {targetWords}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab==="Topics" && <TopicsPanel keyword={keyword} content={editorText}/>}
          {activeTab==="AI chat" && <AIChatPanel keyword={keyword} content={editorText}/>}
          {activeTab==="Title tag" && <TitleTagPanel keyword={keyword} content={editorText}/>}
          {activeTab==="Meta description" && <MetaDescPanel keyword={keyword} content={editorText}/>}
          {activeTab==="Headings" && <HeadingsPanel/>}
          {activeTab==="Competitors" && <CompetitorsPanel/>}
        </div>

        {/* Feedback link */}
        <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-center bg-slate-50/50">
          <button className="btn-feedback flex items-center gap-1.5 text-xs font-semibold transition">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400"/>
            <span>Share Feedback</span>
          </button>
        </div>
      </div>
    </div>
  );
}

