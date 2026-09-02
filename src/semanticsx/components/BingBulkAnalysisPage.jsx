import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
    ArrowLeft, Search, TrendingUp, TrendingDown, Minus, ExternalLink, Globe,
    LayoutGrid, List, AlertCircle, MousePointerClick, Eye, BarChart3, RefreshCw,
    Loader2, ChevronUp, ChevronDown, Filter, Calendar, Percent, Key, ChevronRight, Maximize2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import BulkAnalysisToggle from './BulkAnalysisToggle';

// Session storage keys for persisting user preferences
const LS_KEYS = {
    ACTIVE_METRICS: 'bingBulkAnalysis_activeMetrics',
    DATE_RANGE: 'bingBulkAnalysis_dateRange',
    VIEW_MODE: 'bingBulkAnalysis_viewMode',
    DETAIL_ACTIVE_METRICS: 'bingBulkAnalysis_detailActiveMetrics',
    DETAIL_DATE_RANGE: 'bingBulkAnalysis_detailDateRange',
};

const BING_KEY_STORAGE = "bing_webmaster_api_key";

// Helper to extract favicon URL
const getFaviconUrl = (siteUrl) => {
    const cleanDomain = siteUrl?.replace(/^https?:\/\//, '')?.replace(/^www\./, '')?.split('/')[0];
    return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;
};

// Helper to extract display name from site URL
const getSiteDisplayName = (siteUrl) => {
    if (!siteUrl) return 'Unknown';
    const cleaned = siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
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

// Helper to parse Microsoft JSON date format (e.g., "/Date(1768550400000-0800)/")
const parseBingDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    // Check if it's already a normal date string
    if (!dateStr.includes('/Date(')) {
        return dateStr;
    }
    try {
        // Extract timestamp from /Date(timestamp)/ or /Date(timestamp+offset)/
        const match = dateStr.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
        if (match && match[1]) {
            const timestamp = parseInt(match[1], 10);
            const date = new Date(timestamp);
            // Format as "Jan 15" style
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    } catch (e) {
        console.error('Error parsing Bing date:', e);
    }
    return dateStr;
};

// Multi-Metric Sparkline Component
const MultiMetricSparkline = ({ data, height = 50, activeMetrics = ['clicks', 'impressions', 'ctr'] }) => {
    if (!data || data.length === 0) {
        return <div style={{ height }} className="bg-gray-50 rounded" />;
    }

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length > 0) {
            const dataPoint = payload[0]?.payload;
            if (!dataPoint) return null;
            return (
                <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 text-xs min-w-[160px]">
                    <div className="font-medium text-gray-700 mb-2 pb-1 border-b border-gray-100">
                        {dataPoint.date || 'N/A'}
                    </div>
                    <div className="space-y-1.5">
                        {activeMetrics.includes('clicks') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-gray-600">Clicks</span>
                                </div>
                                <span className="font-semibold text-gray-900">{formatNumber(dataPoint.clicks || 0)}</span>
                            </div>
                        )}
                        {activeMetrics.includes('impressions') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                                    <span className="text-gray-600">Impressions</span>
                                </div>
                                <span className="font-semibold text-gray-900">{formatNumber(dataPoint.impressions || 0)}</span>
                            </div>
                        )}
                        {activeMetrics.includes('ctr') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-gray-600">CTR</span>
                                </div>
                                <span className="font-semibold text-gray-900">{(dataPoint.ctr || 0).toFixed(1)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const normalizeData = () => {
        const maxValues = {
            clicks: Math.max(...data.map(d => d.clicks || 0)) || 1,
            impressions: Math.max(...data.map(d => d.impressions || 0)) || 1,
            ctr: Math.max(...data.map(d => d.ctr || 0)) || 1,
        };
        return data.map(d => ({
            ...d,
            clicksNorm: ((d.clicks || 0) / maxValues.clicks) * 100,
            impressionsNorm: ((d.impressions || 0) / maxValues.impressions) * 100,
            ctrNorm: ((d.ctr || 0) / maxValues.ctr) * 100,
        }));
    };

    const normalizedData = normalizeData();

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={normalizedData} margin={{ top: 5, right: 2, left: 2, bottom: 0 }}>
                <defs>
                    <linearGradient id="bingGradientClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bingGradientImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#df3c27" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#df3c27" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bingGradientCtr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" hide={true} />
                <YAxis domain={[0, 100]} hide={true} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                <Tooltip content={<CustomTooltip />} />
                {activeMetrics.includes('impressions') && (
                        <Area type="monotone" dataKey="impressionsNorm" stroke="#df3c27" strokeWidth={2}
                        fill="url(#bingGradientImpressions)" dot={false}
                            activeDot={{ r: 3, fill: '#df3c27', stroke: '#fff', strokeWidth: 1 }} />
                )}
                {activeMetrics.includes('clicks') && (
                    <Area type="monotone" dataKey="clicksNorm" stroke="#10b981" strokeWidth={2}
                        fill="url(#bingGradientClicks)" dot={false}
                        activeDot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }} />
                )}
                {activeMetrics.includes('ctr') && (
                    <Area type="monotone" dataKey="ctrNorm" stroke="#f59e0b" strokeWidth={2}
                        fill="url(#bingGradientCtr)" dot={false}
                        activeDot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1 }} />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
};

// Trend Badge Component
const TrendBadge = ({ value, suffix = '%' }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isPositive ? 'bg-green-100 text-green-700' : isNeutral ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNeutral ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{value?.toFixed?.(1) || value}{suffix}
        </span>
    );
};

// Website Card Component
const WebsiteCard = ({ site, onClick, isLoading, activeMetrics }) => {
    const hasData = site.data && (site.data.impressions > 0 || site.data.clicks > 0);
    return (
        <div onClick={onClick}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden">
            <div className="p-4 pb-2">
                <div className="flex items-start gap-3">
                    <img src={getFaviconUrl(site.siteUrl)} alt=""
                        className="w-10 h-10 rounded-lg bg-gray-100 object-contain"
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f97316"><circle cx="12" cy="12" r="10"/></svg>'; }} />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{getSiteDisplayName(site.siteUrl)}</h3>
                        <p className="text-xs text-gray-500 truncate">{site.siteUrl?.replace(/^https?:\/\//, '')}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
            {isLoading ? (
                <div className="p-4 pt-2 flex items-center justify-center h-24">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
            ) : hasData ? (
                <>
                    <div className="px-4 h-16">
                        <MultiMetricSparkline data={site.data?.dailyData || []} height={60} activeMetrics={activeMetrics} />
                    </div>
                    <div className="p-4 pt-2 grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-gray-500 mb-0.5">Impressions</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gray-900">{formatNumber(site.data.impressions)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-0.5">Clicks</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gray-900">{formatNumber(site.data.clicks)}</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-4 pt-2 flex flex-col items-center justify-center h-24 text-gray-400">
                    <AlertCircle className="w-5 h-5 mb-1" />
                    <span className="text-xs">No data available</span>
                </div>
            )}
        </div>
    );
};

// Site Detail View Component
const SiteDetailView = ({ site, apiKey, onBack }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dateRange, setDateRange] = useState(() => {
        try { return sessionStorage.getItem(LS_KEYS.DETAIL_DATE_RANGE) || '28'; }
        catch { return '28'; }
    });
    const [selectedMetric, setSelectedMetric] = useState('impressions');
    const [activeDetailMetrics, setActiveDetailMetrics] = useState(() => {
        try {
            const saved = sessionStorage.getItem(LS_KEYS.DETAIL_ACTIVE_METRICS);
            return saved ? JSON.parse(saved) : ['impressions'];
        } catch { return ['impressions']; }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [detailData, setDetailData] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef(null);

    useEffect(() => {
        try { sessionStorage.setItem(LS_KEYS.DETAIL_DATE_RANGE, dateRange); } catch { }
    }, [dateRange]);

    useEffect(() => {
        try { sessionStorage.setItem(LS_KEYS.DETAIL_ACTIVE_METRICS, JSON.stringify(activeDetailMetrics)); } catch { }
    }, [activeDetailMetrics]);

    const dateRangeOptions = [
        { value: '7', label: 'Last 7 days' },
        { value: '28', label: 'Last 28 days' },
        { value: '90', label: 'Last 3 months' },
    ];

    const metricOptions = [
        { id: 'clicks', label: 'Clicks', icon: MousePointerClick, color: 'text-emerald-600' },
        { id: 'impressions', label: 'Impressions', icon: Eye, color: 'text-orange-600' },
        { id: 'ctr', label: 'CTR', icon: Percent, color: 'text-amber-600' },
    ];

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'queries', label: 'Queries' },
        { id: 'pages', label: 'Pages' },
    ];

    const fetchDetailData = useCallback(async () => {
        if (!site?.siteUrl || !apiKey) return;
        setIsLoading(true);
        try {
            // Fetch queries
            const queriesRes = await fetch(`/api/webmaster-api?service=bing&action=getStats&apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(site.siteUrl)}`);
            let queries = [];
            if (queriesRes.ok) {
                const data = await queriesRes.json();
                const raw = data.d || data.queries || [];
                const queryMap = new Map();
                raw.forEach(row => {
                    const q = row.Query || row.query || '';
                    if (!q) return;
                    if (queryMap.has(q)) {
                        const e = queryMap.get(q);
                        e.clicks += row.Clicks || row.clicks || 0;
                        e.impressions += row.Impressions || row.impressions || 0;
                    } else {
                        queryMap.set(q, { keys: [q], clicks: row.Clicks || row.clicks || 0, impressions: row.Impressions || row.impressions || 0 });
                    }
                });
                queries = Array.from(queryMap.values()).map(q => ({ ...q, ctr: q.impressions > 0 ? (q.clicks / q.impressions) : 0 })).sort((a, b) => b.impressions - a.impressions);
            }

            // Fetch pages
            const pagesRes = await fetch(`/api/webmaster-api?service=bing&action=getPageStats&apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(site.siteUrl)}`);
            let pages = [];
            if (pagesRes.ok) {
                const data = await pagesRes.json();
                const raw = data.d || data.pages || [];
                const pageMap = new Map();
                raw.forEach(p => {
                    const url = p.Query || p.query || p.Url || p.url || '';
                    if (!url) return;
                    if (pageMap.has(url)) {
                        const e = pageMap.get(url);
                        e.clicks += p.Clicks || p.clicks || 0;
                        e.impressions += p.Impressions || p.impressions || 0;
                    } else {
                        pageMap.set(url, { keys: [url], clicks: p.Clicks || p.clicks || 0, impressions: p.Impressions || p.impressions || 0 });
                    }
                });
                pages = Array.from(pageMap.values()).map(pg => ({ ...pg, ctr: pg.impressions > 0 ? (pg.clicks / pg.impressions) : 0 })).sort((a, b) => b.impressions - a.impressions);
            }

            setDetailData({ queries, pages });
        } catch (err) {
            console.error('Error fetching detail data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [site?.siteUrl, apiKey]);

    useEffect(() => { fetchDetailData(); }, [fetchDetailData]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totals = useMemo(() => {
        if (!detailData) return { clicks: 0, impressions: 0, ctr: 0 };
        const queries = detailData.queries || [];
        const clicks = queries.reduce((s, q) => s + (q.clicks || 0), 0);
        const impressions = queries.reduce((s, q) => s + (q.impressions || 0), 0);
        return { clicks, impressions, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0 };
    }, [detailData]);

    return (
        <div className="bulk-page">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <img src={getFaviconUrl(site.siteUrl)} alt="" className="w-10 h-10 rounded-lg bg-gray-100" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{getSiteDisplayName(site.siteUrl)}</h1>
                            <p className="text-gray-500">{site.siteUrl?.replace(/^https?:\/\//, '')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Metric Toggle Buttons */}
                    <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-1">
                        {metricOptions.map((metric) => {
                            const isActive = activeDetailMetrics.includes(metric.id);
                            const toggleMetric = () => {
                                if (isActive && activeDetailMetrics.length > 1) {
                                    setActiveDetailMetrics(activeDetailMetrics.filter(m => m !== metric.id));
                                } else if (!isActive) {
                                    setActiveDetailMetrics([...activeDetailMetrics, metric.id]);
                                }
                                if (!isActive) setSelectedMetric(metric.id);
                            };
                            return (
                                <button key={metric.id} onClick={toggleMetric}
                                    className={`p-2 rounded-md transition-all group relative ${isActive ? 'bg-white shadow-sm ' + metric.color : 'text-gray-500 hover:text-gray-700'}`}
                                    title={metric.label}>
                                    <metric.icon className="w-4 h-4" />
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1" />

                    {/* Date Range Picker */}
                    <div className="relative" ref={datePickerRef}>
                        <button onClick={() => setShowDatePicker(!showDatePicker)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white hover:bg-gray-50">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>{dateRangeOptions.find(opt => opt.value === dateRange)?.label}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        {showDatePicker && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                                {dateRangeOptions.map((opt) => (
                                    <button key={opt.value} onClick={() => { setDateRange(opt.value); setShowDatePicker(false); }}
                                        className={`w-full px-4 py-2 text-left text-sm ${dateRange === opt.value ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* Overview Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-orange-100 rounded-lg"><Eye className="w-5 h-5 text-orange-600" /></div>
                                            <span className="text-gray-500 font-medium">Impressions</span>
                                        </div>
                                        <div className="text-3xl font-bold text-gray-900">{formatNumber(totals.impressions)}</div>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-emerald-100 rounded-lg"><MousePointerClick className="w-5 h-5 text-emerald-600" /></div>
                                            <span className="text-gray-500 font-medium">Clicks</span>
                                        </div>
                                        <div className="text-3xl font-bold text-gray-900">{formatNumber(totals.clicks)}</div>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-amber-100 rounded-lg"><Percent className="w-5 h-5 text-amber-600" /></div>
                                            <span className="text-gray-500 font-medium">CTR</span>
                                        </div>
                                        <div className="text-3xl font-bold text-gray-900">{totals.ctr.toFixed(2)}%</div>
                                    </div>
                                </div>

                                {/* Performance Chart */}
                                {site.data?.dailyData && (
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <h3 className="font-semibold text-gray-900 mb-4">Performance Over Time</h3>
                                        <div className="h-80">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={site.data.dailyData}>
                                                    <defs>
                                                        <linearGradient id="bingImpressionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#df3c27" stopOpacity={0.2} />
                                                            <stop offset="100%" stopColor="#df3c27" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="bingClicksGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px' }} />
                                                    <Legend />
                                                            <Area type="monotone" dataKey="impressions" stroke="#df3c27" strokeWidth={2} fill="url(#bingImpressionsGradient)" name="Impressions" />
                                                    <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fill="url(#bingClicksGradient)" name="Clicks" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Top Queries Section */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">Top Queries</h3>
                                    <div className="space-y-2">
                                        {(detailData?.queries || []).slice(0, 10).map((q, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
                                                <span className="text-sm text-gray-900 truncate flex-1">{q.keys[0]}</span>
                                                <span className="text-sm font-medium text-orange-600 ml-4">{formatNumber(q.impressions)}</span>
                                                <span className="text-sm text-gray-500 ml-4 w-16 text-right">{formatNumber(q.clicks)} clicks</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top Pages Section */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">Top Pages</h3>
                                    <div className="space-y-2">
                                        {(detailData?.pages || []).slice(0, 10).map((p, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg">
                                                <span className="text-sm text-orange-600 truncate flex-1">{p.keys[0]}</span>
                                                <span className="text-sm font-medium text-gray-700 ml-4">{formatNumber(p.impressions)}</span>
                                                <span className="text-sm text-gray-500 ml-4 w-16 text-right">{formatNumber(p.clicks)} clicks</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'queries' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(detailData?.queries || []).map((q, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{q.keys[0]}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(q.clicks)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(q.impressions)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{(q.ctr * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'pages' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(detailData?.pages || []).map((p, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm font-medium text-orange-600 truncate max-w-md">{p.keys[0]}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(p.clicks)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(p.impressions)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{(p.ctr * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Main Bing Bulk Analysis Page Component
const BingBulkAnalysisPage = () => {
    const navigate = useNavigate();
    const { siteId } = useParams();
    useAuth();

    // API Key State
    const [apiKey, setApiKey] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);

    // Sites State
    const [sites, setSites] = useState([]);
    const [sitesData, setSitesData] = useState({});
    const [isLoadingSites, setIsLoadingSites] = useState(false);
    const [loadingStates, setLoadingStates] = useState({});
    const [error, setError] = useState('');

    // UI State with sessionStorage persistence
    const [viewMode, setViewMode] = useState(() => {
        try { return sessionStorage.getItem(LS_KEYS.VIEW_MODE) || 'grid'; } catch { return 'grid'; }
    });
    const [activeMetrics, setActiveMetrics] = useState(() => {
        try {
            const saved = sessionStorage.getItem(LS_KEYS.ACTIVE_METRICS);
            return saved ? JSON.parse(saved) : ['impressions'];
        } catch { return ['impressions']; }
    });
    const [mainDateRange, setMainDateRange] = useState(() => {
        try { return sessionStorage.getItem(LS_KEYS.DATE_RANGE) || '28'; } catch { return '28'; }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('impressions');
    const [selectedSite, setSelectedSite] = useState(null);

    // Persist to sessionStorage
    useEffect(() => { try { sessionStorage.setItem(LS_KEYS.VIEW_MODE, viewMode); } catch { } }, [viewMode]);
    useEffect(() => { try { sessionStorage.setItem(LS_KEYS.ACTIVE_METRICS, JSON.stringify(activeMetrics)); } catch { } }, [activeMetrics]);
    useEffect(() => { try { sessionStorage.setItem(LS_KEYS.DATE_RANGE, mainDateRange); } catch { } }, [mainDateRange]);

    // Load API key on mount
    useEffect(() => {
        try {
            const savedKey = sessionStorage.getItem(BING_KEY_STORAGE);
            if (savedKey) { setApiKey(savedKey); setIsConfigured(true); }
        } catch { }
    }, []);

    // Fetch sites when configured
    useEffect(() => {
        if (isConfigured && apiKey) fetchSites();
    }, [isConfigured]);

    // Handle siteId from URL
    useEffect(() => {
        if (siteId && sites.length > 0) {
            const decodedSiteId = decodeURIComponent(siteId);
            const site = sites.find(s => s.siteUrl === decodedSiteId || s.Url === decodedSiteId);
            if (site) setSelectedSite({ siteUrl: site.Url || site.siteUrl || site, data: sitesData[site.Url || site.siteUrl || site] });
        }
    }, [siteId, sites, sitesData]);

    const saveApiKey = () => {
        if (!apiKey.trim()) { setError('Please enter a valid API key'); return; }
        sessionStorage.setItem(BING_KEY_STORAGE, apiKey.trim());
        setIsConfigured(true);
        setError('');
        fetchSites();
    };

    const clearApiKey = () => {
        sessionStorage.removeItem(BING_KEY_STORAGE);
        setApiKey('');
        setIsConfigured(false);
        setSites([]);
        setSitesData({});
    };

    const fetchSites = async () => {
        if (!apiKey) return;
        setIsLoadingSites(true);
        setError('');
        try {
            const res = await fetch(`/api/webmaster-api?service=bing&action=getSites&apikey=${encodeURIComponent(apiKey)}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) { setIsConfigured(false); throw new Error('Invalid API key'); }
                throw new Error('Failed to fetch sites');
            }
            const data = await res.json();
            const siteList = (data.d || data.sites || []).map(s => ({ siteUrl: s.Url || s.url || s, Url: s.Url || s.url || s }));
            setSites(siteList);
            // Fetch data for each site
            siteList.forEach(site => fetchSiteData(site.siteUrl));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoadingSites(false);
        }
    };

    const fetchSiteData = async (siteUrl) => {
        setLoadingStates(prev => ({ ...prev, [siteUrl]: true }));
        try {
            const res = await fetch(`/api/webmaster-api?service=bing&action=getStats&apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            const raw = data.d || data.queries || [];
            // Aggregate totals
            let clicks = 0, impressions = 0;
            const dailyMap = new Map();
            raw.forEach(row => {
                clicks += row.Clicks || row.clicks || 0;
                impressions += row.Impressions || row.impressions || 0;
                const rawDate = row.Date || row.date || 'Unknown';
                const date = parseBingDate(rawDate);
                if (!dailyMap.has(date)) dailyMap.set(date, { date, clicks: 0, impressions: 0, rawDate });
                const d = dailyMap.get(date);
                d.clicks += row.Clicks || row.clicks || 0;
                d.impressions += row.Impressions || row.impressions || 0;
            });
            const dailyData = Array.from(dailyMap.values()).map(d => ({ ...d, ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0 })).sort((a, b) => {
                // Sort by raw date if available, otherwise by formatted date
                const aDate = a.rawDate || a.date;
                const bDate = b.rawDate || b.date;
                return aDate.localeCompare(bDate);
            });
            setSitesData(prev => ({ ...prev, [siteUrl]: { clicks, impressions, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, dailyData } }));
        } catch { }
        finally { setLoadingStates(prev => ({ ...prev, [siteUrl]: false })); }
    };

    const mainMetricOptions = [
        { id: 'clicks', label: 'Clicks', icon: MousePointerClick, color: 'text-emerald-600' },
        { id: 'impressions', label: 'Impressions', icon: Eye, color: 'text-orange-600' },
        { id: 'ctr', label: 'CTR', icon: Percent, color: 'text-amber-600' },
    ];

    const toggleMetric = (metricId) => {
        if (activeMetrics.includes(metricId)) {
            if (activeMetrics.length > 1) setActiveMetrics(activeMetrics.filter(m => m !== metricId));
        } else {
            setActiveMetrics([...activeMetrics, metricId]);
        }
    };

    const filteredSites = useMemo(() => {
        let result = sites;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s => (s.siteUrl || s.Url || '').toLowerCase().includes(q));
        }
        // Sort sites
        result = [...result].sort((a, b) => {
            const aUrl = a.siteUrl || a.Url || '';
            const bUrl = b.siteUrl || b.Url || '';
            const aData = sitesData[aUrl] || {};
            const bData = sitesData[bUrl] || {};
            if (sortBy === 'impressions') return (bData.impressions || 0) - (aData.impressions || 0);
            if (sortBy === 'clicks') return (bData.clicks || 0) - (aData.clicks || 0);
            if (sortBy === 'name') return aUrl.localeCompare(bUrl);
            return 0;
        });
        return result;
    }, [sites, searchQuery, sortBy, sitesData]);

    const handleSiteClick = (site) => {
        const siteUrl = site.siteUrl || site.Url || site;
        setSelectedSite({ siteUrl, data: sitesData[siteUrl] });
        navigate(`/gsc/bing-bulk-analysis/${encodeURIComponent(siteUrl)}`);
    };

    const handleBack = () => {
        setSelectedSite(null);
        navigate('/gsc/bing-bulk-analysis');
    };

    // Detail View
    if (selectedSite) {
        return <SiteDetailView site={selectedSite} apiKey={apiKey} onBack={handleBack} />;
    }

    // API Key Setup UI
    if (!isConfigured) {
        return (
            <div className="bulk-page">
                <div className="connect-column">
                    <div className="bing-connect-hero">
                        <div className="bing-connect-title">
                            <BarChart3 className="h-5 w-5" />
                            <div>
                                <h1 className="font-display">Bing Bulk Analysis</h1>
                                <p>Connect your Bing Webmaster Tools to analyze search performance</p>
                            </div>
                        </div>
                    </div>
                    <div className="bing-connect-card">
                        <div className="text-center mb-6">
                            <span className="bing-connect-tile">
                                <Key className="h-5 w-5" />
                            </span>
                            <h2 className="bing-connect-heading font-display">Enter Your Bing API Key</h2>
                            <p className="bing-connect-hint">
                                Get your API key from <a href="https://www.bing.com/webmasters/apikey" target="_blank" rel="noopener noreferrer" className="bing-connect-link">Bing Webmaster Tools → Settings → API Access</a>
                            </p>
                        </div>
                        {error && (
                            <div className="app-alert app-alert-error mb-5">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Bing Webmaster API key"
                                className="bing-connect-input" />
                            <button onClick={saveApiKey} disabled={!apiKey.trim()}
                                className="ui-button ui-button-primary bing-connect-submit">
                                Connect Bing Webmaster
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main Sites Grid
    return (
        <div className="bulk-page">
            {/* Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-4 min-w-[140px]" />

                        <div className="absolute left-1/2 -translate-x-1/2">
                            <BulkAnalysisToggle />
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={fetchSites} className="p-2 hover:bg-gray-100 rounded-lg">
                                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoadingSites ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={clearApiKey} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                                Disconnect
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search websites..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                    </div>

                    {/* Sort Dropdown */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white">
                        <option value="impressions">Sort by Impressions</option>
                        <option value="clicks">Sort by Clicks</option>
                        <option value="name">Sort by Name</option>
                    </select>

                    {/* Metric Toggles */}
                    <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-1">
                        {mainMetricOptions.map((metric) => {
                            const isActive = activeMetrics.includes(metric.id);
                            return (
                                <button key={metric.id} onClick={() => toggleMetric(metric.id)}
                                    className={`p-2 rounded-md transition-all ${isActive ? 'bg-white shadow-sm ' + metric.color : 'text-gray-500 hover:text-gray-700'}`}
                                    title={metric.label}>
                                    <metric.icon className="w-4 h-4" />
                                </button>
                            );
                        })}
                    </div>

                    {/* View Mode */}
                    <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-1">
                        <button onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sites Grid */}
            <div className="px-4 sm:px-6 lg:px-8 pb-8">
                {isLoadingSites ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                ) : filteredSites.length === 0 ? (
                    <div className="text-center py-20">
                        <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No sites found</h3>
                        <p className="text-gray-500">Add sites in Bing Webmaster Tools to see them here</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'}>
                        {filteredSites.map((site) => (
                            <WebsiteCard key={site.siteUrl || site.Url}
                                site={{ siteUrl: site.siteUrl || site.Url, data: sitesData[site.siteUrl || site.Url] }}
                                onClick={() => handleSiteClick(site)}
                                isLoading={loadingStates[site.siteUrl || site.Url]}
                                activeMetrics={activeMetrics} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BingBulkAnalysisPage;
