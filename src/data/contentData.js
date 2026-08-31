// ─── Outline Creator ───
export const outlineData = {
  sampleOutline: [
    { tag: "h1", text: "Complete Guide to SEO Tools in 2025" },
    { tag: "h2", text: "What Are SEO Tools?" },
    { tag: "h3", text: "Types of SEO Tools" },
    { tag: "h2", text: "Best Free SEO Tools" },
    { tag: "h3", text: "Google Search Console" },
    { tag: "h3", text: "Google Analytics" },
    { tag: "h2", text: "Best Paid SEO Tools" },
    { tag: "h3", text: "Ahrefs" },
    { tag: "h3", text: "SEMrush" },
    { tag: "h2", text: "How to Choose the Right Tool" },
    { tag: "h2", text: "Conclusion" },
  ],
};

// ─── Entities Extractor ───
export const entitiesExtractorData = {
  sampleEntities: [
    { entity: "Google", type: "Organization", salience: 0.89, mentions: 12 },
    { entity: "Search Engine Optimization", type: "Concept", salience: 0.82, mentions: 8 },
    { entity: "PageRank", type: "Technology", salience: 0.71, mentions: 5 },
    { entity: "Larry Page", type: "Person", salience: 0.45, mentions: 3 },
    { entity: "Mountain View", type: "Location", salience: 0.32, mentions: 2 },
    { entity: "HTML", type: "Technology", salience: 0.55, mentions: 6 },
    { entity: "Backlinks", type: "Concept", salience: 0.78, mentions: 9 },
  ],
};

// ─── Entities Generator ───
export const entitiesGeneratorData = {
  sampleKeywords: ["seo tools", "keyword research", "content optimization"],
  sampleEntities: [
    { keyword: "seo tools", entities: ["Google Search Console", "SEMrush", "Ahrefs", "Moz Pro", "Screaming Frog"] },
    { keyword: "keyword research", entities: ["Search Volume", "CPC", "Keyword Difficulty", "Long-tail Keywords", "SERP Analysis"] },
    { keyword: "content optimization", entities: ["TF-IDF", "NLP", "Content Score", "Readability", "Semantic Relevance"] },
  ],
};

// ─── N-Grams Extractor ───
export const ngramsData = {
  sampleNgrams: {
    unigrams: [
      { ngram: "seo", count: 45, density: "3.2%" },
      { ngram: "content", count: 38, density: "2.7%" },
      { ngram: "keyword", count: 32, density: "2.3%" },
      { ngram: "search", count: 28, density: "2.0%" },
      { ngram: "optimization", count: 24, density: "1.7%" },
    ],
    bigrams: [
      { ngram: "search engine", count: 18, density: "1.3%" },
      { ngram: "keyword research", count: 15, density: "1.1%" },
      { ngram: "content optimization", count: 12, density: "0.9%" },
      { ngram: "link building", count: 10, density: "0.7%" },
    ],
    trigrams: [
      { ngram: "search engine optimization", count: 12, density: "0.9%" },
      { ngram: "google search console", count: 8, density: "0.6%" },
      { ngram: "on page seo", count: 7, density: "0.5%" },
    ],
  },
};

// ─── NLP Extractor ───
export const nlpData = {
  sampleResults: [
    { keyword: "search engine optimization", relevance: 95, type: "Topic", sentiment: "Neutral" },
    { keyword: "content marketing strategy", relevance: 88, type: "Concept", sentiment: "Positive" },
    { keyword: "technical seo audit", relevance: 82, type: "Process", sentiment: "Neutral" },
    { keyword: "organic traffic growth", relevance: 79, type: "Metric", sentiment: "Positive" },
    { keyword: "backlink profile", relevance: 75, type: "Asset", sentiment: "Neutral" },
    { keyword: "user experience", relevance: 71, type: "Factor", sentiment: "Positive" },
  ],
};

// ─── Grammar Generator ───
export const grammarData = {
  exampleTopics: ["Laptop", "Coffee", "Marketing", "Fitness", "Photography"],
  sampleResults: {
    properNouns: ["MacBook Pro", "Nikon", "Adobe Photoshop", "Nike", "Starbucks"],
    commonNouns: ["laptop", "camera", "software", "coffee", "fitness"],
    synonyms: ["device → gadget", "powerful → robust", "fast → swift", "create → produce"],
    antonyms: ["fast ↔ slow", "heavy ↔ light", "expensive ↔ affordable", "digital ↔ analog"],
    hyponyms: ["laptop → MacBook, ThinkPad, Chromebook", "coffee → espresso, latte, cappuccino"],
    hypernyms: ["laptop → computer → device", "coffee → beverage → liquid"],
    meronyms: ["laptop → keyboard, screen, battery", "camera → lens, sensor, shutter"],
    holonyms: ["keyboard → laptop", "lens → camera", "chapter → book"],
  },
};

// ─── Unique N-Grams ───
export const uniqueNgramsData = {
  exampleTopics: ["hot water benefits", "laptop maintenance", "email marketing", "home gardening", "yoga for beginners"],
  sampleResults: [
    "drinking hot water during winter",
    "lukewarm water after dinner",
    "morning warm water detox routine",
    "heated water for joint relief",
    "thermal hydration morning practice",
  ],
};

// ─── Skip Gram Words ───
export const skipGramData = {
  exampleWords: ["bank", "python", "cloud", "apple", "spring"],
  howItWorks: [
    { title: "Word Sense Disambiguation", desc: 'For "bank": financial → money, loan, account | River → water, stream, shore', color: "blue" },
    { title: "Document Summarization", desc: 'For "climate change": global warming, emissions, renewable energy, fossil fuels', color: "amber" },
    { title: "Keyword Extraction", desc: 'For "machine learning": neural networks, regression, classification, gradient descent', color: "emerald" },
  ],
  sampleResults: {
    bank: ["financial", "account", "money", "river", "loan", "deposit", "stream", "credit"],
    python: ["programming", "snake", "code", "library", "django", "data", "reptile", "syntax"],
  },
};

// ─── Content Optimization ───
export const contentOptData = {
  checklist: [
    { item: "40 word featured snippet", done: false },
    { item: "Answer Boolean Questions", done: false },
    { item: "How to Answer Type/Listing Questions", done: false },
    { item: "Author Rules", done: false },
    { item: "Avoid Analogies", done: false },
    { item: "Avoid Confusing Users or Bots", done: false },
    { item: "Avoid Copy Pasting Questions", done: false },
    { item: "Avoid Coreference Error", done: false },
    { item: "Avoid Everyday Language in Articles", done: false },
    { item: "Avoid Linking to Citations", done: false },
    { item: "Avoid Opinion in Articles", done: false },
  ],
};

// ─── ChatGPT Watermark Remover ───
export const watermarkData = {
  features: [
    { title: "Detect AI Watermarks", desc: "Find hidden characters that AI detection systems use to identify content produced by ChatGPT, Claude, and other AI tools.", icon: "search", color: "rose" },
    { title: "Clean AI-Generated Text", desc: "Completely remove zero-width spaces, zero-width joiners, and other invisible characters from your text.", icon: "sparkles", color: "blue" },
    { title: "See What Was Removed", desc: "Get detailed statistics about detected watermark characters and see exactly what invisible unicode characters were removed.", icon: "eye", color: "violet" },
    { title: "Remove EM Dashes from ChatGPT", desc: "Automatically detect and handle em dashes, two-em dashes, and three em dashes that AI systems may use.", icon: "minus", color: "amber" },
  ],
  options: [
    { label: "Show spaces as · in output", default: true },
    { label: "Show tabs as → in output", default: true },
    { label: "Handle em dashes (— — —)", default: false },
  ],
};
