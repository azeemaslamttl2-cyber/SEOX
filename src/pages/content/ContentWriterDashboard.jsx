import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { loadContentWriterProfile, saveContentWriterProfile } from '../../lib/contentWriterProfile.js';
import {
    Edit3, Zap, Layers, Plus, Clock, Trash2, CheckCircle, FileEdit, ArrowRight, Sparkles
} from 'lucide-react';

const ARTICLES_KEY = 'contentWriter_articles';

/* ── Metric tile component matching EeatAudit style ── */
function MetricTile({ value, label, sub, accent, dotColor }) {
    return (
        <div className="relative px-5 py-4 text-center border-r border-white/[0.04] last:border-r-0">
            <div className="flex items-center justify-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</span>
            </div>
            <div className={`mt-1 font-display text-2xl font-black ${accent}`}>{value}</div>
            <div className="text-[10px] text-white/25">{sub}</div>
        </div>
    );
}

/* ── Hero Gauge for Content Writer Dashboard ── */
function HeroGauge({ count, loading }) {
    return (
        <div className="flex flex-col items-center gap-2 lg:pr-4">
            <div className="relative flex h-32 w-32 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-2xl" />
                <svg width="128" height="128" className="-rotate-90 relative z-10">
                    <circle cx="64" cy="64" r="54" fill="none" stroke="#ffffff" strokeWidth="10" />
                    <circle
                        cx="64"
                        cy="64"
                        r="54"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 54}
                        strokeDashoffset={2 * Math.PI * 54 * (1 - Math.min(count, 20) / 20)}
                        style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))", transition: "stroke-dashoffset 0.5s ease" }}
                    />
                </svg>
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-black text-white">{loading ? "..." : count}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300">Articles</span>
                </div>
            </div>
            <span className="eeat-rating rounded-full bg-brand-500/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-300">
                {loading ? "Loading..." : count > 0 ? "Articles Saved" : "No Articles"}
            </span>
        </div>
    );
}

const ContentWriterDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.uid || user?.id;
    const [savedArticles, setSavedArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load saved articles from the local API, then fall back to session storage.
    useEffect(() => {
        const loadArticles = async () => {
            setLoading(true);
            if (userId) {
                try {
                    const data = await loadContentWriterProfile();
                    if (data) {
                        if (data.contentWriterArticles && data.contentWriterArticles.length > 0) {
                            setSavedArticles(data.contentWriterArticles);
                            sessionStorage.setItem(ARTICLES_KEY, JSON.stringify(data.contentWriterArticles));
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) { console.error('Error loading articles from local database:', e); }
            }
            try {
                const saved = sessionStorage.getItem(ARTICLES_KEY);
                if (saved) setSavedArticles(JSON.parse(saved));
            } catch (e) { console.error('Error loading articles:', e); }
            setLoading(false);
        };
        loadArticles();
    }, [userId]);

    // Delete article
    const deleteArticle = useCallback((articleId) => {
        if (!window.confirm('Delete this article?')) return;
        setSavedArticles(prev => {
            const updated = prev.filter(a => a.id !== articleId);
            try { sessionStorage.setItem(ARTICLES_KEY, JSON.stringify(updated)); } catch (e) { }
            // Sync to the local database.
            if (userId) {
                saveContentWriterProfile({ contentWriterArticles: updated, [`contentWriterStates_${articleId}`]: null })
                    .catch(e => console.error('Content profile delete error:', e));
            }
            return updated;
        });
        try { sessionStorage.removeItem(`contentWriter_${articleId}`); } catch (e) { }
    }, [userId]);

    // Navigate to editor with action
    const handleNewArticle = () => {
        navigate('/content/semantic-writer/editor?action=new');
    };

    const handleOpenArticle = (articleId) => {
        navigate(`/content/semantic-writer/editor?article=${articleId}`);
    };

    const draftArticles = savedArticles.filter(a => a.currentStep < 13);
    const completedArticles = savedArticles.filter(a => a.currentStep >= 13);

    const renderArticleCard = (article) => (
        <div
            key={article.id}
            className="group px-5 py-4 transition hover:bg-white/[0.02] border-b border-white/[0.03] last:border-b-0"
        >
            <div className="flex items-center justify-between gap-4">
                <button
                    onClick={() => handleOpenArticle(article.id)}
                    className="flex-1 flex items-start gap-4 text-left min-w-0"
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${article.mode === 'quick' ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-brand-500/15 ring-1 ring-brand-500/30'}`}>
                        {article.mode === 'quick'
                            ? <Zap className="w-5 h-5 text-amber-400" />
                            : <Layers className="w-5 h-5 text-brand-400" />
                        }
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-bold text-white/90 truncate group-hover:text-brand-300 transition">
                            {article.title || "Untitled Article"}
                        </h4>
                        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${article.mode === 'quick' ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' : 'bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20'}`}>
                                {article.mode === 'quick' ? '⚡ Quick Mode' : '🔬 Express Mode'}
                            </span>
                            <span className="text-[11px] text-white/35 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-white/20" />
                                {new Date(article.updatedAt).toLocaleDateString()}
                            </span>
                            {article.keyword && (
                                <span className="text-[11px] text-white/35">
                                    Keyword: <span className="font-semibold text-white/65">{article.keyword}</span>
                                </span>
                            )}
                            {article.currentStep < 13 ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20">
                                    Step {article.currentStep}/13
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Complete
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => handleOpenArticle(article.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/80 text-white transition hover:bg-brand-400 opacity-0 group-hover:opacity-100"
                        title="Open Article"
                    >
                        <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); deleteArticle(article.id); }}
                        className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition opacity-0 group-hover:opacity-100"
                        title="Delete Article"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl bg-white/[0.01] border border-white/[0.05] py-20">
                <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {/* ─────────── HERO: Split layout matching EeatAudit ─────────── */}
            <div className="eeat-hero relative overflow-hidden rounded-3xl border border-brand-600 bg-brand-500">
                {/* Background texture */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-500/[0.08] blur-[100px]" />
                    <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-amber-500/[0.05] blur-[80px]" />
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                        }}
                    />
                </div>

                <div className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-8">
                    {/* Left column */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
                                <Edit3 className="h-5 w-5 text-brand-400" />
                            </div>
                            <div>
                                <h1 className="font-display text-2xl font-black tracking-tight text-white">
                                    Semantic Content Writer
                                </h1>
                                <p className="text-xs text-white/40">
                                    AI-powered semantic content generation & SEO optimization engine
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center gap-3">
                            <button
                                onClick={handleNewArticle}
                                className="ui-button eeat-analyze-button rounded-xl flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> New Article
                            </button>
                        </div>
                    </div>

                    {/* Right column — Hero Gauge */}
                    <HeroGauge count={savedArticles.length} loading={loading} />
                </div>
            </div>

            {/* ─────────── Metric Strip ─────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <MetricTile
                    value={savedArticles.length}
                    label="Total Articles"
                    sub="saved drafts"
                    accent="text-brand-300"
                    dotColor="bg-brand-400"
                />
                <MetricTile
                    value={draftArticles.length}
                    label="In Progress"
                    sub="active drafts"
                    accent="text-amber-400"
                    dotColor="bg-amber-400"
                />
                <MetricTile
                    value={completedArticles.length}
                    label="Completed"
                    sub="ready articles"
                    accent="text-emerald-400"
                    dotColor="bg-emerald-400"
                />
                <MetricTile
                    value="Quick / Express"
                    label="AI Workflows"
                    sub="multi-step pipeline"
                    accent="text-sky-400"
                    dotColor="bg-sky-400"
                />
            </div>

            {/* Empty state */}
            {savedArticles.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.01] py-16 text-center px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
                        <FileEdit className="h-8 w-8 text-brand-400/40" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white/60">
                        No articles created yet
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-white/35">
                        Create your first SEO-optimized article using Quick or Express AI workflows.
                    </p>
                    <button
                        onClick={handleNewArticle}
                        className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40"
                    >
                        <Plus className="w-4 h-4" /> Start New Article
                    </button>
                </div>
            )}

            {/* In Progress / Draft Articles */}
            {draftArticles.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]">
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                                <FileEdit className="h-4.5 w-4.5" />
                            </div>
                            <div>
                                <div className="font-display text-sm font-bold text-white/90 flex items-center gap-2">
                                    In Progress
                                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-black text-amber-300 ring-1 ring-amber-500/30">
                                        {draftArticles.length}
                                    </span>
                                </div>
                                <div className="text-[11px] text-white/40">
                                    Articles currently in draft or optimization steps
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        {draftArticles.map(renderArticleCard)}
                    </div>
                </div>
            )}

            {/* Completed Articles */}
            {completedArticles.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.01]">
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                <CheckCircle className="h-4.5 w-4.5" />
                            </div>
                            <div>
                                <div className="font-display text-sm font-bold text-white/90 flex items-center gap-2">
                                    Completed Articles
                                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/30">
                                        {completedArticles.length}
                                    </span>
                                </div>
                                <div className="text-[11px] text-white/40">
                                    Fully optimized articles ready for publication
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        {completedArticles.map(renderArticleCard)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContentWriterDashboard;

