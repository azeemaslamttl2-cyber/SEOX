import { useState } from "react";
import {
  ShieldCheck,
  Globe,
  FileText,
  Search,
  Download,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useSelectedProjectDomain } from "../../hooks/useSelectedProjectDomain.js";
import {
  csvEscape,
  downloadTextFile,
  extractPhrase,
  extractTitle,
  fetchPageHtml,
  normalizeForComparison,
  splitIntoSentences,
  stripHtml,
  wordCount,
} from "../../lib/techSeoTools.js";

function selectRepresentativePhrases(sentences, limit = 8) {
  if (sentences.length <= limit) return sentences.map((sentence) => extractPhrase(sentence));
  const step = Math.max(1, Math.floor(sentences.length / limit));
  const selected = [];
  for (let i = 0; i < sentences.length && selected.length < limit; i += step) {
    selected.push(extractPhrase(sentences[i]));
  }
  return selected;
}

function internalUniqueness(sentences) {
  const seen = new Map();
  const repeated = [];
  sentences.forEach((sentence) => {
    const key = normalizeForComparison(sentence);
    if (seen.has(key)) repeated.push(sentence);
    seen.set(key, true);
  });
  return Math.max(0, Math.round(((sentences.length - repeated.length) / Math.max(sentences.length, 1)) * 100));
}

async function searchPhrase(phrase) {
  const response = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "dataforseo",
      action: "plagiarism_serp_search",
      phrase,
      depth: 10,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || `SERP search failed: HTTP ${response.status}`);
  return payload.results || [];
}

export default function PlagiarismChecker() {
  const { projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const [mode, setMode] = useState("url");
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function getSource() {
    if (mode === "text") {
      return { sourceText: text, sourceTitle: "Pasted text", sourceUrl: "" };
    }
    if (!hasProject) throw new Error("Select a website in the nav before scanning a URL.");
    const page = await fetchPageHtml(projectUrl);
    return {
      sourceText: stripHtml(page.html),
      sourceTitle: extractTitle(page.html),
      sourceUrl: page.finalUrl || page.url || projectUrl,
    };
  }

  async function scan() {
    setLoading(true);
    setError("");
    setProgress("Loading source content...");
    try {
      const source = await getSource();
      const sentences = splitIntoSentences(source.sourceText);
      if (!sentences.length) throw new Error("Could not extract enough sentences. Try a longer page or paste more text.");
      const phrases = selectRepresentativePhrases(sentences, 8);
      const sourceDomain = source.sourceUrl ? new URL(source.sourceUrl).hostname.replace(/^www\./, "") : "";
      const matches = new Map();
      let serpWarning = "";

      setProgress(`Searching ${phrases.length} exact-match phrase(s)...`);
      for (let i = 0; i < phrases.length; i += 1) {
        setProgress(`Searching phrase ${i + 1} of ${phrases.length}...`);
        try {
          const items = await searchPhrase(phrases[i]);
          items.forEach((item) => {
            const itemDomain = String(item.domain || "").replace(/^www\./, "");
            if (sourceDomain && itemDomain === sourceDomain) return;
            const key = item.url;
            if (!key) return;
            const existing = matches.get(key) || {
              url: item.url,
              domain: item.domain,
              title: item.title,
              snippets: [],
              matchedPhrases: [],
              totalMatches: 0,
            };
            existing.totalMatches += 1;
            existing.snippets.push(item.snippet || "");
            existing.matchedPhrases.push(phrases[i]);
            matches.set(key, existing);
          });
        } catch (err) {
          serpWarning = err?.message || "DataForSEO search failed.";
          break;
        }
      }

      const webMatches = Array.from(matches.values())
        .map((match) => {
          const uniquePhrases = [...new Set(match.matchedPhrases)];
          return {
            ...match,
            matchedPhrases: uniquePhrases,
            matchScore: Math.round((uniquePhrases.length / phrases.length) * 100),
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore || b.totalMatches - a.totalMatches);
      const maxMatchScore = webMatches[0]?.matchScore || 0;
      const uniqueScore = Math.max(0, Math.min(100, 100 - maxMatchScore));

      setResult({
        sourceTitle: source.sourceTitle,
        sourceUrl: source.sourceUrl,
        totalWordsChecked: wordCount(source.sourceText),
        totalPhrases: phrases.length,
        phrasesWithMatches: new Set(webMatches.flatMap((match) => match.matchedPhrases)).size,
        matches: webMatches,
        uniqueScore,
        internalUniqueScore: internalUniqueness(sentences),
        warning: serpWarning,
      });
      setProgress("");
    } catch (err) {
      setError(err?.message || "Could not run plagiarism scan.");
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const rows = [
      ["Plagiarism Report", result.sourceTitle],
      ["Source URL", result.sourceUrl],
      ["Words checked", result.totalWordsChecked],
      ["Unique score", `${result.uniqueScore}%`],
      ["Internal uniqueness", `${result.internalUniqueScore}%`],
      ["Phrases checked", result.totalPhrases],
      ["Phrases with matches", result.phrasesWithMatches],
      [],
      ["Matched URL", "Domain", "Match Score", "Matched Phrases"],
      ...result.matches.map((match) => [match.url, match.domain, `${match.matchScore}%`, match.matchedPhrases.join(" | ")]),
    ];
    downloadTextFile(
      `plagiarism-report-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex justify-center">
        <div className="rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-6 py-2.5 shadow-lg shadow-pink-500/25">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-display text-lg font-bold">Plagiarism Checker</span>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/40">
        Search Google for exact-match phrases from a URL or pasted text using DataForSEO, with internal uniqueness checks included.
      </p>

      <div className="mt-6 flex items-center justify-center gap-2">
        <ModeButton active={mode === "url"} onClick={() => setMode("url")} icon={<Globe className="h-4 w-4" />}>URL</ModeButton>
        <ModeButton active={mode === "text"} onClick={() => setMode("text")} icon={<FileText className="h-4 w-4" />}>Text</ModeButton>
      </div>

      <div className="mt-6 rounded-3xl border border-white/[0.06] bg-ink-800 p-8">
        {mode === "url" ? (
          <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-ink-900/80 px-4 py-3 ring-1 ring-violet-500/10">
            <Globe className="h-4 w-4 text-violet-400/60" />
            <input value={displayUrl} readOnly onKeyDown={(e) => e.key === "Enter" && scan()} className="flex-1 cursor-not-allowed bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none" placeholder="Select a website in the nav" />
          </div>
        ) : (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full resize-none rounded-xl border border-white/[0.08] bg-ink-900/80 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none" placeholder="Paste your text here to check for plagiarism..." />
        )}

        <div className="mt-5 flex justify-center gap-3">
          <button onClick={scan} disabled={loading || (mode === "url" && !hasProject)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:shadow-violet-500/50 disabled:opacity-60">
            <Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Scanning..." : "Scan Now"}
          </button>
          <button onClick={downloadReport} disabled={!result} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-white/60 disabled:opacity-40">
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
        {progress && <p className="mt-3 text-center text-xs text-violet-300">{progress}</p>}
        {error && <p className="mt-3 text-center text-xs font-semibold text-rose-300">{error}</p>}
      </div>

      {result && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Score value={`${result.uniqueScore}%`} label="Web Uniqueness" color="text-emerald-300" />
            <Score value={`${result.internalUniqueScore}%`} label="Internal Uniqueness" color="text-violet-300" />
            <Score value={result.totalPhrases} label="Phrases Checked" color="text-blue-300" />
            <Score value={result.matches.length} label="Sources Found" color="text-amber-300" />
          </div>
          {result.warning && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{result.warning}. Internal uniqueness was still calculated.</span>
            </div>
          )}
          {result.matches.length > 0 ? (
            <div className="mt-5 space-y-3">
              {result.matches.slice(0, 10).map((match, i) => (
                <a key={`${match.url}-${i}`} href={match.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white/85">{match.title || match.url}</div>
                      <div className="mt-1 truncate text-xs text-emerald-300/70">{match.url}</div>
                      <p className="mt-2 text-xs text-white/45">{match.snippets[0]}</p>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">
                      {match.matchScore}% <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">{match.matchedPhrases.length} matching phrase(s)</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-center text-sm text-white/35">No external exact-match sources were found for the searched phrases.</p>
          )}
        </div>
      )}

    </div>
  );
}

function ModeButton({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${active ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30" : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"}`}>
      {icon} {children}
    </button>
  );
}

function Score({ value, label, color }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-white/35">{label}</div>
    </div>
  );
}
