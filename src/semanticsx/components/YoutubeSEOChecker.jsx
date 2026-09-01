import React, { useState, useRef, useEffect } from 'react';
import {
    Youtube, Search, CheckCircle, XCircle, AlertTriangle, Loader2,
    Hash, Clock, Link2, Users, Subtitles, PlaySquare, FileText,
    Target, Copy, Check, ChevronDown, ChevronUp, Info, Shield,
    ExternalLink, List, Share2, AlertCircle, Sparkles, Eye, Play,
    MousePointerClick, Award, TrendingUp, CheckSquare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { readToolCache, writeToolCache } from '../lib/toolCache';
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

// ============================================================================
// YOUTUBE SEO CHECK DEFINITIONS
// ============================================================================

const YOUTUBE_SEO_CHECKS = {
    title_optimization: {
        name: 'Title Optimization',
        icon: Target,
        color: 'indigo',
        checks: [
            { id: 'keyword_in_title', name: 'Primary Keyword in Title', description: 'Video title should contain the primary keyword' },
            { id: 'lsi_keywords_in_title', name: 'LSI Keywords in Title', description: 'Title should include related/LSI keywords for better reach' },
        ]
    },
    description_optimization: {
        name: 'Description Optimization',
        icon: FileText,
        color: 'emerald',
        checks: [
            { id: 'keywords_in_description', name: 'Keywords in Description', description: 'Primary keyword should appear in video description' },
            { id: 'hashtags_in_description', name: 'Hashtags in Description', description: 'Use relevant #hashtags in description for discoverability' },
            { id: 'timestamps_in_description', name: 'Timestamps in Description', description: 'Add timestamps/chapters for better navigation (e.g., 00:00 Intro)' },
            { id: 'keywords_list_in_description', name: 'Keywords List in Description', description: 'Include a keywords/tags section in description' },
        ]
    },
    tags_optimization: {
        name: 'Tags & Keywords',
        icon: Hash,
        color: 'purple',
        checks: [
            { id: 'keyword_in_tags', name: 'Keyword in Tags', description: 'Primary keyword should be in video tags' },
            { id: 'has_tags', name: 'Video Has Tags', description: 'Video should have relevant tags added' },
        ]
    },
    engagement_elements: {
        name: 'Engagement Elements',
        icon: PlaySquare,
        color: 'amber',
        checks: [
            { id: 'end_screen_added', name: 'End Screen at Video End', description: 'Add end screen elements to promote other videos', manual: true },
            { id: 'subtitles_added', name: 'Subtitles/Captions Added', description: 'Video should have subtitles/closed captions for accessibility' },
        ]
    },
    description_links: {
        name: 'Description Links & Info',
        icon: Link2,
        color: 'cyan',
        checks: [
            { id: 'copyright_disclaimer', name: 'Copyright Disclaimer', description: 'Add copyright/fair use disclaimer in description' },
            { id: 'related_video_links', name: 'Related Video Links', description: 'Link to related videos in description' },
            { id: 'social_profile_links', name: 'Social Profile Links', description: 'Include social media links in description' },
        ]
    },
    upload_best_practices: {
        name: 'Upload Best Practices',
        icon: Shield,
        color: 'rose',
        checks: [
            { id: 'keyword_in_filename', name: 'Keyword in Video Filename', description: 'Original video filename should contain the keyword (check before upload)', manual: true },
        ]
    }
};

// Social media platform patterns
const SOCIAL_PATTERNS = [
    /twitter\.com/i, /x\.com/i, /facebook\.com/i, /fb\.com/i,
    /instagram\.com/i, /linkedin\.com/i, /tiktok\.com/i,
    /pinterest\.com/i, /discord\.gg/i, /twitch\.tv/i,
    /t\.me/i, /telegram\./i
];

// Copyright/disclaimer patterns
const COPYRIGHT_PATTERNS = [
    /copyright/i, /fair use/i, /disclaimer/i, /©/i,
    /all rights reserved/i, /no copyright infringement/i,
    /educational purposes/i, /entertainment purposes/i
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const YoutubeSEOChecker = () => {
    const [videoUrl, setVideoUrl] = useState('');
    const [keyword, setKeyword] = useState('');
    const [videoData, setVideoData] = useState(null);
    const [checkResults, setCheckResults] = useState({});
    const [manualChecks, setManualChecks] = useState({});
    const [currentCheck, setCurrentCheck] = useState(null);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [analysisComplete, setAnalysisComplete] = useState(false);
    const abortRef = useRef(false);

    const STORAGE_KEY = 'youtube_seo_cache';
    const TOOL_CACHE_KEY = 'youtube_seo';
    const { selectedProject } = useAuth();

    useEffect(() => {
        try {
            const cached = readToolCache(TOOL_CACHE_KEY, selectedProject?.id);
            if (cached) {
                if (cached.videoUrl) setVideoUrl(cached.videoUrl);
                if (cached.keyword) setKeyword(cached.keyword);
                if (cached.checkResults) setCheckResults(cached.checkResults);
                if (cached.manualChecks) setManualChecks(cached.manualChecks);
                if (cached.analysisComplete) setAnalysisComplete(cached.analysisComplete);
                if (cached.videoData) setVideoData(cached.videoData);
                return;
            }

            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.videoUrl) setVideoUrl(data.videoUrl);
                if (data.keyword) setKeyword(data.keyword);
                if (data.checkResults) setCheckResults(data.checkResults);
                if (data.manualChecks) setManualChecks(data.manualChecks);
                if (data.analysisComplete) setAnalysisComplete(data.analysisComplete);
                if (data.videoData) setVideoData(data.videoData);
            }
        } catch (e) {
            console.error('Error loading cache:', e);
        }
    }, [selectedProject?.id]);

    useEffect(() => {
        if (analysisComplete && videoUrl) {
            try {
                const cacheData = {
                    videoUrl, keyword, checkResults, manualChecks, analysisComplete, videoData, timestamp: Date.now()
                };
                if (selectedProject?.id) {
                    writeToolCache(TOOL_CACHE_KEY, selectedProject.id, cacheData);
                } else {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
                }
            } catch (e) {
                console.error('Error saving cache:', e);
            }
        }
    }, [videoUrl, keyword, checkResults, manualChecks, analysisComplete, videoData, selectedProject?.id]);

    const toggleManualCheck = (checkId) => {
        setManualChecks(prev => ({ ...prev, [checkId]: !prev[checkId] }));
    };

    const extractVideoId = (url) => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
            /youtube\.com\/shorts\/([^&\n?#]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const fetchVideoData = async () => {
        const videoId = extractVideoId(videoUrl);
        if (!videoId) { setError('Please enter a valid YouTube video URL'); return; }
        if (!keyword.trim()) { setError('Please enter your primary keyword to analyze'); return; }

        setIsFetching(true);
        setError('');
        setVideoData(null);
        setCheckResults({});
        setManualChecks({});
        setAnalysisComplete(false);
        abortRef.current = false;

        try {
            const data = {
                videoId, title: '', description: '', tags: [], hasSubtitles: false, hasEndScreen: false,
                channelName: '', viewCount: '', thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            };

            // Strategy 1: Use YouTube oEmbed API (CORS-friendly, no proxy needed)
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
                const oembedRes = await fetch(oembedUrl);
                if (oembedRes.ok) {
                    const oembed = await oembedRes.json();
                    data.title = oembed.title || '';
                    data.channelName = oembed.author_name || '';
                    data.thumbnail = oembed.thumbnail_url || data.thumbnail;
                }
            } catch (e) { console.log('oEmbed failed:', e.message); }

            // Strategy 2: Use noembed.com for additional metadata (CORS-friendly)
            if (!data.title) {
                try {
                    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
                    const noembedRes = await fetch(noembedUrl);
                    if (noembedRes.ok) {
                        const noembed = await noembedRes.json();
                        data.title = noembed.title || data.title;
                        data.channelName = noembed.author_name || data.channelName;
                        data.thumbnail = noembed.thumbnail_url || data.thumbnail;
                    }
                } catch (e) { console.log('noembed failed:', e.message); }
            }

            // Strategy 3: Try proxied YouTube page scraping for full metadata (description, tags, etc.)
            const cacheBuster = `_cb=${Date.now()}`;
            const watchUrl = `https://www.youtube.com/watch?v=${videoId}&${cacheBuster}`;

            const proxies = [
                (url) => `/api/proxy?url=${encodeURIComponent(url)}`,
                (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
            ];

            for (const proxyFn of proxies) {
                if (abortRef.current) break;
                try {
                    const proxyUrl = proxyFn(watchUrl);
                    const request = proxyUrl.startsWith('/api/') ? authenticatedFetch : fetch;
                    const response = await request(
                        proxyUrl,
                        proxyUrl.startsWith('/api/proxy')
                            ? {
                                headers: {
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache'
                                }
                            }
                            : {
                                headers: {
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                                }
                            }
                    );
                    if (!response.ok) throw new Error(`Status: ${response.status}`);
                    const html = await response.text();

                    // Check for valid YouTube page content
                    if (html && html.length > 1000 && (html.includes('ytInitialPlayerResponse') || html.includes('videoPrimaryInfoRenderer'))) {
                        const parsed = parseVideoPage(html, videoId);
                        // Merge parsed data, preferring more detailed info
                        if (parsed.title) data.title = parsed.title;
                        if (parsed.description) data.description = parsed.description;
                        if (parsed.tags?.length) data.tags = parsed.tags;
                        if (parsed.channelName) data.channelName = parsed.channelName;
                        if (parsed.viewCount) data.viewCount = parsed.viewCount;
                        data.hasSubtitles = parsed.hasSubtitles;
                        data.hasEndScreen = parsed.hasEndScreen;
                        break;
                    }
                } catch (err) {
                    console.log(`Proxy failed: ${err.message}`);
                    continue;
                }
            }

            // If we have at least a title, proceed with analysis
            if (!data.title) {
                throw new Error('Could not fetch video metadata. Please check the URL and try again.');
            }

            setVideoData(data);
            setIsFetching(false);
            runAnalysis(data);
        } catch (err) {
            setError(`Failed to fetch video data: ${err.message}`);
            setIsFetching(false);
        }
    };

    const parseVideoPage = (html, videoId) => {
        const data = {
            videoId, title: '', description: '', tags: [], hasSubtitles: false, hasEndScreen: false,
            channelName: '', viewCount: '', thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        };

        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) data.title = titleMatch[1].replace(' - YouTube', '').trim();

        const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)">/i) ||
            html.match(/<meta\s+content="([^"]*)"\s+name="description">/i);
        if (metaDescMatch) data.description = metaDescMatch[1];

        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (playerResponseMatch) {
            try {
                const playerData = JSON.parse(playerResponseMatch[1]);
                if (playerData?.videoDetails?.shortDescription) data.description = playerData.videoDetails.shortDescription;
                if (playerData?.videoDetails?.title) data.title = playerData.videoDetails.title;
                if (playerData?.videoDetails?.keywords) data.tags = playerData.videoDetails.keywords;
                if (playerData?.videoDetails?.author) data.channelName = playerData.videoDetails.author;
                if (playerData?.videoDetails?.viewCount) data.viewCount = playerData.videoDetails.viewCount;
            } catch (e) { console.log('Could not parse player response'); }
        }

        data.hasSubtitles = html.includes('"captions"') || html.includes('captionTracks') || html.includes('"closedCaptions"');
        data.hasEndScreen = html.includes('endscreen') || html.includes('end-screen') || html.includes('"endScreenRenderer"') || html.includes('ytp-endscreen');

        const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)">/i);
        if (keywordsMatch && data.tags.length === 0) data.tags = keywordsMatch[1].split(',').map(t => t.trim()).filter(t => t);

        return data;
    };

    const runAnalysis = async (data) => {
        setIsAnalyzing(true);
        const results = {};
        const kw = keyword.toLowerCase().trim();

        const allChecks = Object.entries(YOUTUBE_SEO_CHECKS).flatMap(([categoryId, category]) =>
            category.checks.map(check => ({ ...check, categoryId }))
        );

        for (const check of allChecks) {
            if (abortRef.current) break;
            setCurrentCategory(check.categoryId);
            setCurrentCheck(check.id);
            results[check.id] = runCheck(check.id, data, kw, check.manual);
            setCheckResults({ ...results });
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        setCurrentCheck(null);
        setCurrentCategory(null);
        setIsAnalyzing(false);
        setAnalysisComplete(true);
    };

    const runCheck = (checkId, data, kw, isManual) => {
        const title = data.title?.toLowerCase() || '';
        const description = data.description?.toLowerCase() || '';
        const tags = data.tags?.map(t => t.toLowerCase()) || [];

        if (isManual) {
            return { passed: null, details: getManualCheckDetails(checkId), manual: true };
        }

        switch (checkId) {
            case 'keyword_in_title': {
                const hasKeyword = title.includes(kw);
                return { passed: hasKeyword, details: hasKeyword ? `Found "${kw}" in title` : 'Keyword not found in title' };
            }
            case 'lsi_keywords_in_title': {
                const kwParts = kw.split(' ').filter(w => w.length > 3);
                const hasAnyPart = kwParts.some(part => title.includes(part));
                const wordCount = title.split(' ').length;
                return { passed: hasAnyPart && wordCount >= 5, details: `Title has ${wordCount} words${hasAnyPart ? ', keyword variations found' : ''}` };
            }
            case 'keywords_in_description': {
                const hasKeyword = description.includes(kw);
                const count = (description.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
                return { passed: hasKeyword, details: hasKeyword ? `Keyword appears ${count}x in description` : 'Keyword not found in description' };
            }
            case 'hashtags_in_description': {
                const hashtags = description.match(/#\w+/g) || [];
                return { passed: hashtags.length >= 3, details: `Found ${hashtags.length} hashtags${hashtags.length > 0 ? ': ' + hashtags.slice(0, 5).join(', ') : ''}` };
            }
            case 'timestamps_in_description': {
                const timestamps = description.match(/\d{1,2}:\d{2}/g) || [];
                return { passed: timestamps.length >= 3, details: `Found ${timestamps.length} timestamps` };
            }
            case 'keywords_list_in_description': {
                const hasKeywordsList = /(?:keywords?|tags?)\s*[:|-]/i.test(description) || /(?:related|similar)\s*(?:videos?|content)/i.test(description);
                return { passed: hasKeywordsList, details: hasKeywordsList ? 'Keywords/tags section found' : 'No keywords list section detected' };
            }
            case 'keyword_in_tags': {
                const hasInTags = tags.some(t => t.includes(kw) || kw.includes(t));
                return { passed: hasInTags, details: hasInTags ? 'Keyword found in tags' : 'Keyword not in tags' };
            }
            case 'has_tags': {
                return { passed: tags.length >= 5, details: `Video has ${tags.length} tags${tags.length > 0 ? `: ${tags.slice(0, 5).join(', ')}...` : ''}` };
            }
            case 'subtitles_added': {
                return { passed: data.hasSubtitles, details: data.hasSubtitles ? 'Subtitles/captions available' : 'No subtitles detected' };
            }
            case 'copyright_disclaimer': {
                const hasDisclaimer = COPYRIGHT_PATTERNS.some(p => p.test(description));
                return { passed: hasDisclaimer, details: hasDisclaimer ? 'Copyright/disclaimer found' : 'No copyright disclaimer' };
            }
            case 'related_video_links': {
                const ytLinks = (data.description.match(/(?:youtube\.com\/watch|youtu\.be)/gi) || []).length;
                return { passed: ytLinks >= 2, details: `${ytLinks} YouTube video link(s) in description` };
            }
            case 'social_profile_links': {
                const socialLinks = SOCIAL_PATTERNS.filter(p => p.test(description)).length;
                return { passed: socialLinks >= 2, details: `${socialLinks} social media link(s) found` };
            }
            default:
                return { passed: false, details: 'Check not implemented' };
        }
    };

    const getManualCheckDetails = (checkId) => {
        switch (checkId) {
            case 'end_screen_added': return 'Verify end screen elements are added in YouTube Studio';
            case 'keyword_in_filename': return 'Ensure video file was named with keyword before upload';
            default: return 'Manual verification required';
        }
    };

    const copyResults = () => {
        if (!analysisComplete) return;
        let text = `🎬 YouTube Video SEO Analysis\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `📺 Video: ${videoData?.title || videoUrl}\n🔑 Keyword: ${keyword}\n📊 Score: ${score.passed}/${score.total} (${score.percent}%)\n\n`;
        Object.entries(YOUTUBE_SEO_CHECKS).flatMap(([_, category]) =>
            category.checks.map(check => {
                const result = checkResults[check.id];
                if (result) {
                    const isManualPassed = result.manual ? manualChecks[check.id] : null;
                    const isPassed = result.manual ? isManualPassed : result.passed;
                    const status = isPassed ? '✅' : (isPassed === false ? '❌' : '⏳');
                    text += `${status} ${check.name}\n   ${result.details}\n\n`;
                }
            })
        );
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getScore = () => {
        const allChecks = Object.entries(YOUTUBE_SEO_CHECKS).flatMap(([_, cat]) => cat.checks);
        let passed = 0, total = 0;
        allChecks.forEach(check => {
            const result = checkResults[check.id];
            if (result) {
                total++;
                if (result.manual) { if (manualChecks[check.id]) passed++; }
                else if (result.passed) passed++;
            }
        });
        return { passed, total, percent: total ? Math.round((passed / total) * 100) : 0 };
    };

    const score = getScore();

    const getScoreColor = () => {
        if (score.percent >= 80) return { bg: 'from-emerald-500 to-green-600', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200' };
        if (score.percent >= 50) return { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200' };
        return { bg: 'from-red-500 to-rose-600', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' };
    };
    const scoreColor = getScoreColor();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 p-6 overflow-auto">
            {/* Subtle background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-100/40 to-rose-100/40 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-100/30 to-indigo-100/30 rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-5xl mx-auto relative z-10">

                {/* Premium Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 text-white px-5 py-2 rounded-full text-sm font-semibold mb-5 shadow-lg shadow-red-500/25">
                        <Youtube className="w-4 h-4" />
                        YouTube SEO Optimization
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                        Video SEO <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">Checker</span>
                    </h1>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg">
                        Analyze your YouTube videos for SEO optimization and discover opportunities to rank higher
                    </p>
                </div>

                {/* Input Section - Premium Card */}
                <div className="bg-white rounded-3xl p-8 mb-8 border border-gray-100 shadow-xl shadow-gray-200/50">
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">
                                    <Youtube className="w-3.5 h-3.5 text-red-600" />
                                </div>
                                YouTube Video URL
                            </label>
                            <input
                                type="text"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all hover:border-gray-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Target className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                                Primary Keyword
                            </label>
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Enter your target keyword"
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all hover:border-gray-300"
                            />
                        </div>
                    </div>

                    <button
                        onClick={fetchVideoData}
                        disabled={isFetching || isAnalyzing}
                        className="w-full py-4 bg-gradient-to-r from-red-500 via-red-600 to-rose-600 hover:from-red-600 hover:via-red-700 hover:to-rose-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.01] active:scale-[0.99]"
                    >
                        {isFetching ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /><span>Fetching Video Data...</span></>
                        ) : isAnalyzing ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /><span>Analyzing SEO Factors...</span></>
                        ) : (
                            <><Search className="w-5 h-5" /><span>Analyze Video SEO</span></>
                        )}
                    </button>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Video Preview Card */}
                {videoData && (
                    <div className="bg-white rounded-3xl p-6 mb-8 border border-gray-100 shadow-xl shadow-gray-200/50">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-shrink-0 relative group">
                                <img
                                    src={videoData.thumbnail}
                                    alt={videoData.title}
                                    className="w-full md:w-64 h-36 object-cover rounded-2xl shadow-lg"
                                    onError={(e) => { e.target.src = `https://img.youtube.com/vi/${videoData.videoId}/hqdefault.jpg`; }}
                                />
                                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                                        <Play className="w-6 h-6 text-red-600 ml-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-2">{videoData.title}</h3>
                                <p className="text-gray-500 mb-4 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-gradient-to-r from-red-500 to-rose-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md">
                                        {videoData.channelName?.charAt(0)?.toUpperCase()}
                                    </span>
                                    <span className="font-medium">{videoData.channelName}</span>
                                </p>
                                <div className="flex flex-wrap items-center gap-4 text-sm">
                                    {Number(videoData.viewCount) > 0 && (
                                        <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                                            <Eye className="w-4 h-4" />
                                            <span className="font-medium">{Number(videoData.viewCount).toLocaleString()} views</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                                        <Hash className="w-4 h-4" />
                                        <span className="font-medium">{videoData.tags?.length || 0} tags</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                                        <FileText className="w-4 h-4" />
                                        <span className="font-medium">{videoData.description?.length || 0} chars</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Score Card */}
                {analysisComplete && (
                    <div className={`bg-white rounded-3xl p-8 mb-8 border ${scoreColor.border} shadow-xl shadow-gray-200/50`}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-8">
                                {/* Circular Score */}
                                <div className={`relative w-28 h-28 rounded-full bg-gradient-to-br ${scoreColor.bg} p-1 shadow-lg`}>
                                    <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
                                        <span className={`text-3xl font-bold ${scoreColor.text}`}>{score.percent}</span>
                                        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Score</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Award className="w-5 h-5 text-amber-500" />
                                        <h3 className="text-xl font-bold text-gray-900">SEO Analysis Complete</h3>
                                    </div>
                                    <p className="text-gray-500 text-lg">
                                        <span className={`font-bold ${scoreColor.text}`}>{score.passed}</span> of {score.total} optimization checks passed
                                    </p>
                                    <div className="flex items-center gap-4 mt-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                            <span className="text-gray-500 text-sm">Passed</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <span className="text-gray-500 text-sm">Needs Work</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                            <span className="text-gray-500 text-sm">Manual</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={copyResults}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-700 font-semibold transition-all hover:scale-105"
                            >
                                {copied ? (
                                    <><Check className="w-5 h-5 text-emerald-600" /><span>Copied!</span></>
                                ) : (
                                    <><Copy className="w-5 h-5" /><span>Copy Report</span></>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Check Results */}
                {Object.keys(checkResults).length > 0 && (
                    <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/25">
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">SEO Audit Report</h3>
                                    <p className="text-gray-500 text-sm">Detailed analysis of optimization factors</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {Object.entries(YOUTUBE_SEO_CHECKS).flatMap(([categoryId, category]) =>
                                category.checks.map(check => {
                                    const result = checkResults[check.id];
                                    if (!result) return null;

                                    const isManual = result.manual;
                                    const isManualChecked = manualChecks[check.id];
                                    const isPassed = isManual ? isManualChecked : result.passed;

                                    let bgColor, borderColor, iconBg, iconColor;
                                    if (isManual) {
                                        if (isManualChecked) {
                                            bgColor = 'bg-emerald-50'; borderColor = 'border-emerald-200'; iconBg = 'bg-emerald-500'; iconColor = 'text-white';
                                        } else {
                                            bgColor = 'bg-amber-50'; borderColor = 'border-amber-200'; iconBg = 'bg-amber-500'; iconColor = 'text-white';
                                        }
                                    } else if (isPassed) {
                                        bgColor = 'bg-emerald-50'; borderColor = 'border-emerald-200'; iconBg = 'bg-emerald-500'; iconColor = 'text-white';
                                    } else {
                                        bgColor = 'bg-red-50'; borderColor = 'border-red-200'; iconBg = 'bg-red-500'; iconColor = 'text-white';
                                    }

                                    return (
                                        <div
                                            key={check.id}
                                            className={`p-4 rounded-2xl ${bgColor} border ${borderColor} flex items-center gap-4 transition-all hover:shadow-md`}
                                        >
                                            <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                {isManual ? (
                                                    isManualChecked ? <CheckCircle className={`w-5 h-5 ${iconColor}`} /> : <MousePointerClick className={`w-5 h-5 ${iconColor}`} />
                                                ) : isPassed ? (
                                                    <CheckCircle className={`w-5 h-5 ${iconColor}`} />
                                                ) : (
                                                    <XCircle className={`w-5 h-5 ${iconColor}`} />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-gray-900">{check.name}</span>
                                                <p className="text-sm text-gray-600 mt-0.5">{result.details}</p>
                                            </div>

                                            {isManual && (
                                                <button
                                                    onClick={() => toggleManualCheck(check.id)}
                                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${isManualChecked
                                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/25'
                                                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                                                        }`}
                                                >
                                                    <CheckSquare className="w-4 h-4" />
                                                    <span>{isManualChecked ? 'Verified' : 'Mark Done'}</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            ).filter(Boolean)}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!videoData && !isFetching && !isAnalyzing && (
                    <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-xl shadow-gray-200/50">
                        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-3xl mb-8 shadow-lg">
                            <Youtube className="w-12 h-12 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Optimize</h3>
                        <p className="text-gray-500 max-w-md mx-auto text-lg">
                            Enter a YouTube video URL and keyword to analyze SEO optimization opportunities
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YoutubeSEOChecker;
