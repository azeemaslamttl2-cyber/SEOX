import React, { useState, useRef, useCallback } from 'react';
import { Globe, Search, Play, Square, Download, Copy, Check, Loader2, FileText, Map, AlertCircle, ChevronDown, ChevronUp, ExternalLink, RotateCcw, Code } from 'lucide-react';

const SitemapGenerator = () => {
    const [url, setUrl] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [discoveredUrls, setDiscoveredUrls] = useState([]);
    const [currentUrl, setCurrentUrl] = useState('');
    const [errors, setErrors] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [copied, setCopied] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    // Advanced settings
    const [maxDepth, setMaxDepth] = useState(3);
    const [maxPages, setMaxPages] = useState(500);
    const [crawlDelay, setCrawlDelay] = useState(200);
    const [respectRobots, setRespectRobots] = useState(true);

    const abortRef = useRef(false);
    const visitedRef = useRef(new Set());
    const timerRef = useRef(null);

    // Normalize and validate URL
    const normalizeUrl = (input) => {
        let normalized = input.trim();
        if (!normalized) return '';
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        try {
            const urlObj = new URL(normalized);
            return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
        } catch {
            return '';
        }
    };

    // Get base domain from URL
    const getBaseDomain = (urlString) => {
        try {
            const urlObj = new URL(urlString);
            return urlObj.origin;
        } catch {
            return '';
        }
    };

    // Extract links from HTML
    const extractLinks = (html, baseUrl) => {
        const links = new Set();
        const baseDomain = getBaseDomain(baseUrl);

        // Match href attributes
        const hrefRegex = /href=["']([^"']+)["']/gi;
        let match;

        while ((match = hrefRegex.exec(html)) !== null) {
            let href = match[1];

            // Skip empty, anchors, javascript, mailto, tel
            if (!href || href.startsWith('#') || href.startsWith('javascript:') ||
                href.startsWith('mailto:') || href.startsWith('tel:') ||
                href.startsWith('data:')) {
                continue;
            }

            try {
                // Resolve relative URLs
                const absoluteUrl = new URL(href, baseUrl);

                // Only include same-domain links
                if (absoluteUrl.origin === baseDomain) {
                    // Clean the URL (remove hash, normalize)
                    const cleanUrl = absoluteUrl.origin + absoluteUrl.pathname.replace(/\/$/, '');

                    // Skip common non-page resources
                    const ext = cleanUrl.split('.').pop().toLowerCase();
                    const skipExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'webp', 'pdf', 'zip', 'css', 'js', 'xml', 'json', 'woff', 'woff2', 'ttf', 'eot'];

                    // Exclude Cloudflare system paths
                    if (cleanUrl.includes('/cdn-cgi/')) {
                        return; // Skip Cloudflare paths
                    }

                    if (!skipExtensions.includes(ext)) {
                        links.add(cleanUrl);
                    }
                }
            } catch {
                // Invalid URL, skip
            }
        }

        return Array.from(links);
    };

    // Fetch page via proxy
    const fetchPage = async (pageUrl) => {
        const proxies = [
            (url) => `/api/proxy?url=${encodeURIComponent(url)}`,
            (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
        ];

        for (const proxyFn of proxies) {
            try {
                const proxyUrl = proxyFn(pageUrl);
                const response = await fetch(
                    proxyUrl,
                    proxyUrl.startsWith('/api/proxy')
                        ? {
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml',
                                'Cache-Control': 'no-cache'
                            }
                        }
                        : {
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml'
                            }
                        }
                );

                if (!response.ok) throw new Error(`Status: ${response.status}`);

                const html = await response.text();

                // Validate it's real HTML
                if (html && html.includes('<') && html.length > 200) {
                    return html;
                }
            } catch (err) {
                continue;
            }
        }

        throw new Error('All proxies failed');
    };

    // Start timer
    const startTimer = () => {
        setStartTime(Date.now());
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
    };

    // Stop timer
    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Format time
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Main crawl function
    const startCrawl = async () => {
        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) {
            setErrors([{ url: url, error: 'Invalid URL. Please enter a valid domain.' }]);
            return;
        }

        // Reset state
        setIsRunning(true);
        setIsPaused(false);
        setDiscoveredUrls([]);
        setErrors([]);
        setElapsedTime(0);
        abortRef.current = false;
        visitedRef.current = new Set();

        startTimer();

        const queue = [{ url: normalizedUrl, depth: 0 }];
        const results = [];

        while (queue.length > 0 && results.length < maxPages && !abortRef.current) {
            const { url: currentPageUrl, depth } = queue.shift();

            // Skip if already visited or exceeds max depth
            if (visitedRef.current.has(currentPageUrl) || depth > maxDepth) {
                continue;
            }

            visitedRef.current.add(currentPageUrl);
            setCurrentUrl(currentPageUrl);

            try {
                const html = await fetchPage(currentPageUrl);

                // Add to results
                const newEntry = {
                    url: currentPageUrl,
                    depth,
                    timestamp: new Date().toISOString()
                };
                results.push(newEntry);
                setDiscoveredUrls([...results]);

                // Extract and queue new links
                if (depth < maxDepth) {
                    const links = extractLinks(html, currentPageUrl);
                    for (const link of links) {
                        if (!visitedRef.current.has(link) && results.length + queue.length < maxPages * 2) {
                            queue.push({ url: link, depth: depth + 1 });
                        }
                    }
                }

                // Crawl delay
                if (crawlDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, crawlDelay));
                }

            } catch (err) {
                setErrors(prev => [...prev, { url: currentPageUrl, error: err.message }]);
            }
        }

        stopTimer();
        setIsRunning(false);
        setCurrentUrl('');
    };

    // Stop crawl
    const stopCrawl = () => {
        abortRef.current = true;
        stopTimer();
        setIsRunning(false);
        setCurrentUrl('');
    };

    // Reset everything
    const resetCrawl = () => {
        stopCrawl();
        setDiscoveredUrls([]);
        setErrors([]);
        setElapsedTime(0);
        visitedRef.current = new Set();
    };

    // Generate XML sitemap
    const generateXML = () => {
        const today = new Date().toISOString().split('T')[0];
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        discoveredUrls.forEach((entry, index) => {
            const priority = Math.max(0.1, 1.0 - (entry.depth * 0.2)).toFixed(1);
            xml += '  <url>\n';
            xml += `    <loc>${entry.url}</loc>\n`;
            xml += `    <lastmod>${today}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>${priority}</priority>\n`;
            xml += '  </url>\n';
        });

        xml += '</urlset>';
        return xml;
    };

    // Download XML
    const downloadXML = () => {
        const xml = generateXML();
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sitemap.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Download TXT
    const downloadTXT = () => {
        const txt = discoveredUrls.map(e => e.url).join('\n');
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'urls.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Generate HTML sitemap
    const generateHTML = () => {
        const domain = getBaseDomain(discoveredUrls[0]?.url || url);
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Group URLs by depth
        const groupedUrls = discoveredUrls.reduce((acc, entry) => {
            if (!acc[entry.depth]) acc[entry.depth] = [];
            acc[entry.depth].push(entry.url);
            return acc;
        }, {});

        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Sitemap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #334155; line-height: 1.6; padding: 40px 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 2rem; color: #1e293b; margin-bottom: 8px; }
        .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 32px; }
        .section { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .section h2 { font-size: 1.1rem; color: #475569; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .section ul { list-style: none; }
        .section li { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .section li:last-child { border-bottom: none; }
        .section a { color: #4f46e5; text-decoration: none; word-break: break-all; }
        .section a:hover { text-decoration: underline; }
        .count { background: #e0e7ff; color: #4338ca; font-size: 0.75rem; padding: 2px 8px; border-radius: 99px; margin-left: 8px; }
        footer { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>HTML Sitemap</h1>
        <p class="meta">${domain} &bull; ${discoveredUrls.length} pages &bull; Generated on ${today}</p>
`;

        // Add sections for each depth level
        const depthLabels = ['Main Pages', 'Secondary Pages', 'Tertiary Pages', 'Deep Pages'];
        Object.keys(groupedUrls).sort((a, b) => a - b).forEach((depth) => {
            const urls = groupedUrls[depth];
            const label = depthLabels[depth] || `Level ${depth} Pages`;
            html += `        <div class="section">
            <h2>${label}<span class="count">${urls.length}</span></h2>
            <ul>
`;
            urls.forEach((pageUrl) => {
                const path = pageUrl.replace(domain, '') || '/';
                html += `                <li><a href="${pageUrl}">${path}</a></li>
`;
            });
            html += `            </ul>
        </div>
`;
        });

        html += `        <footer>Generated by Sitemap Generator</footer>
    </div>
</body>
</html>`;

        return html;
    };

    // Download HTML
    const downloadHTML = () => {
        const html = generateHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'sitemap.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    // Copy URLs
    const copyUrls = async () => {
        const txt = discoveredUrls.map(e => e.url).join('\n');
        await navigator.clipboard.writeText(txt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
            <div className="">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-3 rounded-full mb-4 shadow-lg">
                        <Map className="w-6 h-6" />
                        <span className="font-bold text-lg">Sitemap Generator</span>
                    </div>
                    <p className="text-slate-600">Crawl your website and generate a sitemap.xml automatically</p>
                </div>

                {/* URL Input */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Enter website URL (e.g., example.com)"
                                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                onKeyDown={(e) => e.key === 'Enter' && !isRunning && startCrawl()}
                                disabled={isRunning}
                            />
                        </div>
                        {!isRunning ? (
                            <button
                                onClick={startCrawl}
                                disabled={!url.trim()}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2 shadow-md"
                            >
                                <Play className="w-5 h-5" />
                                Start Crawl
                            </button>
                        ) : (
                            <button
                                onClick={stopCrawl}
                                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-md"
                            >
                                <Square className="w-5 h-5" />
                                Stop
                            </button>
                        )}
                    </div>

                    {/* Advanced Settings Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="mt-4 flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
                    >
                        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Advanced Settings
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Max Depth</label>
                                <input
                                    type="number"
                                    value={maxDepth}
                                    onChange={(e) => setMaxDepth(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    min="1"
                                    max="10"
                                    disabled={isRunning}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Max Pages</label>
                                <input
                                    type="number"
                                    value={maxPages}
                                    onChange={(e) => setMaxPages(Math.max(10, Math.min(5000, parseInt(e.target.value) || 500)))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    min="10"
                                    max="5000"
                                    disabled={isRunning}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Delay (ms)</label>
                                <input
                                    type="number"
                                    value={crawlDelay}
                                    onChange={(e) => setCrawlDelay(Math.max(0, Math.min(5000, parseInt(e.target.value) || 200)))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    min="0"
                                    max="5000"
                                    disabled={isRunning}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={resetCrawl}
                                    disabled={isRunning}
                                    className="w-full px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress */}
                {isRunning && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                <span className="font-medium text-slate-800">Crawling...</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-slate-500">Time: <strong className="text-slate-800">{formatTime(elapsedTime)}</strong></span>
                                <span className="text-slate-500">Pages: <strong className="text-indigo-600">{discoveredUrls.length}</strong></span>
                            </div>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-3 font-mono text-sm text-slate-600 truncate">
                            {currentUrl || 'Initializing...'}
                        </div>
                        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 animate-pulse"
                                style={{ width: `${Math.min(100, (discoveredUrls.length / maxPages) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Results */}
                {discoveredUrls.length > 0 && (
                    <>
                        {/* Stats & Actions */}
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-indigo-600">{discoveredUrls.length}</div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wide">URLs Found</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-slate-800">{formatTime(elapsedTime)}</div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Crawl Time</div>
                                    </div>
                                    {errors.length > 0 && (
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-red-500">{errors.length}</div>
                                            <div className="text-xs text-slate-500 uppercase tracking-wide">Errors</div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={downloadXML}
                                        className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition flex items-center gap-2 shadow-md"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download XML
                                    </button>
                                    <button
                                        onClick={downloadTXT}
                                        className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        TXT
                                    </button>
                                    <button
                                        onClick={downloadHTML}
                                        className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2"
                                    >
                                        <Code className="w-4 h-4" />
                                        HTML
                                    </button>
                                    <button
                                        onClick={copyUrls}
                                        className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition flex items-center gap-2"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Errors Section */}
                        {errors.length > 0 && (
                            <div className="bg-red-50 rounded-2xl p-4 mb-6 border border-red-100">
                                <button
                                    onClick={() => setShowErrors(!showErrors)}
                                    className="w-full flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-2 text-red-700 font-medium">
                                        <AlertCircle className="w-5 h-5" />
                                        {errors.length} error{errors.length > 1 ? 's' : ''} during crawl
                                    </div>
                                    {showErrors ? <ChevronUp className="w-4 h-4 text-red-500" /> : <ChevronDown className="w-4 h-4 text-red-500" />}
                                </button>
                                {showErrors && (
                                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                                        {errors.map((err, i) => (
                                            <div key={i} className="text-sm text-red-600 font-mono bg-red-100 rounded-lg p-2 truncate">
                                                {err.url}: {err.error}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* URL List */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-indigo-600" />
                                    Discovered URLs
                                </h3>
                                <span className="text-sm text-slate-500">{discoveredUrls.length} pages</span>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {discoveredUrls.map((entry, index) => (
                                    <div
                                        key={index}
                                        className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition group"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${entry.depth === 0 ? 'bg-indigo-100 text-indigo-700' :
                                                entry.depth === 1 ? 'bg-purple-100 text-purple-700' :
                                                    entry.depth === 2 ? 'bg-pink-100 text-pink-700' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {entry.depth}
                                            </span>
                                            <span className="font-mono text-sm text-slate-700 truncate">{entry.url}</span>
                                        </div>
                                        <a
                                            href={entry.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Empty State */}
                {!isRunning && discoveredUrls.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-slate-100">
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                            <Map className="w-10 h-10 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Generate Your Sitemap</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Enter your website URL above and click "Start Crawl" to discover all pages and generate a sitemap.xml file.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SitemapGenerator;
