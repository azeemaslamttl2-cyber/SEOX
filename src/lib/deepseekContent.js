import {
  analyzeContentOptimization,
  generateEntitiesForKeywords,
  generateGrammarRelations,
  generateSkipGramWords,
  generateUniqueNgrams,
} from "./contentTools.js";

const CONTENT_SYSTEM = [
  "You are DeepSeek acting as an expert semantic SEO content assistant.",
  "Create practical, non-generic outputs that a content strategist can use immediately.",
  "Avoid filler. Prefer concise lists, search-intent coverage, and semantic SEO clarity.",
].join(" ");

const RELATION_KEYS = [
  "properNouns",
  "commonNouns",
  "synonyms",
  "antonyms",
  "hyponyms",
  "hypernyms",
  "meronyms",
  "holonyms",
];

export async function callDeepSeekContent({
  action = "contentTool",
  prompt,
  systemInstruction = CONTENT_SYSTEM,
  responseMimeType,
  temperature = 0.4,
  maxTokens = 4096,
}) {
  const response = await fetch("/api/deepseek", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      prompt,
      systemInstruction,
      responseMimeType,
      temperature,
      maxTokens,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `DeepSeek request failed (${response.status})`);
  }

  return data;
}

export async function callDeepSeekJson(options) {
  const data = await callDeepSeekContent({
    ...options,
    responseMimeType: "application/json",
  });
  return parseJsonText(data.text);
}

export async function generateEntityGroupsDeepSeek(input) {
  const keywords = splitInput(input);
  if (!keywords.length) return [];

  const fallback = generateEntitiesForKeywords(input);
  const payload = await callDeepSeekJson({
    action: "generateSeoEntities",
    temperature: 0.35,
    maxTokens: 4096,
    prompt: `Generate semantic SEO entities for these keywords:
${keywords.map((keyword, index) => `${index + 1}. ${keyword}`).join("\n")}

Return JSON only in this shape:
{
  "groups": [
    { "keyword": "keyword text", "entities": ["entity", "entity"] }
  ]
}

Rules:
- Return 18 to 28 entities per keyword.
- Include brands, concepts, subtopics, metrics, attributes, and related search-intent terms where useful.
- Do not include explanations.`,
  });

  const groups = Array.isArray(payload) ? payload : payload.groups;
  return keywords.map((keyword, index) => {
    const local = fallback[index] || { keyword, entities: [] };
    const match = Array.isArray(groups)
      ? groups.find((group) => sameText(group?.keyword, keyword)) || groups[index]
      : null;
    const entities = unique(toStringArray(match?.entities)).slice(0, 32);
    return {
      keyword,
      entities: entities.length ? entities : local.entities,
    };
  });
}

export async function generateGrammarRelationsDeepSeek(topic) {
  const fallback = generateGrammarRelations(topic);
  const payload = await callDeepSeekJson({
    action: "generateGrammarRelations",
    temperature: 0.35,
    maxTokens: 3072,
    prompt: `Generate semantic grammar relationships for this SEO topic: "${topic}".

Return JSON only with these exact keys:
{
  "properNouns": [],
  "commonNouns": [],
  "synonyms": [],
  "antonyms": [],
  "hyponyms": [],
  "hypernyms": [],
  "meronyms": [],
  "holonyms": []
}

Rules:
- Return 6 to 10 concise entries per key.
- Use natural SEO/content vocabulary.
- Do not include explanations.`,
  });

  return RELATION_KEYS.reduce((acc, key) => {
    const values = unique(toStringArray(payload[key])).slice(0, 12);
    acc[key] = values.length ? values : fallback[key];
    return acc;
  }, {});
}

export async function generateUniqueNgramsDeepSeek(topic) {
  const fallback = generateUniqueNgrams(topic);
  const payload = await callDeepSeekJson({
    action: "generateUniqueNgrams",
    temperature: 0.55,
    maxTokens: 2048,
    prompt: `Generate uncommon, useful SEO n-grams for this topic: "${topic}".

Return JSON only:
{ "ngrams": ["phrase", "phrase"] }

Rules:
- Return 16 to 24 phrases.
- Prefer phrases that could become useful subheadings, examples, or entity-rich sentences.
- Avoid generic keyword stuffing.`,
  });

  const ngrams = unique(toStringArray(payload.ngrams || payload.phrases || payload.items)).slice(0, 30);
  return ngrams.length ? ngrams : fallback;
}

export async function generateSkipGramWordsDeepSeek(word) {
  const fallback = generateSkipGramWords(word);
  const payload = await callDeepSeekJson({
    action: "generateSkipGramWords",
    temperature: 0.4,
    maxTokens: 2048,
    prompt: `Generate dominant skip-gram/co-occurring words for disambiguating this term: "${word}".

Return JSON only:
{ "words": ["word or short phrase", "word or short phrase"] }

Rules:
- Return 18 to 30 words or short phrases.
- Include context words, attributes, adjacent concepts, and ranking/use-case signals.
- Keep each item short.`,
  });

  const words = unique(toStringArray(payload.words || payload.terms || payload.items)).slice(0, 36);
  return words.length ? words : fallback;
}

export async function improveOutlineWithDeepSeek({ urls = [], outline = [] }) {
  const compactOutline = outline
    .slice(0, 120)
    .map((item) => `${String(item.tag || "h2").toUpperCase()}: ${item.text}`)
    .join("\n");

  const payload = await callDeepSeekJson({
    action: "combineArticleOutline",
    temperature: 0.35,
    maxTokens: 4096,
    prompt: `Combine and improve this competitor heading data into one search-intent-focused article outline.

Source URLs:
${urls.filter(Boolean).map((url, index) => `${index + 1}. ${url}`).join("\n") || "No URLs provided"}

Extracted headings:
${compactOutline || "No headings extracted"}

Return JSON only:
{
  "outline": [
    { "tag": "h1", "text": "Heading text" },
    { "tag": "h2", "text": "Heading text" }
  ]
}

Rules:
- Use one H1.
- Use logical H2/H3 hierarchy.
- Remove duplicate or thin headings.
- Cover search intent more completely than the raw outline.
- Do not include explanations.`,
  });

  const improved = normalizeOutline(payload.outline);
  return improved.length ? improved : outline;
}

export async function askDeepSeekContent({ message, content = "", keyword = "", context = "" }) {
  const data = await callDeepSeekContent({
    action: "contentAssistantChat",
    temperature: 0.45,
    maxTokens: 2048,
    prompt: `Target keyword: ${keyword || "not provided"}

Current content:
${truncate(content || "No content provided yet.", 6000)}

Context:
${context || "General content writing assistant."}

User request:
${message}`,
  });

  return (data.text || "").trim();
}

export async function generateTitleIdeasDeepSeek({ keyword = "", content = "" }) {
  const payload = await callDeepSeekJson({
    action: "generateTitleTags",
    temperature: 0.45,
    maxTokens: 2048,
    prompt: `Generate SEO title tag ideas.

Target keyword: ${keyword || "not provided"}
Content sample:
${truncate(content || "No content provided yet.", 3000)}

Return JSON only:
{ "titles": ["title", "title"] }

Rules:
- Return 5 to 8 titles.
- Keep most titles between 45 and 62 characters.
- Include the target keyword naturally when possible.`,
  });

  return unique(toStringArray(payload.titles || payload.items)).slice(0, 10).map((text) => ({
    text,
    chars: text.length,
  }));
}

export async function generateMetaDescriptionsDeepSeek({ keyword = "", content = "" }) {
  const payload = await callDeepSeekJson({
    action: "generateMetaDescriptions",
    temperature: 0.45,
    maxTokens: 2048,
    prompt: `Generate SEO meta descriptions.

Target keyword: ${keyword || "not provided"}
Content sample:
${truncate(content || "No content provided yet.", 3000)}

Return JSON only:
{ "descriptions": ["description", "description"] }

Rules:
- Return 4 to 6 options.
- Aim for 110 to 160 characters.
- Match user search intent and avoid hype.`,
  });

  return unique(toStringArray(payload.descriptions || payload.metas || payload.items)).slice(0, 8).map((text) => ({
    text,
    chars: text.length,
  }));
}

export async function generateOptimizationAdviceDeepSeek(content) {
  const analysis = analyzeContentOptimization(content);
  const data = await callDeepSeekContent({
    action: "contentOptimizationAdvice",
    temperature: 0.4,
    maxTokens: 2048,
    prompt: `Review this draft and give specific SEO/content optimization advice.

Current local analysis:
Score: ${analysis.score}
Words: ${analysis.words}
Checklist:
${analysis.checklist.map((item) => `- ${item.done ? "Done" : "Missing"}: ${item.item}`).join("\n")}

Draft:
${truncate(content || "No content provided yet.", 7000)}

Return concise advice with:
1. The biggest improvement to make now.
2. Missing semantic entities or sections.
3. Quick rewrite suggestions.`,
  });

  return (data.text || "").trim();
}

export async function generateSemanticDraftDeepSeek(data) {
  const headings = data.headings || [];
  const entities = data.entities || [];
  const dataSummary = {
    keyword: data.keyword || "",
    headings,
    entities,
    ngrams: data.ngrams || [],
    nlp: data.nlp || [],
    skipgram: data.skipgram || [],
    grammar: data.grammar || {},
    instructions: data.aiInstructions || "",
  };

  const result = await callDeepSeekContent({
    action: "generateSemanticDraft",
    temperature: 0.55,
    maxTokens: 8192,
    prompt: `Write a semantic SEO draft using this content plan.

Plan JSON:
${JSON.stringify(dataSummary, null, 2)}

Rules:
- Use the provided heading structure if present.
- Include the target keyword naturally.
- Weave in entities and semantic terms where relevant.
- Write in clean Markdown.
- If the plan is sparse, create a practical draft outline and starter content.`,
  });

  return (result.text || "").trim();
}

export async function autoConfigureContentStepDeepSeek({ step, data }) {
  const result = await callDeepSeekContent({
    action: "autoConfigureSemanticWriterStep",
    temperature: 0.35,
    maxTokens: 2048,
    prompt: `Auto-configure the "${step.label}" step for a semantic content writer.

Current data:
${JSON.stringify(data, null, 2)}

Return concise recommendations and settings that can be copied into this step.`,
  });

  return (result.text || "").trim();
}

function parseJsonText(text = "{}") {
  const cleaned = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned || "{}");
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("DeepSeek returned invalid JSON");
  }
}

function normalizeOutline(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const tag = String(item?.tag || item?.level || "h2").toLowerCase();
      const text = String(item?.text || item?.heading || "").trim();
      if (!text) return null;
      return {
        tag: /^h[1-6]$/.test(tag) ? tag : "h2",
        text,
      };
    })
    .filter(Boolean);
}

function splitInput(input) {
  return unique(String(input).split(/[,\n]/).map((item) => item.trim()));
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => toStringArray(item));
  }
  if (value && typeof value === "object") {
    return toStringArray(value.text || value.name || value.keyword || value.term || "");
  }
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
}

function unique(items) {
  return Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));
}

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function truncate(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}
