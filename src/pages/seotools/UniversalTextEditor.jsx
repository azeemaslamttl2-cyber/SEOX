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

  const Step = ({ n, label }) => (
    <div className="stool-step">
      <span className="stool-step-num">{n}</span>
      <span className="stool-step-label">{label}</span>
    </div>
  );

  return (
    <div className="ctool-page space-y-4">
      <ToolHeader title="Universal Text Editor" Icon={Type} gradient="from-slate-800 via-violet-800 to-purple-700" subtitle="Powerful text transformations and cleanup" />

      <div className="stool-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="ctool-textarea"
          placeholder="Paste your text here..."
        />

        {/* Step 1: Cleanup */}
        <div className="mt-5">
          <Step n="1" label="Cleanup Operations" />
          <div className="flex flex-wrap gap-2">
            {[["dedupe", "Remove Duplicate Lines"], ["brackets", "Remove Brackets"], ["empty", "Remove Empty Lines"]].map(([k, l]) => (
              <button key={k} onClick={() => run(k)} className="ui-button stool-action">{l}</button>
            ))}
          </div>
        </div>

        {/* Step 2: Filter */}
        <div className="mt-5">
          <Step n="2" label="Filter Lines" />
          <div className="stool-inline-panel">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="stool-bare-input flex-1"
              placeholder="Enter keyword to filter..."
            />
            <button onClick={() => run("keep")} className="ui-button ui-button-primary stool-apply">
              Keep Lines Containing
            </button>
          </div>
        </div>

        {/* Step 3: Case */}
        <div className="mt-5">
          <Step n="3" label="Case Transformation" />
          <div className="flex flex-wrap gap-2">
            {[["upper", "UPPERCASE"], ["lower", "lowercase"], ["title", "Title Case"], ["single", "Single Line"]].map(([k, l]) => (
              <button key={k} onClick={() => run(k)} className="ui-button stool-action">{l}</button>
            ))}
          </div>
        </div>

        {/* Step 4: Add & Replace */}
        <div className="mt-5">
          <Step n="4" label="Add & Replace" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="stool-well">
              <label className="stool-label">Replace Newlines With</label>
              <div className="mt-1.5 flex gap-2">
                <input value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} className="schema-input flex-1" />
                <button onClick={() => run("replace")} className="ui-button ui-button-primary stool-apply">Apply</button>
              </div>
            </div>
            <div className="stool-well">
              <label className="stool-label">Add to Start of Lines</label>
              <div className="mt-1.5 flex gap-2">
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix..." className="schema-input flex-1" />
                <button onClick={() => run("prefix")} className="ui-button ui-button-primary stool-apply">Add</button>
              </div>
            </div>
            <div className="stool-well">
              <label className="stool-label">Add to End of Lines</label>
              <div className="mt-1.5 flex gap-2">
                <input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Suffix..." className="schema-input flex-1" />
                <button onClick={() => run("suffix")} className="ui-button ui-button-primary stool-apply">Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => navigator.clipboard.writeText(text)} className="ui-button ctool-tool-btn stool-footer-btn">
            <Copy className="h-4 w-4" /> Copy Text
          </button>
          <button onClick={() => setText("")} className="ui-button stool-danger">
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
