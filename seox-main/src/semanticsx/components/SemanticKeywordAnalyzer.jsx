import { useState } from 'react';
import {
    Search, Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp,
    Hash, Brain, Type, Network, Zap, Tag, Lightbulb, ClipboardList
} from 'lucide-react';
import { authenticatedJson } from '../lib/authenticatedFetch';
import { parseSemanticKeywordResponse } from '../lib/semanticKeywordResult';

const SemanticKeywordAnalyzer = () => {
    const [keyword, setKeyword] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [copiedSection, setCopiedSection] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [currentStep, setCurrentStep] = useState('');

    // Section definitions
    const SECTIONS = {
        entities: {
            label: 'Entities',
            icon: Tag,
            color: 'from-fuchsia-500 to-pink-600',
            tagColor: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
            badgeColor: 'bg-fuchsia-100 text-fuchsia-700',
            subcategories: {
                people: { label: 'People', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                organizations: { label: 'Organizations', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                concepts: { label: 'Concepts', color: 'bg-pink-50 text-pink-700 border-pink-200' },
                products: { label: 'Products', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                locations: { label: 'Locations', color: 'bg-green-50 text-green-700 border-green-200' }
            }
        },
        ngrams: {
            label: 'N-Grams',
            icon: Hash,
            color: 'from-blue-500 to-cyan-600',
            tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
            badgeColor: 'bg-blue-100 text-blue-700',
            subcategories: {
                bigrams: { label: '2-Grams', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                trigrams: { label: '3-Grams', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                fourgrams: { label: '4-Grams', color: 'bg-violet-50 text-violet-700 border-violet-200' }
            }
        },
        nlp: {
            label: 'NLP Keywords',
            icon: Brain,
            color: 'from-purple-500 to-violet-600',
            tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
            badgeColor: 'bg-purple-100 text-purple-700',
            subcategories: {
                primaryKeywords: { label: 'Primary Keywords', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                secondaryKeywords: { label: 'Secondary Keywords', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                lsiKeywords: { label: 'LSI Keywords', color: 'bg-green-50 text-green-700 border-green-200' }
            }
        },
        grammar: {
            label: 'Grammar',
            icon: Type,
            color: 'from-emerald-500 to-teal-600',
            tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            badgeColor: 'bg-emerald-100 text-emerald-700',
            subcategories: {
                proper_nouns: { label: 'Proper Nouns', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                common_nouns: { label: 'Common Nouns', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                synonyms: { label: 'Synonyms', color: 'bg-green-50 text-green-700 border-green-200' },
                antonyms: { label: 'Antonyms', color: 'bg-red-50 text-red-700 border-red-200' },
                hyponyms: { label: 'Hyponyms', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                hypernyms: { label: 'Hypernyms', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                meronyms: { label: 'Meronyms', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                holonyms: { label: 'Holonyms', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
            }
        },
        uniqueNgrams: {
            label: 'Unique N-Grams',
            icon: Sparkles,
            color: 'from-amber-500 to-orange-600',
            tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
            badgeColor: 'bg-amber-100 text-amber-700',
            subcategories: {
                informational: { label: 'Informational', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                commercial: { label: 'Commercial', color: 'bg-green-50 text-green-700 border-green-200' },
                longtail: { label: 'Long-tail', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                authority: { label: 'Authority-Building', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
            }
        },
        skipGrams: {
            label: 'Skip-Gram Words',
            icon: Network,
            color: 'from-violet-500 to-purple-600',
            tagColor: 'bg-violet-50 text-violet-700 border-violet-200',
            badgeColor: 'bg-violet-100 text-violet-700',
            subcategories: {
                word_sense_disambiguation: { label: 'Word Sense Disambiguation', color: 'bg-violet-50 text-violet-700 border-violet-200' },
                document_summarization: { label: 'Document Summarization', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                keyword_extraction: { label: 'Keyword Extraction', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
            }
        }
    };

    // Generate all sections via AI
    const generateAll = async () => {
        if (!keyword.trim()) {
            setError('Please enter a keyword');
            return;
        }

        setIsGenerating(true);
        setError('');
        setResults(null);

        const allResults = {};

        try {
            // Step 1: Entities
            setCurrentStep('Generating Entities...');
            const entitiesRes = await callAI('entities', 'entities.generate', { keyword });
            allResults.entities = entitiesRes;

            // Step 2: N-Grams
            setCurrentStep('Generating N-Grams...');
            const ngramsRes = await callAI('ngrams', 'ngrams.generate', { keyword });
            allResults.ngrams = ngramsRes;

            // Step 3: NLP Keywords
            setCurrentStep('Generating NLP Keywords...');
            const nlpRes = await callAI('nlp', 'nlp.generate', { keyword });
            allResults.nlp = nlpRes;

            // Step 4: Grammar
            setCurrentStep('Generating Grammar...');
            const grammarRes = await callAI('grammar', 'grammar.generate', { term: keyword });
            allResults.grammar = grammarRes;

            // Step 5: Unique N-Grams
            setCurrentStep('Generating Unique N-Grams...');
            const uniqueRes = await callAI('uniqueNgrams', 'unique-ngrams.generate', { term: keyword });
            allResults.uniqueNgrams = uniqueRes;

            // Step 6: Skip-Gram Words
            setCurrentStep('Generating Skip-Gram Words...');
            const skipgramRes = await callAI('skipGrams', 'skipgrams.generate', { term: keyword });
            allResults.skipGrams = skipgramRes;

            setResults(allResults);

            // Expand all sections by default
            const expanded = {};
            Object.keys(SECTIONS).forEach(key => { expanded[key] = true; });
            setExpandedSections(expanded);

        } catch (err) {
            console.error('Semantic keyword generation failed:', err?.name || 'UnknownError');
            setError(err?.message || 'The analysis could not be generated. Please try again.');
        } finally {
            setIsGenerating(false);
            setCurrentStep('');
        }
    };

    // Call the allowlisted server operation and accept only bounded, expected data.
    const callAI = async (sectionKey, operation, inputs) => {
        const data = await authenticatedJson('/api/ai-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operation,
                inputs
            })
        });
        return parseSemanticKeywordResponse(sectionKey, data.text);
    };

    // Toggle section expansion
    const toggleSection = (key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Get items count for a section
    const getSectionCount = (sectionKey) => {
        if (!results || !results[sectionKey]) return 0;
        const data = results[sectionKey];
        let count = 0;

        if (sectionKey === 'entities') {
            count = (data.entities || []).length;
        } else if (sectionKey === 'skipGrams') {
            if (data.word_sense_disambiguation) {
                data.word_sense_disambiguation.forEach(s => { count += (s.dominant_words || []).length; });
            }
            count += (data.document_summarization || []).length;
            count += (data.keyword_extraction || []).length;
        } else {
            const subs = SECTIONS[sectionKey].subcategories;
            Object.keys(subs).forEach(subKey => {
                const items = data[subKey];
                if (Array.isArray(items)) count += items.length;
            });
        }
        return count;
    };

    // Copy a single section
    const copySectionData = (sectionKey) => {
        if (!results || !results[sectionKey]) return;
        const data = results[sectionKey];
        const config = SECTIONS[sectionKey];
        let text = `## ${config.label}\n\n`;

        if (sectionKey === 'entities') {
            if (data.entities && data.entities.length > 0) {
                text += data.entities.join(', ') + '\n\n';
            }
            if (data.entityTypes) {
                Object.entries(data.entityTypes).forEach(([cat, items]) => {
                    if (items && items.length > 0) {
                        text += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
                        text += items.join(', ') + '\n\n';
                    }
                });
            }
        } else if (sectionKey === 'skipGrams') {
            if (data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0) {
                text += `### Word Sense Disambiguation\n`;
                data.word_sense_disambiguation.forEach(s => {
                    text += `**${s.sense}**: ${(s.dominant_words || []).join(', ')}\n`;
                });
                text += '\n';
            }
            if (data.document_summarization && data.document_summarization.length > 0) {
                text += `### Document Summarization\n`;
                text += data.document_summarization.join(', ') + '\n\n';
            }
            if (data.keyword_extraction && data.keyword_extraction.length > 0) {
                text += `### Keyword Extraction\n`;
                text += data.keyword_extraction.join(', ') + '\n\n';
            }
        } else {
            const subs = config.subcategories;
            Object.entries(subs).forEach(([subKey, subConfig]) => {
                const items = data[subKey];
                if (items && items.length > 0) {
                    text += `### ${subConfig.label}\n`;
                    text += items.join(', ') + '\n\n';
                }
            });
        }

        navigator.clipboard.writeText(text.trim());
        setCopiedSection(sectionKey);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    // Copy Prompt (all data formatted)
    const copyPrompt = () => {
        if (!results) return;

        let prompt = `Use this data to optimize the following content:\n\n`;

        Object.entries(SECTIONS).forEach(([sectionKey, config]) => {
            const data = results[sectionKey];
            if (!data) return;

            prompt += `## ${config.label}\n\n`;

            if (sectionKey === 'entities') {
                if (data.entities && data.entities.length > 0) {
                    prompt += data.entities.join(', ') + '\n\n';
                }
                if (data.entityTypes) {
                    Object.entries(data.entityTypes).forEach(([cat, items]) => {
                        if (items && items.length > 0) {
                            prompt += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
                            prompt += items.join(', ') + '\n\n';
                        }
                    });
                }
            } else if (sectionKey === 'skipGrams') {
                if (data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0) {
                    prompt += `### Word Sense Disambiguation\n`;
                    data.word_sense_disambiguation.forEach(s => {
                        prompt += `**${s.sense}**: ${(s.dominant_words || []).join(', ')}\n`;
                    });
                    prompt += '\n';
                }
                if (data.document_summarization && data.document_summarization.length > 0) {
                    prompt += `### Document Summarization\n`;
                    prompt += data.document_summarization.join(', ') + '\n\n';
                }
                if (data.keyword_extraction && data.keyword_extraction.length > 0) {
                    prompt += `### Keyword Extraction\n`;
                    prompt += data.keyword_extraction.join(', ') + '\n\n';
                }
            } else {
                const subs = config.subcategories;
                Object.entries(subs).forEach(([subKey, subConfig]) => {
                    const items = data[subKey];
                    if (items && items.length > 0) {
                        prompt += `### ${subConfig.label}\n`;
                        prompt += items.join(', ') + '\n\n';
                    }
                });
            }
        });

        navigator.clipboard.writeText(prompt.trim());
        setCopiedSection('prompt');
        setTimeout(() => setCopiedSection(null), 2000);
    };

    // Render subcategory items
    const renderSubcategoryItems = (data, sectionKey) => {
        if (!data) return null;
        const config = SECTIONS[sectionKey];

        if (sectionKey === 'entities') {
            return (
                <div className="p-4 space-y-4">
                    {data.entities && data.entities.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">All Entities</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.entities.map((entity, i) => (
                                    <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${config.tagColor}`}>
                                        {entity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.entityTypes && Object.entries(data.entityTypes).map(([cat, items]) => {
                        if (!items || items.length === 0) return null;
                        const subConfig = config.subcategories[cat];
                        if (!subConfig) return null;
                        return (
                            <div key={cat}>
                                <h4 className="text-sm font-medium text-gray-600 mb-2">{subConfig.label}</h4>
                                <div className="flex flex-wrap gap-2">
                                    {items.map((item, i) => (
                                        <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${subConfig.color}`}>
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (sectionKey === 'skipGrams') {
            return (
                <div className="p-4 space-y-4">
                    {data.word_sense_disambiguation && data.word_sense_disambiguation.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-3">Word Sense Disambiguation</h4>
                            <div className="space-y-3">
                                {data.word_sense_disambiguation.map((senseObj, idx) => (
                                    <div key={idx} className="bg-violet-50/50 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Lightbulb className="w-4 h-4 text-violet-600" />
                                            <h5 className="font-semibold text-violet-900">{senseObj.sense}</h5>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(senseObj.dominant_words || []).map((word, i) => (
                                                <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-white text-violet-700 border-violet-200">
                                                    {word}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.document_summarization && data.document_summarization.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Document Summarization</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.document_summarization.map((item, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-blue-50 text-blue-700 border-blue-200">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {data.keyword_extraction && data.keyword_extraction.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Keyword Extraction</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.keyword_extraction.map((item, i) => (
                                    <span key={i} className="px-3 py-1.5 rounded-full text-sm border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Standard subcategories rendering
        return (
            <div className="p-4 space-y-4">
                {Object.entries(config.subcategories).map(([subKey, subConfig]) => {
                    const items = data[subKey];
                    if (!items || items.length === 0) return null;
                    return (
                        <div key={subKey}>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">{subConfig.label}</h4>
                            <div className="flex flex-wrap gap-2">
                                {items.map((item, i) => (
                                    <span key={i} className={`px-3 py-1.5 rounded-full text-sm border ${subConfig.color}`}>
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="content-tool-page tool-dark-surface bg-gradient-to-br from-slate-50 to-teal-50 p-3 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-4 md:p-8 text-white mb-6 md:mb-8 shadow-xl">
                    <div className="flex items-center gap-3 md:gap-4 mb-4">
                        <div className="w-12 md:w-14 h-12 md:h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Zap className="w-6 md:w-7 h-6 md:h-7" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-3xl font-bold">Semantic Generator</h1>
                            <p className="text-sm md:text-base text-teal-200">Generate all NLP data for a keyword in one click</p>
                        </div>
                    </div>

                    <p className="text-teal-100 text-sm md:text-base mb-6">
                        Enter a keyword to generate entities, n-grams, NLP keywords, grammar relationships, unique n-grams, and skip-gram words — all at once.
                    </p>

                    {/* Search Input */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-200" />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Enter a keyword (e.g., content marketing, SEO tools)"
                                className="w-full pl-12 pr-4 py-4 bg-white/15 border border-white/30 rounded-xl text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 backdrop-blur-sm transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && generateAll()}
                            />
                        </div>
                        <button
                            onClick={generateAll}
                            disabled={isGenerating || !keyword.trim()}
                            className="px-8 py-4 bg-white text-teal-600 rounded-xl font-bold hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg"
                        >
                            {isGenerating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Sparkles className="w-5 h-5" />
                            )}
                            Generate All
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {isGenerating && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 md:p-12 text-center mb-6">
                        <Loader2 className="w-12 h-12 text-teal-500 mx-auto mb-4 animate-spin" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing “{keyword}”</h3>
                        <p className="text-gray-500">{currentStep}</p>
                        <div className="mt-4 flex justify-center gap-2">
                            {Object.keys(SECTIONS).map((key) => (
                                <div
                                    key={key}
                                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                        currentStep.toLowerCase().includes(SECTIONS[key].label.toLowerCase().split(' ')[0].toLowerCase())
                                            ? 'bg-teal-500 scale-125'
                                            : results && results[key]
                                                ? 'bg-green-400'
                                                : 'bg-gray-200'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="space-y-4">
                        {/* Copy Prompt Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={copyPrompt}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-700 hover:to-cyan-700 transition font-semibold shadow-lg"
                            >
                                {copiedSection === 'prompt' ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <ClipboardList className="w-5 h-5" />
                                        Copy Prompt
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Section Cards */}
                        {Object.entries(SECTIONS).map(([sectionKey, config]) => {
                            const data = results[sectionKey];
                            if (!data) return null;
                            const count = getSectionCount(sectionKey);
                            const Icon = config.icon;

                            return (
                                <div key={sectionKey} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                                    {/* Section Header */}
                                    <div
                                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                                        onClick={() => toggleSection(sectionKey)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{config.label}</h3>
                                                <p className="text-xs text-gray-500">{count} items</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${config.badgeColor}`}>
                                                {count}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); copySectionData(sectionKey); }}
                                                className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                                title={`Copy ${config.label}`}
                                            >
                                                {copiedSection === sectionKey ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                            {expandedSections[sectionKey] ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Section Content */}
                                    {expandedSections[sectionKey] && renderSubcategoryItems(data, sectionKey)}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty State */}
                {!results && !isGenerating && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 md:p-12 text-center">
                        <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Zap className="w-8 h-8 text-teal-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">All-in-One NLP Analysis</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-6">
                            Enter a keyword to generate comprehensive semantic data including entities, n-grams, NLP keywords, grammar, unique n-grams, and skip-gram words.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6">
                            {Object.entries(SECTIONS).map(([key, config]) => {
                                const Icon = config.icon;
                                return (
                                    <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{config.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap justify-center gap-2">
                            {['content marketing', 'SEO tools', 'machine learning', 'web development', 'digital marketing'].map(example => (
                                <button
                                    key={example}
                                    onClick={() => setKeyword(example)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-teal-50 hover:text-teal-600 transition text-sm"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200">
                    <p className="text-teal-700 text-sm">
                        <strong>Semantic Generator:</strong> Generates all NLP data in one click — entities, n-grams, NLP keywords, grammar relationships, unique n-grams, and skip-gram words. Use the &quot;Copy Prompt&quot; button to copy all results formatted for content optimization.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SemanticKeywordAnalyzer;
