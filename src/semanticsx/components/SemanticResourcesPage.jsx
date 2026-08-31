import React, { useState } from 'react';
import {
    BookOpen, Map, Globe, Presentation, Search, ExternalLink,
    ChevronDown, ChevronUp, Link2, Sparkles
} from 'lucide-react';

// ============================================================================
// SEMANTIC SEO DATA
// ============================================================================

const DOCUMENTS = [
    {
        id: 'advanced_semantic_notes',
        name: 'Advanced Semantic SEO Notes',
        description: 'In-depth notes on advanced semantic SEO strategies and techniques',
        url: 'https://docs.google.com/document/d/1aMeZq-55IIBXXqBVdrdFVt_nwgT-AVcN5OES1RplMwY/edit?tab=t.0',
        icon: '📖',
        type: 'Google Doc'
    },
    {
        id: 'semantic_course_notes',
        name: 'Semantic SEO Course Notes',
        description: 'Complete notes from the Semantic SEO course curriculum',
        url: 'https://docs.google.com/document/d/1HZt5y2ZxmVUvh1QALzNdkn3SR6oGyQXZUqHsbZszqAU/edit?tab=t.385hhjonffzm#heading=h.ifca5oydvlvv',
        icon: '🎓',
        type: 'Google Doc'
    },
    {
        id: 'youtube_notes',
        name: 'Koray YouTube Video Notes',
        description: "Notes from Koray's YouTube videos on semantic SEO",
        url: 'https://docs.google.com/document/d/1I3j_KVaA6eehvxJfsHFC5KtRbeCNcBzl5ZDPyCivRhk/edit?tab=t.0',
        icon: '🎬',
        type: 'Google Doc'
    }
];

const TOPICAL_MAPS = [
    {
        id: 'topical_steps',
        name: 'Topical Map Steps',
        description: 'Step-by-step guide to creating topical maps',
        url: 'https://docs.google.com/spreadsheets/d/1-W3opLOA0_Ia8Gs3YfqxgCMB-rZ59wslUNg-U1M4tnc/edit?gid=506888662#gid=506888662',
        icon: '📋'
    },
    {
        id: 'example_1',
        name: 'Example Topical Map 1',
        description: 'Real-world topical map example for reference',
        url: 'https://docs.google.com/spreadsheets/d/1Mxk4opFgKkZf897OXeBDsRF6Rq8CnaElg_KbNPr9rmU/edit?gid=406846650#gid=406846650',
        icon: '🗺️'
    },
    {
        id: 'example_2',
        name: 'Example Topical Map 2',
        description: 'Another topical map example with different niche',
        url: 'https://docs.google.com/spreadsheets/d/1EzltyZ4Xk3nyDQvhXkL9i_Uw5xPoqFpTu9WLc3z1eYQ/edit#gid=1152234775',
        icon: '🎯'
    },
    {
        id: 'example_3',
        name: 'Example Topical Map 3',
        description: 'Third topical map example for additional reference',
        url: 'https://docs.google.com/spreadsheets/d/1YuyWXy2QOHkAoc7MXLzFeh8HlI16l7LFFE4kPrlD2MA/edit?usp=sharing',
        icon: '📍'
    }
];

const SEMANTIC_WEBSITES = [
    { name: 'Istanbul Bogazici Institute', url: 'https://istanbulbogazicienstitu.com/blog?sayfa=105', niche: 'Education' },
    { name: 'Vizem.net', url: 'https://vizem.net/almanya/', niche: 'Travel' },
    { name: 'Svalbardi', url: 'https://svalbardi.com/', niche: 'Luxury Water' },
    { name: 'Real Check Stubs', url: 'https://www.realcheckstubs.com/', niche: 'Finance' },
    { name: 'Strike Money', url: 'https://www.strike.money/', niche: 'Crypto' },
    { name: 'Diamond Rehab Thailand', url: 'https://diamondrehabthailand.com/', niche: 'Health' },
    { name: 'Athletic Insight', url: 'https://www.athleticinsight.com/', niche: 'Sports' },
    { name: 'Mango Languages', url: 'https://mangolanguages.com/', niche: 'Education' },
    { name: 'Yamm', url: 'https://yamm.com/', niche: 'SaaS' },
    { name: 'Oscar Wylee', url: 'https://www.oscarwylee.com.au/', niche: 'E-commerce' },
    { name: 'Welzo', url: 'https://welzo.com/', niche: 'Healthcare' },
    { name: 'GymDesk', url: 'https://gymdesk.com/', niche: 'SaaS' },
    { name: 'Team Color Codes', url: 'https://teamcolorcodes.com/', niche: 'Sports' },
    { name: 'Ministry Brands', url: 'https://www.ministrybrands.com/', niche: 'SaaS' },
    { name: 'Wordly', url: 'https://www.getwordly.com/', niche: 'AI' },
    { name: 'Myros', url: 'https://www.myros.com/', niche: 'Jewelry' },
    { name: 'EB5 BRICS', url: 'https://www.eb5brics.com/', niche: 'Immigration' }
];

const SEMANTIC_TOOLS = [
    {
        id: 'wiki_graph',
        name: 'Wiki Graph',
        description: 'Visualize Wikipedia knowledge graphs for entity research',
        url: 'https://blinpete.github.io/wiki-graph/?lang=en&query=Scaffolding&wordle=',
        icon: '🕸️'
    }
];

const SEO_SLIDES = {
    name: 'Semantic SEO Slides',
    description: 'Complete presentation on Semantic SEO fundamentals',
    url: 'https://docs.google.com/presentation/d/15INsgGsQ2CmHmMISgz4Gy5mM8nvgGsgoCH4PJcCtB04/edit',
    icon: '📽️'
};

// Helper to get favicon URL from any website
const getFaviconUrl = (url, size = 64) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
    } catch {
        return null;
    }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SemanticResourcesPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        documents: true,
        topicalMaps: true,
        websites: true,
        tools: true,
        slides: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const filteredWebsites = SEMANTIC_WEBSITES.filter(site =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.niche.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-12">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent)]" />
                <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />

                <div className="relative text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-sm">
                            <Sparkles className="w-7 h-7 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight font-display">
                        Semantic SEO Resources
                    </h1>
                    <div className="w-20 h-0.5 bg-white/30 mx-auto mb-3" />
                    <p className="text-white/70 text-base max-w-2xl mx-auto">
                        Documents, topical maps, research websites, and tools for semantic SEO mastery
                    </p>
                </div>
            </div>

            {/* Documents Section */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                <button
                    onClick={() => toggleSection('documents')}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-brand-500 to-amber-600 rounded-xl shadow-lg shadow-brand-500/20">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Documents & Notes</h2>
                            <p className="text-sm text-white/40">Lecture notes and learning materials</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-full bg-white/[0.06]">
                        {expandedSections.documents ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                </button>

                {expandedSections.documents && (
                    <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {DOCUMENTS.map(doc => (
                            <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
                            >
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-3xl">{doc.icon}</div>
                                        <span className="px-2 py-0.5 bg-brand-500/15 text-brand-300 text-xs font-medium rounded-full">{doc.type}</span>
                                    </div>
                                    <h3 className="font-semibold text-white/80 mb-1 group-hover:text-brand-400 transition-colors line-clamp-2">{doc.name}</h3>
                                    <p className="text-sm text-white/40 line-clamp-2">{doc.description}</p>
                                    <div className="mt-4 flex items-center gap-1.5 text-xs text-brand-400 font-medium">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open Document</span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            {/* Slides Section */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                <button
                    onClick={() => toggleSection('slides')}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg shadow-rose-500/20">
                            <Presentation className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Presentation Slides</h2>
                            <p className="text-sm text-white/40">Semantic SEO presentation materials</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-full bg-white/[0.06]">
                        {expandedSections.slides ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                </button>

                {expandedSections.slides && (
                    <div className="px-6 pb-6">
                        <a
                            href={SEO_SLIDES.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-4 p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-rose-500/30 hover:shadow-lg hover:shadow-rose-500/5 transition-all"
                        >
                            <div className="text-4xl">{SEO_SLIDES.icon}</div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-white/80 group-hover:text-rose-400 transition-colors">{SEO_SLIDES.name}</h3>
                                <p className="text-sm text-white/40">{SEO_SLIDES.description}</p>
                            </div>
                            <ExternalLink className="w-5 h-5 text-white/20 group-hover:text-rose-400" />
                        </a>
                    </div>
                )}
            </section>

            {/* Topical Maps Section */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                <button
                    onClick={() => toggleSection('topicalMaps')}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl shadow-lg shadow-amber-500/20">
                            <Map className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Topical Maps</h2>
                            <p className="text-sm text-white/40">Build topical authority with structured content mapping</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-full bg-white/[0.06]">
                        {expandedSections.topicalMaps ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                </button>

                {expandedSections.topicalMaps && (
                    <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {TOPICAL_MAPS.map(map => (
                            <a
                                key={map.id}
                                href={map.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300"
                            >
                                <div className="relative">
                                    <div className="text-3xl mb-3">{map.icon}</div>
                                    <h3 className="font-semibold text-white/80 mb-1 group-hover:text-amber-400 transition-colors">{map.name}</h3>
                                    <p className="text-sm text-white/40">{map.description}</p>
                                    <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open Map</span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            {/* Semantic Websites Section */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                <button
                    onClick={() => toggleSection('websites')}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl shadow-lg shadow-emerald-500/20">
                            <Globe className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Semantic Websites for Research</h2>
                            <p className="text-sm text-white/40">{SEMANTIC_WEBSITES.length} hand-picked websites with excellent semantic SEO</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-full bg-white/[0.06]">
                        {expandedSections.websites ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                </button>

                {expandedSections.websites && (
                    <div className="px-6 pb-6">
                        {/* Search */}
                        <div className="mb-4 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="text"
                                placeholder="Search by name or niche..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#010409] border border-white/[0.08] rounded-xl text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/10 transition-all"
                            />
                        </div>

                        {/* Websites Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {filteredWebsites.map((site, idx) => (
                                <a
                                    key={idx}
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        <img
                                            src={getFaviconUrl(site.url, 64)}
                                            alt={`${site.name} logo`}
                                            className="w-6 h-6 object-contain"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = '';
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-medium text-white/70 truncate group-hover:text-emerald-400 transition-colors">{site.name}</h4>
                                        <span className="text-xs text-white/30">{site.niche}</span>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-white/15 group-hover:text-emerald-400 flex-shrink-0" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Semantic Tools Section */}
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
                <button
                    onClick={() => toggleSection('tools')}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20">
                            <Link2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">Semantic Tools</h2>
                            <p className="text-sm text-white/40">Tools for entity research and knowledge graph visualization</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-full bg-white/[0.06]">
                        {expandedSections.tools ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                </button>

                {expandedSections.tools && (
                    <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SEMANTIC_TOOLS.map(tool => (
                            <a
                                key={tool.id}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-4 p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 transition-all"
                            >
                                <div className="text-4xl">{tool.icon}</div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white/80 group-hover:text-violet-400 transition-colors">{tool.name}</h3>
                                    <p className="text-sm text-white/40">{tool.description}</p>
                                </div>
                                <ExternalLink className="w-5 h-5 text-white/20 group-hover:text-violet-400" />
                            </a>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
};

export default SemanticResourcesPage;
