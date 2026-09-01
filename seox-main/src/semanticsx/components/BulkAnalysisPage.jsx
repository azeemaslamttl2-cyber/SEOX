import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    ArrowLeft,
    Search,
    TrendingUp,
    TrendingDown,
    Minus,
    ExternalLink,
    Globe,
    LayoutGrid,
    List,
    AlertCircle,
    MousePointerClick,
    Eye,
    BarChart3,
    RefreshCw,
    LogIn,
    LogOut,
    Loader2,
    ChevronUp,
    ChevronDown,
    Filter,
    Calendar,
    Percent,
    Activity,
    DollarSign,
    Key,
    Monitor,
    Smartphone,
    Tablet,
    ChevronRight,
    Maximize2,
    Star,
    Target
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, ReferenceLine } from 'recharts';
import BulkAnalysisToggle from './BulkAnalysisToggle';
import {
    clearStoredGscSession,
    ensureValidGscSession,
    readStoredGscSession,
    restoreGscSession,
    writeStoredGscSession
} from '../lib/gscSession';
import { getGscAuthUrl } from '../../lib/googleOAuthConfig.js';

// OAuth Configuration (same as GSCChecker)
const GOOGLE_CLIENT_ID = '678600675636-ep3h78scknmtu4d4fk1idjpsp54oncvh.apps.googleusercontent.com';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

// LocalStorage keys for persisting user preferences
const LS_KEYS = {
    ACTIVE_METRICS: 'bulkAnalysis_activeMetrics',
    DATE_RANGE: 'bulkAnalysis_dateRange',
    VIEW_MODE: 'bulkAnalysis_viewMode',
    DETAIL_METRIC: 'bulkAnalysis_detailMetric',
    DETAIL_DATE_RANGE: 'bulkAnalysis_detailDateRange',
    DETAIL_ACTIVE_METRICS: 'bulkAnalysis_detailActiveMetrics',
};

// Country code (3-letter ISO to full name) mapping
const countryCodeToName = {
    usa: 'United States', gbr: 'United Kingdom', ind: 'India', deu: 'Germany', can: 'Canada',
    aus: 'Australia', fra: 'France', pak: 'Pakistan', bra: 'Brazil', nld: 'Netherlands',
    esp: 'Spain', ita: 'Italy', jpn: 'Japan', kor: 'South Korea', rus: 'Russian Federation',
    pol: 'Poland', nzl: 'New Zealand', mex: 'Mexico', arg: 'Argentina', chn: 'China',
    idn: 'Indonesia', mys: 'Malaysia', phl: 'Philippines', sgp: 'Singapore', tha: 'Thailand',
    vnm: 'Vietnam', zaf: 'South Africa', are: 'United Arab Emirates', sau: 'Saudi Arabia',
    tur: 'Turkey', egy: 'Egypt', nga: 'Nigeria', ken: 'Kenya', col: 'Colombia',
    chl: 'Chile', per: 'Peru', ukr: 'Ukraine', bel: 'Belgium', che: 'Switzerland',
    aut: 'Austria', swe: 'Sweden', nor: 'Norway', dnk: 'Denmark', fin: 'Finland',
    irl: 'Ireland', prt: 'Portugal', grc: 'Greece', cze: 'Czech Republic', rou: 'Romania',
    hun: 'Hungary', bgr: 'Bulgaria', hrv: 'Croatia', svk: 'Slovakia', svn: 'Slovenia',
    isr: 'Israel', hkg: 'Hong Kong', twn: 'Taiwan', qat: 'Qatar', kwt: 'Kuwait',
    bhr: 'Bahrain', omn: 'Oman', lka: 'Sri Lanka', bgd: 'Bangladesh', npl: 'Nepal',
};

// Country code (3-letter to 2-letter) mapping for flag URLs
const countryCodeTo2Letter = {
    usa: 'us', gbr: 'gb', ind: 'in', deu: 'de', can: 'ca', aus: 'au', fra: 'fr',
    pak: 'pk', bra: 'br', nld: 'nl', esp: 'es', ita: 'it', jpn: 'jp', kor: 'kr',
    rus: 'ru', pol: 'pl', nzl: 'nz', mex: 'mx', arg: 'ar', chn: 'cn', idn: 'id',
    mys: 'my', phl: 'ph', sgp: 'sg', tha: 'th', vnm: 'vn', zaf: 'za', are: 'ae',
    sau: 'sa', tur: 'tr', egy: 'eg', nga: 'ng', ken: 'ke', col: 'co', chl: 'cl',
    per: 'pe', ukr: 'ua', bel: 'be', che: 'ch', aut: 'at', swe: 'se', nor: 'no',
    dnk: 'dk', fin: 'fi', irl: 'ie', prt: 'pt', grc: 'gr', cze: 'cz', rou: 'ro',
    hun: 'hu', bgr: 'bg', hrv: 'hr', svk: 'sk', svn: 'si', isr: 'il', hkg: 'hk',
    twn: 'tw', qat: 'qa', kwt: 'kw', bhr: 'bh', omn: 'om', lka: 'lk', bgd: 'bd', npl: 'np',
};

// Helper to get flag URL from country code
const getCountryFlagUrl = (code) => {
    const twoLetter = countryCodeTo2Letter[code?.toLowerCase()] || code?.toLowerCase()?.substring(0, 2);
    return `https://hatscripts.github.io/circle-flags/flags/${twoLetter}.svg`;
};

// Helper to get country name from code
const getCountryName = (code) => {
    return countryCodeToName[code?.toLowerCase()] || code?.toUpperCase();
};

// Helper to extract favicon URL
const getFaviconUrl = (siteUrl) => {
    const cleanDomain = siteUrl
        ?.replace(/^sc-domain:/, '')
        ?.replace(/^https?:\/\//, '')
        ?.replace(/^www\./, '')
        ?.split('/')[0];
    return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;
};

// Helper to extract display name from site URL
const getSiteDisplayName = (siteUrl) => {
    if (!siteUrl) return 'Unknown';
    const cleaned = siteUrl
        .replace(/^sc-domain:/, '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');
    const parts = cleaned.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
};

// Helper to format numbers
const formatNumber = (num) => {
    if (!num && num !== 0) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

// Multi-Metric Sparkline Component - Shows all metrics as separate lines
const MultiMetricSparkline = ({ data, height = 50, activeMetrics = ['clicks', 'impressions', 'ctr', 'position'] }) => {
    if (!data || data.length === 0) {
        return <div style={{ height }} className="bg-white/[0.03] rounded" />;
    }

    // Metric configurations
    const metricConfig = {
        clicks: { color: '#10b981', label: 'Clicks' },
        impressions: { color: '#6366f1', label: 'Impressions' },
        ctr: { color: '#f59e0b', label: 'CTR' },
        position: { color: '#8b5cf6', label: 'Avg. Position' }
    };

    // Custom tooltip showing all metrics
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length > 0) {
            const dataPoint = payload[0]?.payload;
            if (!dataPoint) return null;

            return (
                <div className="bg-stone-900 rounded-lg shadow-xl border border-white/[0.1] p-3 text-xs min-w-[180px]">
                    <div className="font-medium text-stone-300 mb-2 pb-1 border-b border-white/[0.08]">
                        {dataPoint.date || 'N/A'}
                    </div>
                    <div className="space-y-1.5">
                        {activeMetrics.includes('clicks') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-stone-400">Clicks</span>
                                </div>
                                <span className="font-semibold text-white">{formatNumber(dataPoint.clicks || 0)}</span>
                            </div>
                        )}
                        {activeMetrics.includes('impressions') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-stone-400">Impressions</span>
                                </div>
                                <span className="font-semibold text-white">{formatNumber(dataPoint.impressions || 0)}</span>
                            </div>
                        )}
                        {activeMetrics.includes('ctr') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-stone-400">CTR</span>
                                </div>
                                <span className="font-semibold text-white">{(dataPoint.ctr || 0).toFixed(1)}%</span>
                            </div>
                        )}
                        {activeMetrics.includes('position') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span className="text-stone-400">Avg. Position</span>
                                </div>
                                <span className="font-semibold text-white">{(dataPoint.position || 0).toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Normalize data for multi-scale display (each metric on its own scale)
    const normalizeData = () => {
        const maxValues = {
            clicks: Math.max(...data.map(d => d.clicks || 0)) || 1,
            impressions: Math.max(...data.map(d => d.impressions || 0)) || 1,
            ctr: Math.max(...data.map(d => d.ctr || 0)) || 1,
            position: Math.max(...data.map(d => d.position || 0)) || 1
        };

        return data.map(d => ({
            ...d,
            clicksNorm: ((d.clicks || 0) / maxValues.clicks) * 100,
            impressionsNorm: ((d.impressions || 0) / maxValues.impressions) * 100,
            ctrNorm: ((d.ctr || 0) / maxValues.ctr) * 100,
            positionNorm: 100 - (((d.position || 0) / maxValues.position) * 100) // Invert position (lower is better)
        }));
    };

    const normalizedData = normalizeData();

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={normalizedData} margin={{ top: 5, right: 2, left: 2, bottom: 0 }}>
                <defs>
                    {/* Gradient definitions for each metric */}
                    <linearGradient id="gradientClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradientImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradientCtr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradientPosition" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                </defs>

                {/* Baseline / Ground Line */}
                <XAxis dataKey="date" hide={true} />
                <YAxis domain={[0, 100]} hide={true} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />

                <Tooltip content={<CustomTooltip />} />

                {/* Areas with gradient fills */}
                {activeMetrics.includes('impressions') && (
                    <Area
                        type="monotone"
                        dataKey="impressionsNorm"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#gradientImpressions)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 1 }}
                    />
                )}
                {activeMetrics.includes('clicks') && (
                    <Area
                        type="monotone"
                        dataKey="clicksNorm"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#gradientClicks)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }}
                    />
                )}
                {activeMetrics.includes('ctr') && (
                    <Area
                        type="monotone"
                        dataKey="ctrNorm"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#gradientCtr)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1 }}
                    />
                )}
                {activeMetrics.includes('position') && (
                    <Area
                        type="monotone"
                        dataKey="positionNorm"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#gradientPosition)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 1 }}
                    />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

// Keep simple sparkline for backward compatibility
const MiniSparkline = ({ data, color = '#6366f1', height = 40, metricLabel = 'Clicks' }) => {
    if (!data || data.length === 0) {
        return <div style={{ height }} className="bg-white/[0.03] rounded" />;
    }
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Tooltip />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#gradient-${color.replace('#', '')})`}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

// Trend Badge Component
const TrendBadge = ({ value, suffix = '%' }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isPositive ? 'bg-emerald-500/15 text-emerald-400' :
            isNeutral ? 'bg-white/[0.06] text-stone-400' :
                'bg-red-500/15 text-red-400'
            }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> :
                isNeutral ? <Minus className="w-3 h-3" /> :
                    <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{value?.toFixed?.(1) || value}{suffix}
        </span>
    );
};

// Website Card Component
const WebsiteCard = ({ site, onClick, isLoading, activeMetrics = ['clicks', 'impressions', 'ctr', 'position'] }) => {
    const hasData = site.data && (site.data.impressions > 0 || site.data.clicks > 0);

    return (
        <div
            onClick={onClick}
            className="group relative bg-[#0d1117] rounded-2xl border border-white/[0.08] hover:border-white/[0.15] hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 pb-2">
                <div className="flex items-start gap-3">
                    <img
                        src={getFaviconUrl(site.siteUrl)}
                        alt=""
                        className="w-10 h-10 rounded-lg bg-white/[0.06] object-contain"
                        onError={(e) => {
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><circle cx="12" cy="12" r="10"/></svg>';
                        }}
                    />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">
                            {getSiteDisplayName(site.siteUrl)}
                        </h3>
                        <p className="text-xs text-stone-500 truncate">
                            {site.siteUrl?.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '')}
                        </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="p-4 pt-2 flex items-center justify-center h-24">
                    <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
            ) : hasData ? (
                <>
                    {/* Multi-Metric Sparkline */}
                    <div className="px-4 h-16">
                        <MultiMetricSparkline
                            data={site.data?.dailyData || []}
                            height={60}
                            activeMetrics={activeMetrics}
                        />
                    </div>

                    {/* Metrics */}
                    <div className="p-4 pt-2 grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-stone-500 mb-0.5">Impressions</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">
                                    {formatNumber(site.data.impressions)}
                                </span>
                                {site.data.impressionsTrend !== undefined && (
                                    <TrendBadge value={site.data.impressionsTrend} />
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-stone-500 mb-0.5">Clicks</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">
                                    {formatNumber(site.data.clicks)}
                                </span>
                                {site.data.clicksTrend !== undefined && (
                                    <TrendBadge value={site.data.clicksTrend} />
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-4 pt-2">
                    <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <p className="text-xs text-stone-500">No data available</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// GSC Connect Screen
const GSCConnectScreen = ({ onConnect, isLoading }) => {
    const [showTip, setShowTip] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowTip(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
            <div className="bg-[#0d1117] rounded-2xl shadow-xl border border-white/[0.08] max-w-md w-full p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-brand-500 to-amber-600 rounded-2xl flex items-center justify-center">
                    <BarChart3 className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">Connect Google Search Console</h1>
                <p className="text-stone-400 mb-8">
                    Link your Google Search Console account to view analytics, impressions, clicks, and rankings for all your websites in one place.
                </p>
                <button
                    onClick={onConnect}
                    disabled={isLoading}
                    className="w-full py-4 px-6 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign in with Google
                        </>
                    )}
                </button>
                {showTip && (
                    <p className="mt-4 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 animate-pulse">
                        ⏳ Please wait up to 5 seconds before clicking Connect
                    </p>
                )}
            </div>
        </div>
    );
};

// Site Detail View Component
const SiteDetailView = ({ site, getValidAccessToken, onBack }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dateRange, setDateRange] = useState(() => {
        try {
            return localStorage.getItem(LS_KEYS.DETAIL_DATE_RANGE) || '90';
        } catch { return '90'; }
    });
    const [dateTab, setDateTab] = useState('day');
    const [comparisonPeriod, setComparisonPeriod] = useState('disabled');
    const [comparisonSettings, setComparisonSettings] = useState({
        trendLine: true,
        matchWeekdays: true,
        showChange: true
    });
    const [searchType, setSearchType] = useState('web');
    const [detailData, setDetailData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Enhanced states for metrics and filters - now supports multi-metric selection
    const [activeDetailMetrics, setActiveDetailMetrics] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_KEYS.DETAIL_ACTIVE_METRICS);
            return saved ? JSON.parse(saved) : ['impressions']; // Default to impressions only
        } catch { return ['impressions']; }
    });
    const [selectedMetric, setSelectedMetric] = useState('impressions'); // For backward compatibility
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [queriesFilter, setQueriesFilter] = useState('all');
    const [pagesFilter, setPagesFilter] = useState('all');
    const [countriesFilter, setCountriesFilter] = useState('all');
    const [devicesFilter, setDevicesFilter] = useState('all');
    const [newRankingsTab, setNewRankingsTab] = useState('queries');
    const [expandedSection, setExpandedSection] = useState(null);
    const datePickerRef = useRef(null);

    // Persist detail view state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.DETAIL_DATE_RANGE, dateRange);
        } catch { }
    }, [dateRange]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.DETAIL_ACTIVE_METRICS, JSON.stringify(activeDetailMetrics));
        } catch { }
    }, [activeDetailMetrics]);

    // Date range options
    const dateRangeGroups = {
        day: [
            { value: '1', label: 'Today' },
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '28', label: '28 days' }
        ],
        week: [
            { value: 'LW', label: 'Last Week' }
        ],
        month: [
            { value: 'TM', label: 'This Month' },
            { value: 'LM', label: 'Last Month' }
        ],
        quarter: [
            { value: 'TQ', label: 'This Quarter' },
            { value: 'LQ', label: 'Last Quarter' },
            { value: 'YTD', label: 'Year to Date' }
        ],
        long: [
            { value: '90', label: '3 months' },
            { value: '180', label: '6 months' },
            { value: '240', label: '8 months' },
            { value: '365', label: '12 months' },
            { value: '486', label: '16 months' },
            { value: '730', label: '2 years' },
            { value: '1095', label: '3 years' },
            { value: 'C', label: 'Custom' }
        ]
    };

    const formatLongDate = (date) => (
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    );

    const getRangeForValue = (value) => {
        // GSC data has a ~2 day delay, so end date should be 2 days ago
        const end = new Date();
        end.setDate(end.getDate() - 2);
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        if (!value) {
            start.setDate(start.getDate() - 89);
            return { start, end };
        }

        if (/^\d+$/.test(value)) {
            const days = parseInt(value, 10);
            start.setDate(start.getDate() - Math.max(0, days - 1));
            return { start, end };
        }

        if (value === 'LW') {
            start.setDate(start.getDate() - 6);
            return { start, end };
        }

        if (value === 'TM') {
            return { start: new Date(end.getFullYear(), end.getMonth(), 1), end };
        }

        if (value === 'LM') {
            const startOfLastMonth = new Date(end.getFullYear(), end.getMonth() - 1, 1);
            const endOfLastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
            return { start: startOfLastMonth, end: endOfLastMonth };
        }

        if (value === 'TQ') {
            const quarter = Math.floor(end.getMonth() / 3);
            const quarterStart = new Date(end.getFullYear(), quarter * 3, 1);
            return { start: quarterStart, end };
        }

        if (value === 'LQ') {
            const quarter = Math.floor(end.getMonth() / 3) - 1;
            const year = quarter < 0 ? end.getFullYear() - 1 : end.getFullYear();
            const q = (quarter + 4) % 4;
            const startOfQuarter = new Date(year, q * 3, 1);
            const endOfQuarter = new Date(year, q * 3 + 3, 0);
            return { start: startOfQuarter, end: endOfQuarter };
        }

        if (value === 'YTD') {
            return { start: new Date(end.getFullYear(), 0, 1), end };
        }

        // Custom fallback
        start.setDate(start.getDate() - 89);
        return { start, end };
    };

    const getRangeLabel = (value) => {
        if (value === 'C') return null;
        const range = getRangeForValue(value);
        return `${formatLongDate(range.start)} - ${formatLongDate(range.end)}`;
    };

    const dateRangeLabel = useMemo(() => {
        const all = [
            ...dateRangeGroups.day,
            ...dateRangeGroups.week,
            ...dateRangeGroups.month,
            ...dateRangeGroups.quarter,
            ...dateRangeGroups.long
        ];
        return all.find(o => o.value === dateRange)?.label || '3 months';
    }, [dateRange]);

    // Metric toggle options
    const metricOptions = [
        { id: 'clicks', icon: MousePointerClick, label: 'Clicks', color: 'text-emerald-500' },
        { id: 'impressions', icon: Eye, label: 'Impressions', color: 'text-indigo-500' },
        { id: 'ctr', icon: Percent, label: 'CTR', color: 'text-amber-500' },
        { id: 'position', icon: Target, label: 'Position', color: 'text-purple-500' },
    ];

    // Close date picker on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchDetailData = useCallback(async () => {
        if (!site?.siteUrl || !getValidAccessToken) return;

        setIsLoading(true);
        const { start: startDate, end: endDate } = getRangeForValue(dateRange);

        const formatDate = (d) => d.toISOString().split('T')[0];

        try {
            const token = await getValidAccessToken();
            const readJson = async (response, label) => {
                if (!response.ok) {
                    throw new Error(response.status === 401 ? 'Please sign in again.' : label);
                }

                return response.json();
            };

            // Fetch queries
            const queriesResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['query'],
                        rowLimit: 50
                    })
                }
            );
            const queriesData = await readJson(queriesResponse, 'Failed to fetch query data');

            // Fetch pages
            const pagesResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['page'],
                        rowLimit: 50
                    })
                }
            );
            const pagesData = await readJson(pagesResponse, 'Failed to fetch page data');

            // Fetch countries
            const countriesResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['country'],
                        rowLimit: 20
                    })
                }
            );
            const countriesData = await readJson(countriesResponse, 'Failed to fetch country data');

            // Fetch devices
            const devicesResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['device'],
                        rowLimit: 10
                    })
                }
            );
            const devicesData = await readJson(devicesResponse, 'Failed to fetch device data');

            // Fetch daily performance for accurate charting
            const dailyResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['date'],
                        rowLimit: 1000
                    })
                }
            );
            const dailyData = await readJson(dailyResponse, 'Failed to fetch daily data');

            setDetailData({
                queries: queriesData.rows || [],
                pages: pagesData.rows || [],
                countries: countriesData.rows || [],
                devices: devicesData.rows || [],
                dailyData: (dailyData.rows || []).map((row) => ({
                    date: row.keys?.[0],
                    clicks: row.clicks || 0,
                    impressions: row.impressions || 0,
                    ctr: row.ctr ? row.ctr * 100 : 0,
                    position: row.position || 0
                }))
            });
        } catch (err) {
            console.error('Error fetching detail data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [dateRange, getValidAccessToken, site?.siteUrl]);

    useEffect(() => {
        fetchDetailData();
    }, [fetchDetailData]);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'queries', label: 'Queries' },
        { id: 'pages', label: 'Pages' },
        { id: 'countries', label: 'Countries' },
    ];

    const detailDailyData = useMemo(() => {
        const rows = detailData?.dailyData || site.data?.dailyData || [];
        return [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [detailData, site.data]);

    const detailTotals = useMemo(() => {
        if (!detailDailyData.length) {
            return {
                clicks: site.data?.clicks || 0,
                impressions: site.data?.impressions || 0,
                ctr: site.data?.ctr || 0,
                position: site.data?.position || 0
            };
        }
        let clicks = 0;
        let impressions = 0;
        let positionWeighted = 0;
        let positionWeight = 0;
        detailDailyData.forEach((d) => {
            clicks += d.clicks || 0;
            impressions += d.impressions || 0;
            if (d.position && (d.impressions || 0) > 0) {
                positionWeighted += d.position * d.impressions;
                positionWeight += d.impressions;
            }
        });
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const position = positionWeight > 0 ? positionWeighted / positionWeight : 0;
        return { clicks, impressions, ctr, position };
    }, [detailDailyData, site.data]);

    // Country code to emoji map
    const countryEmoji = {
        usa: '🇺🇸', gbr: '🇬🇧', ind: '🇮🇳', deu: '🇩🇪', can: '🇨🇦', aus: '🇦🇺', fra: '🇫🇷',
        pak: '🇵🇰', bra: '🇧🇷', nld: '🇳🇱', esp: '🇪🇸', ita: '🇮🇹', jpn: '🇯🇵', kor: '🇰🇷'
    };

    const deviceColors = { MOBILE: '#6366f1', DESKTOP: '#10b981', TABLET: '#f59e0b' };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-stone-400" />
                </button>
                <div className="flex items-center gap-3">
                    <img src={getFaviconUrl(site.siteUrl)} alt="" className="w-12 h-12 rounded-xl bg-white/[0.06]" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">{getSiteDisplayName(site.siteUrl)}</h1>
                        <p className="text-stone-400">{site.siteUrl?.replace(/^sc-domain:/, '')}</p>
                    </div>
                </div>
            </div>

            {/* Toolbar with Metric Selector and Date Range */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Metric Toggle Buttons - Multi-select */}
                <div className="bg-white/[0.06] rounded-lg p-1 flex items-center gap-1">
                    {metricOptions.map((metric) => {
                        const isActive = activeDetailMetrics.includes(metric.id);
                        const toggleMetric = () => {
                            if (isActive && activeDetailMetrics.length > 1) {
                                setActiveDetailMetrics(activeDetailMetrics.filter(m => m !== metric.id));
                            } else if (!isActive) {
                                setActiveDetailMetrics([...activeDetailMetrics, metric.id]);
                            }
                            // Also update selectedMetric for backward compatibility
                            if (!isActive) setSelectedMetric(metric.id);
                        };
                        return (
                            <button
                                key={metric.id}
                                onClick={toggleMetric}
                                className={`p-2 rounded-md transition-all group relative ${isActive
                                    ? 'bg-white/[0.1] shadow-sm ' + metric.color
                                    : 'text-stone-500 hover:text-stone-300'
                                    }`}
                                title={metric.label}
                            >
                                <metric.icon className="w-4 h-4" />
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {metric.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filter Button */}
                <button className="flex items-center gap-2 px-3 py-2 text-sm text-stone-400 hover:bg-white/[0.06] rounded-lg transition-colors">
                    <Filter className="w-4 h-4" />
                    <span className="hidden md:inline">Filter</span>
                </button>

                <div className="flex-1" />

                {/* Enhanced Date Range Picker */}
                <div className="relative" ref={datePickerRef}>
                    <button
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 transition-colors"
                    >
                        <Calendar className="w-4 h-4 text-stone-500" />
                        <span>{dateRangeLabel}</span>
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                    </button>

                    {showDatePicker && (
                        <div className="absolute right-0 top-full mt-2 bg-stone-900 rounded-xl border border-white/[0.1] shadow-xl z-50 w-[420px] max-w-[90vw]">
                            <div className="grid grid-cols-[1fr_1.1fr] gap-0">
                                {/* Left panel */}
                                <div className="border-r border-white/[0.08] p-3">
                                    <div className="text-xs font-semibold text-stone-500 mb-2">Comparison Period</div>
                                    <div className="space-y-1 mb-3">
                                        {[
                                            { value: 'disabled', label: 'Disabled' },
                                            { value: 'previous', label: 'Previous Period', sub: 'Aug 1, 2025 - Oct 30, 2025' },
                                            { value: 'yoy', label: 'Year Over Year' },
                                            { value: 'month', label: 'Previous Month', disabled: true },
                                            { value: 'custom', label: 'Custom' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                disabled={opt.disabled}
                                                onClick={() => setComparisonPeriod(opt.value)}
                                                className={`w-full text-left px-2 py-2 rounded-md text-sm transition-colors ${comparisonPeriod === opt.value
                                                    ? 'bg-brand-500/15 text-brand-400 font-semibold'
                                                    : opt.disabled
                                                        ? 'text-stone-600 cursor-not-allowed'
                                                        : 'text-stone-300 hover:bg-white/[0.06]'
                                                    }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{opt.label}</span>
                                                    {opt.sub && <span className="text-xs text-stone-500">{opt.sub}</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="border-t border-white/[0.08] pt-3">
                                        <div className="text-xs font-semibold text-stone-500 mb-2">Comparison Settings</div>
                                        {[
                                            { key: 'trendLine', label: 'Previous Trend Line' },
                                            { key: 'matchWeekdays', label: 'Match Weekdays' },
                                            { key: 'showChange', label: 'Show change %' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setComparisonSettings(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                                className="w-full flex items-center justify-between px-2 py-2 rounded-md text-sm text-stone-300 hover:bg-white/[0.06]"
                                            >
                                                <span className="tracking-tight">{opt.label}</span>
                                                <input type="checkbox" readOnly checked={comparisonSettings[opt.key]} className="size-3.5 border bg-white" />
                                            </button>
                                        ))}
                                    </div>

                                    <div className="border-t border-white/[0.08] pt-3">
                                        <div className="text-xs font-semibold text-stone-500 mb-2">Search Type</div>
                                        {[
                                            { value: 'web', label: 'Web' },
                                            { value: 'discover', label: 'Discover' },
                                            { value: 'news', label: 'News' },
                                            { value: 'image', label: 'Image' },
                                            { value: 'video', label: 'Video' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setSearchType(opt.value)}
                                                className={`w-full flex items-center px-2 py-2 rounded-md text-sm ${searchType === opt.value
                                                    ? 'bg-white/[0.08] text-white font-semibold'
                                                    : 'text-stone-300 hover:bg-white/[0.06]'
                                                    }`}
                                            >
                                                <span>{opt.label}</span>
                                                {searchType === opt.value && <span className="ml-auto text-xs text-green-600">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Right panel */}
                                <div className="p-3">
                                    <div className="bg-white/[0.06] rounded-lg p-1 mb-3 flex">
                                        {[
                                            { id: 'day', label: 'Day' },
                                            { id: 'week', label: 'Week' },
                                            { id: 'month', label: 'Month' }
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setDateTab(tab.id)}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-md ${dateTab === tab.id ? 'bg-white/[0.1] shadow-sm text-white' : 'text-stone-500 hover:text-stone-300'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="max-h-[620px] overflow-visible">
                                        {(dateTab === 'day' ? dateRangeGroups.day : dateTab === 'week' ? dateRangeGroups.week : dateRangeGroups.month).map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setDateRange(opt.value); setShowDatePicker(false); }}
                                                className={`w-full text-left px-2 py-2 rounded-md text-sm ${dateRange === opt.value ? 'bg-brand-500/15 text-brand-400 font-semibold' : 'text-stone-300 hover:bg-white/[0.06]'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{opt.label}</span>
                                                    {opt.value === '1' && (
                                                        <span className="text-xs text-stone-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                        <div className="border-t border-white/[0.08] my-2" />
                                        {dateRangeGroups.quarter.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setDateRange(opt.value); setShowDatePicker(false); }}
                                                className={`w-full text-left px-2 py-2 rounded-md text-sm ${dateRange === opt.value ? 'bg-brand-500/15 text-brand-400 font-semibold' : 'text-stone-300 hover:bg-white/[0.06]'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{opt.label}</span>
                                                    {dateRange === opt.value && (
                                                        <span className="text-xs text-stone-500">{getRangeLabel(opt.value)}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                        <div className="border-t border-white/[0.08] my-2" />
                                        {dateRangeGroups.long.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => { setDateRange(opt.value); setShowDatePicker(false); }}
                                                className={`w-full text-left px-2 py-2 rounded-md text-sm ${dateRange === opt.value ? 'bg-brand-500/15 text-brand-400 font-semibold' : 'text-stone-300 hover:bg-white/[0.06]'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={opt.value === '90' ? 'font-semibold' : ''}>{opt.label}</span>
                                                    {dateRange === opt.value && getRangeLabel(opt.value) && (
                                                        <span className="text-xs text-stone-500">{getRangeLabel(opt.value)}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={fetchDetailData} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                    <RefreshCw className={`w-5 h-5 text-stone-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/[0.06] rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white/[0.1] text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                </div>
            ) : (
                <>
                    {activeTab === 'dashboard' && (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Impressions', value: formatNumber(detailTotals.impressions), icon: Eye, color: 'bg-brand-500/15 text-brand-400' },
                                    { label: 'Total Clicks', value: formatNumber(detailTotals.clicks), icon: MousePointerClick, color: 'bg-emerald-500/15 text-emerald-400' },
                                    { label: 'Average CTR', value: `${detailTotals.ctr.toFixed(2)}%`, icon: BarChart3, color: 'bg-amber-500/15 text-amber-400' },
                                    { label: 'Avg Position', value: detailTotals.position ? detailTotals.position.toFixed(1) : '-', icon: TrendingUp, color: 'bg-purple-500/15 text-purple-400' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-5">
                                        <div className={`p-2 rounded-lg ${stat.color} w-fit mb-3`}>
                                            <stat.icon className="w-5 h-5" />
                                        </div>
                                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                                        <p className="text-sm text-stone-400 mt-1">{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Performance Chart */}
                            {detailDailyData.length > 0 && (
                                <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-6">
                                    <h3 className="font-semibold text-white mb-4">Performance Over Time</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={detailDailyData}>
                                                <defs>
                                                    <filter id="lineShadow" x="-20%" y="-20%" width="140%" height="140%">
                                                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.12" />
                                                    </filter>
                                                    <linearGradient id="impressionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="positionGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#555"
                                                    tickFormatter={(value) => {
                                                        if (!value) return '';
                                                        const d = new Date(value);
                                                        if (Number.isNaN(d.getTime())) return value;
                                                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                    }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={24}
                                                />
                                                <YAxis
                                                    yAxisId="clicks"
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#555"
                                                    tickFormatter={(value) => formatNumber(value)}
                                                />
                                                <YAxis
                                                    yAxisId="impressions"
                                                    orientation="right"
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#555"
                                                    tickFormatter={(value) => formatNumber(value)}
                                                />
                                                <YAxis yAxisId="ctr" hide />
                                                <YAxis yAxisId="position" hide />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1a1a23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#e7e5e4' }}
                                                    labelFormatter={(value) => {
                                                        if (!value) return '';
                                                        const d = new Date(value);
                                                        if (Number.isNaN(d.getTime())) return value;
                                                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                    }}
                                                    formatter={(value, name) => {
                                                        if (name === 'CTR (%)') return [`${Number(value).toFixed(2)}%`, name];
                                                        if (name === 'Position') return [Number(value).toFixed(1), name];
                                                        return [formatNumber(value), name];
                                                    }}
                                                />
                                                <Legend />
                                                {activeDetailMetrics.includes('impressions') && (
                                                    <Area yAxisId="impressions" type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} fill="url(#impressionsGradient)" name="Impressions" filter="url(#lineShadow)" />
                                                )}
                                                {activeDetailMetrics.includes('clicks') && (
                                                    <Area yAxisId="clicks" type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fill="url(#clicksGradient)" name="Clicks" filter="url(#lineShadow)" />
                                                )}
                                                {activeDetailMetrics.includes('ctr') && (
                                                    <Line yAxisId="ctr" type="monotone" dataKey="ctr" stroke="#f59e0b" strokeWidth={2} dot={false} name="CTR (%)" filter="url(#lineShadow)" />
                                                )}
                                                {activeDetailMetrics.includes('position') && (
                                                    <Line yAxisId="position" type="monotone" dataKey="position" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Position" filter="url(#lineShadow)" />
                                                )}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Queries and Pages - Side by Side */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Queries Section */}
                                <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-white">Queries</h3>
                                            <div className="flex gap-1 text-xs">
                                                {['all', 'growing', 'decaying'].map((f) => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setQueriesFilter(f)}
                                                        className={`px-2 py-1 rounded-md capitalize ${queriesFilter === f
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-500 hover:text-stone-300'
                                                            }`}
                                                    >
                                                        {f === 'growing' && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />}
                                                        {f === 'decaying' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />}
                                                        {f}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-brand-400">{selectedMetric === 'clicks' ? 'Clicks' : 'Impressions'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {(detailData?.queries || []).slice(0, 10).map((q, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.06] rounded-lg group">
                                                <span className="text-sm text-stone-300 truncate flex-1">{q.keys[0]}</span>
                                                <span className="text-sm font-medium text-brand-400">
                                                    {formatNumber(selectedMetric === 'clicks' ? q.clicks : q.impressions)}
                                                    <span className="text-xs text-green-500 ml-1">+∞%</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full mt-4 py-2 text-xs text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
                                        <Maximize2 className="w-3 h-3" /> EXPAND
                                    </button>
                                </div>

                                {/* Pages Section */}
                                <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-white">Pages</h3>
                                            <div className="flex gap-1 text-xs">
                                                {['all', 'growing', 'decaying'].map((f) => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setPagesFilter(f)}
                                                        className={`px-2 py-1 rounded-md capitalize ${pagesFilter === f
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-500 hover:text-stone-300'
                                                            }`}
                                                    >
                                                        {f === 'growing' && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />}
                                                        {f === 'decaying' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />}
                                                        {f}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-brand-400">{selectedMetric === 'clicks' ? 'Clicks' : 'Impressions'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {(detailData?.pages || []).slice(0, 10).map((p, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.06] rounded-lg group">
                                                <span className="text-sm text-stone-300 truncate flex-1">{new URL(p.keys[0]).pathname || '/'}</span>
                                                <span className="text-sm font-medium text-brand-400">
                                                    {formatNumber(selectedMetric === 'clicks' ? p.clicks : p.impressions)}
                                                    <span className="text-xs text-green-500 ml-1">+∞%</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full mt-4 py-2 text-xs text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
                                        <Maximize2 className="w-3 h-3" /> EXPAND
                                    </button>
                                </div>
                            </div>

                            {/* Countries and Devices - Side by Side */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Countries Section */}
                                <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-white">Countries</h3>
                                            <div className="flex gap-1 text-xs">
                                                {['all', 'growing', 'decaying'].map((f) => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setCountriesFilter(f)}
                                                        className={`px-2 py-1 rounded-md capitalize ${countriesFilter === f
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-500 hover:text-stone-300'
                                                            }`}
                                                    >
                                                        {f}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Countries Header */}
                                    <div className="flex items-center justify-between py-2 px-2 text-xs text-stone-500 border-b border-white/[0.08] mb-1">
                                        <span className="flex-1">Country</span>
                                        <span className="w-20 text-right">Clicks</span>
                                        <span className="w-20 text-right">Impr.</span>
                                        <span className="w-16 text-right">CTR</span>
                                    </div>
                                    <div className="space-y-1">
                                        {(detailData?.countries || []).slice(0, 10).map((c, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.06] rounded-lg">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <img
                                                        src={getCountryFlagUrl(c.keys[0])}
                                                        alt={getCountryName(c.keys[0])}
                                                        className="w-5 h-5 rounded-full object-cover"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                    <span className="text-sm text-stone-300">{getCountryName(c.keys[0])}</span>
                                                </div>
                                                <span className="text-sm font-medium text-stone-300 w-20 text-right">{formatNumber(c.clicks)}</span>
                                                <span className="text-sm font-medium text-brand-400 w-20 text-right">{formatNumber(c.impressions)}</span>
                                                <span className="text-sm text-stone-500 w-16 text-right">{(c.ctr * 100).toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full mt-4 py-2 text-xs text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1">
                                        <Maximize2 className="w-3 h-3" /> EXPAND
                                    </button>
                                </div>

                                {/* Devices Section */}
                                <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-white">Devices</h3>
                                            <div className="flex gap-1 text-xs">
                                                {['all', 'growing', 'decaying'].map((f) => (
                                                    <button
                                                        key={f}
                                                        onClick={() => setDevicesFilter(f)}
                                                        className={`px-2 py-1 rounded-md capitalize ${devicesFilter === f
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-500 hover:text-stone-300'
                                                            }`}
                                                    >
                                                        {f}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-brand-400">{selectedMetric === 'clicks' ? 'Clicks' : 'Impressions'}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {(detailData?.devices || []).map((d, i) => {
                                            const DeviceIcon = d.keys[0] === 'MOBILE' ? Smartphone : d.keys[0] === 'TABLET' ? Tablet : Monitor;
                                            return (
                                                <div key={i} className="flex items-center justify-between py-2 px-2 hover:bg-white/[0.06] rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <DeviceIcon className="w-4 h-4 text-stone-500" />
                                                        <span className="text-sm text-stone-300 capitalize">{d.keys[0].toLowerCase()}</span>
                                                    </div>
                                                    <span className="text-sm font-medium text-brand-400">
                                                        {formatNumber(selectedMetric === 'clicks' ? d.clicks : d.impressions)}
                                                        <span className="text-xs text-green-500 ml-1">+∞%</span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'queries' && (
                        <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/[0.03]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-stone-500 uppercase">Query</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Impressions</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Clicks</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">CTR</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Position</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {(detailData?.queries || []).map((q, i) => (
                                        <tr key={i} className="hover:bg-white/[0.04]">
                                            <td className="px-6 py-4 text-sm font-medium text-stone-200">{q.keys[0]}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(q.impressions)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(q.clicks)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{(q.ctr * 100).toFixed(1)}%</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{q.position?.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'pages' && (
                        <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/[0.03]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-stone-500 uppercase">Page</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Impressions</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Clicks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {(detailData?.pages || []).map((p, i) => (
                                        <tr key={i} className="hover:bg-white/[0.04]">
                                            <td className="px-6 py-4 text-sm font-medium text-brand-400 truncate max-w-md">{p.keys[0]}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(p.impressions)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(p.clicks)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'countries' && (
                        <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/[0.03]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-stone-500 uppercase">Country</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Clicks</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Impressions</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">CTR</th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase">Avg Position</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {(detailData?.countries || []).map((c, i) => (
                                        <tr key={i} className="hover:bg-white/[0.04]">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={getCountryFlagUrl(c.keys[0])}
                                                        alt={getCountryName(c.keys[0])}
                                                        className="w-6 h-6 rounded-full object-cover"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                    <span className="text-sm font-medium text-stone-200">{getCountryName(c.keys[0])}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(c.clicks)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{formatNumber(c.impressions)}</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{(c.ctr * 100).toFixed(1)}%</td>
                                            <td className="px-6 py-4 text-sm text-stone-400 text-right">{c.position?.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Main Bulk Analysis Page Component
const BulkAnalysisPage = () => {
    const { user, isLoading: isAuthLoading } = useAuth();
    const { siteId } = useParams();
    const navigate = useNavigate();

    // GSC Auth State
    const [accessToken, setAccessToken] = useState(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [gscEmail, setGscEmail] = useState(null);
    const lastSilentRestoreRef = useRef(0);

    const applyGscSession = useCallback((session) => {
        if (!session?.accessToken) return;

        setAccessToken(session.accessToken);
        setIsSignedIn(true);
        setGscEmail(session.googleEmail || null);
    }, []);

    const clearGscState = useCallback(() => {
        clearStoredGscSession();
        setAccessToken(null);
        setIsSignedIn(false);
        setGscEmail(null);
        setSites([]);
    }, []);

    const restoreConnection = useCallback(async ({ silent = false } = {}) => {
        const urlParams = new URLSearchParams(window.location.search);
        const hasOauthCode = urlParams.get('code') && urlParams.get('state') === 'bulk_analysis_oauth';

        if (hasOauthCode) {
            if (!silent) {
                setIsCheckingAuth(Boolean(isAuthLoading || !user?.id));
            }
            return;
        }

        if (isAuthLoading) {
            if (!silent) {
                setIsCheckingAuth(true);
            }
            return;
        }

        if (silent) {
            const now = Date.now();
            if (now - lastSilentRestoreRef.current < 1500) {
                return;
            }
            lastSilentRestoreRef.current = now;

            const localSession = readStoredGscSession();
            if (localSession?.accessToken) {
                applyGscSession(localSession);
                return;
            }
        } else {
            setIsCheckingAuth(true);
        }

        try {
            const session = await restoreGscSession({ userId: user?.id, preferServer: Boolean(user?.id) });
            if (session?.connected && session.accessToken) {
                applyGscSession(session);
            } else {
                clearGscState();
            }
        } catch (err) {
            console.error('Error restoring bulk-analysis GSC session:', err);
            clearGscState();
        } finally {
            if (!silent) {
                setIsCheckingAuth(false);
            }
        }
    }, [applyGscSession, clearGscState, isAuthLoading, user?.id]);

    const getValidAccessToken = useCallback(async () => {
        const session = await ensureValidGscSession({ userId: user?.id });

        if (!session?.accessToken) {
            clearGscState();
            throw new Error('Please sign in again.');
        }

        applyGscSession(session);
        return session.accessToken;
    }, [applyGscSession, clearGscState, user?.id]);

    // Sites State
    const [sites, setSites] = useState([]);
    const [isLoadingSites, setIsLoadingSites] = useState(false);
    const [sitesDataLoading, setSitesDataLoading] = useState({});

    // UI State - Initialize from localStorage with fallback defaults
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('impressions');
    const [sortDirection, setSortDirection] = useState('desc');
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem(LS_KEYS.VIEW_MODE) || 'grid';
        } catch { return 'grid'; }
    });
    const [selectedSite, setSelectedSite] = useState(null);
    const [error, setError] = useState('');
    const [activeMetrics, setActiveMetrics] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_KEYS.ACTIVE_METRICS);
            return saved ? JSON.parse(saved) : ['impressions']; // Default to impressions only
        } catch { return ['impressions']; }
    });
    const [mainDateRange, setMainDateRange] = useState(() => {
        try {
            return localStorage.getItem(LS_KEYS.DATE_RANGE) || '90';
        } catch { return '90'; }
    });

    // Persist UI state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.ACTIVE_METRICS, JSON.stringify(activeMetrics));
        } catch { }
    }, [activeMetrics]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.DATE_RANGE, mainDateRange);
        } catch { }
    }, [mainDateRange]);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEYS.VIEW_MODE, viewMode);
        } catch { }
    }, [viewMode]);

    // Advanced date picker state
    const [showMainDatePicker, setShowMainDatePicker] = useState(false);
    const [datePickerTab, setDatePickerTab] = useState('day');
    const mainDatePickerRef = useRef(null);

    // Date range options groups
    const mainDateRangeGroups = {
        day: [
            { value: '1', label: 'Today' },
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '28', label: '28 days' }
        ],
        week: [
            { value: 'LW', label: 'Last Week' }
        ],
        month: [
            { value: 'TM', label: 'This Month' },
            { value: 'LM', label: 'Last Month' }
        ],
        quarter: [
            { value: 'TQ', label: 'This Quarter' },
            { value: 'LQ', label: 'Last Quarter' },
            { value: 'YTD', label: 'Year to Date' }
        ],
        long: [
            { value: '90', label: '3 months' },
            { value: '180', label: '6 months' },
            { value: '240', label: '8 months' },
            { value: '365', label: '12 months' },
            { value: '486', label: '16 months' },
            { value: '730', label: '2 years' },
            { value: '1095', label: '3 years' }
        ]
    };

    // Helper to format date for display
    const formatLongDate = (date) => (
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    );

    // Helper to get date range from value (with GSC 2-day delay)
    const getMainRangeForValue = (value) => {
        const end = new Date();
        end.setDate(end.getDate() - 2); // GSC 2-day delay
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        if (!value) {
            start.setDate(start.getDate() - 89);
            return { start, end };
        }

        if (/^\d+$/.test(value)) {
            const days = parseInt(value, 10);
            start.setDate(start.getDate() - Math.max(0, days - 1));
            return { start, end };
        }

        if (value === 'LW') {
            start.setDate(start.getDate() - 6);
            return { start, end };
        }

        if (value === 'TM') {
            return { start: new Date(end.getFullYear(), end.getMonth(), 1), end };
        }

        if (value === 'LM') {
            const startOfLastMonth = new Date(end.getFullYear(), end.getMonth() - 1, 1);
            const endOfLastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
            return { start: startOfLastMonth, end: endOfLastMonth };
        }

        if (value === 'TQ') {
            const quarter = Math.floor(end.getMonth() / 3);
            const quarterStart = new Date(end.getFullYear(), quarter * 3, 1);
            return { start: quarterStart, end };
        }

        if (value === 'LQ') {
            const quarter = Math.floor(end.getMonth() / 3) - 1;
            const year = quarter < 0 ? end.getFullYear() - 1 : end.getFullYear();
            const q = (quarter + 4) % 4;
            const startOfQuarter = new Date(year, q * 3, 1);
            const endOfQuarter = new Date(year, q * 3 + 3, 0);
            return { start: startOfQuarter, end: endOfQuarter };
        }

        if (value === 'YTD') {
            return { start: new Date(end.getFullYear(), 0, 1), end };
        }

        start.setDate(start.getDate() - 89);
        return { start, end };
    };

    // Get label for selected date range
    const getMainDateRangeLabel = useMemo(() => {
        const all = [
            ...mainDateRangeGroups.day,
            ...mainDateRangeGroups.week,
            ...mainDateRangeGroups.month,
            ...mainDateRangeGroups.quarter,
            ...mainDateRangeGroups.long
        ];
        return all.find(o => o.value === mainDateRange)?.label || '3 months';
    }, [mainDateRange]);

    // Get date range display string
    const mainDateRangeDisplay = useMemo(() => {
        const range = getMainRangeForValue(mainDateRange);
        return `${formatLongDate(range.start)} - ${formatLongDate(range.end)}`;
    }, [mainDateRange]);

    // Close date picker on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (mainDatePickerRef.current && !mainDatePickerRef.current.contains(e.target)) {
                setShowMainDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Metric options for toolbar
    const mainMetricOptions = [
        { id: 'clicks', icon: MousePointerClick, label: 'Clicks' },
        { id: 'impressions', icon: Eye, label: 'Impressions' },
        { id: 'ctr', icon: Percent, label: 'CTR' },
        { id: 'position', icon: Target, label: 'Position' },
    ];

    // Check for saved GSC connection
    useEffect(() => {
        restoreConnection();
    }, [restoreConnection]);

    useEffect(() => {
        const resume = () => {
            restoreConnection({ silent: isSignedIn });
        };

        const handleVisible = () => {
            if (document.visibilityState === 'visible') {
                resume();
            }
        };

        window.addEventListener('focus', resume);
        document.addEventListener('visibilitychange', handleVisible);

        return () => {
            window.removeEventListener('focus', resume);
            document.removeEventListener('visibilitychange', handleVisible);
        };
    }, [isSignedIn, restoreConnection]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code || state !== 'bulk_analysis_oauth') {
            return;
        }

        if (isAuthLoading || !user?.id) {
            setIsCheckingAuth(true);
            return;
        }

        const exchangeCode = async () => {
            setIsCheckingAuth(true);

            try {
                const response = await fetch('/api/gsc-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'exchange',
                        code,
                        userId: user.id,
                        redirectUri: window.location.origin
                    })
                });

                const data = await response.json();
                if (response.ok && data.success && data.accessToken) {
                    writeStoredGscSession({
                        accessToken: data.accessToken,
                        expiresAt: data.expiresAt,
                        googleEmail: data.googleEmail
                    });
                    applyGscSession({
                        accessToken: data.accessToken,
                        expiresAt: data.expiresAt,
                        googleEmail: data.googleEmail
                    });
                } else {
                    console.error('Bulk analysis OAuth exchange failed:', data);
                    clearGscState();
                }
            } catch (err) {
                console.error('Bulk analysis OAuth exchange error:', err);
                clearGscState();
            } finally {
                setIsCheckingAuth(false);
                window.history.replaceState({}, document.title, '/gsc/bulk-analysis');
            }
        };

        exchangeCode();
    }, [applyGscSession, clearGscState, isAuthLoading, user?.id]);

    // Fetch sites when signed in
    useEffect(() => {
        if (accessToken && isSignedIn) {
            fetchSites();
        }
    }, [accessToken, isSignedIn]);

    // Refetch all site data when date range changes
    useEffect(() => {
        if (accessToken && isSignedIn && sites.length > 0) {
            for (const site of sites) {
                fetchSiteData(site.siteUrl);
            }
        }
    }, [mainDateRange]);

    const fetchSites = async () => {
        setIsLoadingSites(true);
        setError('');
        try {
            const token = await getValidAccessToken();
            const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(response.status === 401 ? 'Please sign in again.' : 'Failed to fetch sites');
            }

            const data = await response.json();
            const siteEntries = data.siteEntry || [];

            // Initialize sites with empty data
            setSites(siteEntries.map(s => ({ ...s, data: null })));

            // Fetch data for each site
            for (const site of siteEntries) {
                fetchSiteData(site.siteUrl);
            }
        } catch (err) {
            setError(err.message);
            if (err.message.includes('sign in') || err.message.includes('401')) {
                handleSignOut({ disconnectServer: false });
            }
        } finally {
            setIsLoadingSites(false);
        }
    };

    const fetchSiteData = async (siteUrl) => {
        setSitesDataLoading(prev => ({ ...prev, [siteUrl]: true }));

        // Use the selected date range with GSC 2-day delay already factored in
        const { start: startDate, end: endDate } = getMainRangeForValue(mainDateRange);

        // Calculate days in the selected range for comparison period
        const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        const prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - daysInRange + 1);

        const formatDate = (d) => d.toISOString().split('T')[0];

        try {
            const token = await getValidAccessToken();
            // Fetch current period
            const currentResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(startDate),
                        endDate: formatDate(endDate),
                        dimensions: ['date'],
                        rowLimit: 1000
                    })
                }
            );
            if (!currentResponse.ok) {
                throw new Error(currentResponse.status === 401 ? 'Please sign in again.' : `Failed to fetch site data for ${siteUrl}`);
            }
            const currentData = await currentResponse.json();

            // Fetch previous period for comparison
            const prevResponse = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        startDate: formatDate(prevStartDate),
                        endDate: formatDate(prevEndDate),
                        dimensions: ['date'],
                        rowLimit: 1000
                    })
                }
            );
            if (!prevResponse.ok) {
                throw new Error(prevResponse.status === 401 ? 'Please sign in again.' : `Failed to fetch previous site data for ${siteUrl}`);
            }
            const prevData = await prevResponse.json();

            // Calculate totals
            const currentRows = currentData.rows || [];
            const prevRows = prevData.rows || [];

            const currentTotals = currentRows.reduce((acc, r) => ({
                clicks: acc.clicks + (r.clicks || 0),
                impressions: acc.impressions + (r.impressions || 0),
                ctr: 0,
                position: acc.position + (r.position || 0),
                count: acc.count + 1
            }), { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 });

            const prevTotals = prevRows.reduce((acc, r) => ({
                clicks: acc.clicks + (r.clicks || 0),
                impressions: acc.impressions + (r.impressions || 0)
            }), { clicks: 0, impressions: 0 });

            currentTotals.ctr = currentTotals.impressions > 0 ? (currentTotals.clicks / currentTotals.impressions) * 100 : 0;
            currentTotals.position = currentTotals.count > 0 ? currentTotals.position / currentTotals.count : 0;

            // Calculate trends
            const impressionsTrend = prevTotals.impressions > 0
                ? ((currentTotals.impressions - prevTotals.impressions) / prevTotals.impressions) * 100
                : 0;
            const clicksTrend = prevTotals.clicks > 0
                ? ((currentTotals.clicks - prevTotals.clicks) / prevTotals.clicks) * 100
                : 0;

            // Update site with data
            setSites(prev => prev.map(s =>
                s.siteUrl === siteUrl
                    ? {
                        ...s,
                        data: {
                            ...currentTotals,
                            impressionsTrend,
                            clicksTrend,
                            trend: impressionsTrend > 0 ? 'up' : impressionsTrend < 0 ? 'down' : 'neutral',
                            dailyData: currentRows.map(r => ({
                                date: r.keys[0],
                                impressions: r.impressions || 0,
                                clicks: r.clicks || 0,
                                ctr: r.ctr ? r.ctr * 100 : 0,
                                position: r.position || 0
                            }))
                        }
                    }
                    : s
            ));
        } catch (err) {
            console.error(`Error fetching data for ${siteUrl}:`, err);
            if (err.message.includes('sign in')) {
                handleSignOut({ disconnectServer: false });
            }
        } finally {
            setSitesDataLoading(prev => ({ ...prev, [siteUrl]: false }));
        }
    };

    const handleSignIn = async () => {
        try {
            window.location.href = await getGscAuthUrl({
                returnTo: '/gsc/bulk-analysis',
                source: 'bulk-analysis',
            });
        } catch (err) {
            setError(err?.message || 'Could not start Google Search Console connection.');
        }
    };

    const handleSignOut = async ({ disconnectServer = true } = {}) => {
        if (disconnectServer && user?.id) {
            try {
                await fetch('/api/gsc-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'disconnect', userId: user.id })
                });
            } catch (err) {
                console.error('Failed to disconnect GSC:', err);
            }
        }
        clearGscState();
    };

    // Filter and sort sites
    const filteredSites = useMemo(() => {
        let result = [...sites];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s => s.siteUrl?.toLowerCase().includes(query));
        }

        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = (a.siteUrl || '').localeCompare(b.siteUrl || '');
                    break;
                case 'impressions':
                    comparison = (b.data?.impressions || 0) - (a.data?.impressions || 0);
                    break;
                case 'clicks':
                    comparison = (b.data?.clicks || 0) - (a.data?.clicks || 0);
                    break;
                case 'trend':
                    comparison = (b.data?.impressionsTrend || 0) - (a.data?.impressionsTrend || 0);
                    break;
                default:
                    comparison = 0;
            }
            return sortDirection === 'asc' ? -comparison : comparison;
        });

        return result;
    }, [sites, searchQuery, sortBy, sortDirection]);

    // Handle URL-based site selection
    useEffect(() => {
        if (siteId && sites.length > 0) {
            const decodedSiteId = decodeURIComponent(siteId);
            const site = sites.find(s => s.siteUrl === decodedSiteId || encodeURIComponent(s.siteUrl) === siteId);
            if (site) {
                setSelectedSite(site);
            }
        } else {
            setSelectedSite(null);
        }
    }, [siteId, sites]);

    const handleSiteClick = (site) => {
        navigate(`/gsc/bulk-analysis/${encodeURIComponent(site.siteUrl)}`);
    };

    const handleBack = () => {
        navigate('/gsc/bulk-analysis');
    };

    // Loading state
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    // Not signed in - show connect screen
    if (!isSignedIn) {
        return <GSCConnectScreen onConnect={handleSignIn} isLoading={false} />;
    }

    // Show detail view if a site is selected
    if (selectedSite) {
        return (
            <div className="min-h-screen bg-stone-950 p-6">
                <div className="max-w-7xl mx-auto">
                    <SiteDetailView site={selectedSite} getValidAccessToken={getValidAccessToken} onBack={handleBack} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-950">
            {/* Header */}
            <div className="bg-[#0d1117] border-b border-white/[0.08] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-4 min-w-[140px]" />

                        <div className="absolute left-1/2 -translate-x-1/2">
                            <BulkAnalysisToggle />
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-3">
                            {/* Sort */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium bg-white/[0.04] text-stone-300"
                            >
                                <option value="impressions">Sort by Impressions</option>
                                <option value="clicks">Sort by Clicks</option>
                                <option value="name">Sort by Name</option>
                            </select>

                            {/* View Toggle */}
                            <div className="flex items-center bg-white/[0.06] rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/[0.1] shadow-sm text-white' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/[0.1] shadow-sm text-white' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={fetchSites}
                                disabled={isLoadingSites}
                                className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 text-stone-400 ${isLoadingSites ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Sign Out */}
                            <button
                                onClick={handleSignOut}
                                className="p-2 hover:bg-red-500/10 text-stone-400 hover:text-red-400 rounded-lg transition-colors"
                                title="Disconnect GSC"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>

                        </div>
                    </div>
                </div>
            </div>

            {/* Metric Toolbar */}
            <div className="bg-[#0d1117] border-b border-white/[0.06]">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 flex justify-center">
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                                <input
                                    type="text"
                                    placeholder="Search websites..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-white/[0.1] rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-white/[0.04] text-stone-200 placeholder-stone-500"
                                />
                            </div>
                        </div>

                        {/* Metric Toggle Icons */}
                        <div className="flex items-center gap-1">
                            {mainMetricOptions.map((metric) => {
                                const isActive = activeMetrics.includes(metric.id);
                                const toggleMetric = () => {
                                    if (isActive && activeMetrics.length > 1) {
                                        // Remove metric (but keep at least one)
                                        setActiveMetrics(activeMetrics.filter(m => m !== metric.id));
                                    } else if (!isActive) {
                                        // Add metric
                                        setActiveMetrics([...activeMetrics, metric.id]);
                                    }
                                };
                                return (
                                    <button
                                        key={metric.id}
                                        onClick={toggleMetric}
                                        className={`p-2 rounded-lg transition-all group relative ${isActive
                                            ? 'bg-brand-500/15 text-brand-400'
                                            : 'text-stone-500 hover:text-stone-300 hover:bg-white/[0.06]'
                                            }`}
                                        title={metric.label}
                                    >
                                        <metric.icon className="w-4 h-4" />
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                            {metric.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/[0.1]" />

                        {/* Advanced Date Range Picker */}
                        <div className="relative" ref={mainDatePickerRef}>
                            <button
                                onClick={() => setShowMainDatePicker(!showMainDatePicker)}
                                className="flex items-center gap-2 px-3 py-1.5 border border-white/[0.1] rounded-lg text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-stone-500" />
                                <span>{getMainDateRangeLabel}</span>
                                <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${showMainDatePicker ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Advanced Date Picker Dropdown */}
                            {showMainDatePicker && (
                                <div className="absolute right-0 top-full mt-2 bg-stone-900 rounded-xl shadow-xl border border-white/[0.1] z-50 min-w-[320px]">
                                    {/* Tabs */}
                                    <div className="flex border-b border-white/[0.08]">
                                        {['day', 'week', 'month'].map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setDatePickerTab(tab)}
                                                className={`flex-1 px-4 py-3 text-sm font-medium capitalize ${datePickerTab === tab
                                                    ? 'text-brand-400 border-b-2 border-brand-500'
                                                    : 'text-stone-500 hover:text-stone-300'
                                                    }`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Date Range Display */}
                                    <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.08]">
                                        <p className="text-xs text-stone-500 text-center">{mainDateRangeDisplay}</p>
                                    </div>

                                    {/* Options */}
                                    <div className="p-2 max-h-80 overflow-y-auto">
                                        {datePickerTab === 'day' && (
                                            <div className="grid grid-cols-1 gap-1">
                                                {mainDateRangeGroups.day.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => {
                                                            setMainDateRange(option.value);
                                                            setShowMainDatePicker(false);
                                                        }}
                                                        className={`px-3 py-2 text-left text-sm rounded-lg transition-colors ${mainDateRange === option.value
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-300 hover:bg-white/[0.06]'
                                                            }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {datePickerTab === 'week' && (
                                            <div className="grid grid-cols-1 gap-1">
                                                {mainDateRangeGroups.week.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => {
                                                            setMainDateRange(option.value);
                                                            setShowMainDatePicker(false);
                                                        }}
                                                        className={`px-3 py-2 text-left text-sm rounded-lg transition-colors ${mainDateRange === option.value
                                                            ? 'bg-brand-500/15 text-brand-400 font-medium'
                                                            : 'text-stone-300 hover:bg-white/[0.06]'
                                                            }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {datePickerTab === 'month' && (
                                            <div className="space-y-4">
                                                {/* Month options */}
                                                <div className="grid grid-cols-1 gap-1">
                                                    {mainDateRangeGroups.month.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => {
                                                                setMainDateRange(option.value);
                                                                setShowMainDatePicker(false);
                                                            }}
                                                            className={`px-3 py-2 text-left text-sm rounded-lg transition-colors ${mainDateRange === option.value
                                                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Divider */}
                                                <div className="border-t border-white/[0.08]" />

                                                {/* Quarter options */}
                                                <div className="grid grid-cols-1 gap-1">
                                                    {mainDateRangeGroups.quarter.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => {
                                                                setMainDateRange(option.value);
                                                                setShowMainDatePicker(false);
                                                            }}
                                                            className={`px-3 py-2 text-left text-sm rounded-lg transition-colors ${mainDateRange === option.value
                                                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Divider */}
                                                <div className="border-t border-white/[0.08]" />

                                                {/* Long range options */}
                                                <div className="grid grid-cols-1 gap-1">
                                                    {mainDateRangeGroups.long.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => {
                                                                setMainDateRange(option.value);
                                                                setShowMainDatePicker(false);
                                                            }}
                                                            className={`px-3 py-2 text-left text-sm rounded-lg transition-colors ${mainDateRange === option.value
                                                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {isLoadingSites ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                    </div>
                ) : sites.length === 0 ? (
                    <div className="text-center py-16">
                        <Globe className="w-16 h-16 text-stone-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No websites found</h3>
                        <p className="text-stone-500 mb-6">Add websites to your Google Search Console to see them here</p>
                        <a
                            href="https://search.google.com/search-console"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
                        >
                            Open Search Console
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSites.map((site) => (
                            <WebsiteCard
                                key={site.siteUrl}
                                site={site}
                                onClick={() => handleSiteClick(site)}
                                isLoading={sitesDataLoading[site.siteUrl]}
                                activeMetrics={activeMetrics}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#0d1117] rounded-2xl border border-white/[0.08] overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/[0.03]">
                                <tr>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-medium text-stone-500 uppercase cursor-pointer hover:bg-white/[0.06] transition-colors"
                                        onClick={() => {
                                            if (sortBy === 'name') {
                                                setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                            } else {
                                                setSortBy('name');
                                                setSortDirection('asc');
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            Website
                                            {sortBy === 'name' && (
                                                sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase cursor-pointer hover:bg-white/[0.06] transition-colors"
                                        onClick={() => {
                                            if (sortBy === 'impressions') {
                                                setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                            } else {
                                                setSortBy('impressions');
                                                setSortDirection('desc');
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Impressions
                                            {sortBy === 'impressions' && (
                                                sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase cursor-pointer hover:bg-white/[0.06] transition-colors"
                                        onClick={() => {
                                            if (sortBy === 'clicks') {
                                                setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                            } else {
                                                setSortBy('clicks');
                                                setSortDirection('desc');
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Clicks
                                            {sortBy === 'clicks' && (
                                                sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-right text-xs font-medium text-stone-500 uppercase cursor-pointer hover:bg-white/[0.06] transition-colors"
                                        onClick={() => {
                                            if (sortBy === 'trend') {
                                                setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                            } else {
                                                setSortBy('trend');
                                                setSortDirection('desc');
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            Trend
                                            {sortBy === 'trend' && (
                                                sortDirection === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredSites.map((site) => (
                                    <tr
                                        key={site.siteUrl}
                                        onClick={() => handleSiteClick(site)}
                                        className="hover:bg-white/[0.04] cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={getFaviconUrl(site.siteUrl)} alt="" className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                                                <div>
                                                    <p className="font-medium text-white">{getSiteDisplayName(site.siteUrl)}</p>
                                                    <p className="text-sm text-stone-500">{site.siteUrl?.replace(/^sc-domain:/, '')}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-stone-400">
                                            {sitesDataLoading[site.siteUrl] ? (
                                                <Loader2 className="w-4 h-4 animate-spin inline" />
                                            ) : (
                                                formatNumber(site.data?.impressions)
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-stone-400">
                                            {sitesDataLoading[site.siteUrl] ? '-' : formatNumber(site.data?.clicks)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {site.data && <TrendBadge value={site.data.impressionsTrend} />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkAnalysisPage;

