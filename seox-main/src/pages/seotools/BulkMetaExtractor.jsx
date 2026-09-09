import { useState } from "react";
import { Database } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";
import { fetchUrlContent, getPageTitle, extractMainContent } from "../../utils/fetchAndParse.js";

const fields = [
  { key: "title", label: "Title", default: true },
  { key: "desc", label: "Meta Description", default: true },
  { key: "canonical", label: "Canonical URL", default: true },
  { key: "robots", label: "Robots Tag", default: true },
  { key: "keywords", label: "Meta Keywords", default: false },
  { key: "wordCount", label: "Word Count", default: true },
];

export default function BulkMetaExtractor() {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(fields.reduce((a, f) => ({ ...a, [f.key]: f.default }), {}));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function extract() {
    const urls = text.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setLoading(true);
    const rows = await Promise.all(urls.map(async (raw) => {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const html = await fetchUrlContent(url);
        const meta = (name) =>
          html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ||
          html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"))?.[1] ||
          "";
        return {
          url,
          title: getPageTitle(html),
          desc: meta("description"),
          canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || "",
          robots: meta("robots") || "index, follow",
          keywords: meta("keywords"),
          wordCount: extractMainContent(html).split(/\s+/).filter(Boolean).length,
        };
      } catch (error) {
        return { url, title: "Fetch failed", desc: error.message, canonical: "", robots: "", keywords: "", wordCount: 0 };
      }
    }));
    setResults(rows);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <ToolHeader title="Bulk Meta Extractor" Icon={Database} gradient="from-slate-800 via-violet-800 to-indigo-700" subtitle="Extract meta data from multiple URLs at once" />

      <div className="stool-card">
        <div className="stool-well mb-4">
          <p className="ctool-help-text"><span className="font-bold text-violet-300">Bulk Meta Extractor:</span> Enter URLs (one per line) and select what data to extract.</p>
        </div>

        <div className="stool-well mb-4">
          <label className="stool-strong">Select fields to extract:</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected[f.key]}
                  onChange={() => setSelected({ ...selected, [f.key]: !selected[f.key] })}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-violet-500"
                />
                <span className="ctool-help-text">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="ctool-textarea"
          placeholder={"Enter URLs (one per line)...\nexample.com\nhttps://another-site.com/page"}
        />

        <button
          onClick={extract}
          className="ui-button ui-button-primary mt-4 w-full"
        >
          <Database className="h-4 w-4" /> {loading ? "Extracting..." : "Extract Meta Data"}
        </button>
      </div>

      {results && (
        <div className="stool-card stool-card-flush">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="stool-thead">
                  <th className="stool-th">URL</th>
                  {selected.title && <th className="stool-th">Title</th>}
                  {selected.desc && <th className="stool-th">Description</th>}
                  {selected.canonical && <th className="stool-th">Canonical</th>}
                  {selected.robots && <th className="stool-th">Robots</th>}
                  {selected.keywords && <th className="stool-th">Keywords</th>}
                  {selected.wordCount && <th className="stool-th">Words</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={i < results.length - 1 ? "stool-tr" : ""}>
                    <td className="px-4 py-3 text-xs text-violet-300 font-mono truncate max-w-[200px]">{r.url}</td>
                    {selected.title && <td className="stool-td">{r.title}</td>}
                    {selected.desc && <td className="stool-td stool-td-muted truncate max-w-[300px]">{r.desc}</td>}
                    {selected.canonical && <td className="stool-td stool-td-muted truncate max-w-[220px]">{r.canonical}</td>}
                    {selected.robots && <td className="px-4 py-3 text-xs text-cyan-300">{r.robots}</td>}
                    {selected.keywords && <td className="stool-td stool-td-muted truncate max-w-[220px]">{r.keywords}</td>}
                    {selected.wordCount && <td className="stool-td font-mono">{r.wordCount}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
