import { useState } from "react";
import {
  Globe,
  Search,
  Trash2,
  Play,
  RefreshCw,
  AlertTriangle,
  Monitor,
  Apple,
  Zap,
  HelpCircle,
  Upload,
  ClipboardPaste,
  Download,
  CheckCircle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { expiredDomainData } from "../../data/offPageData.js";
import { checkExpiredDomains } from "../../lib/expiredDomainChecker.js";

export default function ExpiredDomainFinder() {
  const d = expiredDomainData;
  const [domains, setDomains] = useState("");
  const [results, setResults] = useState([]);
  const [checking, setChecking] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [removedCount, setRemovedCount] = useState(0);

  const domainList = domains.split(/[\n, ]+/).filter((d) => d.trim());
  const domainCount = domainList.length;

  function handleCheck() {
    if (domainCount === 0) return;
    const checked = checkExpiredDomains(domains);
    setRemovedCount(checked.rejected.length);
    setDomains(checked.normalized.join("\n"));

    if (!checked.normalized.length) {
      setResults([]);
      return;
    }

    setChecking(true);
    setTimeout(() => {
      setResults(checked.results);
      setChecking(false);
    }, 1500);
  }

  const available = results.filter((r) => r.available).length;
  const taken = results.filter((r) => !r.available).length;

  return (
    <div className="expired-domain-finder space-y-4">

      {/* ─── Hero ─── */}
      <div className="edf-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="edf-tile">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="edf-title font-display">EDF - Expired Domain Finder</h1>
                <HelpCircle className="h-3.5 w-3.5 text-white/20 cursor-help" />
              </div>
              <p className="edf-description">Bulk check domain availability using RDAP protocol</p>
              <p className="edf-promo">
                <Zap className="h-2.5 w-2.5" /> Desktop App available — 10x faster · 90,000+ domains · No rate limiting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="ui-button edf-platform-button">
              <Monitor className="h-3.5 w-3.5" /> Windows
            </button>
            <button className="ui-button edf-platform-button">
              <Apple className="h-3.5 w-3.5" /> Mac
            </button>
          </div>
        </div>
      </div>

      {/* ─── Step Indicator ─── */}
      <div className="edf-steps">
        <StepDot num="1" label="Enter Domains" active={domainCount === 0 && results.length === 0} done={domainCount > 0} />
        <div className="h-px flex-1 bg-white/[0.06]" />
        <StepDot num="2" label="Check Availability" active={domainCount > 0 && results.length === 0} done={results.length > 0} />
        <div className="h-px flex-1 bg-white/[0.06]" />
        <StepDot num="3" label="Export Results" active={results.length > 0} done={false} />
      </div>

      {/* ─── Workspace Card ─── */}
      <div className="edf-workspace">

        {/* Toolbar */}
        <div className="edf-toolbar">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe className="edf-toolbar-icon h-4 w-4" />
              <span className="edf-toolbar-title">Domain List</span>
              {domainCount > 0 && (
                <span className="admin-badge badge-professional">
                  {domainCount}
                </span>
              )}
            </div>
            <div className="h-4 w-px bg-white/[0.06]" />
            <button className="edf-toolbar-action">
              <Upload className="h-3 w-3" /> Upload CSV
            </button>
            <button className="edf-toolbar-action">
              <ClipboardPaste className="h-3 w-3" /> Paste List
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDomains("")}
              disabled={domainCount === 0}
              className="ui-button edf-clear-button"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
            <button
              onClick={handleCheck}
              disabled={domainCount === 0 || checking}
              className="ui-button ui-button-primary edf-start-button"
            >
              {checking ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Checking...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-white" /> Start Checking
                </>
              )}
            </button>
          </div>
        </div>

        {/* Split Pane */}
        <div className="edf-split">
          {/* Left — Input */}
          <div className="edf-pane edf-pane-left">
          <textarea
            value={domains}
              onChange={(e) => {
                setDomains(e.target.value);
                setRemovedCount(0);
              }}
              rows={14}
              className="edf-textarea"
              placeholder={`Enter domains (one per line, or comma/space separated)\n\nexample.com\nmydomain.net\ntest.org\ncoolstartup.io`}
            />
            {domainCount === 0 && (
              <div className="edf-dropzone">
                <Upload className="h-4 w-4" />
                <span>Drag &amp; drop a .txt or .csv file here</span>
              </div>
            )}
            {removedCount > 0 && (
              <div className="app-alert app-alert-warning mt-3">
                Removed {removedCount} domain{removedCount === 1 ? "" : "s"} that could not be checked.
              </div>
            )}
          </div>

          {/* Right — Results */}
          <div className="p-4">
            {/* Result header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-bold text-white/80">Results</span>
              </div>
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="admin-badge badge-professional">{available} available</span>
                  <span className="admin-badge badge-error">{taken} taken</span>
                  <button className="ui-button edf-export-button">
                    <Download className="h-3 w-3" /> Export
                  </button>
                </div>
              )}
            </div>

            {/* Results area */}
            <div className="edf-results">
              {checking ? (
                <div className="flex h-full min-h-[350px] flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-white/[0.06]" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  </div>
                  <p className="edf-empty-title">Checking {domainCount} domains…</p>
                  <p className="edf-empty-body">Using RDAP protocol for accurate results</p>
                </div>
              ) : results.length === 0 ? (
                <div className="app-empty-state edf-empty">
                  <span className="edf-empty-icon">
                    <Globe className="h-5 w-5" />
                  </span>
                  <p className="edf-empty-title">No results yet</p>
                  <p className="edf-empty-body">Enter domains on the left, then click &ldquo;Start Checking&rdquo;.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {results.map((r, i) => (
                    <div key={i} className="group flex items-center justify-between px-4 py-2.5 transition hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                          r.available ? "bg-emerald-500/15" : "bg-white/[0.04]"
                        }`}>
                          {r.available ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-white/20" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-white/70 truncate block">{r.domain}</span>
                          <span className="text-[10px] text-white/20">.{r.tld}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.available
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/[0.04] text-white/30"
                        }`}>
                          {r.available ? "Available" : "Taken"}
                        </span>
                        {r.available && (
                          <button className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300 opacity-0 group-hover:opacity-100 transition hover:bg-emerald-500/20">
                            Register →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tips (Collapsible) ─── */}
      <div className="edf-tips">
        <button
          onClick={() => setTipsOpen(!tipsOpen)}
          className="edf-tips-header"
        >
          <div className="flex items-center gap-2.5">
            <Zap className="edf-tips-icon h-4 w-4" />
            <span className="edf-tips-title font-display">Tips for Best Results</span>
          </div>
          <ChevronDown className={`edf-tips-chevron h-4 w-4 transition-transform ${tipsOpen ? "rotate-180" : ""}`} />
        </button>
        {tipsOpen && (
          <div className="edf-tips-grid">
            {d.tips.map((tip, i) => (
              <div key={i} className="edf-tip-card">
                <div className="flex items-start gap-3">
                  <span className="edf-tip-icon">
                    {tip.icon === "refresh" && <RefreshCw className="h-3.5 w-3.5" />}
                    {tip.icon === "globe" && <Globe className="h-3.5 w-3.5" />}
                    {tip.icon === "alert" && <AlertTriangle className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <span className="edf-tip-title">{tip.title}</span>
                    <p className="edf-tip-desc">{tip.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ num, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
        done
          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
          : active
          ? "bg-white/[0.08] text-white/70 ring-1 ring-white/[0.15]"
          : "bg-white/[0.03] text-white/20"
      }`}>
        {done ? "✓" : num}
      </div>
      <span className={`text-[11px] font-medium transition-all ${
        done ? "text-emerald-300/60" : active ? "text-white/60" : "text-white/20"
      }`}>{label}</span>
    </div>
  );
}
