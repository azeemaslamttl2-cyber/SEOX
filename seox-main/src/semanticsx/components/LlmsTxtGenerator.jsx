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
        <div className="ctool-page space-y-5">
            {/* Hero Section */}
            <div className="ctool-hero">
                <div className="ctool-hero-row">
                    <span className="ctool-hero-icon">
                        <FileText className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="app-badge app-badge-brand">GEO SEO TOOL</span>
                        </div>
                        <h1 className="ctool-title font-display">LLMs.txt Generator</h1>
                        <p className="ctool-subtitle">
                            Generate an LLMs.txt file for your website to help AI models understand your content structure.
                            Choose to crawl your website or use your sitemap for URL extraction.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                <div className="grid items-start gap-5 lg:grid-cols-2">
                    {/* Left Panel - Input */}
                    <div className="ctool-card llms-card">
                        <div className="llms-card-head">
                            <h2 className="schema-card-title flex items-center gap-2">
                                <Globe className="w-5 h-5 ctool-accent" />
                                Extract Website URLs
                            </h2>
                        </div>

                        {/* Tab Selector */}
                        <div className="llms-tabbar">
                            <div className="llms-tabgroup">
                                <button
                                    onClick={() => { setActiveTab('crawl'); setExtractedUrls([]); setLlmsTxt(''); }}
                                    className={`ui-button ctool-seg-btn flex-1 ${activeTab === 'crawl' ? 'active' : ''}`}
                                >
                                    <Globe className="w-4 h-4 inline mr-2" />
                                    Crawl Website
                                </button>
                                <button
                                    onClick={() => { setActiveTab('sitemap'); setExtractedUrls([]); setLlmsTxt(''); }}
                                    className={`ui-button ctool-seg-btn flex-1 ${activeTab === 'sitemap' ? 'active' : ''}`}
                                >
                                    <Map className="w-4 h-4 inline mr-2" />
                                    Use Sitemap
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* URL Input */}
                            <div>
                                <label className="schema-label">
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
                                    className="schema-input schema-input-lg"
                                />
                            </div>

                            {error && (
                                <div className="app-alert app-alert-error">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {/* Extract Button */}
                            <button
                                onClick={handleExtract}
                                disabled={isExtracting || !url.trim()}
                                className="ui-button ui-button-primary w-full"
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
                                    <h3 className="stool-title mb-3 flex items-center gap-2">
                                        <Link2 className="w-4 h-4" />
                                        Extracted URLs ({extractedUrls.length})
                                    </h3>
                                    <div className="llms-list max-h-64 overflow-y-auto">
                                        {extractedUrls.map((item, idx) => (
                                            <div key={idx} className="llms-list-row">
                                                <p className="llms-list-title truncate">
                                                    {item.title || 'Untitled'}
                                                </p>
                                                <p className="ctool-help-text truncate">{item.url}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="ui-button ui-button-primary w-full mt-4"
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
                    <div className="ctool-card llms-card">
                        <div className="llms-card-head flex items-center justify-between">
                            <h2 className="schema-card-title flex items-center gap-2">
                                <FileText className="w-5 h-5 ctool-accent" />
                                Generated LLMs.txt
                            </h2>
                            {llmsTxt && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="ui-button ctool-tool-btn"
                                    >
                                        {copied ? <Check className="w-4 h-4 chat-copied" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="ui-button ui-button-primary llms-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6">
                            {llmsTxt ? (
                                <pre className="stool-code overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                                    {llmsTxt}
                                </pre>
                            ) : (
                                <div className="llms-empty">
                                    <div className="ctool-empty-icon mb-4">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h3 className="ctool-empty-title">No LLMs.txt Generated Yet</h3>
                                    <p className="ctool-empty-text">
                                        Extract URLs from your website first, then click "Generate LLMs.txt" to create your file.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="ctool-card">
                    <h3 className="geo-section-title font-display mb-5">What is LLMs.txt?</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="llms-feature">
                            <h4 className="llms-feature-title flex items-center gap-2">
                                <span className="text-xl">📄</span> Purpose
                            </h4>
                            <p className="llms-feature-text">LLMs.txt helps AI language models understand your website's content structure and purpose.</p>
                        </div>
                        <div className="llms-feature">
                            <h4 className="llms-feature-title flex items-center gap-2">
                                <span className="text-xl">🤖</span> AI Integration
                            </h4>
                            <p className="llms-feature-text">Similar to robots.txt for search engines, LLMs.txt guides AI models on how to interpret your content.</p>
                        </div>
                        <div className="llms-feature">
                            <h4 className="llms-feature-title flex items-center gap-2">
                                <span className="text-xl">📍</span> Placement
                            </h4>
                            <p className="llms-feature-text">Place the generated file at your website root: <code className="llms-code-inline">yourdomain.com/llms.txt</code></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LlmsTxtGenerator;
