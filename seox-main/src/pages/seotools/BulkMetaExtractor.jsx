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
    <div className="mx-auto max-w-[1100px] space-y-4">
      <ToolHeader title="Bulk Meta Extractor" Icon={Database} gradient="from-slate-800 via-violet-800 to-indigo-700" subtitle="Extract meta data from multiple URLs at once" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-4 py-3 mb-4">
          <p className="text-xs text-white/55"><span className="font-bold text-violet-300">Bulk Meta Extractor:</span> Enter URLs (one per line) and select what data to extract.</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
          <label className="text-[11px] font-bold text-white/60">Select fields to extract:</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {fields.map((f) => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected[f.key]}
                  onChange={() => setSelected({ ...selected, [f.key]: !selected[f.key] })}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-violet-500"
                />
                <span className="text-xs text-white/60">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-violet-500/30 resize-none"
          placeholder={"Enter URLs (one per line)...\nexample.com\nhttps://another-site.com/page"}
        />

        <button
          onClick={extract}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:shadow-violet-600/30"
        >
          <Database className="h-4 w-4" /> {loading ? "Extracting..." : "Extract Meta Data"}
        </button>
      </div>

      {results && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">URL</th>
                  {selected.title && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Title</th>}
                  {selected.desc && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Description</th>}
                  {selected.canonical && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Canonical</th>}
                  {selected.robots && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Robots</th>}
                  {selected.keywords && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Keywords</th>}
                  {selected.wordCount && <th className="text-[10px] font-bold uppercase tracking-wider text-white/30 text-left px-4 py-2.5">Words</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={i < results.length - 1 ? "border-b border-white/[0.03]" : ""}>
                    <td className="px-4 py-3 text-xs text-violet-300 font-mono truncate max-w-[200px]">{r.url}</td>
                    {selected.title && <td className="px-4 py-3 text-xs text-white/70">{r.title}</td>}
                    {selected.desc && <td className="px-4 py-3 text-xs text-white/45 truncate max-w-[300px]">{r.desc}</td>}
                    {selected.canonical && <td className="px-4 py-3 text-xs text-white/45 truncate max-w-[220px]">{r.canonical}</td>}
                    {selected.robots && <td className="px-4 py-3 text-xs text-cyan-300">{r.robots}</td>}
                    {selected.keywords && <td className="px-4 py-3 text-xs text-white/45 truncate max-w-[220px]">{r.keywords}</td>}
                    {selected.wordCount && <td className="px-4 py-3 text-xs text-white/60 font-mono">{r.wordCount}</td>}
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
