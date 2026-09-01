import { useState } from "react";
import { Type, Copy, Trash2 } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

export default function UniversalTextEditor() {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const [replaceWith, setReplaceWith] = useState(",");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");

  function run(op) {
    const lines = text.split("\n");
    let out = lines;
    switch (op) {
      case "dedupe": out = [...new Set(lines)]; break;
      case "brackets": out = lines.map((l) => l.replace(/[\[\](){}]/g, "")); break;
      case "empty": out = lines.filter((l) => l.trim()); break;
      case "keep": out = lines.filter((l) => l.includes(filter)); break;
      case "upper": out = lines.map((l) => l.toUpperCase()); break;
      case "lower": out = lines.map((l) => l.toLowerCase()); break;
      case "title": out = lines.map((l) => l.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())); break;
      case "single": setText(lines.join(" ")); return;
      case "replace": setText(text.replace(/\n/g, replaceWith)); return;
      case "prefix": out = lines.map((l) => prefix + l); break;
      case "suffix": out = lines.map((l) => l + suffix); break;
      default: break;
    }
    setText(out.join("\n"));
  }

  const Step = ({ n, label, color }) => (
    <div className="flex items-center gap-2 mb-2.5">
      <span className={`flex h-5 w-5 items-center justify-center rounded-md bg-${color}-500/15 text-[10px] font-bold text-${color}-300`}>{n}</span>
      <span className="text-xs font-bold text-white/70">{label}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ToolHeader title="Universal Text Editor" Icon={Type} gradient="from-slate-800 via-violet-800 to-purple-700" subtitle="Powerful text transformations and cleanup" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-violet-500/30 resize-none"
          placeholder="Paste your text here..."
        />

        {/* Step 1: Cleanup */}
        <div className="mt-5">
          <Step n="1" label="Cleanup Operations" color="violet" />
          <div className="flex flex-wrap gap-2">
            {[["dedupe", "Remove Duplicate Lines"], ["brackets", "Remove Brackets"], ["empty", "Remove Empty Lines"]].map(([k, l]) => (
              <button key={k} onClick={() => run(k)} className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/20 transition hover:shadow-violet-600/30">{l}</button>
            ))}
          </div>
        </div>

        {/* Step 2: Filter */}
        <div className="mt-5">
          <Step n="2" label="Filter Lines" color="indigo" />
          <div className="flex gap-2 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/15 p-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 rounded-lg bg-transparent px-3 py-2 text-sm text-white/60 placeholder:text-white/20 focus:outline-none"
              placeholder="Enter keyword to filter..."
            />
            <button onClick={() => run("keep")} className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs font-bold text-white hover:shadow-md hover:shadow-indigo-600/30 transition">
              Keep Lines Containing
            </button>
          </div>
        </div>

        {/* Step 3: Case */}
        <div className="mt-5">
          <Step n="3" label="Case Transformation" color="teal" />
          <div className="flex flex-wrap gap-2">
            {[["upper", "UPPERCASE"], ["lower", "lowercase"], ["title", "Title Case"], ["single", "Single Line"]].map(([k, l]) => (
              <button key={k} onClick={() => run(k)} className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 transition hover:shadow-teal-600/30">{l}</button>
            ))}
          </div>
        </div>

        {/* Step 4: Add & Replace */}
        <div className="mt-5">
          <Step n="4" label="Add & Replace" color="sky" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Replace Newlines With</label>
              <div className="mt-1.5 flex gap-2">
                <input value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} className="flex-1 rounded-md bg-[#010409] border border-white/[0.06] px-2 py-1.5 text-xs text-white/60 focus:outline-none" />
                <button onClick={() => run("replace")} className="rounded-md bg-gradient-to-r from-sky-600 to-blue-600 px-3 py-1.5 text-xs font-bold text-white">Apply</button>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">Add to Start of Lines</label>
              <div className="mt-1.5 flex gap-2">
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix..." className="flex-1 rounded-md bg-[#010409] border border-white/[0.06] px-2 py-1.5 text-xs text-white/60 placeholder:text-white/20 focus:outline-none" />
                <button onClick={() => run("prefix")} className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white">Add</button>
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-violet-300/80">Add to End of Lines</label>
              <div className="mt-1.5 flex gap-2">
                <input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Suffix..." className="flex-1 rounded-md bg-[#010409] border border-white/[0.06] px-2 py-1.5 text-xs text-white/60 placeholder:text-white/20 focus:outline-none" />
                <button onClick={() => run("suffix")} className="rounded-md bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white">Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => navigator.clipboard.writeText(text)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/60 hover:text-white/80 transition">
            <Copy className="h-4 w-4" /> Copy Text
          </button>
          <button onClick={() => setText("")} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-rose-700/20 transition hover:shadow-rose-700/30">
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
