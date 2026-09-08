import { configureMysqlConnection, queryOne, update } from '../../../_lib/mysql.js';
import { getMySqlDocument, patchMySqlDocument } from '../../../_lib/mysql-repository.js';
import { corsHeaders, emptyResponse, jsonResponse, readJson } from '../../../_lib/http.js';
import { requireUser } from '../../../_lib/auth-token.js';

const MAX_TOKEN_LENGTH = 512;
const MAX_PROMPT_CHARS = 60_000;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

export const SEO_RULES = [
  {
    id: 'answer_first',
    name: '🚀 Answer First',
    summary: "Don't distance the question from the answer. Answer immediately, then elaborate.",
    fullPrompt: `Do not distance the question from the answer.
Example: For "How much caffeine is in coffee?" immediately answer, "There is 95 mg of caffeine in coffee." then elaborate.
Explanation: Answer the question right away to provide clarity, then give details.
Do not delay the answer.
Question: What are the benefits of Charts for entrepreneurs?
Wrong Structure: Charts are the main element for... To prepare a Chart.... Benefits of Charts,....
Correct Structure: There are X main benefits of a Chart for an entrepreneur....
Singularity and Plurality matter for micro semantics.`
  },
  {
    id: 'no_analogies',
    name: '🚫 No Analogies',
    summary: "Don't use analogies that compare one thing to another.",
    fullPrompt: `Don't Use Analogies. An analogy is a way of explaining something by comparing it to something else that is similar. It's like saying one thing is similar to another to help people understand a concept better. Avoid using analogies as they can confuse search engines and reduce clarity.`
  },
  {
    id: 'coreference',
    name: '⚠️ Avoid Coreference Errors',
    summary: 'Use clear pronoun references. Avoid ambiguous "he", "she", "it".',
    fullPrompt: `Avoid coreference errors. Improper pronoun usage may result in a "coreference error." This error happens when search engines struggle to understand which noun or entity the pronoun is referring to.
Example of a Coreference Error: "Joe Rogan did a podcast with Elon Musk, and he shared his thoughts on finance and law."
In this case, it's unclear who shared their thoughts—Joe Rogan or Elon Musk? Since the pronoun "he" doesn't clearly refer to a specific entity, Google may get confused while processing the sentence.
Google will attempt to resolve this ambiguity by searching for co-occurrences of both entities on the web. However, such confusion signals to Google that the article may not be well-structured or carefully written.`
  },
  {
    id: 'no_extra_sentences',
    name: '🚀 No Extra Sentences',
    summary: 'Combine sentences when possible to reduce token usage.',
    fullPrompt: `Don't create an extra sentence if there is no logical reason.
Example: How old is Tanjiro in Demon Slayer anime?
Answer 1: Tanjiro is 25 years old. His birthdate is Dec 2, 2002.
Answer 2: Tanjiro is 25 years old and his birthdate is Dec 2, 2002.
Answer 3: Tanjiro is 25 years old. Tanjiro's birthdate is Dec 2, 2002.
Answer 2 is best because with each new sentence search engines will use a new token. Both Answer 1 and Answer 3 will require two tokens, but Answer 2 will require only 1 token.`
  },
  {
    id: 'abbreviations',
    name: '✅ Use Abbreviations Properly',
    summary: 'Include abbreviation in parentheses on first mention.',
    fullPrompt: `Always Use the Abbreviation in Parentheses on First Mention.
When you introduce an entity or concept for the first time, include its abbreviation in parentheses right after the full term. This way, readers immediately know what the abbreviation stands for, making it easier to follow the content if the abbreviation is used later.
Incorrect: "Bitcoin is the main cryptocurrency asset."
Correct: "Bitcoin (BTC) is the main cryptocurrency asset for crypto trading platforms."`
  },
  {
    id: 'no_back_reference',
    name: '⚠️ No Back References',
    summary: 'Don\'t say "As stated before" or "As explained in section Y".',
    fullPrompt: `Do not send the reader, or the text processors to the back of the article.
Do not send the reader by saying "As stated before", or "As it is explained in the Y section".
Wrong Structure: "As it is shown in the article, the most dangerous poisons in the world have been determined by the P method."
Correct Structure: "The most dangerous poisons in the world have been determined by the P Method."
Explanation: Instead of directing readers back to a previous section, restate the information directly. This keeps the content flow uninterrupted and makes it easier for readers to follow without needing to recall previous sections.`
  },
  {
    id: 'safe_answers',
    name: '🚀 Give Safe Answers',
    summary: 'Provide comprehensive answers with factors, examples, and sources.',
    fullPrompt: `Give Safe Answers.
Question: "Does laser cutting produce clean and precise edges compared to other cutting methods?"
Answer: Yes, laser cutting produces clean and precise edges compared to other cutting methods, such as X, Y, and Z. The cleanness and precision of edges during laser cutting are affected by five main factors: X, Y, Z, D…. These factors increase their weight under the conditions of X, Y, Z.
A Laser Cutter industrial user experiences… according to …..
A Laser Cutter manufacturer, X, conveys Y in their Z paper….
A Laser Cutter observation from 2017 during the construction of …. involves ……`
  },
  {
    id: 'bold_answer',
    name: '🔍 Bold the Answer',
    summary: 'Bold the answer part, not the search term.',
    fullPrompt: `Bold the answer, not the search term.
Query: What is a Penguin?
Answer: <b>A penguin is a flightless seabird.</b>
Answer: A penguin is <b>a flightless seabird.</b>
Signal the answer part, not the relevance.`
  },
  {
    id: 'if_statements',
    name: '✨ If Statements Second',
    summary: 'Put "if" conditions in the second part of the sentence.',
    fullPrompt: `Put the "if" statements in the second part of the sentence.
"If A becomes B, do X." → Less preferred
"Do X, if A becomes B." → Better
State what to do first, then explain the condition.
"If it rains, take an umbrella." → Less preferred
"Take an umbrella, if it rains." → Better`
  },
  {
    id: 'subordinate_text',
    name: '✨ Match Heading Structure',
    summary: 'Supporting text should match the heading structure (How to → To do).',
    fullPrompt: `Optimize Subordinate Text First Sentence.
Heading: How to do X...
Wrong Supporting Text: X is....
Correct Supporting Text: To do X....

Match the Adjectives, Predicates, Nouns Order Between Questions and Answers.
For clarity and cohesion, keep the structure of adjectives, predicates, and nouns in the same order in both the question and answer.
Question: "What are effective focus-improving techniques?"
Answer: "Effective focus-improving techniques include setting goals, reducing multitasking, and taking breaks."`
  },
  {
    id: 'examples_after_plural',
    name: '📌 Examples After Plurals',
    summary: 'Give specific examples after mentioning a plural noun.',
    fullPrompt: `Give examples after a plural noun.
"There are 40 different cryptocurrencies to trade on Coinbase, including Bitcoin and Ethereum."
Food Options: There are 25 delicious dishes to try at the restaurant, including pasta, sushi, and tacos.
Workout Types: There are 15 types of workouts available in the app, including yoga, HIIT, and strength training.
Languages Offered: There are 20 languages you can learn on the platform, including Spanish, Mandarin, and Arabic.`
  },
  {
    id: 'verb_context',
    name: '🚀 Understand Verb Context',
    summary: 'Use "increase" for metrics, "improve" for skills/health, "develop" for gradual growth.',
    fullPrompt: `Understand Context of Verbs.
'Increase' signals 'health' (measurable metrics, quantities, or intensities).
Example: "Consistent stretching can increase flexibility over time."

'Improve' signals 'skill' + 'health' (skills or health outcomes that can be enhanced).
Example: "Practicing regularly will improve your language proficiency."

'Develop' signals 'skill' (gradual skill acquisition or growth in processes).
Example: "Working in a startup environment helps employees develop resilience and adaptability."

Determine predicates wisely.`
  },
  {
    id: 'be_specific',
    name: '🔍 Be Specific',
    summary: 'Experts are specific. Say "6 severe symptoms" not just "symptoms".',
    fullPrompt: `Be Specific When Describing Things.
Do not tell "The symptoms of X disease...".
Tell, "There are 6 severe symptoms of X disease, these are... There are 9 rare symptoms of X disease..."
Experts are specific.

General vs. Expert-Like Examples:
Condition Explanation:
General: "The symptoms of malaria include fever, chills, and nausea."
Expert-Like: "Malaria has 4 primary symptoms, which are fever, chills, headache, and nausea. Additionally, there are 3 rare symptoms: confusion, seizures, and bleeding."

Product Benefits:
General: "The benefits of Product Y are numerous."
Expert-Like: "Product Y offers 5 key benefits: X, Y, Z..."`
  },
  {
    id: 'numeric_values',
    name: '⚡ Use Numeric Values',
    summary: 'Say "5 main reasons" not "many reasons". Be specific with numbers.',
    fullPrompt: `Use Numeric Values.
Do not tell "There are many reasons...".
Tell, "There are 5 main reasons...".
Experts are specific. Always quantify when possible.`
  },
  {
    id: 'no_fluff',
    name: '🚀 Cut the Fluff',
    summary: 'Delete contextless words like "Also", "According to", "should know".',
    fullPrompt: `Cut the Fluff out. Delete all contextless words.
Wrong: "There is one more fact about electric cars that every driver should know, and it is the electric charger capacity. Also, According to the electric charger type, the electric battery charging time might vary."
Correct: "Electric car charging time changes based on electric car charger type. For example, X type car charger is observed to be faster 5% compared to Y type of electric car charger."
Remove words like: "Also", "According to the", "should know", "might", "There is one more fact", "it is the".`
  },
  {
    id: 'be_certain',
    name: '⚡ Be Certain',
    summary: 'State facts definitively. Use "Sun rises every day" not "Sun will rise tomorrow".',
    fullPrompt: `Be Certain.
"Sun will rise tomorrow" → Wrong. A limit on how certain we can be because it depends on time and uses the wrong form. (It's just a possibility)
"Sun rises every day." → Correct. A fact.
Knowledge should be certain and definite. State facts, not possibilities.`
  },
  {
    id: 'consistent_pos',
    name: '📌 Consistent List Structure',
    summary: 'Use same part of speech at start of each list item.',
    fullPrompt: `Use the same Part of Speech Tag (Word Role) in the first word of the sentence for a listing.
If starting with a verb + noun structure:
- Ensure proper alignment.
- Clear unnecessary clutter.
- Spend time reviewing details.
- Absorb useful information.

Alternatively, if starting with a noun:
- Coffee provides energy and antioxidants.
- Exercise boosts metabolism and strengthens muscles.
- Hydration improves skin and aids digestion.

Using a consistent part of speech, especially at the beginning of list items, makes the list easier to follow and more visually appealing. It also reinforces a structured, intentional tone, which is helpful for both readability and SEO.`
  },
  {
    id: 'prioritize_context',
    name: '📝 Prioritize Context',
    summary: 'Match the interrogative term (where=place, when=time, how=method).',
    fullPrompt: `Prioritize Attributes and Contexts.
Interrogative Term: Where is a signal for place.
Query: "Where does a Penguin Live?"
Answer: "Penguins live below the equator, in the X, Y, Z geographies because their flippers and flightless seabirds nature provide..."
Match the context of the question in your answer. Where questions need location answers first.`
  },
  {
    id: 'measurement_units',
    name: '📏 Multiple Measurement Units',
    summary: 'Include diverse measurement units (pounds + kg, oz + liters).',
    fullPrompt: `If you're mentioning measurement units in your content, always try to mention more and diverse measurement units.
Less measurement units: "For each pound lost, drink around 16-20 oz of water."
More measurement units: "For each pound (0.45 kg) lost, drink around 16-20 oz (0.5-0.6 liters) of water."
The second sentence is more enriched with information and has more connection to different types of related entities, i.e., kg and liters.
From the user experience point of view, the second sentence is more helpful for users as well, because different users process information with different mindsets.
Thus, more units help to satisfy a more diverse and relevant target user class.`
  },
  {
    id: 'boolean_answers',
    name: '✅ Yes/No First',
    summary: 'Boolean questions should start with Yes or No.',
    fullPrompt: `Boolean Questions should start with Yes or No.
Question: "Does Water In Food Help When Drinking Water Is Restricted?"
Answer: "Yes, eating food high in water content that is easily digestible helps with overall fluid intake when drinking water is restricted.
According to Wiseman, digesting fat is the hardest and requires a lot of water.
The Federal Emergency Management Agency (FEMA) recommends not eating salty foods as they can increase thirst."
Start with a clear Yes or No, then elaborate with supporting details.`
  }
];

export const AI_INSTRUCTIONS = {
  conciseWriting: {
    title: 'Concise Writing Style',
    summary: 'Remove unnecessary words. Use active voice. Make every word count.',
    fullPrompt: `Omit needless words. Vigorous writing is concise. A sentence should contain no unnecessary words, a paragraph no unnecessary sentences, for the same reason that a drawing should have no unnecessary lines and a machine no unnecessary parts. This requires not that the writer make all their sentences short, or that they avoid all detail and treat their subjects only in outline, but that they make every word tell.

Use the active voice. Prefer concrete, physical language and analogies.`
  },
  naturalLanguage: {
    title: 'Natural Human Language',
    summary: 'Write plainly with short sentences. Avoid AI clichés. Be direct and conversational.',
    fullPrompt: `Use simple language: Write plainly with short sentences.

Example: "I need help with this issue."

Avoid AI-giveaway phrases: Don't use clichés like "dive into," "unleash your potential," etc.

Avoid: "Let's dive into this game-changing solution."

Use instead: "Here's how it works."

Be direct and concise: Get to the point; remove unnecessary words.

Example: "We should meet tomorrow."

Maintain a natural tone: Write as you normally speak; it's okay to start sentences with "and" or "but."

Example: "And that's why it matters."

Avoid marketing language: Don't use hype or promotional words.

Avoid: "This revolutionary product will transform your life."

Use instead: "This product can help you."

Keep it real: Be honest; don't force friendliness.

Example: "I don't think that's the best idea."

Simplify grammar: Don't stress about perfect grammar; it's fine not to capitalize "i" if that's your style.

Example: "i guess we can try that."

Stay away from fluff: Avoid unnecessary adjectives and adverbs.

Example: "We finished the task."

Focus on clarity: Make your message easy to understand.

Example: "Please send the file by Monday."`
  },
  avoidAIPatterns: {
    title: 'Avoid AI Writing Patterns',
    summary: 'Skip robotic transitions, banned words, and overused AI phrases.',
    fullPrompt: `Use clear, natural human language and avoid overused words or phrases. Do not use terms like as an AI language model or avoid, it's critical to, or tapestry (unless needed). Avoid expressions such as it's important to note, I hope this email finds you well, crucial, or certainly. Also, skip transitional phrases like in summary, remember that, furthermore, additionally, specifically, consequently, importantly, indeed, notably, despite, essentially, alternatively, also, even though, because, in contrast, although, due to, given that, arguably, you may want to, on the other hand, as previously mentioned, it's worth noting that, to summarize, ultimately, or to put it simply. Do not include action words like navigating, dive, tailored, embark, unlock the secrets, unveil the secrets, elevate, unleash, harness, delve into, take a dive into, mastering, excels, imagine, enhance, emphasise/emphasize, revolutionize, foster, subsequently, whispering, reverberate, or promptly. Avoid adjectives such as meticulous, complexities, realm, understanding, everchanging, ever-evolving, daunting, cutting-edge, robust, power, tapestry, bustling, vibrant, metropolis, crucial, essential, vital, keen, fancy, labyrinth, gossamer, enigma, or indelible. Keep responses in detail, clear, human-like. Avoid use of complex robotic sentences.`
  }
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function apiError(error, headers) {
  const status = error?.status || 500;
  const message = error?.message || 'Semantic Writer Editor request failed.';
  return jsonResponse(
    {
      success: false,
      status: 'error',
      message,
    },
    status,
    headers
  );
}

function normalizeToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) fail('admin_token is required.', 400);
  if (token.length > MAX_TOKEN_LENGTH) fail('Invalid admin token.', 401);
  return token;
}

export function validateArticleId(value) {
  const id = String(value || '').trim();
  if (!id) fail('Article ID is required', 400);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) fail('Invalid article ID format', 400);
  return id;
}

export async function authenticate(request, body, env) {
  const authorization = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (authorization) {
    try {
      return await requireUser(request, env);
    } catch {
      fail('Invalid or expired session.', 401);
    }
  }

  const token = normalizeToken(body?.admin_token || body?.adminToken);
  const configured = String(env?.ADMIN_TOKEN || '').trim();
  if (configured && token === configured) return { id: 'configured-admin', uid: 'configured-admin' };
  if (configured && token.split('.').length !== 3) fail('Invalid admin token.', 401);

  try {
    configureMysqlConnection(env);
    const tokenUser = await queryOne(
      'SELECT id, id AS uid, email FROM users WHERE admin_token = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
      [token]
    );
    if (tokenUser) return tokenUser;
  } catch (dbError) {
    if (dbError?.code !== 'ER_NO_SUCH_TABLE') {
      // ignore table errors and fallback to token verification
    }
  }

  try {
    return await requireUser(new Request('http://semantic-writer.internal', {
      headers: { authorization: `Bearer ${token}` }
    }), env);
  } catch {
    fail('Invalid admin token.', 401);
  }
}

export function stripHtml(html = '') {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function markdownToHtml(md = '') {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/s, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-6]>)/g, '$1')
    .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<hr>)<\/p>/g, '$1')
    .replace(/<p><hr>/g, '<hr>')
    .replace(/<hr><\/p>/g, '<hr>');
}

export function extractTitleAndCleanHtml(html = '') {
  if (!html) return { title: '', html: '' };
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = '';
  let cleaned = html;
  if (h1Match) {
    title = stripHtml(h1Match[1]);
    cleaned = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '').trim();
  }
  return { title, html: cleaned };
}

export function normalizeCompetitorUrl(urlStr, targetHostname = '') {
  let raw = String(urlStr || '').trim();
  if (!raw) return null;
  const mdMatch = raw.match(/\((https?:\/\/[^\s)]+)\)/i);
  if (mdMatch) raw = mdMatch[1];
  raw = raw.replace(/^[-*•\d.)\s]+/, '').trim();
  raw = raw.replace(/[()\[\]'"`]/g, '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const u = new URL(raw);
    const hostname = u.hostname.toLowerCase().replace(/^www\./i, '');
    if (!hostname.includes('.')) return null;
    if (targetHostname && hostname === targetHostname.toLowerCase().replace(/^www\./i, '')) return null;

    const blockedDomains = [
      'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com',
      'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'pinterest.com',
      'youtube.com', 'tiktok.com', 'reddit.com', 'wikipedia.org', 'medium.com', 'quora.com',
      'amazon.com', 'apple.com', 'microsoft.com'
    ];
    if (blockedDomains.some(b => hostname === b || hostname.endsWith(`.${b}`))) {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

export function calculateKeywordUsage(content = '', keywords = []) {
  if (!content || !Array.isArray(keywords) || keywords.length === 0) return [];
  const text = stripHtml(content);
  return keywords.map((kw) => {
    if (!kw || typeof kw !== 'string') return null;
    const sanitized = kw.trim();
    if (!sanitized) return null;
    const regex = new RegExp(sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex) || [];
    return {
      keyword: sanitized,
      count: matches.length,
      used: matches.length > 0,
    };
  }).filter(Boolean);
}

export function analyzeArticleContent(content = '', state = {}) {
  const plainText = stripHtml(content || '');
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const headings = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|^#{1,6}\s+(.+)$/gim;
  let match;
  while ((match = headingRegex.exec(content || '')) !== null) {
    if (match[1]) {
      headings.push({ level: parseInt(match[1], 10), text: stripHtml(match[2]) });
    } else if (match[3]) {
      const hashes = match[0].trim().split(' ')[0].length;
      headings.push({ level: hashes, text: match[3].trim() });
    }
  }

  const paragraphMatches = (content || '').match(/<p[^>]*>[\s\S]*?<\/p>/gi) || (content || '').split(/\n\n+/).filter(p => p.trim());
  const paragraphCount = paragraphMatches.length;
  const imageMatches = (content || '').match(/<img[^>]*>|!\[.*?\]\(.*?\)/gi) || [];
  const imageCount = imageMatches.length;

  const keywordData = state.keywordData || {};
  const excluded = state.excludedItems || {};

  const filterEx = (arr = [], cat = '') => {
    const exSet = new Set(Array.isArray(excluded[cat]) ? excluded[cat] : []);
    return (Array.isArray(arr) ? arr : []).filter(item => !exSet.has(item));
  };

  const primaryKeyword = state.mainKeyword || '';
  const competitorEntities = filterEx(keywordData.competitorEntities, 'competitorEntities');
  const aiEntities = filterEx(keywordData.aiEntities, 'aiEntities');
  const allEntities = [...new Set([...competitorEntities, ...aiEntities])];

  const aiPickedNgrams = filterEx(keywordData.aiPickedNgrams, 'aiPickedNgrams');
  const aiGeneratedNgrams = filterEx(keywordData.aiGeneratedNgrams, 'aiGeneratedNgrams');
  const uniqueNgrams = filterEx(keywordData.uniqueNgrams, 'uniqueNgrams');
  const competitorNgrams = filterEx(keywordData.competitorNgrams, 'competitorNgrams');
  const allNgrams = [...new Set([...aiPickedNgrams, ...aiGeneratedNgrams, ...uniqueNgrams, ...competitorNgrams])];

  const nlpKeywords = filterEx(keywordData.nlpKeywords, 'nlpKeywords');
  const skipGrams = filterEx(keywordData.skipGrams, 'skipGrams');

  let autoSuggestList = [];
  if (state.checkedKeywords && Array.isArray(state.checkedKeywords) && state.checkedKeywords.length > 0) {
    autoSuggestList = state.checkedKeywords;
  } else if (state.autoSuggestKeywords && typeof state.autoSuggestKeywords === 'object') {
    autoSuggestList = Object.values(state.autoSuggestKeywords).flat().filter(Boolean);
  } else if (Array.isArray(keywordData.autoSuggest)) {
    autoSuggestList = keywordData.autoSuggest;
  }

  const primaryUsage = primaryKeyword ? calculateKeywordUsage(content, [primaryKeyword])[0] : null;
  const entityUsage = calculateKeywordUsage(content, allEntities);
  const ngramUsage = calculateKeywordUsage(content, allNgrams);
  const nlpUsage = calculateKeywordUsage(content, nlpKeywords);
  const skipGramUsage = calculateKeywordUsage(content, skipGrams);
  const autoSuggestUsage = calculateKeywordUsage(content, autoSuggestList);

  const usedEntities = entityUsage.filter(u => u.used).length;
  const usedNgrams = ngramUsage.filter(u => u.used).length;
  const usedNlp = nlpUsage.filter(u => u.used).length;
  const usedSkipGrams = skipGramUsage.filter(u => u.used).length;
  const usedAutoSuggest = autoSuggestUsage.filter(u => u.used).length;

  const totalTermsCount = (primaryKeyword ? 1 : 0) + allEntities.length + allNgrams.length + nlpKeywords.length + skipGrams.length + autoSuggestList.length;
  const totalUsedCount = (primaryUsage?.used ? 1 : 0) + usedEntities + usedNgrams + usedNlp + usedSkipGrams + usedAutoSuggest;

  let calculatedScore = 0;
  if (wordCount > 0) {
    let baseScore = 50;
    if (primaryUsage?.used) baseScore += 10;
    if (wordCount >= 500) baseScore += 10;
    if (headings.length >= 3) baseScore += 10;
    if (paragraphCount >= 4) baseScore += 5;

    const termCoverageRatio = totalTermsCount > 0 ? (totalUsedCount / totalTermsCount) : 0;
    const termScoreAddition = Math.min(25, Math.round(termCoverageRatio * 35));

    calculatedScore = Math.min(100, Math.max(10, baseScore + termScoreAddition));
  }

  const recommendations = [];
  if (!primaryUsage?.used && primaryKeyword) {
    recommendations.push(`Include your primary keyword "${primaryKeyword}" in the content and heading.`);
  }
  if (wordCount < 600) {
    recommendations.push('Expand your article length to at least 600–1,200 words for better in-depth coverage.');
  }
  if (headings.length < 3) {
    recommendations.push('Add more structured headings (H2, H3) to organize your article sections.');
  }
  if (allEntities.length > 0 && usedEntities < Math.min(5, allEntities.length)) {
    recommendations.push(`Include more semantic entities (currently using ${usedEntities}/${allEntities.length}).`);
  }
  if (allNgrams.length > 0 && usedNgrams < Math.min(5, allNgrams.length)) {
    recommendations.push(`Integrate high-priority N-Grams and phrases to increase contextual relevance.`);
  }

  return {
    metrics: {
      wordCount,
      headingCount: headings.length,
      paragraphCount,
      imageCount,
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    },
    headings,
    contentScore: calculatedScore,
    keywordCoverage: {
      totalTerms: totalTermsCount,
      usedTerms: totalUsedCount,
      coveragePercentage: totalTermsCount > 0 ? Math.round((totalUsedCount / totalTermsCount) * 100) : 0,
    },
    keywordDetails: {
      primaryKeyword: primaryUsage,
      entities: { total: allEntities.length, used: usedEntities, items: entityUsage },
      ngrams: { total: allNgrams.length, used: usedNgrams, items: ngramUsage },
      nlpKeywords: { total: nlpKeywords.length, used: usedNlp, items: nlpUsage },
      skipGrams: { total: skipGrams.length, used: usedSkipGrams, items: skipGramUsage },
      autoSuggest: { total: autoSuggestList.length, used: usedAutoSuggest, items: autoSuggestUsage },
    },
    recommendations,
  };
}

export function buildMegaPrompt(state = {}) {
  const mainKeyword = state.mainKeyword || '';
  const combinedOutline = Array.isArray(state.combinedOutline) ? state.combinedOutline : [];
  const headingWordCounts = state.headingWordCounts || {};
  const excludedItems = state.excludedItems || {};
  const keywordData = state.keywordData || {};
  const writerMode = state.writerMode || 'express';
  const competitorContent = state.competitorContent || '';
  const grammarResults = state.grammarResults || null;
  const selectedRules = Array.isArray(state.selectedRules) ? state.selectedRules : [];
  const aiInstructions = state.aiInstructions || { conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true };

  const filterExcluded = (items, category) => {
    if (!items || !Array.isArray(items)) return [];
    const exSet = new Set(Array.isArray(excludedItems[category]) ? excludedItems[category] : []);
    return items.filter(item => !exSet.has(item));
  };

  const outlineText = combinedOutline.map(h => `H${h.level}: ${h.text}`).join('\n');

  const headingWordTargets = combinedOutline
    .map((heading, idx) => {
      const target = Number.parseInt(headingWordCounts[idx], 10);
      if (!Number.isFinite(target) || target <= 0) return null;
      return {
        level: heading.level,
        text: heading.text.replace(/\s+/g, ' ').trim(),
        target,
      };
    })
    .filter(Boolean);

  const totalTargetWords = headingWordTargets.reduce((sum, item) => sum + item.target, 0);
  const shouldEnforceWordTargets = writerMode === 'quick' && headingWordTargets.length > 0;

  const perHeadingWordTargets = headingWordTargets
    .map((item, idx) => {
      const min = Math.round(item.target * 0.9);
      const max = Math.round(item.target * 1.1);
      return `${idx + 1}. H${item.level}: ${item.text} -> ${item.target} words (allowed range: ${min}-${max})`;
    })
    .join('\n');

  const competitorEntities = filterExcluded(keywordData.competitorEntities, 'competitorEntities');
  const aiEntities = filterExcluded(keywordData.aiEntities, 'aiEntities');
  const uniqueEntities = filterExcluded(keywordData.uniqueEntities, 'uniqueEntities');
  const allEntities = [...new Set([...competitorEntities, ...aiEntities, ...uniqueEntities])];

  const competitorNgrams = filterExcluded(keywordData.competitorNgrams, 'competitorNgrams');
  const aiPickedNgrams = filterExcluded(keywordData.aiPickedNgrams, 'aiPickedNgrams');
  const aiGeneratedNgrams = filterExcluded(keywordData.aiGeneratedNgrams, 'aiGeneratedNgrams');
  const uniqueNgrams = filterExcluded(keywordData.uniqueNgrams, 'uniqueNgrams');
  const legacyNgrams = [
    ...(keywordData.ngrams?.threeGrams || []),
    ...(keywordData.ngrams?.fourGrams || []),
  ];

  const nlpKeywords = filterExcluded(keywordData.nlpKeywords, 'nlpKeywords');
  const skipGrams = filterExcluded(keywordData.skipGrams, 'skipGrams');

  let autoSuggestKws = [];
  if (state.checkedKeywords && Array.isArray(state.checkedKeywords) && state.checkedKeywords.length > 0) {
    autoSuggestKws = state.checkedKeywords;
  } else if (state.autoSuggestKeywords && typeof state.autoSuggestKeywords === 'object') {
    autoSuggestKws = Object.values(state.autoSuggestKeywords).flat().filter(Boolean);
  }

  const grammarElements = grammarResults ? {
    properNouns: filterExcluded(grammarResults.proper_nouns, 'grammar'),
    commonNouns: filterExcluded(grammarResults.common_nouns, 'grammar'),
    synonyms: filterExcluded(grammarResults.synonyms, 'grammar'),
    antonyms: filterExcluded(grammarResults.antonyms, 'grammar'),
    hyponyms: filterExcluded(grammarResults.hyponyms, 'grammar'),
    hypernyms: filterExcluded(grammarResults.hypernyms, 'grammar'),
    meronyms: filterExcluded(grammarResults.meronyms, 'grammar'),
    holonyms: filterExcluded(grammarResults.holonyms, 'grammar'),
  } : null;

  const seoRules = selectedRules.map(id => {
    const rule = SEO_RULES.find(r => r.id === id);
    return rule ? rule.fullPrompt : null;
  }).filter(Boolean);

  const writingInstructions = Object.entries(aiInstructions)
    .filter(([key, enabled]) => enabled && AI_INSTRUCTIONS[key])
    .map(([key]) => AI_INSTRUCTIONS[key].fullPrompt);

  return `# CONTENT WRITING ASSIGNMENT

## PRIMARY KEYWORD
"${mainKeyword}"

---

# ARTICLE STRUCTURE

## Heading Outline (Follow this structure exactly)
${outlineText || 'No outline provided - create a logical structure'}

${shouldEnforceWordTargets ? `## CRITICAL WORD COUNT REQUIREMENTS (HIGHEST PRIORITY)
Treat the following limits as non-negotiable constraints.

- HARD TOTAL TARGET: ${totalTargetWords} words (acceptable range: ${Math.round(totalTargetWords * 0.95)}-${Math.round(totalTargetWords * 1.05)}).
- Keep every listed heading close to its target.
- If one section goes over target, shorten it before moving on.
- Do not ignore these limits.

### Per-Heading Targets
${perHeadingWordTargets}` : ''}

---

# SEMANTIC OPTIMIZATION

## Entities to Include
Use these entities naturally throughout the content:
${allEntities.slice(0, 50).join(', ') || 'None provided'}

## Key Phrases (N-Grams)
### AI-Selected Priority Phrases (USE THESE FIRST)
${aiPickedNgrams.length > 0 ? aiPickedNgrams.join(', ') : 'None selected'}

### AI-Generated Phrases
${aiGeneratedNgrams.length > 0 ? aiGeneratedNgrams.slice(0, 20).join(', ') : 'None generated'}

### Unique N-Grams (Stand Out Phrases)
${uniqueNgrams.length > 0 ? uniqueNgrams.join(', ') : 'None generated'}

### Competitor Phrases (Optional)
${competitorNgrams.length > 0 ? competitorNgrams.slice(0, 20).join(', ') : 'None extracted'}
${legacyNgrams.length > 0 ? `\n### Additional Phrases\n${legacyNgrams.slice(0, 15).join(', ')}` : ''}

## NLP Keywords (Topic Vocabulary)
${nlpKeywords.slice(0, 25).join(', ') || 'None provided'}

## Skip-Gram Dominant Word Pairs
These word pairs frequently appear together when discussing this topic:
${skipGrams.slice(0, 25).join(', ') || 'None provided'}

${autoSuggestKws.length > 0 ? `## Related Search Queries to Address
Cover these user search intents:
• ${autoSuggestKws.slice(0, 25).join('\n• ')}` : ''}

${grammarElements ? `## Semantic Word Relationships
Use these semantic variations for vocabulary richness:

### Proper Nouns (Brands/Names)
${grammarElements.properNouns.slice(0, 12).join(', ') || 'None'}

### Common Nouns
${grammarElements.commonNouns.slice(0, 12).join(', ') || 'None'}

### Synonyms
${grammarElements.synonyms.slice(0, 12).join(', ') || 'None'}

### Hyponyms (More Specific Terms)
${grammarElements.hyponyms.slice(0, 12).join(', ') || 'None'}

### Hypernyms (Broader Terms)
${grammarElements.hypernyms.slice(0, 12).join(', ') || 'None'}

### Meronyms (Parts/Components)
${grammarElements.meronyms.slice(0, 12).join(', ') || 'None'}` : ''}

---

# SEO GUIDELINES

## SEO Optimization Rules
${seoRules.join('\n\n') || 'Use standard SEO best practices'}

## Writing Style Instructions
${writingInstructions.join('\n\n') || 'Write in a clear, engaging, conversational tone.'}

${competitorContent ? `## Reference Content (Analyze for writing style)
Study this competitor content for tone, structure, and style inspiration:

"""
${competitorContent.slice(0, 3000)}
"""

Analyze and replicate:
- The writing tone (formal, casual, conversational)
- Sentence structure and length patterns
- How topics are introduced and explained
- Content flow and transitions` : ''}

---

# INTRODUCTION WRITING INSTRUCTIONS

## Purpose
Summarize the whole document (heading vectors) in a representative way by following the same order.

## Instructions for Introduction

### 1. Implicit Definition
Provide an implicit definition of "${mainKeyword}" and explain how it works in a representative way

### 2. Main Benefits
Highlight the main benefits of "${mainKeyword}"

### 3. Main Uses
Describe the main uses and applications of "${mainKeyword}"

### 4. Main Parts/Components
Outline the main parts or components of "${mainKeyword}"

## Best Practices
- Use the same n-grams in both the introduction (intro) and conclusion (outro)
- Ensure the introduction mirrors the document structure
- Keep the introduction concise but comprehensive

---

# COMPETITOR CONTENT ANALYSIS

${competitorContent ? `## Full Competitor Content Reference
Study this complete competitor content for comprehensive analysis:

"""
${competitorContent}
"""

Analyze and incorporate:
- The writing tone (formal, casual, conversational)
- Sentence structure and length patterns
- How topics are introduced and explained
- Content flow and transitions
- Key points and arguments made
- Structure and organization
- Unique angles and perspectives` : '## No competitor content provided - create original content based on the outline and keywords.'}

BEGIN WRITING THE ARTICLE NOW:`;
}

async function loadDeepSeekApiKey(userId, env) {
  if (userId && userId !== 'configured-admin') {
    try {
      const row = await queryOne(
        'SELECT api_key FROM deepseek_api_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [userId]
      );
      if (row?.api_key) return row.api_key;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  return env?.DEEPSEEK_API_KEY || null;
}

async function callDeepSeekAi(prompt, apiKey) {
  if (!apiKey) {
    fail('AI API key is not configured.', 500);
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    fail(`DeepSeek API failed with status ${response.status}: ${errorText || response.statusText}`, 502);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

export async function onRequest({ request, env }) {
  const headers = { ...corsHeaders('POST, OPTIONS'), 'Cache-Control': 'no-store' };
  if (request.method === 'OPTIONS') return emptyResponse(204, headers);
  if (request.method !== 'POST') {
    return apiError(Object.assign(new Error('Method not allowed. Use POST.'), { status: 405 }), headers);
  }

  try {
    const body = await readJson(request);
    const user = await authenticate(request, body, env);
    const userId = user.id || user.uid;

    const url = new URL(request.url);
    const articleId = validateArticleId(
      body?.article || body?.articleId || body?.article_id || url.searchParams.get('article')
    );

    const action = String(body?.action || url.searchParams.get('action') || 'get').toLowerCase().trim();

    // 1. Load project_data from MySQL content_writer_profiles
    let profileData = {};
    try {
      profileData = (await getMySqlDocument(env, 'project_data', userId)) || {};
    } catch (dbError) {
      console.warn('Could not load project_data from MySQL:', dbError?.message);
    }

    const stateKey = `contentWriterStates_${articleId}`;
    let articleState = profileData[stateKey] || null;
    let savedArticles = Array.isArray(profileData.contentWriterArticles) ? [...profileData.contentWriterArticles] : [];
    let articleMeta = savedArticles.find(a => a.id === articleId) || null;

    // Fallback: check articles table in MySQL if state not found in profileData
    if (!articleState) {
      try {
        configureMysqlConnection(env);
        const articleRow = await queryOne(
          'SELECT * FROM articles WHERE id = ? AND user_id = ? LIMIT 1',
          [articleId, userId]
        );
        if (articleRow) {
          articleState = {
            currentStep: 13,
            mainKeyword: articleRow.focus_keyword || articleRow.selected_keyword || '',
            articleTitle: articleRow.title || '',
            content: articleRow.body || '',
            contentScore: 0,
            writerMode: 'express',
            combinedOutline: [],
            keywordData: {},
            selectedRules: [],
            aiInstructions: { conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true },
          };
          articleMeta = {
            id: articleId,
            title: articleRow.title,
            keyword: articleRow.focus_keyword || articleRow.selected_keyword || '',
            mode: 'express',
            createdAt: articleRow.created_at || new Date().toISOString(),
            updatedAt: articleRow.updated_at || new Date().toISOString(),
            currentStep: 13,
          };
        }
      } catch (rowError) {
        if (rowError?.code !== 'ER_NO_SUCH_TABLE') {
          console.warn('Error querying articles table:', rowError?.message);
        }
      }
    }

    // Action: GET (or default load)
    if (action === 'get') {
      if (!articleState && !articleMeta) {
        fail(`Article "${articleId}" not found`, 404);
      }

      const currentState = articleState || {};
      const analysis = analyzeArticleContent(currentState.content || '', currentState);

      return jsonResponse({
        success: true,
        status: 'success',
        message: 'Article loaded successfully',
        data: {
          article: articleId,
          metadata: articleMeta || {
            id: articleId,
            title: currentState.articleTitle || currentState.mainKeyword || 'Untitled',
            keyword: currentState.mainKeyword || '',
            mode: currentState.writerMode || 'express',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentStep: currentState.currentStep || 1,
          },
          state: currentState,
          analysis,
        },
      }, 200, headers);
    }

    // Action: SAVE
    if (action === 'save') {
      const updates = body?.state || body?.data || body || {};
      const existingState = articleState || {};

      const mergedState = {
        ...existingState,
        ...(updates.state || updates),
        currentArticleId: articleId,
      };

      if (updates.content !== undefined) mergedState.content = updates.content;
      if (updates.title !== undefined) mergedState.articleTitle = updates.title;
      if (updates.articleTitle !== undefined) mergedState.articleTitle = updates.articleTitle;
      if (updates.mainKeyword !== undefined) mergedState.mainKeyword = updates.mainKeyword;
      if (updates.currentStep !== undefined) mergedState.currentStep = updates.currentStep;
      if (updates.writerMode !== undefined) mergedState.writerMode = updates.writerMode;
      if (updates.combinedOutline !== undefined) mergedState.combinedOutline = updates.combinedOutline;
      if (updates.keywordData !== undefined) mergedState.keywordData = updates.keywordData;
      if (updates.headingWordCounts !== undefined) mergedState.headingWordCounts = updates.headingWordCounts;
      if (updates.masterPrompt !== undefined) mergedState.masterPrompt = updates.masterPrompt;

      const analysis = analyzeArticleContent(mergedState.content || '', mergedState);
      mergedState.contentScore = analysis.contentScore;

      const updatedMeta = {
        id: articleId,
        title: mergedState.articleTitle || mergedState.mainKeyword || 'Untitled',
        keyword: mergedState.mainKeyword || '',
        mode: mergedState.writerMode || 'express',
        createdAt: articleMeta?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStep: mergedState.currentStep || 1,
      };

      const existingMetaIndex = savedArticles.findIndex(a => a.id === articleId);
      if (existingMetaIndex >= 0) {
        savedArticles[existingMetaIndex] = updatedMeta;
      } else {
        savedArticles.unshift(updatedMeta);
      }

      const patchPayload = {
        [stateKey]: mergedState,
        contentWriterArticles: savedArticles,
      };

      try {
        await patchMySqlDocument(env, 'project_data', userId, patchPayload);
      } catch (saveError) {
        fail(`Failed to persist article save to database: ${saveError?.message}`, 500);
      }

      return jsonResponse({
        success: true,
        status: 'success',
        message: 'Article saved successfully',
        data: {
          article: articleId,
          metadata: updatedMeta,
          state: mergedState,
          analysis,
        },
      }, 200, headers);
    }

    // Action: ANALYZE or SCORE
    if (action === 'analyze' || action === 'score') {
      const contentToAnalyze = body?.content !== undefined ? body.content : (articleState?.content || '');
      const stateToUse = { ...(articleState || {}), ...(body?.state || {}) };
      if (body?.mainKeyword) stateToUse.mainKeyword = body.mainKeyword;
      if (body?.combinedOutline) stateToUse.combinedOutline = body.combinedOutline;
      if (body?.keywordData) stateToUse.keywordData = body.keywordData;

      const analysis = analyzeArticleContent(contentToAnalyze, stateToUse);

      return jsonResponse({
        success: true,
        status: 'success',
        message: 'Article analysis completed successfully',
        data: {
          article: articleId,
          contentScore: analysis.contentScore,
          metrics: analysis.metrics,
          keywordCoverage: analysis.keywordCoverage,
          keywordDetails: analysis.keywordDetails,
          headings: analysis.headings,
          recommendations: analysis.recommendations,
        },
      }, 200, headers);
    }

    // Action: BUILD_PROMPT
    if (action === 'build_prompt' || action === 'prompt') {
      const stateToUse = { ...(articleState || {}), ...(body?.state || body || {}) };
      const prompt = buildMegaPrompt(stateToUse);

      return jsonResponse({
        success: true,
        status: 'success',
        message: 'Master prompt generated successfully',
        data: {
          article: articleId,
          prompt,
          promptLength: prompt.length,
        },
      }, 200, headers);
    }

    // Action: GENERATE or OPTIMIZE
    if (action === 'generate' || action === 'optimize') {
      const stateToUse = { ...(articleState || {}), ...(body?.state || body || {}) };
      if (!stateToUse.mainKeyword && (!stateToUse.combinedOutline || stateToUse.combinedOutline.length === 0)) {
        fail('Main keyword or outline is required to generate article content.', 400);
      }

      const prompt = body?.prompt || stateToUse.masterPrompt || buildMegaPrompt(stateToUse);
      if (String(prompt).length > MAX_PROMPT_CHARS) {
        fail('Prompt is too large to process.', 413);
      }

      const apiKey = await loadDeepSeekApiKey(userId, env);
      const rawText = await callDeepSeekAi(prompt, apiKey);

      const htmlContent = markdownToHtml(rawText);
      const { title: extractedTitle, html: cleanedHtml } = extractTitleAndCleanHtml(htmlContent);

      const generatedTitle = extractedTitle || stateToUse.articleTitle || stateToUse.mainKeyword || 'Untitled Article';
      const finalHtml = cleanedHtml || htmlContent;

      const updatedState = {
        ...stateToUse,
        articleTitle: generatedTitle,
        content: finalHtml,
        masterPrompt: prompt,
        currentStep: 13,
      };

      const analysis = analyzeArticleContent(finalHtml, updatedState);
      updatedState.contentScore = analysis.contentScore;

      // Persist if save requested or default
      if (body?.save !== false) {
        const updatedMeta = {
          id: articleId,
          title: generatedTitle,
          keyword: updatedState.mainKeyword || '',
          mode: updatedState.writerMode || 'express',
          createdAt: articleMeta?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentStep: 13,
        };

        const existingMetaIndex = savedArticles.findIndex(a => a.id === articleId);
        if (existingMetaIndex >= 0) {
          savedArticles[existingMetaIndex] = updatedMeta;
        } else {
          savedArticles.unshift(updatedMeta);
        }

        try {
          await patchMySqlDocument(env, 'project_data', userId, {
            [stateKey]: updatedState,
            contentWriterArticles: savedArticles,
          });
        } catch (saveError) {
          console.warn('Could not persist generated content:', saveError?.message);
        }
      }

      return jsonResponse({
        success: true,
        status: 'success',
        message: 'Article content generated and optimized successfully',
        data: {
          article: articleId,
          title: generatedTitle,
          content: finalHtml,
          rawMarkdown: rawText,
          contentScore: analysis.contentScore,
          analysis,
          state: updatedState,
        },
      }, 200, headers);
    }

    // Action: DISCOVER_COMPETITORS or FIND_COMPETITORS
    if (action === 'discover_competitors' || action === 'find_competitors') {
      const projectUrl = String(body?.project_url || body?.url || body?.domain || articleState?.mainKeyword || '').trim();
      if (!projectUrl) {
        fail('Website/Project URL is required for competitor discovery.', 400);
      }

      let targetOrigin = '';
      let targetHostname = '';
      try {
        const parsed = new URL(/^https?:\/\//i.test(projectUrl) ? projectUrl : `https://${projectUrl}`);
        targetOrigin = parsed.origin;
        targetHostname = parsed.hostname.toLowerCase().replace(/^www\./i, '');
      } catch {
        fail('Invalid website/project URL format.', 400);
      }

      const prompt = `Analyze the website:
${targetOrigin}

Identify 3 to 5 of the most relevant direct organic search and business competitor websites for this domain.

Return ONLY a valid JSON object with this exact structure:
{
  "competitors": [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ]
}
Do not return explanations, descriptions, social media profiles, directories, or search engines.
Return a clean structured JSON list of competitor URLs starting with https://.`;

      const apiKey = await loadDeepSeekApiKey(userId, env);
      const rawText = await callDeepSeekAi(prompt, apiKey);

      let discoveredUrls = [];
      try {
        const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
        if (Array.isArray(parsed?.competitors)) {
          discoveredUrls = parsed.competitors;
        } else if (Array.isArray(parsed)) {
          discoveredUrls = parsed;
        }
      } catch {
        const matches = rawText.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [];
        discoveredUrls = matches;
      }

      const validCompetitors = [...new Set(
        discoveredUrls
          .map(u => normalizeCompetitorUrl(u, targetHostname))
          .filter(Boolean)
      )];

      // Merge with existing competitors if article exists
      let updatedCompetitors = validCompetitors;
      if (articleState) {
        const existing = Array.isArray(articleState.competitors)
          ? articleState.competitors.filter(c => String(c || '').trim())
          : [];
        const merged = [...existing];
        validCompetitors.forEach(u => {
          if (!merged.includes(u)) merged.push(u);
        });
        updatedCompetitors = merged.length > 0 ? merged : [''];

        if (body?.save) {
          const updatedState = { ...articleState, competitors: updatedCompetitors };
          try {
            await patchMySqlDocument(env, 'project_data', userId, {
              [stateKey]: updatedState,
            });
          } catch (saveError) {
            console.warn('Could not persist updated competitors:', saveError?.message);
          }
        }
      }

      return jsonResponse({
        success: true,
        status: 'success',
        message: `${validCompetitors.length} competitor website(s) discovered`,
        data: {
          article: articleId,
          projectUrl: targetOrigin,
          discoveredCompetitors: validCompetitors,
          competitors: updatedCompetitors,
        },
      }, 200, headers);
    }

    fail(`Unsupported action "${action}". Valid actions: get, save, analyze, score, build_prompt, generate, discover_competitors.`, 400);
  } catch (error) {
    return apiError(error, headers);
  }
}

export default onRequest;
