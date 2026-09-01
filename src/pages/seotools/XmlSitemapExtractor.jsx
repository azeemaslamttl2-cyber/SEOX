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

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] px-4 py-3 mb-4">
          <span className="text-xs text-white/55"><span className="font-bold text-teal-300">XML Sitemap URL Extractor:</span> Enter a sitemap.xml URL to extract all URLs from it.</span>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3">
            <Globe className="h-4 w-4 text-white/20" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && extract()}
              className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/20 focus:outline-none"
              placeholder="Enter sitemap URL (e.g., example.com/sitemap.xml)"
            />
          </div>
          <button
            onClick={extract}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/20 transition hover:shadow-teal-600/30"
          >
            <FileCode className="h-4 w-4" /> {loading ? "Extracting..." : "Extract URLs"}
          </button>
        </div>
      </div>

      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
          <h3 className="text-sm font-bold text-white/80 mb-3">Extracted URLs ({results.length})</h3>
          <div className="space-y-1">
            {results.map((u, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-[#010409] px-3 py-2 text-xs text-teal-200 font-mono hover:bg-white/[0.02] cursor-pointer transition">{u}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
