import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
    ArrowLeft, Search, TrendingUp, TrendingDown, Minus, ExternalLink,
    LayoutGrid, List, AlertCircle, MousePointerClick, Eye, BarChart3, RefreshCw,
    Loader2, ChevronDown, Calendar, Percent, Target, LogOut
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import BulkAnalysisToggle from './BulkAnalysisToggle';

// Yandex OAuth Configuration
const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID || '';
const YANDEX_ROUTE = '/gsc/yandex-bulk-analysis';

function getAuthUserId(user) {
    return user?.uid || user?.id || null;
}

// Session storage keys for persisting user preferences
const LS_KEYS = {
    ACTIVE_METRICS: 'yandexBulkAnalysis_activeMetrics',
    DATE_RANGE: 'yandexBulkAnalysis_dateRange',
    VIEW_MODE: 'yandexBulkAnalysis_viewMode',
    DETAIL_ACTIVE_METRICS: 'yandexBulkAnalysis_detailActiveMetrics',
    DETAIL_DATE_RANGE: 'yandexBulkAnalysis_detailDateRange',
};

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
                <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 text-xs min-w-40">
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
                        {activeMetrics.includes('position') && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span className="text-gray-600">Avg. Pos</span>
                                </div>
                                <span className="font-semibold text-gray-900">{(dataPoint.position || 0).toFixed(1)}</span>
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
            position: Math.max(...data.map(d => d.position || 0)) || 0,
        };
        return data.map(d => ({
            ...d,
            clicksNorm: ((d.clicks || 0) / maxValues.clicks) * 100,
            impressionsNorm: ((d.impressions || 0) / maxValues.impressions) * 100,
            ctrNorm: ((d.ctr || 0) / maxValues.ctr) * 100,
            positionNorm: maxValues.position > 0
                ? 100 - ((d.position || 0) / maxValues.position) * 100
                : 0,
        }));
    };

    const normalizedData = normalizeData();

    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={normalizedData} margin={{ top: 5, right: 2, left: 2, bottom: 0 }}>
                <defs>
                    <linearGradient id="yandexGradientClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="yandexGradientImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#df3c27" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#df3c27" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="yandexGradientCtr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="yandexGradientPosition" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" hide={true} />
                <YAxis domain={[0, 100]} hide={true} />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                <Tooltip content={<CustomTooltip />} />
                {activeMetrics.includes('impressions') && (
                        <Area type="monotone" dataKey="impressionsNorm" stroke="#df3c27" strokeWidth={2}
                        fill="url(#yandexGradientImpressions)" dot={false}
                            activeDot={{ r: 3, fill: '#df3c27', stroke: '#fff', strokeWidth: 1 }} />
                )}
                {activeMetrics.includes('clicks') && (
                    <Area type="monotone" dataKey="clicksNorm" stroke="#10b981" strokeWidth={2}
                        fill="url(#yandexGradientClicks)" dot={false}
                        activeDot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }} />
                )}
                {activeMetrics.includes('ctr') && (
                    <Area type="monotone" dataKey="ctrNorm" stroke="#f59e0b" strokeWidth={2}
                        fill="url(#yandexGradientCtr)" dot={false}
                        activeDot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1 }} />
                )}
                {activeMetrics.includes('position') && (
                    <Area type="monotone" dataKey="positionNorm" stroke="#a855f7" strokeWidth={2}
                        fill="url(#yandexGradientPosition)" dot={false}
                        activeDot={{ r: 3, fill: '#a855f7', stroke: '#fff', strokeWidth: 1 }} />
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
    const hasData = !!site.data;
    const displayName = site.unicode_host_url || site.ascii_host_url || 'Unknown';

    return (
        <div onClick={onClick}
            className="group relative bg-white rounded-2xl border-2 border-gray-100 hover:border-red-200 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden">
            <div className="p-4 pb-2">
                <div className="flex items-start gap-3">
                    <img src={getFaviconUrl(displayName)} alt=""
                        className="w-10 h-10 rounded-lg bg-gray-100 object-contain"
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444"><circle cx="12" cy="12" r="10"/></svg>'; }} />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{getSiteDisplayName(displayName)}</h3>
                        <p className="text-xs text-gray-500 truncate">{displayName.replace(/^https?:\/\//, '')}</p>
                    </div>
                </div>
            </div>
            {isLoading ? (
                <div className="p-4 pt-2 flex items-center justify-center h-24">
                    <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
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
const SiteDetailView = ({ site, accessToken, yandexUserId, onBack }) => {
    const { user } = useAuth();
    const authUserId = getAuthUserId(user);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dateRange, setDateRange] = useState(() => {
        try { return sessionStorage.getItem(LS_KEYS.DETAIL_DATE_RANGE) || '30'; }
        catch { return '30'; }
    });
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
        { value: '30', label: 'Last 30 days' },
        { value: '90', label: 'Last 3 months' },
    ];

    const metricOptions = [
        { id: 'clicks', label: 'Clicks', icon: MousePointerClick, color: 'text-emerald-600' },
        { id: 'impressions', label: 'Impressions', icon: Eye, color: 'text-red-600' },
        { id: 'ctr', label: 'CTR', icon: Percent, color: 'text-amber-600' },
        { id: 'position', label: 'Avg. Pos', icon: Target, color: 'text-purple-600' },
    ];

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'queries', label: 'Queries' },
        { id: 'pages', label: 'Pages' },
    ];

    // Helper to parse Yandex search-queries/popular response
    const parseYandexQueryResponse = (data) => {
        const queries = data.queries || [];
        return queries.map(q => {
            const indicators = q.indicators || {};
            return {
                query: q.query_text || 'Unknown',
                impressions: indicators.TOTAL_SHOWS || 0,
                clicks: indicators.TOTAL_CLICKS || 0,
                ctr: indicators.TOTAL_SHOWS ? ((indicators.TOTAL_CLICKS || 0) / indicators.TOTAL_SHOWS) * 100 : 0,
                position: indicators.AVG_SHOW_POSITION || 0
            };
        });
    };

    const fetchDetailData = useCallback(async () => {
        if (!site?.host_id || !authUserId) return;
        setIsLoading(true);
        try {
            // Calculate days from date range
            const days = dateRange === '7' ? 7 : (dateRange === '90' ? 90 : 30);

            // Fetch top queries
            const queriesRes = await fetch('/api/webmaster-api?service=yandex&action=getTopQueries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: authUserId,
                    hostId: site.host_id,
                    body: { days, limit: 50 }
                })
            });

            let queries = [];
            if (queriesRes.ok) {
                const data = await queriesRes.json();
                queries = parseYandexQueryResponse(data);
            }

            // Fetch top pages (Yandex query analytics for URLs)
            const pagesRes = await fetch('/api/webmaster-api?service=yandex&action=getTopPages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: authUserId,
                    hostId: site.host_id,
                    body: { days, limit: 50 }
                })
            });

            let pages = [];
            if (pagesRes.ok) {
                const data = await pagesRes.json();
                const items = data.text_indicator_to_statistics || [];
                const pageMap = new Map();

                items.forEach((item) => {
                    const url = item?.text_indicator?.value;
                    if (!url) return;
                    if (!pageMap.has(url)) {
                        pageMap.set(url, {
                            url,
                            clicks: 0,
                            impressions: 0,
                            positionSum: 0,
                            positionCount: 0
                        });
                    }
                    const entry = pageMap.get(url);
                    (item.statistics || []).forEach((stat) => {
                        const field = stat?.field;
                        const value = Number(stat?.value || 0);
                        if (field === 'CLICKS') entry.clicks += value;
                        if (field === 'IMPRESSIONS') entry.impressions += value;
                        if (field === 'POSITION') {
                            entry.positionSum += value;
                            entry.positionCount += 1;
                        }
                    });
                });

                pages = Array.from(pageMap.values()).map((p) => ({
                    url: p.url,
                    clicks: p.clicks,
                    impressions: p.impressions,
                    ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
                    position: p.positionCount > 0 ? p.positionSum / p.positionCount : 0
                })).sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
            }

            setDetailData({ queries, pages });
        } catch (err) {
            console.error('Error fetching detail data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [site?.host_id, authUserId, dateRange]);

    useEffect(() => { fetchDetailData(); }, [fetchDetailData]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target)) setShowDatePicker(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totals = useMemo(() => {
        if (!site.data) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        return {
            clicks: site.data.clicks,
            impressions: site.data.impressions,
            ctr: site.data.ctr,
            position: site.data.position
        };
    }, [site]);

    const pagesHaveMetrics = useMemo(() => {
        return (detailData?.pages || []).some(p =>
            p.clicks != null || p.impressions != null || p.ctr != null || p.position != null
        );
    }, [detailData]);

    const displayName = site.unicode_host_url || site.ascii_host_url || 'Unknown';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <img src={getFaviconUrl(displayName)} alt="" className="w-10 h-10 rounded-lg bg-gray-100" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{getSiteDisplayName(displayName)}</h1>
                            <p className="text-gray-500">{displayName.replace(/^https?:\/\//, '')}</p>
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
                            };
                            return (
                                <button key={metric.id} onClick={toggleMetric}
                                    className={`p-2 rounded-md transition-all group relative cursor-pointer ${isActive ? 'bg-white shadow-sm ' + metric.color : 'text-gray-500 hover:text-gray-700'}`}
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
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 cursor-pointer">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>{dateRangeOptions.find(opt => opt.value === dateRange)?.label}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        {showDatePicker && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                                {dateRangeOptions.map((opt) => (
                                    <button key={opt.value} onClick={() => { setDateRange(opt.value); setShowDatePicker(false); }}
                                        className={`w-full px-4 py-2 text-left text-sm cursor-pointer ${dateRange === opt.value ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
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
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* Overview Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-red-100 rounded-lg"><Eye className="w-5 h-5 text-red-600" /></div>
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
                                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg"><Target className="w-5 h-5 text-purple-600" /></div>
                                            <span className="text-gray-500 font-medium">Avg Position</span>
                                        </div>
                                        <div className="text-3xl font-bold text-gray-900">{totals.position.toFixed(1)}</div>
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
                                                        <linearGradient id="yandexImpressionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#df3c27" stopOpacity={0.2} />
                                                            <stop offset="100%" stopColor="#df3c27" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="yandexClicksGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                                                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px' }} />
                                                    <Legend />
                                                            <Area type="monotone" dataKey="impressions" stroke="#df3c27" strokeWidth={2} fill="url(#yandexImpressionsGradient)" name="Impressions" />
                                                    <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fill="url(#yandexClicksGradient)" name="Clicks" />
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
                                                <span className="text-sm text-gray-900 truncate flex-1">{q.query || 'Unknown'}</span>
                                                <span className="text-sm font-medium text-red-600 ml-4">{formatNumber(q.impressions)}</span>
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
                                                <span className="text-sm text-red-600 truncate flex-1">{p.url || 'Unknown'}</span>
                                                {pagesHaveMetrics && (
                                                    <>
                                                        <span className="text-sm font-medium text-gray-700 ml-4">{formatNumber(p.impressions || 0)}</span>
                                                        <span className="text-sm text-gray-500 ml-4 w-16 text-right">{formatNumber(p.clicks || 0)} clicks</span>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {!pagesHaveMetrics && (
                                        <p className="text-xs text-gray-500 mt-4">
                                            Yandex API provides URL samples here (metrics aren’t available for pages).
                                        </p>
                                    )}
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
                                            <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Pos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(detailData?.queries || []).map((q, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{q.query}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(q.clicks)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(q.impressions)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{(q.ctr).toFixed(2)}%</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-right">{q.position.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'pages' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                {pagesHaveMetrics ? (
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Pos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(detailData?.pages || []).map((p, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm font-medium text-red-600 truncate max-w-md">{p.url}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(p.clicks || 0)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatNumber(p.impressions || 0)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{(p.ctr || 0).toFixed(2)}%</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{(p.position || 0).toFixed(1)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6">
                                        <div className="space-y-2">
                                            {(detailData?.pages || []).map((p, i) => (
                                                <div key={i} className="py-2 px-3 hover:bg-gray-50 rounded-lg">
                                                    <span className="text-sm text-red-600 truncate block">{p.url || 'Unknown'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-4">
                                            Yandex API returns page URL samples here (no per‑page clicks/impressions).
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Yandex Connect Screen Component
const YandexConnectScreen = ({ onConnect, isLoading }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
                    <div className="text-center mb-8">
                        {/* Yandex Logo */}
                        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm11.5-7h-3v14h2v-6h.5l2.5 6h2.2l-2.7-6.2c1.5-.4 2.5-1.7 2.5-3.3 0-2.5-1.8-4.5-4-4.5zm-1 6V7h1c1.1 0 2 .9 2 2s-.9 2-2 2h-1z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Yandex Webmaster</h1>
                        <p className="text-gray-500">Analyze your Yandex search performance across all your websites</p>
                    </div>

                    <button
                        onClick={onConnect}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 transition-all cursor-pointer shadow-lg hover:shadow-xl"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm11.5-7h-3v14h2v-6h.5l2.5 6h2.2l-2.7-6.2c1.5-.4 2.5-1.7 2.5-3.3 0-2.5-1.8-4.5-4-4.5zm-1 6V7h1c1.1 0 2 .9 2 2s-.9 2-2 2h-1z" />
                                </svg>
                                Login with Yandex
                            </>
                        )}
                    </button>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">
                            By connecting, you authorize access to your Yandex Webmaster data
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Yandex Bulk Analysis Page Component
const YandexBulkAnalysisPage = () => {
    const navigate = useNavigate();
    const { siteId } = useParams();
    const { user, loading: isAuthLoading } = useAuth();
    const authUserId = getAuthUserId(user);

    // Auth State
    const [accessToken, setAccessToken] = useState(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [yandexEmail, setYandexEmail] = useState(null);
    const [yandexUserId, setYandexUserId] = useState(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Sites State
    const [sites, setSites] = useState([]);
    const [isLoadingSites, setIsLoadingSites] = useState(false);
    const [loadingStates, setLoadingStates] = useState({});
    const [error, setError] = useState('');

    // UI State with sessionStorage persistence
    const [activeMetrics, setActiveMetrics] = useState(() => {
        try {
            const saved = sessionStorage.getItem(LS_KEYS.ACTIVE_METRICS);
            return saved ? JSON.parse(saved) : ['impressions'];
        } catch { return ['impressions']; }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('impressions');
    const [selectedSite, setSelectedSite] = useState(null);

    // Persist to sessionStorage
    useEffect(() => { try { sessionStorage.setItem(LS_KEYS.ACTIVE_METRICS, JSON.stringify(activeMetrics)); } catch { } }, [activeMetrics]);

    // Check for saved Yandex connection
    useEffect(() => {
        // Wait for auth to finish loading before processing
        if (isAuthLoading) return;

        const checkConnection = async () => {
            // Check URL for OAuth callback first
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state === 'yandex_bulk_analysis_oauth') {
                // Need user to be logged in for token exchange
                if (!authUserId) {
                    setError('Please log in to connect Yandex.');
                    window.history.replaceState({}, document.title, YANDEX_ROUTE);
                    setIsCheckingAuth(false);
                    return;
                }

                // Exchange code for tokens
                try {
                    const response = await fetch('/api/webmaster-api?service=yandex&action=oauth-exchange', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code,
                            userId: authUserId,
                            redirectUri: window.location.origin + YANDEX_ROUTE
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.accessToken) {
                            setAccessToken(data.accessToken);
                            setIsSignedIn(true);
                            setYandexEmail(data.yandexEmail);
                            setYandexUserId(data.yandexUserId);
                        }
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('OAuth exchange failed:', errorData);
                        setError(errorData.error || 'Failed to connect Yandex account.');
                    }
                } catch (err) {
                    console.error('Yandex OAuth exchange error:', err);
                    setError('Failed to connect Yandex account.');
                }
                // Clean URL
                window.history.replaceState({}, document.title, YANDEX_ROUTE);
                setIsCheckingAuth(false);
                return;
            }

            // Check server for saved token (only if user is loaded)
            if (authUserId) {
                try {
                    const response = await fetch('/api/webmaster-api?service=yandex&action=oauth-get', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: authUserId })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.connected && data.accessToken) {
                            setAccessToken(data.accessToken);
                            setIsSignedIn(true);
                            setYandexEmail(data.yandexEmail);
                            setYandexUserId(data.yandexUserId);
                            setIsCheckingAuth(false);
                            return;
                        }
                    }
                } catch (err) {
                    console.error('Error checking Yandex connection:', err);
                }
            }

            setIsCheckingAuth(false);
        };

        checkConnection();
    }, [authUserId, isAuthLoading]);

    // Fetch sites when signed in
    useEffect(() => {
        if (accessToken && isSignedIn && yandexUserId) {
            fetchSites();
        }
    }, [accessToken, isSignedIn, yandexUserId]);

    const fetchSites = async () => {
        if (!authUserId || !accessToken || !yandexUserId) return;
        setIsLoadingSites(true);
        setError('');
        try {
            const res = await fetch('/api/webmaster-api?service=yandex&action=getSites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: accessToken,
                    yandexUserId: yandexUserId
                })
            });
            if (!res.ok) {
                if (res.status === 401) {
                    handleSignOut();
                    throw new Error('Session expired. Please reconnect.');
                }
                throw new Error('Failed to fetch sites');
            }
            const data = await res.json();
            const siteList = (data.hosts || []).map((s) => ({ ...s, verified: s.verified }));

            setSites(siteList);
            // Fetch data for sites in batches to avoid timeout
            fetchSiteDataBatched(siteList);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoadingSites(false);
        }
    };

    // Fetch site data for all sites in parallel
    const fetchSiteDataBatched = async (sitesToFetch) => {
        const BATCH_SIZE = 25;
        for (let i = 0; i < sitesToFetch.length; i += BATCH_SIZE) {
            const batch = sitesToFetch.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(site => fetchSiteData(site)));
        }
    };

    const buildDailyDataFromHistory = (indicators) => {
        const dateMap = new Map();
        const addSeries = (series, key) => {
            (series || []).forEach((point) => {
                if (!point?.date) return;
                const date = point.date.includes('T') ? point.date.split('T')[0] : point.date;
                if (!dateMap.has(date)) {
                    dateMap.set(date, { date, clicks: 0, impressions: 0, ctr: 0, position: 0 });
                }
                const entry = dateMap.get(date);
                entry[key] = typeof point.value === 'number' ? point.value : Number(point.value || 0);
            });
        };

        addSeries(indicators?.TOTAL_SHOWS, 'impressions');
        addSeries(indicators?.TOTAL_CLICKS, 'clicks');
        addSeries(indicators?.AVG_SHOW_POSITION, 'position');

        const dailyData = Array.from(dateMap.values()).map((d) => ({
            ...d,
            ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
        }));

        dailyData.sort((a, b) => a.date.localeCompare(b.date));
        const toDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const todayStr = toDateString(today);
        const yesterdayStr = toDateString(yesterday);

        const filtered = dailyData.filter(d => d.date !== todayStr && d.date !== yesterdayStr);
        if (filtered.length > 0) return filtered;

        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() - 2);
        return [{
            date: toDateString(fallbackDate),
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
        }];
    };

    const fetchSiteData = async (site) => {
        if (!authUserId || !accessToken || !yandexUserId) return;
        setLoadingStates(prev => ({ ...prev, [site.host_id]: true }));

        try {
            const res = await fetch('/api/webmaster-api?service=yandex&action=getStats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: accessToken,
                    yandexUserId: yandexUserId,
                    hostId: site.host_id,
                    body: { days: 30 }
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error(`Failed to fetch stats for ${site.unicode_host_url || site.host_id}:`, res.status, errorData);
                return;
            }
            const data = await res.json();

            // Parse search-queries/all/history response format
            // Format: { indicators: { TOTAL_SHOWS: [{date,value}], TOTAL_CLICKS: [...], AVG_SHOW_POSITION: [...] } }
            const indicators = data.indicators || {};
            const dailyData = buildDailyDataFromHistory(indicators);

            const clicks = dailyData.reduce((sum, d) => sum + (d.clicks || 0), 0);
            const impressions = dailyData.reduce((sum, d) => sum + (d.impressions || 0), 0);
            const positionValues = dailyData.filter(d => d.position > 0).map(d => d.position);
            const position = positionValues.length > 0
                ? positionValues.reduce((sum, v) => sum + v, 0) / positionValues.length
                : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

            setSites(prev => prev.map(s =>
                s.host_id === site.host_id ? { ...s, data: { clicks, impressions, ctr, position, dailyData } } : s
            ));

        } catch (err) {
            console.error(`Error fetching data for ${site.unicode_host_url || site.host_id}:`, err);
        }
        finally { setLoadingStates(prev => ({ ...prev, [site.host_id]: false })); }
    };

    const handleSignIn = () => {
        if (!YANDEX_CLIENT_ID) {
            setError('Yandex OAuth client ID is not configured.');
            return;
        }
        const redirectUri = encodeURIComponent(window.location.origin + YANDEX_ROUTE);
        const authUrl = `https://oauth.yandex.com/authorize?` +
            `response_type=code` +
            `&client_id=${YANDEX_CLIENT_ID}` +
            `&redirect_uri=${redirectUri}` +
            `&state=yandex_bulk_analysis_oauth`;

        window.location.href = authUrl;
    };

    const handleSignOut = async () => {
        if (authUserId) {
            try {
                await fetch('/api/webmaster-api?service=yandex&action=oauth-disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: authUserId })
                });
            } catch (err) {
                console.error('Failed to disconnect Yandex:', err);
            }
        }
        setAccessToken(null);
        setIsSignedIn(false);
        setYandexEmail(null);
        setYandexUserId(null);
        setSites([]);
    };

    const mainMetricOptions = [
        { id: 'clicks', label: 'Clicks', icon: MousePointerClick, color: 'text-emerald-600' },
        { id: 'impressions', label: 'Impressions', icon: Eye, color: 'text-red-600' },
        { id: 'ctr', label: 'CTR', icon: Percent, color: 'text-amber-600' },
        { id: 'position', label: 'Avg. Pos', icon: Target, color: 'text-purple-600' },
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
            result = result.filter(s => (s.unicode_host_url || s.ascii_host_url || '').toLowerCase().includes(q));
        }
        // Sort sites
        result = [...result].sort((a, b) => {
            const aData = a.data || {};
            const bData = b.data || {};
            if (sortBy === 'impressions') return (bData.impressions || 0) - (aData.impressions || 0);
            if (sortBy === 'clicks') return (bData.clicks || 0) - (aData.clicks || 0);
            if (sortBy === 'name') return (a.unicode_host_url || a.ascii_host_url || '').localeCompare(b.unicode_host_url || b.ascii_host_url || '');
            return 0;
        });
        return result;
    }, [sites, searchQuery, sortBy]);

    const handleSiteClick = (site) => {
        setSelectedSite(site);
    };

    const handleBack = () => {
        setSelectedSite(null);
    };

    // Loading state
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            </div>
        );
    }

    // Not signed in - show connect screen
    if (!isSignedIn) {
        return <YandexConnectScreen onConnect={handleSignIn} isLoading={false} />;
    }

    // Detail View
    if (selectedSite) {
        return <SiteDetailView site={selectedSite} accessToken={accessToken} yandexUserId={yandexUserId} onBack={handleBack} />;
    }

    // Main Sites Grid
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-4 min-w-[140px]" />

                        <div className="absolute left-1/2 -translate-x-1/2">
                            <BulkAnalysisToggle />
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={fetchSites} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoadingSites ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={handleSignOut} className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg transition-colors cursor-pointer" title="Disconnect Yandex">
                                <LogOut className="w-5 h-5" />
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
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium bg-white cursor-pointer">
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
                                    className={`p-2 rounded-md transition-all group relative cursor-pointer ${isActive ? 'bg-white shadow-sm ' + metric.color : 'text-gray-500 hover:text-gray-700'}`}
                                    title={metric.label}>
                                    <metric.icon className="w-4 h-4" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {isLoadingSites ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSites.map((site) => (
                            <WebsiteCard key={site.host_id} site={site} onClick={() => handleSiteClick(site)} isLoading={loadingStates[site.host_id]} activeMetrics={activeMetrics} />
                        ))}
                        {!isLoadingSites && filteredSites.length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
                                No sites found. Add sites to your Yandex Webmaster account to see them here.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default YandexBulkAnalysisPage;
