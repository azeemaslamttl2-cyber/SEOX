/**
 * Shared URL fetching and HTML parsing utilities for content tools.
 * Consolidates proxy-based fetching logic used across EntitiesExtractor,
 * OutlineCreator, NGramsExtractor, and NLPExtractor.
 */

/**
 * Fetch URL content through proxy with fallback chain.
 * Tries the internal /api/proxy first, then external CORS proxies.
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} Raw HTML string
 */
export async function fetchUrlContent(url) {
    const cacheBuster = `_cb=${Date.now()}`;
    const urlWithCacheBust = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

    const proxyUrls = [
        `/api/proxy?url=${encodeURIComponent(urlWithCacheBust)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCacheBust)}`,
        `https://corsproxy.io/?${encodeURIComponent(urlWithCacheBust)}`
    ];

    for (const proxyUrl of proxyUrls) {
        try {
            const response = await fetch(
                proxyUrl,
                proxyUrl.startsWith('/api/proxy')
                    ? {
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    }
                    : undefined
            );

            if (!response.ok) continue;

            const html = await response.text();

            if ((html.includes('<!DOCTYPE') || html.includes('<html')) &&
                !html.includes('SEOX</title>') && !html.includes('seox')) {
                return html;
            }
        } catch {
            continue;
        }
    }
    throw new Error('Failed to fetch page content — website may be blocking requests');
}

/**
 * Extract main text content from HTML, stripping navigation, ads, etc.
 * @param {string} html - Raw HTML string
 * @returns {string} Cleaned text content
 */
export function extractMainContent(html) {
    if (typeof DOMParser === 'undefined') {
        return fallbackHtmlText(html);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const removeSelectors = [
        'script', 'style', 'noscript', 'iframe',
        'header', 'footer', 'nav', 'aside',
        '.sidebar', '.navigation', '.menu', '.nav',
        '.header', '.footer', '.widget', '.ad', '.advertisement',
        '.social', '.share', '.comments', '.comment-section',
        '.related-posts', '.author-bio', '#sidebar', '#footer', '#header',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
    ];

    removeSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    const mainContent = doc.querySelector(
        'article, main, .content, .post-content, .entry-content, .article-body, [role="main"]'
    );
    return (mainContent || doc.body)?.textContent?.trim() || '';
}

/**
 * Extract page title from HTML.
 * @param {string} html - Raw HTML string
 * @returns {string} Page title
 */
export function getPageTitle(html) {
    if (typeof DOMParser === 'undefined') {
        const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        return match ? stripHtmlTags(match[1]).trim() : '';
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.querySelector('title')?.textContent?.trim() || '';
}

/**
 * Call the DeepSeek AI API endpoint.
 * @param {object} options
 * @param {string} options.prompt - User prompt
 * @param {string} options.systemInstruction - System prompt
 * @param {number} [options.temperature=0.3] - Temperature
 * @returns {Promise<object>} Parsed JSON response
 */
export async function callAI({ prompt, systemInstruction, temperature = 0.3 }) {
    const response = await fetch('/api/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            systemInstruction,
            responseMimeType: 'application/json',
            temperature
        })
    });

    if (!response.ok) {
        throw new Error('AI API error');
    }

    const data = await response.json();
    // Strip markdown code fences if present
    let text = data.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
}

function fallbackHtmlText(html) {
    const source = String(html || '');
    const withoutScripts = source
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

    const bodyMatch = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const target = bodyMatch ? bodyMatch[1] : withoutScripts;

    return stripHtmlTags(target)
        .replace(/\s+/g, ' ')
        .trim();
}

function stripHtmlTags(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#39;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
}
