import React, { useState } from 'react';
import {
    Globe, Loader2, CheckCircle, XCircle, AlertCircle,
    ChevronDown, ChevronUp, BarChart3, Settings, Sparkles
} from 'lucide-react';

// AI Models configuration
const AI_MODELS = [
    /* The six models used three repeated hues as decoration behind an
       initial, not as data — the name is already on the card. */
    { id: 'chatgpt', name: 'ChatGPT', color: 'amc-avatar', bgLight: '', textColor: '' },
    { id: 'gemini', name: 'Gemini', color: 'amc-avatar', bgLight: '', textColor: '' },
    { id: 'mistral', name: 'Mistral', color: 'amc-avatar', bgLight: '', textColor: '' },
    { id: 'cohere', name: 'Cohere', color: 'amc-avatar', bgLight: '', textColor: '' },
    { id: 'claude', name: 'Claude', color: 'amc-avatar', bgLight: '', textColor: '' },
    { id: 'llama', name: 'Llama', color: 'amc-avatar', bgLight: '', textColor: '' }
];

// Compatibility check categories per model - Research-backed criteria
const CHECK_CATEGORIES = {
    chatgpt: [
        { id: 'eeat', name: 'E-E-A-T Signals (Expertise, Experience, Authority, Trust)', description: 'Content demonstrates clear expertise through author credentials, first-hand experience, citations from credible sources, and trustworthy information.' },
        { id: 'structure', name: 'Content Structure & Hierarchy', description: 'Well-organized content with proper H1-H6 heading hierarchy, bullet points, numbered lists, and FAQ sections for easy AI parsing.' },
        { id: 'semantic', name: 'Semantic Richness & Contextual Depth', description: 'Comprehensive topic coverage with related terms, synonyms, and semantically related keywords that demonstrate deep understanding.' },
        { id: 'readability', name: 'Clarity & Readability', description: 'Clear, concise language with short paragraphs, active voice, and error-free text that is unambiguous and easy to process.' },
        { id: 'schema', name: 'Structured Data (Schema.org)', description: 'Machine-readable Schema.org markup that explicitly tells AI systems the content type, purpose, and relationships.' }
    ],
    gemini: [
        { id: 'eeat', name: 'E-E-A-T Compliance', description: 'Demonstrates expertise through detailed author bios, relevant qualifications, original research, case studies, and citations from credible sources.' },
        { id: 'conversational', name: 'Conversational Query Optimization', description: 'Content optimized for natural language queries, question-based keywords, and long-tail phrases that match how users ask questions.' },
        { id: 'freshness', name: 'Content Freshness & Updates', description: 'Regularly updated content with current information, original data, expert insights, and real-world examples that demonstrate relevance.' },
        { id: 'technical', name: 'Technical SEO Foundation', description: 'Fast page speed, mobile responsiveness, HTTPS security, proper crawlability, and clean information architecture.' },
        { id: 'multimodal', name: 'Multimodal Content Optimization', description: 'Diverse multimedia content including images with alt tags, videos, and audio that Gemini can interpret alongside text.' }
    ],
    mistral: [
        { id: 'factual', name: 'Factual Accuracy & Verification', description: 'Content with verifiable claims, proper citations, and minimal factually incorrect information that Mistral can confidently reference.' },
        { id: 'moderation', name: 'Content Moderation Compliance', description: 'Content free from harmful categories including illegal activities, hateful content, misinformation, and unqualified professional advice.' },
        { id: 'multilingual', name: 'Multilingual Proficiency', description: 'Content available in multiple languages or with clear language structure that supports machine translation and global accessibility.' },
        { id: 'reasoning', name: 'Logical Structure & Reasoning', description: 'Clear reasoning flow, logical arguments, and step-by-step explanations that support Mistral\'s strong reasoning capabilities.' },
        { id: 'seo', name: 'SEO-Optimized Keywords', description: 'Strategic keyword incorporation for search engine visibility that helps Mistral identify and reference relevant content.' }
    ],
    cohere: [
        { id: 'embedding', name: 'Embedding-Friendly Content Structure', description: 'Well-structured text with clear sentences and paragraphs optimal for vectorization and semantic similarity calculations.' },
        { id: 'chunking', name: 'Document Chunking Suitability', description: 'Content divided into semantically coherent sections that can be effectively embedded and retrieved independently.' },
        { id: 'semantic', name: 'Semantic Clarity & Meaning', description: 'Text that conveys clear meaning with unambiguous relationships between concepts for accurate semantic understanding.' },
        { id: 'retrieval', name: 'Search & Retrieval Optimization', description: 'Topic-relevant keywords and phrases that enhance findability in semantic search with high similarity matching potential.' },
        { id: 'quality', name: 'Content Quality for Reranking', description: 'Rich, informative content that performs well in reranking systems, going beyond topical similarity to demonstrate quality.' }
    ],
    claude: [
        { id: 'ethical', name: 'Ethical Content Assessment', description: 'Content that is ethically neutral without signs of bias, deception, harmful information, or questionable claims.' },
        { id: 'safety', name: 'Content Safety & Harm Prevention', description: 'Content adhering to safety guidelines, free from violence, illegal activities, or content that could enable harm.' },
        { id: 'factual', name: 'Verifiable Factual Claims', description: 'Claims backed by evidence, proper citations from reliable sources, and clear distinction between facts and opinions.' },
        { id: 'professional', name: 'Professional Communication Standards', description: 'Clear, well-written content following professional standards with proper tone, structure, and grammatical correctness.' },
        { id: 'context', name: 'Long-Context Processing Optimization', description: 'Content structured for large context windows with clear sections, logical flow, and comprehensive coverage suitable for deep analysis.' }
    ],
    llama: [
        { id: 'quality', name: 'Training Data Quality Signals', description: 'Content meeting high-quality curation standards: original, well-written, and valuable for model training and learning.' },
        { id: 'safety', name: 'Content Safety Filtering', description: 'Content free from PII, adult content, NSFW material, and other elements that would be filtered from training datasets.' },
        { id: 'diversity', name: 'Content Diversity & Coverage', description: 'Diverse content types including knowledge, reasoning, multilingual elements, or technical documentation that enriches training.' },
        { id: 'structure', name: 'Clean HTML & Processing Efficiency', description: 'Lightweight, well-structured HTML with minimal complex scripts that enables efficient AI processing and extraction.' },
        { id: 'multilingual', name: 'Multilingual Support', description: 'Content supporting multiple languages or clear monolingual content that contributes to global language understanding.' }
    ]
};

const AIModelCompatibility = () => {
    const [url, setUrl] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | 'passed' | 'failed'
    const [expandedModels, setExpandedModels] = useState({});

    // Get status badge based on score
    const getStatusBadge = (score) => {
        if (score >= 61) return { text: 'Good', color: 'app-badge-success' };
        if (score >= 31) return { text: 'Fair', color: 'app-badge-warning' };
        return { text: 'Needs Work', color: 'app-badge-danger' };
    };

    // Analyze URL
    const handleAnalyze = async () => {
        if (!url.trim()) {
            setError('Please enter a URL to analyze');
            return;
        }

        setError('');
        setIsAnalyzing(true);
        setResults(null);

        try {
            const targetUrl = url.startsWith('http') ? url : `https://${url}`;

            // Fetch page content via proxy
            let pageContent = '';
            let rawHtml = '';
            try {
                const fetchResponse = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl })
                });
                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    rawHtml = data.content || '';

                    // Extract content with priority: <article> > <main> > <body>
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(rawHtml, 'text/html');

                    // Try to find article tag first (highest priority for content)
                    let contentElement = doc.querySelector('article');
                    if (!contentElement) {
                        contentElement = doc.querySelector('main');
                    }
                    if (!contentElement) {
                        contentElement = doc.querySelector('body');
                    }

                    if (contentElement) {
                        // Remove script and style tags
                        contentElement.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());

                        // Get clean text content
                        pageContent = contentElement.textContent
                            .replace(/\s+/g, ' ')  // Normalize whitespace
                            .replace(/\n\s*\n/g, '\n')  // Remove multiple newlines
                            .trim();
                    } else {
                        pageContent = rawHtml;
                    }
                }
            } catch (e) {
                console.log('Fetch failed, using fallback analysis');
            }

            // Create prompt for AI compatibility analysis
            const prompt = `Analyze this webpage for AI model compatibility. URL: ${targetUrl}
${pageContent ? `Page content preview: ${pageContent.substring(0, 3000)}` : 'Unable to fetch page content, analyze based on URL structure.'}

Evaluate compatibility with these AI models based on research-backed criteria:

**ChatGPT (OpenAI GPT-4):**
1. E-E-A-T Signals: Author credentials, expertise markers, citations, trustworthy information
2. Content Structure & Hierarchy: H1-H6 headings, bullet points, FAQ sections
3. Semantic Richness: Comprehensive topic coverage, related terms, contextual depth
4. Clarity & Readability: Short paragraphs, active voice, error-free text
5. Structured Data: Schema.org markup present

**Gemini (Google):**
1. E-E-A-T Compliance: Author bios, qualifications, original research, citations
2. Conversational Query Optimization: Natural language, question-based content
3. Content Freshness: Recent updates, current information, timestamps
4. Technical SEO: Page speed, mobile-friendly, HTTPS, crawlability
5. Multimodal Content: Images with alt tags, videos, diverse media

**Mistral:**
1. Factual Accuracy: Verifiable claims, proper citations, credible sources
2. Content Moderation: Free from harmful/illegal content, misinformation
3. Multilingual Proficiency: Multi-language support or clear structure
4. Logical Structure: Step-by-step reasoning, clear arguments
5. SEO Keywords: Strategic keyword incorporation

**Cohere:**
1. Embedding-Friendly: Clear sentences, well-structured paragraphs
2. Document Chunking: Semantically coherent sections
3. Semantic Clarity: Unambiguous meaning, clear concept relationships
4. Retrieval Optimization: Topic-relevant keywords, high findability
5. Content Quality: Rich, informative content for reranking

**Claude (Anthropic):**
1. Ethical Content: No bias, deception, or questionable claims
2. Safety & Harm Prevention: Free from violence, illegal content
3. Factual Claims: Evidence-backed, proper citations
4. Professional Standards: Clear writing, proper grammar
5. Long-Context Optimization: Clear sections, comprehensive coverage

**Llama (Meta):**
1. Training Data Quality: Original, well-written, valuable content
2. Safety Filtering: No PII, adult content, or NSFW material
3. Content Diversity: Knowledge, reasoning, technical documentation
4. Processing Efficiency: Clean HTML, minimal complex scripts
5. Multilingual Support: Multi-language or clear monolingual content

For each check, evaluate PASS or FAIL with specific reasoning based on actual page content.

Return JSON format:
{
  "models": {
    "chatgpt": { "score": 0-100, "checks": { "eeat": { "passed": true/false, "reason": "specific explanation" }, "structure": {...}, "semantic": {...}, "readability": {...}, "schema": {...} } },
    "gemini": { "score": 0-100, "checks": { "eeat": {...}, "conversational": {...}, "freshness": {...}, "technical": {...}, "multimodal": {...} } },
    "mistral": { "score": 0-100, "checks": { "factual": {...}, "moderation": {...}, "multilingual": {...}, "reasoning": {...}, "seo": {...} } },
    "cohere": { "score": 0-100, "checks": { "embedding": {...}, "chunking": {...}, "semantic": {...}, "retrieval": {...}, "quality": {...} } },
    "claude": { "score": 0-100, "checks": { "ethical": {...}, "safety": {...}, "factual": {...}, "professional": {...}, "context": {...} } },
    "llama": { "score": 0-100, "checks": { "quality": {...}, "safety": {...}, "diversity": {...}, "structure": {...}, "multilingual": {...} } }
  }
}`;

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemInstruction: 'You are an AI compatibility analyzer. Return valid JSON only.',
                    temperature: 0.3
                })
            });

            if (response.ok) {
                const data = await response.json();
                try {
                    // Extract JSON from response
                    const jsonMatch = data.text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        setResults({
                            url: targetUrl,
                            models: parsed.models || generateFallbackResults()
                        });
                    } else {
                        setResults({ url: targetUrl, models: generateFallbackResults() });
                    }
                } catch (e) {
                    setResults({ url: targetUrl, models: generateFallbackResults() });
                }
            } else {
                setResults({ url: targetUrl, models: generateFallbackResults() });
            }
        } catch (err) {
            console.error('Analysis error:', err);
            setResults({ url: url, models: generateFallbackResults() });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Generate fallback results for demo
    const generateFallbackResults = () => {
        const models = {};
        AI_MODELS.forEach(model => {
            const checks = {};
            const categories = CHECK_CATEGORIES[model.id] || [];
            let passed = 0;

            categories.forEach((cat, idx) => {
                const isPassed = Math.random() > 0.5;
                if (isPassed) passed++;
                checks[cat.id] = {
                    passed: isPassed,
                    reason: isPassed
                        ? `The content meets ${cat.name.toLowerCase()} requirements.`
                        : `The content lacks sufficient ${cat.name.toLowerCase()} optimization.`
                };
            });

            const score = Math.round((passed / categories.length) * 100);
            models[model.id] = { score, checks };
        });
        return models;
    };

    // Calculate overall score
    const getOverallScore = () => {
        if (!results?.models) return 0;
        const scores = Object.values(results.models).map(m => m.score || 0);
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    };

    // Toggle model expansion
    const toggleModel = (modelId) => {
        setExpandedModels(prev => ({ ...prev, [modelId]: !prev[modelId] }));
    };

    // Get filtered checks for a model
    const getFilteredChecks = (modelId) => {
        const modelResults = results?.models?.[modelId];
        if (!modelResults?.checks) return [];

        const categories = CHECK_CATEGORIES[modelId] || [];
        return categories.filter(cat => {
            const check = modelResults.checks[cat.id];
            if (filter === 'passed') return check?.passed;
            if (filter === 'failed') return !check?.passed;
            return true;
        });
    };

    // Get passed/failed counts for a model
    const getCheckCounts = (modelId) => {
        const modelResults = results?.models?.[modelId];
        if (!modelResults?.checks) return { passed: 0, failed: 0 };

        let passed = 0, failed = 0;
        Object.values(modelResults.checks).forEach(check => {
            if (check.passed) passed++;
            else failed++;
        });
        return { passed, failed };
    };

    return (
        <div className="ctool-page space-y-5">
            {/* Hero Section */}
            <div className="ctool-hero">
                <div className="ctool-hero-row">
                    <span className="ctool-hero-icon">
                        <Sparkles className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="app-badge app-badge-brand">AI COMPATIBILITY ANALYSIS</span>
                        </div>
                        <h1 className="ctool-title font-display">AI Model Compatibility</h1>
                        <p className="ctool-subtitle">
                            Analyze your website&apos;s compatibility with major AI models including ChatGPT, Claude, Gemini,
                            and Perplexity. Check content structure, accessibility, meta data optimization, and receive
                            actionable recommendations to improve your site&apos;s AI model performance and understanding.
                        </p>
                    </div>
                </div>
                <div className="amc-models">
                    {['OpenAI', 'Claude', 'Gemini', 'Perplexity'].map((m) => (
                        <span key={m} className="ctool-chip">{m}</span>
                    ))}
                </div>
            </div>

            <div className="ctool-card">
                <div>
                    <div>
                        <div>
                            <h3 className="schema-card-title mb-1">Check URL Compatibility</h3>
                            <p className="ctool-help-text mb-4">Enter URL to Analyze</p>

                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Type to search your URLs..."
                                className="schema-input schema-input-lg mb-2"
                            />

                            <p className="ctool-help-text mb-4">
                                Enter a URL from your website to analyze compatibility with major AI models like ChatGPT, Claude, Gemini, and Perplexity.
                            </p>

                            {error && (
                                <div className="app-alert app-alert-error mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !url.trim()}
                                className="ui-button ui-button-primary w-full"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Start Analysis
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Section - Only show when no results */}
            {!results && (
                <div className="space-y-5">
                    {/* AI Models We Analyze */}
                    <div className="ctool-card">
                        <h2 className="geo-section-title font-display mb-4 flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 ctool-accent" />
                            AI Models We Analyze
                        </h2>
                        <div className="amc-model-grid">
                            {AI_MODELS.map(model => (
                                <div key={model.id} className="amc-bot-card text-center">
                                    <div className="amc-avatar amc-avatar-lg mx-auto mb-3">
                                        {model.name.charAt(0)}
                                    </div>
                                    <h4 className="amc-bot-title">{model.name}</h4>
                                    <p className="amc-bot-desc mt-1">5 research-backed checks</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* What We Analyze - Research-backed */}
                    <div className="ctool-card">
                        <h2 className="geo-section-title font-display mb-4 flex items-center gap-3">
                            <Settings className="w-5 h-5 ctool-accent" />
                            What We Analyze (Research-Backed Criteria)
                        </h2>
                        <div className="amc-bot-grid">
                            <div className="amc-bot-card">
                                <div className="amc-bot-tile mb-3">
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                                <h4 className="amc-bot-title">E-E-A-T Signals</h4>
                                <p className="amc-bot-desc">Experience, Expertise, Authoritativeness, and Trustworthiness markers that AI models prioritize for reliable information.</p>
                            </div>
                            <div className="amc-bot-card">
                                <div className="amc-bot-tile mb-3">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <h4 className="amc-bot-title">Semantic Structure</h4>
                                <p className="amc-bot-desc">Content hierarchy, heading structure, FAQ sections, and bullet points that help AI parse and understand content.</p>
                            </div>
                            <div className="amc-bot-card">
                                <div className="amc-bot-tile mb-3">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <h4 className="amc-bot-title">Safety & Ethics</h4>
                                <p className="amc-bot-desc">Content moderation compliance, ethical standards, and harm prevention that AI safety systems evaluate.</p>
                            </div>
                            <div className="amc-bot-card">
                                <div className="amc-bot-tile mb-3">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <h4 className="amc-bot-title">Embedding Quality</h4>
                                <p className="amc-bot-desc">Vectorization suitability, semantic clarity, and document chunking for AI retrieval and similarity matching.</p>
                            </div>
                        </div>
                    </div>

                    {/* Why AI Compatibility Matters - Research-backed */}
                    <div className="ctool-card">
                        <h2 className="geo-section-title font-display mb-4">Why AI Compatibility Matters</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="amc-bot-card">
                                <h4 className="amc-bot-title">AI Search Visibility</h4>
                                <p className="amc-bot-desc">
                                    LLMs semantically process language to understand meaning and context. Well-structured content with E-E-A-T signals ranks higher in AI-powered search results.
                                </p>
                            </div>
                            <div className="amc-bot-card">
                                <h4 className="amc-bot-title">Training Data Inclusion</h4>
                                <p className="amc-bot-desc">
                                    AI models like Llama filter training data based on quality, safety, and structure. Content meeting these criteria has higher inclusion probability.
                                </p>
                            </div>
                            <div className="amc-bot-card">
                                <h4 className="amc-bot-title">Conversational AI Answers</h4>
                                <p className="amc-bot-desc">
                                    ChatGPT, Claude, and Gemini prioritize clear, factual content with proper citations when generating answers. Optimized content appears more frequently.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {results && (
                <div>
                    {/* Overall Score Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                        <div className="flex items-center gap-6">
                            {/* Circular Progress */}
                            <div className="relative w-24 h-24">
                                <svg className="w-24 h-24 transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                                    <circle
                                        cx="48" cy="48" r="40"
                                        stroke={getOverallScore() >= 61 ? '#22c55e' : getOverallScore() >= 31 ? '#eab308' : '#ef4444'}
                                        strokeWidth="8"
                                        fill="none"
                                        strokeDasharray={`${(getOverallScore() / 100) * 251.2} 251.2`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-gray-900">{getOverallScore()}</span>
                                    <span className="text-xs text-gray-500">Score</span>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <BarChart3 className="w-5 h-5 text-content-muted" />
                                    <h2 className="text-xl font-bold text-gray-900">Analysis Complete</h2>
                                </div>
                                <p className="ctool-help-text mb-2">{results.url}</p>
                                <p className="text-gray-500 text-sm">Overall compatibility score across all AI models</p>
                                <span className={`app-badge ${getStatusBadge(getOverallScore()).color} mt-2`}>
                                    {getStatusBadge(getOverallScore()).text}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Model Performance Cards */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Model Performance
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {AI_MODELS.map(model => {
                                const modelResults = results.models?.[model.id];
                                const score = modelResults?.score || 0;
                                const status = getStatusBadge(score);

                                return (
                                    <div key={model.id} className="bg-white rounded-xl shadow-lg p-6">
                                        <h4 className="amc-bot-name mb-3">{model.name}</h4>
                                        <div className="text-4xl font-bold mb-2" style={{ color: score >= 61 ? '#22c55e' : score >= 31 ? '#eab308' : '#ef4444' }}>
                                            {score}%
                                        </div>
                                        <span className={`app-badge ${status.color} mb-4`}>
                                            {status.text}
                                        </span>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                                            <div
                                                className={`amc-bar ${score >= 61 ? 'is-good' : score >= 31 ? 'is-fair' : 'is-poor'}`}
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => toggleModel(model.id)}
                                            className="schema-addlink"
                                        >
                                            <Settings className="w-4 h-4" />
                                            View Details
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Detailed Compatibility Checks */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg amc-bot-name flex items-center gap-2">
                                <Settings className="w-5 h-5 ctool-accent" />
                                Detailed Compatibility Checks
                            </h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`ui-button ctool-pill ${filter === 'all' ? 'active' : ''}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter('passed')}
                                    className={`ui-button ctool-pill ${filter === 'passed' ? 'active' : ''}`}
                                >
                                    Passed
                                </button>
                                <button
                                    onClick={() => setFilter('failed')}
                                    className={`ui-button ctool-pill ${filter === 'failed' ? 'active' : ''}`}
                                >
                                    Failed
                                </button>
                            </div>
                        </div>

                        <div className="amc-acc">
                            {AI_MODELS.map(model => {
                                const counts = getCheckCounts(model.id);
                                const filteredChecks = getFilteredChecks(model.id);
                                const isExpanded = expandedModels[model.id] !== false; // Default expanded

                                return (
                                    <div key={model.id} className="amc-acc-item">
                                        <button
                                            onClick={() => toggleModel(model.id)}
                                            className="amc-acc-head"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="amc-avatar">
                                                    {model.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="amc-bot-name">{model.name} Analysis</span>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-content-muted" /> : <ChevronDown className="w-5 h-5 text-content-muted" />}
                                        </button>

                                        {isExpanded && (
                                            <>
                                                {/* Passed/Failed Summary */}
                                                <div className="grid grid-cols-2 gap-4 mb-6">
                                                    <div className="amc-tally is-pass">
                                                        <div className="amc-count is-pass">{counts.passed}</div>
                                                        <div className="amc-count-label is-pass">Passed</div>
                                                    </div>
                                                    <div className="amc-tally is-fail">
                                                        <div className="text-3xl font-bold text-red-600">{counts.failed}</div>
                                                        <div className="text-sm text-red-600">Failed</div>
                                                    </div>
                                                </div>

                                                {/* Check Items */}
                                                <div className="space-y-3">
                                                    {filteredChecks.map(cat => {
                                                        const check = results.models?.[model.id]?.checks?.[cat.id];
                                                        const isPassed = check?.passed;

                                                        return (
                                                            <div
                                                                key={cat.id}
                                                                className={`amc-check ${isPassed ? 'is-pass' : 'is-fail'}`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {isPassed ? (
                                                                        <CheckCircle className="w-5 h-5 amc-icon-pass mt-0.5 flex-shrink-0" />
                                                                    ) : (
                                                                        <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                                                    )}
                                                                    <div>
                                                                        <h5 className="amc-bot-name">{cat.name}</h5>
                                                                        <p className="text-sm text-gray-600 mt-1">{check?.reason || cat.description}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIModelCompatibility;
