const MAX_ITEMS_PER_GROUP = 50;
const MAX_ITEM_LENGTH = 240;

const SECTION_LABELS = {
    entities: 'Entities',
    ngrams: 'N-Grams',
    nlp: 'NLP keywords',
    grammar: 'Grammar relationships',
    uniqueNgrams: 'Unique N-Grams',
    skipGrams: 'Skip-Gram words',
};

const GROUP_KEYS = {
    ngrams: ['bigrams', 'trigrams', 'fourgrams'],
    nlp: ['primaryKeywords', 'secondaryKeywords', 'lsiKeywords'],
    grammar: [
        'proper_nouns',
        'common_nouns',
        'synonyms',
        'antonyms',
        'hyponyms',
        'hypernyms',
        'meronyms',
        'holonyms',
    ],
    uniqueNgrams: ['informational', 'commercial', 'longtail', 'authority'],
};

export class SemanticKeywordResponseError extends Error {
    constructor(sectionKey) {
        const label = SECTION_LABELS[sectionKey] || 'AI analysis';
        super(`${label} returned incomplete data. Please generate the analysis again.`);
        this.name = 'SemanticKeywordResponseError';
    }
}

function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH);
}

function cleanList(value) {
    if (!Array.isArray(value)) return [];

    const seen = new Set();
    const result = [];
    for (const item of value) {
        const text = cleanText(item);
        const normalized = text.toLocaleLowerCase();
        if (!text || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(text);
        if (result.length >= MAX_ITEMS_PER_GROUP) break;
    }
    return result;
}

function normalizeGroups(value, keys) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.fromEntries(keys.map((key) => [key, cleanList(source[key])]));
}

function countValues(value) {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== 'object') return 0;
    return Object.values(value).reduce((total, item) => total + countValues(item), 0);
}

export function normalizeSemanticKeywordResult(sectionKey, value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    if (!source) throw new SemanticKeywordResponseError(sectionKey);

    let normalized;
    if (sectionKey === 'entities') {
        normalized = {
            entities: cleanList(source.entities),
            entityTypes: normalizeGroups(source.entityTypes, [
                'people',
                'organizations',
                'concepts',
                'products',
                'locations',
            ]),
        };
    } else if (sectionKey === 'skipGrams') {
        const senses = Array.isArray(source.word_sense_disambiguation)
            ? source.word_sense_disambiguation
                .slice(0, 12)
                .map((item) => ({
                    sense: cleanText(item?.sense),
                    dominant_words: cleanList(item?.dominant_words),
                }))
                .filter((item) => item.sense && item.dominant_words.length > 0)
            : [];

        normalized = {
            word_sense_disambiguation: senses,
            document_summarization: cleanList(source.document_summarization),
            keyword_extraction: cleanList(source.keyword_extraction),
        };
    } else if (GROUP_KEYS[sectionKey]) {
        normalized = normalizeGroups(source, GROUP_KEYS[sectionKey]);
    } else {
        throw new SemanticKeywordResponseError(sectionKey);
    }

    if (countValues(normalized) === 0) {
        throw new SemanticKeywordResponseError(sectionKey);
    }
    return normalized;
}

export function parseSemanticKeywordResponse(sectionKey, text) {
    const candidate = typeof text === 'string' ? text.trim() : '';
    if (!candidate) throw new SemanticKeywordResponseError(sectionKey);

    try {
        return normalizeSemanticKeywordResult(sectionKey, JSON.parse(candidate));
    } catch (error) {
        if (error instanceof SemanticKeywordResponseError) throw error;
        throw new SemanticKeywordResponseError(sectionKey);
    }
}
