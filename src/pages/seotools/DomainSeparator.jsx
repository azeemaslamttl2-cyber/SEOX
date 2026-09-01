import { useState } from "react";
import { Globe, Trash2, Filter } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

export default function DomainSeparator() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  function filter() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const domains = lines.map((l) => {
      try { return new URL(l.startsWith("http") ? l : "https://" + l).hostname.replace(/^www\./, ""); } catch { return l; }
    });
    setResult([...new Set(domains)]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ToolHeader title="Domain Separator" Icon={Globe} gradient="from-slate-800 via-sky-800 to-blue-700" subtitle="Extract unique root domains from a list of URLs" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-sky-500/30 resize-none"
          placeholder="Enter domains (one per line)..."
        />
        <div className="mt-4 flex gap-2">
          <button onClick={filter} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/20 transition hover:shadow-sky-600/30">
            <Filter className="h-4 w-4" /> Filter Domains
          </button>
          <button onClick={() => { setText(""); setResult(null); }} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/55 hover:text-white/80 transition">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-5">
          <h3 className="text-sm font-bold text-white/80 mb-3">Unique Domains ({result.length})</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {result.map((d, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-[#010409] px-3 py-2 text-xs text-sky-200 font-mono">{d}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
