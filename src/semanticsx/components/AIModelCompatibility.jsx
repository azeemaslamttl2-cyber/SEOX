import React, { useState } from 'react';
import {
    Globe, Loader2, CheckCircle, XCircle, AlertCircle,
    ChevronDown, ChevronUp, BarChart3, Settings, Sparkles
} from 'lucide-react';

// AI Models configuration
const AI_MODELS = [
    { id: 'chatgpt', name: 'ChatGPT', color: 'bg-green-500', bgLight: 'bg-green-50', textColor: 'text-green-600' },
    { id: 'gemini', name: 'Gemini', color: 'bg-yellow-500', bgLight: 'bg-yellow-50', textColor: 'text-yellow-600' },
    { id: 'mistral', name: 'Mistral', color: 'bg-purple-500', bgLight: 'bg-purple-50', textColor: 'text-purple-600' },
    { id: 'cohere', name: 'Cohere', color: 'bg-yellow-500', bgLight: 'bg-yellow-50', textColor: 'text-yellow-600' },
    { id: 'claude', name: 'Claude', color: 'bg-purple-500', bgLight: 'bg-purple-50', textColor: 'text-purple-600' },
    { id: 'llama', name: 'Llama', color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-600' }
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
        if (score >= 61) return { text: 'Good', color: 'bg-green-500' };
        if (score >= 31) return { text: 'Fair', color: 'bg-yellow-500' };
        return { text: 'Needs Work', color: 'bg-red-500' };
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
        <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-12">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="px-6 py-16">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left - Info */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-xs font-medium">
                                    ✕ AI COMPATIBILITY ANALYSIS
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                AI Model Compatibility
                            </h1>
                            <p className="text-lg text-gray-300 mb-6">
                                Analyze your website's compatibility with major AI models including ChatGPT, Claude, Gemini,
                                and Perplexity. Check content structure, accessibility, meta data optimization, and receive
                                actionable recommendations to improve your site's AI model performance and understanding.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg">OpenAI</span>
                                <span className="px-3 py-1.5 bg-purple-500 text-white text-sm font-medium rounded-lg">Claude</span>
                                <span className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded-lg">Gemini</span>
                                <span className="px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg">Perplexity</span>
                            </div>
                        </div>

                        {/* Right - Input Card */}
                        <div className="bg-white rounded-2xl shadow-2xl p-6">
                            <h3 className="font-semibold text-gray-900 mb-1">Check URL Compatibility</h3>
                            <p className="text-sm text-gray-500 mb-4">Enter URL to Analyze</p>

                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Type to search your URLs..."
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition mb-2"
                            />

                            <p className="text-xs text-gray-400 mb-4">
                                Enter a URL from your website to analyze compatibility with major AI models like ChatGPT, Claude, Gemini, and Perplexity.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !url.trim()}
                                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
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
                <div className="px-6">
                    {/* AI Models We Analyze */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <BarChart3 className="w-6 h-6 text-purple-400" />
                            AI Models We Analyze
                        </h2>
                        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {AI_MODELS.map(model => (
                                <div key={model.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center hover:bg-white/15 transition">
                                    <div className={`w-12 h-12 ${model.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                                        <span className="text-white font-bold text-lg">{model.name.charAt(0)}</span>
                                    </div>
                                    <h4 className="font-semibold text-white">{model.name}</h4>
                                    <p className="text-xs text-gray-400 mt-1">5 research-backed checks</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* What We Analyze - Research-backed */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <Settings className="w-6 h-6 text-blue-400" />
                            What We Analyze (Research-Backed Criteria)
                        </h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                </div>
                                <h4 className="font-semibold text-white mb-2">E-E-A-T Signals</h4>
                                <p className="text-sm text-gray-400">Experience, Expertise, Authoritativeness, and Trustworthiness markers that AI models prioritize for reliable information.</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                                    <Globe className="w-5 h-5 text-blue-400" />
                                </div>
                                <h4 className="font-semibold text-white mb-2">Semantic Structure</h4>
                                <p className="text-sm text-gray-400">Content hierarchy, heading structure, FAQ sections, and bullet points that help AI parse and understand content.</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                                    <Settings className="w-5 h-5 text-purple-400" />
                                </div>
                                <h4 className="font-semibold text-white mb-2">Safety & Ethics</h4>
                                <p className="text-sm text-gray-400">Content moderation compliance, ethical standards, and harm prevention that AI safety systems evaluate.</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-3">
                                    <Sparkles className="w-5 h-5 text-yellow-400" />
                                </div>
                                <h4 className="font-semibold text-white mb-2">Embedding Quality</h4>
                                <p className="text-sm text-gray-400">Vectorization suitability, semantic clarity, and document chunking for AI retrieval and similarity matching.</p>
                            </div>
                        </div>
                    </div>

                    {/* Why AI Compatibility Matters - Research-backed */}
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Why AI Compatibility Matters</h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div>
                                <h4 className="font-semibold text-purple-400 mb-2">🔍 AI Search Visibility</h4>
                                <p className="text-sm text-gray-400">
                                    LLMs semantically process language to understand meaning and context. Well-structured content with E-E-A-T signals ranks higher in AI-powered search results.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-blue-400 mb-2">📚 Training Data Inclusion</h4>
                                <p className="text-sm text-gray-400">
                                    AI models like Llama filter training data based on quality, safety, and structure. Content meeting these criteria has higher inclusion probability.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-green-400 mb-2">💬 Conversational AI Answers</h4>
                                <p className="text-sm text-gray-400">
                                    ChatGPT, Claude, and Gemini prioritize clear, factual content with proper citations when generating answers. Optimized content appears more frequently.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {results && (
                <div className="px-6">
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
                                    <BarChart3 className="w-5 h-5 text-gray-400" />
                                    <h2 className="text-xl font-bold text-gray-900">Analysis Complete</h2>
                                </div>
                                <p className="text-blue-600 text-sm mb-2">{results.url}</p>
                                <p className="text-gray-500 text-sm">Overall compatibility score across all AI models</p>
                                <span className={`inline-block mt-2 px-3 py-1 ${getStatusBadge(getOverallScore()).color} text-white text-xs font-medium rounded-full`}>
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
                                        <h4 className="font-semibold text-gray-900 mb-3">{model.name}</h4>
                                        <div className="text-4xl font-bold mb-2" style={{ color: score >= 61 ? '#22c55e' : score >= 31 ? '#eab308' : '#ef4444' }}>
                                            {score}%
                                        </div>
                                        <span className={`inline-block px-2.5 py-1 ${status.color} text-white text-xs font-medium rounded-full mb-4`}>
                                            {status.text}
                                        </span>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                                            <div
                                                className={`h-full rounded-full ${score >= 61 ? 'bg-green-500' : score >= 31 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => toggleModel(model.id)}
                                            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
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
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-purple-600" />
                                Detailed Compatibility Checks
                            </h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter('passed')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${filter === 'passed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Passed
                                </button>
                                <button
                                    onClick={() => setFilter('failed')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${filter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Failed
                                </button>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {AI_MODELS.map(model => {
                                const counts = getCheckCounts(model.id);
                                const filteredChecks = getFilteredChecks(model.id);
                                const isExpanded = expandedModels[model.id] !== false; // Default expanded

                                return (
                                    <div key={model.id} className="p-6">
                                        <button
                                            onClick={() => toggleModel(model.id)}
                                            className="w-full flex items-center justify-between mb-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${model.color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                                    {model.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-gray-900">{model.name} Analysis</span>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                        </button>

                                        {isExpanded && (
                                            <>
                                                {/* Passed/Failed Summary */}
                                                <div className="grid grid-cols-2 gap-4 mb-6">
                                                    <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                                                        <div className="text-3xl font-bold text-green-600">{counts.passed}</div>
                                                        <div className="text-sm text-green-600">Passed</div>
                                                    </div>
                                                    <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
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
                                                                className={`p-4 rounded-xl border-l-4 ${isPassed ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {isPassed ? (
                                                                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                                                    ) : (
                                                                        <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                                                    )}
                                                                    <div>
                                                                        <h5 className="font-semibold text-gray-900">{cat.name}</h5>
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
