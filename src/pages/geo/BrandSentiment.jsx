import { useState } from "react";
import {
  HeartPulse,
  Globe,
  Search,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
} from "lucide-react";

const sentimentData = {
  url: "https://learnwirepro.com",
  brand: "learnwirepro",
  analyzedAt: "3/28/2026, 8:06:25 AM",
  platforms: [
    { name: "ChatGPT", visibility: "Medium", sentiment: "Neutral", trust: "Medium", authority: "Medium", recommendation: "Soft", visColor: "amber", sentColor: "slate", trustColor: "amber", authColor: "amber", recColor: "emerald" },
    { name: "Gemini", visibility: "Medium", sentiment: "Positive", trust: "Medium", authority: "Medium", recommendation: "Soft", visColor: "amber", sentColor: "emerald", trustColor: "amber", authColor: "amber", recColor: "emerald" },
    { name: "Claude", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Unknown", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "slate", recColor: "slate" },
    { name: "Perplexity", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Weak", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "amber", recColor: "slate" },
    { name: "Grok", visibility: "Low", sentiment: "Neutral", trust: "Unknown", authority: "Weak", recommendation: "None", visColor: "rose", sentColor: "slate", trustColor: "slate", authColor: "amber", recColor: "slate" },
  ],
  recommendations: [
    "Prioritize Gathering Customer Reviews: Actively solicit reviews from users who have engaged with LearnWirePro's content or services. Focus on platforms like Trustpilot, Google Reviews, and industry-specific review sites to build trust and provide social proof.",
    "Create In-Depth Case Studies: Develop detailed case studies showcasing how specific AI tools reviewed on your site have helped users. This demonstrates expertise and builds authority.",
    "Increase Cross-Platform Presence: Actively engage on platforms where AI models source information — publish consistent content across Medium, LinkedIn, and Reddit.",
    "Build Authoritative Backlinks: Focus on earning backlinks from established tech review sites, AI research blogs, and industry publications to improve domain authority.",
    "Optimize for AI Model Citation: Structure your content with clear headings, FAQs, and schema markup so AI models can easily extract and cite your reviews.",
  ],
};

/* Score badges: the tone is data (good / mixed / poor / unknown), but the
   dark-theme values were unreadable on a light table. */
const colorMap = {
  emerald: "app-badge app-badge-success",
  amber: "app-badge app-badge-warning",
  rose: "app-badge app-badge-danger",
  slate: "app-badge app-badge-neutral",
};

function Badge({ label, color }) {
  return <span className={colorMap[color]}>{label}</span>;
}

export default function BrandSentiment() {
  const [url, setUrl] = useState(sentimentData.url);
  const [hasResult, setHasResult] = useState(true);

  return (
    <div className="ctool-page space-y-5">

      {/* Hero */}
      <div className="ctool-hero geo-hero">
        <div className="geo-hero-body">
          <div className="flex items-center gap-3">
            <div className="ctool-hero-icon">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="ctool-title font-display">Brand Sentiment Analysis</h1>
              <p className="ctool-help-text">Analyze your brand's sentiment across all major AI platforms (ChatGPT, Gemini, Claude, Perplexity, Grok)</p>
            </div>
          </div>

          <div className="geo-well mt-6">
            <p className="ctool-help-text">Project or Website URL</p>
            {hasResult && <p className="ctool-help-text mt-0.5">Last analyzed: {sentimentData.analyzedAt}</p>}
            <div className="mt-3 flex items-center gap-2">
              <div className="ctool-field flex-1">
                <Globe className="h-4 w-4" />
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  className="stool-bare-input flex-1"
                  placeholder="https://example.com"
                />
              </div>
              <button className="ui-button ui-button-primary">
                <Search className="h-4 w-4" /> Analyze Brand Sentiment
              </button>
            </div>
            <p className="ctool-help-text mt-2">No saved projects found. Enter a website URL to analyze brand sentiment directly.</p>
          </div>
        </div>
      </div>

      {hasResult && (
        <>
          {/* Results Table */}
          <div className="ctool-card">
            <div className="mb-1">
              <h2 className="geo-section-title font-display">
                Sentiment Analysis Results for <span className="ctool-accent">{sentimentData.brand}</span>
              </h2>
              <p className="ctool-help-text flex items-center gap-1">
                <Clock className="h-3 w-3" /> Analyzed on {sentimentData.analyzedAt}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="geo-tr-head">
                    <th className="stool-label pb-3 text-left">Platform</th>
                    <th className="stool-label pb-3 text-center">Visibility</th>
                    <th className="stool-label pb-3 text-center">Sentiment</th>
                    <th className="stool-label pb-3 text-center">Trust</th>
                    <th className="stool-label pb-3 text-center">Authority</th>
                    <th className="stool-label pb-3 text-center">Recommendation</th>
                    <th className="stool-label pb-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sentimentData.platforms.map((p, i) => (
                    <tr key={i} className="geo-tr">
                      <td className="geo-td-name">{p.name}</td>
                      <td className="py-3 text-center"><Badge label={p.visibility} color={p.visColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.sentiment} color={p.sentColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.trust} color={p.trustColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.authority} color={p.authColor} /></td>
                      <td className="py-3 text-center"><Badge label={p.recommendation} color={p.recColor} /></td>
                      <td className="py-3 text-center">
                        <button className="schema-addlink">
                          View Details <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          <div className="ctool-card">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 ctool-accent" />
              <h2 className="geo-section-title font-display">Step-by-Step Improvement Recommendations</h2>
            </div>
            <p className="ctool-help-text mb-4">Actionable steps to improve your brand's sentiment, visibility, trust, and authority.</p>

            <div className="space-y-3">
              {sentimentData.recommendations.map((rec, i) => (
                <div key={i} className="geo-rec">
                  <span className="geo-rec-num">
                    {i + 1}
                  </span>
                  <p className="geo-rec-text">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
