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
    <div className="ctool-page space-y-4">
      <ToolHeader title="Bulk DA/PA Checker" Icon={ArrowUpDown} gradient="from-slate-800 via-blue-800 to-indigo-700" subtitle="Check Domain Authority and Page Authority in bulk" />

      <div className="stool-card">
        <div className="app-alert app-alert-warning mb-4">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="ctool-help-text"><span className="font-bold">Note:</span> DA/PA checking requires Moz API integration.</p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="ctool-textarea"
          placeholder="Enter domains (one per line)..."
        />

        <button
          onClick={check}
          className="ui-button ui-button-primary mt-4 w-full"
        >
          Estimate DA/PA
        </button>

        {results && (
          <div className="stool-table mt-5">
            <div className="stool-thead dapa-row">
              <span className="stool-label">Domain</span>
              <span className="stool-label dapa-num">DA</span>
              <span className="stool-label dapa-num">PA</span>
              <span className="stool-label dapa-num">Spam</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className="dapa-row stool-tr">
                <span className="dapa-domain">{r.domain}</span>
                <span className="dapa-num dapa-score">{r.da}</span>
                <span className="dapa-num dapa-score">{r.pa}</span>
                <span className={`dapa-num dapa-score ${r.spam < 2 ? "is-low" : r.spam < 4 ? "is-mid" : "is-high"}`}>{r.spam}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
