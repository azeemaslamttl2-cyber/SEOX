// ─── Keyword Research Tool (main page) ───
export const keywordResearchData = {
  countries: [
    { code: "US", name: "United States" },
    { code: "UK", name: "United Kingdom" },
    { code: "PK", name: "Pakistan" },
    { code: "IN", name: "India" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
  ],
  languages: ["English", "Spanish", "French", "German", "Arabic", "Urdu"],
  sampleResults: [
    { keyword: "seo tools", volume: 33100, cpc: 4.52, competition: "High", trend: "↑" },
    { keyword: "seo tools free", volume: 12100, cpc: 2.18, competition: "Medium", trend: "↑" },
    { keyword: "best seo tools", volume: 8100, cpc: 6.32, competition: "High", trend: "→" },
    { keyword: "seo tools for beginners", volume: 2400, cpc: 3.12, competition: "Low", trend: "↑" },
    { keyword: "seo tools online", volume: 1900, cpc: 2.95, competition: "Medium", trend: "→" },
    { keyword: "seo checker tool", volume: 4400, cpc: 3.80, competition: "Medium", trend: "↑" },
    { keyword: "seo audit tool", volume: 6600, cpc: 5.10, competition: "High", trend: "↑" },
    { keyword: "free seo analysis", volume: 9900, cpc: 1.50, competition: "Low", trend: "→" },
  ],
};

// ─── Suggest Keywords ───
export const suggestKeywordsData = {
  letterVariations: {
    "+A": ["pakistan afghanistan war", "pakistan afghanistan", "pakistan army", "pakistan air force", "pakistan acronym", "pakistan and india", "pakistan army chief", "pakistan attacks afghanistan", "pakistan armed forces", "pakistan and iran"],
    "+B": ["pakistan bangladesh cricket", "pakistan borders", "pakistan bombs afghanistan", "pakistan bangladesh", "pakistan beaches", "pakistan bordering countries", "pakistan birth rate", "pakistan biggest cities", "pakistan balochistan", "pakistan bangladesh war"],
    "+C": ["pakistan cricket", "pakistan cricket schedule", "pakistan capital", "pakistan currency", "pakistan consulate", "pakistan cities", "pakistan currency to usd", "pakistan consulate houston", "pakistan china", "pakistan cricket team"],
    "+D": ["pakistan date and time", "pakistan debt", "pakistan dollar rate", "pakistan day", "pakistan demographics", "pakistan dhanandhar", "pakistan dress", "pakistan drama", "pakistan declares war on afghanistan", "pakistan defence forum"],
    "+E": ["pakistan embassy", "pakistan economy", "pakistan embassy washington dc", "pakistan elections", "pakistan eid ul adha 2026", "pakistan embassy houston", "pakistan embassy new york", "pakistan embassy in usa", "pakistan ethnic groups", "pakistan embassy chicago"],
  },
  numberVariations: {
    "+0": ["pakistan 007", "pakistan 0-1 india"],
    "+1": ["pakistan 1947", "pakistan 14 august"],
    "+2": ["pakistan 2024", "pakistan 23 march"],
    "+3": ["pakistan 3rd odi", "pakistan 30 march"],
  },
  googleSuggestions: [
    "pakistan news", "pakistan", "pakistan time", "pakistan super league",
    "pakistan cricket", "pakistan restaurant near me", "pakistan afghanistan war",
    "pakistan flag", "pakistan national cricket team", "pakistan map",
  ],
};

// ─── Ubersuggest ───
export const ubersuggestData = {
  stats: { questions: 120, prepositions: 100, comparisons: 50 },
  questions: {
    who: ["who pakistan president", "who pakistan at war with", "who pakistan prime minister", "who pakistan cricket coach", "who pakistani player played ipl", "who pakistan jobs", "who pakistan careers", "who pakistan cricket team captain", "who pakistan player played ipl 2025", "who pakistan office"],
    what: ["what pakistan language", "what pakistani holiday is today", "what pakistani drama should i watch", "what pakistan stands for", "what pakistan holiday is tomorrow", "what pakistan is famous for", "what pakistan exports", "what pakistan eat", "what pakistan needs to qualify", "what pakistan did"],
    where: ["where pakistan is located", "where pakistan is located in asia", "where pakistan india match", "where pakistan and india one country", "where pakistan import oil", "where pakistan tested nuclear bomb", "where pakistan buy petrol", "where pakistan is located in world map", "where pakistan conducted nuclear test", "where pakistan actors live"],
    when: ["when pakistan became nuclear power", "when pakistan was created", "when pakistan became a country", "when pakistan separated from india", "when pakistan made nuclear bomb", "when pakistan got independence", "when pakistan got nuclear weapons", "when pakistan won world cup"],
    why: ["why pakistan and afghanistan are fighting", "why pakistan attacked afghanistan", "why pakistan and india are enemies", "why pakistan wants kashmir", "why pakistan idol stopped", "why pakistan and india fight", "why pakistan and afghanistan war", "why pakistan and india separated"],
    how: ["how pakistan got nuclear weapons", "how pakistan got nukes", "how pakistan has nuclear weapons", "how pakistan get nuclear weapons", "how pakistan became nuclear power", "how pakistan was created", "how pakistan developed nuclear weapons", "how pakistan got its name"],
  },
  prepositions: {
    to: ["pakistan to usd", "pakistan to iran", "pakistan today", "pakistan tourism", "pakistan to english", "pakistan time", "pakistan to iran distance", "pakistan tour of bangladesh 2026", "pakistan to israel distance", "pakistan total population"],
    with: ["pakistan with iran", "pakistan with kashmir", "pakistan with kashmir map", "pakistan with afghanistan", "pakistan with us", "pakistan with blue eyes", "pakistan with israel", "pakistan with bangladesh", "pakistan withholding tax", "pakistan without visa countries"],
    for: ["pakistan foreign minister", "pakistan forex reserves", "pakistan foreign reserves", "pakistan former prime minister", "pakistan forex reserves today", "pakistan forex", "pakistan forest", "pakistan formation", "pakistan form of government", "pakistan foreign ministry"],
  },
  comparisons: {
    versus: ["pakistan versus afghanistan", "pakistan versus india", "pakistan versus bangladesh", "pakistan versus iran", "pakistan versus australia", "pakistan vs afghanistan war", "pakistan versus new zealand", "pakistan versus south africa", "pakistan versus sri lanka", "pakistan versus england"],
    and: ["pakistan and afghanistan", "pakistan and india", "pakistan and iran", "pakistan and afghanistan war", "pakistan and iran relations", "pakistan and india conflict", "pakistan and india war", "pakistan and israel", "pakistan and us relations", "pakistan and afghanistan conflict"],
    or: ["pakistan origin", "pakistan ordnance factory", "pakistan origin card", "pakistan ordnance factory mp5", "pakistan original name", "pakistan or partition of india pdf", "pakistan orphanage", "pakistan origin card (poc)", "pakistan president", "pakistan or india"],
  },
};

// ─── New Keywords (GSC-powered) ───
export const newKeywordsData = {
  domain: "https://www.example.com/",
  dateRange: "23 Apr – 23 May",
  prevRange: "23 Mar – 22 Apr",
  highlights: {
    totalNew: 498,
    impressions: "2.2K",
    clicks: 3,
  },
  keywords: [
    { keyword: "200 amp convert to kw", topPage: "/17", position: 9.8, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 4, impChange: "↑ +∞%" },
    { keyword: "22 amps to kw", topPage: "/17", position: 6.7, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 3, impChange: "↑ +∞%" },
    { keyword: "800 ampere in kw", topPage: "/17", position: 5.3, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 9, impChange: "↑ +∞%" },
    { keyword: "0.37kw to amps", topPage: "/17", position: 11.3, change: "—", clicks: 0, clicksChange: "0%", impressions: 8, impChange: "↑ +∞%" },
    { keyword: "0.60kw", topPage: "/ko ↗", position: 5.0, change: "—", clicks: 0, clicksChange: "0%", impressions: 1, impChange: "↑ +∞%" },
    { keyword: "0.75kw in amps", topPage: "/17", position: 12.0, change: "—", clicks: 0, clicksChange: "0%", impressions: 2, impChange: "↑ +∞%" },
    { keyword: "0.75kw to amps", topPage: "/17", position: 9.0, change: "—", clicks: 0, clicksChange: "0%", impressions: 4, impChange: "↑ +∞%" },
    { keyword: "0.75kw to amps in 3 phase", topPage: "/17", position: 12.0, change: "—", clicks: 0, clicksChange: "0%", impressions: 1, impChange: "↑ +∞%" },
  ],
};

// ─── Low Hanging Keywords ───
export const lowHangingData = {
  domain: "https://www.example.com/",
  highlights: { totalNew: 498, impressions: "2.2K", clicks: 3 },
  keywords: [
    { keyword: "200 amp convert to kw", topPage: "/17", position: 9.8, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 4, impChange: "↑ +∞%" },
    { keyword: "22 amps to kw", topPage: "/17", position: 6.7, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 3, impChange: "↑ +∞%" },
    { keyword: "800 ampere in kw", topPage: "/17", position: 5.3, change: "—", clicks: 1, clicksChange: "↑ +∞%", impressions: 9, impChange: "↑ +∞%" },
    { keyword: "0.37kw to amps", topPage: "/17", position: 11.3, change: "—", clicks: 0, clicksChange: "0%", impressions: 8, impChange: "↑ +∞%" },
    { keyword: "0.60kw", topPage: "/ko ↗", position: 5.0, change: "—", clicks: 0, clicksChange: "0%", impressions: 1, impChange: "↑ +∞%" },
  ],
};

// ─── Lost Keywords ───
export const lostKeywordsData = {
  domain: "https://www.example.com/",
  highlights: { totalLost: 0, message: "ranked for 0 keywords that no longer appear in the current period." },
  keywords: [],
};

// ─── Branded Keywords ───
export const brandedKeywordsData = {
  domain: "https://www.example.com/",
  brandName: "example",
  highlights: { total: 0, message: '0 branded keywords containing "example" drive traffic to your site.' },
  keywords: [],
};

// ─── Keyword Cannibalization ───
export const cannibalizationData = {
  domain: "https://natro-macro.com/",
  keywords: [
    { keyword: "natro macro", pages: 3, impressions: 89, percentChange: "-95%", position: 25.6, posChange: -27.2, clicks: 0, clickChange: "-100%" },
    { keyword: "natro", pages: 7, impressions: 55, percentChange: "-75%", position: 42.2, posChange: 15.0, clicks: 0, clickChange: "0%" },
    { keyword: "natro macro github", pages: 2, impressions: 29, percentChange: "-53%", position: 10.8, posChange: -1.5, clicks: 0, clickChange: "0%" },
    { keyword: "natro macro download", pages: 3, impressions: 20, percentChange: "-75%", position: 35.9, posChange: -16.4, clicks: 0, clickChange: "-100%" },
    { keyword: "natromacro", pages: 3, impressions: 11, percentChange: "-78%", position: 55.8, posChange: -45.3, clicks: 0, clickChange: "N/A" },
  ],
};
