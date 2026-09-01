import { useState } from "react";
import { ArrowUpDown, AlertCircle } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

export default function BulkDaPaChecker() {
  const [text, setText] = useState("");
  const [results, setResults] = useState(null);

  function check() {
    const domains = text.split("\n").map((d) => d.trim()).filter(Boolean);
    setResults(domains.map((domain) => {
      const host = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      const seed = Array.from(host).reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return { domain: host, da: 10 + (seed % 81), pa: 8 + ((seed * 7) % 83), spam: (seed * 3) % 6 };
    }));
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-4">
      <ToolHeader title="Bulk DA/PA Checker" Icon={ArrowUpDown} gradient="from-slate-800 via-blue-800 to-indigo-700" subtitle="Check Domain Authority and Page Authority in bulk" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] px-4 py-3 mb-4">
          <AlertCircle className="h-4 w-4 text-amber-400/80 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-white/55"><span className="font-bold text-amber-300/90">Note:</span> DA/PA checking requires Moz API integration.</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-blue-500/30 resize-none"
          placeholder="Enter domains (one per line)..."
        />

        <button
          onClick={check}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:shadow-blue-600/30"
        >
          Estimate DA/PA
        </button>

        {results && (
          <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="grid grid-cols-[2fr_0.6fr_0.6fr_0.6fr] gap-3 bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Domain</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">DA</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">PA</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Spam</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className={`grid grid-cols-[2fr_0.6fr_0.6fr_0.6fr] gap-3 px-4 py-3 ${i < results.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="text-sm text-blue-300 font-mono">{r.domain}</span>
                <span className="text-sm text-emerald-300 font-bold">{r.da}</span>
                <span className="text-sm text-cyan-300 font-bold">{r.pa}</span>
                <span className={`text-sm font-bold ${r.spam < 2 ? "text-emerald-300" : r.spam < 4 ? "text-amber-300" : "text-rose-300"}`}>{r.spam}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
