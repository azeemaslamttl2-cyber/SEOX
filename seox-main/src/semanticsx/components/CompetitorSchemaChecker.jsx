import React, { useState, useMemo } from 'react';
import {
    Globe, Search, Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp,
    Plus, Trash2, ExternalLink, Code, AlertCircle, Lightbulb, FileCode,
    Building, User, ShoppingCart, FileText, HelpCircle, MapPin, Star,
    BarChart3, CheckCircle, XCircle, Zap, Target, Award, TrendingUp,
    Download, Eye, Layers, GitCompare, FileJson, Wand2
} from 'lucide-react';

const CompetitorSchemaChecker = () => {
    const [urls, setUrls] = useState(['']);
    const [isAnalyzing, setIsAnalyzing] = useState({});
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [expandedResults, setExpandedResults] = useState({});
    const [aiRecommendations, setAiRecommendations] = useState(null);
    const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
    const [activeTab, setActiveTab] = useState('results');
    const [selectedSchema, setSelectedSchema] = useState(null);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [generatedTemplate, setGeneratedTemplate] = useState(null);

    // Schema type icons and colors
    const SCHEMA_TYPES = {
        Organization: { icon: Building, color: 'bg-blue-500/15 text-blue-300', priority: 1 },
        LocalBusiness: { icon: MapPin, color: 'bg-green-500/15 text-green-300', priority: 1 },
        Person: { icon: User, color: 'bg-purple-500/15 text-purple-300', priority: 2 },
        Product: { icon: ShoppingCart, color: 'bg-orange-500/15 text-orange-300', priority: 1 },
        Article: { icon: FileText, color: 'bg-brand-500/100/15 text-cyan-300', priority: 1 },
        BlogPosting: { icon: FileText, color: 'bg-teal-500/15 text-teal-300', priority: 1 },
        NewsArticle: { icon: FileText, color: 'bg-sky-500/15 text-sky-300', priority: 1 },
        FAQPage: { icon: HelpCircle, color: 'bg-pink-500/15 text-pink-300', priority: 1 },
        WebSite: { icon: Globe, color: 'bg-indigo-500/15 text-indigo-300', priority: 1 },
        WebPage: { icon: Globe, color: 'bg-line-strong/15 schema-muted', priority: 2 },
        BreadcrumbList: { icon: ChevronDown, color: 'bg-amber-500/15 text-amber-300', priority: 2 },
        Review: { icon: Star, color: 'bg-yellow-500/15 text-yellow-300', priority: 2 },
        AggregateRating: { icon: Star, color: 'bg-yellow-500/15 text-yellow-300', priority: 2 },
        HowTo: { icon: Layers, color: 'bg-emerald-500/15 text-emerald-300', priority: 1 },
        Recipe: { icon: FileText, color: 'bg-rose-500/15 text-rose-300', priority: 1 },
        Event: { icon: Star, color: 'bg-violet-500/15 text-violet-300', priority: 2 },
        VideoObject: { icon: Eye, color: 'bg-red-500/15 text-red-300', priority: 1 },
        ImageObject: { icon: Eye, color: 'bg-sky-500/15 text-sky-300', priority: 3 },
        ItemList: { icon: Layers, color: 'bg-lime-500/15 text-lime-300', priority: 2 },
        SiteNavigationElement: { icon: Layers, color: 'bg-fuchsia-500/15 text-fuchsia-300', priority: 2 },
        WPHeader: { icon: Layers, color: 'bg-white/[0.06] text-white/60', priority: 3 },
        WPFooter: { icon: Layers, color: 'bg-white/[0.06] text-white/60', priority: 3 },
        WPSideBar: { icon: Layers, color: 'bg-white/[0.06] text-white/60', priority: 3 },
        Offer: { icon: ShoppingCart, color: 'bg-green-500/15 text-green-300', priority: 2 },
        AggregateOffer: { icon: ShoppingCart, color: 'bg-green-500/15 text-green-300', priority: 2 },
        Brand: { icon: Building, color: 'bg-blue-500/15 text-blue-300', priority: 3 },
        SearchAction: { icon: Search, color: 'bg-indigo-500/15 text-indigo-300', priority: 2 },
        ReadAction: { icon: Eye, color: 'bg-white/[0.06] text-white/60', priority: 3 },
        ListItem: { icon: Layers, color: 'bg-white/[0.06] text-white/60', priority: 3 },
        ContactPoint: { icon: User, color: 'bg-purple-500/15 text-purple-300', priority: 3 },
        PostalAddress: { icon: MapPin, color: 'bg-green-500/15 text-green-300', priority: 3 },
        Service: { icon: Zap, color: 'bg-amber-500/15 text-amber-300', priority: 2 },
        Course: { icon: FileText, color: 'bg-blue-500/15 text-blue-300', priority: 2 },
        CollectionPage: { icon: Layers, color: 'bg-indigo-500/15 text-indigo-300', priority: 2 },
        ProfilePage: { icon: User, color: 'bg-purple-500/15 text-purple-300', priority: 2 },
        AboutPage: { icon: FileText, color: 'bg-brand-500/100/15 text-cyan-300', priority: 2 },
        ContactPage: { icon: User, color: 'bg-green-500/15 text-green-300', priority: 2 },
        QAPage: { icon: HelpCircle, color: 'bg-pink-500/15 text-pink-300', priority: 2 },
        Question: { icon: HelpCircle, color: 'bg-pink-500/15 text-pink-300', priority: 2 },
        Answer: { icon: Check, color: 'bg-green-500/15 text-green-300', priority: 3 },
        CreativeWork: { icon: FileText, color: 'bg-line-strong/15 schema-muted', priority: 3 },
        SoftwareApplication: { icon: Code, color: 'bg-indigo-500/15 text-indigo-300', priority: 2 },
        MobileApplication: { icon: Code, color: 'bg-indigo-500/15 text-indigo-300', priority: 2 },
        Restaurant: { icon: MapPin, color: 'bg-orange-500/15 text-orange-300', priority: 1 },
        Store: { icon: ShoppingCart, color: 'bg-orange-500/15 text-orange-300', priority: 1 },
        MedicalEntity: { icon: AlertCircle, color: 'bg-red-500/15 text-red-300', priority: 2 },
        JobPosting: { icon: FileText, color: 'bg-blue-500/15 text-blue-300', priority: 1 },
        default: { icon: Code, color: 'bg-white/[0.06] text-white/60', priority: 3 }
    };

    // Required properties for common schema types
    const SCHEMA_REQUIREMENTS = {
        Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs', 'contactPoint', 'address'] },
        LocalBusiness: { required: ['name', 'address'], recommended: ['telephone', 'openingHours', 'geo', 'image'] },
        Article: { required: ['headline', 'author', 'datePublished'], recommended: ['image', 'publisher', 'dateModified'] },
        BlogPosting: { required: ['headline', 'author', 'datePublished'], recommended: ['image', 'publisher', 'dateModified'] },
        Product: { required: ['name'], recommended: ['image', 'description', 'offers', 'aggregateRating', 'brand', 'sku'] },
        FAQPage: { required: ['mainEntity'], recommended: [] },
        WebSite: { required: ['name', 'url'], recommended: ['potentialAction', 'publisher'] },
        BreadcrumbList: { required: ['itemListElement'], recommended: [] },
        HowTo: { required: ['name', 'step'], recommended: ['image', 'totalTime', 'tool', 'supply'] },
        VideoObject: { required: ['name', 'uploadDate', 'thumbnailUrl'], recommended: ['description', 'duration', 'contentUrl'] },
        SiteNavigationElement: { required: ['name'], recommended: ['url'] },
        Service: { required: ['name'], recommended: ['description', 'provider', 'areaServed'] },
        Event: { required: ['name', 'startDate', 'location'], recommended: ['endDate', 'performer', 'offers'] },
        JobPosting: { required: ['title', 'description', 'datePosted'], recommended: ['hiringOrganization', 'jobLocation', 'baseSalary'] },
    };

    // Recursively extract all schemas from nested structures
    const extractAllSchemas = (obj, schemas = [], depth = 0) => {
        if (depth > 10) return schemas; // Prevent infinite recursion

        if (!obj || typeof obj !== 'object') return schemas;

        // Handle arrays
        if (Array.isArray(obj)) {
            obj.forEach(item => extractAllSchemas(item, schemas, depth + 1));
            return schemas;
        }

        // Check if current object is a schema (has @type)
        if (obj['@type']) {
            // Handle multiple types (array of types)
            const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
            types.forEach(type => {
                // Only add if not already in schemas (avoid duplicates)
                const exists = schemas.some(s => {
                    const sType = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
                    return sType === type && JSON.stringify(s) === JSON.stringify(obj);
                });
                if (!exists) {
                    schemas.push({ ...obj, _extractedType: type });
                }
            });
        }

        // Recursively check all properties for nested schemas
        Object.keys(obj).forEach(key => {
            if (key.startsWith('@') || key.startsWith('_')) return; // Skip meta keys
            const value = obj[key];
            if (value && typeof value === 'object') {
                extractAllSchemas(value, schemas, depth + 1);
            }
        });

        return schemas;
    };

    // Calculate schema completeness score
    const calculateSchemaScore = (schema) => {
        const type = schema._extractedType || (Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type']);
        const requirements = SCHEMA_REQUIREMENTS[type];
        if (!requirements) return { score: 100, missing: [], recommended: [] };

        const missing = requirements.required.filter(prop => !schema[prop]);
        const missingRecommended = requirements.recommended.filter(prop => !schema[prop]);
        const totalRequired = requirements.required.length;
        const presentRequired = totalRequired - missing.length;
        const score = totalRequired > 0 ? Math.round((presentRequired / totalRequired) * 100) : 100;

        return { score, missing, recommended: missingRecommended };
    };

    // Build comparison matrix
    const comparisonMatrix = useMemo(() => {
        if (results.length === 0) return null;

        const allTypes = new Set();
        results.forEach(r => r.schemaTypes.forEach(t => allTypes.add(t)));

        const matrix = {};
        [...allTypes].sort().forEach(type => {
            matrix[type] = {};
            results.forEach(r => {
                const hasType = r.schemaTypes.includes(type);
                const schemas = r.schemas.filter(s => {
                    const sType = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
                    return sType === type;
                });
                matrix[type][r.url] = {
                    present: hasType,
                    count: schemas.length,
                    score: schemas.length > 0 ? calculateSchemaScore(schemas[0]).score : 0
                };
            });
        });

        return { types: [...allTypes].sort(), matrix };
    }, [results]);

    // Add URL input
    const addUrlInput = () => {
        setUrls([...urls, '']);
    };

    // Remove URL input
    const removeUrlInput = (index) => {
        const newUrls = urls.filter((_, i) => i !== index);
        setUrls(newUrls.length ? newUrls : ['']);
        setResults(prev => prev.filter(r => r.url !== urls[index]));
    };

    // Update URL value
    const updateUrl = (index, value) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    // Check single URL for schema
    const checkSchema = async (url, index) => {
        if (!url.trim()) return;

        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

        setIsAnalyzing(prev => ({ ...prev, [index]: true }));
        setError('');

        try {
            const proxyUrls = [
                `/api/proxy?url=${encodeURIComponent(normalizedUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`
            ];

            let html = '';
            let fetchSuccess = false;

            for (const proxyUrl of proxyUrls) {
                try {
                    const response = await fetch(proxyUrl);
                    if (!response.ok) continue;
                    html = await response.text();
                    if (html.includes('<') && html.length > 500) {
                        fetchSuccess = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!fetchSuccess) throw new Error('Failed to fetch page');

            const schemaScripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
            const rawSchemas = [];

            schemaScripts.forEach(script => {
                const content = script.replace(/<script[^>]*>|<\/script>/gi, '').trim();
                try {
                    const parsed = JSON.parse(content);
                    if (parsed['@graph']) {
                        // Extract all schemas from @graph array recursively
                        parsed['@graph'].forEach(item => {
                            extractAllSchemas(item, rawSchemas);
                        });
                    } else if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            extractAllSchemas(item, rawSchemas);
                        });
                    } else {
                        extractAllSchemas(parsed, rawSchemas);
                    }
                } catch (e) {
                    // Fallback: try to extract @type values from malformed JSON
                    const typeMatches = content.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
                    typeMatches.forEach(m => {
                        const type = m.match(/"@type"\s*:\s*"([^"]+)"/)?.[1];
                        if (type && !rawSchemas.some(s => s['@type'] === type && s.raw)) {
                            rawSchemas.push({ '@type': type, raw: true });
                        }
                    });
                }
            });

            // Filter out duplicates and clean up
            const schemas = [...new Map(rawSchemas.map(s => {
                const type = s._extractedType || (Array.isArray(s['@type']) ? s['@type'][0] : s['@type']);
                const key = type + '-' + (s.name || s.headline || s.url || JSON.stringify(s).slice(0, 50));
                return [key, s];
            })).values()];

            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const pageTitle = titleMatch?.[1]?.trim() || new URL(normalizedUrl).hostname;

            // Calculate scores for each schema
            const schemasWithScores = schemas.map(s => ({
                ...s,
                _score: calculateSchemaScore(s)
            }));

            const result = {
                url: normalizedUrl,
                title: pageTitle,
                schemas: schemasWithScores,
                schemaCount: schemas.length,
                schemaTypes: [...new Set(schemas.map(s => {
                    const type = s._extractedType || s['@type'];
                    return Array.isArray(type) ? type[0] : type;
                }).filter(Boolean))],
                avgScore: schemasWithScores.length > 0
                    ? Math.round(schemasWithScores.reduce((sum, s) => sum + s._score.score, 0) / schemasWithScores.length)
                    : 0,
                fetchedAt: new Date().toISOString()
            };

            setResults(prev => {
                const existing = prev.findIndex(r => r.url === normalizedUrl);
                if (existing >= 0) {
                    const newResults = [...prev];
                    newResults[existing] = result;
                    return newResults;
                }
                return [...prev, result];
            });

            setExpandedResults(prev => ({ ...prev, [normalizedUrl]: true }));

        } catch (err) {
            console.error('Error checking schema:', err);
            setError(`Failed to analyze ${url}: ${err.message}`);
        } finally {
            setIsAnalyzing(prev => ({ ...prev, [index]: false }));
        }
    };

    // Check all URLs
    const checkAllSchemas = async () => {
        const validUrls = urls.filter(u => u.trim());
        for (let i = 0; i < validUrls.length; i++) {
            await checkSchema(validUrls[i], i);
        }
    };

    // Generate AI recommendations
    const generateRecommendations = async () => {
        if (results.length === 0) {
            setError('Please analyze at least one URL first');
            return;
        }

        setIsGeneratingRecommendations(true);
        setError('');

        try {
            const schemasSummary = results.map(r => ({
                url: r.url,
                title: r.title,
                types: r.schemaTypes,
                count: r.schemaCount,
                avgScore: r.avgScore,
                schemas: r.schemas.map(s => ({
                    type: Array.isArray(s['@type']) ? s['@type'][0] : s['@type'],
                    score: s._score?.score || 100,
                    missing: s._score?.missing || [],
                    properties: Object.keys(s).filter(k => !k.startsWith('@') && !k.startsWith('_'))
                }))
            }));

            const systemPrompt = `You are an elite SEO expert specializing in structured data and schema markup.

Analyze the competitor schema data comprehensively and provide actionable insights.

Return valid JSON with this structure:
{
  "summary": "Executive summary of findings (2-3 sentences)",
  "overallScore": 75,
  "insights": {
    "quickWins": [{"schema": "Type", "reason": "Why easy to implement", "impact": "high/medium/low"}],
    "competitiveEdge": [{"schema": "Type", "reason": "How this differentiates you"}],
    "mustHave": [{"schema": "Type", "reason": "Why essential for this niche"}]
  },
  "schemaAnalysis": [
    {"type": "Schema type", "usage": "3/5 competitors", "avgScore": 85, "recommendation": "What to do"}
  ],
  "recommendations": [
    {"priority": "high/medium/low", "schema": "Type", "reason": "Why important", "implementation": "How to implement", "expectedImpact": "What results to expect"}
  ],
  "competitorStrengths": ["What competitors do well"],
  "competitorWeaknesses": ["Where competitors lack"],
  "industryBenchmark": "How these schemas compare to industry standards"
}`;

            const userPrompt = `Analyze these competitor schemas in depth:

${JSON.stringify(schemasSummary, null, 2)}

Provide comprehensive recommendations for outperforming these competitors with structured data.`;

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: userPrompt,
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json',
                    temperature: 0.3
                })
            });

            if (!response.ok) throw new Error('AI API error');

            const data = await response.json();
            setAiRecommendations(JSON.parse(data.text));
            setActiveTab('insights');

        } catch (err) {
            console.error('Error generating recommendations:', err);
            setError(`Failed to generate recommendations: ${err.message}`);
        } finally {
            setIsGeneratingRecommendations(false);
        }
    };

    // Generate schema template
    const generateSchemaTemplate = async (schemaType) => {
        setIsGeneratingTemplate(true);
        setError('');

        try {
            const competitorExamples = results.flatMap(r =>
                r.schemas.filter(s => {
                    const t = Array.isArray(s['@type']) ? s['@type'][0] : s['@type'];
                    return t === schemaType;
                }).map(s => ({ url: r.url, schema: s }))
            ).slice(0, 3);

            const systemPrompt = `You are an expert in schema.org structured data. Generate an optimized ${schemaType} schema template based on competitor examples and best practices.

Return valid JSON with:
{
  "template": { /* Complete JSON-LD schema with placeholder values like "[Your Company Name]" */ },
  "instructions": ["Step by step implementation guide"],
  "tips": ["Best practices and optimization tips"],
  "commonMistakes": ["What to avoid"]
}`;

            const userPrompt = `Create an optimized ${schemaType} schema template.

Competitor examples for reference:
${JSON.stringify(competitorExamples, null, 2)}

Generate a best-practice template that incorporates the best patterns from these examples.`;

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: userPrompt,
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json',
                    temperature: 0.2
                })
            });

            if (!response.ok) throw new Error('AI API error');

            const data = await response.json();
            setGeneratedTemplate({ type: schemaType, ...JSON.parse(data.text) });
            setActiveTab('template');

        } catch (err) {
            console.error('Error generating template:', err);
            setError(`Failed to generate template: ${err.message}`);
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    // Copy to clipboard
    const copySchema = (schema, index) => {
        const cleaned = { ...schema };
        delete cleaned._score;
        const text = JSON.stringify(cleaned, null, 2);
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const toggleResult = (url) => {
        setExpandedResults(prev => ({ ...prev, [url]: !prev[url] }));
    };

    const getSchemaConfig = (type) => {
        return SCHEMA_TYPES[type] || SCHEMA_TYPES.default;
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-400 bg-green-500/15';
        if (score >= 50) return 'text-amber-600 bg-amber-100';
        return 'text-red-600 bg-red-100';
    };

    return (
        <div className="schema-page">
            <div className="">
                {/* Header */}
                <div className="ctool-hero mb-6">
                    <div className="ctool-hero-row">
                        <div className="ctool-hero-icon">
                            <FileCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="ctool-title font-display">Schema Intelligence Analyzer</h1>
                            <p className="ctool-subtitle">AI-Powered Competitor Schema Analysis & Optimization</p>
                        </div>
                    </div>
                    <p className="sres-hero-meta">
                        Scan competitor schemas, validate against schema.org, compare coverage, and get AI-powered recommendations.
                    </p>
                </div>

                {/* URL Inputs */}
                <div className="schema-card mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="schema-card-title flex items-center gap-2">
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

                    <div className="space-y-3">
                        {urls.map((url, index) => (
                            <div key={index} className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sres-search-icon" />
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => updateUrl(index, e.target.value)}
                                        placeholder="https://competitor.com"
                                        className="schema-input schema-input-lg pl-11"
                                    />
                                </div>
                                <button
                                    onClick={() => checkSchema(url, index)}
                                    disabled={!url.trim() || isAnalyzing[index]}
                                    className="ui-button ui-button-primary w-full sm:w-auto"
                                >
                                    {isAnalyzing[index] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Scan
                                </button>
                                {urls.length > 1 && (
                                    <button onClick={() => removeUrlInput(index)} className="ui-button schema-remove">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {urls.filter(u => u.trim()).length > 1 && (
                        <button
                            onClick={checkAllSchemas}
                            className="ui-button schema-add mt-4"
                        >
                            <Search className="w-4 h-4" />
                            Scan All URLs
                        </button>
                    )}

                    {error && (
                        <div className="app-alert app-alert-error mt-4">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {results.length > 0 && (
                    <>
                        {/* Stats Overview - Only show comparison stats when multiple URLs */}
                        {results.length > 1 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="schema-result">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-brand-500/15 rounded-lg"><Globe className="w-5 h-5 ctool-accent" /></div>
                                        <div>
                                            <div className="schema-stat">{results.length}</div>
                                            <div className="schema-muted">Sites Compared</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="schema-result">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/15 rounded-lg"><Code className="w-5 h-5 text-indigo-400" /></div>
                                        <div>
                                            <div className="schema-stat">{results.reduce((sum, r) => sum + r.schemaCount, 0)}</div>
                                            <div className="schema-muted">Total Schemas</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="schema-result">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-500/15 rounded-lg"><Layers className="w-5 h-5 text-purple-400" /></div>
                                        <div>
                                            <div className="schema-stat">{comparisonMatrix?.types.length || 0}</div>
                                            <div className="schema-muted">Unique Types</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="schema-result">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-500/15 rounded-lg"><TrendingUp className="w-5 h-5 text-green-400" /></div>
                                        <div>
                                            <div className="schema-stat">{Math.round(results.reduce((sum, r) => sum + r.avgScore, 0) / results.length)}%</div>
                                            <div className="schema-muted">Avg Score</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Navigation */}
                        <div className="schema-tabs mb-6">
                            <div className="schema-tabbar">
                                {[
                                    { id: 'results', label: 'Results', icon: FileJson },
                                    { id: 'matrix', label: 'Comparison', icon: GitCompare },
                                    { id: 'insights', label: 'AI Insights', icon: Sparkles },
                                    { id: 'template', label: 'Templates', icon: Wand2 },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`ui-button ctool-tab ${activeTab === tab.id ? 'active' : ''}`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                ))}
                                <div className="flex-1" />
                                <button
                                    onClick={generateRecommendations}
                                    disabled={isGeneratingRecommendations}
                                    className="ui-button ui-button-primary m-2"
                                >
                                    {isGeneratingRecommendations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Analyze with AI
                                </button>
                            </div>

                            <div className="p-4 md:p-6">
                                {/* Results Tab */}
                                {activeTab === 'results' && (
                                    <div className="space-y-4">
                                        {results.map((result, idx) => (
                                            <div key={result.url} className="border border-white/[0.08] rounded-xl overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-4 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition"
                                                    onClick={() => toggleResult(result.url)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {expandedResults[result.url] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                        <div>
                                                            <h3 className="schema-card-title">{result.title}</h3>
                                                            <p className="text-xs text-white/40 truncate max-w-md">{result.url}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getScoreColor(result.avgScore)}`}>
                                                            {result.avgScore}% Quality
                                                        </span>
                                                        <span className="ctool-count-badge">
                                                            {result.schemaCount} schemas
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setResults(prev => prev.filter(r => r.url !== result.url));
                                                            }}
                                                            className="ui-button schema-remove"
                                                            title="Remove from analysis"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {expandedResults[result.url] && (
                                                    <div className="p-4 space-y-4">
                                                        <div className="flex flex-wrap gap-2">
                                                            {result.schemaTypes.map((type, i) => {
                                                                const config = getSchemaConfig(type);
                                                                const Icon = config.icon;
                                                                return (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => generateSchemaTemplate(type)}
                                                                        disabled={isGeneratingTemplate}
                                                                        className="ui-button ctool-pill"
                                                                        title="Click to generate template"
                                                                    >
                                                                        <Icon className="w-4 h-4" />
                                                                        {type}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="space-y-3">
                                                            {result.schemas.map((schema, i) => {
                                                                const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
                                                                const config = getSchemaConfig(type);
                                                                const Icon = config.icon;
                                                                const score = schema._score;

                                                                return (
                                                                    <div key={i} className="bg-white/[0.03] rounded-lg p-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`flex items-center gap-2 px-2 py-1 rounded ${config.color}`}>
                                                                                    <Icon className="w-4 h-4" />
                                                                                    <span className="text-sm font-medium">{type}</span>
                                                                                </div>
                                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(score.score)}`}>
                                                                                    {score.score}%
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => copySchema(schema, `${idx}-${i}`)}
                                                                                className="ui-button schema-remove schema-copy"
                                                                            >
                                                                                {copiedIndex === `${idx}-${i}` ? <Check className="w-4 h-4 text-success-600" /> : <Copy className="w-4 h-4" />}
                                                                            </button>
                                                                        </div>

                                                                        {score.missing.length > 0 && (
                                                                            <div className="mb-2 flex items-center gap-2 text-xs text-red-600">
                                                                                <XCircle className="w-3 h-3" />
                                                                                Missing required: {score.missing.join(', ')}
                                                                            </div>
                                                                        )}

                                                                        {!schema.raw && (
                                                                            <pre className="text-xs text-white/50 bg-white p-3 rounded overflow-x-auto">
                                                                                {JSON.stringify(schema, (k, v) => k.startsWith('_') ? undefined : v, 2)}
                                                                            </pre>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Comparison Matrix Tab */}
                                {activeTab === 'matrix' && comparisonMatrix && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-white/[0.03]">
                                                    <th className="text-left p-3 schema-card-title sticky left-0 bg-white/[0.03]">Schema Type</th>
                                                    {results.map(r => (
                                                        <th key={r.url} className="p-3 text-center schema-card-title min-w-[120px]">
                                                            <div className="truncate max-w-[100px]" title={r.title}>{r.title}</div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparisonMatrix.types.map(type => {
                                                    const config = getSchemaConfig(type);
                                                    const Icon = config.icon;
                                                    return (
                                                        <tr key={type} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                                                            <td className="p-3 sticky left-0 bg-white">
                                                                <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${config.color}`}>
                                                                    <Icon className="w-4 h-4" />
                                                                    <span className="font-medium">{type}</span>
                                                                </div>
                                                            </td>
                                                            {results.map(r => {
                                                                const cell = comparisonMatrix.matrix[type][r.url];
                                                                return (
                                                                    <td key={r.url} className="p-3 text-center">
                                                                        {cell.present ? (
                                                                            <div className="flex flex-col items-center gap-1">
                                                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${getScoreColor(cell.score)}`}>
                                                                                    {cell.score}%
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <XCircle className="w-5 h-5 text-white/20 mx-auto" />
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* AI Insights Tab */}
                                {activeTab === 'insights' && (
                                    <div>
                                        {aiRecommendations ? (
                                            <div className="space-y-6">
                                                {/* Summary */}
                                                <div className="bg-white/[0.04] rounded-xl p-5 border border-white/[0.08]">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-3 bg-white/[0.08] rounded-xl">
                                                            <Sparkles className="w-6 h-6 text-brand-400" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-white/60 text-lg">{aiRecommendations.summary}</p>
                                                            {aiRecommendations.overallScore && (
                                                                <div className="mt-3 flex items-center gap-3">
                                                                    <span className="schema-muted">Competitor Schema Coverage:</span>
                                                                    <span className={`text-xl font-bold ${aiRecommendations.overallScore >= 70 ? 'text-green-400' : aiRecommendations.overallScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                        {aiRecommendations.overallScore}%
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Insights Grid */}
                                                {aiRecommendations.insights && (
                                                    <div className="grid md:grid-cols-3 gap-4">
                                                        {aiRecommendations.insights.quickWins?.length > 0 && (
                                                            <div className="schema-result-found">
                                                                <h4 className="font-semibold text-green-300 flex items-center gap-2 mb-3">
                                                                    <Zap className="w-5 h-5" /> Quick Wins
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {aiRecommendations.insights.quickWins.map((item, i) => (
                                                                        <div key={i} className="bg-white/[0.06] rounded-lg p-3 border border-green-500/10">
                                                                            <div className="font-medium text-green-300">{item.schema}</div>
                                                                            <div className="schema-muted">{item.reason}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {aiRecommendations.insights.competitiveEdge?.length > 0 && (
                                                            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                                                                <h4 className="font-semibold text-purple-300 flex items-center gap-2 mb-3">
                                                                    <Award className="w-5 h-5" /> Competitive Edge
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {aiRecommendations.insights.competitiveEdge.map((item, i) => (
                                                                        <div key={i} className="bg-white/[0.06] rounded-lg p-3 border border-purple-500/10">
                                                                            <div className="font-medium text-purple-300">{item.schema}</div>
                                                                            <div className="schema-muted">{item.reason}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {aiRecommendations.insights.mustHave?.length > 0 && (
                                                            <div className="schema-result-missing">
                                                                <h4 className="font-semibold text-red-300 flex items-center gap-2 mb-3">
                                                                    <Target className="w-5 h-5" /> Must Have
                                                                </h4>
                                                                <div className="space-y-2">
                                                                    {aiRecommendations.insights.mustHave.map((item, i) => (
                                                                        <div key={i} className="bg-white/[0.06] rounded-lg p-3 border border-red-500/10">
                                                                            <div className="font-medium text-red-300">{item.schema}</div>
                                                                            <div className="schema-muted">{item.reason}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Detailed Recommendations */}
                                                {aiRecommendations.recommendations?.length > 0 && (
                                                    <div>
                                                        <h3 className="font-semibold text-white/80 mb-3 flex items-center gap-2">
                                                            <Lightbulb className="w-5 h-5 text-amber-500" />
                                                            Detailed Recommendations
                                                        </h3>
                                                        <div className="space-y-3">
                                                            {aiRecommendations.recommendations.map((rec, i) => (
                                                                <div key={i} className={`p-4 rounded-xl border ${rec.priority === 'high' ? 'bg-red-500/10 border-red-500/20' :
                                                                    rec.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/20' :
                                                                        'bg-green-500/10 border-green-500/20'
                                                                    }`}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${rec.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                                            rec.priority === 'medium' ? 'app-badge app-badge-warning' :
                                                                                'app-badge app-badge-success'
                                                                            }`}>{rec.priority}</span>
                                                                        <span className="schema-card-title">{rec.schema}</span>
                                                                        <button
                                                                            onClick={() => generateSchemaTemplate(rec.schema)}
                                                                            disabled={isGeneratingTemplate}
                                                                            className="ui-button ctool-tool-btn ml-auto"
                                                                        >
                                                                            <Wand2 className="w-3 h-3" /> Generate
                                                                        </button>
                                                                    </div>
                                                                    <p className="schema-muted mb-1">{rec.reason}</p>
                                                                    <p className="text-xs text-white/40">💡 {rec.implementation}</p>
                                                                    {rec.expectedImpact && (
                                                                        <p className="text-xs text-brand-400 mt-1">📈 {rec.expectedImpact}</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="schema-empty">
                                                <Sparkles className="w-12 h-12 mx-auto mb-4" />
                                                <h3 className="mb-2">No AI Analysis Yet</h3>
                                                <p className="text-white/40 mb-4">Click "Analyze with AI" to get intelligent recommendations</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Template Tab */}
                                {activeTab === 'template' && (
                                    <div>
                                        {generatedTemplate ? (
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="schema-card-title flex items-center gap-2">
                                                        <Wand2 className="w-5 h-5 ctool-accent" />
                                                        {generatedTemplate.type} Schema Template
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(JSON.stringify(generatedTemplate.template, null, 2));
                                                            setCopiedIndex('template');
                                                            setTimeout(() => setCopiedIndex(null), 2000);
                                                        }}
                                                        className="ui-button ctool-tool-btn"
                                                    >
                                                        {copiedIndex === 'template' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                        Copy Template
                                                    </button>
                                                </div>

                                                <div className="schema-code rounded-xl p-4 overflow-x-auto">
                                                    <pre className="text-sm schema-muted font-mono">
                                                        {JSON.stringify(generatedTemplate.template, null, 2)}
                                                    </pre>
                                                </div>

                                                {generatedTemplate.instructions?.length > 0 && (
                                                    <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                                                        <h4 className="font-semibold text-blue-300 mb-3">📋 Implementation Steps</h4>
                                                        <ol className="space-y-2">
                                                            {generatedTemplate.instructions.map((step, i) => (
                                                                <li key={i} className="flex gap-3 schema-muted">
                                                                    <span className="w-6 h-6 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center flex-shrink-0 font-medium">{i + 1}</span>
                                                                    {step}
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </div>
                                                )}

                                                {generatedTemplate.tips?.length > 0 && (
                                                    <div className="schema-result-found">
                                                        <h4 className="font-semibold text-green-300 mb-2">💡 Best Practices</h4>
                                                        <ul className="space-y-1">
                                                            {generatedTemplate.tips.map((tip, i) => (
                                                                <li key={i} className="schema-muted">• {tip}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {generatedTemplate.commonMistakes?.length > 0 && (
                                                    <div className="schema-result-missing">
                                                        <h4 className="font-semibold text-red-300 mb-2">⚠️ Common Mistakes to Avoid</h4>
                                                        <ul className="space-y-1">
                                                            {generatedTemplate.commonMistakes.map((mistake, i) => (
                                                                <li key={i} className="schema-muted">• {mistake}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="schema-empty">
                                                <Wand2 className="w-12 h-12 mx-auto mb-4" />
                                                <h3 className="mb-2">No Template Generated</h3>
                                                <p className="text-white/40">Click on any schema type badge to generate an optimized template</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Empty State */}
                {results.length === 0 && !Object.values(isAnalyzing).some(Boolean) && (
                    <div className="schema-empty-card">
                        <div className="kw-connect-icon mx-auto mb-4">
                            <FileCode className="w-6 h-6" />
                        </div>
                        <h3 className="ctool-empty-title mb-2">Schema Intelligence Analyzer</h3>
                        <p className="ctool-empty-text mx-auto mb-6">
                            Enter competitor URLs to scan their schema markup, validate against schema.org, and get AI-powered recommendations.
                        </p>
                        <div className="schema-feature-row">
                            <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Schema Validation</span>
                            <span className="flex items-center gap-1"><GitCompare className="w-4 h-4" /> Side-by-Side Comparison</span>
                            <span className="flex items-center gap-1"><Sparkles className="w-4 h-4" /> AI Recommendations</span>
                            <span className="flex items-center gap-1"><Wand2 className="w-4 h-4 text-cyan-500" /> Template Generation</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompetitorSchemaChecker;
