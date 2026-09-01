import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { db } from '../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
    Edit3, Zap, Layers, Plus, Clock, Trash2, CheckCircle, FileEdit, FolderOpen
} from 'lucide-react';

const ARTICLES_KEY = 'contentWriter_articles';

const ContentWriterDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.uid || user?.id;
    const [savedArticles, setSavedArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load saved articles (Firestore first, localStorage fallback)
    useEffect(() => {
        const loadArticles = async () => {
            setLoading(true);
            if (userId) {
                try {
                    const docRef = doc(db, 'project_data', userId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.contentWriterArticles && data.contentWriterArticles.length > 0) {
                            setSavedArticles(data.contentWriterArticles);
                            localStorage.setItem(ARTICLES_KEY, JSON.stringify(data.contentWriterArticles));
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) { console.error('Error loading articles from Firestore:', e); }
            }
            try {
                const saved = localStorage.getItem(ARTICLES_KEY);
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
            try { localStorage.setItem(ARTICLES_KEY, JSON.stringify(updated)); } catch (e) { }
            // Sync to Firestore
            if (userId) {
                const docRef = doc(db, 'project_data', userId);
                setDoc(docRef, { contentWriterArticles: updated, [`contentWriterStates_${articleId}`]: null }, { merge: true })
                    .catch(e => console.error('Firestore delete error:', e));
            }
            return updated;
        });
        try { localStorage.removeItem(`contentWriter_${articleId}`); } catch (e) { }
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
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all group"
        >
            <div className="flex items-center justify-between">
                <button
                    onClick={() => handleOpenArticle(article.id)}
                    className="flex-1 flex items-start gap-4 text-left"
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${article.mode === 'quick' ? 'bg-amber-500/15' : 'bg-brand-500/100/15'}`}>
                        {article.mode === 'quick'
                            ? <Zap className="w-5 h-5 text-amber-600" />
                            : <Layers className="w-5 h-5 text-brand-500" />
                        }
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white truncate group-hover:text-brand-500 transition">{article.title}</h4>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${article.mode === 'quick' ? 'bg-amber-500/15 text-amber-300' : 'bg-brand-500/100/15 text-brand-300'}`}>
                                {article.mode === 'quick' ? '⚡ Quick' : '🔬 Express'}
                            </span>
                            <span className="text-xs text-white/40 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(article.updatedAt).toLocaleDateString()}
                            </span>
                            {article.keyword && (
                                <span className="text-xs text-white/40">
                                    Keyword: <span className="text-white/60">{article.keyword}</span>
                                </span>
                            )}
                            {article.currentStep < 13 ? (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300">Step {article.currentStep}/13</span>
                            ) : (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Complete
                                </span>
                            )}
                        </div>
                    </div>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); deleteArticle(article.id); }}
                    className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl bg-ink-900/50 py-20">
                <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-full rounded-2xl bg-ink-900 p-6 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Edit3 className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Content Writer</h1>
                            <p className="text-brand-200 mt-1">Create SEO-optimized content with AI assistance</p>
                        </div>
                    </div>
                    <button
                        onClick={handleNewArticle}
                        className="flex items-center gap-2 px-5 py-3 bg-white/10 text-brand-300 rounded-xl font-semibold hover:bg-brand-500/100/15 transition shadow-lg"
                    >
                        <Plus className="w-5 h-5" />
                        New Article
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {savedArticles.length === 0 && (
                <div className="text-center py-16">
                    <div className="w-20 h-20 bg-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FileEdit className="w-10 h-10 text-white/30" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No articles yet</h3>
                    <p className="text-white/50 mb-6">Create your first SEO-optimized article</p>
                    <button
                        onClick={handleNewArticle}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                    >
                        <Plus className="w-5 h-5" />
                        New Article
                    </button>
                </div>
            )}

            {/* In Progress / Draft Articles */}
            {draftArticles.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <FileEdit className="w-5 h-5 text-amber-500" />
                        In Progress
                        <span className="text-sm font-normal text-white/40">({draftArticles.length})</span>
                    </h2>
                    <div className="space-y-3">
                        {draftArticles.map(renderArticleCard)}
                    </div>
                </div>
            )}

            {/* Completed Articles */}
            {completedArticles.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Completed
                        <span className="text-sm font-normal text-white/40">({completedArticles.length})</span>
                    </h2>
                    <div className="space-y-3">
                        {completedArticles.map(renderArticleCard)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContentWriterDashboard;
