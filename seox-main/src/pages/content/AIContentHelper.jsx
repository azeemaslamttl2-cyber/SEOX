import { useState, useRef, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Code, Link2, AlignLeft,
  AlignCenter, AlignRight, List, ListOrdered, ChevronDown, Send,
  Plus, Sparkles, MessageSquare, Type, FileText, Heading, Users,
  RotateCcw, RotateCw, X, Check, ArrowRight, ExternalLink,
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
  { cmd:"bold", icon:Bold },
  { cmd:"italic", icon:Italic },
  { cmd:"underline", icon:Underline },
  { cmd:"strikeThrough", icon:Strikethrough },
  { sep:true },
  { cmd:"insertUnorderedList", icon:List },
  { cmd:"insertOrderedList", icon:ListOrdered },
  { sep:true },
  { cmd:"justifyLeft", icon:AlignLeft },
  { cmd:"justifyCenter", icon:AlignCenter },
  { cmd:"justifyRight", icon:AlignRight },
];

/* ── Content Score Ring ── */
function ScoreRing({ score, max=100 }) {
  const r=32, c=2*Math.PI*r, pct=score/max, off=c-(pct*c);
  const color = score > 60 ? "#22c55e" : score > 30 ? "#fb923c" : "#ef4444";
  return (
    <div className="relative h-20 w-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{transition:"stroke-dashoffset 0.8s ease"}}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-xl font-bold">{score}</span>
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
    <div className="space-y-3">
      <p className="text-xs text-white/50 leading-relaxed">Refine your draft to better address the questions your audience is asking about this topic. Helpful content benefits the customer and often ranks higher.</p>
      {TOPICS.map((t,i)=>(
        <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">{t.title}</h4>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/50">{t.score}</span>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed">{t.desc}</p>
          <div className="text-[11px] text-white/30 font-medium">Relevant terms</div>
          <div className="flex flex-wrap gap-1">
            {t.terms.map(term=>(
              <span key={term} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-brand-300 hover:bg-brand-500/20 cursor-pointer transition">{term} ›</span>
            ))}
          </div>
          <button onClick={() => askAboutTopic(t)} disabled={loadingTopic === t.title} className="flex items-center gap-1 text-[11px] text-brand-300 hover:underline mt-1 disabled:opacity-40">
            <Sparkles className="h-3 w-3"/>{loadingTopic === t.title ? "Asking..." : "Ask AI"}
          </button>
          {answers[t.title] && (
            <div className="rounded-lg border border-brand-500/20 bg-brand-500/[0.06] p-2 text-[11px] leading-relaxed text-white/55">
              {answers[t.title].split("\n").filter(Boolean).map((line, j) => <p key={j} className={j > 0 ? "mt-1" : ""}>{line}</p>)}
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
    { role:"assistant", text:"I'm your writing assistant. I can see your document and competitor articles. I can give feedback, brainstorm ideas, and more.\n\nHow can I help you today?" }
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
          <div key={i} className={`rounded-lg p-3 text-xs leading-relaxed ${m.role==="assistant"?"border border-white/10 bg-white/[0.03] text-white/70":"bg-brand-500/15 text-brand-200"}`}>
            {m.text.split("\n").map((line,j)=><p key={j} className={j>0?"mt-2":""}>{line}</p>)}
          </div>
        ))}
        {messages.length===1 && (
          <div className="space-y-1.5">
            {AI_SUGGESTIONS.map(s=>(
              <button key={s} onClick={()=>sendMessage(s)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white transition text-left">
                <ArrowRight className="h-3 w-3 text-brand-400 flex-shrink-0"/>{s}
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/40">
            DeepSeek is thinking...
          </div>
        )}
      </div>
      <div className="border-t border-white/10 pt-3 mt-auto">
        <div className="flex items-center gap-1.5 mb-2">
          <button className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/50"><Plus className="h-2.5 w-2.5"/></button>
          <span className="flex items-center gap-1 rounded bg-brand-500/15 px-2 py-0.5 text-[10px] text-brand-300">📄 6 competitors <X className="h-2.5 w-2.5 cursor-pointer"/></span>
          <span className="flex items-center gap-1 rounded bg-brand-500/15 px-2 py-0.5 text-[10px] text-brand-300">📝 This document <X className="h-2.5 w-2.5 cursor-pointer"/></span>
        </div>
        <div className="relative">
          <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Ask AI anything..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 pr-8 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/40"/>
          <button onClick={()=>sendMessage()} disabled={loading || !msg.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-300 disabled:opacity-40"><Send className="h-3.5 w-3.5"/></button>
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
      <p className="text-xs text-white/50 leading-relaxed">The title tag appears in search results and browser tabs, providing a quick summary of your article. It helps improve visibility and encourages users to click through.</p>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Recommendations</h4>
        <ul className="space-y-1 text-[11px] text-white/50 list-disc pl-4">
          <li>Briefly describe the topic of your post</li>
          <li>Include your target keyword</li>
          <li>Keep your title between 50–60 ch.</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Your title tag</h4>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add your article title tag"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/40"/>
        {title && <p className="mt-1 text-[10px] text-white/30">{title.length} ch.</p>}
      </div>
      <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-300 hover:bg-brand-500/25 transition disabled:opacity-40">
        <Sparkles className="h-3.5 w-3.5"/>{loading ? "Generating..." : "Generate with DeepSeek"}
      </button>
      {error && <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">{error}</p>}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {["Ideas","Competitors"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`pb-2 text-xs font-semibold border-b-2 transition ${tab===t?"border-brand-500 text-brand-300":"border-transparent text-white/50 hover:text-white/70"}`}>{t}</button>
        ))}
      </div>
      {tab==="Ideas" && (
        <div className="space-y-2">
          {ideas.map((idea,i)=>(
            <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div><p className="text-xs text-white/80 font-medium">{idea.text}</p><p className="text-[10px] text-white/30 mt-1">{idea.chars} ch.</p></div>
              <button onClick={()=>setTitle(idea.text)} className="text-[11px] text-brand-300 hover:underline whitespace-nowrap ml-2">Use this title</button>
            </div>
          ))}
        </div>
      )}
      {tab==="Competitors" && <p className="text-xs text-white/40">Competitor title tags will appear here after analysis.</p>}
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
      <p className="text-xs text-white/50 leading-relaxed">A meta description is a brief summary that appears in search results and helps users understand your article, encouraging them to click through.</p>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Recommendations</h4>
        <ul className="space-y-1 text-[11px] text-white/50 list-disc pl-4">
          <li>Match the description to user search intent</li>
          <li>Include target keyword</li>
          <li>Keep your description between 110–160 ch.</li>
          <li>Avoid keyword stuffing and irrelevant details</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Your description</h4>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Add your article meta description"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/40 resize-none"/>
        {desc && <p className="mt-1 text-[10px] text-white/30">{desc.length} ch.</p>}
      </div>
      <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-300 hover:bg-brand-500/25 transition disabled:opacity-40">
        <Sparkles className="h-3.5 w-3.5"/>{loading ? "Generating..." : "Generate with DeepSeek"}
      </button>
      {error && <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">{error}</p>}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {["Ideas","Competitors"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`pb-2 text-xs font-semibold border-b-2 transition ${tab===t?"border-brand-500 text-brand-300":"border-transparent text-white/50 hover:text-white/70"}`}>{t}</button>
        ))}
      </div>
      {tab==="Ideas" && (
        <div className="space-y-2">
          {ideas.map((idea,i)=>(
            <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div><p className="text-xs text-white/80 leading-relaxed">{idea.text}</p><p className="text-[10px] text-white/30 mt-1">{idea.chars} ch.</p></div>
              <button onClick={()=>setDesc(idea.text)} className="text-[11px] text-brand-300 hover:underline whitespace-nowrap ml-2">Use this</button>
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
      <p className="text-xs text-white/50 leading-relaxed">Create an outline that meets the search intent of your target audience.</p>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Recommendations</h4>
        <ul className="space-y-1 text-[11px] text-white/50 list-disc pl-4">
          <li>Ensure H1 is used as the main heading</li>
          <li>Keep headers, particularly the H1, brief and clear</li>
          <li>Maintain logical structure for proper hierarchy</li>
          <li>Don't overstuff your header tags with keywords</li>
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-bold text-white mb-2">Your headings</h4>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/40 italic">Start writing to see your heading structure here...</p>
        </div>
      </div>
    </div>
  );
}

function CompetitorsPanel() {
  return (
    <div className="space-y-3">
      {COMPETITORS.map((c,i)=>(
        <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/50">#{c.rank}</span>
              <span className="text-xs font-medium text-brand-300">{c.url}</span>
            </div>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${c.score>0?"bg-brand-500/20 text-brand-300":"bg-white/10 text-white/40"}`}>{c.score}</span>
          </div>
          {c.desc && <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{c.desc}</p>}
          {!c.desc && c.score===0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-white/30">Couldn't fetch data</span>
              <button className="flex items-center gap-1 text-[10px] text-brand-300 hover:underline"><RotateCcw className="h-2.5 w-2.5"/>Try again</button>
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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden -mx-4 -my-6 lg:-mx-8">
      {/* ── Editor Panel ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-white/10 bg-ink-900/60 px-4 py-2 flex-wrap">
          <button onClick={()=>execCmd("undo")} className="p-1.5 rounded hover:bg-white/[0.06] text-white/40"><RotateCcw className="h-3.5 w-3.5"/></button>
          <button onClick={()=>execCmd("redo")} className="p-1.5 rounded hover:bg-white/[0.06] text-white/40"><RotateCw className="h-3.5 w-3.5"/></button>
          <div className="mx-1 h-4 w-px bg-white/10"/>
          <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:bg-white/[0.06]">Paragraph <ChevronDown className="h-3 w-3"/></button>
          <div className="mx-1 h-4 w-px bg-white/10"/>
          {TOOLBAR.map((t,i)=> t.sep ? <div key={i} className="mx-1 h-4 w-px bg-white/10"/> : (
            <button key={i} onClick={()=>execCmd(t.cmd)} className="p-1.5 rounded hover:bg-white/[0.06] text-white/50 hover:text-white"><t.icon className="h-3.5 w-3.5"/></button>
          ))}
          <div className="mx-1 h-4 w-px bg-white/10"/>
          <button onClick={()=>execCmd("createLink")} className="p-1.5 rounded hover:bg-white/[0.06] text-white/50"><Link2 className="h-3.5 w-3.5"/></button>
          <button className="p-1.5 rounded hover:bg-white/[0.06] text-white/50"><Code className="h-3.5 w-3.5"/></button>
        </div>

        {/* Meta row */}
        <div className="px-8 pt-4">
          <button className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1">URL, title and meta description <ChevronDown className="h-3 w-3"/></button>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={handleInput}
            className="min-h-[400px] max-w-[680px] mx-auto text-sm text-white/80 leading-relaxed focus:outline-none prose-headings:text-white prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-p:text-white/70"
            data-placeholder="Start writing your content..."/>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="flex w-[380px] flex-shrink-0 flex-col border-l border-white/10 bg-ink-900/40">
        {/* Tab selector + Content score */}
        <div className="flex items-start gap-3 border-b border-white/10 p-4">
          {/* Tabs */}
          <div className="flex-1">
            <div className="flex flex-wrap gap-1">
              {TABS.map(tab=>{
                const Icon = TAB_ICONS[tab];
                const isActive = activeTab === tab;
                return (
                  <button key={tab} onClick={()=>setActiveTab(tab)}
                    className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition flex items-center gap-1 ${isActive?"bg-brand-500/20 text-brand-200":"text-white/45 hover:text-white/70 hover:bg-white/[0.04]"}`}>
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Score */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/40 mb-1 font-medium">Content score</span>
            <ScoreRing score={wordCount > 0 ? Math.min(Math.round(wordCount/10), 95) : 0}/>
            <div className="mt-2 text-center">
              <p className="text-xs text-white/60 font-medium">Words</p>
              <p className="text-sm font-bold">{wordCount} <span className="text-[11px] text-white/30 font-normal">/ {targetWords} ✓</span></p>
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
        <div className="border-t border-white/10 px-4 py-2 flex items-center justify-center">
          <button className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60"><MessageSquare className="h-3 w-3"/>Feedback</button>
        </div>
      </div>
    </div>
  );
}
