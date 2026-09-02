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
    <div className="space-y-4">
      <ToolHeader title="Bot Viewer" Icon={Eye} gradient="from-slate-800 via-indigo-800 to-blue-700" subtitle="See your site through the eyes of search engine and social bots" />

      <div className="stool-card">
        <label className="stool-label">Select Bot / Crawler</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {bots.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBot(b)}
              className={`ui-button transition ${
                selectedBot === b ? "ctool-seg-btn active" : "ctool-seg-btn"
              }`}
            >{b}</button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <div className="ctool-field flex-1">
            <Globe className="h-4 w-4" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="stool-bare-input flex-1"
              placeholder="Enter URL to view as bot (e.g., https://example.com)"
            />
          </div>
          <button
            onClick={viewAs}
            className="ui-button ui-button-primary"
          >
            <Eye className="h-4 w-4" /> View as {selectedBot.split(" ")[0]}
          </button>
        </div>

        {!result ? (
          <div className="ctool-empty mt-5">
            <div className="ctool-empty-icon">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <h3 className="ctool-empty-title">Bot Viewer</h3>
            <p className="ctool-empty-text">Enter a URL and select a bot to see how search engine crawlers and social media bots view your website.</p>
          </div>
        ) : (
          <div className="stool-well mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="stool-title">Crawled as {result.bot}</span>
              <span className="app-badge app-badge-success">HTTP {result.status}</span>
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
      <span className="w-24 flex-shrink-0 stool-label">{label}</span>
      <span className={`flex-1 stool-value ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
