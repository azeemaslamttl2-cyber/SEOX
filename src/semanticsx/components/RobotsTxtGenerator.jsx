import React, { useState, useMemo } from 'react';
import { FileText, Copy, Check, Download, Bot, Shield, Globe, Search, Share2, Image, File, AlertTriangle, ChevronDown, ChevronUp, Map, Settings } from 'lucide-react';

// Bot definitions for different categories
const SEARCH_ENGINE_BOTS = [
    { id: 'googlebot', name: 'Googlebot', agent: 'Googlebot' },
    { id: 'googleimages', name: 'Google Images', agent: 'Googlebot-Image' },
    { id: 'googlemobile', name: 'Google Mobile', agent: 'Googlebot-Mobile' },
    { id: 'googleadsbot', name: 'Google AdsBot', agent: 'AdsBot-Google' },
    { id: 'googlemediapartners', name: 'Google Media Partners', agent: 'Mediapartners-Google' },
    { id: 'bingbot', name: 'Bingbot', agent: 'Bingbot' },
    { id: 'msnbot', name: 'MSN Bot', agent: 'msnbot' },
    { id: 'msnbotmedia', name: 'MSN Bot Media', agent: 'msnbot-media' },
    { id: 'applebot', name: 'Applebot', agent: 'Applebot' },
    { id: 'yandexbot', name: 'Yandex Bot', agent: 'Yandex' },
    { id: 'yandeximages', name: 'Yandex Images', agent: 'YandexImages' },
    { id: 'yahoobot', name: 'Yahoo (Slurp)', agent: 'Slurp' },
    { id: 'duckduckgobot', name: 'DuckDuckGo', agent: 'DuckDuckBot' },
    { id: 'qwantbot', name: 'Qwant', agent: 'Qwantify' },
    { id: 'baidubot', name: 'Baidu', agent: 'Baiduspider' },
    { id: 'naverbot', name: 'Naver', agent: 'Yeti' },
    { id: 'seznambot', name: 'Seznam', agent: 'SeznamBot' }
];

const SOCIAL_MEDIA_BOTS = [
    { id: 'facebookbot', name: 'Facebook', agent: 'facebookexternalhit' },
    { id: 'instagrambot', name: 'Instagram', agent: 'Instagrambot' },
    { id: 'whatsappbot', name: 'WhatsApp', agent: 'WhatsApp' },
    { id: 'telegrambot', name: 'Telegram', agent: 'TelegramBot' },
    { id: 'twitterbot', name: 'Twitter', agent: 'Twitterbot' },
    { id: 'linkedinbot', name: 'LinkedIn', agent: 'LinkedInBot' },
    { id: 'pinterestbot', name: 'Pinterest', agent: 'Pinterest' },
    { id: 'discordbot', name: 'Discord', agent: 'Discordbot' }
];

const SEO_TOOL_BOTS = [
    { id: 'ahrefsbot', name: 'Ahrefs', agent: 'AhrefsBot' },
    { id: 'semrushbot', name: 'Semrush', agents: ['SemrushBot', 'SemrushBot-SA', 'SemrushBot-BA', 'SemrushBot-SI', 'SemrushBot-SWA', 'SemrushBot-CT', 'SemrushBot-BM'] },
    { id: 'mozbot', name: 'Moz', agent: 'rogerbot' },
    { id: 'majesticbot', name: 'Majestic', agent: 'MJ12bot' },
    { id: 'xenubot', name: 'Xenu', agent: 'Xenu' }
];

const AI_BOTS = [
    { id: 'ccbot', name: 'CCBot (Common Crawl)', agent: 'CCBot' },
    { id: 'gptbot', name: 'GPTBot (OpenAI)', agent: 'GPTBot' },
    { id: 'chatgptuser', name: 'ChatGPT-User', agent: 'ChatGPT-User' },
    { id: 'googleextended', name: 'Google-Extended (Gemini)', agent: 'Google-Extended' },
    { id: 'claudebot', name: 'ClaudeBot', agent: 'ClaudeBot' },
    { id: 'anthropicai', name: 'Anthropic-AI', agent: 'anthropic-ai' },
    { id: 'perplexitybot', name: 'PerplexityBot', agent: 'PerplexityBot' }
];

const ARCHIVE_BOTS = [
    { id: 'iaarchiver', name: 'Internet Archive', agents: ['ia_archiver', 'archive.org_bot', 'ia_archiver-web.archive.org'] }
];

const BAD_BOTS = [
    'DotBot', 'GiftGhostBot', 'Seznam', 'PaperLiBot', 'Genieo', 'Dataprovider/6.101',
    'DataproviderSiteExplorer', 'Dazoobot/1.0', 'Diffbot', 'DomainStatsBot/1.0',
    'DotBot/1.1', 'dubaiindex', 'eCommerceBot', 'ExpertSearchSpider', 'Feedbin',
    'Fetch/2.0a', 'FFbot/1.0', 'focusbot/1.1', 'HuaweiSymantecSpider',
    'HuaweiSymantecSpider/1.0', 'JobdiggerSpider', 'LemurWebCrawler',
    'LipperheyLinkExplorer', 'LSSRocketCrawler/1.0', 'LYT.SRv1.5', 'MiaDev/0.0.1',
    'Najdi.si/3.1', 'BountiiBot', 'Experibot_v1', 'bixocrawler',
    'bixocrawler TestCrawler', 'Crawler4j', 'Crowsnest/0.5', 'CukBot',
    'Dataprovider/6.92', 'DBLBot/1.0', 'Diffbot/0.1', 'Digg Deeper/v1',
    'discobot/1.0', 'discobot/1.1', 'discobot/2.0', 'discoverybot/2.0',
    'Dlvr.it/1.0', 'drupact/0.7', 'Ezooms/1.0', 'fastbot crawler beta 2.0',
    'fastbot crawler beta 4.0', 'feedly social', 'Feedly/1.0', 'FeedlyBot/1.0',
    'Feedspot', 'Feedspotbot/1.0', 'Clickagy Intelligence Bot v2', 'classbot',
    'CISPA Vulnerability Notification', 'CirrusExplorer/1.1', 'Checksem/Nutch-1.10',
    'CatchBot/5.0', 'CatchBot/3.0', 'CatchBot/2.0', 'CatchBot/1.0',
    'CamontSpider/1.0', 'Buzzbot/1.0', 'Buzzbot', 'BusinessSeek.biz_Spider',
    'BUbiNG', '008/0.85', '008/0.83', '008/0.71', '^Nail', 'FyberSpider/1.3',
    'findlinks/1.1.6-beta5', 'g2reader-bot/1.0', 'findlinks/1.1.6-beta6',
    'findlinks/2.0', 'findlinks/2.0.1', 'findlinks/2.0.2', 'findlinks/2.0.4',
    'findlinks/2.0.5', 'findlinks/2.0.9', 'findlinks/2.1', 'findlinks/2.1.5',
    'findlinks/2.1.3', 'findlinks/2.2', 'findlinks/2.5', 'findlinks/2.6',
    'findlinks/1.0', 'findlinks/1.1.3-beta8', 'findlinks/1.1.3-beta9',
    'findlinks/1.1.4-beta7', 'findlinks/1.1.6-beta1', 'findlinks/1.1.6-beta1 Yacy',
    'findlinks/1.1.6-beta2', 'findlinks/1.1.6-beta3', 'findlinks/1.1.6-beta4',
    'bixo', 'bixolabs/1.0', 'Crawlera/1.10.2', 'Dataprovider Site Explorer'
];

const RobotsTxtGenerator = () => {
    const [copied, setCopied] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        wordpress: true,
        duplicates: true,
        scrapers: true,
        woocommerce: true,
        sitemaps: true,
        searchEngines: true,
        socialMedia: true,
        seoTools: true,
        aiBots: true,
        images: true,
        files: true,
        badBots: true
    });

    // WordPress settings
    const [wpMode, setWpMode] = useState('none'); // none, basic, advanced

    // Duplicate content blocking
    const [blockJsonApi, setBlockJsonApi] = useState(false);
    const [blockSearch, setBlockSearch] = useState(false);
    const [blockParams, setBlockParams] = useState(false);
    const [blockFeed, setBlockFeed] = useState(false);
    const [blockSpam, setBlockSpam] = useState(false);

    // WooCommerce
    const [blockCart, setBlockCart] = useState(false);
    const [blockCheckout, setBlockCheckout] = useState(false);
    const [blockMyAccount, setBlockMyAccount] = useState(false);
    const [blockLogin, setBlockLogin] = useState(false);
    const [blockWooParams, setBlockWooParams] = useState(false);

    // Sitemaps
    const [sitemaps, setSitemaps] = useState(['']); // Multiple sitemaps
    const [newsSitemapUrl, setNewsSitemapUrl] = useState('');

    // Bot states: 'allow', 'disallow', 'none'
    const [searchEngineBots, setSearchEngineBots] = useState({});
    const [socialMediaBots, setSocialMediaBots] = useState({});
    const [seoToolBots, setSeoToolBots] = useState({});
    const [aiBots, setAiBots] = useState({});
    const [archiveBots, setArchiveBots] = useState({});

    // File types
    const [imageTypes, setImageTypes] = useState({});
    const [fileTypes, setFileTypes] = useState({});

    // Bad bots
    const [blockBadBots, setBlockBadBots] = useState(false);

    // Recommended Mode State
    const [showRecommended, setShowRecommended] = useState(false);
    const [preferredSeoTool, setPreferredSeoTool] = useState(''); // 'semrush', 'ahrefs', 'moz', 'majestic', 'none'
    const [runningGoogleAds, setRunningGoogleAds] = useState(null); // true, false, null

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const setBotState = (category, botId, state) => {
        const setters = {
            search: setSearchEngineBots,
            social: setSocialMediaBots,
            seo: setSeoToolBots,
            ai: setAiBots,
            archive: setArchiveBots
        };
        setters[category](prev => ({ ...prev, [botId]: state }));
    };

    const setFileState = (category, type, state) => {
        const setters = { image: setImageTypes, file: setFileTypes };
        setters[category](prev => ({ ...prev, [type]: state }));
    };

    const handleAddSitemap = () => {
        setSitemaps([...sitemaps, '']);
    };

    const handleRemoveSitemap = (index) => {
        const newSitemaps = sitemaps.filter((_, i) => i !== index);
        setSitemaps(newSitemaps.length ? newSitemaps : ['']);
    };

    const handleSitemapChange = (index, value) => {
        const newSitemaps = [...sitemaps];
        newSitemaps[index] = value;
        setSitemaps(newSitemaps);
    };

    const activateRecommended = () => {
        setShowRecommended(true);
        // Set Recommended Defaults
        setWpMode('basic'); // Or custom to match output
        setBlockJsonApi(true);
        setBlockSearch(true);
        setBlockParams(true);
        setBlockWooParams(true); // Matches "Disallow: *add-to-cart=*"
        setBlockBadBots(true);

        // Reset manual bot states to let logic handle it, or pre-fill them
        // For now we rely on the logic in useMemo to respect the 'recommended' variables if set
    };

    // Generate robots.txt content
    const robotsTxt = useMemo(() => {
        let lines = [];

        if (showRecommended) {
            // *** RECOMMENDED BY ALEEM OUTPUT FORMAT ***

            // 1. WordPress Default
            lines.push('# Wordpress Default');
            lines.push('User-agent: *');
            lines.push('Disallow: /wp-admin/');
            lines.push('Allow: /wp-admin/admin-ajax.php');
            lines.push('Disallow: *add-to-cart=*');
            lines.push('');

            // 2. JSON API
            lines.push('# Prevent Crawling of WordPress JSON API Endpoints');
            lines.push('User-agent: *');
            lines.push('Disallow: /wp-json/');
            lines.push('Disallow: /?rest_route=');
            lines.push('');

            // 3. Search URLs
            lines.push('# Block Search URLs /search/ and /?s=');
            lines.push('User-agent: *');
            lines.push('Disallow: /search/');
            lines.push('Disallow: /?s=');
            lines.push('');

            // 4. Block Parameters
            lines.push('#Block Parameters');
            lines.push('User-agent: *');
            lines.push('Disallow: *?s=*');
            lines.push('Disallow: *?p=*');
            lines.push('Disallow: *&p=*');
            lines.push('Disallow: *&preview=*');
            lines.push('');

            // 5. Sitemaps
            sitemaps.filter(url => url.trim()).forEach((url, index) => {
                lines.push(`# Sitemap Link ${index + 1}`);
                lines.push(`Sitemap: ${url.trim()}`);
                lines.push('');
            });

            // 6. SEO Crawlers
            const seoBots = [
                { id: 'ahrefs', name: 'Ahrefs', agent: 'AhrefsBot' },
                { id: 'semrush', name: 'Semrush', agents: ['SemrushBot', 'SemrushBot-SA', 'SemrushBot-BA', 'SemrushBot-SI', 'SemrushBot-SWA', 'SemrushBot-CT', 'SemrushBot-BM'] },
                { id: 'moz', name: 'Moz', agent: 'rogerbot' },
                { id: 'majestic', name: 'Majestic', agent: 'MJ12bot' },
                { id: 'xenu', name: 'Xenu', agent: 'Xenu' }
            ];

            seoBots.forEach(bot => {
                if (preferredSeoTool === bot.id) return; // Skip preferred (Allowed)

                lines.push(`# Block ${bot.name} Crawler`);
                const agents = bot.agents || [bot.agent];
                agents.forEach(agent => {
                    lines.push(`User-agent: ${agent}`);
                    lines.push('Disallow: /');
                });
                lines.push('');
            });

            // 7. Google AdsBot
            if (runningGoogleAds === false) { // Explicitly no
                lines.push('# Block Google AdsBot Bot');
                lines.push('User-agent: AdsBot-Google');
                lines.push('Disallow: /');
                lines.push('');
            }

            // 8. Block Specific Search Engines (Seznam, Naver, Baidu, Qwant)
            const blockedSearchEngines = [
                { name: 'Seznam Bot', agent: 'seznambot' }, // Check if agent matches user request (user said 'seznambot', list has 'SeznamBot')
                { name: 'Naver Bot', agent: 'Naverbot' },
                {
                    name: 'Baidu/Sogou/Soso/Youdao Bot', agents: [
                        'Baiduspider', 'Baiduspider/2.0', 'Baiduspider-video', 'Baiduspider-image',
                        'Sogou spider', 'Sogou web spider', 'Sosospider', 'Sosospider+', 'Sosospider/2.0',
                        'yodao', 'youdao', 'YoudaoBot', 'YoudaoBot/1.0'
                    ]
                },
                { name: 'Qwant Bot', agent: 'Qwantify' }
            ];

            blockedSearchEngines.forEach(bot => {
                lines.push(`# Block ${bot.name}`);
                const agents = bot.agents || [bot.agent];
                agents.forEach(agent => {
                    lines.push(`User-agent: ${agent}`);
                    lines.push('Disallow: /');
                });
                lines.push('');
            });

            // 9. Bad Bots
            lines.push('# Block Scrapper Bots');
            BAD_BOTS.forEach(bot => {
                lines.push(`User-agent: ${bot}`);
                lines.push('Disallow: /');
            });

        } else {
            // *** STANDARD OUTPUT FORMAT (Original Logic) ***
            let userAgentRules = {}; // { agent: [rules] }
            let globalDisallows = [];
            let globalAllows = [];

            // WordPress defaults
            if (wpMode === 'basic') {
                globalDisallows.push('/wp-admin/');
                globalAllows.push('/wp-admin/admin-ajax.php');
            } else if (wpMode === 'advanced') {
                globalAllows.push('/wp-admin/admin-ajax.php', '/*/*.css', '/*/*.js');
                globalDisallows.push(
                    '/wp-admin/', '/wp-includes/', '/readme.html', '/license.txt',
                    '/xmlrpc.php', '/wp-login.php', '/wp-register.php', '*?attachment_id='
                );
            }

            // Block duplicates
            if (blockJsonApi) globalDisallows.push('/wp-json/', '/?rest_route=');
            if (blockSearch) globalDisallows.push('/search/', '/?s=');
            if (blockParams) globalDisallows.push('*?s=*', '*?p=*', '*&p=*', '*&preview=*');
            if (blockFeed) globalDisallows.push('/feed/', '/feed/$', '/comments/feed', '*/feed', '*/feed$', '/?feed=', '/wp-feed');
            if (blockSpam) globalDisallows.push('/trackback/', '*/comments$', '*/trackback', '*/trackback$', '/wp-comments', '/wp-trackback', '*/replytocom=');

            // WooCommerce
            if (blockCart) globalDisallows.push('/cart/');
            if (blockCheckout) globalDisallows.push('/checkout/');
            if (blockMyAccount) globalDisallows.push('/my-account/');
            if (blockLogin) globalDisallows.push('/login/');
            if (blockWooParams) {
                globalDisallows.push(
                    '/*?orderby=price', '/*?orderby=rating', '/*?orderby=date',
                    '/*?orderby=price-desc', '/*?orderby=popularity', '/*?filter',
                    '/*?orderby=title', '/*?orderby=desc', '/*add-to-cart=*',
                    '/*add_to_wishlist=*', '/*?paged=&count=*', '/*?count=*'
                );
            }

            // Global Rules
            if (globalDisallows.length > 0 || globalAllows.length > 0) {
                lines.push('User-agent: *');
                globalAllows.forEach(rule => lines.push(`Allow: ${rule}`));
                globalDisallows.forEach(rule => lines.push(`Disallow: ${rule}`));
                lines.push('');
            }

            // Bot Rules
            const addBotRules = (bots, botStates) => {
                bots.forEach(bot => {
                    const state = botStates[bot.id];
                    if (state === 'allow' || state === 'disallow') {
                        const agents = bot.agents || [bot.agent];
                        agents.forEach(agent => {
                            lines.push(`User-agent: ${agent}`);
                            lines.push(state === 'allow' ? 'Allow: /' : 'Disallow: /');
                            lines.push('');
                        });
                    }
                });
            };

            addBotRules(SEARCH_ENGINE_BOTS, searchEngineBots);
            addBotRules(SOCIAL_MEDIA_BOTS, socialMediaBots);
            addBotRules(SEO_TOOL_BOTS, seoToolBots);
            addBotRules(AI_BOTS, aiBots);
            addBotRules(ARCHIVE_BOTS, archiveBots);

            // File types
            const fileTypeRules = [];
            Object.entries(imageTypes).forEach(([type, state]) => {
                if (state === 'allow') fileTypeRules.push(`Allow: /*.${type}$`);
                else if (state === 'disallow') fileTypeRules.push(`Disallow: /*.${type}$`);
            });
            Object.entries(fileTypes).forEach(([type, state]) => {
                if (state === 'allow') fileTypeRules.push(`Allow: /*.${type}$`);
                else if (state === 'disallow') fileTypeRules.push(`Disallow: /*.${type}$`);
            });
            if (fileTypeRules.length > 0) {
                lines.push('User-agent: *');
                fileTypeRules.forEach(rule => lines.push(rule));
                lines.push('');
            }

            // Bad bots
            if (blockBadBots) {
                BAD_BOTS.forEach(bot => {
                    lines.push(`User-agent: ${bot}`);
                    lines.push('Disallow: /');
                });
            }

            // Sitemaps
            sitemaps.filter(url => url.trim()).forEach(url => {
                lines.push(`Sitemap: ${url.trim()}`);
            });
            if (newsSitemapUrl.trim()) lines.push(`Sitemap: ${newsSitemapUrl.trim()}`);
        }

        return lines.join('\n');
    }, [wpMode, blockJsonApi, blockSearch, blockParams, blockFeed, blockSpam, blockCart, blockCheckout, blockMyAccount, blockLogin, blockWooParams, searchEngineBots, socialMediaBots, seoToolBots, aiBots, archiveBots, imageTypes, fileTypes, blockBadBots, sitemaps, newsSitemapUrl, showRecommended, preferredSeoTool, runningGoogleAds]);

    const handleCopy = () => {
        navigator.clipboard.writeText(robotsTxt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([robotsTxt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'robots.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Toggle button component
    const ToggleButton = ({ label, value, onChange, description }) => (
        <div className="flex items-start justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-purple-500/50 shadow-sm transition">
            <div className="flex-1 pr-4">
                <p className="text-slate-900 font-medium text-sm">{label}</p>
                {description && <p className="text-slate-500 text-xs mt-1">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-purple-500' : 'bg-slate-200'}`}
            >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${value ? 'left-7' : 'left-1'}`} />
            </button>
        </div>
    );

    // Radio button group for bot states
    const BotStateSelector = ({ bot, category }) => {
        const states = category === 'search' ? searchEngineBots :
            category === 'social' ? socialMediaBots :
                category === 'seo' ? seoToolBots :
                    category === 'ai' ? aiBots : archiveBots;
        const currentState = states[bot.id] || 'none';

        return (
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <span className="text-slate-700 font-medium text-sm">{bot.name}</span>
                <div className="flex gap-1">
                    {['allow', 'disallow', 'none'].map(state => (
                        <button
                            key={state}
                            onClick={() => setBotState(category, bot.id, state)}
                            className={`px-3 py-1 text-xs rounded font-medium transition ${currentState === state
                                ? state === 'allow' ? 'bg-green-500 text-white shadow-sm' :
                                    state === 'disallow' ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {state === 'none' ? 'Off' : state.charAt(0).toUpperCase() + state.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // File type selector
    const FileTypeSelector = ({ type, label, category }) => {
        const states = category === 'image' ? imageTypes : fileTypes;
        const currentState = states[type] || 'none';

        return (
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <span className="text-slate-700 font-medium text-sm">.{type} {label}</span>
                <div className="flex gap-1">
                    {['allow', 'disallow', 'none'].map(state => (
                        <button
                            key={state}
                            onClick={() => setFileState(category, type, state)}
                            className={`px-3 py-1 text-xs rounded font-medium transition ${currentState === state
                                ? state === 'allow' ? 'bg-green-500 text-white shadow-sm' :
                                    state === 'disallow' ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            {state === 'none' ? 'Off' : state.charAt(0).toUpperCase() + state.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // Section component
    const Section = ({ id, title, icon: Icon, children, color = 'purple' }) => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={() => toggleSection(id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${color}-500/10`}>
                        <Icon className={`w-5 h-5 text-${color}-600`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                </div>
                {expandedSections[id] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {expandedSections[id] && (
                <div className="p-4 pt-0 space-y-3">
                    {children}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
            {/* Hero */}
            <div className="max-w-6xl mx-auto mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
                        <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Robots.txt Generator</h1>
                        <p className="text-slate-500">Create an optimized robots.txt file for your website</p>
                    </div>
                </div>

                {/* Generate Recommended Button */}
                {!showRecommended && (
                    <button
                        onClick={activateRecommended}
                        className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 hover:shadow-xl hover:scale-105 transition flex items-center gap-2"
                    >
                        <Shield className="w-5 h-5" />
                        Generate Recommended by Aleem
                    </button>
                )}
            </div>

            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
                {/* Left: Options */}
                <div className="space-y-4">
                    {showRecommended ? (
                        <>
                            <div className="p-4 bg-white rounded-xl border border-purple-200 shadow-md">
                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    Recommended Settings
                                </h3>

                                <div className="space-y-6">
                                    {/* Sitemaps */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Sitemaps</label>
                                        <div className="space-y-2">
                                            {sitemaps.map((url, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={url}
                                                        onChange={(e) => handleSitemapChange(index, e.target.value)}
                                                        placeholder="https://example.com/sitemap.xml"
                                                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                                    />
                                                    {index === sitemaps.length - 1 && (
                                                        <button
                                                            onClick={handleAddSitemap}
                                                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                                            title="Add Sitemap"
                                                        >
                                                            +
                                                        </button>
                                                    )}
                                                    {sitemaps.length > 1 && (
                                                        <button
                                                            onClick={() => handleRemoveSitemap(index)}
                                                            className="p-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition"
                                                            title="Remove"
                                                        >
                                                            -
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preferred SEO Tool */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Preferred SEO Tool (Allowed)</label>
                                        <p className="text-xs text-slate-500 mb-2">Select the tool you use. Others will be blocked.</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'semrush', name: 'Semrush' },
                                                { id: 'ahrefs', name: 'Ahrefs' },
                                                { id: 'moz', name: 'Moz' },
                                                { id: 'majestic', name: 'Majestic' },
                                                { id: 'xenu', name: 'Xenu' },
                                                { id: '', name: 'None (Block All)' }
                                            ].map(tool => (
                                                <label key={tool.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${preferredSeoTool === tool.id ? 'bg-purple-50 border-purple-500' : 'bg-slate-50 border-slate-200 hover:border-purple-300'}`}>
                                                    <input
                                                        type="radio"
                                                        name="seoTool"
                                                        value={tool.id}
                                                        checked={preferredSeoTool === tool.id}
                                                        onChange={(e) => setPreferredSeoTool(e.target.value)}
                                                        className="text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-800">{tool.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Google Ads */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Are you running Google Ads?</label>
                                        <div className="flex gap-4">
                                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition ${runningGoogleAds === true ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-200'}`}>
                                                <input
                                                    type="radio"
                                                    name="googleAds"
                                                    checked={runningGoogleAds === true}
                                                    onChange={() => setRunningGoogleAds(true)}
                                                    className="hidden"
                                                />
                                                <span className={`text-sm font-medium ${runningGoogleAds === true ? 'text-green-700' : 'text-slate-600'}`}>Yes, Allow AdsBot</span>
                                            </label>
                                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition ${runningGoogleAds === false ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-200'}`}>
                                                <input
                                                    type="radio"
                                                    name="googleAds"
                                                    checked={runningGoogleAds === false}
                                                    onChange={() => setRunningGoogleAds(false)}
                                                    className="hidden"
                                                />
                                                <span className={`text-sm font-medium ${runningGoogleAds === false ? 'text-red-700' : 'text-slate-600'}`}>No, Block AdsBot</span>
                                            </label>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowRecommended(false)}
                                        className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 underline"
                                    >
                                        Switch to Manual Mode
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* WordPress Defaults */}
                            <Section id="wordpress" title="WordPress Defaults" icon={Globe} color="blue">
                                <p className="text-slate-500 text-sm mb-3">
                                    Protect your WordPress backend and allow essential resources.
                                </p>
                                <div className="flex gap-2">
                                    {['none', 'basic', 'advanced'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setWpMode(mode)}
                                            className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition shadow-sm ${wpMode === mode
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                {wpMode === 'basic' && (
                                    <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                        <code className="text-xs text-slate-700">
                                            Disallow: /wp-admin/<br />
                                            Allow: /wp-admin/admin-ajax.php
                                        </code>
                                    </div>
                                )}
                                {wpMode === 'advanced' && (
                                    <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                        <code className="text-xs text-slate-700">
                                            Allow: /wp-admin/admin-ajax.php<br />
                                            Allow: /*/*.css, /*/*.js<br />
                                            Disallow: /wp-admin/, /wp-includes/<br />
                                            Disallow: /readme.html, /license.txt<br />
                                            Disallow: /xmlrpc.php, /wp-login.php...
                                        </code>
                                    </div>
                                )}
                            </Section>

                            {/* Block Duplicates */}
                            <Section id="duplicates" title="Block Duplicate Content" icon={Shield} color="yellow">
                                <p className="text-slate-500 text-sm mb-3">
                                    Prevent crawling of URLs that create duplicate content issues.
                                </p>
                                <div className="space-y-2">
                                    <ToggleButton label="Block JSON API" value={blockJsonApi} onChange={setBlockJsonApi} description="Block /wp-json/ and /?rest_route=" />
                                    <ToggleButton label="Block Search URLs" value={blockSearch} onChange={setBlockSearch} description="Block /search/ and /?s=" />
                                    <ToggleButton label="Block Parameters" value={blockParams} onChange={setBlockParams} description="Block ?s=, ?p=, &preview= parameters" />
                                    <ToggleButton label="Block Feed URLs" value={blockFeed} onChange={setBlockFeed} description="Block /feed/, /comments/feed, etc." />
                                    <ToggleButton label="Block Spam Directories" value={blockSpam} onChange={setBlockSpam} description="Block /trackback/, /wp-comments, etc." />
                                </div>
                            </Section>

                            {/* WooCommerce */}
                            <Section id="woocommerce" title="WooCommerce Optimization" icon={Settings} color="green">
                                <p className="text-slate-500 text-sm mb-3">
                                    Block non-indexable WooCommerce pages and parameters.
                                </p>
                                <div className="space-y-2">
                                    <ToggleButton label="Block Cart Page" value={blockCart} onChange={setBlockCart} description="Block /cart/" />
                                    <ToggleButton label="Block Checkout Page" value={blockCheckout} onChange={setBlockCheckout} description="Block /checkout/" />
                                    <ToggleButton label="Block My Account" value={blockMyAccount} onChange={setBlockMyAccount} description="Block /my-account/" />
                                    <ToggleButton label="Block Login Page" value={blockLogin} onChange={setBlockLogin} description="Block /login/" />
                                    <ToggleButton label="Block Sorting Parameters" value={blockWooParams} onChange={setBlockWooParams} description="Block ?orderby=, ?filter, ?add-to-cart=" />
                                </div>
                            </Section>

                            {/* Sitemaps */}
                            <Section id="sitemaps" title="Add Sitemaps" icon={Map} color="cyan">
                                <p className="text-slate-500 text-sm mb-3">
                                    Add your sitemap URLs to help search engines discover your content.
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-slate-700 font-medium mb-1">Sitemap URLS</label>
                                        {sitemaps.map((url, index) => (
                                            <div key={index} className="flex gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={url}
                                                    onChange={(e) => handleSitemapChange(index, e.target.value)}
                                                    placeholder="https://example.com/sitemap.xml"
                                                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition shadow-sm"
                                                />
                                                {index === sitemaps.length - 1 && (
                                                    <button onClick={handleAddSitemap} className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200">+</button>
                                                )}
                                                {sitemaps.length > 1 && (
                                                    <button onClick={() => handleRemoveSitemap(index)} className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg hover:bg-red-100 text-red-500">-</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-700 font-medium mb-1">News Sitemap URL (optional)</label>
                                        <input
                                            type="text"
                                            value={newsSitemapUrl}
                                            onChange={(e) => setNewsSitemapUrl(e.target.value)}
                                            placeholder="https://example.com/sitemap-news.xml"
                                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition shadow-sm"
                                        />
                                    </div>
                                </div>
                            </Section>

                            {/* Search Engines */}
                            <Section id="searchEngines" title="Search Engine Crawlers" icon={Search} color="blue">
                                <p className="text-slate-500 text-sm mb-3">
                                    Control which search engines can crawl your website.
                                </p>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {SEARCH_ENGINE_BOTS.map(bot => (
                                        <BotStateSelector key={bot.id} bot={bot} category="search" />
                                    ))}
                                </div>
                            </Section>

                            {/* Social Media */}
                            <Section id="socialMedia" title="Social Media Crawlers" icon={Share2} color="pink">
                                <p className="text-slate-500 text-sm mb-3">
                                    Control social media platform crawlers for link previews.
                                </p>
                                <div className="space-y-2">
                                    {SOCIAL_MEDIA_BOTS.map(bot => (
                                        <BotStateSelector key={bot.id} bot={bot} category="social" />
                                    ))}
                                </div>
                            </Section>

                            {/* AI Bots */}
                            <Section id="aiBots" title="AI & LLM Crawlers" icon={Bot} color="purple">
                                <p className="text-slate-500 text-sm mb-3">
                                    Control AI model training crawlers like GPTBot and ClaudeBot.
                                </p>
                                <div className="space-y-2">
                                    {AI_BOTS.map(bot => (
                                        <BotStateSelector key={bot.id} bot={bot} category="ai" />
                                    ))}
                                </div>
                            </Section>

                            {/* SEO Tools */}
                            <Section id="seoTools" title="SEO Tool Crawlers" icon={Search} color="orange">
                                <p className="text-slate-500 text-sm mb-3">
                                    Block SEO tool crawlers to protect your backlink data.
                                </p>
                                <div className="space-y-2">
                                    {SEO_TOOL_BOTS.map(bot => (
                                        <BotStateSelector key={bot.id} bot={bot} category="seo" />
                                    ))}
                                </div>
                            </Section>

                            {/* Archive.org */}
                            <Section id="scrapers" title="Prevent Archiving" icon={Shield} color="red">
                                <p className="text-slate-500 text-sm mb-3">
                                    Block web archive crawlers from saving your content.
                                </p>
                                <div className="space-y-2">
                                    {ARCHIVE_BOTS.map(bot => (
                                        <BotStateSelector key={bot.id} bot={bot} category="archive" />
                                    ))}
                                </div>
                            </Section>

                            {/* Images */}
                            <Section id="images" title="Image Crawlability" icon={Image} color="teal">
                                <p className="text-slate-500 text-sm mb-3">
                                    Control which image formats can be crawled.
                                </p>
                                <div className="space-y-2">
                                    <FileTypeSelector type="webp" label="Images" category="image" />
                                    <FileTypeSelector type="jpg" label="Images" category="image" />
                                    <FileTypeSelector type="png" label="Images" category="image" />
                                    <FileTypeSelector type="gif" label="Images" category="image" />
                                </div>
                            </Section>

                            {/* Files */}
                            <Section id="files" title="File Crawlability" icon={File} color="indigo">
                                <p className="text-slate-500 text-sm mb-3">
                                    Control which file types can be crawled.
                                </p>
                                <div className="space-y-2">
                                    <FileTypeSelector type="pdf" label="Files" category="file" />
                                    <FileTypeSelector type="docx" label="Files" category="file" />
                                    <FileTypeSelector type="html" label="Files" category="file" />
                                    <FileTypeSelector type="php" label="Files" category="file" />
                                </div>
                            </Section>

                            {/* Bad Bots */}
                            <Section id="badBots" title="Block Bad Bots" icon={AlertTriangle} color="red">
                                <p className="text-slate-500 text-sm mb-3">
                                    Block common malicious bots and scrapers (20+ bots).
                                </p>
                                <ToggleButton
                                    label="Block All Bad Bots"
                                    value={blockBadBots}
                                    onChange={setBlockBadBots}
                                    description="Blocks AhrefsBot, SemrushBot, MJ12bot, Bytespider, and more"
                                />
                            </Section>
                        </>
                    )}
                </div>



                {/* Right: Preview */}
                <div className="lg:sticky lg:top-6 h-fit">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-600" />
                                robots.txt Preview
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </button>
                            </div>
                        </div>
                        <pre className="p-4 text-sm text-slate-300 font-mono bg-slate-900 max-h-[600px] overflow-auto whitespace-pre-wrap">
                            {robotsTxt || '# Your robots.txt will appear here\n# Start by selecting options on the left'}
                        </pre>
                    </div>

                    {/* Quick Info */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <h4 className="text-blue-700 font-semibold mb-2 flex items-center gap-2">
                            <span className="text-xl">💡</span> Quick Tips
                        </h4>
                        <ul className="text-blue-900/70 text-sm space-y-1 ml-1">
                            <li>• Place robots.txt in your website root directory</li>
                            <li>• Test with Google Search Console before deploying</li>
                            <li>• Remember: robots.txt is a suggestion, not a security measure</li>
                            <li>• Blocking crawlers won't remove already-indexed pages</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default RobotsTxtGenerator;
