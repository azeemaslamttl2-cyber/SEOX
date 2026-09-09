import React, { useState } from 'react';
import {
    Globe, Plus, X, Loader2, Copy, Check, ChevronDown, ChevronUp,
    Trash2, ExternalLink, Tag, Hash, Network, List, Sparkles,
    Lightbulb, ClipboardList, Zap, RefreshCw
} from 'lucide-react';
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

const CompetitorContentAnalyzer = () => {
    const [urls, setUrls] = useState(['']);
    const [isExtracting, setIsExtracting] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [copiedSection, setCopiedSection] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [currentStep, setCurrentStep] = useState('');
    const [progress, setProgress] = useState(0);

    // Section definitions
    const SECTIONS = {
        entities: {
            label: 'Entities',
            icon: Tag,
            color: 'from-fuchsia-500 to-pink-600',
            tagColor: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
            badgeColor: 'bg-fuchsia-100 text-fuchsia-700',
            categories: {
                people: { label: 'People', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                organizations: { label: 'Organizations', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                locations: { label: 'Locations', color: 'bg-green-50 text-green-700 border-green-200' },
                products: { label: 'Products/Services', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                concepts: { label: 'Concepts', color: 'bg-pink-50 text-pink-700 border-pink-200' },
                technologies: { label: 'Technologies', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
            }
        },
        ngrams: {
            label: 'N-Grams',
            icon: Hash,
            color: 'from-blue-500 to-cyan-600',
            tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
            badgeColor: 'bg-blue-100 text-blue-700',
            categories: {
                bigrams: { label: '2-Grams', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                trigrams: { label: '3-Grams', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                fourgrams: { label: '4-Grams', color: 'bg-violet-50 text-violet-700 border-violet-200' }
            }
        },
        skipGrams: {
            label: 'Skip-Gram Words',
            icon: Network,
            color: 'from-violet-500 to-purple-600',
            tagColor: 'bg-violet-50 text-violet-700 border-violet-200',
            badgeColor: 'bg-violet-100 text-violet-700',
            categories: {
                word_sense_disambiguation: { label: 'Word Sense Disambiguation', color: 'bg-violet-50 text-violet-700 border-violet-200' },
                document_summarization: { label: 'Document Summarization', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                keyword_extraction: { label: 'Keyword Extraction', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
            }
        },
        outline: {
            label: 'Outline',
            icon: List,
            color: 'from-emerald-500 to-teal-600',
            tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            badgeColor: 'bg-emerald-100 text-emerald-700',
            categories: {}
        }
    };

    // URL management
    const addUrlInput = () => setUrls([...urls, '']);
    const removeUrlInput = (index) => {
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls.length ? newUrls : ['']);
    };
    const updateUrl = (index, value) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    // Fetch URL content via proxy
    const fetchUrlContent = async (url) => {
        const cacheBuster = `_cb=${Date.now()}`;
        const urlWithCacheBust = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;

        const proxyUrls = [
            `/api/proxy?url=${encodeURIComponent(urlWithCacheBust)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCacheBust)}`,
            `https://corsproxy.io/?${encodeURIComponent(urlWithCacheBust)}`
        ];

        for (const proxyUrl of proxyUrls) {
            try {
                const request = proxyUrl.startsWith('/api/') ? authenticatedFetch : fetch;
                const response = await request(
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
                    !html.includes('SemanticsX</title>')) {
                    return html;
                }
            } catch (e) {
                continue;
            }
        }
        throw new Error('Failed to fetch URL content');
    };

    // Extract text content from HTML
    const extractTextFromHtml = (html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove non-content elements
        const elementsToRemove = doc.querySelectorAll(
            'script, style, noscript, iframe, header, footer, nav, aside, ' +
            '.sidebar, .navigation, .menu, .nav, .header, .footer, .widget, ' +
            '.ad, .advertisement, .social, .share, .comments, .comment-section, ' +
            '.related-posts, .author-bio, #sidebar, #footer, #header, ' +
            '[role="navigation"], [role="banner"], [role="contentinfo"]'
        );
        elementsToRemove.forEach(el => el.remove());

        const mainContent = doc.querySelector('article, main, .content, .post-content, .entry-content, body');
        const textContent = mainContent?.textContent?.trim() || '';
        const pageTitle = doc.querySelector('title')?.textContent?.trim() || '';

        return { textContent: textContent.substring(0, 8000), pageTitle };
    };

    // Extract headings from HTML for outline
    const extractHeadings = (html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove excluded areas
        const elementsToRemove = doc.querySelectorAll(
            'nav, footer, aside, header, .sidebar, .menu, .navigation, .comments, .related-posts'
        );
        elementsToRemove.forEach(el => el.remove());

        const EXCLUDED_HEADINGS = [
            'share', 'leave a reply', 'cancel', 'reply', 'related stories',
            'related posts', 'related articles', 'comments', 'post a comment',
            'leave a comment', 'sidebar', 'footer', 'search', 'archives',
            'categories', 'tags', 'subscribe', 'newsletter', 'follow us',
            'about the author', 'author bio', 'recent posts', 'popular posts',
            'you may also like', 'read more', 'continue reading'
        ];

        const headings = [];
        const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingElements.forEach(el => {
            const text = el.textContent?.trim();
            if (!text) return;
            const lowerText = text.toLowerCase();
            const isExcluded = EXCLUDED_HEADINGS.some(ex =>
                lowerText === ex || lowerText.startsWith(ex + ' ') ||
                lowerText.includes('comment') || lowerText.includes('reply')
            );
            if (!isExcluded) {
                headings.push({
                    tag: el.tagName.toLowerCase(),
                    level: parseInt(el.tagName.replace('h', '').replace('H', '')),
                    text
                });
            }
        });
        return headings;
    };

    const callAI = async (operation, inputs) => {
        const response = await authenticatedFetch('/api/ai-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operation,
                inputs
            })
        });

        if (!response.ok) throw new Error('AI API error');
        const data = await response.json();
        let text = data.text || '{}';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    };

    // Extract all data from competitor URLs
    const extractAll = async () => {
        const validUrls = urls.filter(u => u.trim());
        if (validUrls.length === 0) {
            setError('Please enter at least one URL');
            return;
        }

        setIsExtracting(true);
        setError('');
        setResults(null);
        setProgress(0);

        const allTexts = [];
        const allHeadings = [];
        const totalSteps = validUrls.length + 3; // urls + 3 AI calls
        let completedSteps = 0;

        try {
            // Step 1: Fetch all URLs
            for (let i = 0; i < validUrls.length; i++) {
                setCurrentStep(`Fetching ${validUrls[i].replace(/https?:\/\//, '').split('/')[0]}...`);
                try {
                    const html = await fetchUrlContent(validUrls[i]);
                    const { textContent, pageTitle } = extractTextFromHtml(html);
                    allTexts.push({ url: validUrls[i], text: textContent, title: pageTitle });
                    allHeadings.push({ url: validUrls[i], headings: extractHeadings(html), title: pageTitle });
                } catch (err) {
                    console.error(`Failed to fetch ${validUrls[i]}:`, err);
                }
                completedSteps++;
                setProgress(Math.round((completedSteps / totalSteps) * 100));
            }

            if (allTexts.length === 0) {
                throw new Error('Could not fetch any of the provided URLs');
            }

            const combinedText = allTexts.map(t => `Source: ${t.title}\n${t.text}`).join('\n\n---\n\n');
            const truncatedCombined = combinedText.substring(0, 12000);

            // Step 2: Extract entities
            setCurrentStep('Extracting Entities...');
            const entitiesRes = await callAI('competitor-content.entities', {
                content: truncatedCombined
            });
            completedSteps++;
            setProgress(Math.round((completedSteps / totalSteps) * 100));

            // Step 3: Extract N-Grams
            setCurrentStep('Extracting N-Grams...');
            const ngramsRes = await callAI('competitor-content.ngrams', {
                content: truncatedCombined
            });
            completedSteps++;
            setProgress(Math.round((completedSteps / totalSteps) * 100));

            // Step 4: Extract Skip-Gram Words
            setCurrentStep('Extracting Skip-Gram Words...');
            const skipgramRes = await callAI('competitor-content.skipgrams', {
                content: truncatedCombined
            });
            completedSteps++;
            setProgress(Math.round((completedSteps / totalSteps) * 100));

            // Step 5: Combine outline
            const combinedOutline = [];
            allHeadings.forEach(source => {
                if (source.headings.length > 0) {
                    combinedOutline.push({
                        url: source.url,
                        title: source.title,
                        headings: source.headings
                    });
                }
            });

            setResults({
                entities: entitiesRes,
                ngrams: ngramsRes,
                skipGrams: skipgramRes,
                outline: combinedOutline
            });

            // Expand all sections
            const expanded = {};
            Object.keys(SECTIONS).forEach(key => { expanded[key] = true; });
            setExpandedSections(expanded);

        } catch (err) {
            console.error('Error extracting:', err);
            setError(`Failed to extract: ${err.message}`);
        } finally {
            setIsExtracting(false);
            setCurrentStep('');
            setProgress(100);
        }
    };

    // Toggle section expansion
    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Get items count for a section
    const getSectionCount = (sectionKey) => {
        if (!results || !results[sectionKey]) return 0;
        const data = results[sectionKey];

        if (sectionKey === 'entities') {
            return (data.allEntities || []).length;
        } else if (sectionKey === 'outline') {
            let count = 0;
            if (Array.isArray(data)) {
                data.forEach(source => { count += (source.headings || []).length; });
            }
            return count;
        } else if (sectionKey === 'skipGrams') {
            let count = 0;
            if (data.word_sense_disambiguation) {
                data.word_sense_disambiguation.forEach(s => { count += (s.dominant_words || []).length; });
            }
            count += (data.document_summarization || []).length;
            count += (data.keyword_extraction || []).length;
            return count;
        } else {
            let count = 0;
            Object.keys(SECTIONS[sectionKey].categories).forEach(subKey => {
                const items = data[subKey];
                if (Array.isArray(items)) count += items.length;
            });
            return count;
        }
    };

    // Copy a single section
    const copySectionData = (sectionKey) => {
        if (!results || !results[sectionKey]) return;
        const data = results[sectionKey];
        const config = SECTIONS[sectionKey];
        let text = `## ${config.label}\n\n`;

        if (sectionKey === 'entities') {
            if (data.allEntities && data.allEntities.length > 0) {
                text += data.allEntities.join(', ') + '\n\n';
            }
            if (data.entities) {
                Object.entries(data.entities).forEach(([cat, items]) => {
                    if (items && items.length > 0) {
                        const catConfig = config.categories[cat];
                        text += `### ${catConfig ? catConfig.label : cat}\n`;
                        text += items.join(', ') + '\n\n';
                    }
                });
            }
        } else if (sectionKey === 'skipGrams') {
            if (data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0) {
                text += `### Word Sense Disambiguation\n`;
                data.word_sense_disambiguation.forEach(s => {
                    text += `**${s.sense}**: ${(s.dominant_words || []).join(', ')}\n`;
                });
                text += '\n';
            }
            if (data.document_summarization && data.document_summarization.length > 0) {
                text += `### Document Summarization\n`;
                text += data.document_summarization.join(', ') + '\n\n';
            }
            if (data.keyword_extraction && data.keyword_extraction.length > 0) {
                text += `### Keyword Extraction\n`;
                text += data.keyword_extraction.join(', ') + '\n\n';
            }
        } else if (sectionKey === 'outline') {
            if (Array.isArray(data)) {
                data.forEach(source => {
                    text += `### ${source.title || source.url}\n`;
                    (source.headings || []).forEach(h => {
                        const indent = '  '.repeat(h.level - 1);
                        text += `${indent}- ${h.tag.toUpperCase()}: ${h.text}\n`;
                    });
                    text += '\n';
                });
            }
        } else {
            Object.entries(config.categories).forEach(([subKey, subConfig]) => {
                const items = data[subKey];
                if (items && items.length > 0) {
                    text += `### ${subConfig.label}\n`;
                    text += items.join(', ') + '\n\n';
                }
            });
        }

        navigator.clipboard.writeText(text.trim());
        setCopiedSection(sectionKey);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    // Copy Prompt (all data excluding outline)
    const copyPrompt = () => {
        if (!results) return;

        let prompt = `Use this data to optimize the following content:\n\n`;

        // Entities
        if (results.entities) {
            const data = results.entities;
            prompt += `## Entities\n\n`;
            if (data.allEntities && data.allEntities.length > 0) {
                prompt += data.allEntities.join(', ') + '\n\n';
            }
            if (data.entities) {
                Object.entries(data.entities).forEach(([cat, items]) => {
                    if (items && items.length > 0) {
                        const catConfig = SECTIONS.entities.categories[cat];
                        prompt += `### ${catConfig ? catConfig.label : cat}\n`;
                        prompt += items.join(', ') + '\n\n';
                    }
                });
            }
        }

        // N-Grams
        if (results.ngrams) {
            prompt += `## N-Grams\n\n`;
            Object.entries(SECTIONS.ngrams.categories).forEach(([subKey, subConfig]) => {
                const items = results.ngrams[subKey];
                if (items && items.length > 0) {
                    prompt += `### ${subConfig.label}\n`;
                    prompt += items.join(', ') + '\n\n';
                }
            });
        }

        // Skip-Gram Words
        if (results.skipGrams) {
            const data = results.skipGrams;
            prompt += `## Skip-Gram Words\n\n`;
            if (data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0) {
                prompt += `### Word Sense Disambiguation\n`;
                data.word_sense_disambiguation.forEach(s => {
                    prompt += `**${s.sense}**: ${(s.dominant_words || []).join(', ')}\n`;
                });
                prompt += '\n';
            }
            if (data.document_summarization && data.document_summarization.length > 0) {
                prompt += `### Document Summarization\n`;
                prompt += data.document_summarization.join(', ') + '\n\n';
            }
            if (data.keyword_extraction && data.keyword_extraction.length > 0) {
                prompt += `### Keyword Extraction\n`;
                prompt += data.keyword_extraction.join(', ') + '\n\n';
            }
        }

        // NOTE: Outline is intentionally excluded from the prompt

        navigator.clipboard.writeText(prompt.trim());
        setCopiedSection('prompt');
        setTimeout(() => setCopiedSection(null), 2000);
    };

    // Render section content
    const renderSectionContent = (sectionKey) => {
        if (!results || !results[sectionKey]) return null;
        const data = results[sectionKey];
        const config = SECTIONS[sectionKey];

        if (sectionKey === 'entities') {
            return (
                <div className="p-4 space-y-4">
                    {data.allEntities && data.allEntities.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">All Entities</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.allEntities.map((entity, i) => (
                                    <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${config.tagColor}`}>
                                        {entity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.entities && Object.entries(data.entities).map(([cat, items]) => {
                        if (!items || items.length === 0) return null;
                        const catConfig = config.categories[cat];
                        if (!catConfig) return null;
                        return (
                            <div key={cat}>
                                <h4 className="text-sm font-medium text-gray-600 mb-2">{catConfig.label}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {items.map((item, i) => (
                                        <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${catConfig.color}`}>
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (sectionKey === 'skipGrams') {
            return (
                <div className="p-4 space-y-4">
                    {data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Word Sense Disambiguation</h4>
                            <div className="space-y-3">
                                {data.word_sense_disambiguation.map((senseObj, idx) => (
                                    <div key={idx} className="bg-violet-50/50 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Lightbulb className="w-4 h-4 text-violet-600" />
                                            <h5 className="font-semibold text-violet-900">{senseObj.sense}</h5>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(senseObj.dominant_words || []).map((word, i) => (
                                                <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-white text-violet-700 border-violet-200">
                                                    {word}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.document_summarization && data.document_summarization.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Document Summarization</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.document_summarization.map((item, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-blue-50 text-blue-700 border-blue-200">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.keyword_extraction && data.keyword_extraction.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Keyword Extraction</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.keyword_extraction.map((item, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (sectionKey === 'outline') {
            if (!Array.isArray(data) || data.length === 0) {
                return (
                    <div className="p-4 text-gray-500 text-sm">No headings found.</div>
                );
            }
            return (
                <div className="p-4 space-y-4">
                    {data.map((source, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Globe className="w-4 h-4 text-emerald-600" />
                                <h4 className="font-semibold text-gray-900 text-sm truncate">{source.title || source.url}</h4>
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-emerald-600 ml-auto flex-shrink-0"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                            <div className="space-y-1">
                                {(source.headings || []).map((h, i) => {
                                    const levelColors = {
                                        1: 'text-gray-900 font-bold text-base',
                                        2: 'text-gray-800 font-semibold text-sm',
                                        3: 'text-gray-700 font-medium text-sm',
                                        4: 'text-gray-600 text-sm',
                                        5: 'text-gray-500 text-xs',
                                        6: 'text-gray-400 text-xs'
                                    };
                                    const levelBg = {
                                        1: 'bg-emerald-100 text-emerald-700',
                                        2: 'bg-blue-100 text-blue-700',
                                        3: 'bg-purple-100 text-purple-700',
                                        4: 'bg-surface-muted text-amber-700',
                                        5: 'bg-gray-100 text-gray-700',
                                        6: 'bg-gray-100 text-gray-500'
                                    };
                                    return (
                                        <div key={i} className="flex items-start gap-2" style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-mono flex-shrink-0 ${levelBg[h.level] || 'bg-gray-100 text-gray-600'}`}>
                                                H{h.level}
                                            </span>
                                            <span className={levelColors[h.level] || 'text-gray-600 text-sm'}>{h.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Standard subcategories (ngrams)
        return (
            <div className="p-4 space-y-4">
                {Object.entries(config.categories).map(([subKey, subConfig]) => {
                    const items = data[subKey];
                    if (!items || items.length === 0) return null;
                    return (
                        <div key={subKey}>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">{subConfig.label}</h4>
                            <div className="flex flex-wrap gap-2">
                                {items.map((item, i) => (
                                    <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${subConfig.color}`}>
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="content-tool-page ctool-page space-y-5">
            <div className="">
                {/* Header */}
                <div className="ctool-hero mb-6">
                    <div className="ctool-hero-row">
                        <div className="ctool-hero-icon">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="ctool-title font-display">Content Analyzer</h1>
                            <p className="ctool-subtitle">Extract NLP data from competitor pages</p>
                        </div>
                    </div>

                    <p className="ctool-subtitle mt-4 mb-5">
                        Add competitor URLs to extract entities, n-grams, skip-gram words, and content outlines from their pages.
                    </p>
                </div>

                {/* URL Inputs */}
                <div className="ctool-card mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Globe className="w-5 h-5 ctool-accent" />
                            Competitor URLs
                        </h2>
                        <button
                            onClick={addUrlInput}
                            className="ui-button ctool-tool-btn"
                        >
                            <Plus className="w-4 h-4" />
                            Add URL
                        </button>
                    </div>

                    <div className="space-y-3 mb-4">
                        {urls.map((url, index) => (
                            <div key={index} className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => updateUrl(index, e.target.value)}
                                        placeholder="https://example.com/article"
                                        className="ctool-input w-full pl-10"
                                    />
                                </div>
                                {urls.length > 1 && (
                                    <button
                                        onClick={() => removeUrlInput(index)}
                                        className="ui-button ctool-icon-btn"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={extractAll}
                        disabled={isExtracting || urls.every(u => !u.trim())}
                        className="ui-button ui-button-primary w-full"
                    >
                        {isExtracting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Extracting... {progress}%
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Extract All
                            </>
                        )}
                    </button>

                    {/* Progress */}
                    {isExtracting && (
                        <div className="mt-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>{currentStep}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                        {error}
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="space-y-4">
                        {/* Copy Prompt Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={copyPrompt}
                                className="ui-button ui-button-primary"
                            >
                                {copiedSection === 'prompt' ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <ClipboardList className="w-5 h-5" />
                                        Copy Prompt
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Section Cards */}
                        {Object.entries(SECTIONS).map(([sectionKey, config]) => {
                            const data = results[sectionKey];
                            if (!data) return null;
                            if (sectionKey === 'outline' && Array.isArray(data) && data.length === 0) return null;
                            const count = getSectionCount(sectionKey);
                            const Icon = config.icon;

                            return (
                                <div key={sectionKey} className="ctool-card ctool-card-flush overflow-hidden">
                                    {/* Section Header */}
                                    <div
                                        className="ctool-section-head"
                                        onClick={() => toggleSection(sectionKey)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="ctool-empty-icon h-10 w-10">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{config.label}</h3>
                                                <p className="text-xs text-gray-500">{count} items{sectionKey === 'outline' ? ' (excluded from prompt)' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${config.badgeColor}`}>
                                                {count}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); copySectionData(sectionKey); }}
                                                className="p-2 text-gray-500 hover:ctool-accent hover:bg-amber-50 rounded-lg transition"
                                                title={`Copy ${config.label}`}
                                            >
                                                {copiedSection === sectionKey ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                            {expandedSections[sectionKey] ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Section Content */}
                                    {expandedSections[sectionKey] && renderSectionContent(sectionKey)}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info */}
                <div className="ctool-note mt-6">
                    <p className="">
                        <strong>Content Analyzer:</strong> Add competitor URLs to extract entities, n-grams, skip-gram words, and content outlines. The "Copy Prompt" button copies all data (excluding outline) formatted for content optimization.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CompetitorContentAnalyzer;
