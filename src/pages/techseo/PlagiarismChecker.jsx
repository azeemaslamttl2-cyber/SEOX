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
import { useTechSeoToolResult } from "../../hooks/useTechSeoToolResult.js";
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

const EMPTY_PLAGIARISM_RESULT = {
  status: "idle",
  sourceTitle: "",
  sourceUrl: "",
  sourceText: "",
  totalWordsChecked: 0,
  totalPhrases: 0,
  phrasesWithMatches: 0,
  matches: [],
  uniqueScore: 0,
  internalUniqueScore: 0,
  warning: "",
  error: "",
  scannedAt: "",
};

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
  const { project, projectUrl, hasProject, displayUrl } = useSelectedProjectDomain();
  const { result, saveResult, persistenceError } = useTechSeoToolResult({
    toolKey: "plagiarism",
    project,
    projectUrl,
    emptyResult: EMPTY_PLAGIARISM_RESULT,
  });
  const [mode, setMode] = useState("url");
  const [text, setText] = useState("");
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
    let source = {
      sourceText: mode === "text" ? text : "",
      sourceTitle: mode === "text" ? "Pasted text" : "",
      sourceUrl: mode === "url" ? projectUrl : "",
    };
    try {
      source = await getSource();
      const sentences = splitIntoSentences(source.sourceText);
      // Some valid pages use a single long paragraph without punctuation. Fall
      // back to one phrase from the readable text instead of rejecting it.
      const fallbackPhrase = extractPhrase(source.sourceText);
      const phrases = sentences.length
        ? selectRepresentativePhrases(sentences, 8)
        : (wordCount(fallbackPhrase) >= 3 ? [fallbackPhrase] : []);

      if (!phrases.length) {
        const next = {
          ...EMPTY_PLAGIARISM_RESULT,
          status: "insufficient_content",
          sourceTitle: source.sourceTitle,
          sourceUrl: source.sourceUrl,
          sourceText: source.sourceText,
          totalWordsChecked: wordCount(source.sourceText),
          error: "Not enough readable text was found to search for plagiarism. Try a longer page or paste at least three words.",
          scannedAt: new Date().toISOString(),
        };
        await saveResult(next);
        setError(next.error);
        setProgress("");
        return;
      }
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

      await saveResult({
        status: serpWarning ? "completed_with_warning" : "completed",
        sourceTitle: source.sourceTitle,
        sourceUrl: source.sourceUrl,
        sourceText: source.sourceText,
        totalWordsChecked: wordCount(source.sourceText),
        totalPhrases: phrases.length,
        phrasesWithMatches: new Set(webMatches.flatMap((match) => match.matchedPhrases)).size,
        matches: webMatches,
        uniqueScore,
        internalUniqueScore: internalUniqueness(sentences),
        warning: serpWarning,
        error: "",
        scannedAt: new Date().toISOString(),
      });
      setProgress("");
    } catch (err) {
      const message = err?.message || "Could not run plagiarism scan.";
      const failedResult = {
        ...EMPTY_PLAGIARISM_RESULT,
        status: "failed",
        sourceTitle: source.sourceTitle,
        sourceUrl: source.sourceUrl,
        sourceText: source.sourceText,
        totalWordsChecked: wordCount(source.sourceText),
        error: message,
        scannedAt: new Date().toISOString(),
      };
      try {
        await saveResult(failedResult);
      } catch (saveError) {
        setError(saveError?.message || message);
        return;
      }
      setError(message);
      setProgress("");
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
    <div className="mx-auto max-w-6xl">
      {/* ─── Hero Header ─── */}
      <div className="plagiarism-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="plagiarism-title flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <h1 className="font-display">Plagiarism Checker</h1>
              <p className="plagiarism-description">
                Search Google for exact-match phrases from a URL or pasted text using DataForSEO, with internal uniqueness checks included.
              </p>
            </div>
          </div>
          <div className="plagiarism-actions">
            <button onClick={scan} disabled={loading || (mode === "url" && !hasProject)} className="ui-button ui-button-primary plagiarism-scan-button">
              <Search className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} /> {loading ? "Scanning..." : "Scan Now"}
            </button>
            <button onClick={downloadReport} disabled={!result} className="ui-button plagiarism-download-button">
              <Download className="h-4 w-4" /> Download
            </button>
          </div>
        </div>

        {/* Source: URL or pasted text */}
        <div className="plagiarism-source">
          <div className="admin-tabs plagiarism-modes">
            <ModeButton active={mode === "url"} onClick={() => setMode("url")} icon={<Globe className="h-4 w-4" />}>URL</ModeButton>
            <ModeButton active={mode === "text"} onClick={() => setMode("text")} icon={<FileText className="h-4 w-4" />}>Text</ModeButton>
          </div>

          {mode === "url" ? (
            <div className="plagiarism-url-field">
              <Globe className="h-4 w-4" />
              <input value={displayUrl} readOnly onKeyDown={(e) => e.key === "Enter" && scan()} className="flex-1 cursor-not-allowed" placeholder="Select a website in the nav" />
            </div>
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="plagiarism-textarea" placeholder="Paste your text here to check for plagiarism..." />
          )}
        </div>

        {progress && <p className="plagiarism-progress">{progress}</p>}
        {(error || persistenceError) && (
          <div className="app-alert app-alert-error mt-3">{error || persistenceError}</div>
        )}
      </div>

      {result.status !== "idle" && (
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
    <button onClick={onClick} className={`plagiarism-mode-tab flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition ${active ? "plagiarism-mode-tab-active" : "plagiarism-mode-tab-inactive"}`}>
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
