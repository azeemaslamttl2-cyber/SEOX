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
    <div className="space-y-4">
      <ToolHeader title="Ultimate URL Editor" Icon={Link2} gradient="from-slate-800 via-cyan-800 to-cyan-700" subtitle="Clean, trim, and manipulate URLs in bulk" />

      <div className="stool-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="ctool-textarea"
          placeholder="Enter URLs (one per line)..."
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {ops.map((op) => (
            <button
              key={op.key}
              onClick={() => apply(op.key)}
              className="ui-button stool-action"
            >
              {op.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="ui-button ctool-tool-btn"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={() => setText("")}
            className="ui-button stool-danger stool-danger-sm text-rose-300 hover:bg-rose-500/[0.08] transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
