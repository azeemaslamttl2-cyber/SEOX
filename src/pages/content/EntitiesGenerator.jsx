import { useState } from "react";
import { Sparkles, Upload, Trash2 } from "lucide-react";
import { entitiesGeneratorData } from "../../data/contentData.js";
import { generateEntitiesForKeywords } from "../../lib/contentTools.js";
import { generateEntityGroupsDeepSeek } from "../../lib/deepseekContent.js";

export default function EntitiesGenerator() {
  const d = entitiesGeneratorData;
  const [keywords, setKeywords] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!keywords.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(await generateEntityGroupsDeepSeek(keywords));
    } catch (err) {
      setResults(generateEntitiesForKeywords(keywords));
      setError(err.message || "DeepSeek could not generate entities. Showing local fallback results.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ctool-page space-y-6">
      <div className="ctool-hero">
        <div className="ctool-hero-row">
          <div className="ctool-hero-icon">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="ctool-title font-display">
              Entities Generator
            </h1>
            <p className="ctool-subtitle">
              Generate SEO entities for your keywords using AI-driven topic clustering and entity discovery.
            </p>
          </div>
        </div>
      </div>

      <div className="ctool-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="ctool-card-icon h-4 w-4" />
            <span className="ctool-card-title">Keywords</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="ui-button ctool-tool-btn">
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button
              onClick={() => setKeywords("")}
              className="ui-button ctool-tool-btn"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>

        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          rows={6}
          className="ctool-textarea"
          placeholder={"Enter keywords separated by comma or newline...\n\nexample:\nseo tools\nkeyword research\ncontent optimization"}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !keywords.trim()}
          className="ui-button ui-button-primary mt-4 w-full"
        >
          <Sparkles className="h-4 w-4" /> {loading ? "Generating..." : "Generate Entities"}
        </button>

        {error && (
          <p className="app-alert app-alert-warning mt-3">
            {error}
          </p>
        )}
      </div>

      <div className="ctool-note">
        <p className="text-xs leading-relaxed text-slate-600">
          <span className="ctool-note-lead">Entities Generator:</span> Enter keywords separated by comma or newline, or upload a text file. AI will generate related entities for each keyword that you should mention in your content for better SEO.
        </p>
      </div>

      {!results && (
        <div className="ctool-empty">
          <div className="ctool-empty-icon">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="ctool-empty-title">Generate related entities</h3>
          <p className="ctool-empty-text">
            Add a few keywords to uncover the entities worth targeting in your SEO content.
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {results.map((group, i) => (
            <div key={i} className="ctool-card">
              <h4 className="mb-3 ctool-card-title">
                <span className="ctool-group-keyword">"{group.keyword}"</span> — Related Entities
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.entities.map((entity, j) => (
                  <span
                    key={j}
                    className="ctool-chip"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
