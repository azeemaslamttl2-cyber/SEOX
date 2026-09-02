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
    <div className="space-y-4">
      <ToolHeader title="Domain Separator" Icon={Globe} gradient="from-slate-800 via-sky-800 to-blue-700" subtitle="Extract unique root domains from a list of URLs" />

      <div className="stool-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="ctool-textarea"
          placeholder="Enter domains (one per line)..."
        />
        <div className="mt-4 flex gap-2">
          <button onClick={filter} className="ui-button ui-button-primary">
            <Filter className="h-4 w-4" /> Filter Domains
          </button>
          <button onClick={() => { setText(""); setResult(null); }} className="ui-button ctool-tool-btn">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-5">
          <h3 className="stool-title mb-3">Unique Domains ({result.length})</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {result.map((d, i) => (
              <div key={i} className="stool-code">{d}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
