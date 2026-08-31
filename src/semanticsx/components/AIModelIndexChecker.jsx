import React, { useState } from 'react';
import {
    Globe, Loader2, CheckCircle, XCircle, AlertCircle,
    ExternalLink, RefreshCw, Shield, Bot
} from 'lucide-react';

// AI Crawler definitions
const AI_CRAWLERS = [
    {
        id: 'google-gemini',
        name: 'Google Gemini',
        userAgent: 'Google-Extended',
        icon: '🟢',
        color: 'bg-green-500'
    },
    {
        id: 'openai-gpt-user',
        name: 'OpenAI GPT',
        userAgent: 'ChatGPT-User',
        icon: '🔵',
        color: 'bg-emerald-500'
    },
    {
        id: 'openai-gptbot',
        name: 'OpenAI GPT',
        userAgent: 'GPTBot',
        icon: '🟢',
        color: 'bg-green-600'
    },
    {
        id: 'ccbot',
        name: 'CCBot',
        userAgent: 'CCBot',
        icon: '🔵',
        color: 'bg-blue-500'
    },
    {
        id: 'anthropic-claude',
        name: 'Anthropic Claude',
        userAgent: 'anthropic-ai',
        icon: '🟠',
        color: 'bg-orange-500'
    },
    {
        id: 'claudebot',
        name: 'Anthropic Claude',
        userAgent: 'ClaudeBot',
        icon: '🟠',
        color: 'bg-orange-600'
    },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        userAgent: 'PerplexityBot',
        icon: '🟣',
        color: 'bg-purple-500'
    }
];

const AIModelIndexChecker = () => {
    const [urls, setUrls] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');

    // Parse robots.txt and check rules for a specific user-agent
    const checkRobotsForBot = (robotsTxt, userAgent, path = '/') => {
        if (!robotsTxt) return { allowed: true, reason: 'No robots.txt found' };

        const lines = robotsTxt.split('\n');
        let currentUserAgent = null;
        let rules = [];
        let specificRules = [];
        let wildcardRules = [];

        for (const line of lines) {
            const trimmed = line.trim().toLowerCase();

            if (trimmed.startsWith('user-agent:')) {
                currentUserAgent = trimmed.replace('user-agent:', '').trim();
            } else if (currentUserAgent) {
                if (trimmed.startsWith('disallow:') || trimmed.startsWith('allow:')) {
                    const rule = {
                        type: trimmed.startsWith('disallow:') ? 'disallow' : 'allow',
                        path: line.split(':')[1]?.trim() || ''
                    };

                    if (currentUserAgent === userAgent.toLowerCase()) {
                        specificRules.push(rule);
                    } else if (currentUserAgent === '*') {
                        wildcardRules.push(rule);
                    }
                }
            }
        }

        // Use specific rules if available, otherwise use wildcard
        rules = specificRules.length > 0 ? specificRules : wildcardRules;

        // Check if path is allowed
        for (const rule of rules) {
            if (rule.path && path.startsWith(rule.path)) {
                if (rule.type === 'disallow') {
                    return { allowed: false, reason: `Disallowed by rule: ${rule.path}` };
                }
            }
            if (rule.path === '/' && rule.type === 'disallow') {
                return { allowed: false, reason: 'All paths disallowed' };
            }
        }

        return { allowed: true, reason: 'Allowed' };
    };

    // Analyze URLs
    const handleAnalyze = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);

        if (urlList.length === 0) {
            setError('Please enter at least one URL to analyze');
            return;
        }

        if (urlList.length > 100) {
            setError('Maximum 100 URLs supported');
            return;
        }

        setError('');
        setIsAnalyzing(true);
        setResults([]);

        const analysisResults = [];

        for (const urlStr of urlList) {
            try {
                // Parse URL
                const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
                const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;

                let robotsTxt = '';
                let httpCode = 200;

                try {
                    // Try to fetch robots.txt via API proxy
                    const response = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: robotsUrl })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        robotsTxt = data.content || '';
                        httpCode = data.statusCode || 200;
                    }
                } catch (e) {
                    // Fallback: simulate analysis
                    robotsTxt = '';
                }

                // Check each AI crawler
                const crawlerResults = AI_CRAWLERS.map(crawler => {
                    const check = checkRobotsForBot(robotsTxt, crawler.userAgent, url.pathname);
                    return {
                        ...crawler,
                        status: check.allowed ? 'Allowed' : 'Blocked',
                        httpCode: httpCode,
                        details: check.reason
                    };
                });

                analysisResults.push({
                    url: url.href,
                    crawlers: crawlerResults
                });

            } catch (e) {
                analysisResults.push({
                    url: urlStr,
                    error: 'Invalid URL format',
                    crawlers: []
                });
            }
        }

        setResults(analysisResults);
        setIsAnalyzing(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 pb-24">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
                <div className="max-w-6xl mx-auto px-6 py-16 relative">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left - Info */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-medium">
                                    ✕ AI CRAWLER BOTS ANALYSIS
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                AI Model Index Checker
                            </h1>
                            <p className="text-lg text-gray-300 mb-6">
                                Analyze your website's accessibility to major AI crawlers and language models.
                                Check robots.txt compliance for GPT, Claude, Gemini, and more.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {['OpenAI', 'Claude', 'Gemini', 'Perplexity'].map((model) => (
                                    <span
                                        key={model}
                                        className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg"
                                    >
                                        {model}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Right - Input Card */}
                        <div className="bg-white rounded-2xl shadow-2xl p-6">
                            <h3 className="font-semibold text-gray-900 mb-1">Check URL Accessibility</h3>
                            <p className="text-sm text-gray-500 mb-4">Enter URLs to Analyze</p>

                            <textarea
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                placeholder="https://example.com/"
                                rows={5}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none font-mono text-sm"
                            />

                            <p className="text-xs text-gray-400 mt-2 mb-4">
                                One URL per line. Maximum 100 URLs supported.
                            </p>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !urls.trim()}
                                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        Analyze
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {results.length > 0 && (
                <div className="max-w-6xl mx-auto px-6 pb-24">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Bot className="w-5 h-5 text-indigo-600" />
                                Analysis Results
                            </h2>
                            <span className="text-sm text-gray-500">
                                {results.length} URL(s) analyzed
                            </span>
                        </div>

                        {results.map((result, idx) => (
                            <div key={idx} className="border-b border-gray-100 last:border-0">
                                {/* URL Header */}
                                <div className="px-6 py-4 bg-gray-50 flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-gray-400" />
                                    <span className="font-medium text-gray-900 truncate flex-1">
                                        {result.url}
                                    </span>
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-700"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>

                                {result.error ? (
                                    <div className="px-6 py-4 text-red-600 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {result.error}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                                                    <th className="px-6 py-3 font-medium">AI Bot / Crawler</th>
                                                    <th className="px-6 py-3 font-medium">Status</th>
                                                    <th className="px-6 py-3 font-medium">HTTP Code</th>
                                                    <th className="px-6 py-3 font-medium">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {result.crawlers.map((crawler, cIdx) => (
                                                    <tr key={cIdx} className="hover:bg-gray-50 transition">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 ${crawler.color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                                                    {crawler.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-gray-900">{crawler.name}</p>
                                                                    <p className="text-xs text-gray-500">{crawler.userAgent}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${crawler.status === 'Allowed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {crawler.status === 'Allowed' ? (
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                )}
                                                                {crawler.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600">
                                                            {crawler.httpCode}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500 text-sm">
                                                            {crawler.details}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* New Analysis Button */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => { setResults([]); setUrls(''); }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-xl font-medium transition"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Analysis
                        </button>
                    </div>
                </div>
            )}

            {/* Info Section */}
            {results.length === 0 && !isAnalyzing && (
                <div className="max-w-6xl mx-auto px-6 pb-16">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">About AI Crawler Bots</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { name: 'GPTBot', desc: 'OpenAI\'s web crawler for training and plugins' },
                                { name: 'Google-Extended', desc: 'Google\'s crawler for Gemini/Bard AI training' },
                                { name: 'ClaudeBot', desc: 'Anthropic\'s crawler for Claude AI' },
                                { name: 'PerplexityBot', desc: 'Perplexity AI\'s search crawler' }
                            ].map((bot) => (
                                <div key={bot.name} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <h4 className="font-medium text-white mb-1">{bot.name}</h4>
                                    <p className="text-sm text-gray-400">{bot.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIModelIndexChecker;
