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
    <div className="expired-domain-finder mx-auto max-w-[1100px] space-y-4">

      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1117]">
        <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-emerald-500/[0.04] blur-[100px]" />
        <div className="relative z-10 flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <Globe className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-black text-white">EDF - Expired Domain Finder</h1>
                <HelpCircle className="h-3.5 w-3.5 text-white/20 cursor-help" />
              </div>
              <p className="text-[13px] text-white/40">Bulk check domain availability using RDAP protocol</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400/60">
                <Zap className="h-2.5 w-2.5" /> Desktop App available — 10x faster · 90,000+ domains · No rate limiting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400">
              <Monitor className="h-3.5 w-3.5" /> Windows
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.02] px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/[0.05]">
              <Apple className="h-3.5 w-3.5" /> Mac
            </button>
          </div>
        </div>
      </div>

      {/* ─── Step Indicator ─── */}
      <div className="flex items-center gap-3 px-1">
        <StepDot num="1" label="Enter Domains" active={domainCount === 0 && results.length === 0} done={domainCount > 0} />
        <div className="h-px flex-1 bg-white/[0.06]" />
        <StepDot num="2" label="Check Availability" active={domainCount > 0 && results.length === 0} done={results.length > 0} />
        <div className="h-px flex-1 bg-white/[0.06]" />
        <StepDot num="3" label="Export Results" active={results.length > 0} done={false} />
      </div>

      {/* ─── Workspace Card ─── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]">

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-white/80">Domain List</span>
              {domainCount > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {domainCount}
                </span>
              )}
            </div>
            <div className="h-4 w-px bg-white/[0.06]" />
            <button className="expired-toolbar-action flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition">
              <Upload className="h-3 w-3" /> Upload CSV
            </button>
            <button className="expired-toolbar-action flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition">
              <ClipboardPaste className="h-3 w-3" /> Paste List
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDomains("")}
              disabled={domainCount === 0}
              className="expired-clear-button flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-white/40 hover:text-white/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
            <button
              onClick={handleCheck}
              disabled={domainCount === 0 || checking}
              className="expired-start-button flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-md shadow-emerald-500/15 transition hover:bg-emerald-400 disabled:cursor-not-allowed"
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
        <div className="grid lg:grid-cols-2">
          {/* Left — Input */}
          <div className="border-r border-white/[0.06] p-4">
          <textarea
            value={domains}
              onChange={(e) => {
                setDomains(e.target.value);
                setRemovedCount(0);
              }}
              rows={14}
              className="w-full rounded-xl border border-white/[0.06] bg-[#010409] px-4 py-3 font-mono text-[13px] leading-relaxed text-white/60 placeholder:text-white/15 focus:outline-none focus:border-emerald-500/25 resize-none transition"
              placeholder={`Enter domains (one per line, or comma/space separated)\n\nexample.com\nmydomain.net\ntest.org\ncoolstartup.io`}
            />
            {domainCount === 0 && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] py-3">
                <Upload className="h-4 w-4 text-white/15" />
                <span className="text-[11px] text-white/20">Drag & drop a .txt or .csv file here</span>
              </div>
            )}
            {removedCount > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
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
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{available} available</span>
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">{taken} taken</span>
                  <button className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/40 hover:text-white/60 transition">
                    <Download className="h-3 w-3" /> Export
                  </button>
                </div>
              )}
            </div>

            {/* Results area */}
            <div className="min-h-[350px] rounded-xl border border-white/[0.06] bg-[#010409] overflow-hidden">
              {checking ? (
                <div className="flex h-full min-h-[350px] flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-white/[0.06]" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-white/30">Checking {domainCount} domains...</p>
                  <p className="text-[10px] text-white/15">Using RDAP protocol for accurate results</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex h-full min-h-[350px] flex-col items-center justify-center gap-2 px-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/[0.08]">
                    <Globe className="h-6 w-6 text-white/[0.07]" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-white/25">No results yet</p>
                  <p className="text-[11px] text-white/12 text-center max-w-[200px]">Enter domains on the left and click "Start Checking" to begin</p>
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
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117]">
        <button
          onClick={() => setTipsOpen(!tipsOpen)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="font-display text-sm font-bold text-white/80">Tips for Best Results</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-white/20 transition-transform ${tipsOpen ? "rotate-180" : ""}`} />
        </button>
        {tipsOpen && (
          <div className="grid gap-3 px-5 pb-5 md:grid-cols-3">
            {d.tips.map((tip, i) => (
              <div key={i} className="rounded-xl border border-white/[0.05] bg-[#161b22]/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#0d1117] ring-1 ring-white/[0.04]">
                    {tip.icon === "refresh" && <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />}
                    {tip.icon === "globe" && <Globe className="h-3.5 w-3.5 text-emerald-400" />}
                    {tip.icon === "alert" && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                  </span>
                  <div>
                    <span className="text-[13px] font-bold text-white/80">{tip.title}</span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-white/30">{tip.desc}</p>
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
