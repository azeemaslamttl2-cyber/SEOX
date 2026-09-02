import { useState } from "react";
import {
  Quote,
  Search,
  Globe,
  Clock,
  MapPin,
  ExternalLink,
  Hash,
  Layers,
  Target,
  Award,
} from "lucide-react";

const mockCitation = {
  keyword: "learnwirepro.com",
  analyzedAt: "3/28/2026, 8:08 AM",
  country: "United States",
  metrics: [
    { label: "Overall Citations", value: "21", sub: "Total Results", icon: Hash },
    { label: "Domain Diversity", value: "6", sub: "Unique Domains", icon: Layers },
    { label: "Cross-Platform", value: "17%", sub: "Platform Overlap", icon: Target },
    { label: "Citation Quality", value: "29%", sub: "Diversity Score", icon: Award },
  ],
  platforms: [
    {
      name: "OpenAI", color: "bg-emerald-500", count: 4,
      results: [
        { title: "Learn Wire Pro – Home", desc: "Official website of Learn Wire Pro, offering courses and...", url: "learnwirepro.com", rank: "#1" },
        { title: "Learn Wire Pro – Course Library", desc: "Browse comprehensive AI and tech learning modules...", url: "learnwirepro.com/courses", rank: "#2" },
      ],
    },
    {
      name: "Gemini", color: "bg-blue-500", count: 4,
      results: [
        { title: "LearnWire Pro – LearnWire", desc: "LearnWire Pro provides tutorials, tools and resources...", url: "learnwirepro.com", rank: "#1" },
        { title: "LearnWire Pro | Facebook", desc: "LearnWire Pro community page on Facebook with reviews...", url: "facebook.com/learnwirepro", rank: "#3" },
      ],
    },
    {
      name: "Claude", color: "bg-amber-500", count: 3,
      results: [
        { title: "LearnWirePro – Professional Wire...", desc: "Official website offering comprehensive online course...", url: "learnwirepro.com", rank: "#1" },
      ],
    },
    {
      name: "Perplexity", color: "bg-violet-500", count: 10,
      results: [
        { title: "Learnwire", desc: "Get in-depth software reviews of LearnWire to boost your SE...", url: "learnwirepro.com", rank: "#1" },
        { title: "Explore LearnWire's Software Reviews", desc: "Comprehensive reviews of AI-powered software...", url: "learnwirepro.com/reviews", rank: "#2" },
      ],
    },
    {
      name: "Grok", color: "bg-rose-500", count: 0,
      results: [],
    },
  ],
  searchHistory: [
    { url: "https://learnwirepro.com", date: "3/28/2026, 8:08 AM" },
  ],
};

export default function AiCitationFlow() {
  const [keyword, setKeyword] = useState(mockCitation.keyword);
  const [country, setCountry] = useState(mockCitation.country);
  const [hasResult, setHasResult] = useState(true);

  return (
    <div className="ctool-page space-y-5">

      {/* Hero */}
      <div className="ctool-hero geo-hero">
        <div className="geo-hero-body">
          <div className="flex items-center gap-3">
            <div className="ctool-hero-icon">
              <Quote className="h-5 w-5" />
            </div>
            <div>
              <h1 className="ctool-title font-display">AI Citation Flow</h1>
              <p className="ctool-help-text">Track how your content ranks across multiple search perspectives</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Card + Search History Side */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="ctool-card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4 ctool-accent" />
              <h2 className="stool-title">Keyword Citation Analysis</h2>
            </div>
            {hasResult && <span className="ctool-help-text flex items-center gap-1"><Clock className="h-3 w-3" /> Last analyzed: {mockCitation.analyzedAt}</span>}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="ctool-field flex-1">
              <Globe className="h-4 w-4" />
              <input
                value={keyword} onChange={(e) => setKeyword(e.target.value)}
                className="stool-bare-input flex-1"
                placeholder="Enter keyword to analyze citation flow (e.g., artificial intelligence, machine learning)"
              />
            </div>
            <button className="ui-button ui-button-primary">
              <Search className="h-4 w-4" /> Search Citation Flow
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5 ctool-help-text">
              <MapPin className="h-3 w-3" /> Location for ChatGPT Results (Optional)
            </div>
            <select
              value={country} onChange={(e) => setCountry(e.target.value)}
              className="schema-input schema-input-lg mt-1"
            >
              <option value="">Select a country (default: global results)</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
            </select>
            <p className="mt-1 ctool-help-text">Choose a specific country to get location-based ChatGPT search results</p>
          </div>
        </div>

        {/* Search History Sidebar */}
        <div className="ctool-card geo-side">
          <div className="stool-label flex items-center gap-1.5 mb-3">
            <Clock className="h-3.5 w-3.5" /> Search history
          </div>
          {mockCitation.searchHistory.length > 0 ? (
            <div className="space-y-2">
              {mockCitation.searchHistory.map((h, i) => (
                <div key={i} className="geo-history-item">
                  <div className="geo-history-url truncate">{h.url}</div>
                  <div className="ctool-help-text">{h.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="ctool-help-text">No search history yet. Run a search to see past runs here.</p>
          )}
        </div>
      </div>

      {hasResult && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {mockCitation.metrics.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="geo-metric">
                  <div className="flex items-center gap-3">
                    <span className="ctool-hero-icon geo-metric-icon">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="geo-metric-value">{m.value}</div>
                      <div className="ctool-help-text">{m.sub}</div>
                    </div>
                  </div>
                  <div className="geo-metric-label">{m.label}</div>
                </div>
              );
            })}
          </div>

          {/* Search Results Comparison */}
          <div className="ctool-card">
            <h2 className="geo-section-title font-display mb-4">Search Results Comparison</h2>
            <div className="grid gap-4 lg:grid-cols-5">
              {mockCitation.platforms.map((plat, i) => (
                <div key={i} className="geo-panel">
                  {/* Platform header */}
                  <div className="geo-plat-head">
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${plat.color}`} />
                      <span className="geo-plat-name">{plat.name}</span>
                    </div>
                    <span className="geo-plat-count">{plat.count} Results</span>
                  </div>
                  {/* Results */}
                  <div className="p-2 space-y-2">
                    {plat.results.length > 0 ? plat.results.map((r, ri) => (
                      <div key={ri} className="geo-result">
                        <div className="geo-result-title line-clamp-2">{r.title}</div>
                        <p className="geo-result-desc line-clamp-2">{r.desc}</p>
                        <div className="geo-result-url mt-1.5 flex items-center gap-1">
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span className="truncate">{r.url}</span>
                          <span className="geo-result-rank ml-auto">{r.rank}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="py-4 text-center ctool-help-text">No results</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
