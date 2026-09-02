import { useState } from "react";
import {
  Swords,
  Globe,
  Search,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";

const platformColors = {
  /* One column per model, so the hue is data — but these were dark-theme
     values (text-*-300 on a 10% tint), unreadable on a light card. */
  OpenAI: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  Gemini: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  Claude: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  Perplexity: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500" },
  Grok: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

const mockCompetitors = {
  project: "https://learnwirepro.com",
  competitors: [
    "https://daveswift.com/",
    "https://www.andrewmurrayhq.com/",
  ],
  results: [
    {
      domain: "learnwirepro.com",
      platforms: [
        { name: "OpenAI", keywords: 8, top10: 3, visibility: "12%", avgPos: 4.2 },
        { name: "Gemini", keywords: 5, top10: 2, visibility: "8%", avgPos: 5.1 },
        { name: "Claude", keywords: 3, top10: 1, visibility: "5%", avgPos: 6.3 },
        { name: "Perplexity", keywords: 12, top10: 5, visibility: "18%", avgPos: 3.8 },
        { name: "Grok", keywords: 2, top10: 0, visibility: "2%", avgPos: 8.5 },
      ],
    },
    {
      domain: "daveswift.com",
      platforms: [
        { name: "OpenAI", keywords: 6, top10: 2, visibility: "9%", avgPos: 5.0 },
        { name: "Gemini", keywords: 4, top10: 1, visibility: "6%", avgPos: 5.8 },
        { name: "Claude", keywords: 2, top10: 0, visibility: "3%", avgPos: 7.1 },
        { name: "Perplexity", keywords: 8, top10: 3, visibility: "12%", avgPos: 4.5 },
        { name: "Grok", keywords: 1, top10: 0, visibility: "1%", avgPos: 9.0 },
      ],
    },
    {
      domain: "andrewmurrayhq.com",
      platforms: [
        { name: "OpenAI", keywords: 4, top10: 1, visibility: "6%", avgPos: 6.2 },
        { name: "Gemini", keywords: 3, top10: 1, visibility: "5%", avgPos: 6.0 },
        { name: "Claude", keywords: 1, top10: 0, visibility: "2%", avgPos: 8.0 },
        { name: "Perplexity", keywords: 6, top10: 2, visibility: "9%", avgPos: 5.2 },
        { name: "Grok", keywords: 1, top10: 0, visibility: "1%", avgPos: 9.5 },
      ],
    },
  ],
};

export default function CompetitorResearch() {
  const [projectUrl, setProjectUrl] = useState(mockCompetitors.project);
  const [competitors, setCompetitors] = useState(mockCompetitors.competitors);
  const [hasResult, setHasResult] = useState(true);

  const addCompetitor = () => {
    if (competitors.length < 5) setCompetitors([...competitors, ""]);
  };
  const removeCompetitor = (idx) => {
    setCompetitors(competitors.filter((_, i) => i !== idx));
  };
  const updateCompetitor = (idx, val) => {
    const updated = [...competitors];
    updated[idx] = val;
    setCompetitors(updated);
  };

  return (
    <div className="ctool-page space-y-5">

      {/* Hero */}
      <div className="ctool-hero geo-hero">
        <div className="geo-hero-body">
          <div className="flex items-center gap-3">
            <div className="ctool-hero-icon">
              <Swords className="h-5 w-5" />
            </div>
            <div>
              <h1 className="ctool-title font-display">Competitor Research</h1>
              <p className="ctool-help-text">Compare your project against competitors across AI platforms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project & Competitors Form */}
      <div className="ctool-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 ctool-accent" />
          <h2 className="stool-title">Project & Competitors</h2>
        </div>

        <div className="ctool-field mb-4">
          <Globe className="h-4 w-4" />
          <input
            value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)}
            className="stool-bare-input flex-1"
            placeholder="https://your-website.com"
          />
        </div>
        <p className="ctool-help-text mb-4">No saved projects found. Enter your website URL manually to compare it against competitors.</p>

        <div className="mb-4">
          <h3 className="stool-title">Competitor URLs</h3>
          <p className="ctool-help-text">Add up to 5 competitor websites to compare against your project.</p>
        </div>

        <div className="space-y-2 mb-4">
          {competitors.map((comp, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="ctool-field flex-1">
                <Globe className="h-4 w-4" />
                <input
                  value={comp} onChange={(e) => updateCompetitor(i, e.target.value)}
                  className="stool-bare-input flex-1"
                  placeholder="https://competitor.com"
                />
              </div>
              <button onClick={() => removeCompetitor(i)} className="ui-button schema-remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addCompetitor} className="schema-addlink">
            <Plus className="h-3.5 w-3.5" /> Add another competitor
          </button>
          <button className="ui-button ui-button-primary">
            <Sparkles className="h-4 w-4" /> Analyze Competitors
          </button>
        </div>
      </div>

      {hasResult && (
        <div className="ctool-card">
          <h2 className="geo-section-title font-display mb-1">OpenAI vs Gemini vs Claude vs Perplexity vs Grok</h2>
          <p className="ctool-help-text mb-5">Comparison of AI platform visibility for each domain</p>

          <div className="space-y-6">
            {mockCompetitors.results.map((result, ri) => (
              <div key={ri}>
                <h3 className="geo-domain">{result.domain}</h3>
                <div className="geo-plat-grid">
                  {result.platforms.map((plat, pi) => {
                    const c = platformColors[plat.name];
                    return (
                      <div key={pi} className={`geo-plat-card ${c.border} ${c.bg}`}>
                        <div className={`geo-plat-title ${c.text}`}>{plat.name}</div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between ctool-help-text">
                            <span>Keywords:</span><span className="stool-strong">{plat.keywords}</span>
                          </div>
                          <div className="flex justify-between ctool-help-text">
                            <span>Top 10:</span><span className="stool-strong">{plat.top10}</span>
                          </div>
                          <div className="flex justify-between ctool-help-text">
                            <span>Visibility:</span><span className="stool-strong">{plat.visibility}</span>
                          </div>
                          <div className="flex justify-between ctool-help-text">
                            <span>Avg Pos:</span><span className="stool-strong">{plat.avgPos}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
