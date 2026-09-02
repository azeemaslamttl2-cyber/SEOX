import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { loadContentWriterProfile, updateContentWriterProfile } from '../../lib/contentWriterProfile.js';
import {
    Search, FileText, Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp,
    Plus, X, Trash2, ExternalLink, List, Target, Hash, Brain, Type, Zap, Star, SkipForward,
    GripVertical, ChevronRight, ChevronLeft, Settings, Eye, Edit3, Save,
    RefreshCw, Download, AlertCircle, CheckCircle, Globe, Layers,
    AlignLeft, AlignCenter, ListOrdered, Link2, Image as ImageIcon, Undo, Redo,
    ArrowLeft, Clock, FolderOpen, FileEdit, Gauge
} from 'lucide-react';

// Step definitions
const STEPS = [
    { id: 1, name: 'Competitor Research', icon: Search, description: 'Add competitors to analyze' },
    { id: 2, name: 'Outline Creation', icon: List, description: 'Extract and combine outlines' },
    { id: 3, name: 'Competitor Content', icon: FileText, description: 'Paste content for style inspiration (optional)' },
    { id: 4, name: 'Entities', icon: Layers, description: 'Extract entities from competitors & AI' },
    { id: 5, name: 'N-Grams', icon: Hash, description: '3-4 word phrases & AI picked' },
    { id: 6, name: 'NLP Keywords', icon: Brain, description: 'Semantic LSI keywords' },
    { id: 7, name: 'Skip-Gram Words', icon: Type, description: 'Topic-defining word pairs' },
    { id: 8, name: 'Auto-Suggest Keywords', icon: Sparkles, description: 'AI keyword suggestions' },
    { id: 9, name: 'Grammar Generator', icon: Type, description: 'Semantic word relationships' },
    { id: 10, name: 'SEO Rules', icon: Settings, description: 'Select optimization rules' },
    { id: 11, name: 'AI Instructions', icon: Brain, description: 'Configure writing style' },
    { id: 12, name: 'Master Prompt', icon: FileText, description: 'Review & edit the AI prompt' },
    { id: 13, name: 'Content Editor', icon: Edit3, description: 'Write with AI assistance' }
];

const escapeHtml = (text = '') => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const htmlToPlainText = (html = '') => {
    if (!html) return '';
    if (typeof window === 'undefined') {
        return html.replace(/<[^>]*>/g, ' ');
    }
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
};

const countWords = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;

const formatManualContentToHtml = (text = '') => {
    const trimmed = text.trim();
    if (!trimmed) return '';

    return trimmed
        .split(/\n{2,}/)
        .map(paragraph => {
            const lines = paragraph
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(escapeHtml);

            if (lines.length === 0) return '';
            return `<p>${lines.join('<br/>')}</p>`;
        })
        .filter(Boolean)
        .join('\n');
};

const ContentWriter = () => {
    // Session storage keys
    const STORAGE_KEY = 'contentWriter_state';
    const ARTICLES_KEY = 'contentWriter_articles';
    const DATABASE_SAVE_DELAY = 3000;

    const { user } = useAuth();
    const userId = user?.uid || user?.id;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const databaseSaveTimerRef = useRef(null);
    const articleStateSaveTimerRef = useRef(null);
    const articlesLoadedRef = useRef(false);

    // Helper to load initial state from sessionStorage
    const loadFromStorage = (key, defaultValue) => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed[key] !== undefined) {
                    // Special handling for Sets (stored as arrays)
                    if (key === 'excludedItems' && parsed[key]) {
                        const restored = {};
                        Object.keys(parsed[key]).forEach(k => {
                            restored[k] = new Set(parsed[key][k] || []);
                        });
                        return restored;
                    }
                    return parsed[key];
                }
            }
        } catch (e) {
            console.error('Error loading from sessionStorage:', e);
        }
        return defaultValue;
    };

    // Global State
    const [currentStep, setCurrentStep] = useState(() => loadFromStorage('currentStep', 1));
    const [mainKeyword, setMainKeyword] = useState(() => loadFromStorage('mainKeyword', ''));
    const [competitors, setCompetitors] = useState(() => loadFromStorage('competitors', ['']));
    const [isLoading, setIsLoading] = useState(false);
    const [showProcess, setShowProcess] = useState(true);
    const [showProcessOnStep12, setShowProcessOnStep12] = useState(false);
    const [skippedSteps, setSkippedSteps] = useState(() => loadFromStorage('skippedSteps', []));
    const [masterPrompt, setMasterPrompt] = useState(() => loadFromStorage('masterPrompt', ''));

    // Step 2: Outline
    const [extractedOutlines, setExtractedOutlines] = useState(() => loadFromStorage('extractedOutlines', {}));
    const [combinedOutline, setCombinedOutline] = useState(() => loadFromStorage('combinedOutline', []));

    // Step 3: Competitor Content (Optional - for writing style inspiration)
    const [competitorContent, setCompetitorContent] = useState(() => loadFromStorage('competitorContent', ''));
    const [manualCompetitorContent, setManualCompetitorContent] = useState('');

    // Step 3: Keywords
    const [keywordData, setKeywordData] = useState(() => loadFromStorage('keywordData', {
        competitorEntities: [],
        aiEntities: [],
        competitorNgrams: [],  // Extracted from competitor content
        aiPickedNgrams: [],    // AI picks from competitor ngrams
        aiGeneratedNgrams: [], // AI generated n-grams
        uniqueNgrams: [],      // Unique, uncommon phrases
        ngrams: { threeGrams: [], fourGrams: [], aiPicked: [] }, // Legacy support
        nlpKeywords: [],
        skipGrams: [],
        grammar: {},
        autoSuggest: []
    }));

    // Exclusion sets for mega prompt (items with cross mark clicked)
    const [excludedItems, setExcludedItems] = useState(() => loadFromStorage('excludedItems', {
        competitorEntities: new Set(),
        aiEntities: new Set(),
        competitorNgrams: new Set(),
        aiPickedNgrams: new Set(),
        aiGeneratedNgrams: new Set(),
        uniqueNgrams: new Set(),
        nlpKeywords: new Set(),
        skipGrams: new Set(),
        grammar: new Set()
    }));

    // Toggle exclusion for an item
    const toggleExclusion = (category, item) => {
        setExcludedItems(prev => {
            const newSet = new Set(prev[category]);
            if (newSet.has(item)) {
                newSet.delete(item);
            } else {
                newSet.add(item);
            }
            return { ...prev, [category]: newSet };
        });
    };

    // Step 4: SEO Rules
    const [selectedRules, setSelectedRules] = useState(() => loadFromStorage('selectedRules', []));

    // Step 5: AI Instructions
    const [aiInstructions, setAiInstructions] = useState(() => loadFromStorage('aiInstructions', {
        conciseWriting: true,
        naturalLanguage: true,
        avoidAIPatterns: true
    }));

    // Step 6: Content
    const [articleTitle, setArticleTitle] = useState(() => loadFromStorage('articleTitle', ''));
    const [content, setContent] = useState(() => loadFromStorage('content', ''));
    const [contentScore, setContentScore] = useState(() => loadFromStorage('contentScore', 0));

    // Step 8: Auto-Suggest Keywords
    const [autoSuggestKeywords, setAutoSuggestKeywords] = useState(() => loadFromStorage('autoSuggestKeywords', {}));
    const [aiPickedKeywords, setAiPickedKeywords] = useState(() => loadFromStorage('aiPickedKeywords', []));
    const [checkedKeywords, setCheckedKeywords] = useState(() => {
        const saved = loadFromStorage('checkedKeywords', []);
        return new Set(saved);
    });

    // Writer mode: null = landing, 'quick' = quick mode, 'express' = full mode
    const [writerMode, setWriterMode] = useState(() => loadFromStorage('writerMode', null));
    const [showWordCount, setShowWordCount] = useState(false);
    const [showNewArticle, setShowNewArticle] = useState(false);
    const [headingWordCounts, setHeadingWordCounts] = useState(() => loadFromStorage('headingWordCounts', {}));
    const [savedArticles, setSavedArticles] = useState([]);
    const [currentArticleId, setCurrentArticleId] = useState(() => loadFromStorage('currentArticleId', null));

    // Step 9: Grammar Generator
    const [grammarResults, setGrammarResults] = useState(() => loadFromStorage('grammarResults', null));

    // Load saved articles from the local database, then session storage.
    useEffect(() => {
        const loadArticles = async () => {
            // Try the local API first if logged in.
            if (userId) {
                try {
                    const data = await loadContentWriterProfile();
                    if (data) {
                        if (data.contentWriterArticles && data.contentWriterArticles.length > 0) {
                            setSavedArticles(data.contentWriterArticles);
                            // Also cache in sessionStorage
                            sessionStorage.setItem(ARTICLES_KEY, JSON.stringify(data.contentWriterArticles));
                            return;
                        }
                    }
                } catch (e) { console.error('Error loading articles from local database:', e); }
            }
            // Fallback to sessionStorage
            try {
                const saved = sessionStorage.getItem(ARTICLES_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setSavedArticles(parsed);
                    // Persist the local cache for the signed-in user.
                    if (userId && parsed.length > 0) {
                        try {
                            await updateContentWriterProfile({ contentWriterArticles: parsed });
                        } catch (e) { console.error('Migration error:', e); }
                    }
                }
            } catch (e) { console.error('Error loading articles:', e); }
        };
        loadArticles().finally(() => { articlesLoadedRef.current = true; });
    }, [userId]);

    // Save articles list to MySQL through the local API (debounced).
    const saveArticlesToDatabase = useCallback((articles) => {
        if (!userId) return;
        if (databaseSaveTimerRef.current) clearTimeout(databaseSaveTimerRef.current);
        databaseSaveTimerRef.current = setTimeout(async () => {
            try {
                await updateContentWriterProfile({ contentWriterArticles: articles });
            } catch (e) { console.error('Error saving articles to local database:', e); }
        }, DATABASE_SAVE_DELAY);
    }, [userId]);

    // Save per-article state to MySQL through the local API (debounced).
    const saveArticleStateToDatabase = useCallback((articleId, stateData) => {
        if (!userId || !articleId) return;
        if (articleStateSaveTimerRef.current) clearTimeout(articleStateSaveTimerRef.current);
        articleStateSaveTimerRef.current = setTimeout(async () => {
            try {
                await updateContentWriterProfile({ [`contentWriterStates_${articleId}`]: stateData });
            } catch (e) { console.error('Error saving article state to local database:', e); }
        }, DATABASE_SAVE_DELAY);
    }, [userId]);

    // Save state to sessionStorage whenever it changes
    useEffect(() => {
        const stateToSave = {
            currentStep,
            mainKeyword,
            competitors,
            extractedOutlines,
            combinedOutline,
            competitorContent,
            keywordData,
            excludedItems: Object.fromEntries(
                Object.entries(excludedItems).map(([k, v]) => [k, Array.from(v)])
            ),
            selectedRules,
            aiInstructions,
            articleTitle,
            content,
            contentScore,
            autoSuggestKeywords,
            aiPickedKeywords,
            checkedKeywords: Array.from(checkedKeywords),
            grammarResults,
            skippedSteps,
            masterPrompt,
            writerMode,
            headingWordCounts,
            currentArticleId
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error('Error saving to sessionStorage:', e);
        }
    }, [currentStep, mainKeyword, competitors, extractedOutlines, combinedOutline, competitorContent, keywordData, excludedItems, selectedRules, aiInstructions, articleTitle, content, contentScore, autoSuggestKeywords, aiPickedKeywords, checkedKeywords, grammarResults, skippedSteps, masterPrompt, writerMode, headingWordCounts, currentArticleId]);

    // Auto-save current article to articles list
    useEffect(() => {
        if (!writerMode || !mainKeyword) return;
        if (!articlesLoadedRef.current) return; // Don't auto-save until articles list is loaded
        const articleId = currentArticleId || `article_${Date.now()}`;
        if (!currentArticleId) setCurrentArticleId(articleId);

        const articleData = {
            id: articleId,
            title: articleTitle || mainKeyword || 'Untitled',
            keyword: mainKeyword,
            mode: writerMode,
            createdAt: savedArticles.find(a => a.id === articleId)?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentStep
        };

        setSavedArticles(prev => {
            const existing = prev.findIndex(a => a.id === articleId);
            const updated = existing >= 0
                ? prev.map(a => a.id === articleId ? articleData : a)
                : [articleData, ...prev];
            try { sessionStorage.setItem(ARTICLES_KEY, JSON.stringify(updated)); } catch (e) { }
            saveArticlesToDatabase(updated);
            return updated;
        });
    }, [mainKeyword, articleTitle, currentStep, writerMode]);

    // Load a saved article
    const loadArticle = async (articleId) => {
        try {
            let state = null;

            // Try the local API first if logged in.
            if (userId) {
                try {
                    const data = await loadContentWriterProfile();
                    if (data) {
                        if (data[`contentWriterStates_${articleId}`]) {
                            state = data[`contentWriterStates_${articleId}`];
                        }
                    }
                } catch (e) { console.error('Local database load error:', e); }
            }

            // Fallback to sessionStorage
            if (!state) {
                const saved = sessionStorage.getItem(`contentWriter_${articleId}`);
                if (saved) state = JSON.parse(saved);
            }

            if (state) {
                setCurrentStep(state.currentStep || 1);
                setMainKeyword(state.mainKeyword || '');
                setCompetitors(state.competitors || ['']);
                setExtractedOutlines(state.extractedOutlines || {});
                setCombinedOutline(state.combinedOutline || []);
                setCompetitorContent(state.competitorContent || '');
                setKeywordData(state.keywordData || { competitorEntities: [], aiEntities: [], competitorNgrams: [], aiPickedNgrams: [], aiGeneratedNgrams: [], uniqueNgrams: [], ngrams: { threeGrams: [], fourGrams: [], aiPicked: [] }, nlpKeywords: [], skipGrams: [], grammar: {}, autoSuggest: [] });
                setExcludedItems(state.excludedItems ? Object.fromEntries(Object.entries(state.excludedItems).map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [])])) : { competitorEntities: new Set(), aiEntities: new Set(), competitorNgrams: new Set(), aiPickedNgrams: new Set(), aiGeneratedNgrams: new Set(), uniqueNgrams: new Set(), nlpKeywords: new Set(), skipGrams: new Set(), grammar: new Set() });
                setSelectedRules(state.selectedRules || []);
                setAiInstructions(state.aiInstructions || { conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true });
                setArticleTitle(state.articleTitle || '');
                setContent(state.content || '');
                setContentScore(state.contentScore || 0);
                setAutoSuggestKeywords(state.autoSuggestKeywords || {});
                setAiPickedKeywords(state.aiPickedKeywords || []);
                setCheckedKeywords(new Set(state.checkedKeywords || []));
                setGrammarResults(state.grammarResults || null);
                setSkippedSteps(state.skippedSteps || []);
                setMasterPrompt(state.masterPrompt || '');
                setWriterMode(state.writerMode || 'express');
                setHeadingWordCounts(state.headingWordCounts || {});
                setCurrentArticleId(articleId);
                navigate(`/content/semantic-writer/editor?article=${articleId}`, { replace: true });
                setShowWordCount(false);
            }
        } catch (e) { console.error('Error loading article:', e); }
    };

    // Save per-article state (called on article switch or periodically)
    const saveArticleState = (articleId) => {
        if (!articleId) return;
        const stateToSave = {
            currentStep, mainKeyword, competitors, extractedOutlines, combinedOutline,
            competitorContent, keywordData,
            excludedItems: Object.fromEntries(Object.entries(excludedItems).map(([k, v]) => [k, Array.from(v)])),
            selectedRules, aiInstructions, articleTitle, content, contentScore,
            autoSuggestKeywords, aiPickedKeywords, checkedKeywords: Array.from(checkedKeywords),
            grammarResults, skippedSteps, masterPrompt, writerMode, headingWordCounts
        };
        try { sessionStorage.setItem(`contentWriter_${articleId}`, JSON.stringify(stateToSave)); } catch (e) { }
        saveArticleStateToDatabase(articleId, stateToSave);
    };

    // Save current article state periodically
    useEffect(() => {
        if (currentArticleId) saveArticleState(currentArticleId);
    }, [currentStep, mainKeyword, competitors, combinedOutline, competitorContent, content, articleTitle, headingWordCounts, masterPrompt]);

    useEffect(() => {
        setManualCompetitorContent('');
    }, [currentArticleId]);

    // Start new article
    const startNewArticle = (mode) => {
        // Save current article first
        if (currentArticleId) saveArticleState(currentArticleId);

        const newId = `article_${Date.now()}`;
        setCurrentArticleId(newId);
        // Update URL to reflect the new article
        navigate(`/content/semantic-writer/editor?article=${newId}`, { replace: true });
        setWriterMode(mode);
        setCurrentStep(1);
        setMainKeyword('');
        setCompetitors(['']);
        setExtractedOutlines({});
        setCombinedOutline([]);
        setCompetitorContent('');
        setKeywordData({ competitorEntities: [], aiEntities: [], competitorNgrams: [], aiPickedNgrams: [], aiGeneratedNgrams: [], uniqueNgrams: [], ngrams: { threeGrams: [], fourGrams: [], aiPicked: [] }, nlpKeywords: [], skipGrams: [], grammar: {}, autoSuggest: [] });
        setExcludedItems({ competitorEntities: new Set(), aiEntities: new Set(), competitorNgrams: new Set(), aiPickedNgrams: new Set(), aiGeneratedNgrams: new Set(), uniqueNgrams: new Set(), nlpKeywords: new Set(), skipGrams: new Set(), grammar: new Set() });
        setSelectedRules([]);
        setAiInstructions({ conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true });
        setArticleTitle('');
        setContent('');
        setContentScore(0);
        setAutoSuggestKeywords({});
        setAiPickedKeywords([]);
        setCheckedKeywords(new Set());
        setGrammarResults(null);
        setSkippedSteps([]);
        setMasterPrompt('');
        setHeadingWordCounts({});
        setShowWordCount(false);
    };

    // Go back to articles dashboard
    const goToLanding = () => {
        if (currentArticleId) saveArticleState(currentArticleId);
        navigate('/content/semantic-writer');
    };

    // Delete article
    const deleteArticle = (articleId) => {
        if (!window.confirm('Delete this article?')) return;
        setSavedArticles(prev => {
            const updated = prev.filter(a => a.id !== articleId);
                    try { sessionStorage.setItem(ARTICLES_KEY, JSON.stringify(updated)); } catch (e) { }
            saveArticlesToDatabase(updated);
            return updated;
        });
        try { sessionStorage.removeItem(`contentWriter_${articleId}`); } catch (e) { }
        // Remove the saved state from MySQL too.
        if (userId) {
            try {
                updateContentWriterProfile({ [`contentWriterStates_${articleId}`]: null })
                    .catch(e => console.error('Content profile delete error:', e));
            } catch (e) { }
        }
        if (currentArticleId === articleId) {
            setCurrentArticleId(null);
            setWriterMode(null);
        }
    };


    // Reset all state to start from scratch
    const resetAllState = () => {
        if (!window.confirm('Are you sure you want to reset all progress? This cannot be undone.')) return;

        sessionStorage.removeItem(STORAGE_KEY);
        setCurrentStep(1);
        setMainKeyword('');
        setCompetitors(['']);
        setExtractedOutlines({});
        setCombinedOutline([]);
        setCompetitorContent('');
        setKeywordData({
            competitorEntities: [],
            aiEntities: [],
            competitorNgrams: [],
            aiPickedNgrams: [],
            aiGeneratedNgrams: [],
            uniqueNgrams: [],
            ngrams: { threeGrams: [], fourGrams: [], aiPicked: [] },
            nlpKeywords: [],
            skipGrams: [],
            grammar: {},
            autoSuggest: []
        });
        setExcludedItems({
            competitorEntities: new Set(),
            aiEntities: new Set(),
            competitorNgrams: new Set(),
            aiPickedNgrams: new Set(),
            aiGeneratedNgrams: new Set(),
            uniqueNgrams: new Set(),
            nlpKeywords: new Set(),
            skipGrams: new Set(),
            grammar: new Set()
        });
        setSelectedRules([]);
        setAiInstructions({ conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true });
        setArticleTitle('');
        setContent('');
        setContentScore(0);
        setAutoSuggestKeywords({});
        setAiPickedKeywords([]);
        setCheckedKeywords(new Set());
        setGrammarResults(null);
        setSkippedSteps([]);
        setMasterPrompt('');
        setHeadingWordCounts({});
        setWriterMode(null);
        setShowWordCount(false);
    };

    // Steps for Quick mode
    const QUICK_STEP_IDS = [1, 2, 13];

    // Get the active steps based on mode
    const getActiveSteps = () => {
        if (writerMode === 'quick') {
            return STEPS.filter(s => QUICK_STEP_IDS.includes(s.id));
        }
        return STEPS;
    };

    // Navigation
    const goToStep = (step) => {
        if (step >= 1 && step <= 13) {
            setShowWordCount(false);
            setCurrentStep(step);
        }
    };

    const nextStep = () => {
        // After outline (step 2), show word count step
        if (currentStep === 2 && !showWordCount) {
            setShowWordCount(true);
            return;
        }
        // From word count, go to next appropriate step
        if (showWordCount) {
            setShowWordCount(false);
            if (writerMode === 'quick') {
                // Quick mode: jump to content editor
                setCurrentStep(13);
            } else {
                // Express mode: continue to step 3
                setCurrentStep(3);
            }
            return;
        }
        goToStep(currentStep + 1);
    };

    const prevStep = () => {
        // If showing word count, go back to step 2
        if (showWordCount) {
            setShowWordCount(false);
            return;
        }
        // If on step 3 in express mode, go back to word count
        if (currentStep === 3 && writerMode === 'express') {
            setShowWordCount(true);
            return;
        }
        // If on step 13 in quick mode, go back to word count
        if (currentStep === 13 && writerMode === 'quick') {
            setShowWordCount(true);
            return;
        }
        goToStep(currentStep - 1);
    };

    // Skip step (mark as done and advance)
    const skipStep = () => {
        if (!skippedSteps.includes(currentStep)) {
            setSkippedSteps(prev => [...prev, currentStep]);
        }
        nextStep();
    };

    // Step completion validation
    const isStepComplete = (step) => {
        // Skipped steps are always considered complete
        if (skippedSteps.includes(step)) return true;
        switch (step) {
            case 1: return competitors.some(c => c.trim()); // Has at least one competitor
            case 2: return combinedOutline.length > 0; // Has outline
            case 3: return true; // Optional step
            case 4: return keywordData.competitorEntities?.length > 0 || keywordData.aiEntities?.length > 0; // Has entities
            case 5: return keywordData.competitorNgrams?.length > 0 || keywordData.aiPickedNgrams?.length > 0 || keywordData.aiGeneratedNgrams?.length > 0 || keywordData.uniqueNgrams?.length > 0; // Has n-grams
            case 6: return keywordData.nlpKeywords?.length > 0; // Has NLP keywords
            case 7: return keywordData.skipGrams?.length > 0; // Has skip-grams
            case 8: return true; // Step 8 is optional - user can proceed without selecting keywords
            case 9: return grammarResults !== null; // Has generated grammar
            case 10: return true; // Rules are optional
            case 11: return true; // Instructions are optional
            case 12: return true; // Master prompt is optional
            default: return true;
        }
    };

    // Competitor management
    const addCompetitor = () => setCompetitors([...competitors, '']);
    const removeCompetitor = (index) => {
        if (competitors.length > 1) {
            setCompetitors(competitors.filter((_, i) => i !== index));
        }
    };
    const updateCompetitor = (index, value) => {
        const updated = [...competitors];
        updated[index] = value;
        setCompetitors(updated);
    };

    // Word Count step rendering
    const renderWordCountStep = () => {
        const normalizedCounts = Object.entries(headingWordCounts || {}).reduce((acc, [idx, value]) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
                acc[idx] = parsed;
            }
            return acc;
        }, {});

        const totalWords = Object.values(normalizedCounts).reduce((sum, v) => sum + v, 0);
        const configuredHeadings = Object.keys(normalizedCounts).length;

        const setAllWordCount = (count) => {
            const updated = {};
            combinedOutline.forEach((_, idx) => {
                updated[idx] = count;
            });
            setHeadingWordCounts(updated);
        };

        const updateHeadingWordCount = (idx, rawValue) => {
            setHeadingWordCounts(prev => {
                const next = { ...prev };
                if (rawValue === '') {
                    delete next[idx];
                    return next;
                }

                const parsed = Number.parseInt(rawValue, 10);
                if (Number.isFinite(parsed) && parsed > 0) {
                    next[idx] = parsed;
                } else {
                    delete next[idx];
                }

                return next;
            });
        };

        return (
            <div className="space-y-6">
                <div className="ctool-card">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Gauge className="w-5 h-5 text-brand-500" />
                            Word Count per Heading
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-white/50">Set all to:</span>
                            {[150, 200, 300, 500].map(count => (
                                <button
                                    key={count}
                                    onClick={() => setAllWordCount(count)}
                                    className="px-3 py-1.5 text-xs font-medium bg-brand-500/10 text-brand-500 rounded-lg hover:bg-brand-500/20 transition"
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-white/50 mb-4">
                        Optional at first: leave any heading blank to skip strict targeting. Targets are enforced in the AI prompt only after you set them.
                    </p>

                    {combinedOutline.length === 0 ? (
                        <div className="text-center py-8 text-white/40">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>No headings found. Go back and create an outline first.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {combinedOutline.map((heading, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${heading.level <= 2 ? 'bg-brand-500/15 text-brand-300' : 'bg-white/[0.08] text-white/60'}`}>
                                        H{heading.level}
                                    </span>
                                    <span className="flex-1 text-sm text-white/90 font-medium truncate">{heading.text}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="50"
                                            max="2000"
                                            value={headingWordCounts[idx] ?? ''}
                                            placeholder="-"
                                            onChange={(e) => updateHeadingWordCount(idx, e.target.value)}
                                            className="w-20 px-3 py-2 border border-white/10 rounded-lg text-sm text-center focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                        />
                                        <span className="text-xs text-white/40 w-12">words</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Total */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-brand-50 to-brand-50 rounded-xl border border-brand-200">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-brand-300">Total Article Length Target</span>
                            {configuredHeadings > 0 ? (
                                <span className="text-2xl font-bold text-brand-500">{totalWords.toLocaleString()} <span className="text-sm font-medium text-brand-400">words</span></span>
                            ) : (
                                <span className="text-sm font-semibold text-brand-500">No target set yet</span>
                            )}
                        </div>
                        <p className="text-xs text-brand-500 mt-2">
                            Configured headings: {configuredHeadings}/{combinedOutline.length}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    // Landing page rendering (articles first, then new article mode selector)
    const renderLandingPage = () => {
        const draftArticles = savedArticles.filter(a => a.currentStep < 13);
        const completedArticles = savedArticles.filter(a => a.currentStep >= 13);

        const renderArticleCard = (article) => (
            <div
                key={article.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/5 transition-all group"
            >
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => loadArticle(article.id)}
                        className="flex-1 flex items-start gap-4 text-left"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${article.mode === 'quick' ? 'bg-amber-500/15' : 'bg-brand-500/15'}`}>
                            {article.mode === 'quick'
                                ? <Zap className="w-5 h-5 text-amber-400" />
                                : <Layers className="w-5 h-5 text-brand-500" />
                            }
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-white truncate group-hover:text-brand-500 transition">{article.title}</h4>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${article.mode === 'quick' ? 'bg-amber-500/15 text-amber-300' : 'bg-brand-500/15 text-brand-300'}`}>
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

        // Screen 2: New Article - Mode Selector
        if (showNewArticle) {
            return (
                <div className="flex flex-col h-screen bg-ink-900 overflow-hidden">
                    <div className="scw-toolbar shrink-0">
                        <button
                            onClick={() => setShowNewArticle(false)}
                            className="flex items-center gap-2 text-sm font-medium text-brand-500 hover:text-brand-300 transition group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                            Back to Articles
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        <div className="max-w-3xl mx-auto">
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-white mb-2">Start New Article</h1>
                                <p className="text-white/50">Choose your content creation workflow</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Quick Mode */}
                                <button
                                    onClick={() => { setShowNewArticle(false); startNewArticle('quick'); }}
                                    className="group relative rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:border-amber-400 p-8 text-left transition-all hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1"
                                >
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-amber-500/15 text-amber-300 text-xs font-bold rounded-full uppercase">Fast</div>
                                    <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                                        <Zap className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">⚡ Quick Mode</h3>
                                    <p className="text-white/50 text-sm mb-4">Generate a focused article in 4 simple steps. Perfect for quick content needs.</p>
                                    <div className="space-y-2">
                                        {['Competitor Research + Keywords', 'Outline Creation', 'Word Count Configuration', 'AI Content Editor'].map(t => (
                                            <div key={t} className="flex items-center gap-2 text-xs text-white/60">
                                                <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
                                                <span>{t}</span>
                                            </div>
                                        ))}
                                    </div>
                                </button>

                                {/* Express Mode */}
                                <button
                                    onClick={() => { setShowNewArticle(false); startNewArticle('express'); }}
                                    className="group relative rounded-2xl border-2 border-white/10 bg-white/[0.03] hover:border-brand-400 p-8 text-left transition-all hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1"
                                >
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-brand-500/15 text-brand-300 text-xs font-bold rounded-full uppercase">Full</div>
                                    <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-amber-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform">
                                        <Layers className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">🔬 Express Mode</h3>
                                    <p className="text-white/50 text-sm mb-4">Deep semantic optimization with all 13 steps. For maximum SEO impact.</p>
                                    <div className="space-y-2">
                                        {['Full competitor analysis', 'Entities, N-Grams, NLP Keywords', 'Grammar, SEO rules, AI instructions', 'Master prompt + Content editor'].map(t => (
                                            <div key={t} className="flex items-center gap-2 text-xs text-white/60">
                                                <CheckCircle className="w-3.5 h-3.5 text-brand-500" />
                                                <span>{t}</span>
                                            </div>
                                        ))}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Screen 1: Articles Dashboard
        return (
            <div className="flex flex-col h-screen bg-ink-900 overflow-hidden">
                {/* Back Navigation Bar */}
                <div className="scw-toolbar shrink-0">
                    <RouterLink
                        to="/"
                        className="flex items-center gap-2 text-sm font-medium text-brand-500 hover:text-brand-300 transition group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        Back to PGC
                    </RouterLink>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Edit3 className="w-7 h-7" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold">Content Writer</h1>
                                    <p className="text-brand-200 mt-1">Create SEO-optimized content with AI assistance</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNewArticle(true)}
                                className="flex items-center gap-2 px-5 py-3 bg-white/10 text-brand-300 rounded-xl font-semibold hover:bg-brand-500/150/10 transition shadow-lg"
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
                                onClick={() => setShowNewArticle(true)}
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
            </div>
        );
    };

    // Render step content - returning JSX directly to prevent input focus issues
    const renderStepContent = () => {
        switch (currentStep) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return <Step3CompetitorContent />;
            case 4: return <Step4Entities />;
            case 5: return <Step5NGrams />;
            case 6: return <Step6NLPKeywords />;
            case 7: return <Step7SkipGrams />;
            case 8: return <Step8AutoSuggest />;
            case 9: return <Step9GrammarGenerator />;
            case 10: return <Step10SEORules />;
            case 11: return <Step11AIInstructions />;
            case 12: return <Step12MasterPrompt />;
            case 13: return renderStep13();
            default: return null;
        }
    };

    // SERP Checker - Full Implementation from SEOTools
    const [serpExpanded, setSerpExpanded] = useState(false);
    const [serpKw, setSerpKw] = useState('');
    const [serpReg, setSerpReg] = useState('United States - English');
    const [serpHl, setSerpHl] = useState('en');
    const [serpGl, setSerpGl] = useState('US');
    const [serpUrl, setSerpUrl] = useState('https://www.google.com/search');
    const [showRegions, setShowRegions] = useState(false);
    const [regionSearch, setRegionSearch] = useState('');
    const [kwSuggestions, setKwSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const regionRef = useRef(null);
    const kwInputRef = useRef(null);
    const debounceRef = useRef(null);

    // Location / Geocode state
    const [serpLoc, setSerpLoc] = useState('');
    const [serpLat, setSerpLat] = useState('');
    const [serpLng, setSerpLng] = useState('');
    const [isGeo, setIsGeo] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    // Google Sites list (subset for performance)
    const GOOGLE_SITES = [
        { name: "United States", gl: "US", lang: "English", hl: "en", url: "https://www.google.com/search" },
        { name: "United Kingdom", gl: "GB", lang: "English", hl: "en", url: "https://www.google.co.uk/search" },
        { name: "Canada", gl: "CA", lang: "English", hl: "en", url: "https://www.google.ca/search" },
        { name: "Australia", gl: "AU", lang: "English", hl: "en", url: "https://www.google.com.au/search" },
        { name: "India", gl: "IN", lang: "English", hl: "en", url: "https://www.google.co.in/search" },
        { name: "Pakistan", gl: "PK", lang: "English", hl: "en", url: "https://www.google.com.pk/search" },
        { name: "Germany", gl: "DE", lang: "Deutsch", hl: "de", url: "https://www.google.de/search" },
        { name: "France", gl: "FR", lang: "Français", hl: "fr", url: "https://www.google.fr/search" },
        { name: "Spain", gl: "ES", lang: "Español", hl: "es", url: "https://www.google.es/search" },
        { name: "Italy", gl: "IT", lang: "Italiano", hl: "it", url: "https://www.google.it/search" },
        { name: "Netherlands", gl: "NL", lang: "Nederlands", hl: "nl", url: "https://www.google.nl/search" },
        { name: "Brazil", gl: "BR", lang: "Português", hl: "pt-BR", url: "https://www.google.com.br/search" },
        { name: "Mexico", gl: "MX", lang: "Español", hl: "es-419", url: "https://www.google.com.mx/search" },
        { name: "Japan", gl: "JP", lang: "日本語", hl: "ja", url: "https://www.google.co.jp/search" },
        { name: "South Korea", gl: "KR", lang: "한국어", hl: "ko", url: "https://www.google.co.kr/search" },
        { name: "China", gl: "CN", lang: "中文", hl: "zh-CN", url: "https://www.google.com.hk/search" },
        { name: "Russia", gl: "RU", lang: "Русский", hl: "ru", url: "https://www.google.ru/search" },
        { name: "Saudi Arabia", gl: "SA", lang: "العربية", hl: "ar", url: "https://www.google.com.sa/search" },
        { name: "UAE", gl: "AE", lang: "English", hl: "en", url: "https://www.google.ae/search" },
        { name: "South Africa", gl: "ZA", lang: "English", hl: "en", url: "https://www.google.co.za/search" }
    ];

    // Filter regions based on search
    const filteredRegions = GOOGLE_SITES.filter(s => {
        if (!regionSearch.trim()) return true;
        const search = regionSearch.toLowerCase();
        return s.name.toLowerCase().includes(search) || s.lang.toLowerCase().includes(search);
    });

    // Fetch keyword suggestions via JSONP
    const fetchSuggestions = async (query) => {
        if (!query.trim() || query.length < 2) {
            setKwSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        setIsLoadingSuggestions(true);
        const callbackName = `googleAC_${Date.now()}`;
        try {
            const promise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => { cleanup(); reject(new Error('Timeout')); }, 5000);
                const cleanup = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    document.querySelector(`script[data-callback="${callbackName}"]`)?.remove();
                };
                window[callbackName] = (data) => { cleanup(); resolve(data); };
                const script = document.createElement('script');
                script.setAttribute('data-callback', callbackName);
                script.src = `https://www.google.com/complete/search?q=${encodeURIComponent(query)}&hl=${serpHl}&gl=${serpGl}&client=chrome&callback=${callbackName}`;
                script.onerror = () => { cleanup(); reject(new Error('Failed')); };
                document.head.appendChild(script);
            });
            const data = await promise;
            if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                const suggestions = data[1].map(item => typeof item === 'string' ? item : (Array.isArray(item) ? item[0] : null)).filter(Boolean).slice(0, 8);
                setKwSuggestions(suggestions);
                setShowSuggestions(suggestions.length > 0);
            }
        } catch (e) { console.error(e); }
        setIsLoadingSuggestions(false);
    };

    // Debounced keyword input
    const handleSerpKeywordChange = (value) => {
        setSerpKw(value);
        setMainKeyword(value); // Sync with main keyword
        if (!value.trim()) { setKwSuggestions([]); setShowSuggestions(false); return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(value), 150);
    };

    // Select suggestion
    const selectSuggestion = (suggestion) => {
        setSerpKw(suggestion);
        setMainKeyword(suggestion);
        setShowSuggestions(false);
        setKwSuggestions([]);
    };

    // Handle region selection
    const handleRegion = (site) => {
        setSerpReg(`${site.name} - ${site.lang}`);
        setSerpHl(site.hl);
        setSerpGl(site.gl);
        setSerpUrl(site.url);
        setShowRegions(false);
        setRegionSearch('');
    };

    // Generate UULE geocode for hyper-local search
    const genGeoCode = (lat, lng) => {
        const coord = `${parseFloat(lat).toFixed(7)},${parseFloat(lng).toFixed(7)}`;
        const encoded = btoa(coord);
        return `w+CAIQICI${encoded}`;
    };

    // Geocode location using server proxy
    const geocodeLocation = async () => {
        if (!serpLoc.trim()) return;
        setIsGeo(true);
        try {
            const proxyUrl = `/api/utils?action=geocode&address=${encodeURIComponent(serpLoc.toLowerCase())}&hl=${serpHl}&gl=${serpGl}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            if (data.status === 'OK' && data.results?.length) {
                const result = data.results[0];
                setSerpLat(parseFloat(result.geometry.location.lat).toFixed(7));
                setSerpLng(parseFloat(result.geometry.location.lng).toFixed(7));
                setSerpLoc('');
            }
        } catch (e) { console.error('Geocode error:', e); }
        setIsGeo(false);
    };

    // Clear location coordinates
    const clearLocation = () => {
        setSerpLat('');
        setSerpLng('');
    };

    // Open Google search in new tab
    const openGoogleSearch = () => {
        if (!serpKw.trim()) return;
        const params = new URLSearchParams({ q: serpKw, gl: serpGl, hl: serpHl, ie: 'utf-8', oe: 'utf-8', pws: '0' });
        // Add UULE if coordinates are set
        if (serpLat && serpLng) {
            params.set('uule', genGeoCode(serpLat, serpLng));
        }
        window.open(`${serpUrl}?${params.toString()}`, '_blank');
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (regionRef.current && !regionRef.current.contains(e.target)) setShowRegions(false);
            if (kwInputRef.current && !kwInputRef.current.contains(e.target)) setShowSuggestions(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize Leaflet map when showMap is true
    useEffect(() => {
        if (!showMap || !mapContainerRef.current || mapInstanceRef.current) return;

        const loadLeaflet = async () => {
            // Add Leaflet CSS
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            // Load Leaflet JS if not already loaded
            if (!window.L) {
                await new Promise((resolve) => {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    script.onload = resolve;
                    document.head.appendChild(script);
                });
            }

            // Wait for Leaflet to be available
            await new Promise(resolve => setTimeout(resolve, 100));

            const L = window.L;
            const lat = parseFloat(serpLat) || 37.421;
            const lng = parseFloat(serpLng) || -122.084;

            // Initialize map
            const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
            mapInstanceRef.current = map;

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);

            // Add draggable marker
            const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            markerRef.current = marker;

            // Update coordinates on marker drag
            marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                setSerpLat(pos.lat.toFixed(7));
                setSerpLng(pos.lng.toFixed(7));
            });

            // Click on map to move marker
            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                marker.setLatLng([lat, lng]);
                setSerpLat(lat.toFixed(7));
                setSerpLng(lng.toFixed(7));
            });
        };

        loadLeaflet();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [showMap]);

    const addAsCompetitor = (url) => {
        if (!competitors.includes(url)) {
            const emptyIndex = competitors.findIndex(c => !c.trim());
            if (emptyIndex >= 0) updateCompetitor(emptyIndex, url);
            else setCompetitors([...competitors, url]);
        }
    };

    // Step 1: Competitor Research with SERP Checker - Direct JSX to prevent focus issues
    const renderStep1 = () => (
        <div className="space-y-6">
            {/* Main Keyword */}
            <div className="ctool-card">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-brand-500" />
                    Main Keyword
                </h3>
                <input
                    type="text"
                    value={mainKeyword}
                    onChange={(e) => setMainKeyword(e.target.value)}
                    placeholder="Enter your primary keyword..."
                    className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                />
            </div>

            {/* Competitor URLs - MOVED ABOVE SERP */}
            <div className="ctool-card">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-brand-500" />
                    Competitor URLs
                    {competitors.filter(c => c.trim()).length > 0 && (
                        <span className="ml-auto text-sm text-white/50">{competitors.filter(c => c.trim()).length} added</span>
                    )}
                </h3>
                <div className="space-y-3">
                    {competitors.map((url, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => updateCompetitor(index, e.target.value)}
                                placeholder="https://competitor-url.com/page"
                                className="flex-1 px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                            />
                            {competitors.length > 1 && (
                                <button
                                    onClick={() => removeCompetitor(index)}
                                    className="ui-button schema-remove"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    onClick={addCompetitor}
                    className="ui-button ctool-tool-btn mt-4"
                >
                    <Plus className="w-5 h-5" />
                    Add Competitor
                </button>
            </div>

            {/* SERP Checker - Full Implementation */}
            <div className="ctool-card scw-serp">
                <button
                    onClick={() => setSerpExpanded(!serpExpanded)}
                    className="scw-serp-head"
                >
                    <h3 className="scw-serp-title flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Find Competitors via SERP
                    </h3>
                    {serpExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {serpExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                        {/* Search Keyword */}
                        <div>
                            <label className="schema-label">Search Keyword</label>
                            <div className="relative" ref={kwInputRef}>
                                <input
                                    type="text"
                                    value={serpKw}
                                    onChange={(e) => handleSerpKeywordChange(e.target.value)}
                                    onFocus={() => kwSuggestions.length > 0 && setShowSuggestions(true)}
                                    placeholder="Enter your search keyword"
                                    className="schema-input schema-input-lg"
                                />
                                {isLoadingSuggestions && (
                                    <Loader2 className="absolute right-3 top-3.5 w-5 h-5 scw-field-icon animate-spin" />
                                )}
                                {showSuggestions && kwSuggestions.length > 0 && (
                                    <div className="scw-menu max-h-60 overflow-y-auto">
                                        {kwSuggestions.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => selectSuggestion(suggestion)}
                                                className="scw-menu-item"
                                            >
                                                <Search className="w-3.5 h-3.5 scw-menu-icon" />
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Country & Language */}
                        <div>
                            <label className="schema-label">Country & Language</label>
                            <div className="relative" ref={regionRef}>
                                <input
                                    type="text"
                                    value={showRegions ? regionSearch : (regionSearch || serpReg)}
                                    onChange={(e) => { setRegionSearch(e.target.value); setShowRegions(true); }}
                                    onFocus={() => { setShowRegions(true); setRegionSearch(''); }}
                                    placeholder="United States - English"
                                    className="schema-input schema-input-lg cursor-text"
                                />
                                <ChevronDown className={`absolute right-3 top-3.5 w-5 h-5 scw-field-icon transition pointer-events-none ${showRegions ? 'rotate-180' : ''}`} />
                                {showRegions && (
                                    <div className="scw-menu">
                                        <div className="max-h-48 overflow-y-auto">
                                            {filteredRegions.map((site, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleRegion(site)}
                                                    className="scw-menu-item scw-menu-item-split"
                                                >
                                                    <span className="scw-menu-label">{site.name} - {site.lang}</span>
                                                    <span className="scw-menu-meta">{site.gl}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="schema-label">Location <span className="scw-label-note">(optional - for hyper-local results)</span></label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={serpLoc}
                                    onChange={(e) => setSerpLoc(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && geocodeLocation()}
                                    placeholder="e.g. 1600 Amphitheatre Pkwy, Mountain View, CA"
                                    className="schema-input schema-input-lg flex-1"
                                />
                                <button
                                    onClick={geocodeLocation}
                                    disabled={!serpLoc.trim() || isGeo}
                                    className="ui-button ctool-tool-btn scw-geo-btn"
                                >
                                    {isGeo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                                    Geocode
                                </button>
                            </div>
                        </div>

                        {/* Current Location Display */}
                        {(serpLat && serpLng) && (
                            <div className="app-alert app-alert-info justify-between">
                                <div>
                                    <span className="stool-label">Current Location</span>
                                    <div className="scw-latlng">
                                        Lat: {serpLat} | Lng: {serpLng}
                                    </div>
                                </div>
                                <button
                                    onClick={clearLocation}
                                    className="ui-button ctool-tool-btn"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        {/* Advanced Settings Toggle */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="schema-addlink"
                        >
                            <Settings className="w-4 h-4" />
                            Advanced Settings
                            <ChevronDown className={`w-4 h-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>

                        {showAdvanced && (
                            <div className="geo-well space-y-4">
                                {/* Lat/Lng Inputs */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="stool-label mb-1 block">Latitude</label>
                                        <input
                                            type="text"
                                            value={serpLat}
                                            onChange={(e) => setSerpLat(e.target.value)}
                                            placeholder="e.g. 37.4210000"
                                            className="schema-input font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="stool-label mb-1 block">Longitude</label>
                                        <input
                                            type="text"
                                            value={serpLng}
                                            onChange={(e) => setSerpLng(e.target.value)}
                                            placeholder="e.g. -122.0840000"
                                            className="schema-input font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Toggle Map Button */}
                                <button
                                    onClick={() => setShowMap(!showMap)}
                                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition"
                                >
                                    <Globe className="w-4 h-4" />
                                    {showMap ? 'Hide Map' : 'Show Map'} - Click to pick location
                                </button>

                                {/* Leaflet Map Container */}
                                {showMap && (
                                    <div className="relative">
                                        <div
                                            ref={mapContainerRef}
                                            className="igt-map w-full"
                                            style={{ background: '#1f2937' }}
                                        />
                                        <p className="text-xs text-white/50 mt-2">Click on the map or drag the marker to set location.</p>
                                        <script
                                            dangerouslySetInnerHTML={{
                                                __html: `
                                                    (function() {
                                                        if (window.leafletMapLoaded) return;
                                                        window.leafletMapLoaded = true;
                                                        // Load Leaflet CSS
                                                        if (!document.querySelector('link[href*="leaflet.css"]')) {
                                                            var link = document.createElement('link');
                                                            link.rel = 'stylesheet';
                                                            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                                                            document.head.appendChild(link);
                                                        }
                                                        // Load Leaflet JS
                                                        if (!window.L) {
                                                            var script = document.createElement('script');
                                                            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                                                            document.head.appendChild(script);
                                                        }
                                                    })();
                                                `
                                            }}
                                        />
                                    </div>
                                )}

                                <p className="text-xs text-white/50">Manual coordinates for precise location targeting.</p>
                            </div>
                        )}

                        {/* Open Google Button */}
                        <button
                            onClick={openGoogleSearch}
                            disabled={!serpKw.trim()}
                            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <Search className="w-4 h-4" />
                            Search on Google
                        </button>

                        <p className="text-xs text-brand-500 text-center">
                            Opens in new tab. Copy competitor URLs and paste them above.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );

    // Step 2: Outline Creation - Full Implementation
    const [isExtracting, setIsExtracting] = useState({});
    const [isCombining, setIsCombining] = useState(false);
    const [outlineError, setOutlineError] = useState('');
    const [expandedOutlines, setExpandedOutlines] = useState({});

    const EXCLUDED_HEADINGS = [
        'share', 'leave a reply', 'cancel', 'reply', 'related stories',
        'related posts', 'comments', 'post a comment', 'sidebar', 'footer',
        'search', 'archives', 'categories', 'newsletter', 'subscribe',
        'recent posts', 'follow us', 'news letter', 'media', 'services',
        'quick links', 'contact sales', 'choose your software', 'download guide',
        'about us', 'contact us', 'get in touch', 'our services', 'our products',
        'privacy policy', 'terms of service', 'cookie policy', 'disclaimer',
        'sign up', 'log in', 'login', 'register', 'join now', 'free trial',
        'social media', 'connect with us', 'stay connected', 'get updates'
    ];

    const isExcludedHeading = (text) => {
        const lowerText = text.toLowerCase().trim();
        return EXCLUDED_HEADINGS.some(ex => lowerText.includes(ex));
    };

    const extractOutline = async (url, index) => {
        if (!url.trim()) return;
        setIsExtracting(prev => ({ ...prev, [index]: true }));
        setOutlineError('');

        try {
            const cacheBuster = `_cb=${Date.now()}`;
            const urlWithCb = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
            const proxyUrls = [
                `/api/proxy?url=${encodeURIComponent(urlWithCb)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithCb)}`
            ];

            let html = '';
            for (const proxyUrl of proxyUrls) {
                try {
                    const response = await fetch(
                        proxyUrl,
                        proxyUrl.startsWith('/api/proxy')
                            ? { headers: { 'Cache-Control': 'no-cache' } }
                            : undefined
                    );
                    if (response.ok) {
                        html = await response.text();
                        if (html.includes('<html') && !html.includes('SEOX</title>')) break;
                    }
                } catch (e) { continue; }
            }

            if (!html) throw new Error('Failed to fetch page');

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const headings = [];
            doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
                const level = parseInt(el.tagName.substring(1));
                const text = el.textContent.trim();
                if (text && !isExcludedHeading(text)) {
                    headings.push({ level, text, id: `h-${Date.now()}-${Math.random()}` });
                }
            });

            const title = headings.find(h => h.level === 1)?.text || doc.querySelector('title')?.textContent || new URL(url).hostname;
            setExtractedOutlines(prev => ({ ...prev, [url]: { url, title, headings, extractedAt: new Date().toISOString() } }));
            setExpandedOutlines(prev => ({ ...prev, [url]: true }));
        } catch (err) {
            setOutlineError(`Failed: ${err.message}`);
        } finally {
            setIsExtracting(prev => ({ ...prev, [index]: false }));
        }
    };

    // Extract all outlines at once
    const [isExtractingAll, setIsExtractingAll] = useState(false);

    const extractAllOutlines = async () => {
        const validUrls = competitors.filter(u => u.trim());
        if (validUrls.length === 0) return;

        setIsExtractingAll(true);
        setOutlineError('');

        // Set all as extracting
        const extractingState = {};
        validUrls.forEach((_, i) => extractingState[i] = true);
        setIsExtracting(extractingState);

        try {
            // Extract all in parallel
            await Promise.all(validUrls.map((url, index) => extractOutline(url, index)));
        } catch (e) {
            console.error('Extract all error:', e);
        }

        setIsExtractingAll(false);
    };

    const combineOutlinesWithAI = async () => {
        const outlines = Object.values(extractedOutlines);
        if (outlines.length < 2) { setOutlineError('Need at least 2 outlines'); return; }
        setIsCombining(true);

        try {
            const outlinesText = outlines.map((o, i) => {
                const headingsList = o.headings.map(h => `${'  '.repeat(h.level - 1)}<H${h.level}> ${h.text}`).join('\n');
                return `--- Source ${i + 1}: ${o.url} ---\n${headingsList}`;
            }).join('\n\n');

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Combine these article outlines into one comprehensive outline:\n\n${outlinesText}\n\nReturn JSON: { "headings": [{ "level": 1, "text": "..." }] }`,
                    systemInstruction: 'You are an SEO content strategist. Combine outlines logically, remove duplicates, maintain hierarchy.',
                    responseMimeType: 'application/json',
                    temperature: 0.3
                })
            });

            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setCombinedOutline(parsed.headings.map((h, i) => ({ ...h, id: `combined-${i}` })));
        } catch (err) {
            setOutlineError('AI combination failed');
        } finally {
            setIsCombining(false);
        }
    };

    const updateHeadingText = (id, newText) => {
        setCombinedOutline(prev => prev.map(h => h.id === id ? { ...h, text: newText } : h));
    };

    const updateHeadingLevel = (id, newLevel) => {
        setCombinedOutline(prev => prev.map(h => h.id === id ? { ...h, level: newLevel } : h));
    };

    const moveHeading = (fromIdx, toIdx) => {
        setCombinedOutline(prev => {
            const copy = [...prev];
            const [item] = copy.splice(fromIdx, 1);
            copy.splice(toIdx, 0, item);
            return copy;
        });
    };

    const deleteHeading = (id) => {
        setCombinedOutline(prev => prev.filter(h => h.id !== id));
    };

    // Add new heading
    const [newHeadingText, setNewHeadingText] = useState('');
    const [newHeadingLevel, setNewHeadingLevel] = useState(2);

    const addHeading = () => {
        if (!newHeadingText.trim()) return;
        const newHeading = {
            id: `heading-${Date.now()}`,
            level: newHeadingLevel,
            text: newHeadingText.trim()
        };
        setCombinedOutline(prev => [...prev, newHeading]);
        setNewHeadingText('');
    };

    // Drag index for outline reordering
    const [draggingIdx, setDraggingIdx] = useState(null);

    // Step 12 Content Editor state (moved to top level to avoid hooks violation)
    const [step12SidebarTab, setStep12SidebarTab] = useState('guidelines');
    const [step12TermSearch, setStep12TermSearch] = useState('');
    const [step12TermFilter, setStep12TermFilter] = useState('all');
    const [optimizationTab, setOptimizationTab] = useState('overview');
    const [showPromptModal, setShowPromptModal] = useState(false);
    const editorRef = useRef(null);
    const savedSelectionRef = useRef(null);
    const savedBlockRef = useRef(null);
    const savedBlockRangeRef = useRef({ start: null, end: null });
    const isRestoringRef = useRef(false);
    const isUserInputRef = useRef(false);

    // Sync content state → editor DOM only for programmatic changes (AI generation, formatting, etc.)
    useEffect(() => {
        if (isUserInputRef.current) {
            isUserInputRef.current = false;
            return;
        }
        if (editorRef.current && currentStep === 13) {
            editorRef.current.innerHTML = content;
        }
    }, [content, currentStep]);

    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer) && !isRestoringRef.current) {
                savedSelectionRef.current = range.cloneRange();
                let node = range.commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentElement;
                }
                const startBlockCandidate = node?.closest?.('p,h1,h2,h3,h4,h5,h6,div') || null;
                const startBlock = startBlockCandidate === editorRef.current ? null : startBlockCandidate;
                let endNode = range.endContainer;
                if (endNode?.nodeType === Node.TEXT_NODE) {
                    endNode = endNode.parentElement;
                }
                const endBlockCandidate = endNode?.closest?.('p,h1,h2,h3,h4,h5,h6,div') || null;
                const endBlock = endBlockCandidate === editorRef.current ? null : endBlockCandidate;
                savedBlockRef.current = startBlock;

                const blocks = editorRef.current.querySelectorAll('p,h1,h2,h3,h4,h5,h6,div');
                const startIndex = startBlock ? Array.prototype.indexOf.call(blocks, startBlock) : null;
                const endIndex = endBlock ? Array.prototype.indexOf.call(blocks, endBlock) : null;
                savedBlockRangeRef.current = { start: startIndex, end: endIndex };
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    // Drag and drop handlers for outline reordering
    const handleDragStart = (e, idx) => {
        setDraggingIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        if (draggingIdx === null || draggingIdx === idx) return;
    };

    const handleDrop = (e, targetIdx) => {
        e.preventDefault();
        if (draggingIdx === null || draggingIdx === targetIdx) return;
        moveHeading(draggingIdx, targetIdx);
        setDraggingIdx(null);
    };

    const handleDragEnd = () => {
        setDraggingIdx(null);
    };

    const renderStep2 = () => {
        const validUrls = competitors.filter(u => u.trim());
        const outlinesList = Object.values(extractedOutlines);

        return (
            <div className="space-y-6">
                {/* Extract from competitors */}
                <div className="ctool-card">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <List className="w-5 h-5 text-emerald-600" />
                        Extract Outlines from Competitors
                    </h3>
                    <div className="space-y-3">
                        {validUrls.map((url, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <span className="flex-1 text-sm text-white/60 truncate">{url}</span>
                                <span className={`px-2 py-1 rounded text-xs ${extractedOutlines[url] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-100 text-white/50'}`}>
                                    {extractedOutlines[url] ? `${extractedOutlines[url].headings.length} headings` : 'Not extracted'}
                                </span>
                                <button
                                    onClick={() => extractOutline(url, index)}
                                    disabled={isExtracting[index]}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isExtracting[index] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Extract
                                </button>
                            </div>
                        ))}
                    </div>
                    {validUrls.length === 0 && (
                        <p className="text-white/50 text-sm">Add competitor URLs in Step 1 first.</p>
                    )}
                    {validUrls.length >= 2 && (
                        <button
                            onClick={extractAllOutlines}
                            disabled={isExtractingAll}
                            className="mt-4 w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                        >
                            {isExtractingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            Extract All Outlines
                        </button>
                    )}
                    {outlineError && <p className="mt-3 text-red-600 text-sm">{outlineError}</p>}
                </div>

                {/* Combine button or Use single outline button */}
                {outlinesList.length === 1 && (
                    <button
                        onClick={() => {
                            const outline = outlinesList[0];
                            setCombinedOutline(outline.headings.map((h, i) => ({ ...h, id: `single-${i}` })));
                        }}
                        className="w-full py-4 bg-gradient-to-r from-brand-500 to-brand-500 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-5 h-5" />
                        Use This Outline
                    </button>
                )}
                {outlinesList.length >= 2 && (
                    <button
                        onClick={combineOutlinesWithAI}
                        disabled={isCombining}
                        className="w-full py-4 bg-gradient-to-r from-brand-500 to-brand-500 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                        {isCombining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        Combine Outlines with AI
                    </button>
                )}

                {/* Combined Outline Editor - ALWAYS VISIBLE for manual creation */}
                <div className="rounded-2xl border-2 border-brand-500/30 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-brand-500" />
                        {combinedOutline.length > 0
                            ? `Article Outline (${combinedOutline.length} headings)`
                            : 'Create Your Article Outline'
                        }
                    </h3>

                    {combinedOutline.length === 0 && (
                        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-amber-300 font-medium">No headings yet</p>
                                <p className="text-sm text-amber-700">Add headings manually below, or extract from competitors and combine with AI above.</p>
                            </div>
                        </div>
                    )}

                    {/* Headings List - Draggable */}
                    {combinedOutline.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {combinedOutline.map((heading, idx) => (
                                <div
                                    key={heading.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className={`flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg hover:bg-brand-500/150/10 group cursor-move transition ${draggingIdx === idx ? 'opacity-50 bg-brand-500/15' : ''}`}
                                    style={{ marginLeft: `${(heading.level - 1) * 20}px` }}
                                >
                                    <GripVertical className="w-4 h-4 text-white/40 cursor-grab" />
                                    <button onClick={() => idx > 0 && moveHeading(idx, idx - 1)} className="p-1 text-white/40 hover:text-white/60"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => idx < combinedOutline.length - 1 && moveHeading(idx, idx + 1)} className="p-1 text-white/40 hover:text-white/60"><ChevronDown className="w-4 h-4" /></button>
                                    <select
                                        value={heading.level}
                                        onChange={(e) => updateHeadingLevel(heading.id, parseInt(e.target.value))}
                                        className="px-2 py-1 bg-brand-500/15 text-brand-300 rounded text-xs font-bold"
                                    >
                                        {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>H{l}</option>)}
                                    </select>
                                    <input
                                        type="text"
                                        value={heading.text}
                                        onChange={(e) => updateHeadingText(heading.id, e.target.value)}
                                        className="flex-1 px-2 py-1 bg-transparent border-b border-transparent hover:border-white/15 focus:border-brand-500 outline-none text-white"
                                    />
                                    <button onClick={() => deleteHeading(heading.id)} className="p-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add New Heading Input - ALWAYS VISIBLE */}
                    <div className="flex items-center gap-2 p-3 border-2 border-dashed border-brand-200 rounded-xl bg-brand-500/100/10">
                        <select
                            value={newHeadingLevel}
                            onChange={(e) => setNewHeadingLevel(parseInt(e.target.value))}
                            className="px-2 py-1.5 bg-brand-500/15 text-brand-300 rounded text-xs font-bold"
                        >
                            {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>H{l}</option>)}
                        </select>
                        <input
                            type="text"
                            value={newHeadingText}
                            onChange={(e) => setNewHeadingText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addHeading()}
                            placeholder="Add new heading..."
                            className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-brand-500/20 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-white"
                        />
                        <button
                            onClick={addHeading}
                            disabled={!newHeadingText.trim()}
                            className="px-4 py-1.5 bg-brand-500/100 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Extracted Outlines Display */}
                {outlinesList.length > 0 && (
                    <div className="ctool-card">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-brand-500" />
                            Extracted Outlines ({outlinesList.length})
                        </h3>
                        <div className="space-y-4">
                            {outlinesList.map((outline, idx) => (
                                <div key={outline.url} className="border border-white/10 rounded-xl overflow-hidden">
                                    {/* Outline Header - Collapsible */}
                                    <div
                                        className="flex items-center justify-between p-4 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition"
                                        onClick={() => setExpandedOutlines(prev => ({ ...prev, [outline.url]: !prev[outline.url] }))}
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedOutlines[outline.url] ? (
                                                <ChevronUp className="w-5 h-5 text-white/50" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-white/50" />
                                            )}
                                            <div>
                                                <h4 className="font-semibold text-white">{outline.title || 'Untitled'}</h4>
                                                <p className="text-xs text-white/50 truncate max-w-md">{outline.url}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-brand-500/15 text-brand-300 rounded-lg text-xs font-medium">
                                                {outline.headings.length} headings
                                            </span>
                                            <a
                                                href={outline.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 text-white/50 hover:text-brand-500 hover:bg-brand-500/150/10 rounded-lg transition"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Outline Content - Expanded */}
                                    {expandedOutlines[outline.url] && (
                                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto bg-white/[0.02]">
                                            {outline.headings.map((heading, hIdx) => {
                                                const levelColors = {
                                                    1: 'bg-brand-500/100 text-white',
                                                    2: 'bg-brand-500/100 text-white',
                                                    3: 'bg-brand-400 text-white',
                                                    4: 'bg-brand-300 text-brand-300',
                                                    5: 'bg-brand-200 text-brand-300',
                                                    6: 'bg-brand-500/15 text-brand-300'
                                                };
                                                const levelStyles = {
                                                    1: 'text-lg font-bold text-white',
                                                    2: 'text-base font-semibold text-brand-600',
                                                    3: 'text-sm font-medium text-white/60',
                                                    4: 'text-sm text-white/50',
                                                    5: 'text-xs text-white/50',
                                                    6: 'text-xs text-white/40'
                                                };
                                                const indents = { 1: 0, 2: 24, 3: 48, 4: 72, 5: 96, 6: 120 };
                                                return (
                                                    <div key={hIdx} className="flex items-start gap-3" style={{ marginLeft: `${indents[heading.level] || 0}px` }}>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${levelColors[heading.level] || levelColors[6]}`}>
                                                            H{heading.level}
                                                        </span>
                                                        <span className={levelStyles[heading.level] || levelStyles[6]}>
                                                            {heading.text}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Step 3: Competitor Content - Optional writing style inspiration
    const [extractUrl, setExtractUrl] = useState('');
    const [isExtractingContent, setIsExtractingContent] = useState(false);

    // Extract article content from URL
    const extractContentFromUrl = async (urlToExtract = null) => {
        const targetUrl = urlToExtract || extractUrl.trim();
        if (!targetUrl) return;
        setIsExtractingContent(true);
        if (urlToExtract) setExtractUrl(urlToExtract); // Update state for UI

        try {
            // Fetch the page content using merged endpoint
            const response = await fetch('/api/fetch-url-meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl, returnHtml: true })
            });

            if (!response.ok) throw new Error('Failed to fetch URL');

            const data = await response.json();
            const html = data.html || '';

            // Parse HTML and extract article content
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Try to find article tag first, then fallback to main/body
            let contentElement = doc.querySelector('article');
            if (!contentElement) contentElement = doc.querySelector('main');
            if (!contentElement) contentElement = doc.querySelector('.content, .post-content, .entry-content, .article-content');
            if (!contentElement) contentElement = doc.body;

            if (contentElement) {
                // Remove script, style, nav, header, footer, aside elements
                ['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'noscript', 'svg'].forEach(tag => {
                    contentElement.querySelectorAll(tag).forEach(el => el.remove());
                });

                // Build formatted HTML preserving structure
                let extractedHtml = '';

                // Process headings and paragraphs to preserve formatting
                const processNode = (node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent.trim();
                        if (text) return text + ' ';
                        return '';
                    }

                    if (node.nodeType !== Node.ELEMENT_NODE) return '';

                    const tagName = node.tagName.toLowerCase();

                    // Skip hidden elements
                    if (node.style?.display === 'none' || node.hidden) return '';

                    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
                    const blockTags = ['p', 'div', 'section', 'article', 'blockquote', 'li', 'tr', 'br', 'hr', ...headingTags];
                    const inlineTags = ['strong', 'b', 'em', 'i', 'u'];

                    let result = '';

                    // For headings, wrap in heading tags
                    if (headingTags.includes(tagName)) {
                        const headingText = node.textContent.trim();
                        if (headingText) {
                            return `<${tagName}>${headingText}</${tagName}>\n`;
                        }
                    }

                    // For bold/italic, preserve the tags
                    if (inlineTags.includes(tagName)) {
                        let innerContent = '';
                        for (const child of node.childNodes) {
                            innerContent += processNode(child);
                        }
                        return `<${tagName}>${innerContent.trim()}</${tagName}>`;
                    }

                    // Process children
                    for (const child of node.childNodes) {
                        result += processNode(child);
                    }

                    // Wrap paragraphs
                    if (tagName === 'p' && result.trim()) {
                        return `<p>${result.trim()}</p>\n`;
                    }

                    // Handle list items
                    if (tagName === 'li' && result.trim()) {
                        return `<li>${result.trim()}</li>\n`;
                    }

                    // Handle lists
                    if (tagName === 'ul' || tagName === 'ol') {
                        return `<${tagName}>\n${result}</${tagName}>\n`;
                    }

                    // Add line break for other block elements
                    if (blockTags.includes(tagName) && result.trim()) {
                        return result + '\n';
                    }

                    return result;
                };

                extractedHtml = processNode(contentElement);

                // Clean up excessive whitespace while preserving paragraph breaks
                extractedHtml = extractedHtml
                    .replace(/\n{3,}/g, '\n\n')        // Max 2 newlines
                    .replace(/^\s+|\s+$/g, '')         // Trim start/end
                    .trim();

                // Append to existing content with separator
                if (extractedHtml) {
                    const separator = competitorContent ? '\n\n<hr/><p><em>--- Extracted from: ' + targetUrl + ' ---</em></p>\n\n' : '';
                    setCompetitorContent(prev => prev + separator + extractedHtml);
                    setExtractUrl(''); // Clear URL input after successful extraction
                }
            }
        } catch (e) {
            console.error('Content extraction error:', e);
            alert('Failed to extract content from URL. Please try pasting the content manually.');
        }

        setIsExtractingContent(false);
    };

    const Step3CompetitorContent = () => {
        const wordCount = countWords(htmlToPlainText(competitorContent));
        const manualWordCount = countWords(manualCompetitorContent);

        const applyManualCompetitorContent = (mode = 'append') => {
            const formattedContent = formatManualContentToHtml(manualCompetitorContent);
            if (!formattedContent) return;

            if (mode === 'replace' || !competitorContent) {
                setCompetitorContent(formattedContent);
            } else {
                const separator = '\n\n<hr/><p><em>--- Manually added content ---</em></p>\n\n';
                setCompetitorContent(prev => `${prev}${separator}${formattedContent}`);
            }

            setManualCompetitorContent('');
        };

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-8 h-8" />
                        <div>
                            <h3 className="text-xl font-bold">Competitor Content Analysis</h3>
                            <p className="text-orange-100 text-sm">Paste competitor content to inspire AI writing style (optional)</p>
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-300">
                        <p className="font-medium mb-1">This step is optional</p>
                        <p>Paste competitor content to help AI understand the writing style, tone, and structure used in top-ranking articles. This helps create content that matches search intent.</p>
                    </div>
                </div>

                {/* Extract from Competitor URLs */}
                <div className="ctool-card">
                    <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                        <Globe className="w-4 h-4 text-brand-400" />
                        Extract Content from Competitors
                    </h4>
                    {competitors.filter(u => u.trim()).length > 0 ? (
                        <div className="space-y-3">
                            {competitors.filter(u => u.trim()).map((url, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="flex-1 text-sm text-white/60 truncate">{url}</span>
                                    <button
                                        onClick={() => extractContentFromUrl(url)}
                                        disabled={isExtractingContent}
                                        className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isExtractingContent && extractUrl === url ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        Extract
                                    </button>
                                </div>
                            ))}
                            {/* Re-extract All Button */}
                            {competitorContent && (
                                <button
                                    onClick={async () => {
                                        setCompetitorContent(''); // Clear old content
                                        const validUrls = competitors.filter(u => u.trim());
                                        for (const url of validUrls) {
                                            await extractContentFromUrl(url);
                                        }
                                    }}
                                    disabled={isExtractingContent}
                                    className="w-full mt-3 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Re-extract All (Clear & Refresh)
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="text-white/50 text-sm">Add competitor URLs in Step 1 first to extract content from them.</p>
                    )}
                </div>

                {/* Manual Paste Area */}
                <div className="ctool-card">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                            <FileEdit className="w-4 h-4 text-brand-400" />
                            Add Content Manually
                        </h4>
                        <span className="text-sm text-white/50">{manualWordCount} words</span>
                    </div>
                    <textarea
                        value={manualCompetitorContent}
                        onChange={(e) => setManualCompetitorContent(e.target.value)}
                        placeholder="Paste competitor article text, notes, or excerpts here. Plain text will be formatted automatically when added."
                        className="w-full h-48 px-4 py-3 border border-white/10 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white/75"
                    />
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => applyManualCompetitorContent('append')}
                            disabled={!manualCompetitorContent.trim()}
                            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {competitorContent ? 'Add to Competitor Content' : 'Use as Competitor Content'}
                        </button>
                        <button
                            onClick={() => applyManualCompetitorContent('replace')}
                            disabled={!manualCompetitorContent.trim()}
                            className="px-4 py-2 border border-orange-200 text-orange-700 bg-orange-50 rounded-lg text-sm font-medium hover:bg-orange-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Replace Existing Content
                        </button>
                        {manualCompetitorContent && (
                            <button
                                onClick={() => setManualCompetitorContent('')}
                                className="text-sm text-white/50 hover:text-white/75"
                            >
                                Clear Draft
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-white/50 mt-3">
                        Use this when extraction misses content or when you want to paste text from a PDF, doc, or another source.
                    </p>
                </div>

                {/* Content Input */}
                <div className="ctool-card">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-brand-400" />
                            Competitor Content
                        </h4>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-white/50">{wordCount} words</span>
                            {competitorContent && (
                                <button
                                    onClick={() => setCompetitorContent('')}
                                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" /> Clear
                                </button>
                            )}
                        </div>
                    </div>
                    {competitorContent ? (
                        <div className="w-full h-80 border border-white/10 rounded-xl overflow-y-auto bg-white/[0.02]">
                            <style>{`
                                .competitor-content h1 { font-size: 1.75rem; font-weight: 700; color: #1e293b; margin: 1.5rem 0 0.75rem 0; line-height: 1.2; }
                                .competitor-content h2 { font-size: 1.5rem; font-weight: 600; color: #334155; margin: 1.25rem 0 0.5rem 0; line-height: 1.3; }
                                .competitor-content h3 { font-size: 1.25rem; font-weight: 600; color: #475569; margin: 1rem 0 0.5rem 0; line-height: 1.4; }
                                .competitor-content h4 { font-size: 1.125rem; font-weight: 500; color: #475569; margin: 0.75rem 0 0.5rem 0; }
                                .competitor-content h5 { font-size: 1rem; font-weight: 500; color: #64748b; margin: 0.5rem 0 0.25rem 0; }
                                .competitor-content h6 { font-size: 0.875rem; font-weight: 500; color: #64748b; margin: 0.5rem 0 0.25rem 0; }
                                .competitor-content p { margin: 0.75rem 0; line-height: 1.6; color: #374151; }
                                .competitor-content ul, .competitor-content ol { margin: 0.5rem 0 0.5rem 1.5rem; }
                                .competitor-content li { margin: 0.25rem 0; line-height: 1.5; }
                                .competitor-content strong, .competitor-content b { font-weight: 700; }
                                .competitor-content em, .competitor-content i { font-style: italic; }
                                .competitor-content hr { margin: 1rem 0; border-color: #e5e7eb; }
                                .competitor-content:focus { outline: 2px solid #df3c27; outline-offset: -2px; }
                            `}</style>
                            <div
                                className="competitor-content px-4 py-3 text-white/75 min-h-full"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => setCompetitorContent(e.target.innerHTML)}
                                dangerouslySetInnerHTML={{ __html: competitorContent }}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-80 px-4 py-3 border border-white/10 rounded-xl bg-white/[0.03] text-white/40 flex flex-col justify-center items-center text-center">
                            <FileText className="w-12 h-12 mb-4 text-white/30" />
                            <p className="font-medium text-white/50 mb-2">No content extracted yet</p>
                            <p className="text-sm">Click "Extract" above or use the manual input box to add competitor content</p>
                        </div>
                    )}
                </div>

                {/* What AI Will Extract */}
                {competitorContent && wordCount >= 100 && (
                    <div className="ctool-card">
                        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-brand-400" />
                            AI Will Analyze
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Writing Tone', icon: '✍️', desc: 'Formal, casual, conversational' },
                                { label: 'Sentence Style', icon: '📝', desc: 'Length and complexity' },
                                { label: 'Vocabulary Level', icon: '📚', desc: 'Technical vs simple' },
                                { label: 'Content Structure', icon: '🏗️', desc: 'How ideas flow' }
                            ].map((item, i) => (
                                <div key={i} className="bg-orange-50 rounded-xl p-4 text-center">
                                    <div className="text-2xl mb-2">{item.icon}</div>
                                    <div className="font-medium text-white text-sm">{item.label}</div>
                                    <div className="text-xs text-white/50 mt-1">{item.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Skip Notice */}
                <div className="text-center text-sm text-white/50">
                    <p>Don't have competitor content? No problem! Click <span className="font-medium">Next</span> to continue.</p>
                </div>
            </div>
        );
    };

    // Step 4: Keyword Research - Full Implementation
    const [isLoadingKeywords, setIsLoadingKeywords] = useState({});

    // Extract entities from competitor content (improved prompt)
    const fetchCompetitorEntities = async () => {
        if (!competitorContent && Object.keys(extractedOutlines).length === 0) return;
        setIsLoadingKeywords(prev => ({ ...prev, entities: true }));
        try {
            // Use actual competitor content if available, fallback to outlines
            const textToAnalyze = competitorContent ||
                Object.values(extractedOutlines).map(o => o.headings.map(h => h.text).join(' ')).join(' ');

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `You are an expert NLP entity extractor. Extract ALL named entities from the following content. Be comprehensive and thorough.

Categories to extract:
- People (names, titles, experts)
- Organizations (companies, brands, institutions)
- Places (locations, countries, cities)
- Products (tools, software, items)
- Concepts (technical terms, methodologies, theories)
- Events (conferences, releases, milestones)

Content to analyze:
"""
${textToAnalyze.slice(0, 8000)}
"""

Return JSON: {"entities": ["entity1", "entity2", ...]}
Extract at least 30-50 entities if the content supports it.`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            // Deduplicate entities case-insensitively
            const uniqueEntities = [...new Map(
                (parsed.entities || []).map(e => [e.toLowerCase().trim(), e])
            ).values()];
            setKeywordData(prev => ({ ...prev, competitorEntities: uniqueEntities }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, entities: false }));
    };

    // Generate AI entities (improved)
    const fetchAIEntities = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, aiEntities: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate 30 highly relevant entities for SEO content about "${mainKeyword}".

Include:
- Industry leaders and experts in this field
- Major brands and companies
- Key concepts and methodologies
- Related tools and technologies
- Important locations if applicable
- Trending topics in this space

Return JSON: {"entities": ["entity1", "entity2", ...]}`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, aiEntities: parsed.entities || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, aiEntities: false }));
    };

    // Extract N-Grams from competitor content (3-4 word phrases)
    const fetchCompetitorNgrams = async () => {
        if (!competitorContent && Object.keys(extractedOutlines).length === 0) return;
        setIsLoadingKeywords(prev => ({ ...prev, competitorNgrams: true }));
        try {
            const textToAnalyze = competitorContent ||
                Object.values(extractedOutlines).map(o => o.headings.map(h => h.text).join(' ')).join(' ');

            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Extract meaningful 3-4 word phrases (n-grams) from the following content. These should be actual phrases used in the content, not generated.

Content:
"""
${textToAnalyze.slice(0, 8000)}
"""

Extract 30-50 meaningful phrases that:
- Are 3-4 words long
- Represent key concepts or ideas
- Would be useful for SEO optimization

Return JSON: {"ngrams": ["phrase 1", "phrase 2", ...]}`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, competitorNgrams: parsed.ngrams || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, competitorNgrams: false }));
    };

    // AI picks best n-grams from competitor extracted ones
    const fetchAIPickedNgrams = async () => {
        if (keywordData.competitorNgrams.length === 0) return;
        setIsLoadingKeywords(prev => ({ ...prev, aiPickedNgrams: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `From these n-grams extracted from competitor content, pick the 15 BEST ones for SEO optimization of content about "${mainKeyword}":

Available n-grams:
${keywordData.competitorNgrams.join(', ')}

Select the most:
- Relevant to the main topic
- Unique and specific
- SEO valuable
- Natural sounding

Return JSON: {"picked": ["phrase 1", "phrase 2", ...]}`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, aiPickedNgrams: parsed.picked || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, aiPickedNgrams: false }));
    };

    // AI generates new n-grams
    const fetchAIGeneratedNgrams = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, aiGeneratedNgrams: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate 25 SEO-optimized 3-4 word phrases (n-grams) for content about "${mainKeyword}".

These should be:
- Natural language phrases
- Commonly searched variations
- Topic-relevant combinations
- Good for semantic SEO

Return JSON: {"ngrams": ["phrase 1", "phrase 2", ...]}`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, aiGeneratedNgrams: parsed.ngrams || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, aiGeneratedNgrams: false }));
    };

    // Generate unique n-grams (uncommon but relevant phrases)
    const fetchUniqueNgrams = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, uniqueNgrams: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate 20 UNIQUE and UNCOMMON 3-4 word phrases for "${mainKeyword}" that competitors rarely use.

These unique n-grams should:
- Be original word combinations not commonly found elsewhere
- Add specific, detailed angles to the topic
- Help content rank for niche queries
- Signal expertise and authority

Examples of unique angles:
- Time-specific: "during winter months"
- Context-specific: "for small businesses"
- Action-specific: "before making decisions"

Return JSON: {"ngrams": ["unique phrase 1", "unique phrase 2", ...]}`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, uniqueNgrams: parsed.ngrams || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, uniqueNgrams: false }));
    };

    // Legacy n-grams function (keep for compatibility)
    const fetchNgrams = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, ngrams: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate SEO-optimized n-grams for "${mainKeyword}". Return JSON: {"threeGrams": ["phrase 1", ...], "fourGrams": ["phrase 1", ...], "aiPicked": ["best 5 phrases"] }`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, ngrams: parsed }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, ngrams: false }));
    };


    const fetchNLPKeywords = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, nlpKeywords: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Extract NLP keywords and semantic terms for SEO optimization related to "${mainKeyword}". Focus on latent semantic indexing (LSI) keywords. Return JSON: {"keywords": ["keyword1", "keyword2", ...] }`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, nlpKeywords: parsed.keywords || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, nlpKeywords: false }));
    };

    const fetchSkipGrams = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, skipGrams: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate skip-gram dominant words for the topic "${mainKeyword}".

                Skip-grams are semantically important word pairs that often appear together (with possible gaps) when discussing this topic. These should be key concept pairs that define the topic's vocabulary.

                Generate 20-30 topic-defining skip-gram word pairs that would be found in high-quality content about "${mainKeyword}".

                Return JSON: {"skipGrams": ["word pair 1", "word pair 2", ...] }`,
                    systemInstruction: 'You are an NLP expert. Generate semantically significant skip-gram word pairs that are dominant in content about this topic.',
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, skipGrams: parsed.skipGrams || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, skipGrams: false }));
    };

    const fetchGrammarElements = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, grammar: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Analyze grammar elements for content about "${mainKeyword}". Return JSON: {"nouns": ["noun1", ...], "verbs": ["verb1", ...], "adjectives": ["adj1", ...], "adverbs": ["adv1", ...] }`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, grammar: parsed }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, grammar: false }));
    };

    const fetchAutoSuggest = async () => {
        if (!mainKeyword) return;
        setIsLoadingKeywords(prev => ({ ...prev, autoSuggest: true }));
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate Google auto-suggest style keyword suggestions for "${mainKeyword}". Include "what", "how", "why", "best", "vs" variations. Return JSON: {"suggestions": ["suggestion1", ...] }`,
                    responseMimeType: 'application/json'
                })
            });
            const data = await response.json();
            const parsed = JSON.parse(data.text);
            setKeywordData(prev => ({ ...prev, autoSuggest: parsed.suggestions || [] }));
        } catch (e) { console.error(e); }
        setIsLoadingKeywords(prev => ({ ...prev, autoSuggest: false }));
    };

    const fetchAllKeywordData = async () => {
        await Promise.all([
            fetchCompetitorEntities(),
            fetchAIEntities(),
            fetchNgrams(),
            fetchNLPKeywords(),
            fetchSkipGrams()
        ]);
    };

    const Step4Entities = () => {
        const renderEntityItem = (item, category, colorClass) => {
            const isExcluded = excludedItems[category]?.has(item);
            return (
                <span
                    key={item}
                    className={`group relative px-2 py-1 pr-6 rounded-lg text-xs border cursor-pointer transition-all ${isExcluded ? 'bg-gray-100 border-white/15 text-white/40 line-through' : colorClass
                        }`}
                    onClick={() => toggleExclusion(category, item)}
                    title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                    {item}
                    <X className={`w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 ${isExcluded ? 'text-white/40' : 'text-white/40 opacity-60 group-hover:opacity-100 group-hover:text-red-400'
                        }`} />
                </span>
            );
        };

        return (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={fetchCompetitorEntities}
                        disabled={(!competitorContent && Object.keys(extractedOutlines).length === 0) || isLoadingKeywords.entities}
                        className="flex-1 min-w-[200px] py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoadingKeywords.entities ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                        Extract from Competitors
                    </button>
                    <button
                        onClick={fetchAIEntities}
                        disabled={!mainKeyword || isLoadingKeywords.aiEntities}
                        className="flex-1 min-w-[200px] py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoadingKeywords.aiEntities ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate AI Entities
                    </button>
                </div>

                <p className="text-xs text-white/50 flex items-center gap-1">
                    <X className="w-3 h-3" /> Click an entity to exclude it from the mega prompt
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Competitor Entities */}
                    <div className="ctool-card scw-card-sm">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-3">
                            <Layers className="w-4 h-4 text-brand-500" />
                            Competitor Entities
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.competitorEntities?.length || 0) - (excludedItems.competitorEntities?.size || 0)}/{keywordData.competitorEntities?.length || 0}
                            </span>
                            {keywordData.competitorEntities?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, competitorEntities: new Set(keywordData.competitorEntities) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                    title="Ignore all competitor entities"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        {isLoadingKeywords.entities ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.competitorEntities?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                {keywordData.competitorEntities.map((item) =>
                                    renderEntityItem(item, 'competitorEntities', 'bg-brand-500/100/10 border-brand-500/20 text-brand-600')
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Click "Extract from Competitors" above</p>
                        )}
                    </div>

                    {/* AI Generated Entities */}
                    <div className="ctool-card scw-card-sm">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-brand-500" />
                            AI-Generated Entities
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.aiEntities?.length || 0) - (excludedItems.aiEntities?.size || 0)}/{keywordData.aiEntities?.length || 0}
                            </span>
                            {keywordData.aiEntities?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, aiEntities: new Set(keywordData.aiEntities) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                    title="Ignore all AI entities"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        {isLoadingKeywords.aiEntities ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.aiEntities?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                {keywordData.aiEntities.map((item) =>
                                    renderEntityItem(item, 'aiEntities', 'bg-brand-500/100/10 border-brand-500/20 text-brand-600')
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Click "Generate AI Entities" above</p>
                        )}
                    </div>

                </div>
            </div>
        );
    };

    const Step5NGrams = () => {
        const renderNgramItem = (item, category, colorClass, defaultExcluded = false) => {
            // Initialize exclusion state on first render for default-excluded items
            const isExcluded = excludedItems[category]?.has(item);
            return (
                <span
                    key={item}
                    className={`group relative px-2 py-1 pr-6 rounded-lg text-xs border cursor-pointer transition-all ${isExcluded ? 'bg-gray-100 border-white/15 text-white/40 line-through' : colorClass
                        }`}
                    onClick={() => toggleExclusion(category, item)}
                    title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                    {item}
                    <X className={`w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 ${isExcluded ? 'text-white/40' : 'text-white/40 opacity-60 group-hover:opacity-100 group-hover:text-red-400'
                        }`} />
                </span>
            );
        };

        return (
            <div className="space-y-6">
                {/* Action Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={fetchCompetitorNgrams}
                        disabled={(!competitorContent && Object.keys(extractedOutlines).length === 0) || isLoadingKeywords.competitorNgrams}
                        className="py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                        {isLoadingKeywords.competitorNgrams ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                        Extract Competitor
                    </button>
                    <button
                        onClick={async () => {
                            await fetchAIPickedNgrams();
                            // Auto-exclude all competitor n-grams when AI picks best
                            if (keywordData.competitorNgrams?.length > 0) {
                                setExcludedItems(prev => ({ ...prev, competitorNgrams: new Set(keywordData.competitorNgrams) }));
                            }
                        }}
                        disabled={keywordData.competitorNgrams?.length === 0 || isLoadingKeywords.aiPickedNgrams}
                        className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                        {isLoadingKeywords.aiPickedNgrams ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        AI Pick Best
                    </button>
                    <button
                        onClick={fetchAIGeneratedNgrams}
                        disabled={!mainKeyword || isLoadingKeywords.aiGeneratedNgrams}
                        className="py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                        {isLoadingKeywords.aiGeneratedNgrams ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        AI Generate
                    </button>
                    <button
                        onClick={fetchUniqueNgrams}
                        disabled={!mainKeyword || isLoadingKeywords.uniqueNgrams}
                        className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                    >
                        {isLoadingKeywords.uniqueNgrams ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                        Unique N-Grams
                    </button>
                </div>

                <p className="text-xs text-white/50 flex items-center gap-1">
                    <X className="w-3 h-3" /> Click an n-gram to exclude it from the mega prompt
                </p>

                {/* N-Gram Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Competitor N-Grams (default: unchecked/excluded) */}
                    <div className="ctool-card scw-card-sm">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            Competitor N-Grams
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.competitorNgrams?.length || 0) - (excludedItems.competitorNgrams?.size || 0)}/{keywordData.competitorNgrams?.length || 0}
                            </span>
                            {keywordData.competitorNgrams?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, competitorNgrams: new Set(keywordData.competitorNgrams) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        <p className="text-xs text-white/40 mb-3">Extracted from competitor content (unchecked by default)</p>
                        {isLoadingKeywords.competitorNgrams ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.competitorNgrams?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {keywordData.competitorNgrams.map((item) =>
                                    renderNgramItem(item, 'competitorNgrams', 'bg-blue-50 border-blue-200 text-blue-700')
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Click "Extract Competitor" above</p>
                        )}
                    </div>

                    {/* AI Picked N-Grams (default: checked/included) */}
                    <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            AI Picked N-Grams
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.aiPickedNgrams?.length || 0) - (excludedItems.aiPickedNgrams?.size || 0)}/{keywordData.aiPickedNgrams?.length || 0}
                            </span>
                            {keywordData.aiPickedNgrams?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, aiPickedNgrams: new Set(keywordData.aiPickedNgrams) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        <p className="text-xs text-amber-400 mb-3">✓ Selected by AI (checked by default)</p>
                        {isLoadingKeywords.aiPickedNgrams ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.aiPickedNgrams?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {keywordData.aiPickedNgrams.map((item) =>
                                    renderNgramItem(item, 'aiPickedNgrams', 'bg-amber-50 border-amber-200 text-amber-700')
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Extract competitor n-grams first, then AI picks best</p>
                        )}
                    </div>

                    {/* AI Generated N-Grams */}
                    <div className="ctool-card scw-card-sm">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-brand-500" />
                            AI Generated N-Grams
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.aiGeneratedNgrams?.length || 0) - (excludedItems.aiGeneratedNgrams?.size || 0)}/{keywordData.aiGeneratedNgrams?.length || 0}
                            </span>
                            {keywordData.aiGeneratedNgrams?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, aiGeneratedNgrams: new Set(keywordData.aiGeneratedNgrams) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        <p className="text-xs text-white/40 mb-3">Fresh n-grams generated by AI</p>
                        {isLoadingKeywords.aiGeneratedNgrams ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.aiGeneratedNgrams?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {keywordData.aiGeneratedNgrams.map((item) =>
                                    renderNgramItem(item, 'aiGeneratedNgrams', 'bg-brand-500/100/10 border-brand-500/20 text-brand-600')
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Click "AI Generate" above</p>
                        )}
                    </div>

                    {/* Unique N-Grams */}
                    <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
                        <h4 className="font-semibold text-white flex items-center gap-2 mb-2">
                            <Star className="w-4 h-4 text-emerald-600" />
                            Unique N-Grams 🌟
                            <span className="ml-auto text-xs text-white/40">
                                {(keywordData.uniqueNgrams?.length || 0) - (excludedItems.uniqueNgrams?.size || 0)}/{keywordData.uniqueNgrams?.length || 0}
                            </span>
                            {keywordData.uniqueNgrams?.length > 0 && (
                                <button
                                    onClick={() => setExcludedItems(prev => ({ ...prev, uniqueNgrams: new Set(keywordData.uniqueNgrams) }))}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                >
                                    Ignore All
                                </button>
                            )}
                        </h4>
                        <p className="text-xs text-emerald-600 mb-3">Uncommon phrases that make your content stand out</p>
                        {isLoadingKeywords.uniqueNgrams ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                        ) : keywordData.uniqueNgrams?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                                {keywordData.uniqueNgrams.map((item) =>
                                    renderNgramItem(item, 'uniqueNgrams', 'bg-emerald-50 border-emerald-200 text-emerald-700')
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-white/50 space-y-2">
                                <p>Click "Unique N-Grams" to generate uncommon phrases.</p>
                                <details className="text-xs">
                                    <summary className="cursor-pointer text-emerald-600 font-medium">Why use unique n-grams? 🔍</summary>
                                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg">
                                        <p className="mb-1"><strong>What:</strong> Original word sequences rarely found elsewhere</p>
                                        <p className="mb-1"><strong>Why:</strong> Search engines see unique phrases as signals of expertise</p>
                                        <p><strong>Example:</strong> Instead of "health benefits of hot water", use "drinking hot water after dinner"</p>
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const Step6NLPKeywords = () => {
        const renderKeywordItem = (item) => {
            const isExcluded = excludedItems.nlpKeywords?.has(item);
            return (
                <span
                    key={item}
                    className={`group relative px-3 py-1.5 pr-7 rounded-lg text-sm border cursor-pointer transition-all ${isExcluded ? 'bg-gray-100 border-white/15 text-white/40 line-through' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                    onClick={() => toggleExclusion('nlpKeywords', item)}
                    title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                    {item}
                    <X className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 ${isExcluded ? 'text-white/40' : 'text-white/40 opacity-60 group-hover:opacity-100 group-hover:text-red-400'
                        }`} />
                </span>
            );
        };

        return (
            <div className="space-y-6">
                <button
                    onClick={fetchNLPKeywords}
                    disabled={!mainKeyword || isLoadingKeywords.nlpKeywords}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isLoadingKeywords.nlpKeywords ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    Generate NLP Keywords
                </button>

                <p className="text-xs text-white/50 flex items-center gap-1">
                    <X className="w-3 h-3" /> Click a keyword to exclude it • <Check className="w-3 h-3 text-emerald-600" /> All included by default
                </p>

                <div className="ctool-card">
                    <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-emerald-600" />
                        NLP Keywords (LSI Terms)
                        <span className="ml-auto text-sm text-white/40">
                            {(keywordData.nlpKeywords?.length || 0) - (excludedItems.nlpKeywords?.size || 0)}/{keywordData.nlpKeywords?.length || 0} selected
                        </span>
                        {keywordData.nlpKeywords?.length > 0 && (
                            <button
                                onClick={() => setExcludedItems(prev => ({ ...prev, nlpKeywords: new Set(keywordData.nlpKeywords) }))}
                                className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                            >
                                Ignore All
                            </button>
                        )}
                    </h4>
                    {isLoadingKeywords.nlpKeywords ? (
                        <div className="flex items-center gap-2 text-white/50"><Loader2 className="w-5 h-5 animate-spin" /> Generating semantic keywords...</div>
                    ) : keywordData.nlpKeywords?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {keywordData.nlpKeywords.map((item) => renderKeywordItem(item))}
                        </div>
                    ) : (
                        <p className="text-white/40">Click "Generate NLP Keywords" to extract semantic LSI terms for your content</p>
                    )}
                </div>
            </div>
        );
    };

    const Step7SkipGrams = () => {
        const renderSkipGramItem = (item) => {
            const isExcluded = excludedItems.skipGrams?.has(item);
            return (
                <span
                    key={item}
                    className={`group relative px-3 py-1.5 pr-7 rounded-lg text-sm border cursor-pointer transition-all ${isExcluded ? 'bg-gray-100 border-white/15 text-white/40 line-through' : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                    onClick={() => toggleExclusion('skipGrams', item)}
                    title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                    {item}
                    <X className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 ${isExcluded ? 'text-white/40' : 'text-white/40 opacity-60 group-hover:opacity-100 group-hover:text-red-400'
                        }`} />
                </span>
            );
        };

        return (
            <div className="space-y-6">
                <button
                    onClick={fetchSkipGrams}
                    disabled={!mainKeyword || isLoadingKeywords.skipGrams}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isLoadingKeywords.skipGrams ? <Loader2 className="w-5 h-5 animate-spin" /> : <Type className="w-5 h-5" />}
                    Generate Skip-Gram Words
                </button>

                <p className="text-xs text-white/50 flex items-center gap-1">
                    <X className="w-3 h-3" /> Click a word pair to exclude it • <Check className="w-3 h-3 text-rose-600" /> All included by default
                </p>

                <div className="ctool-card">
                    <h4 className="font-semibold text-white flex items-center gap-2 mb-4">
                        <Type className="w-5 h-5 text-rose-600" />
                        Skip-Gram Dominant Words
                        <span className="ml-auto text-sm text-white/40">
                            {(keywordData.skipGrams?.length || 0) - (excludedItems.skipGrams?.size || 0)}/{keywordData.skipGrams?.length || 0} selected
                        </span>
                    </h4>
                    {isLoadingKeywords.skipGrams ? (
                        <div className="flex items-center gap-2 text-white/50"><Loader2 className="w-5 h-5 animate-spin" /> Generating skip-gram pairs...</div>
                    ) : keywordData.skipGrams?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {keywordData.skipGrams.map((item) => renderSkipGramItem(item))}
                        </div>
                    ) : (
                        <p className="text-white/40">Click "Generate Skip-Gram Words" to get topic-defining word pairs</p>
                    )}
                </div>
            </div>
        );
    };

    // Step 4: Auto-Suggest Keywords - Like KeywordSuggest tool
    // State moved to top of component for proper React hooks order
    const [isAutoSuggestLoading, setIsAutoSuggestLoading] = useState(false);
    const [autoSuggestProgress, setAutoSuggestProgress] = useState(0);
    const [expandedSuggestSections, setExpandedSuggestSections] = useState({ ai: true, base: true, letters: true, numbers: true });

    const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const NUMBERS = '0123456789'.split('');

    // Fetch single suggestion via JSONP
    const fetchAutoCompleteSuggestion = async (query) => {
        return new Promise((resolve) => {
            const callbackName = `googleAC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const timeout = setTimeout(() => { cleanup(); resolve([]); }, 5000);
            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                const script = document.querySelector(`script[data-callback="${callbackName}"]`);
                if (script) script.remove();
            };
            window[callbackName] = (data) => {
                cleanup();
                if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                    const suggestions = data[1].map(item => typeof item === 'string' ? item : (Array.isArray(item) ? item[0] : null)).filter(Boolean).slice(0, 10);
                    resolve(suggestions);
                } else { resolve([]); }
            };
            const script = document.createElement('script');
            script.setAttribute('data-callback', callbackName);
            script.src = `https://www.google.com/complete/search?q=${encodeURIComponent(query)}&hl=${serpHl}&gl=${serpGl}&client=chrome&callback=${callbackName}`;
            script.onerror = () => { cleanup(); resolve([]); };
            document.head.appendChild(script);
        });
    };

    // Generate all keyword suggestions
    const generateAutoSuggestKeywords = async () => {
        if (!mainKeyword.trim()) return;
        setIsAutoSuggestLoading(true);
        setAutoSuggestProgress(0);
        setAutoSuggestKeywords({});
        setAiPickedKeywords([]);

        const allVariations = [
            { key: 'base', query: mainKeyword.trim() },
            ...ALPHABET.map(letter => ({ key: letter.toUpperCase(), query: `${mainKeyword.trim()} ${letter}` })),
            ...NUMBERS.map(num => ({ key: num, query: `${mainKeyword.trim()} ${num}` }))
        ];

        const newResults = {};
        const batchSize = 5;
        for (let i = 0; i < allVariations.length; i += batchSize) {
            const batch = allVariations.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async ({ key, query }) => {
                    const suggestions = await fetchAutoCompleteSuggestion(query);
                    return { key, suggestions };
                })
            );
            batchResults.forEach(({ key, suggestions }) => { newResults[key] = suggestions; });
            setAutoSuggestProgress(Math.min(100, Math.round(((i + batchSize) / allVariations.length) * 100)));
            setAutoSuggestKeywords({ ...newResults });
            if (i + batchSize < allVariations.length) await new Promise(r => setTimeout(r, 100));
        }
        setIsAutoSuggestLoading(false);
        setAutoSuggestProgress(100);
    };

    // Get all keywords as flat list
    const allAutoSuggestKeywords = Object.values(autoSuggestKeywords).flat().filter((kw, i, arr) => arr.indexOf(kw) === i).sort();

    // AI Pick relevant keywords
    const pickAIKeywords = async () => {
        if (allAutoSuggestKeywords.length === 0) return;
        setIsAutoSuggestLoading(true);
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `You are an SEO expert. Given this base keyword "${mainKeyword}" and the following Google autocomplete suggestions, select the 20-30 most relevant keywords for creating comprehensive content.

                Keywords list:
                ${allAutoSuggestKeywords.join('\n')}

                Select keywords that:
                1. Are directly related to the main topic
                2. Have good search intent
                3. Would work well as subtopics or sections
                4. Cover different aspects of the topic

                Return ONLY a JSON array of selected keywords.`,
                    systemInstruction: 'You are an SEO keyword research expert. Return only valid JSON arrays.',
                    responseMimeType: 'application/json',
                    temperature: 0.3
                })
            });
            const data = await response.json();
            if (data.text) {
                const parsed = JSON.parse(data.text);
                if (Array.isArray(parsed)) {
                    setAiPickedKeywords(parsed);
                    // Auto-check AI picked keywords
                    setCheckedKeywords(prev => {
                        const newSet = new Set(prev);
                        parsed.forEach(kw => newSet.add(kw));
                        return newSet;
                    });
                }
            }
        } catch (e) { console.error('AI keyword picking error:', e); }
        setIsAutoSuggestLoading(false);
    };

    // Toggle keyword check
    const toggleKeywordCheck = (keyword) => {
        setCheckedKeywords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(keyword)) {
                newSet.delete(keyword);
            } else {
                newSet.add(keyword);
            }
            return newSet;
        });
    };

    // Check/uncheck all keywords in a column
    const toggleColumnCheck = (keywords) => {
        setCheckedKeywords(prev => {
            const newSet = new Set(prev);
            const allChecked = keywords.every(kw => newSet.has(kw));
            if (allChecked) {
                keywords.forEach(kw => newSet.delete(kw));
            } else {
                keywords.forEach(kw => newSet.add(kw));
            }
            return newSet;
        });
    };

    const Step8AutoSuggest = () => {
        const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
        const NUMBERS = '0123456789'.split('');
        const baseKeywords = autoSuggestKeywords.base || [];

        return (
            <div className="space-y-6">
                {/* Header with Generate Button */}
                <div className="ctool-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            Auto-Suggest Keywords
                        </h3>
                        <button
                            onClick={generateAutoSuggestKeywords}
                            disabled={!mainKeyword.trim() || isAutoSuggestLoading}
                            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 hover:shadow-lg transition"
                        >
                            {isAutoSuggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Generate A-Z Keywords
                        </button>
                    </div>
                    <p className="text-sm text-white/60 mb-4">
                        Generate keyword variations using Google Autocomplete for "{mainKeyword || 'your keyword'}" with A-Z and 0-9 suffixes.
                    </p>
                    {isAutoSuggestLoading && (
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${autoSuggestProgress}%` }} />
                        </div>
                    )}

                    {/* Stats when we have results */}
                    {allAutoSuggestKeywords.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-emerald-400">{allAutoSuggestKeywords.length}</div>
                                <div className="text-xs text-white/50">Total Keywords</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-emerald-600">{checkedKeywords.size}</div>
                                <div className="text-xs text-white/50">Selected</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-brand-500">{aiPickedKeywords.length}</div>
                                <div className="text-xs text-white/50">AI Picked</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Features Section */}
                {allAutoSuggestKeywords.length > 0 && (
                    <div className="bg-gradient-to-r from-brand-500 to-amber-600 rounded-2xl p-1">
                        <div className="rounded-xl bg-white/[0.03] p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="scw-serp-title flex items-center gap-2">
                                    <Brain className="w-5 h-5" />
                                    AI Suggested Keywords ({aiPickedKeywords.length})
                                </h3>
                                <button
                                    onClick={pickAIKeywords}
                                    disabled={isAutoSuggestLoading}
                                    className="px-4 py-2 bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isAutoSuggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Pick with AI
                                </button>
                            </div>
                            {aiPickedKeywords.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {aiPickedKeywords.map((kw, i) => (
                                        <label key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition ${checkedKeywords.has(kw)
                                            ? 'bg-brand-500/15 text-brand-300 border-brand-300'
                                            : 'bg-white/[0.04] text-white/60 border-white/10'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={checkedKeywords.has(kw)}
                                                onChange={() => toggleKeywordCheck(kw)}
                                                className="w-4 h-4 text-brand-500 rounded"
                                            />
                                            {kw}
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-brand-600 text-sm">Click "Pick with AI" to have AI select the most relevant keywords. They will be auto-checked for inclusion in the mega prompt.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Base Suggestions Section */}
                {baseKeywords.length > 0 && (
                    <div className="scw-editor">
                        <div className="px-4 py-3 bg-green-500 text-white font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                Suggested Keywords ({baseKeywords.length})
                            </span>
                            <button
                                onClick={() => navigator.clipboard.writeText(baseKeywords.join('\n'))}
                                className="scw-tool scw-tool-sm"
                                title="Copy all"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-3 space-y-1 max-h-72 overflow-y-auto bg-gradient-to-br from-green-50 to-emerald-50">
                            {baseKeywords.map((kw, idx) => (
                                <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-green-100 rounded cursor-pointer transition">
                                    <input
                                        type="checkbox"
                                        checked={checkedKeywords.has(kw)}
                                        onChange={() => toggleKeywordCheck(kw)}
                                        className="w-4 h-4 text-emerald-400 rounded"
                                    />
                                    <span className="text-sm text-white/75">{kw}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* A-Z Letter Variations */}
                {Object.keys(autoSuggestKeywords).some(k => ALPHABET.includes(k.toLowerCase()) && autoSuggestKeywords[k]?.length > 0) && (
                    <div className="scw-editor">
                        <div
                            onClick={() => setExpandedSuggestSections(prev => ({ ...prev, letters: !prev.letters }))}
                            className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white cursor-pointer flex items-center justify-between"
                        >
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="text-2xl">A-Z</span>
                                Letter Variations
                            </h3>
                            {expandedSuggestSections.letters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                        {expandedSuggestSections.letters && (
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {ALPHABET.map(letter => {
                                    const keywords = autoSuggestKeywords[letter.toUpperCase()] || [];
                                    if (keywords.length === 0) return null;
                                    return (
                                        <div key={letter} className="rounded-lg border-2 bg-white/[0.03] border-green-300 overflow-hidden ">
                                            <div className="px-3 py-2 bg-green-500 text-white font-bold flex items-center justify-between">
                                                <span>+{letter.toUpperCase()}</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => toggleColumnCheck(keywords)}
                                                        className="scw-tool scw-tool-sm"
                                                        title="Toggle all"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(keywords.join('\n'))}
                                                        className="scw-tool scw-tool-sm"
                                                        title="Copy column"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="divide-y divide-green-100">
                                                {keywords.map((kw, idx) => (
                                                    <label key={idx} className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/75 hover:bg-green-50 cursor-pointer" title={kw}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checkedKeywords.has(kw)}
                                                            onChange={() => toggleKeywordCheck(kw)}
                                                            className="w-3.5 h-3.5 text-emerald-400 rounded flex-shrink-0"
                                                        />
                                                        <span className="truncate">{kw}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 0-9 Number Variations */}
                {Object.keys(autoSuggestKeywords).some(k => NUMBERS.includes(k) && autoSuggestKeywords[k]?.length > 0) && (
                    <div className="scw-editor">
                        <div
                            onClick={() => setExpandedSuggestSections(prev => ({ ...prev, numbers: !prev.numbers }))}
                            className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white cursor-pointer flex items-center justify-between"
                        >
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="text-2xl">0-9</span>
                                Number Variations
                            </h3>
                            {expandedSuggestSections.numbers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                        {expandedSuggestSections.numbers && (
                            <div className="p-4 grid grid-cols-5 gap-3">
                                {NUMBERS.map(num => {
                                    const keywords = autoSuggestKeywords[num] || [];
                                    if (keywords.length === 0) return null;
                                    return (
                                        <div key={num} className="rounded-lg border-2 bg-white/[0.03] border-blue-300 overflow-hidden ">
                                            <div className="px-3 py-2 bg-blue-500 text-white font-bold flex items-center justify-between">
                                                <span>+{num}</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => toggleColumnCheck(keywords)}
                                                        className="scw-tool scw-tool-sm"
                                                        title="Toggle all"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(keywords.join('\n'))}
                                                        className="scw-tool scw-tool-sm"
                                                        title="Copy column"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="divide-y divide-blue-100">
                                                {keywords.map((kw, idx) => (
                                                    <label key={idx} className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/75 hover:bg-blue-50 cursor-pointer" title={kw}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checkedKeywords.has(kw)}
                                                            onChange={() => toggleKeywordCheck(kw)}
                                                            className="w-3.5 h-3.5 text-blue-400 rounded flex-shrink-0"
                                                        />
                                                        <span className="truncate">{kw}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Info when no keywords */}
                {allAutoSuggestKeywords.length === 0 && !isAutoSuggestLoading && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Generate Keyword Suggestions</h3>
                        <p className="text-white/60 text-sm">
                            Click "Generate A-Z Keywords" to fetch Google autocomplete suggestions for your keyword with A-Z and 0-9 variations.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // Step 5: Grammar Generator - Like GrammarGenerator tool
    const GRAMMAR_CATEGORIES = {
        proper_nouns: { label: 'Proper Nouns', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        common_nouns: { label: 'Common Nouns', color: 'bg-brand-500/15 text-brand-300 border-brand-200' },
        synonyms: { label: 'Synonyms', color: 'bg-emerald-500/15 text-emerald-300 border-green-200' },
        antonyms: { label: 'Antonyms', color: 'bg-red-100 text-red-700 border-red-200' },
        hyponyms: { label: 'Hyponyms', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
        hypernyms: { label: 'Hypernyms', color: 'bg-amber-500/15 text-amber-300 border-amber-200' },
        homonyms: { label: 'Homonyms', color: 'bg-pink-100 text-pink-700 border-pink-200' },
        meronyms: { label: 'Meronyms', color: 'bg-teal-100 text-teal-700 border-teal-200' },
        holonyms: { label: 'Holonyms', color: 'bg-brand-500/15 text-brand-300 border-brand-200' }
        // Polysemy removed as per request
    };
    // grammarResults state moved to top of component for proper React hooks order
    const [isGrammarLoading, setIsGrammarLoading] = useState(false);
    const [expandedGrammarCats, setExpandedGrammarCats] = useState({});

    const generateGrammar = async () => {
        if (!mainKeyword.trim()) return;
        setIsGrammarLoading(true);
        setGrammarResults(null);
        try {
            const response = await fetch('/api/deepseek', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate comprehensive grammatical and semantic relationships for: "${mainKeyword}"

                Include proper nouns (brands, products), common nouns, synonyms, antonyms, hyponyms (more specific), hypernyms (more general), homonyms, meronyms (parts), and holonyms (wholes).`,
                    systemInstruction: `You are an expert linguist. Generate semantic word relationships. Return JSON:
                {
                    "term": "the term",
                "proper_nouns": ["Brand1", "Product1"],
                "common_nouns": ["noun1", "noun2"],
                "synonyms": ["syn1", "syn2"],
                "antonyms": ["ant1", "ant2"],
                "hyponyms": ["specific1", "specific2"],
                "hypernyms": ["general1", "general2"],
                "homonyms": ["homonym1"],
                "meronyms": ["part1", "part2"],
                "holonyms": ["whole1", "whole2"]
}`,
                    responseMimeType: 'application/json',
                    temperature: 0.4
                })
            });
            const data = await response.json();
            if (data.text) {
                const parsed = JSON.parse(data.text);
                setGrammarResults(parsed);
                const expanded = {};
                Object.keys(GRAMMAR_CATEGORIES).forEach(k => { expanded[k] = true; });
                setExpandedGrammarCats(expanded);
            }
        } catch (e) { console.error('Grammar generation error:', e); }
        setIsGrammarLoading(false);
    };

    const Step9GrammarGenerator = () => {
        const renderGrammarItem = (item, category, colorClass) => {
            const isExcluded = excludedItems.grammar?.has(item);
            return (
                <span
                    key={item}
                    className={`group relative px-3 py-1.5 pr-7 rounded-full text-sm border cursor-pointer transition-all ${isExcluded ? 'bg-gray-100 border-white/15 text-white/40 line-through' : colorClass
                        }`}
                    onClick={() => toggleExclusion('grammar', item)}
                    title={isExcluded ? 'Click to include' : 'Click to exclude'}
                >
                    {item}
                    <X className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 ${isExcluded ? 'text-white/40' : 'text-white/40 opacity-60 group-hover:opacity-100 group-hover:text-red-400'
                        }`} />
                </span>
            );
        };

        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <Type className="w-8 h-8" />
                        <div>
                            <h3 className="text-xl font-bold">Grammar Generator</h3>
                            <p className="text-emerald-200 text-sm">Generate semantic word relationships for "{mainKeyword || 'your keyword'}"</p>
                        </div>
                    </div>
                    <button
                        onClick={generateGrammar}
                        disabled={!mainKeyword.trim() || isGrammarLoading}
                        className="px-6 py-3 bg-emerald-500/15 text-emerald-300 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGrammarLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        Generate Grammar Elements
                    </button>
                </div>

                {isGrammarLoading && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                        <Loader2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 animate-spin" />
                        <h3 className="text-xl font-bold text-white mb-2">Analyzing "{mainKeyword}"</h3>
                        <p className="text-white/50">Generating semantic relationships...</p>
                    </div>
                )}

                {grammarResults && (
                    <div className="ctool-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Results for "{grammarResults.term}"</h3>
                            <p className="text-xs text-white/50 flex items-center gap-1">
                                <X className="w-3 h-3" /> Click items to exclude from mega prompt
                            </p>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(GRAMMAR_CATEGORIES).map(([key, config]) => {
                                const items = grammarResults[key] || [];
                                if (items.length === 0) return null;
                                const isExpanded = expandedGrammarCats[key] !== false;
                                const excludedCount = items.filter(item => excludedItems.grammar?.has(item)).length;
                                return (
                                    <div key={key} className="border border-white/10 rounded-xl overflow-hidden">
                                        <div
                                            className="flex items-center justify-between p-4 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06]"
                                            onClick={() => setExpandedGrammarCats(prev => ({ ...prev, [key]: !prev[key] }))}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-white">{config.label}</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-xs border ${config.color}`}>
                                                    {items.length - excludedCount}/{items.length}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExcludedItems(prev => ({
                                                            ...prev,
                                                            grammar: new Set([...(prev.grammar || []), ...items])
                                                        }));
                                                    }}
                                                    className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                                >
                                                    Ignore All
                                                </button>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                                        </div>
                                        {isExpanded && (
                                            <div className="p-4 flex flex-wrap gap-2">
                                                {items.map((item) => renderGrammarItem(item, key, config.color))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Step 6: SEO Rules - Koray SEO Guidelines (summary for UI, fullPrompt for AI)
    const SEO_RULES = [
        {
            id: 'answer_first',
            name: '🚀 Answer First',
            summary: 'Don\'t distance the question from the answer. Answer immediately, then elaborate.',
            fullPrompt: `Do not distance the question from the answer.
Example: For "How much caffeine is in coffee?" immediately answer, "There is 95 mg of caffeine in coffee." then elaborate.
Explanation: Answer the question right away to provide clarity, then give details.
Do not delay the answer.
Question: What are the benefits of Charts for entrepreneurs?
Wrong Structure: Charts are the main element for... To prepare a Chart.... Benefits of Charts,....
Correct Structure: There are X main benefits of a Chart for an entrepreneur....
Singularity and Plurality matter for micro semantics.`
        },
        {
            id: 'no_analogies',
            name: '🚫 No Analogies',
            summary: 'Don\'t use analogies that compare one thing to another.',
            fullPrompt: `Don't Use Analogies. An analogy is a way of explaining something by comparing it to something else that is similar. It's like saying one thing is similar to another to help people understand a concept better. Avoid using analogies as they can confuse search engines and reduce clarity.`
        },
        {
            id: 'coreference',
            name: '⚠️ Avoid Coreference Errors',
            summary: 'Use clear pronoun references. Avoid ambiguous "he", "she", "it".',
            fullPrompt: `Avoid coreference errors. Improper pronoun usage may result in a "coreference error." This error happens when search engines struggle to understand which noun or entity the pronoun is referring to.
Example of a Coreference Error: "Joe Rogan did a podcast with Elon Musk, and he shared his thoughts on finance and law."
In this case, it's unclear who shared their thoughts—Joe Rogan or Elon Musk? Since the pronoun "he" doesn't clearly refer to a specific entity, Google may get confused while processing the sentence.
Google will attempt to resolve this ambiguity by searching for co-occurrences of both entities on the web. However, such confusion signals to Google that the article may not be well-structured or carefully written.`
        },
        {
            id: 'no_extra_sentences',
            name: '🚀 No Extra Sentences',
            summary: 'Combine sentences when possible to reduce token usage.',
            fullPrompt: `Don't create an extra sentence if there is no logical reason.
Example: How old is Tanjiro in Demon Slayer anime?
Answer 1: Tanjiro is 25 years old. His birthdate is Dec 2, 2002.
Answer 2: Tanjiro is 25 years old and his birthdate is Dec 2, 2002.
Answer 3: Tanjiro is 25 years old. Tanjiro's birthdate is Dec 2, 2002.
Answer 2 is best because with each new sentence search engines will use a new token. Both Answer 1 and Answer 3 will require two tokens, but Answer 2 will require only 1 token.`
        },
        {
            id: 'abbreviations',
            name: '✅ Use Abbreviations Properly',
            summary: 'Include abbreviation in parentheses on first mention.',
            fullPrompt: `Always Use the Abbreviation in Parentheses on First Mention.
When you introduce an entity or concept for the first time, include its abbreviation in parentheses right after the full term. This way, readers immediately know what the abbreviation stands for, making it easier to follow the content if the abbreviation is used later.
Incorrect: "Bitcoin is the main cryptocurrency asset."
Correct: "Bitcoin (BTC) is the main cryptocurrency asset for crypto trading platforms."`
        },
        {
            id: 'no_back_reference',
            name: '⚠️ No Back References',
            summary: 'Don\'t say "As stated before" or "As explained in section Y".',
            fullPrompt: `Do not send the reader, or the text processors to the back of the article.
Do not send the reader by saying "As stated before", or "As it is explained in the Y section".
Wrong Structure: "As it is shown in the article, the most dangerous poisons in the world have been determined by the P method."
Correct Structure: "The most dangerous poisons in the world have been determined by the P Method."
Explanation: Instead of directing readers back to a previous section, restate the information directly. This keeps the content flow uninterrupted and makes it easier for readers to follow without needing to recall previous sections.`
        },
        {
            id: 'safe_answers',
            name: '🚀 Give Safe Answers',
            summary: 'Provide comprehensive answers with factors, examples, and sources.',
            fullPrompt: `Give Safe Answers.
Question: "Does laser cutting produce clean and precise edges compared to other cutting methods?"
Answer: Yes, laser cutting produces clean and precise edges compared to other cutting methods, such as X, Y, and Z. The cleanness and precision of edges during laser cutting are affected by five main factors: X, Y, Z, D…. These factors increase their weight under the conditions of X, Y, Z.
A Laser Cutter industrial user experiences… according to …..
A Laser Cutter manufacturer, X, conveys Y in their Z paper….
A Laser Cutter observation from 2017 during the construction of …. involves ……`
        },
        {
            id: 'bold_answer',
            name: '🔍 Bold the Answer',
            summary: 'Bold the answer part, not the search term.',
            fullPrompt: `Bold the answer, not the search term.
Query: What is a Penguin?
Answer: <b>A penguin is a flightless seabird.</b>
Answer: A penguin is <b>a flightless seabird.</b>
Signal the answer part, not the relevance.`
        },
        {
            id: 'if_statements',
            name: '✨ If Statements Second',
            summary: 'Put "if" conditions in the second part of the sentence.',
            fullPrompt: `Put the "if" statements in the second part of the sentence.
"If A becomes B, do X." → Less preferred
"Do X, if A becomes B." → Better
State what to do first, then explain the condition.
"If it rains, take an umbrella." → Less preferred
"Take an umbrella, if it rains." → Better`
        },
        {
            id: 'subordinate_text',
            name: '✨ Match Heading Structure',
            summary: 'Supporting text should match the heading structure (How to → To do).',
            fullPrompt: `Optimize Subordinate Text First Sentence.
Heading: How to do X...
Wrong Supporting Text: X is....
Correct Supporting Text: To do X....

Match the Adjectives, Predicates, Nouns Order Between Questions and Answers.
For clarity and cohesion, keep the structure of adjectives, predicates, and nouns in the same order in both the question and answer.
Question: "What are effective focus-improving techniques?"
Answer: "Effective focus-improving techniques include setting goals, reducing multitasking, and taking breaks."`
        },
        {
            id: 'examples_after_plural',
            name: '📌 Examples After Plurals',
            summary: 'Give specific examples after mentioning a plural noun.',
            fullPrompt: `Give examples after a plural noun.
"There are 40 different cryptocurrencies to trade on Coinbase, including Bitcoin and Ethereum."
Food Options: There are 25 delicious dishes to try at the restaurant, including pasta, sushi, and tacos.
Workout Types: There are 15 types of workouts available in the app, including yoga, HIIT, and strength training.
Languages Offered: There are 20 languages you can learn on the platform, including Spanish, Mandarin, and Arabic.`
        },
        {
            id: 'verb_context',
            name: '🚀 Understand Verb Context',
            summary: 'Use "increase" for metrics, "improve" for skills/health, "develop" for gradual growth.',
            fullPrompt: `Understand Context of Verbs.
'Increase' signals 'health' (measurable metrics, quantities, or intensities).
Example: "Consistent stretching can increase flexibility over time."

'Improve' signals 'skill' + 'health' (skills or health outcomes that can be enhanced).
Example: "Practicing regularly will improve your language proficiency."

'Develop' signals 'skill' (gradual skill acquisition or growth in processes).
Example: "Working in a startup environment helps employees develop resilience and adaptability."

Determine predicates wisely.`
        },
        {
            id: 'be_specific',
            name: '🔍 Be Specific',
            summary: 'Experts are specific. Say "6 severe symptoms" not just "symptoms".',
            fullPrompt: `Be Specific When Describing Things.
Do not tell "The symptoms of X disease...".
Tell, "There are 6 severe symptoms of X disease, these are... There are 9 rare symptoms of X disease..."
Experts are specific.

General vs. Expert-Like Examples:
Condition Explanation:
General: "The symptoms of malaria include fever, chills, and nausea."
Expert-Like: "Malaria has 4 primary symptoms, which are fever, chills, headache, and nausea. Additionally, there are 3 rare symptoms: confusion, seizures, and bleeding."

Product Benefits:
General: "The benefits of Product Y are numerous."
Expert-Like: "Product Y offers 5 key benefits: X, Y, Z..."`
        },
        {
            id: 'numeric_values',
            name: '⚡ Use Numeric Values',
            summary: 'Say "5 main reasons" not "many reasons". Be specific with numbers.',
            fullPrompt: `Use Numeric Values.
Do not tell "There are many reasons...".
Tell, "There are 5 main reasons...".
Experts are specific. Always quantify when possible.`
        },
        {
            id: 'no_fluff',
            name: '🚀 Cut the Fluff',
            summary: 'Delete contextless words like "Also", "According to", "should know".',
            fullPrompt: `Cut the Fluff out. Delete all contextless words.
Wrong: "There is one more fact about electric cars that every driver should know, and it is the electric charger capacity. Also, According to the electric charger type, the electric battery charging time might vary."
Correct: "Electric car charging time changes based on electric car charger type. For example, X type car charger is observed to be faster 5% compared to Y type of electric car charger."
Remove words like: "Also", "According to the", "should know", "might", "There is one more fact", "it is the".`
        },
        {
            id: 'be_certain',
            name: '⚡ Be Certain',
            summary: 'State facts definitively. Use "Sun rises every day" not "Sun will rise tomorrow".',
            fullPrompt: `Be Certain.
"Sun will rise tomorrow" → Wrong. A limit on how certain we can be because it depends on time and uses the wrong form. (It's just a possibility)
"Sun rises every day." → Correct. A fact.
Knowledge should be certain and definite. State facts, not possibilities.`
        },
        {
            id: 'consistent_pos',
            name: '📌 Consistent List Structure',
            summary: 'Use same part of speech at start of each list item.',
            fullPrompt: `Use the same Part of Speech Tag (Word Role) in the first word of the sentence for a listing.
If starting with a verb + noun structure:
- Ensure proper alignment.
- Clear unnecessary clutter.
- Spend time reviewing details.
- Absorb useful information.

Alternatively, if starting with a noun:
- Coffee provides energy and antioxidants.
- Exercise boosts metabolism and strengthens muscles.
- Hydration improves skin and aids digestion.

Using a consistent part of speech, especially at the beginning of list items, makes the list easier to follow and more visually appealing. It also reinforces a structured, intentional tone, which is helpful for both readability and SEO.`
        },
        {
            id: 'prioritize_context',
            name: '📝 Prioritize Context',
            summary: 'Match the interrogative term (where=place, when=time, how=method).',
            fullPrompt: `Prioritize Attributes and Contexts.
Interrogative Term: Where is a signal for place.
Query: "Where does a Penguin Live?"
Answer: "Penguins live below the equator, in the X, Y, Z geographies because their flippers and flightless seabirds nature provide..."
Match the context of the question in your answer. Where questions need location answers first.`
        },
        {
            id: 'measurement_units',
            name: '📏 Multiple Measurement Units',
            summary: 'Include diverse measurement units (pounds + kg, oz + liters).',
            fullPrompt: `If you're mentioning measurement units in your content, always try to mention more and diverse measurement units.
Less measurement units: "For each pound lost, drink around 16-20 oz of water."
More measurement units: "For each pound (0.45 kg) lost, drink around 16-20 oz (0.5-0.6 liters) of water."
The second sentence is more enriched with information and has more connection to different types of related entities, i.e., kg and liters.
From the user experience point of view, the second sentence is more helpful for users as well, because different users process information with different mindsets.
Thus, more units help to satisfy a more diverse and relevant target user class.`
        },
        {
            id: 'boolean_answers',
            name: '✅ Yes/No First',
            summary: 'Boolean questions should start with Yes or No.',
            fullPrompt: `Boolean Questions should start with Yes or No.
Question: "Does Water In Food Help When Drinking Water Is Restricted?"
Answer: "Yes, eating food high in water content that is easily digestible helps with overall fluid intake when drinking water is restricted.
According to Wiseman, digesting fat is the hardest and requires a lot of water.
The Federal Emergency Management Agency (FEMA) recommends not eating salty foods as they can increase thirst."
Start with a clear Yes or No, then elaborate with supporting details.`
        }
    ];

    useEffect(() => {
        if (selectedRules.length === 0) {
            setSelectedRules(SEO_RULES.map(r => r.id));
        }
    }, []);

    const toggleRule = (ruleId) => {
        setSelectedRules(prev => prev.includes(ruleId) ? prev.filter(r => r !== ruleId) : [...prev, ruleId]);
    };

    const Step10SEORules = () => {
        const allSelected = selectedRules.length === SEO_RULES.length;

        const toggleAllRules = () => {
            if (allSelected) {
                setSelectedRules([]);
            } else {
                setSelectedRules(SEO_RULES.map(r => r.id));
            }
        };

        return (
            <div className="ctool-card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-amber-400" />
                        SEO Optimization Rules (Koray Guidelines)
                    </h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleAllRules}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${allSelected
                                ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-200'
                                }`}
                        >
                            {allSelected ? 'Uncheck All' : 'Select All'}
                        </button>
                        <span className="text-sm text-white/50">{selectedRules.length}/{SEO_RULES.length} selected</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SEO_RULES.map(rule => (
                        <label key={rule.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition ${selectedRules.includes(rule.id) ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.03] border border-white/10'}`}>
                            <input type="checkbox" checked={selectedRules.includes(rule.id)} onChange={() => toggleRule(rule.id)} className="mt-1 w-4 h-4 text-amber-400 rounded" />
                            <div>
                                <p className="font-medium text-white">{rule.name}</p>
                                <p className="text-xs text-white/50">{rule.summary}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    // Step 5: AI Writing Instructions - summary shown to user, fullPrompt sent to AI
    const AI_INSTRUCTIONS = {
        conciseWriting: {
            title: 'Concise Writing Style',
            summary: 'Remove unnecessary words. Use active voice. Make every word count.',
            fullPrompt: `Omit needless words. Vigorous writing is concise. A sentence should contain no unnecessary words, a paragraph no unnecessary sentences, for the same reason that a drawing should have no unnecessary lines and a machine no unnecessary parts. This requires not that the writer make all their sentences short, or that they avoid all detail and treat their subjects only in outline, but that they make every word tell.

Use the active voice. Prefer concrete, physical language and analogies.`
        },
        naturalLanguage: {
            title: 'Natural Human Language',
            summary: 'Write plainly with short sentences. Avoid AI clichés. Be direct and conversational.',
            fullPrompt: `Use simple language: Write plainly with short sentences.

Example: "I need help with this issue."

Avoid AI-giveaway phrases: Don't use clichés like "dive into," "unleash your potential," etc.

Avoid: "Let's dive into this game-changing solution."

Use instead: "Here's how it works."

Be direct and concise: Get to the point; remove unnecessary words.

Example: "We should meet tomorrow."

Maintain a natural tone: Write as you normally speak; it's okay to start sentences with "and" or "but."

Example: "And that's why it matters."

Avoid marketing language: Don't use hype or promotional words.

Avoid: "This revolutionary product will transform your life."

Use instead: "This product can help you."

Keep it real: Be honest; don't force friendliness.

Example: "I don't think that's the best idea."

Simplify grammar: Don't stress about perfect grammar; it's fine not to capitalize "i" if that's your style.

Example: "i guess we can try that."

Stay away from fluff: Avoid unnecessary adjectives and adverbs.

Example: "We finished the task."

Focus on clarity: Make your message easy to understand.

Example: "Please send the file by Monday."`
        },
        avoidAIPatterns: {
            title: 'Avoid AI Writing Patterns',
            summary: 'Skip robotic transitions, banned words, and overused AI phrases.',
            fullPrompt: `Use clear, natural human language and avoid overused words or phrases. Do not use terms like as an AI language model or avoid, it's critical to, or tapestry (unless needed). Avoid expressions such as it's important to note, I hope this email finds you well, crucial, or certainly. Also, skip transitional phrases like in summary, remember that, furthermore, additionally, specifically, consequently, importantly, indeed, notably, despite, essentially, alternatively, also, even though, because, in contrast, although, due to, given that, arguably, you may want to, on the other hand, as previously mentioned, it's worth noting that, to summarize, ultimately, or to put it simply. Do not include action words like navigating, dive, tailored, embark, unlock the secrets, unveil the secrets, elevate, unleash, harness, delve into, take a dive into, mastering, excels, imagine, enhance, emphasise/emphasize, revolutionize, foster, subsequently, whispering, reverberate, or promptly. Avoid adjectives such as meticulous, complexities, realm, understanding, everchanging, ever-evolving, daunting, cutting-edge, robust, power, tapestry, bustling, vibrant, metropolis, crucial, essential, vital, keen, fancy, labyrinth, gossamer, enigma, or indelible. Keep responses in detail, clear, human-like. Avoid use of complex robotic sentences.`
        }
    };

    const Step11AIInstructions = () => (
        <div className="space-y-4">
            {Object.entries(AI_INSTRUCTIONS).map(([key, instr]) => (
                <div key={key} className={`rounded-2xl border p-5 transition ${aiInstructions[key] ? 'bg-brand-500/100/10 border-brand-500/20' : 'bg-white/[0.04] border-white/10'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={aiInstructions[key]} onChange={() => setAiInstructions(prev => ({ ...prev, [key]: !prev[key] }))} className="mt-1 w-5 h-5 text-brand-500 rounded" />
                        <div>
                            <h4 className="font-semibold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-brand-500" />{instr.title}</h4>
                            <p className="text-sm text-white/60 mt-1">{instr.summary}</p>
                        </div>
                    </label>
                </div>
            ))}
        </div>
    );

    // Step 8: Content Editor with AI Generation
    const [isGenerating, setIsGenerating] = useState(false);
    const [megaPrompt, setMegaPrompt] = useState('');

    // Build Writer Outline - creates formatted instructions from collected data (excluding AI Instructions)
    const buildWriterOutline = () => {
        // Helper to filter excluded items
        const filterExcluded = (items, category) => {
            if (!items || !Array.isArray(items)) return [];
            return items.filter(item => !excludedItems[category]?.has(item));
        };

        // 1. Outline Structure - Use H1:, H2: format instead of #
        const outlineText = combinedOutline.map(h => `H${h.level}: ${h.text}`).join('\n');

        // 2. All Entities (filtered by exclusions)
        const competitorEntities = filterExcluded(keywordData.competitorEntities, 'competitorEntities');
        const aiEntities = filterExcluded(keywordData.aiEntities, 'aiEntities');
        const uniqueEntities = filterExcluded(keywordData.uniqueEntities, 'uniqueEntities');

        // 3. N-Grams (filtered by exclusions)
        const competitorNgrams = filterExcluded(keywordData.competitorNgrams, 'competitorNgrams');
        const aiPickedNgrams = filterExcluded(keywordData.aiPickedNgrams, 'aiPickedNgrams');
        const aiGeneratedNgrams = filterExcluded(keywordData.aiGeneratedNgrams, 'aiGeneratedNgrams');
        const uniqueNgrams = filterExcluded(keywordData.uniqueNgrams, 'uniqueNgrams');

        // 4. NLP Keywords (filtered)
        const nlpKeywords = filterExcluded(keywordData.nlpKeywords, 'nlpKeywords');

        // 5. Skip-Gram Dominant Words (filtered)
        const skipGrams = filterExcluded(keywordData.skipGrams, 'skipGrams');

        // 6. Auto-Suggest Keywords (User-selected via checkboxes)
        const autoSuggestKws = checkedKeywords.size > 0 ? Array.from(checkedKeywords) : allAutoSuggestKeywords.slice(0, 30);

        // 7. Grammar Elements (ALL elements, not filtered)
        const grammarElements = grammarResults ? {
            properNouns: grammarResults.proper_nouns || [],
            commonNouns: grammarResults.common_nouns || [],
            synonyms: grammarResults.synonyms || [],
            antonyms: grammarResults.antonyms || [],
            hyponyms: grammarResults.hyponyms || [],
            hypernyms: grammarResults.hypernyms || [],
            meronyms: grammarResults.meronyms || [],
            holonyms: grammarResults.holonyms || []
        } : null;

        // 8. SEO Rules - Get FULL rules with details
        const seoRulesDetailed = selectedRules.map(id => {
            const rule = SEO_RULES.find(r => r.id === id);
            return rule ? { name: rule.name, fullPrompt: rule.fullPrompt } : null;
        }).filter(Boolean);

        // Build the writer outline as HTML for the editor with line spacing
        let outline = `<h1>Content Writing Brief: ${mainKeyword}</h1>
<br/>`;

        // Heading Structure
        if (outlineText) {
            outline += `
<h2>📋 Heading Structure</h2>
<pre style="white-space: pre-wrap; background: #f8f9fa; padding: 16px; border-radius: 8px; font-family: monospace;">${outlineText}</pre>
<br/>`;
        }

        // Entities - Separated by source
        const hasEntities = competitorEntities.length > 0 || aiEntities.length > 0 || uniqueEntities.length > 0;
        if (hasEntities) {
            outline += `
<h2>🏷️ Entities to Include</h2>`;
            if (competitorEntities.length > 0) {
                outline += `
<h3>Competitor Entities (${competitorEntities.length})</h3>
<p>${competitorEntities.join(', ')}</p>`;
            }
            if (aiEntities.length > 0) {
                outline += `
<h3>AI-Picked Entities (${aiEntities.length})</h3>
<p>${aiEntities.join(', ')}</p>`;
            }
            if (uniqueEntities.length > 0) {
                outline += `
<h3>Unique Entities (${uniqueEntities.length})</h3>
<p>${uniqueEntities.join(', ')}</p>`;
            }
            outline += `<br/>`;
        }

        // N-Grams / Key Phrases - Each type separated
        const hasNgrams = competitorNgrams.length > 0 || aiPickedNgrams.length > 0 || aiGeneratedNgrams.length > 0 || uniqueNgrams.length > 0;
        if (hasNgrams) {
            outline += `
<h2>📝 Key Phrases (N-Grams)</h2>`;
            if (aiPickedNgrams.length > 0) {
                outline += `
<h3>AI-Picked Priority Phrases (${aiPickedNgrams.length})</h3>
<p>${aiPickedNgrams.join(', ')}</p>`;
            }
            if (aiGeneratedNgrams.length > 0) {
                outline += `
<h3>AI-Generated Phrases (${aiGeneratedNgrams.length})</h3>
<p>${aiGeneratedNgrams.join(', ')}</p>`;
            }
            if (uniqueNgrams.length > 0) {
                outline += `
<h3>Unique Stand-Out Phrases (${uniqueNgrams.length})</h3>
<p>${uniqueNgrams.join(', ')}</p>`;
            }
            if (competitorNgrams.length > 0) {
                outline += `
<h3>Competitor Phrases (${competitorNgrams.length})</h3>
<p>${competitorNgrams.join(', ')}</p>`;
            }
            outline += `<br/>`;
        }

        // NLP Keywords
        if (nlpKeywords.length > 0) {
            outline += `
<h2>🔤 NLP Keywords (${nlpKeywords.length})</h2>
<p>${nlpKeywords.join(', ')}</p>
<br/>`;
        }

        // Skip-Grams
        if (skipGrams.length > 0) {
            outline += `
<h2>🔗 Skip-Gram Word Pairs (${skipGrams.length})</h2>
<p>${skipGrams.join(', ')}</p>
<br/>`;
        }

        // Auto-Suggest Keywords
        if (autoSuggestKws.length > 0) {
            outline += `
<h2>🔍 Selected Auto-Suggested Keywords (${autoSuggestKws.length})</h2>
<ul>${autoSuggestKws.map(k => `<li>${k}</li>`).join('')}</ul>
<br/>`;
        }

        // Grammar Elements - ALL types
        if (grammarElements) {
            const hasGrammar = Object.values(grammarElements).some(arr => arr.length > 0);
            if (hasGrammar) {
                outline += `
<h2>📚 Grammar & Semantic Variations</h2>`;
                if (grammarElements.properNouns.length > 0) {
                    outline += `
<h3>Proper Nouns (${grammarElements.properNouns.length})</h3>
<p>${grammarElements.properNouns.join(', ')}</p>`;
                }
                if (grammarElements.commonNouns.length > 0) {
                    outline += `
<h3>Common Nouns (${grammarElements.commonNouns.length})</h3>
<p>${grammarElements.commonNouns.join(', ')}</p>`;
                }
                if (grammarElements.synonyms.length > 0) {
                    outline += `
<h3>Synonyms (${grammarElements.synonyms.length})</h3>
<p>${grammarElements.synonyms.join(', ')}</p>`;
                }
                if (grammarElements.antonyms.length > 0) {
                    outline += `
<h3>Antonyms (${grammarElements.antonyms.length})</h3>
<p>${grammarElements.antonyms.join(', ')}</p>`;
                }
                if (grammarElements.hyponyms.length > 0) {
                    outline += `
<h3>Hyponyms - More Specific Terms (${grammarElements.hyponyms.length})</h3>
<p>${grammarElements.hyponyms.join(', ')}</p>`;
                }
                if (grammarElements.hypernyms.length > 0) {
                    outline += `
<h3>Hypernyms - Broader Terms (${grammarElements.hypernyms.length})</h3>
<p>${grammarElements.hypernyms.join(', ')}</p>`;
                }
                if (grammarElements.meronyms.length > 0) {
                    outline += `
<h3>Meronyms - Parts/Components (${grammarElements.meronyms.length})</h3>
<p>${grammarElements.meronyms.join(', ')}</p>`;
                }
                if (grammarElements.holonyms.length > 0) {
                    outline += `
<h3>Holonyms - Whole/Container (${grammarElements.holonyms.length})</h3>
<p>${grammarElements.holonyms.join(', ')}</p>`;
                }
                outline += `<br/>`;
            }
        }

        // SEO Rules - FULL detailed rules
        if (seoRulesDetailed.length > 0) {
            outline += `
<h2>✅ SEO Rules to Follow (${seoRulesDetailed.length})</h2>`;
            seoRulesDetailed.forEach((rule, idx) => {
                outline += `
<h3>${idx + 1}. ${rule.name}</h3>
<p style="background: #f0fdf4; padding: 12px; border-radius: 8px; border-left: 4px solid #22c55e;">${rule.fullPrompt.replace(/\n/g, '<br/>')}</p>`;
            });
            outline += `<br/>`;
        }

        // Competitor Content Reference - FULL content, not truncated
        if (competitorContent && competitorContent.trim().length > 0) {
            outline += `
<h2>📖 Competitor Content Reference</h2>
<div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; max-height: 400px; overflow-y: auto;">
<pre style="white-space: pre-wrap; font-family: inherit;">${competitorContent.trim()}</pre>
</div>
<br/>`;
        }

        return outline;
    };

    // Insert Writer Outline into the editor
    const insertWriterOutline = () => {
        const outline = buildWriterOutline();
        setContent(outline);
    };

    // Build the comprehensive mega prompt from all gathered data
    const buildMegaPrompt = () => {
        // Helper to filter excluded items
        const filterExcluded = (items, category) => {
            if (!items || !Array.isArray(items)) return [];
            return items.filter(item => !excludedItems[category]?.has(item));
        };

        // 1. Outline Structure
        const outlineText = combinedOutline.map(h => `H${h.level}: ${h.text}`).join('\n');

        const headingWordTargets = combinedOutline
            .map((heading, idx) => {
                const target = Number.parseInt(headingWordCounts[idx], 10);
                if (!Number.isFinite(target) || target <= 0) return null;
                return {
                    level: heading.level,
                    text: heading.text.replace(/\s+/g, ' ').trim(),
                    target
                };
            })
            .filter(Boolean);

        const totalTargetWords = headingWordTargets.reduce((sum, item) => sum + item.target, 0);
        const shouldEnforceWordTargets = writerMode === 'quick' && headingWordTargets.length > 0;

        const perHeadingWordTargets = headingWordTargets
            .map((item, idx) => {
                const min = Math.round(item.target * 0.9);
                const max = Math.round(item.target * 1.1);
                return `${idx + 1}. H${item.level}: ${item.text} -> ${item.target} words (allowed range: ${min}-${max})`;
            })
            .join('\n');
        // 2. All Entities (filtered by exclusions)
        const competitorEntities = filterExcluded(keywordData.competitorEntities, 'competitorEntities');
        const aiEntities = filterExcluded(keywordData.aiEntities, 'aiEntities');
        const uniqueEntities = filterExcluded(keywordData.uniqueEntities, 'uniqueEntities');
        const allEntities = [...competitorEntities, ...aiEntities, ...uniqueEntities]
            .filter((v, i, a) => a.indexOf(v) === i);

        // 3. N-Grams (filtered by exclusions)
        const competitorNgrams = filterExcluded(keywordData.competitorNgrams, 'competitorNgrams');
        const aiPickedNgrams = filterExcluded(keywordData.aiPickedNgrams, 'aiPickedNgrams');
        const aiGeneratedNgrams = filterExcluded(keywordData.aiGeneratedNgrams, 'aiGeneratedNgrams');
        const uniqueNgrams = filterExcluded(keywordData.uniqueNgrams, 'uniqueNgrams');

        // Legacy ngrams support
        const legacyNgrams = [
            ...(keywordData.ngrams?.threeGrams || []),
            ...(keywordData.ngrams?.fourGrams || [])
        ];

        // 4. NLP Keywords (filtered)
        const nlpKeywords = filterExcluded(keywordData.nlpKeywords, 'nlpKeywords');

        // 5. Skip-Gram Dominant Words (filtered)
        const skipGrams = filterExcluded(keywordData.skipGrams, 'skipGrams');

        // 6. Auto-Suggest Keywords (User-selected via checkboxes)
        const autoSuggestKws = checkedKeywords.size > 0 ? Array.from(checkedKeywords) : allAutoSuggestKeywords.slice(0, 30);

        // 7. Grammar Elements (filtered)
        const grammarElements = grammarResults ? {
            properNouns: filterExcluded(grammarResults.proper_nouns, 'grammar'),
            commonNouns: filterExcluded(grammarResults.common_nouns, 'grammar'),
            synonyms: filterExcluded(grammarResults.synonyms, 'grammar'),
            antonyms: filterExcluded(grammarResults.antonyms, 'grammar'),
            hyponyms: filterExcluded(grammarResults.hyponyms, 'grammar'),
            hypernyms: filterExcluded(grammarResults.hypernyms, 'grammar'),
            meronyms: filterExcluded(grammarResults.meronyms, 'grammar'),
            holonyms: filterExcluded(grammarResults.holonyms, 'grammar')
        } : null;

        // 8. SEO Rules (use fullPrompt for complete instructions with examples)
        const seoRules = selectedRules.map(id => {
            const rule = SEO_RULES.find(r => r.id === id);
            return rule ? rule.fullPrompt : null;
        }).filter(Boolean);

        // 9. AI Writing Instructions (use fullPrompt for complete instructions)
        const writingInstructions = Object.entries(aiInstructions)
            .filter(([key, enabled]) => enabled && AI_INSTRUCTIONS[key])
            .map(([key]) => AI_INSTRUCTIONS[key].fullPrompt);

        // Build the mega prompt with DOC-style formatting
        const prompt = `# CONTENT WRITING ASSIGNMENT

## PRIMARY KEYWORD
"${mainKeyword}"

---

# ARTICLE STRUCTURE

## Heading Outline (Follow this structure exactly)
${outlineText || 'No outline provided - create a logical structure'}

${shouldEnforceWordTargets ? `## CRITICAL WORD COUNT REQUIREMENTS (HIGHEST PRIORITY)
Treat the following limits as non-negotiable constraints.

- HARD TOTAL TARGET: ${totalTargetWords} words (acceptable range: ${Math.round(totalTargetWords * 0.95)}-${Math.round(totalTargetWords * 1.05)}).
- Keep every listed heading close to its target.
- If one section goes over target, shorten it before moving on.
- Do not ignore these limits.

### Per-Heading Targets
${perHeadingWordTargets}` : ''}

---

# SEMANTIC OPTIMIZATION

## Entities to Include
Use these entities naturally throughout the content:
${allEntities.slice(0, 50).join(', ') || 'None provided'}

## Key Phrases (N-Grams)
### AI-Selected Priority Phrases (USE THESE FIRST)
${aiPickedNgrams.length > 0 ? aiPickedNgrams.join(', ') : 'None selected'}

### AI-Generated Phrases
${aiGeneratedNgrams.length > 0 ? aiGeneratedNgrams.slice(0, 20).join(', ') : 'None generated'}

### Unique N-Grams (Stand Out Phrases)
${uniqueNgrams.length > 0 ? uniqueNgrams.join(', ') : 'None generated'}

### Competitor Phrases (Optional)
${competitorNgrams.length > 0 ? competitorNgrams.slice(0, 20).join(', ') : 'None extracted'}
${legacyNgrams.length > 0 ? `\n### Additional Phrases\n${legacyNgrams.slice(0, 15).join(', ')}` : ''}

## NLP Keywords (Topic Vocabulary)
${nlpKeywords.slice(0, 25).join(', ') || 'None provided'}

## Skip-Gram Dominant Word Pairs
These word pairs frequently appear together when discussing this topic:
${skipGrams.slice(0, 25).join(', ') || 'None provided'}

${autoSuggestKws.length > 0 ? `## Related Search Queries to Address
Cover these user search intents:
• ${autoSuggestKws.slice(0, 25).join('\n• ')}` : ''}

${grammarElements ? `## Semantic Word Relationships
Use these semantic variations for vocabulary richness:

### Proper Nouns (Brands/Names)
${grammarElements.properNouns.slice(0, 12).join(', ') || 'None'}

### Common Nouns
${grammarElements.commonNouns.slice(0, 12).join(', ') || 'None'}

### Synonyms
${grammarElements.synonyms.slice(0, 12).join(', ') || 'None'}

### Hyponyms (More Specific Terms)
${grammarElements.hyponyms.slice(0, 12).join(', ') || 'None'}

### Hypernyms (Broader Terms)
${grammarElements.hypernyms.slice(0, 12).join(', ') || 'None'}

### Meronyms (Parts/Components)
${grammarElements.meronyms.slice(0, 12).join(', ') || 'None'}` : ''}

---

# SEO GUIDELINES

## SEO Optimization Rules
${seoRules.join('\n') || 'Use standard SEO best practices'}

## Writing Style Instructions
${writingInstructions.join('\n') || 'Write in a clear, engaging, conversational tone.'}

${competitorContent ? `## Reference Content (Analyze for writing style)
Study this competitor content for tone, structure, and style inspiration:

"""
${competitorContent.slice(0, 3000)}
"""

Analyze and replicate:
- The writing tone (formal, casual, conversational)
- Sentence structure and length patterns
- How topics are introduced and explained
- Content flow and transitions` : ''}

---

# INTRODUCTION WRITING INSTRUCTIONS

## Purpose
Summarize the whole document (heading vectors) in a representative way by following the same order.

## Instructions for Introduction

### 1. Implicit Definition
Provide an implicit definition of "${mainKeyword}" and explain how it works in a representative way

### 2. Main Benefits
Highlight the main benefits of "${mainKeyword}"

### 3. Main Uses
Describe the main uses and applications of "${mainKeyword}"

### 4. Main Parts/Components
Outline the main parts or components of "${mainKeyword}"

## Best Practices
- Use the same n-grams in both the introduction (intro) and conclusion (outro)
- Ensure the introduction mirrors the document structure
- Keep the introduction concise but comprehensive

---

# COMPETITOR CONTENT ANALYSIS

${competitorContent ? `## Full Competitor Content Reference
Study this complete competitor content for comprehensive analysis:

"""
${competitorContent}
"""

Analyze and incorporate:
- The writing tone (formal, casual, conversational)
- Sentence structure and length patterns
- How topics are introduced and explained
- Content flow and transitions
- Key points and arguments made
- Structure and organization
- Unique angles and perspectives` : '## No competitor content provided - create original content based on the outline and keywords.'}

BEGIN WRITING THE ARTICLE NOW:`;

        return prompt;
    };

    const generateContent = async () => {
        // Check what's missing and provide specific guidance
        if (!mainKeyword && combinedOutline.length === 0) {
            alert('Please complete Step 1 (enter your main keyword) and Step 2 (create an article outline) before generating content.');
            return;
        }
        if (!mainKeyword) {
            alert('Please complete Step 1: Enter your main keyword first.');
            return;
        }
        if (combinedOutline.length === 0) {
            alert('Please complete Step 2: Create an article outline first.\n\nYou can either:\n• Extract headings from competitor URLs\n• Manually add headings');
            return;
        }
        setIsGenerating(true);

        // Convert markdown to HTML for proper rendering
        const markdownToHtml = (md) => {
            if (!md) return '';
            return md
                // Escape HTML entities first
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                // Headings (must be before bold/italic to avoid conflicts)
                .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
                .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
                .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                // Horizontal rules
                .replace(/^---+$/gm, '<hr>')
                // Bold and italic
                .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                // Unordered lists (simple single-level)
                .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
                // Ordered lists
                .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
                // Wrap consecutive li elements in ul
                .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
                // Line breaks to paragraphs
                .replace(/\n\n+/g, '</p><p>')
                .replace(/\n/g, '<br>')
                // Wrap in paragraph
                .replace(/^(.+)$/s, '<p>$1</p>')
                // Clean up empty paragraphs
                .replace(/<p><\/p>/g, '')
                .replace(/<p>(<h[1-6]>)/g, '$1')
                .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
                .replace(/<p>(<ul>)/g, '$1')
                .replace(/(<\/ul>)<\/p>/g, '$1')
                .replace(/<p>(<hr>)<\/p>/g, '$1')
                .replace(/<p><hr>/g, '<hr>')
                .replace(/<hr><\/p>/g, '<hr>');
        };

        const extractTitleFromHtml = (html) => {
            if (!html) return { title: '', html: '' };
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const titleNode = doc.querySelector('h1');
            let title = '';
            if (titleNode) {
                title = titleNode.textContent.trim();
                titleNode.remove();
            }
            return { title, html: doc.body.innerHTML };
        };

        try {
            const prompt = masterPrompt || buildMegaPrompt();
            setMegaPrompt(prompt); // Store for reference

            // Try OpenAI first, then OpenRouter, then Claude, then fallback to DeepSeek Chat.
            const openaiKey = '';
            const openrouterKey = '';
            const claudeKey = '';
            let generatedText = '';

            if (openaiKey) {
                // Priority 1: OpenAI
                const response = await fetch('/api/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        apiKey: openaiKey,
                        model: 'gpt-4o',
                        temperature: 0.7,
                        maxTokens: 8000
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                generatedText = data.text || '';
            } else if (openrouterKey) {
                // Priority 2: OpenRouter
                const response = await fetch('/api/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        apiKey: openrouterKey,
                        model: 'openai/gpt-4o-mini',
                        temperature: 0.7,
                        maxTokens: 8000,
                        provider: 'openrouter'
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                generatedText = data.text || '';
            } else if (claudeKey) {
                // Priority 3: Claude (Anthropic) - uses unified /api/openai endpoint
                const response = await fetch('/api/openai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        apiKey: claudeKey,
                        model: 'claude-sonnet-4-20250514',
                        temperature: 0.7,
                        maxTokens: 8000,
                        provider: 'claude'
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                generatedText = data.text || '';
            } else {
                // Priority 4: DeepSeek Chat (server-based fallback)
                const response = await fetch('/api/deepseek', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: prompt,
                        temperature: 0.7
                    })
                });
                const data = await response.json();
                generatedText = data.text || '';
            }

            // Convert markdown to HTML and set content
            const htmlContent = markdownToHtml(generatedText);
            const { title, html } = extractTitleFromHtml(htmlContent);
            if (title) {
                setArticleTitle(title);
            }
            setContent(html);

            // Calculate a real content score based on keyword usage
            const contentLower = generatedText.toLowerCase();
            const keywordUsage = allAutoSuggestKeywords.slice(0, 20).filter(kw =>
                contentLower.includes(kw.toLowerCase())
            ).length;
            setContentScore(Math.min(95, 60 + (keywordUsage * 2)));

        } catch (e) {
            console.error(e);
            alert('Error generating content: ' + e.message);
        }
        setIsGenerating(false);
    };

    // Step 12: Master Prompt - Review & Edit
    const Step12MasterPrompt = () => {
        // Auto-generate prompt on mount if empty
        useEffect(() => {
            if (!masterPrompt) {
                setMasterPrompt(buildMegaPrompt());
            }
        }, []);

        return (
            <div className="space-y-4">
                <div className="ctool-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-brand-500" />
                            Master Prompt
                        </h3>
                        <button
                            onClick={() => setMasterPrompt(buildMegaPrompt())}
                            className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-500/20 transition"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Regenerate
                        </button>
                    </div>
                    <p className="text-sm text-white/50 mb-4">This is the complete prompt that will be sent to the AI. You can edit it to fine-tune the output before generating content.</p>
                    <textarea
                        value={masterPrompt}
                        onChange={(e) => setMasterPrompt(e.target.value)}
                        className="w-full h-[500px] px-4 py-3 border border-white/10 rounded-xl font-mono text-sm leading-relaxed focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition resize-y bg-white/[0.03]"
                        placeholder="The master prompt will be auto-generated from your data..."
                    />
                    <div className="flex items-center justify-between mt-3 text-xs text-white/40">
                        <span>{masterPrompt.length.toLocaleString()} characters</span>
                        <span>~{Math.ceil(masterPrompt.length / 4).toLocaleString()} tokens (approx)</span>
                    </div>
                </div>
            </div>
        );
    };

    // Step 13: Content Editor - render function (not component) to avoid hooks violation
    const renderStep13 = () => {
        // Use top-level state instead of local hooks
        const sidebarTab = step12SidebarTab;
        const setSidebarTab = setStep12SidebarTab;
        const termSearch = step12TermSearch;
        const setTermSearch = setStep12TermSearch;
        const termFilter = step12TermFilter;
        const setTermFilter = setStep12TermFilter;

        // Calculate content metrics
        const wordCount = content.split(/\s+/).filter(w => w).length;
        const headingCount = (content.match(/^#{1, 6}\s/gm) || []).length;
        const paragraphCount = content.split(/\n\n+/).filter(p => p.trim()).length;
        const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;

        // Calculate keyword usage in content
        const getKeywordUsage = (keyword) => {
            const regex = new RegExp(keyword.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&'), 'gi');
            return (content.match(regex) || []).length;
        };

        // All terms combined
        const allTerms = [
            ...(keywordData.competitorEntities || []),
            ...(keywordData.aiEntities || []),
            ...(keywordData.nlpKeywords || []),
            ...(keywordData.ngrams?.threeGrams || []),
            ...(keywordData.ngrams?.fourGrams || [])
        ].filter((v, i, a) => a.indexOf(v) === i);

        const filteredTerms = allTerms.filter(t =>
            t.toLowerCase().includes(termSearch.toLowerCase())
        ).slice(0, 50);

        const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,div';
        const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div']);

        const findClosestBlock = (node, editor) => {
            if (!node || !editor) return null;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

            while (current && current !== editor) {
                const tag = current.tagName?.toLowerCase();
                if (tag && BLOCK_TAGS.has(tag)) return current;
                current = current.parentElement;
            }

            return null;
        };

        const getTopLevelNode = (node, editor) => {
            if (!node || !editor) return null;
            let current = node;

            while (current && current.parentNode && current.parentNode !== editor) {
                current = current.parentNode;
            }

            return current?.parentNode === editor ? current : null;
        };

        const saveSelection = () => {
            const editor = editorRef.current;
            const sel = window.getSelection();
            if (!editor || !sel || sel.rangeCount === 0) return;

            const range = sel.getRangeAt(0);
            if (!editor.contains(range.commonAncestorContainer)) return;

            savedSelectionRef.current = range.cloneRange();

            const startBlock = findClosestBlock(range.startContainer, editor);
            const endBlock = findClosestBlock(range.endContainer, editor);
            savedBlockRef.current = startBlock;

            const blocks = Array.from(editor.querySelectorAll(BLOCK_SELECTOR));
            const startIndex = startBlock ? blocks.indexOf(startBlock) : null;
            const endIndex = endBlock ? blocks.indexOf(endBlock) : null;
            savedBlockRangeRef.current = { start: startIndex, end: endIndex };
        };

        const restoreSelection = () => {
            if (savedSelectionRef.current) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedSelectionRef.current);
            }
        };

        // Execute formatting commands
        const execCommand = (command, value = null) => {
            isRestoringRef.current = true;
            // Focus the editor first
            if (editorRef.current) {
                editorRef.current.focus();
            }
            // Restore the saved selection
            restoreSelection();
            // Execute the command
            document.execCommand(command, false, value);
            // Update content state
            if (editorRef.current) {
                setContent(editorRef.current.innerHTML);
            }
            isRestoringRef.current = false;
        };

        const applyBlockFormat = (tagName) => {
            if (!tagName || !editorRef.current) return;

            const normalizedTag = tagName.toLowerCase();
            const editor = editorRef.current;

            isRestoringRef.current = true;
            editor.focus();
            restoreSelection();

            const blocks = Array.from(editor.querySelectorAll(BLOCK_SELECTOR));
            const { start, end } = savedBlockRangeRef.current || {};

            let targetBlocks = [];
            if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end >= 0) {
                const rangeStart = Math.min(start, end);
                const rangeEnd = Math.max(start, end);
                targetBlocks = blocks.slice(rangeStart, rangeEnd + 1);
            }

            if (targetBlocks.length === 0) {
                const selection = window.getSelection();
                if (selection?.rangeCount) {
                    const range = selection.getRangeAt(0);
                    if (editor.contains(range.commonAncestorContainer)) {
                        const currentBlock = findClosestBlock(range.commonAncestorContainer, editor);
                        if (currentBlock) {
                            targetBlocks = [currentBlock];
                        }
                    }
                }
            }

            if (targetBlocks.length === 0) {
                const selection = window.getSelection();
                if (selection?.rangeCount) {
                    const range = selection.getRangeAt(0);
                    if (editor.contains(range.commonAncestorContainer)) {
                        const topLevelNode = getTopLevelNode(range.startContainer, editor);
                        if (topLevelNode) {
                            if (topLevelNode.nodeType === Node.TEXT_NODE && topLevelNode.textContent.trim()) {
                                const paragraph = document.createElement('p');
                                topLevelNode.parentNode.insertBefore(paragraph, topLevelNode);
                                paragraph.appendChild(topLevelNode);
                                targetBlocks = [paragraph];
                            } else if (topLevelNode.nodeType === Node.ELEMENT_NODE) {
                                const tag = topLevelNode.tagName.toLowerCase();
                                if (BLOCK_TAGS.has(tag)) {
                                    targetBlocks = [topLevelNode];
                                } else if (topLevelNode.textContent.trim()) {
                                    const paragraph = document.createElement('p');
                                    topLevelNode.parentNode.insertBefore(paragraph, topLevelNode);
                                    paragraph.appendChild(topLevelNode);
                                    targetBlocks = [paragraph];
                                }
                            }
                        }
                    }
                }
            }

            if (targetBlocks.length > 0) {
                const convertedBlocks = targetBlocks.map((block) => {
                    if (block.tagName.toLowerCase() === normalizedTag) return block;
                    const replacement = document.createElement(normalizedTag);
                    replacement.innerHTML = block.innerHTML;
                    block.replaceWith(replacement);
                    return replacement;
                });

                const lastBlock = convertedBlocks[convertedBlocks.length - 1];
                if (lastBlock) {
                    const range = document.createRange();
                    range.selectNodeContents(lastBlock);
                    range.collapse(false);
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    savedSelectionRef.current = range.cloneRange();
                }
            } else {
                const beforeHtml = editor.innerHTML;
                document.execCommand('formatBlock', false, normalizedTag.toUpperCase());
                if (editor.innerHTML === beforeHtml) {
                    document.execCommand('formatBlock', false, `<${normalizedTag}>`);
                }
            }

            setContent(editor.innerHTML);
            isRestoringRef.current = false;
        };

        const insertLink = () => {
            const url = prompt('Enter URL:');
            if (url) execCommand('createLink', url);
        };

        const insertImage = () => {
            const url = prompt('Enter image URL:');
            if (url) execCommand('insertImage', url);
        };

        // Calculate score color
        const scoreColor = contentScore >= 80 ? '#22c55e' : contentScore >= 60 ? '#f59e0b' : '#ef4444';
        const scoreProgress = (contentScore / 100) * 283; // Circumference of circle

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Editor - Left Side */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Toolbar & Editor Card */}
                    <div className="scw-panel">
                        <div
                            className="scw-toolbar flex-wrap"
                            onMouseDownCapture={saveSelection}
                        >
                            {/* Font dropdown */}
                            <select className="schema-input scw-tool-select" onChange={(e) => execCommand('fontName', e.target.value)}>
                                <option value="">Font</option>
                                <option value="serif">Serif</option>
                                <option value="sans-serif">Sans-serif</option>
                                <option value="monospace">Monospace</option>
                            </select>

                            <div className="scw-tool-sep" />

                            {/* Text formatting */}
                            <button onClick={() => execCommand('bold')} className="scw-tool font-bold" title="Bold">B</button>
                            <button onClick={() => execCommand('italic')} className="scw-tool italic" title="Italic">I</button>
                            <button onClick={() => execCommand('underline')} className="scw-tool underline" title="Underline">U</button>
                            <button onClick={() => execCommand('strikeThrough')} className="scw-tool line-through" title="Strikethrough">S</button>

                            <div className="scw-tool-sep" />

                            {/* Alignment */}
                            <button onClick={() => execCommand('justifyLeft')} className="scw-tool" title="Align Left">
                                <AlignLeft className="w-4 h-4" />
                            </button>
                            <button onClick={() => execCommand('justifyCenter')} className="scw-tool" title="Align Center">
                                <AlignCenter className="w-4 h-4" />
                            </button>

                            <div className="scw-tool-sep" />

                            {/* Lists */}
                            <button onClick={() => execCommand('insertUnorderedList')} className="scw-tool" title="Bullet List">
                                <List className="w-4 h-4" />
                            </button>
                            <button onClick={() => execCommand('insertOrderedList')} className="scw-tool" title="Numbered List">
                                <ListOrdered className="w-4 h-4" />
                            </button>

                            <div className="scw-tool-sep" />

                            {/* Headings */}
                            <select
                                className="schema-input scw-tool-select"
                                onMouseDown={(e) => {
                                    saveSelection();
                                }}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        applyBlockFormat(e.target.value);
                                        e.target.selectedIndex = 0;
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>Heading</option>
                                <option value="P">Paragraph</option>
                                <option value="H1">H1</option>
                                <option value="H2">H2</option>
                                <option value="H3">H3</option>
                                <option value="H4">H4</option>
                                <option value="H5">H5</option>
                                <option value="H6">H6</option>
                            </select>

                            <div className="scw-tool-sep" />

                            {/* Links & Media */}
                            <button onClick={insertLink} className="scw-tool" title="Insert Link">
                                <Link2 className="w-4 h-4" />
                            </button>
                            <button onClick={insertImage} className="scw-tool" title="Insert Image">
                                <ImageIcon className="w-4 h-4" />
                            </button>

                            <div className="scw-tool-sep" />

                            {/* Undo/Redo */}
                            <button onClick={() => execCommand('undo')} className="scw-tool" title="Undo">
                                <Undo className="w-4 h-4" />
                            </button>
                            <button onClick={() => execCommand('redo')} className="scw-tool" title="Redo">
                                <Redo className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="scw-actionbar flex-wrap">
                            {/* Left: Generate with AI + View Prompt + Writer Outline */}
                            <button
                                onClick={generateContent}
                                disabled={isGenerating || !mainKeyword}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-brand-500/20 transition hover:shadow-brand-500/40 disabled:opacity-40"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Generate with AI
                            </button>
                            <button
                                onClick={() => { setMegaPrompt(masterPrompt || buildMegaPrompt()); setShowPromptModal(true); }}
                                className="ui-button eeat-secondary-button"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                View Prompt
                            </button>
                            <button
                                onClick={insertWriterOutline}
                                disabled={!mainKeyword}
                                className="ui-button eeat-secondary-button"
                                title="Fill editor with collected data (entities, keywords, SEO rules, etc.)"
                            >
                                <List className="w-3.5 h-3.5" />
                                Writer Outline
                            </button>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Right: Show Process + Start Fresh */}
                            <button
                                onClick={() => setShowProcessOnStep12(!showProcessOnStep12)}
                                className="ui-button eeat-secondary-button"
                                title="Toggle 12-step process visibility"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                {showProcessOnStep12 ? 'Hide Process' : 'Show Process'}
                            </button>
                            <button
                                onClick={resetAllState}
                                className="ui-button eeat-secondary-button"
                                title="Reset all progress and start fresh"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Start Fresh
                            </button>
                        </div>

                        {/* Mega Prompt Modal */}
                        {showPromptModal && (
                            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                                <div className="scw-modal max-w-4xl w-full max-h-[80vh] overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-brand-400" />
                                            Mega Prompt Preview
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(megaPrompt); }}
                                                className="ui-button eeat-secondary-button"
                                            >
                                                <Copy className="w-3.5 h-3.5" /> Copy
                                            </button>
                                            <button onClick={() => setShowPromptModal(false)} className="scw-tool">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                                        <pre className="stool-code whitespace-pre-wrap">
                                            {megaPrompt}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Feedback banner */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 text-brand-300 text-xs border-b border-brand-500/20">
                            <AlertCircle className="w-4 h-4 text-brand-400 flex-shrink-0" />
                            <span>AI will generate SEO-optimized content using all your collected data. Click "View Prompt" to see what's being sent.</span>
                        </div>

                        {/* Article Title */}
                        <div className="px-6 pt-6">
                            <input
                                type="text"
                                value={articleTitle}
                                onChange={(e) => setArticleTitle(e.target.value)}
                                placeholder="Article Title..."
                                className="scw-title-input"
                            />
                        </div>

                        {/* Editor Content */}
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => {
                                isUserInputRef.current = true;
                                setContent(e.currentTarget.innerHTML);
                            }}
                            onBlur={saveSelection}
                            onSelect={saveSelection}
                            onMouseUp={saveSelection}
                            onKeyUp={saveSelection}
                            className="scw-canvas prose max-w-none"
                            style={{ lineHeight: '1.8' }}
                        />

                        {/* Footer */}
                        <div className="scw-editor-foot">
                            <div className="flex items-center gap-2">
                                <span className="scw-dot" />
                                Connected • Editing Mode
                            </div>
                            <span className="scw-foot-note">Auto-saved to local database</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar - Right Side */}
                <div className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="scw-panel">
                        <div className="scw-tabs">
                            {['guidelines', 'outline', 'brief'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setSidebarTab(tab)}
                                    className={`ui-button ctool-tab scw-tab ${sidebarTab === tab ? 'active' : ''}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-5">
                            {sidebarTab === 'guidelines' && (
                                <>
                                    {/* Content Score Gauge */}
                                    <div className="text-center mb-6">
                                        <p className="stool-label mb-3 flex items-center justify-center gap-1">
                                            Content Score <AlertCircle className="w-3.5 h-3.5 text-brand-400" />
                                        </p>
                                        <div className="relative w-32 h-32 mx-auto">
                                            <svg className="w-32 h-32 transform -rotate-90">
                                                <circle cx="64" cy="64" r="45" stroke="#334155" strokeWidth="10" fill="none" />
                                                <circle
                                                    cx="64" cy="64" r="45"
                                                    stroke={scoreColor}
                                                    strokeWidth="10"
                                                    fill="none"
                                                    strokeDasharray="283"
                                                    strokeDashoffset={283 - scoreProgress}
                                                    strokeLinecap="round"
                                                    className="transition-all duration-500"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="scw-score">{contentScore}</span>
                                                <span className="scw-score-max">/100</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-center gap-4 mt-3 ctool-help-text">
                                            <span>Avg ↓ 70</span>
                                            <span>Top ↗ 79</span>
                                        </div>
                                    </div>

                                    {/* Content Structure */}
                                    <div className="border-t border-white/10 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Content Structure</h4>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div className="scw-stat">
                                                <div className="text-base font-black text-emerald-400">{wordCount.toLocaleString()}</div>
                                                <div className="scw-stat-label">Target</div>
                                                <div className="scw-stat-sub">WORDS</div>
                                            </div>
                                            <div className="scw-stat">
                                                <div className="text-base font-black text-amber-400">{headingCount}</div>
                                                <div className="scw-stat-label">Target</div>
                                                <div className="scw-stat-sub">HEADINGS</div>
                                            </div>
                                            <div className="scw-stat">
                                                <div className="text-base font-black text-emerald-400">{paragraphCount}</div>
                                                <div className="scw-stat-label">Target</div>
                                                <div className="scw-stat-sub">PARAGRAPHS</div>
                                            </div>
                                            <div className="scw-stat">
                                                <div className="text-base font-black text-brand-400">{imageCount}</div>
                                                <div className="scw-stat-label">Target</div>
                                                <div className="scw-stat-sub">IMAGES</div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {sidebarTab === 'outline' && (
                                <div className="space-y-1.5 text-xs max-h-96 overflow-y-auto">
                                    {combinedOutline.length > 0 ? combinedOutline.map((h, i) => (
                                        <div key={i} className="scw-listrow" style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}>
                                            <span className="text-[10px] font-bold text-brand-400 uppercase">H{h.level}</span>
                                            <span className="scw-listrow-text">{h.text}</span>
                                        </div>
                                    )) : (
                                        <p className="ctool-help-text text-center py-4">No outline created yet</p>
                                    )}
                                </div>
                            )}

                            {sidebarTab === 'brief' && (
                                <div className="space-y-3 ctool-help-text">
                                    <p><strong className="text-white">Main Keyword:</strong> {mainKeyword || 'Not set'}</p>
                                    <p><strong className="text-white">Mode:</strong> {writerMode === 'quick' ? '⚡ Quick' : '🔬 Express'}</p>
                                    <p><strong className="text-white">Active Rules:</strong> {selectedRules.length} enabled</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Extracted Data Panels */}
                    <div className="scw-panel scw-panel-pad space-y-4 max-h-[600px] overflow-y-auto">
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider">Extracted Data & Keywords</h4>

                        {/* Entities Box */}
                        {(keywordData.competitorEntities?.length > 0 || keywordData.aiEntities?.length > 0 || keywordData.uniqueEntities?.length > 0) && (
                            <div className="border border-amber-500/20 rounded-xl p-3 bg-amber-500/5">
                                <h5 className="font-bold text-amber-300 text-xs mb-2 flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" /> Entities
                                </h5>
                                {keywordData.competitorEntities?.length > 0 && (
                                    <div className="mb-2">
                                        <span className="text-[10px] font-bold text-amber-400 uppercase">Competitor ({keywordData.competitorEntities.length})</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {keywordData.competitorEntities.slice(0, 15).map((e, i) => (
                                                <span key={i} onClick={() => execCommand('insertText', ` ${e} `)} className="scw-chip">{e}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {keywordData.aiEntities?.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-400 uppercase">AI-Picked ({keywordData.aiEntities.length})</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {keywordData.aiEntities.slice(0, 15).map((e, i) => (
                                                <span key={i} onClick={() => execCommand('insertText', ` ${e} `)} className="scw-chip">{e}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* N-Grams Box */}
                        {(keywordData.competitorNgrams?.length > 0 || keywordData.aiPickedNgrams?.length > 0 || keywordData.aiGeneratedNgrams?.length > 0 || keywordData.uniqueNgrams?.length > 0) && (
                            <div className="border border-blue-500/20 rounded-xl p-3 bg-blue-500/5">
                                <h5 className="font-bold text-blue-300 text-xs mb-2 flex items-center gap-1">
                                    <Hash className="w-3.5 h-3.5" /> N-Grams
                                </h5>
                                {keywordData.aiPickedNgrams?.length > 0 && (
                                    <div className="mb-2">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase">AI-Picked ({keywordData.aiPickedNgrams.length})</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {keywordData.aiPickedNgrams.slice(0, 12).map((n, i) => (
                                                <span key={i} onClick={() => execCommand('insertText', ` ${n} `)} className="scw-chip">{n}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* NLP Keywords Box */}
                        {keywordData.nlpKeywords?.length > 0 && (
                            <div className="border border-emerald-500/20 rounded-xl p-3 bg-emerald-500/5">
                                <h5 className="font-bold text-emerald-300 text-xs mb-2 flex items-center gap-1">
                                    <Brain className="w-3.5 h-3.5" /> NLP Keywords ({keywordData.nlpKeywords.length})
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                    {keywordData.nlpKeywords.slice(0, 25).map((kw, i) => (
                                        <span key={i} onClick={() => execCommand('insertText', ` ${kw} `)} className="scw-chip">{kw}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {!keywordData.competitorEntities?.length && !keywordData.nlpKeywords?.length && !keywordData.skipGrams?.length && (
                            <div className="text-center py-6 ctool-help-text">
                                <p>No extracted data yet.</p>
                                <p className="text-[11px] mt-1">Complete previous steps to surface live keywords & entities.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Handle URL params on mount — load article or show mode selector
    useEffect(() => {
        const articleParam = searchParams.get('article');
        const actionParam = searchParams.get('action');
        if (actionParam === 'new') {
            // Reset all state for a brand-new article
            setWriterMode(null);
            setCurrentArticleId(null);
            setCurrentStep(1);
            setMainKeyword('');
            setCompetitors(['']);
            setExtractedOutlines({});
            setCombinedOutline([]);
            setCompetitorContent('');
            setKeywordData({ competitorEntities: [], aiEntities: [], competitorNgrams: [], aiPickedNgrams: [], aiGeneratedNgrams: [], uniqueNgrams: [], ngrams: { threeGrams: [], fourGrams: [], aiPicked: [] }, nlpKeywords: [], skipGrams: [], grammar: {}, autoSuggest: [] });
            setExcludedItems({ competitorEntities: new Set(), aiEntities: new Set(), competitorNgrams: new Set(), aiPickedNgrams: new Set(), aiGeneratedNgrams: new Set(), uniqueNgrams: new Set(), nlpKeywords: new Set(), skipGrams: new Set(), grammar: new Set() });
            setSelectedRules([]);
            setAiInstructions({ conciseWriting: true, naturalLanguage: true, avoidAIPatterns: true });
            setArticleTitle('');
            setContent('');
            setContentScore(0);
            setAutoSuggestKeywords({});
            setAiPickedKeywords([]);
            setCheckedKeywords(new Set());
            setGrammarResults(null);
            setSkippedSteps([]);
            setMasterPrompt('');
            setHeadingWordCounts({});
            setShowWordCount(false);
        } else if (articleParam) {
            loadArticle(articleParam);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // If no mode selected, show mode selector (new article screen)
    if (!writerMode) {
        return (
            <div className="ctool-page space-y-5">
                {/* Back Navigation Bar */}
                <div className="scw-backbar">
                    <button
                        onClick={() => navigate('/content/semantic-writer')}
                        className="ui-button ctool-tool-btn"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Articles
                    </button>
                    <span className="stool-label">New Article Setup</span>
                </div>

                {/* Hero Banner */}
                <div className="ctool-hero">
                    <div className="ctool-hero-row">
                        <span className="ctool-hero-icon">
                            <Sparkles className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="ctool-title font-display">Start New Article</h1>
                            <p className="ctool-subtitle">Choose your AI content creation &amp; optimization workflow</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {/* Quick Mode Card */}
                    <button onClick={() => startNewArticle('quick')} className="scw-mode">
                        <span className="app-badge app-badge-neutral scw-mode-badge">Fast</span>
                        <span className="ctool-hero-icon scw-mode-icon">
                            <Zap className="w-5 h-5" />
                        </span>
                        <h3 className="scw-mode-title font-display">Quick Mode</h3>
                        <p className="scw-mode-desc">Generate a focused article in 4 streamlined steps. Ideal for rapid content creation.</p>
                        <div className="scw-mode-list">
                            {['Competitor Research + Keywords', 'Outline Creation', 'Word Count Configuration', 'AI Content Editor'].map(t => (
                                <div key={t} className="scw-mode-item">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </button>

                    {/* Express Mode Card */}
                    <button onClick={() => startNewArticle('express')} className="scw-mode">
                        <span className="app-badge app-badge-brand scw-mode-badge">Full</span>
                        <span className="ctool-hero-icon scw-mode-icon">
                            <Layers className="w-5 h-5" />
                        </span>
                        <h3 className="scw-mode-title font-display">Express Mode</h3>
                        <p className="scw-mode-desc">Deep semantic optimization with all 13 steps for maximum organic search impact.</p>
                        <div className="scw-mode-list">
                            {['Full competitor analysis', 'Entities, N-Grams, NLP Keywords', 'Grammar, SEO rules, AI instructions', 'Master prompt + Content editor'].map(t => (
                                <div key={t} className="scw-mode-item">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    const activeSteps = getActiveSteps();

    return (
        <div className="semantic-writer-workspace space-y-6">
            {/* Back Navigation Bar */}
            <div className="top-nav-bar flex items-center justify-between px-5 py-3 rounded-2xl">
                <button
                    onClick={goToLanding}
                    className="flex items-center gap-2 text-xs font-bold transition px-4 py-2 rounded-xl"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Articles
                </button>
                <button
                    onClick={goToLanding}
                    className="flex items-center gap-2 text-xs font-bold transition px-4 py-2 rounded-xl"
                >
                    <FolderOpen className="w-4 h-4" />
                    All Articles
                </button>
            </div>

            {/* Header - Hidden on Step 13 (Content Editor) */}
            {currentStep !== 13 && (
                <div className="writer-hero relative overflow-hidden rounded-3xl p-6 shadow-xl">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-[100px]" />
                        <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-amber-500/10 blur-[80px]" />
                    </div>
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="hero-icon flex h-10 w-10 items-center justify-center rounded-xl">
                                <Edit3 className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="hero-title font-display text-xl font-black">Content Writer Workspace</h1>
                                <p className="hero-sub text-xs">
                                    {writerMode === 'quick' ? '⚡ Quick Mode' : '🔬 Express Mode'}
                                    {showWordCount && ' — Word Count Setup'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowProcess(!showProcess)}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                                title="Toggle step process visibility"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                {showProcess ? 'Hide Process' : 'Show Process'}
                            </button>
                            <button
                                onClick={goToLanding}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                                title="Go back to article list"
                            >
                                <FolderOpen className="w-3.5 h-3.5" />
                                Articles
                            </button>
                            <button
                                onClick={resetAllState}
                                className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                                title="Reset all progress and start fresh"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Start Fresh
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* API Status Banner */}
            {currentStep !== 13 && !showWordCount && (() => {
                const openaiKey = '';
                const openrouterKey = '';
                const claudeKey = '';
                const hasOpenAI = !!openaiKey;
                const hasOpenRouter = !!openrouterKey;
                const hasClaude = !!claudeKey;

                if (hasOpenAI) {
                    return (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-3 shadow-sm">
                            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-emerald-800">Using OpenAI (ChatGPT) for content generation</p>
                            </div>
                            <a href="/settings" className="text-xs font-bold text-emerald-700 hover:underline">Settings</a>
                        </div>
                    );
                } else if (hasOpenRouter) {
                    return (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex items-center gap-3 shadow-sm">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-blue-800">Using OpenRouter for content generation</p>
                                <p className="text-xs text-blue-700 font-medium">Add OpenAI key for ChatGPT priority</p>
                            </div>
                            <a href="/settings" className="text-xs font-bold text-blue-700 hover:underline">Settings</a>
                        </div>
                    );
                } else if (hasClaude) {
                    return (
                        <div className="p-4 bg-brand-500/10 border border-brand-500/25 rounded-2xl flex items-center gap-3 shadow-sm">
                            <Sparkles className="w-5 h-5 text-brand-600 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-brand-800">Using Claude (Anthropic) for content generation</p>
                                <p className="text-xs text-brand-700 font-medium">Add OpenAI or OpenRouter key for higher priority</p>
                            </div>
                            <a href="/settings" className="text-xs font-bold text-brand-700 hover:underline">Settings</a>
                        </div>
                    );
                } else {
                    return (
                        <div className="api-status-amber p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                <div>
                                    <p className="status-title text-sm font-bold">No API key configured — Using DeepSeek Chat</p>
                                    <p className="status-desc text-xs font-medium">Add your OpenAI, OpenRouter, or Claude API key in Settings for enhanced performance</p>
                                </div>
                            </div>
                            <a href="/settings" className="btn-add-key px-4 py-2 text-xs font-bold rounded-xl transition shadow-md flex-shrink-0">Add API Key</a>
                        </div>
                    );
                }
            })()}

            {/* Step Progress Bar matching EeatAudit tab buttons */}
            {(currentStep === 13 ? showProcessOnStep12 : showProcess) && (
                <div className="step-progress-bar rounded-2xl p-3 shadow-sm">
                    {writerMode === 'quick' ? (
                        /* Quick Mode: Single row with 4 steps */
                        <div className="flex items-center justify-between gap-2 overflow-x-auto w-full no-scrollbar py-0.5">
                            <button
                                onClick={() => goToStep(1)}
                                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs transition whitespace-nowrap ${currentStep === 1 && !showWordCount
                                    ? 'step-tab-active'
                                    : currentStep > 1
                                        ? 'step-tab-complete'
                                        : 'step-tab-inactive'
                                    }`}
                            >
                                <Search className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Research</span>
                            </button>
                            <ChevronRight className="w-4 h-4 text-content-muted flex-shrink-0 hidden sm:block" />
                            <button
                                onClick={() => goToStep(2)}
                                disabled={!isStepComplete(1)}
                                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs transition whitespace-nowrap ${currentStep === 2 && !showWordCount
                                    ? 'step-tab-active'
                                    : currentStep > 2 || showWordCount
                                        ? 'step-tab-complete'
                                        : 'step-tab-inactive'
                                    } ${!isStepComplete(1) ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <List className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Outline</span>
                            </button>
                            <ChevronRight className="w-4 h-4 text-content-muted flex-shrink-0 hidden sm:block" />
                            <button
                                onClick={() => { if (isStepComplete(2)) { setCurrentStep(2); setShowWordCount(true); } }}
                                disabled={!isStepComplete(2)}
                                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs transition whitespace-nowrap ${showWordCount
                                    ? 'step-tab-active'
                                    : (currentStep === 13 ? 'step-tab-complete' : 'step-tab-inactive')
                                    } ${!isStepComplete(2) ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <Gauge className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Word Count</span>
                            </button>
                            <ChevronRight className="w-4 h-4 text-content-muted flex-shrink-0 hidden sm:block" />
                            <button
                                onClick={() => { if (isStepComplete(2)) goToStep(13); }}
                                disabled={!isStepComplete(2)}
                                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs transition whitespace-nowrap ${currentStep === 13 && !showWordCount
                                    ? 'step-tab-active'
                                    : 'step-tab-inactive'
                                    } ${!isStepComplete(2) ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <Edit3 className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Content Editor</span>
                            </button>
                        </div>
                    ) : (
                        /* Express Mode: Two rows */
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1.5 overflow-x-auto w-full no-scrollbar py-0.5">
                                {STEPS.slice(0, 7).map((step, index) => (
                                    <React.Fragment key={step.id}>
                                        <button
                                            onClick={() => goToStep(step.id)}
                                            disabled={step.id > 1 && !isStepComplete(step.id - 1)}
                                            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs transition whitespace-nowrap ${currentStep === step.id && !showWordCount
                                                ? 'step-tab-active'
                                                : skippedSteps.includes(step.id)
                                                    ? 'bg-amber-100 border border-amber-300 text-amber-800 font-bold'
                                                    : currentStep > step.id || (step.id === 2 && showWordCount)
                                                        ? 'step-tab-complete'
                                                        : 'step-tab-inactive'
                                                } ${step.id > 1 && !isStepComplete(step.id - 1) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <step.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="inline">{step.name}</span>
                                        </button>
                                        {step.id === 2 && (
                                            <>
                                                <ChevronRight className="w-3 h-3 text-content-muted flex-shrink-0" />
                                                <button
                                                    onClick={() => { if (isStepComplete(2)) { setCurrentStep(2); setShowWordCount(true); } }}
                                                    disabled={!isStepComplete(2)}
                                                    className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs transition whitespace-nowrap ${showWordCount
                                                        ? 'step-tab-active'
                                                        : (currentStep > 2 ? 'step-tab-complete' : 'step-tab-inactive')
                                                        } ${!isStepComplete(2) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                >
                                                    <Gauge className="w-3.5 h-3.5 flex-shrink-0" />
                                                    <span className="inline">Word Count</span>
                                                </button>
                                            </>
                                        )}
                                        {index < 6 && (
                                            <ChevronRight className="w-3 h-3 text-content-muted flex-shrink-0" />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="flex items-center justify-between gap-1.5 overflow-x-auto w-full no-scrollbar py-0.5">
                                {STEPS.slice(7).map((step, index) => (
                                    <React.Fragment key={step.id}>
                                        <button
                                            onClick={() => goToStep(step.id)}
                                            disabled={step.id > 1 && !isStepComplete(step.id - 1)}
                                            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs transition whitespace-nowrap ${currentStep === step.id && !showWordCount
                                                ? 'step-tab-active'
                                                : skippedSteps.includes(step.id)
                                                    ? 'bg-amber-100 border border-amber-300 text-amber-800 font-bold'
                                                    : currentStep > step.id
                                                        ? 'step-tab-complete'
                                                        : 'step-tab-inactive'
                                                } ${step.id > 1 && !isStepComplete(step.id - 1) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <step.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="inline">{step.name}</span>
                                        </button>
                                        {index < STEPS.slice(7).length - 1 && (
                                            <ChevronRight className="w-3 h-3 text-content-muted flex-shrink-0" />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step Content */}
            <div>
                {showWordCount ? renderWordCountStep() : renderStepContent()}
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center pt-2">
                <button
                    onClick={prevStep}
                    disabled={currentStep === 1 && !showWordCount}
                    className="ui-button ctool-tool-btn scw-nav-btn"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </button>
                {currentStep < 13 && !showWordCount && (
                    <button
                        onClick={skipStep}
                        className="ui-button ctool-tool-btn scw-nav-btn"
                        title="Skip this step and mark as done"
                    >
                        <SkipForward className="w-4 h-4" />
                        Skip Step
                    </button>
                )}
                <button
                    onClick={nextStep}
                    disabled={(currentStep === 13 && !showWordCount) || (!showWordCount && !isStepComplete(currentStep))}
                    className="ui-button ui-button-primary scw-nav-btn"
                >
                    {showWordCount && writerMode === 'quick' ? 'Start Writing' : 'Next Step'}
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ContentWriter;
