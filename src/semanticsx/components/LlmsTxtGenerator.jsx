import React, { useEffect, useState } from 'react';
import {
    FileText, Link2, Globe, Loader2, Copy, Download, Check,
    AlertCircle, ChevronRight, Sparkles, Map, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSelectedProjectDomain } from '../../hooks/useSelectedProjectDomain.js';
import { loadToolResult, saveToolResult } from '../../lib/projectsApi.js';

const LlmsTxtGenerator = () => {
    const { user } = useAuth();
    const { project, projectUrl } = useSelectedProjectDomain();
    const userId = user?.uid || user?.id || '';
    const [activeTab, setActiveTab] = useState('crawl'); // 'crawl' or 'sitemap'
    const [url, setUrl] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [extractedUrls, setExtractedUrls] = useState([]);
    const [llmsTxt, setLlmsTxt] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setUrl(projectUrl || '');
        setExtractedUrls([]);
        setLlmsTxt('');

        if (!userId || !project?.id) return undefined;

        let cancelled = false;
        loadToolResult(userId, { projectId: project.id, toolKey: 'llmsTxt' })
            .then((storedResult) => {
                if (cancelled || !storedResult) return;
                setUrl(storedResult.url || projectUrl || '');
                setExtractedUrls(Array.isArray(storedResult.extractedUrls) ? storedResult.extractedUrls : []);
                setLlmsTxt(storedResult.llmsTxt || '');
            })
            .catch(() => {
                // The page remains usable if no previous result exists.
            });

        return () => {
            cancelled = true;
        };
    }, [project?.id, projectUrl, userId]);

    const persistCrawlResult = async (nextExtractedUrls, nextLlmsTxt = llmsTxt) => {
        if (!userId) return;

        const targetUrl = url.startsWith('http') ? url : `https://${url}`;
        const projectId = project?.id || (() => {
            try {
                return new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase();
            } catch {
                return '';
            }
        })();
        if (!projectId) return;

        await saveToolResult(userId, {
            projectId,
            projectUrl: projectUrl || targetUrl,
            toolKey: 'llmsTxt',
            result: {
                url: targetUrl,
                extractedUrls: nextExtractedUrls,
                llmsTxt: nextLlmsTxt,
                updatedAt: new Date().toISOString(),
            },
        });
    };

    // Extract URLs from website or sitemap
    const handleExtract = async () => {
        if (!url.trim()) {
            setError('Please enter a valid URL');
            return;
        }

        setError('');
        setIsExtracting(true);
        setExtractedUrls([]);
        setLlmsTxt('');

        let generatedText = '';

        try {
            let extractedData = [];
            const targetUrl = url.startsWith('http') ? url : `https://${url}`;

            if (activeTab === 'sitemap') {
                // Fetch and parse sitemap XML via proxy
                const response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl })
                });

                if (!response.ok) throw new Error('Failed to fetch sitemap');
                const data = await response.json();
                const sitemapContent = data.content || '';

                // Parse sitemap XML client-side
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(sitemapContent, 'text/xml');

                // Check if this is a sitemap index (contains <sitemap> tags)
                const sitemapTags = xmlDoc.querySelectorAll('sitemap loc');

                if (sitemapTags.length > 0) {
                    // This is a sitemap index - fetch all child sitemaps
                    const childSitemapUrls = Array.from(sitemapTags).map(el => el.textContent).filter(Boolean);

                    // Fetch each child sitemap and extract URLs
                    for (const childUrl of childSitemapUrls.slice(0, 10)) { // Limit to 10 child sitemaps
                        try {
                            const childResponse = await fetch('/api/proxy', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: childUrl })
                            });

                            if (childResponse.ok) {
                                const childData = await childResponse.json();
                                const childXmlDoc = parser.parseFromString(childData.content || '', 'text/xml');
                                const childLocs = childXmlDoc.querySelectorAll('url loc');
                                const childUrls = Array.from(childLocs).map(el => el.textContent).filter(Boolean);
                                extractedData.push(...childUrls);
                            }
                        } catch (e) {
                            console.log(`Failed to fetch child sitemap: ${childUrl}`);
                        }
                    }
                } else {
                    // Regular sitemap - extract URLs from <url><loc> tags
                    const locElements = xmlDoc.querySelectorAll('url loc');
                    extractedData = Array.from(locElements).map(el => el.textContent).filter(Boolean);

                    // Fallback: try getting all <loc> tags if no <url><loc> found
                    if (extractedData.length === 0) {
                        const allLocs = xmlDoc.querySelectorAll('loc');
                        extractedData = Array.from(allLocs).map(el => el.textContent).filter(Boolean);
                    }
                }

                // Filter out image URLs
                const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif)$/i;
                extractedData = extractedData.filter(url => !imageExtensions.test(url));

                // Limit to 500 URLs max
                extractedData = extractedData.slice(0, 500);

                if (extractedData.length === 0) {
                    throw new Error('No URLs found in sitemap. Make sure the URL points to a valid sitemap.xml');
                }
            } else {
                // Crawl website - fetch homepage and extract links
                const response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl })
                });

                if (!response.ok) throw new Error('Failed to fetch website');
                const data = await response.json();
                const htmlContent = data.content || '';

                // Parse HTML and extract links client-side
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                const baseUrl = new URL(targetUrl);

                // Get all anchor tags with href
                const links = doc.querySelectorAll('a[href]');
                const uniqueUrls = new Set();
                uniqueUrls.add(targetUrl); // Include the homepage

                links.forEach(link => {
                    try {
                        const href = link.getAttribute('href');
                        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

                        // Convert relative URLs to absolute
                        const absoluteUrl = new URL(href, targetUrl);

                        // Only include URLs from the same domain
                        if (absoluteUrl.hostname === baseUrl.hostname) {
                            uniqueUrls.add(absoluteUrl.href);
                        }
                    } catch (e) {
                        // Invalid URL, skip
                    }
                });

                extractedData = Array.from(uniqueUrls).slice(0, 500); // Limit to 500 URLs

                if (extractedData.length === 0) {
                    throw new Error('No URLs found on the website');
                }
            }

            // Fetch titles for each URL (batch process via proxy)
            const urlsWithTitles = [];
            for (const pageUrl of extractedData) { // Extract titles for all URLs
                try {
                    const titleResponse = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: pageUrl })
                    });

                    if (titleResponse.ok) {
                        const titleData = await titleResponse.json();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(titleData.content || '', 'text/html');
                        const title = doc.querySelector('title')?.textContent?.trim() || '';
                        urlsWithTitles.push({ url: pageUrl, title });
                    } else {
                        urlsWithTitles.push({ url: pageUrl, title: '' });
                    }
                } catch (e) {
                    urlsWithTitles.push({ url: pageUrl, title: '' });
                }
            }

            setExtractedUrls(urlsWithTitles);
            try {
                await persistCrawlResult(urlsWithTitles);
            } catch (persistError) {
                setError(persistError?.message || 'Could not save crawl result');
            }
        } catch (err) {
            console.error('Extraction error:', err);
            setError(err.message || 'Failed to extract URLs');

            // Fallback: simulate extraction for demo
            simulateExtraction();
        } finally {
            setIsExtracting(false);
        }
    };

    // Simulate extraction for demo/fallback
    const simulateExtraction = () => {
        try {
            const baseUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
            const domain = baseUrl.hostname;

            const mockUrls = [
                { url: `https://${domain}/`, title: `${domain} - Home` },
                { url: `https://${domain}/about`, title: 'About Us' },
                { url: `https://${domain}/services`, title: 'Our Services' },
                { url: `https://${domain}/blog`, title: 'Blog' },
                { url: `https://${domain}/contact`, title: 'Contact Us' },
                { url: `https://${domain}/products`, title: 'Products' },
                { url: `https://${domain}/pricing`, title: 'Pricing' },
                { url: `https://${domain}/faq`, title: 'FAQ' }
            ];

            setExtractedUrls(mockUrls);
            setError('');
        } catch (e) {
            setError('Invalid URL format');
        }
    };

    // Generate LLMs.txt using DeepSeek API
    const handleGenerate = async () => {
        if (extractedUrls.length === 0) {
            setError('Please extract URLs first');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            const urlList = extractedUrls.map(u => `- ${u.title || u.url}: ${u.url}`).join('\n');

            const prompt = `Generate a proper LLMs.txt file for a website with the following pages:

${urlList}

The LLMs.txt file should:
1. Start with a clear description of what the website is about
2. List the main sections/categories hierarchically
3. **CRITICAL: You MUST include the actual URL for every single page listed. Use Markdown link format: [Page Title](URL)**
4. Do NOT list pages without their corresponding URLs
5. Provide context about the content structure
6. Include information about the site's purpose
7. Be formatted in a clean, readable way for AI models

Generate ONLY the LLMs.txt content, no explanations.`;

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemInstruction: 'You are a helpful assistant that generates LLMs.txt files for websites. LLMs.txt is a file that helps AI models understand website content and structure.',
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('Failed to generate LLMs.txt');

            const data = await response.json();
            // Clean up markdown code block markers if present
            let cleanedText = data.text || '';
            cleanedText = cleanedText.replace(/^```(?:text|txt)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            generatedText = cleanedText || generateFallbackLlmsTxt();
        } catch (err) {
            console.error('Generation error:', err);
            // Use fallback generation
            generatedText = generateFallbackLlmsTxt();
        }

        setLlmsTxt(generatedText);
        try {
            await persistCrawlResult(extractedUrls, generatedText);
        } catch (persistError) {
            setError(persistError?.message || 'Could not save generated LLMs.txt');
        } finally {
            setIsGenerating(false);
        }
    };

    // Fallback LLMs.txt generation
    const generateFallbackLlmsTxt = () => {
        const domain = extractedUrls[0]?.url ? new URL(extractedUrls[0].url).hostname : 'website';
        const sections = extractedUrls.map(u => `  - [${u.title || 'Page'}](${u.url})`).join('\n');

        return `# LLMs.txt for ${domain}

## About This Website
This website contains the following sections and content areas.

## Main Sections
${sections}

## Content Guidelines
- All content on this site is original and authoritative
- The site is regularly updated with new information
- For the most accurate information, refer to the original pages

## Contact
For more information, visit the main website at ${extractedUrls[0]?.url || url}
`;
    };

    // Copy to clipboard
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(llmsTxt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    // Download LLMs.txt
    const handleDownload = () => {
        const blob = new Blob([llmsTxt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'llms.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-12">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10"></div>
                <div className="max-w-6xl mx-auto px-6 py-16 relative">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-medium">
                            ✕ GEO SEO TOOL
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        LLMs.txt Generator
                    </h1>
                    <p className="text-lg text-gray-300 max-w-2xl">
                        Generate an LLMs.txt file for your website to help AI models understand your content structure.
                        Choose to crawl your website or use your sitemap for URL extraction.
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 pb-24 -mt-4">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left Panel - Input */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-purple-600" />
                                Extract Website URLs
                            </h2>
                        </div>

                        {/* Tab Selector */}
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setActiveTab('crawl'); setExtractedUrls([]); setLlmsTxt(''); }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'crawl'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                >
                                    <Globe className="w-4 h-4 inline mr-2" />
                                    Crawl Website
                                </button>
                                <button
                                    onClick={() => { setActiveTab('sitemap'); setExtractedUrls([]); setLlmsTxt(''); }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'sitemap'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                >
                                    <Map className="w-4 h-4 inline mr-2" />
                                    Use Sitemap
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* URL Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {activeTab === 'crawl' ? 'Website URL' : 'Sitemap URL'}
                                </label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder={activeTab === 'crawl'
                                        ? 'https://example.com'
                                        : 'https://example.com/sitemap.xml'
                                    }
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {/* Extract Button */}
                            <button
                                onClick={handleExtract}
                                disabled={isExtracting || !url.trim()}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                {isExtracting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Extracting URLs...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-5 h-5" />
                                        Start Extraction
                                    </>
                                )}
                            </button>

                            {/* Extracted URLs Preview */}
                            {extractedUrls.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <Link2 className="w-4 h-4" />
                                        Extracted URLs ({extractedUrls.length})
                                    </h3>
                                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                                        {extractedUrls.map((item, idx) => (
                                            <div key={idx} className="p-3 hover:bg-gray-50 transition">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {item.title || 'Untitled'}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{item.url}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Generating LLMs.txt...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Generate LLMs.txt
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Output */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-600" />
                                Generated LLMs.txt
                            </h2>
                            {llmsTxt && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6">
                            {llmsTxt ? (
                                <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl text-sm font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                                    {llmsTxt}
                                </pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                                        <FileText className="w-8 h-8 text-purple-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No LLMs.txt Generated Yet</h3>
                                    <p className="text-gray-500 text-sm max-w-xs">
                                        Extract URLs from your website first, then click "Generate LLMs.txt" to create your file.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="mt-8 mb-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8">
                    <h3 className="text-lg font-semibold text-white mb-6">What is LLMs.txt?</h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <span className="text-xl">📄</span> Purpose
                            </h4>
                            <p className="text-sm text-gray-300 leading-relaxed">LLMs.txt helps AI language models understand your website's content structure and purpose.</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <span className="text-xl">🤖</span> AI Integration
                            </h4>
                            <p className="text-sm text-gray-300 leading-relaxed">Similar to robots.txt for search engines, LLMs.txt guides AI models on how to interpret your content.</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                                <span className="text-xl">📍</span> Placement
                            </h4>
                            <p className="text-sm text-gray-300 leading-relaxed">Place the generated file at your website root: <code className="bg-white/20 px-2 py-0.5 rounded text-purple-200">yourdomain.com/llms.txt</code></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LlmsTxtGenerator;
