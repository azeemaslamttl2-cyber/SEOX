import { useState, useMemo } from "react";
import { ArrowRight, Check, ChevronDown, Copy, Download, HelpCircle, Link2, Network, Plus, Search, Target, Zap } from "lucide-react";
import { useCrawl } from "../../context/CrawlContext.jsx";

/* ─── Seed-based deterministic random ─── */
function seededRng(seed) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ════════════════════════════════════════════════════════
   MASTER TOPIC EXTRACTION & KEYWORD INTELLIGENCE ENGINE
   ════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","as","be","was","are","this","that","page","html",
  "php","asp","aspx","htm","index","default","www","http","https","com",
  "net","org","ae","uk","us","io","co","shop","e","p","wp","content",
]);

/* Extract topic tokens from a URL path */
function extractTopicTokens(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, "");
    if (!path) return [u.hostname.split(".").filter((s) => !STOP_WORDS.has(s))[0] || "home"];
    const segs = path.split("/").flatMap((seg) =>
      seg.replace(/[-_]+/g, " ").replace(/\.(html?|php|aspx?)$/i, "")
        .split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    );
    // Also handle query params like ?e-page=X
    const params = [...u.searchParams.keys()].flatMap((k) =>
      k.replace(/[-_]+/g, " ").split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
    return [...new Set([...segs, ...params])].filter(Boolean);
  } catch { return ["page"]; }
}

/* Build a human-readable topic label from URL */
function extractTopicLabel(url) {
  const tokens = extractTopicTokens(url);
  return tokens.slice(0, 4).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}

/* Compute topical relevance between two pages (0-100) */
function computeRelevance(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 10;
  const targetSet = new Set(targetTokens);
  const shared = sourceTokens.filter((t) => targetSet.has(t));
  const jaccard = shared.length / new Set([...sourceTokens, ...targetTokens]).size;
  // Give sibling pages extra relevance when they share parent path segments.
  const siblingBonus = shared.length >= 2 ? 15 : shared.length === 1 ? 5 : 0;
  return Math.min(100, Math.round(jaccard * 100 + siblingBonus));
}

/* ─── SEO keyword variant modifiers ─── */
const KW_MODIFIERS = [
  { prefix: "", suffix: "", kd: (b) => b, vol: (b) => b },
  { prefix: "best ", suffix: "", kd: (b) => b + 8, vol: (b) => b * 1.3 },
  { prefix: "", suffix: " guide", kd: (b) => b + 5, vol: (b) => b * 0.9 },
  { prefix: "", suffix: " services", kd: (b) => b + 3, vol: (b) => b * 1.1 },
  { prefix: "", suffix: " types", kd: (b) => b - 2, vol: (b) => b * 0.7 },
  { prefix: "how to ", suffix: "", kd: (b) => b - 5, vol: (b) => b * 0.6 },
  { prefix: "", suffix: " cost", kd: (b) => b + 2, vol: (b) => b * 1.5 },
  { prefix: "", suffix: " near me", kd: (b) => b + 12, vol: (b) => b * 2.0 },
  { prefix: "", suffix: " solutions", kd: (b) => b + 4, vol: (b) => b * 0.8 },
  { prefix: "top ", suffix: "", kd: (b) => b + 10, vol: (b) => b * 1.4 },
  { prefix: "", suffix: " company", kd: (b) => b + 6, vol: (b) => b * 1.2 },
  { prefix: "", suffix: " review", kd: (b) => b + 3, vol: (b) => b * 0.85 },
  { prefix: "", suffix: " price", kd: (b) => b + 7, vol: (b) => b * 1.6 },
  { prefix: "professional ", suffix: "", kd: (b) => b + 9, vol: (b) => b * 0.7 },
  { prefix: "", suffix: " benefits", kd: (b) => b - 3, vol: (b) => b * 0.5 },
];

/* Build a keyword from target page topic */
function buildKeywordFromTopic(targetTokens, rng) {
  const core = targetTokens.slice(0, 3).join(" ");
  const mod = KW_MODIFIERS[Math.floor(rng() * KW_MODIFIERS.length)];
  const baseKd = 10 + Math.floor(rng() * 30);
  const baseVol = 500 + Math.floor(rng() * 25000);
  const kd = Math.max(1, Math.min(99, Math.round(mod.kd(baseKd))));
  const vol = Math.max(100, Math.round(mod.vol(baseVol)));
  const volLabel = vol >= 10000 ? `${(vol / 1000).toFixed(1)}K` : vol >= 1000 ? `${(vol / 1000).toFixed(1)}K` : `${vol}`;
  return { keyword: `${mod.prefix}${core}${mod.suffix}`, kd, volumeLabel: volLabel };
}

/* Generate smart context + patch suggestion */
function generateSmartContext(sourceTopic, targetTopic, targetUrl, keyword, relevance, rng) {
  const anchor = keyword.length > 40 ? keyword.slice(0, 38) + "…" : keyword;
  const patchHtml = `<a href="${targetUrl}">${anchor}</a>`;

  const templates = [
    {
      ctx: `This page discusses ${sourceTopic} and naturally relates to ${targetTopic}. Adding a contextual link with anchor text "${anchor}" would strengthen the topical cluster and pass link equity to the target page.`,
      why: "Topical cluster strengthening",
    },
    {
      ctx: `Content about ${sourceTopic} should reference ${targetTopic} to provide comprehensive coverage. The keyword "${anchor}" appears in the target's topic and would serve as a strong semantic bridge.`,
      why: "Semantic bridge opportunity",
    },
    {
      ctx: `Users reading about ${sourceTopic} are likely also interested in ${targetTopic}. Inserting a link with "${anchor}" improves user journey depth and reduces bounce rate.`,
      why: "User journey optimization",
    },
    {
      ctx: `The source page's content on ${sourceTopic} has a natural entry point to mention ${targetTopic}. Linking with "${anchor}" distributes PageRank efficiently within the site hierarchy.`,
      why: "PageRank distribution",
    },
    {
      ctx: `Search engines associate ${sourceTopic} with ${targetTopic} as related entities. An internal link using "${anchor}" reinforces this semantic relationship for both pages.`,
      why: "Entity relationship signal",
    },
    {
      ctx: `The target page about ${targetTopic} needs more internal links for discoverability. The source page on ${sourceTopic} is a high-authority page where "${anchor}" fits naturally in the content flow.`,
      why: "Orphan page rescue",
    },
  ];
  const t = templates[Math.floor(rng() * templates.length)];
  return { context: t.ctx, reason: t.why, anchor, patchHtml, relevance };
}

const PAGE_SIZE = 50;
const MAX_TERMS_PER_PAGE = 80;
const MAX_CANDIDATES_PER_SOURCE = 40;
const MAX_OPPORTUNITIES_PER_SOURCE = 3;
const MAX_TOTAL_OPPORTUNITIES = 1200;

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
}

function normalizeToken(value) {
  const token = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/'s$/i, "");
  if (token.length < 3 || STOP_WORDS.has(token)) return "";
  if (token.endsWith("ies") && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && token.length > 4 && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/i)
    .map(normalizeToken)
    .filter(Boolean);
}

function splitSentences(value) {
  const text = cleanText(value);
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => cleanText(item))
    .filter((item) => item.split(/\s+/).length >= 5);

  if (sentences.length) return sentences.slice(0, 450);

  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += 32) {
    chunks.push(words.slice(i, i + 32).join(" "));
  }
  return chunks.slice(0, 450);
}

function urlKey(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(rawUrl || "");
  }
}

function sameInternalHost(a, b) {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function pageTitleFromRow(row) {
  const rawTitle = row.title || row.audit?.titleText || "";
  if (rawTitle) return rawTitle;
  try {
    const url = new URL(row.url);
    const path = url.pathname.replace(/^\/|\/$/g, "");
    if (!path) return url.hostname;
    return path
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .map((seg) => seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(" > ");
  } catch {
    return row.url;
  }
}

function pageTopicFromModel(model) {
  const phrase = model.anchorPhrases.find((item) => item.tokens.length >= 2)?.text;
  if (phrase) return phrase;
  return model.topTerms.slice(0, 4).map((item) => item.term).join(" ");
}

function weightedAdd(map, term, amount) {
  if (!term) return;
  map.set(term, (map.get(term) || 0) + amount);
}

function addTokenWeights(map, text, weight) {
  tokenizeText(text).forEach((token) => weightedAdd(map, token, weight));
}

function phraseCandidatesFromText(text, baseWeight) {
  const tokens = tokenizeText(text);
  const phrases = [];
  for (let size = Math.min(5, tokens.length); size >= 2; size -= 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      const phraseTokens = tokens.slice(i, i + size);
      if (phraseTokens.some((token) => STOP_WORDS.has(token))) continue;
      phrases.push({
        text: phraseTokens.join(" "),
        tokens: phraseTokens,
        weight: baseWeight + size * 2,
      });
    }
  }
  return phrases;
}

function buildPageModel(row) {
  const title = pageTitleFromRow(row);
  const h1 = row.h1 || row.audit?.h1Text || "";
  const headings = Array.isArray(row.headings)
    ? row.headings.map((item) => (typeof item === "string" ? item : item?.text)).filter(Boolean)
    : [];
  const contentText = cleanText(row.contentText || row.audit?.contentText || "");
  const headingText = cleanText(headings.join(". "));
  const urlTopicText = extractTopicTokens(row.url).join(" ");
  const capturedPageText = cleanText([contentText, h1, headingText].filter(Boolean).join(". "));
  const fallbackPageText = cleanText([h1, headingText, title, urlTopicText].filter(Boolean).join(". "));
  const scanText = capturedPageText || fallbackPageText;
  const bodyWordCount = tokenizeText(scanText).length;
  const weights = new Map();

  addTokenWeights(weights, title, 6);
  addTokenWeights(weights, h1, 8);
  addTokenWeights(weights, contentText, 2);
  addTokenWeights(weights, headingText, 4);
  addTokenWeights(weights, urlTopicText, 3);

  const anchorPhrases = [
    ...phraseCandidatesFromText(title, 14),
    ...phraseCandidatesFromText(h1, 16),
    ...headings.flatMap((heading) => phraseCandidatesFromText(heading, 10)),
  ];
  const dedupedPhrases = Array.from(
    new Map(anchorPhrases.map((item) => [item.text, item])).values()
  ).sort((a, b) => b.weight - a.weight || b.tokens.length - a.tokens.length);

  const topTerms = Array.from(weights.entries())
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_TERMS_PER_PAGE);

  const existingTargets = new Set(
    (row.links || [])
      .map((item) => (typeof item === "string" ? item : item?.url || ""))
      .filter(Boolean)
      .map(urlKey)
  );

  return {
    ...row,
    key: urlKey(row.url),
    title,
    h1,
    headings,
    contentText,
    scanText,
    sentences: splitSentences(scanText),
    hasBodyContent: bodyWordCount >= 4,
    termWeights: weights,
    topTerms,
    topTermSet: new Set(topTerms.map((item) => item.term)),
    anchorPhrases: dedupedPhrases,
    existingTargets,
    wordCount: bodyWordCount || row.audit?.wordCount || 0,
  };
}

function createTargetIndex(models) {
  const docFreq = new Map();
  models.forEach((model) => {
    model.topTermSet.forEach((term) => docFreq.set(term, (docFreq.get(term) || 0) + 1));
  });

  const index = new Map();
  models.forEach((model) => {
    model.topTerms.forEach(({ term, weight }) => {
      const frequency = docFreq.get(term) || 0;
      if (frequency > Math.max(12, models.length * 0.35)) return;
      if (!index.has(term)) index.set(term, []);
      index.get(term).push({ model, weight });
    });
  });

  return {
    index,
    idf: new Map(
      Array.from(docFreq.entries()).map(([term, frequency]) => [
        term,
        Math.log((models.length + 1) / (frequency + 1)) + 1,
      ])
    ),
  };
}

function scoreSourceTargets(source, targetIndex, idf) {
  const scores = new Map();
  source.topTerms.forEach(({ term, weight }) => {
    const indexedTargets = targetIndex.get(term) || [];
    indexedTargets.forEach(({ model: target, weight: targetWeight }) => {
      if (source.key === target.key) return;
      if (!sameInternalHost(source.url, target.url)) return;
      if (source.existingTargets.has(target.key)) return;
      const current = scores.get(target.key) || { target, score: 0, shared: [] };
      const termScore = Math.sqrt(weight * targetWeight) * (idf.get(term) || 1);
      current.score += termScore;
      current.shared.push({ term, score: termScore });
      scores.set(target.key, current);
    });
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES_PER_SOURCE);
}

function findSentenceForPhrase(sentences, phrase) {
  const phraseTokens = tokenizeText(phrase);
  if (!phraseTokens.length) return null;
  return sentences.find((sentence) => {
    const sentenceTokens = new Set(tokenizeText(sentence));
    return phraseTokens.every((token) => sentenceTokens.has(token));
  }) || null;
}

function findAnchorFromSentence(sentence, targetTerms) {
  const words = sentence.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || [];
  for (let size = 5; size >= 2; size -= 1) {
    for (let i = 0; i <= words.length - size; i += 1) {
      const raw = words.slice(i, i + size).join(" ");
      const tokens = tokenizeText(raw);
      if (tokens.length < 2) continue;
      const matches = tokens.filter((token) => targetTerms.has(token)).length;
      if (matches >= Math.min(2, tokens.length)) return cleanText(raw);
    }
  }

  const single = words.find((word) => {
    const token = normalizeToken(word);
    return token && targetTerms.has(token) && token.length > 4;
  });
  return single ? cleanText(single) : "";
}

function findOriginalPhraseInSentence(sentence, phrase) {
  const phraseTokens = tokenizeText(phrase);
  const words = sentence.match(/[A-Za-z0-9][A-Za-z0-9'â€™-]*/g) || [];
  for (let i = 0; i <= words.length - phraseTokens.length; i += 1) {
    const rawWords = words.slice(i, i + phraseTokens.length);
    const rawTokens = rawWords.map(normalizeToken).filter(Boolean);
    if (
      rawTokens.length === phraseTokens.length &&
      rawTokens.every((token, index) => token === phraseTokens[index])
    ) {
      return cleanText(rawWords.join(" "));
    }
  }
  return cleanText(phrase);
}

function sentenceScore(sentence, targetTerms, sharedTerms) {
  const sentenceTokens = new Set(tokenizeText(sentence));
  let score = 0;
  sharedTerms.forEach(({ term, score: termScore }) => {
    if (sentenceTokens.has(term) && targetTerms.has(term)) score += termScore;
  });
  return score;
}

function findContextualAnchor(source, target, sharedTerms) {
  const targetTerms = target.topTermSet;
  for (const phrase of target.anchorPhrases) {
    const sentence = findSentenceForPhrase(source.sentences, phrase.text);
    if (sentence) {
      return {
        anchor: findOriginalPhraseInSentence(sentence, phrase.text),
        sentence,
        reason: "Target phrase found in source copy",
        exact: true,
      };
    }
  }

  const rankedSentences = source.sentences
    .map((sentence) => ({ sentence, score: sentenceScore(sentence, targetTerms, sharedTerms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  for (const item of rankedSentences) {
    const anchor = findAnchorFromSentence(item.sentence, targetTerms);
    if (anchor) {
      return {
        anchor,
        sentence: item.sentence,
        reason: "Shared topic sentence in source copy",
        exact: false,
      };
    }
  }

  return null;
}

function countMentions(text, anchor) {
  const anchorTokens = tokenizeText(anchor);
  if (!anchorTokens.length) return 0;
  const tokens = tokenizeText(text);
  let count = 0;
  for (let i = 0; i <= tokens.length - anchorTokens.length; i += 1) {
    if (anchorTokens.every((token, offset) => tokens[i + offset] === token)) count += 1;
  }
  return count;
}

function estimateKeywordDemand(anchor, sourceMentions, targetMentions, relevance, score) {
  const phraseSize = Math.max(1, tokenizeText(anchor).length);
  const topicSpread = 1 + (hashStr(anchor) % 9) / 10;
  const crawlSignal =
    Math.max(1, sourceMentions) * 650 +
    Math.max(1, targetMentions) * 420 +
    Math.max(1, relevance) * 95 +
    Math.max(1, score) * 7;
  return Math.max(10, Math.round((crawlSignal * topicSpread) / Math.sqrt(phraseSize)));
}

function formatSearchVolume(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(value));
}

function buildPatchSentence(sentence, anchor, targetUrl) {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linked = `<a href="${targetUrl}">${anchor}</a>`;
  return cleanText(sentence).replace(new RegExp(escaped, "i"), linked);
}

/* ─── Build page list from real crawl data ─── */
function buildPagesFromCrawl(latestUrls) {
  return latestUrls
    .filter((row) => row.url && row.status >= 200 && row.status < 400)
    .map((row) => {
      const ct = (row.contentType || "").toLowerCase();
      const isHtml = /text\/html|application\/xhtml/i.test(ct) || (!ct && row.status >= 200 && row.status < 300);
      if (!isHtml) return null;

      let depth = 0;
      try {
        const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, "");
        depth = pathname ? pathname.split("/").filter(Boolean).length : 0;
      } catch { /* default 0 */ }

      const wordCount = row.audit?.wordCount || tokenizeText(row.contentText || "").length;
      return buildPageModel({
        ...row,
        pr: Math.max(1, Math.min(80, Math.round(48 - depth * 4 + Math.min(20, wordCount / 120)))),
        title: pageTitleFromRow(row),
        url: row.url,
        status: row.status,
        ct: row.contentType || "text/html",
        depth,
        indexable: row.status >= 200 && row.status < 300,
        inlinks: row.outlinks || 0,
      });

      // Generate a title from URL path
      let title;
      try {
        const url = new URL(row.url);
        const path = url.pathname.replace(/^\/|\/$/g, "");
        if (!path) title = url.hostname;
        else title = path.split("/").filter(Boolean).slice(-2)
          .map((seg) => seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(" › ");
      } catch { title = row.url; }

      return {
        pr: Math.max(1, Math.min(60, Math.round(40 - depth * 5))),
        title,
        url: row.url,
        status: row.status,
        ct: row.contentType || "text/html",
        depth,
        indexable: row.status >= 200 && row.status < 300,
        inlinks: row.outlinks || 0,
      };
    })
    .filter(Boolean);
}

/* ─── Build dynamic opportunities from crawled page data ─── */
function buildOpportunities(pages) {
  {
    const contentCandidates = pages.filter(
      (p) =>
        p.indexable &&
        p.status >= 200 &&
        p.status < 300 &&
        p.hasBodyContent &&
        p.sentences.length > 0 &&
        p.topTerms.length >= 2
    );
    const { index, idf } = createTargetIndex(contentCandidates);
    const contentOpportunities = [];

    for (const source of contentCandidates) {
      const scoredTargets = scoreSourceTargets(source, index, idf);
      let addedForSource = 0;

      for (const candidate of scoredTargets) {
        if (addedForSource >= MAX_OPPORTUNITIES_PER_SOURCE) break;

        const anchorMatch = findContextualAnchor(source, candidate.target, candidate.shared);
        if (!anchorMatch) continue;

        const sourceMentions = countMentions(source.scanText, anchorMatch.anchor);
        const targetMentions = countMentions(candidate.target.scanText, anchorMatch.anchor);
        const relevance = Math.min(
          100,
          Math.round(
            candidate.score * 1.8 +
            Math.min(18, sourceMentions * 4) +
            Math.min(12, targetMentions * 3) +
            (anchorMatch.exact ? 16 : 6)
          )
        );
        if (relevance < 18) continue;

        contentOpportunities.push({
          pr: source.pr,
          source: source.url,
          sourceTopic: pageTopicFromModel(source),
          rating: Math.max(1, Math.min(10, Math.round(relevance / 10))),
          traffic: Math.max(0, Math.round((source.pr + source.wordCount / 150 + sourceMentions * 3) / 2)),
          keyword: anchorMatch.anchor,
          context: anchorMatch.sentence,
          reason: anchorMatch.reason,
          anchor: anchorMatch.anchor,
          patchHtml: buildPatchSentence(anchorMatch.sentence, anchorMatch.anchor, candidate.target.url),
          relevance,
          mentions: sourceMentions || 1,
          keywordVolume: formatSearchVolume(
            estimateKeywordDemand(
              anchorMatch.anchor,
              sourceMentions,
              targetMentions,
              relevance,
              candidate.score
            )
          ),
          kd: Math.max(1, Math.min(99, Math.round(100 - relevance / 1.4))),
          target: candidate.target.url,
          targetTopic: pageTopicFromModel(candidate.target),
          pos: Math.max(1, Math.min(99, Math.round(100 - relevance / 1.5))),
          tTraffic: Math.max(0, Math.round((candidate.target.pr + targetMentions * 4) / 3)),
          canPatch: true,
        });
        addedForSource += 1;
      }

      if (contentOpportunities.length >= MAX_TOTAL_OPPORTUNITIES) break;
    }

    return contentOpportunities.sort(
      (a, b) => b.relevance - a.relevance || b.pr - a.pr || a.source.localeCompare(b.source)
    );
  }
}

export default function InternalLinks() {
  const { stats } = useCrawl();

  const latestUrls = stats?.latestUrls || [];

  // Build page data from real crawl data
  const pages = useMemo(() => buildPagesFromCrawl(latestUrls), [latestUrls]);

  // Dynamically generate opportunities from the crawled pages
  const rows = useMemo(() => buildOpportunities(pages), [pages]);

  const opportunityCount = rows.length;
  const lostCount = 0;

  const [resultTab, setResultTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.keyword.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        r.context.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.sourceTopic.toLowerCase().includes(q) ||
        r.targetTopic.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="auditor-hero">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <Network className="h-5 w-5" />
          Internal link opportunities
          <HelpCircle className="h-4 w-4 text-white/30" />
          <span className="text-xs font-normal text-white/40 ml-1">How to use</span>
        </h1>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-ink-800/60 p-2 backdrop-blur">
        <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input
            placeholder="Word or phrase"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className="w-44 bg-transparent placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <button className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white/80 hover:bg-white/[0.08]">
          Source page <ChevronDown className="h-3 w-3" />
        </button>
        <button className="flex h-9 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs text-white/80 hover:bg-white/[0.08]">
          Advanced filter <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Results table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setResultTab("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "all" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              All filter results <span className="ml-1 rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] text-brand-100">{opportunityCount.toLocaleString()}</span>
            </button>
            <button
              onClick={() => setResultTab("lostFilter")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "lostFilter" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              Lost from filter results 0
            </button>
            <button
              onClick={() => setResultTab("lost")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${resultTab === "lost" ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-white/55 hover:bg-white/[0.04]"}`}
            >
              Lost {lostCount}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Plus className="h-3.5 w-3.5" /> Patches: Show all <ChevronDown className="h-3 w-3" />
            </button>
            <button className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08] lg:flex">
              <span className="h-3.5 w-3.5 text-center">≡</span> Columns
            </button>
            <button className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-white/80 hover:bg-white/[0.08]">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1760px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: 56 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 380 }} />
              <col style={{ width: 98 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 310 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 104 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="px-3 py-3 font-medium">PR</th>
                <th className="px-3 py-3 font-medium">Source page</th>
                <th className="px-3 py-3 font-medium">Source URL Rating</th>
                <th className="px-3 py-3 font-medium">Source total traffic</th>
                <th className="px-3 py-3 font-medium">Keyword</th>
                <th className="px-3 py-3 font-medium">Keyword context / Patch it</th>
                <th className="px-3 py-3 font-medium">Keyword search volume</th>
                <th className="px-3 py-3 font-medium">Keyword difficulty</th>
                <th className="px-3 py-3 font-medium">Target page</th>
                <th className="px-3 py-3 font-medium">Target position</th>
                <th className="px-3 py-3 font-medium">Target traffic</th>
                <th className="px-3 py-3 font-medium">Source can patch</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-sm text-white/40">
                    {searchQuery ? "No opportunities match your search." : "No contextual internal link opportunities match the captured page content yet."}
                  </td>
                </tr>
              ) : (
                filteredRows.slice(0, visibleCount).map((r, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.025] align-top">
                    <td className="px-3 py-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-500/30 to-amber-500/10 text-xs font-bold text-amber-200 ring-1 ring-inset ring-amber-500/30">
                        {r.pr}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <UrlCell url={r.source} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/75">{r.rating}</td>
                    <td className="px-3 py-3 tabular-nums text-white/75">{r.traffic}</td>
                    <td className="px-3 py-3 font-medium text-white">{r.keyword}</td>
                    <td className="px-3 py-3">
                      <ContextPatchCell row={r} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white">{r.keywordVolume}</td>
                    <td className="px-3 py-3"><KdBadge kd={r.kd} /></td>
                    <td className="px-3 py-3">
                      <UrlCell url={r.target} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/80">{r.pos}</td>
                    <td className="px-3 py-3 tabular-nums text-white/75">{r.tTraffic}</td>
                    <td className="px-3 py-3">
                      {r.canPatch ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          <Zap className="h-3 w-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Show more footer */}
        {filteredRows.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-white/10 py-4">
            {visibleCount < filteredRows.length && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="text-sm font-semibold text-brand-300 hover:underline"
              >
                Show more
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (Math.min(visibleCount, filteredRows.length) / filteredRows.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white/40">
                Showing {Math.min(visibleCount, filteredRows.length).toLocaleString()} of {filteredRows.length.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UrlCell({ url }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 items-start gap-1 text-sm leading-snug text-brand-300 hover:underline">
      <span className="break-words">{url}</span>
      <Search className="mt-0.5 h-3 w-3 flex-shrink-0 text-white/30" />
    </a>
  );
}

function KdBadge({ kd }) {
  let bg, text;
  if (kd <= 15) { bg = "bg-emerald-500/20"; text = "text-emerald-300"; }
  else if (kd <= 30) { bg = "bg-amber-500/20"; text = "text-amber-300"; }
  else if (kd <= 50) { bg = "bg-orange-500/20"; text = "text-orange-300"; }
  else { bg = "bg-rose-500/20"; text = "text-rose-300"; }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${bg} ${text}`}>
      {kd}
    </span>
  );
}

function highlight(text, keyword) {
  if (!text || !keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="rounded bg-brand-500/25 px-0.5 text-brand-200 font-semibold">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function ContextPatchCell({ row }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(row.patchHtml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-300">
        <Target className="h-2.5 w-2.5" /> {row.reason}
      </span>

      <p className="rounded-md bg-black/25 px-2.5 py-2 text-sm leading-snug text-white/75">
        {highlight(row.context, row.keyword)}
      </p>

      <div className="flex items-center gap-1.5 text-[11px]">
        <Link2 className="h-3 w-3 text-brand-400 flex-shrink-0" />
        <span className="text-white/40">Anchor:</span>
        <span className="font-medium text-brand-200">&quot;{row.anchor}&quot;</span>
      </div>

      {row.canPatch && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
          >
            <ArrowRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            {expanded ? "Hide patch" : "Show HTML patch"}
          </button>
          {expanded && (
            <div className="mt-1 flex items-start gap-1.5 rounded-md border border-white/10 bg-black/40 p-2">
              <code className="flex-1 break-all text-[10px] leading-relaxed text-emerald-300/90 font-mono">
                {row.patchHtml}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                title="Copy HTML"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
