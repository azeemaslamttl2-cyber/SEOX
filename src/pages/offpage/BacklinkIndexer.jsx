import { useState } from "react";
import {
  Zap,
  Send,
  Search,
  Key,
  Rss,
  Clock,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Globe,
  Bookmark,
} from "lucide-react";
import { backlinkIndexerData } from "../../data/offPageData.js";

export default function BacklinkIndexer() {
  const d = backlinkIndexerData;
  const [activeTab, setActiveTab] = useState(0);
  const [urls, setUrls] = useState("");
  const [pingOpen, setPingOpen] = useState(true);
  const [indexNowKey, setIndexNowKey] = useState("");

  const urlCount = urls.split("\n").filter((u) => u.trim()).length;

  const tabIcons = [Send, Search, Key, Rss, Clock];

  return (
    <div className="">
      {/* ─── Hero ─── */}
      <div className="edf-hero">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="bi-title-block">
              <div className="bi-title-row">
                <span className="edf-tile">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="edf-title font-display">Backlink Indexer</h1>
                    <span className="admin-badge badge-warning">Fast indexing</span>
                    <HelpCircle className="bi-help h-4 w-4" />
                  </div>
                  <p className="edf-description">Get your backlinks discovered and indexed faster by search engines</p>
                </div>
              </div>
            </div>
            <div className="bi-stats">
              <IndexStat value={urlCount} label="URLs" tone="info" />
              <IndexStat value={0} label="Pinged" tone="success" />
              <IndexStat value={0} label="Google API" tone="neutral" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="admin-tabs bi-tabs mt-5">
        {d.tabs.map((tab, i) => {
          const Icon = tabIcons[i];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`admin-tab ${activeTab === i ? "active" : ""}`}
            >
              <Icon className="h-3.5 w-3.5" /> {tab}
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content ─── */}
      {activeTab === 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          {/* Left: URL input */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-bold text-white/85">Backlink URLs</span>
                </div>
                <span className="text-xs text-white/30">{urlCount} URLs</span>
              </div>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none"
                placeholder={`Paste your backlink URLs here (one per line)\n\nhttps://example.com/my-backlink-page\nhttps://another-site.com/article-with-link\n...`}
              />
              <p className="mt-2 text-[11px] text-white/25">Note: Ping services will open in new tabs. Allow popups for best experience.</p>
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40">
                <Link2 className="h-4 w-4" /> Generate Ping Links
              </button>
            </div>

            {/* IndexNow Key */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-white/85">IndexNow Key (Optional)</span>
              </div>
              <p className="text-[11px] text-white/35 mb-3">
                For IndexNow to work, you need to host a key file on your domain.{" "}
                <a href="#" className="text-violet-300 hover:underline">Learn more →</a>
              </p>
              <input
                value={indexNowKey}
                onChange={(e) => setIndexNowKey(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-ink-900/80 px-3 py-2 text-sm text-white/70 placeholder:text-white/25 focus:outline-none"
                placeholder="Enter your IndexNow API key"
              />
            </div>
          </div>

          {/* Right: Ping Services + Social Bookmarks */}
          <div className="space-y-4">
            {/* Ping Services */}
            <div className="backlink-ping-panel rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <button
                onClick={() => setPingOpen(!pingOpen)}
                className="backlink-ping-toggle flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition"
              >
                <div className="flex items-center gap-2">
                  <span className="backlink-ping-icon flex h-7 w-7 items-center justify-center rounded-lg">
                    <Send className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-white/85">Ping Services</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="backlink-ping-count text-[11px]">
                    {d.pingServices.filter((s) => s.enabled).length} of {d.pingServices.length} services enabled
                  </span>
                  {pingOpen ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
                </div>
              </button>
              {pingOpen && (
                <div className="mt-3 space-y-2">
                  {d.pingServices.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                      <span className="text-sm text-white/70">{svc.name}</span>
                      <div className={`h-5 w-9 rounded-full transition ${svc.enabled ? "bg-emerald-500" : "bg-white/10"} relative`}>
                        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${svc.enabled ? "right-0.5" : "left-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Social Bookmarks */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="h-4 w-4 text-pink-400" />
                <span className="text-sm font-bold text-white/85">Social Bookmarks</span>
              </div>
              <p className="text-[11px] text-white/35 mb-3">
                Manually submit your links to these high-authority platforms for additional indexing signals.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {d.socialBookmarks.map((bm, i) => (
                  <button
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-white/40">
                      {bm.icon.toUpperCase().slice(0, 2)}
                    </span>
                    <span className="text-xs font-semibold text-white/70">{bm.name}</span>
                    <ExternalLink className="ml-auto h-3 w-3 text-white/15" />
                  </button>
                ))}
              </div>
            </div>

            {/* Indexing Tips */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-300">Indexing Tips</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-white/40">
                <li>• Submit URLs to Google via Search Console for fastest indexing</li>
                <li>• Use IndexNow for instant notification to Bing & Yandex</li>
                <li>• Create an RSS feed linking to your backlink pages</li>
                <li>• Social signals help search engines discover new links faster</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Other tabs - placeholder content */}
      {activeTab > 0 && (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16">
          {(() => { const Icon = tabIcons[activeTab]; return <Icon className="h-10 w-10 text-white/10" />; })()}
          <p className="mt-3 text-sm font-semibold text-white/30">{d.tabs[activeTab]}</p>
          <p className="text-xs text-white/20">This feature is coming soon</p>
        </div>
      )}
    </div>
  );
}

function IndexStat({ value, label, tone = "neutral" }) {
  return (
    <div className={`bi-stat bi-stat-${tone}`}>
      <div className="bi-stat-label">{label}</div>
      <div className="bi-stat-value">{value}</div>
    </div>
  );
}
