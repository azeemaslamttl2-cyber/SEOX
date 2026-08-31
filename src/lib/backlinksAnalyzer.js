export const ADULT_GAMBLING_KEYWORDS = [
  "casino", "poker", "gambling", "bet", "slots", "adult", "xxx", "porn", "sex", "escort", "dating", "lottery", "betting", "blackjack", "roulette",
];

export const SPAMMY_TLDS = [
  ".xyz", ".info", ".online", ".site", ".top", ".club", ".work", ".click", ".link", ".space", ".pro", ".icu", ".buzz", ".monster", ".bond", ".homes", ".shop", ".store", ".live", ".life", ".fun", ".biz",
];

export const FOREIGN_TLD_LANGUAGES = {
  ".ru": "Russian", ".cn": "Chinese", ".jp": "Japanese", ".kr": "Korean", ".br": "Portuguese", ".de": "German", ".fr": "French", ".it": "Italian", ".es": "Spanish", ".pl": "Polish", ".tr": "Turkish", ".in": "Indian", ".pk": "Pakistani", ".ir": "Persian",
};

export const DEFAULT_CHECKS = {
  foreign: true,
  spammy_tld: true,
  adult_gambling: true,
  low_quality: true,
  irrelevant: true,
};

function parseCSVLine(line, delimiter = ",") {
  if (delimiter === "\t") return line.split("\t").map((value) => value.trim().replace(/^['"]|['"]$/g, ""));
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function extractDomainFromUrl(value) {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "").replace(/^(https?:\/\/)?(www\.)?/i, "").split(/[/?#]/)[0];
  }
}

function extractTld(domain) {
  const parts = String(domain || "").split(".").filter(Boolean);
  if (parts.length < 2) return "";
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (["co", "com", "org", "net", "edu", "gov"].includes(secondLast) && parts.length > 2) return `.${secondLast}.${last}`;
  return `.${last}`;
}

export function parseBacklinkText(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { results: [], format: "domain", headers: [] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseCSVLine(lines[0], delimiter).map((header) => header.trim().replace(/['"]/g, "").toLowerCase());
  const domainIndex = headers.findIndex((header) => header === "domain" || header.includes("referring domain"));
  const sourceUrlIndex = headers.findIndex((header) => header === "source url" || header === "source_url" || header === "source page title and url");
  const urlIndex = headers.findIndex((header) => (header.includes("url") || header.includes("link") || header.includes("backlink")) && header !== "target url");
  const scoreIndex = headers.findIndex((header) => header === "dr" || header.includes("ascore") || header.includes("da") || header.includes("domain rating") || header.includes("domain authority") || header.includes("authority score"));
  const countryIndex = headers.findIndex((header) => header.includes("country"));
  const linksIndex = headers.findIndex((header) => header === "backlinks" || header.includes("links to target") || header.includes("ref domains") || header === "ext. links" || header === "external links");
  const trafficIndex = headers.findIndex((header) => header === "traffic");
  const format = sourceUrlIndex !== -1 ? "url" : "domain";

  const results = [];
  const seen = new Set();
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCSVLine(lines[index], delimiter);
    const sourceUrl = sourceUrlIndex !== -1 ? values[sourceUrlIndex]?.trim().replace(/['"]/g, "") : "";
    const rawDomain = domainIndex !== -1 ? values[domainIndex]?.trim().replace(/['"]/g, "") : "";
    const rawUrl = sourceUrl || (urlIndex !== -1 ? values[urlIndex]?.trim().replace(/['"]/g, "") : "");
    const domain = rawDomain || extractDomainFromUrl(rawUrl);
    if (!domain || domain.length < 3 || seen.has(`${domain}-${rawUrl}`)) continue;
    seen.add(`${domain}-${rawUrl}`);
    results.push({
      id: index,
      domain,
      url: rawUrl || `https://${domain}`,
      sourceUrl: sourceUrl || "",
      tld: extractTld(domain),
      dr: scoreIndex !== -1 ? parseInt(String(values[scoreIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
      country: countryIndex !== -1 ? String(values[countryIndex] || "").trim().toUpperCase() : "",
      backlinks: linksIndex !== -1 ? parseInt(String(values[linksIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
      traffic: trafficIndex !== -1 ? parseInt(String(values[trafficIndex] || "").replace(/[^\d]/g, ""), 10) || 0 : 0,
    });
  }
  return { results, format, headers };
}

export function analyzeBacklink(link, keywords = [], checks = DEFAULT_CHECKS) {
  const flags = [];
  const domain = String(link.domain || "").toLowerCase();
  const tld = String(link.tld || extractTld(domain)).toLowerCase();
  if (checks.foreign) {
    const matchedTld = Object.keys(FOREIGN_TLD_LANGUAGES).find((item) => tld === item || tld.endsWith(item));
    if (matchedTld) flags.push({ type: "foreign", severity: "high", message: `Foreign (${FOREIGN_TLD_LANGUAGES[matchedTld]})` });
  }
  if (checks.spammy_tld && SPAMMY_TLDS.some((item) => tld === item || tld.endsWith(item))) flags.push({ type: "spammy_tld", severity: "critical", message: `Spammy TLD (${tld})` });
  if (checks.adult_gambling && ADULT_GAMBLING_KEYWORDS.some((keyword) => domain.includes(keyword))) flags.push({ type: "adult_gambling", severity: "medium", message: "Adult/gambling content" });
  if (checks.low_quality && Number(link.dr) <= 5) flags.push({ type: "low_quality", severity: "info", message: `Low quality (AS/DR: ${link.dr})` });
  if (checks.irrelevant && keywords.length > 0 && !keywords.some((keyword) => domain.includes(keyword))) flags.push({ type: "irrelevant", severity: "low", message: "Irrelevant niche" });
  return { ...link, tld, flags };
}

export function calculateBacklinkStats(analyzedBacklinks) {
  return {
    total: analyzedBacklinks.length,
    spammy: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "spammy_tld")).length,
    foreign: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "foreign")).length,
    adult: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "adult_gambling")).length,
    irrelevant: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "irrelevant")).length,
    low: analyzedBacklinks.filter((link) => link.flags.some((flag) => flag.type === "low_quality")).length,
    clean: analyzedBacklinks.filter((link) => link.flags.length === 0).length,
  };
}

export function normalizeBacklinkRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => {
    const domain = String(row?.domain ?? row?.Domain ?? row?.referringDomain ?? "").trim() || extractDomainFromUrl(row?.url ?? row?.Url ?? row?.sourceUrl ?? row?.SourceUrl);
    const url = String(row?.url ?? row?.Url ?? row?.sourceUrl ?? row?.SourceUrl ?? (domain ? `https://${domain}` : "")).trim();
    return {
      id: row?.id ?? index + 1,
      domain,
      url,
      sourceUrl: String(row?.sourceUrl ?? row?.SourceUrl ?? "").trim(),
      tld: String(row?.tld || extractTld(domain)),
      dr: Number(row?.dr ?? row?.DR ?? row?.da ?? row?.DA ?? row?.domainRating ?? 0) || 0,
      country: String(row?.country ?? row?.Country ?? "").trim().toUpperCase(),
      backlinks: Number(row?.backlinks ?? row?.Backlinks ?? row?.links ?? row?.Links ?? 0) || 0,
      traffic: Number(row?.traffic ?? row?.Traffic ?? 0) || 0,
    };
  }).filter((row) => row.domain.length >= 3);
}

export function analyzeBacklinks({ text, backlinks, keywords = "", checks = DEFAULT_CHECKS } = {}) {
  let parsed = { results: [], format: "domain", headers: [] };
  if (text !== undefined) parsed = parseBacklinkText(text);
  else if (Array.isArray(backlinks)) parsed = { results: normalizeBacklinkRows(backlinks), format: "domain", headers: [] };
  const normalizedChecks = { ...DEFAULT_CHECKS, ...(checks && typeof checks === "object" ? checks : {}) };
  const keywordList = String(keywords || "").toLowerCase().split(",").map((item) => item.trim()).filter(Boolean);
  const analyzedBacklinks = parsed.results.map((link) => analyzeBacklink(link, keywordList, normalizedChecks));
  return {
    backlinks: parsed.results,
    analyzedBacklinks,
    stats: calculateBacklinkStats(analyzedBacklinks),
    csvFormat: parsed.format,
    keywords: keywordList,
    enabledChecks: normalizedChecks,
    headers: parsed.headers,
  };
}
