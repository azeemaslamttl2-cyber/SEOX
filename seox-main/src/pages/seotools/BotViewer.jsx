import { useState } from "react";
import { Eye, Globe } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

const bots = ["Googlebot", "Bingbot", "Facebook", "Twitter", "Baidu", "Yandex", "DuckDuckGo", "GPTBot (OpenAI)"];

export default function BotViewer() {
  const [selectedBot, setSelectedBot] = useState("Googlebot");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);

  function viewAs() {
    if (!url.trim()) return;
    setResult({
      bot: selectedBot,
      url,
      userAgent: getUA(selectedBot),
      status: 200,
      title: "Example Page Title",
      meta: "Page meta description as seen by the crawler.",
    });
  }

  function getUA(bot) {
    const map = {
      "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Facebook": "facebookexternalhit/1.1",
      "Twitter": "Twitterbot/1.0",
      "Baidu": "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
      "Yandex": "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "DuckDuckGo": "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)",
      "GPTBot (OpenAI)": "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)",
    };
    return map[bot] || "";
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <ToolHeader title="Bot Viewer" Icon={Eye} gradient="from-slate-800 via-indigo-800 to-blue-700" subtitle="See your site through the eyes of search engine and social bots" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Select Bot / Crawler</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {bots.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBot(b)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                selectedBot === b
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20"
                  : "border border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white/80"
              }`}
            >{b}</button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
            <Globe className="h-4 w-4 text-white/20" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
              placeholder="Enter URL to view as bot (e.g., https://example.com)"
            />
          </div>
          <button
            onClick={viewAs}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:shadow-indigo-600/30"
          >
            <Eye className="h-4 w-4" /> View as {selectedBot.split(" ")[0]}
          </button>
        </div>

        {!result ? (
          <div className="mt-5 rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-8 flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 shadow-md">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <h3 className="mt-3 text-base font-bold text-white/70">Bot Viewer</h3>
            <p className="mt-1 text-xs text-white/35 max-w-sm">Enter a URL and select a bot to see how search engine crawlers and social media bots view your website.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white/80">Crawled as {result.bot}</span>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">HTTP {result.status}</span>
            </div>
            <div className="space-y-2 text-xs">
              <Row label="URL" value={result.url} />
              <Row label="User-Agent" value={result.userAgent} mono />
              <Row label="Title" value={result.title} />
              <Row label="Meta" value={result.meta} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</span>
      <span className={`flex-1 text-white/65 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
