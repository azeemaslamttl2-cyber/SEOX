import { useState } from "react";
import { Link2, Copy, Trash2 } from "lucide-react";
import ToolHeader from "../../components/seotools/ToolHeader.jsx";

const ops = [
  { key: "trim", label: "Trim to Root" },
  { key: "params", label: "Remove Params" },
  { key: "dupes", label: "Remove Duplicates" },
  { key: "serp", label: "Clean SERP" },
  { key: "hash", label: "Remove # URLs" },
  { key: "amp", label: "Remove & URLs" },
  { key: "tld", label: "Extract TLD" },
];

export default function UltimateUrlEditor() {
  const [text, setText] = useState("");

  function apply(op) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let out = lines;
    switch (op) {
      case "trim": out = lines.map((u) => { try { const x = new URL(u); return x.origin; } catch { return u; } }); break;
      case "params": out = lines.map((u) => u.split("?")[0]); break;
      case "dupes": out = [...new Set(lines)]; break;
      case "serp": out = lines.map((u) => u.replace(/[?&](utm_[^=]+|gclid|fbclid)=[^&]*/g, "")); break;
      case "hash": out = lines.filter((u) => !u.includes("#")); break;
      case "amp": out = lines.filter((u) => !u.includes("&")); break;
      case "tld": out = lines.map((u) => { try { return new URL(u).hostname.split(".").slice(-1)[0]; } catch { return u; } }); break;
      default: break;
    }
    setText(out.join("\n"));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ToolHeader title="Ultimate URL Editor" Icon={Link2} gradient="from-slate-800 via-cyan-800 to-cyan-700" subtitle="Clean, trim, and manipulate URLs in bulk" />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-white/[0.08] bg-[#010409] px-4 py-3 font-mono text-sm text-white/70 placeholder:text-white/15 focus:outline-none focus:border-cyan-500/30 resize-none"
          placeholder="Enter URLs (one per line)..."
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {ops.map((op) => (
            <button
              key={op.key}
              onClick={() => apply(op.key)}
              className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition hover:shadow-cyan-600/30"
            >
              {op.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/55 hover:text-white/80 transition"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={() => setText("")}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/[0.08] transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
