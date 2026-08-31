import { fetchUrlContent, extractMainContent, getPageTitle } from "../utils/fetchAndParse.js";

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "your", "you", "are", "was",
  "were", "have", "has", "had", "not", "but", "what", "when", "where", "which", "will",
  "can", "all", "our", "their", "they", "its", "into", "about", "more", "than", "then",
  "them", "these", "those", "there", "here", "how", "why", "who", "use", "using", "used",
]);

export async function getSourceText({ mode = "text", text = "", url = "", urls = [] }) {
  if (mode === "text") return cleanText(text);
  const targets = (urls.length ? urls : [url]).map((item) => item.trim()).filter(Boolean);
  const fetched = await Promise.all(
    targets.map(async (target) => {
      const normalized = normalizeUrl(target);
      const html = await fetchUrlContent(normalized);
      return {
        url: normalized,
        title: getPageTitle(html),
        text: cleanText(extractMainContent(html)),
        html,
      };
    })
  );
  return fetched.length === 1 ? fetched[0].text : fetched;
}

export function extractEntitiesFromText(text, limit = 40) {
  const source = cleanText(text);
  const candidates = new Map();
  const proper = source.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,4}\b/g) || [];
  const nounish = source.match(/\b[a-zA-Z][a-zA-Z0-9-]{4,}(?:\s+[a-zA-Z][a-zA-Z0-9-]{4,}){0,2}\b/g) || [];

  [...proper, ...nounish].forEach((raw) => {
    const entity = raw.replace(/\s+/g, " ").trim();
    const key = entity.toLowerCase();
    const first = key.split(/\s+/)[0];
    if (!entity || STOP_WORDS.has(first) || entity.length < 4) return;
    const current = candidates.get(key) || { entity, type: inferEntityType(entity), mentions: 0 };
    current.mentions += 1;
    candidates.set(key, current);
  });

  const max = Math.max(1, ...Array.from(candidates.values()).map((item) => item.mentions));
  return Array.from(candidates.values())
    .sort((a, b) => b.mentions - a.mentions || a.entity.localeCompare(b.entity))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      salience: Number((item.mentions / max).toFixed(2)),
    }));
}

export function extractNgramsFromText(text) {
  const tokens = tokenize(text);
  return {
    unigrams: countNgrams(tokens, 1),
    bigrams: countNgrams(tokens, 2),
    trigrams: countNgrams(tokens, 3),
  };
}

export function extractNlpKeywords(text) {
  const entities = extractEntitiesFromText(text, 20);
  const ngrams = extractNgramsFromText(text);
  const merged = [
    ...entities.map((item) => ({
      keyword: item.entity,
      relevance: Math.min(100, Math.round(item.salience * 100)),
      type: item.type,
      sentiment: "Neutral",
    })),
    ...ngrams.bigrams.slice(0, 15).map((item) => ({
      keyword: item.ngram,
      relevance: Math.min(95, 45 + item.count * 7),
      type: "Concept",
      sentiment: inferSentiment(item.ngram),
    })),
  ];
  const seen = new Set();
  return merged.filter((item) => {
    const key = item.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

export function extractOutlineFromHtml(html, fallbackTitle = "") {
  const headings = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const match of html.matchAll(re)) {
    const text = stripTags(match[2]);
    if (text) headings.push({ tag: `h${match[1]}`, text });
  }
  if (!headings.length && fallbackTitle) headings.push({ tag: "h1", text: fallbackTitle });
  return headings;
}

export async function extractOutlineFromUrls(urls) {
  const pages = await Promise.all(
    urls.filter(Boolean).map(async (url) => {
      const html = await fetchUrlContent(normalizeUrl(url));
      return extractOutlineFromHtml(html, getPageTitle(html));
    })
  );
  return pages.flat();
}

export function generateEntitiesForKeywords(input) {
  return splitInput(input).map((keyword) => {
    const base = keyword.toLowerCase();
    const roots = base.split(/\s+/).filter((word) => !STOP_WORDS.has(word));
    const modifiers = ["guide", "tools", "strategy", "examples", "benefits", "risks", "workflow", "checklist"];
    return {
      keyword,
      entities: unique([
        keyword,
        ...roots,
        ...roots.map((word) => `${word} optimization`),
        ...roots.map((word) => `${word} metrics`),
        ...modifiers.map((word) => `${keyword} ${word}`),
      ]).slice(0, 24),
    };
  });
}

export function generateGrammarRelations(topic) {
  const base = topic.trim();
  const lower = base.toLowerCase();
  return {
    properNouns: [base, `${base} Research`, `${base} Institute`, `${base} Framework`, `${base} Platform`],
    commonNouns: [`${lower} tool`, `${lower} method`, `${lower} system`, `${lower} process`, `${lower} metric`],
    synonyms: [`${lower} strategy`, `${lower} approach`, `${lower} model`, `${lower} practice`, `${lower} technique`],
    antonyms: [`non-${lower}`, `manual ${lower}`, `legacy ${lower}`, `generic approach`],
    hyponyms: [`technical ${lower}`, `local ${lower}`, `semantic ${lower}`, `automated ${lower}`],
    hypernyms: ["marketing", "optimization", "analysis", "strategy", "research"],
    meronyms: ["workflow", "checklist", "dataset", "signal", "report"],
    holonyms: ["content system", "SEO campaign", "growth program", "audit framework"],
  };
}

export function generateUniqueNgrams(topic) {
  const base = topic.trim().toLowerCase();
  const angles = ["for neglected intents", "with measurable proof", "before competitor mapping", "after content decay", "for entity gaps", "with source corroboration", "inside topical clusters", "without keyword stuffing"];
  return angles.map((angle) => `${base} ${angle}`);
}

export function generateSkipGramWords(word) {
  const base = word.trim().toLowerCase();
  return unique([
    `${base} context`, `${base} meaning`, `${base} intent`, `${base} examples`, `${base} signals`,
    `${base} pattern`, `${base} model`, `${base} source`, `${base} cluster`, `${base} relevance`,
    "definition", "attribute", "entity", "topic", "query", "document", "ranking", "semantic",
  ]);
}

export function analyzeContentOptimization(content) {
  const text = cleanText(content);
  const words = tokenize(text);
  const entities = extractEntitiesFromText(text, 12);
  const nlp = extractNlpKeywords(text).slice(0, 12);
  const hasTitle = /^.{10,80}(\n|$)/.test(content.trim());
  const checks = [
    { item: "Add a clear title", done: hasTitle },
    { item: "Write at least 800 words", done: words.length >= 800 },
    { item: "Use semantic entities", done: entities.length >= 8 },
    { item: "Keep sentences readable", done: averageSentenceLength(text) <= 24 },
    { item: "Use headings or sections", done: /^#{1,3}\s|\n[A-Z][^\n]{4,80}\n/gm.test(content) || (content.match(/\n/g) || []).length > 5 },
    { item: "Avoid thin content", done: words.length >= 300 },
  ];
  const score = Math.round((checks.filter((item) => item.done).length / checks.length) * 100);
  return { score, checklist: checks, entities, nlp, words: words.length };
}

export function removeAiWatermarks(text, options = {}) {
  let cleaned = String(text);
  const invisiblePattern = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
  const invisibleCount = (cleaned.match(invisiblePattern) || []).length;
  cleaned = cleaned.replace(invisiblePattern, "");
  if (options.normalizeWhitespace !== false) cleaned = cleaned.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  if (options.normalizeQuotes) cleaned = cleaned.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
  return {
    cleaned,
    stats: {
      invisibleCount,
      originalChars: text.length,
      cleanedChars: cleaned.length,
    },
  };
}

export function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, "\"\"")}"` : str;
}

function countNgrams(tokens, size) {
  const counts = new Map();
  for (let i = 0; i <= tokens.length - size; i += 1) {
    const gram = tokens.slice(i, i + size).join(" ");
    if (!gram || gram.split(" ").some((word) => STOP_WORDS.has(word))) continue;
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  const total = Math.max(1, tokens.length - size + 1);
  return Array.from(counts.entries())
    .map(([ngram, count]) => ({ ngram, count, density: `${((count / total) * 100).toFixed(2)}%` }))
    .sort((a, b) => b.count - a.count || a.ngram.localeCompare(b.ngram))
    .slice(0, 50);
}

function tokenize(text) {
  return cleanText(text)
    .toLowerCase()
    .match(/\b[a-z][a-z0-9-]{2,}\b/g)
    ?.filter((word) => !STOP_WORDS.has(word)) || [];
}

function splitInput(input) {
  return unique(String(input).split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
}

function inferEntityType(entity) {
  if (/\b(inc|llc|ltd|company|agency|google|microsoft|openai)\b/i.test(entity)) return "Organization";
  if (/\b(tool|software|platform|app|framework)\b/i.test(entity)) return "Product";
  if (/^[A-Z]/.test(entity)) return "Named Entity";
  return "Concept";
}

function inferSentiment(value) {
  if (/\b(best|growth|benefit|win|improve|trusted|safe)\b/i.test(value)) return "Positive";
  if (/\b(risk|problem|bad|fail|loss|penalty)\b/i.test(value)) return "Negative";
  return "Neutral";
}

function averageSentenceLength(text) {
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  return tokenize(text).length / sentences.length;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function unique(items) {
  return Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));
}
