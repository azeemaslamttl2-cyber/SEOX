import { useState } from "react";
import { FileCode, Globe } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

export default function XmlSitemapExtractor() {
  const [url, setUrl] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function extract() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const sitemapUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(sitemapUrl)}`);
      const xml = await response.text();
      const found = Array.from(xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi), (match) => match[1].trim());
      setResults([...new Set(found)]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ToolHeader title="XML Sitemap Extractor" Icon={FileCode} gradient="from-slate-800 via-teal-800 to-cyan-700" subtitle="Extract all URLs from a sitemap.xml file" />

      <div className="stool-card">
        <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] px-4 py-3 mb-4">
          <span className="ctool-help-text"><span className="font-bold text-teal-300">XML Sitemap URL Extractor:</span> Enter a sitemap.xml URL to extract all URLs from it.</span>
        </div>

        <div className="flex gap-2">
          <div className="ctool-field flex-1">
            <Globe className="h-4 w-4" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && extract()}
              className="stool-bare-input flex-1"
              placeholder="Enter sitemap URL (e.g., example.com/sitemap.xml)"
            />
          </div>
          <button
            onClick={extract}
            className="ui-button ui-button-primary"
          >
            <FileCode className="h-4 w-4" /> {loading ? "Extracting..." : "Extract URLs"}
          </button>
        </div>
      </div>

      {results && (
        <div className="stool-card">
          <h3 className="stool-title mb-3">Extracted URLs ({results.length})</h3>
          <div className="space-y-1">
            {results.map((u, i) => (
              <div key={i} className="stool-code stool-code-click">{u}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
