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
        icon: '🟢'
    },
    {
        id: 'openai-gpt-user',
        name: 'OpenAI GPT',
        userAgent: 'ChatGPT-User',
        icon: '🔵'
    },
    {
        id: 'openai-gptbot',
        name: 'OpenAI GPT',
        userAgent: 'GPTBot',
        icon: '🟢'
    },
    {
        id: 'ccbot',
        name: 'CCBot',
        userAgent: 'CCBot',
        icon: '🔵'
    },
    {
        id: 'anthropic-claude',
        name: 'Anthropic Claude',
        userAgent: 'anthropic-ai',
        icon: '🟠'
    },
    {
        id: 'claudebot',
        name: 'Anthropic Claude',
        userAgent: 'ClaudeBot',
        icon: '🟠'
    },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        userAgent: 'PerplexityBot',
        icon: '🟣'
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
        <div className="ctool-page space-y-5">
            {/* Hero Section */}
            <div className="ctool-hero">
                <div className="ctool-hero-row">
                    <span className="ctool-hero-icon">
                        <Bot className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="app-badge app-badge-brand">AI CRAWLER BOTS ANALYSIS</span>
                        </div>
                        <h1 className="ctool-title font-display">AI Model Index Checker</h1>
                        <p className="ctool-subtitle">
                            Analyze your website&apos;s accessibility to major AI crawlers and language models.
                            Check robots.txt compliance for GPT, Claude, Gemini, and more.
                        </p>
                    </div>
                </div>
                <div className="amc-models">
                    {['OpenAI', 'Claude', 'Gemini', 'Perplexity'].map((model) => (
                        <span key={model} className="ctool-chip">{model}</span>
                    ))}
                </div>
            </div>

            <div className="ctool-card">
                <div>
                    <div>
                        <div>
                            <h3 className="schema-card-title mb-1">Check URL Accessibility</h3>
                            <p className="ctool-help-text mb-4">Enter URLs to Analyze</p>

                            <textarea
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                placeholder="https://example.com/"
                                rows={5}
                                className="ctool-textarea"
                            />

                            <p className="ctool-help-text mt-2 mb-4">
                                One URL per line. Maximum 100 URLs supported.
                            </p>

                            {error && (
                                <div className="app-alert app-alert-error mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !urls.trim()}
                                className="ui-button ui-button-primary w-full"
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
                <div className="amc-results">
                    <div className="ctool-card llms-card">
                        <div className="llms-card-head flex items-center justify-between">
                            <h2 className="schema-card-title flex items-center gap-2">
                                <Bot className="w-5 h-5 ctool-accent" />
                                Analysis Results
                            </h2>
                            <span className="ctool-help-text">
                                {results.length} URL(s) analyzed
                            </span>
                        </div>

                        {results.map((result, idx) => (
                            <div key={idx} className="amc-group">
                                {/* URL Header */}
                                <div className="amc-group-head flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-content-muted" />
                                    <span className="amc-group-url truncate flex-1">
                                        {result.url}
                                    </span>
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ctool-accent"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>

                                {result.error ? (
                                    <div className="app-alert app-alert-error">
                                        <AlertCircle className="w-4 h-4" />
                                        {result.error}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="amc-thead">
                                                    <th className="amc-th">AI Bot / Crawler</th>
                                                    <th className="amc-th">Status</th>
                                                    <th className="amc-th">HTTP Code</th>
                                                    <th className="amc-th">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="amc-tbody">
                                                {result.crawlers.map((crawler, cIdx) => (
                                                    <tr key={cIdx} className="amc-tr">
                                                        <td className="amc-td">
                                                            <div className="flex items-center gap-3">
                                                                <div className="amc-avatar">
                                                                    {crawler.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="amc-bot-name">{crawler.name}</p>
                                                                    <p className="ctool-help-text">{crawler.userAgent}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="amc-td">
                                                            <span className={`app-badge ${crawler.status === 'Allowed' ? 'app-badge-success' : 'app-badge-danger'}`}>
                                                                {crawler.status === 'Allowed' ? (
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                )}
                                                                {crawler.status}
                                                            </span>
                                                        </td>
                                                        <td className="amc-td">
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
                            className="ui-button ctool-tool-btn amc-export"
                        >
                            <RefreshCw className="w-4 h-4" />
                            New Analysis
                        </button>
                    </div>
                </div>
            )}

            {/* Info Section */}
            {results.length === 0 && !isAnalyzing && (
                <div className="ctool-card">
                    <h3 className="geo-section-title font-display mb-4">About AI Crawler Bots</h3>
                    <div className="amc-bot-grid">
                        {[
                            { name: 'GPTBot', desc: "OpenAI's web crawler for training and plugins" },
                            { name: 'Google-Extended', desc: "Google's crawler for Gemini/Bard AI training" },
                            { name: 'ClaudeBot', desc: "Anthropic's crawler for Claude AI" },
                            { name: 'PerplexityBot', desc: "Perplexity AI's search crawler" }
                        ].map((bot) => (
                            <div key={bot.name} className="amc-bot-card">
                                <span className="amc-bot-tile">
                                    <Bot className="w-4 h-4" />
                                </span>
                                <h4 className="amc-bot-title">{bot.name}</h4>
                                <p className="amc-bot-desc">{bot.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIModelIndexChecker;
