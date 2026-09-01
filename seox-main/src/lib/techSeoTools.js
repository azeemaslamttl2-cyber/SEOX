const FETCH_META_PATH = "/api/fetch-url-meta";

const RESOURCE_RE = /\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|map|woff|woff2|ttf|eot|otf|pdf|zip|gz|mp4|mp3|webm|xml|json|rss|atom)(?:$|[?#])/i;

export function normalizeToolUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Enter a domain or URL.");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function fetchPageHtml(url) {
  const target = normalizeToolUrl(url);
  const metaPath = `${FETCH_META_PATH}?url=${encodeURIComponent(target)}&returnHtml=true`;
  const metaResponse = await fetch(metaPath, { headers: { Accept: "application/json" } }).catch(() => null);
  if (metaResponse?.ok) {
    const payload = await metaResponse.json().catch(() => null);
    if (payload?.html) {
      return {
        url: payload.url || target,
        finalUrl: payload.url || target,
        statusCode: payload.statusCode || 200,
        contentType: "text/html",
        html: payload.html,
      };
    }
  }

  const proxyResponse = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: target }),
  });
  const proxyPayload = await proxyResponse.json().catch(() => null);
  if (!proxyResponse.ok || !proxyPayload?.content) {
    throw new Error(proxyPayload?.error || proxyPayload?.message || `Could not fetch ${target}`);
  }

  return {
    url: target,
    finalUrl: proxyPayload.url || target,
    statusCode: proxyPayload.statusCode || 200,
    contentType: proxyPayload.contentType || "text/html",
    html: proxyPayload.content,
  };
}

export async function fetchText(url) {
  const target = normalizeToolUrl(url);
  const response = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`, {
    headers: { Accept: "text/plain, text/html, application/xml, */*" },
  });
  if (!response.ok) throw new Error(`Could not fetch ${target}: HTTP ${response.status}`);
  return response.text();
}

export function stripHtml(html) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    ["script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "iframe"].forEach((tag) => {
      doc.querySelectorAll(tag).forEach((node) => node.remove());
    });
    return cleanText(doc.body?.textContent || "");
  }
  return cleanText(String(html || "").replace(/<[^>]+>/g, " "));
}

export function extractTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Untitled")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractLinks(html, baseUrl) {
  const links = [];
  const add = (href) => {
    if (!href || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return;
    try {
      const url = new URL(href, baseUrl);
      url.hash = "";
      links.push(url.toString());
    } catch {
      // Ignore invalid hrefs.
    }
  };

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("a[href]").forEach((node) => add(node.getAttribute("href")));
  } else {
    for (const match of String(html || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
      add(match[1]);
    }
  }

  return [...new Set(links)];
}

export function splitIntoSentences(text, minWords = 8) {
  return cleanText(text)
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(/\s+/).filter(Boolean).length >= minWords);
}

export function extractPhrase(sentence, maxWords = 12) {
  const words = cleanText(sentence).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords + 3) return words.join(" ");
  const start = Math.max(0, Math.floor((words.length - maxWords) / 2));
  return words.slice(start, start + maxWords).join(" ");
}

export function normalizeForComparison(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateNgrams(text, size = 6) {
  const words = normalizeForComparison(text).split(/\s+/).filter(Boolean);
  const grams = [];
  for (let i = 0; i <= words.length - size; i += 1) {
    grams.push(words.slice(i, i + size).join(" "));
  }
  return grams;
}

export function wordCount(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

export async function discoverInternalPages(startUrl, maxPages = 20, onProgress = () => {}) {
  const baseUrl = normalizeToolUrl(startUrl);
  const origin = new URL(baseUrl).origin;
  const urls = new Set();
  const seenSitemaps = new Set();
  const sitemapQueue = [
    new URL("/sitemap.xml", origin).toString(),
    new URL("/sitemap_index.xml", origin).toString(),
    new URL("/wp-sitemap.xml", origin).toString(),
    new URL("/post-sitemap.xml", origin).toString(),
    new URL("/page-sitemap.xml", origin).toString(),
  ];

  const addUrl = (candidate, relativeBase = origin) => {
    try {
      const parsed = new URL(candidate, relativeBase);
      parsed.hash = "";
      if (parsed.origin !== origin) return;
      if (RESOURCE_RE.test(parsed.pathname)) return;
      urls.add(parsed.toString());
    } catch {
      // Ignore invalid URLs.
    }
  };

  while (sitemapQueue.length && urls.size < maxPages) {
    const sitemapUrl = sitemapQueue.shift();
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    onProgress({ phase: "discovering", currentUrl: sitemapUrl, current: seenSitemaps.size, total: seenSitemaps.size + sitemapQueue.length });

    try {
      const xml = await fetchText(sitemapUrl);
      for (const match of xml.matchAll(/<loc[^>]*>\s*([^<]+)\s*<\/loc>/gi)) {
        const loc = decodeHtml(match[1] || "").trim();
        if (!loc) continue;
        if (/\.xml(?:$|[?#])/i.test(loc) || /sitemap/i.test(loc)) {
          const nested = new URL(loc, sitemapUrl).toString();
          if (!seenSitemaps.has(nested)) sitemapQueue.push(nested);
        } else {
          addUrl(loc, sitemapUrl);
        }
        if (urls.size >= maxPages) break;
      }
    } catch {
      // Try the next common sitemap path.
    }
  }

  if (!urls.size) {
    const start = baseUrl;
    const queue = [start];
    const queued = new Set(queue);
    const visited = new Set();

    while (queue.length && urls.size < maxPages) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      addUrl(currentUrl);
      onProgress({ phase: "discovering", currentUrl, current: visited.size, total: visited.size + queue.length });

      try {
        const { html, finalUrl } = await fetchPageHtml(currentUrl);
        for (const link of extractLinks(html, finalUrl || currentUrl)) {
          if (queued.has(link)) continue;
          try {
            const parsed = new URL(link);
            if (parsed.origin !== origin || RESOURCE_RE.test(parsed.pathname)) continue;
            queued.add(link);
            queue.push(link);
          } catch {
            // Ignore invalid discovered links.
          }
          if (queued.size >= maxPages * 2) break;
        }
      } catch {
        // Keep discovery moving.
      }
    }
  }

  if (!urls.size) addUrl(baseUrl);
  return Array.from(urls).slice(0, maxPages);
}

export async function fetchDuplicatePages(urls, onProgress = () => {}) {
  const pages = [];
  const skipped = [];

  for (let i = 0; i < urls.length; i += 1) {
    const pageUrl = urls[i];
    onProgress({ phase: "crawling", currentUrl: pageUrl, current: i + 1, total: urls.length });
    try {
      const { html, finalUrl, statusCode } = await fetchPageHtml(pageUrl);
      if (statusCode >= 400) {
        skipped.push({ url: pageUrl, reason: `HTTP ${statusCode}` });
        continue;
      }
      if (/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
        skipped.push({ url: pageUrl, reason: "Noindex" });
        continue;
      }
      const text = stripHtml(html);
      const words = wordCount(text);
      if (words < 30) {
        skipped.push({ url: pageUrl, reason: "Too little visible text" });
        continue;
      }
      pages.push({
        url: finalUrl || pageUrl,
        title: extractTitle(html),
        text,
        wordCount: words,
        rawHtml: html,
        sizeKb: Math.round((html.length / 1024) * 10) / 10,
      });
    } catch (error) {
      skipped.push({ url: pageUrl, reason: error?.message || "Fetch failed" });
    }
  }

  return { pages, skipped };
}

export function analyzeDuplicatePages(pages) {
  const sentenceMap = new Map();
  const pageSentences = pages.map((page, pageIdx) => {
    const sentences = splitIntoSentences(page.text).map((original) => ({
      original,
      normalized: normalizeForComparison(original),
    })).filter((item) => item.normalized);

    sentences.forEach(({ normalized }) => {
      if (!sentenceMap.has(normalized)) sentenceMap.set(normalized, new Set());
      sentenceMap.get(normalized).add(pageIdx);
    });

    return sentences;
  });

  const ngramMap = new Map();
  pages.forEach((page, pageIdx) => {
    generateNgrams(page.text, 6).forEach((gram) => {
      if (!ngramMap.has(gram)) ngramMap.set(gram, new Set());
      ngramMap.get(gram).add(pageIdx);
    });
  });

  const results = pages.map((page, pageIdx) => {
    let duplicateWords = 0;
    let commonWords = 0;
    const matches = [];
    const matchPages = new Set();

    pageSentences[pageIdx].forEach(({ original, normalized }) => {
      const pageSet = sentenceMap.get(normalized);
      if (!pageSet || pageSet.size <= 1) return;
      const words = wordCount(original);
      const others = Array.from(pageSet).filter((idx) => idx !== pageIdx);
      others.forEach((idx) => matchPages.add(pages[idx].url));
      if (pageSet.size === 2) duplicateWords += words;
      else commonWords += words;
      matches.push({
        text: original,
        type: pageSet.size === 2 ? "duplicate" : "common",
        matchPages: others.map((idx) => ({ url: pages[idx].url, title: pages[idx].title })),
      });
    });

    if (!matches.length) {
      const grams = generateNgrams(page.text, 6);
      const commonGrams = grams.filter((gram) => (ngramMap.get(gram)?.size || 0) > 1);
      commonWords += Math.min(page.wordCount, commonGrams.length * 6);
    }

    const matchWords = Math.min(page.wordCount, duplicateWords + commonWords);
    const matchPercent = page.wordCount ? Math.round((matchWords / page.wordCount) * 100) : 0;

    return {
      ...page,
      duplicateWords,
      commonWords,
      uniqueWords: Math.max(0, page.wordCount - matchWords),
      matchWords,
      matchPercent,
      matchPages: matchPages.size,
      duplicatePercent: page.wordCount ? Math.round((duplicateWords / page.wordCount) * 100) : 0,
      commonPercent: page.wordCount ? Math.round((commonWords / page.wordCount) * 100) : 0,
      matches: matches.slice(0, 20),
    };
  });

  const totalWords = results.reduce((sum, page) => sum + page.wordCount, 0);
  const totalDuplicate = results.reduce((sum, page) => sum + page.duplicateWords, 0);
  const totalCommon = results.reduce((sum, page) => sum + page.commonWords, 0);
  const duplicatePercent = totalWords ? Math.round((totalDuplicate / totalWords) * 100) : 0;
  const commonPercent = totalWords ? Math.round((totalCommon / totalWords) * 100) : 0;
  const uniquePercent = Math.max(0, 100 - duplicatePercent - commonPercent);

  return {
    results: results.sort((a, b) => b.matchPercent - a.matchPercent),
    summary: {
      uniquePercent,
      duplicatePercent,
      commonPercent,
      pagesScanned: pages.length,
      totalWords,
      pagesWithDups: results.filter((page) => page.matchPercent > 0).length,
      cleanPages: results.filter((page) => page.matchPercent === 0).length,
      avgPageSizeKb: pages.length ? Math.round(pages.reduce((sum, page) => sum + page.sizeKb, 0) / pages.length) : 0,
      avgWordsPerPage: pages.length ? Math.round(totalWords / pages.length) : 0,
    },
  };
}

export function formatNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
