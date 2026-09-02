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
        <div className="sres-page space-y-6 pb-12">
            {/* Hero Header */}
            <div className="ctool-hero">
                <div className="ctool-hero-row">
                    <span className="ctool-hero-icon">
                        <Sparkles className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="ctool-title font-display">
                            Semantic SEO Resources
                        </h1>
                        <p className="ctool-subtitle">
                            Documents, topical maps, research websites, and tools for semantic SEO mastery
                        </p>
                    </div>
                </div>
            </div>

            {/* Documents Section */}
            <section className="sres-section">
                <button
                    onClick={() => toggleSection('documents')}
                    className="sres-section-head"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="sres-section-icon">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="sres-section-title">Documents & Notes</h2>
                            <p className="sres-section-sub">Lecture notes and learning materials</p>
                        </div>
                    </div>
                    <div className="sres-chevron">
                        {expandedSections.documents ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                                className="sres-card group"
                            >
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="sres-card-emoji">{doc.icon}</span>
                                        <span className="ctool-count-badge">{doc.type}</span>
                                    </div>
                                    <h3 className="sres-card-title line-clamp-2">{doc.name}</h3>
                                    <p className="sres-section-sub line-clamp-2">{doc.description}</p>
                                    <div className="sres-card-link">
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
            <section className="sres-section">
                <button
                    onClick={() => toggleSection('slides')}
                    className="sres-section-head"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="sres-section-icon">
                            <Presentation className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="sres-section-title">Presentation Slides</h2>
                            <p className="sres-section-sub">Semantic SEO presentation materials</p>
                        </div>
                    </div>
                    <div className="sres-chevron">
                        {expandedSections.slides ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </button>

                {expandedSections.slides && (
                    <div className="px-6 pb-6">
                        <a
                            href={SEO_SLIDES.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sres-card sres-row group"
                        >
                            <span className="sres-card-emoji">{SEO_SLIDES.icon}</span>
                            <div className="flex-1">
                                <h3 className="sres-card-title">{SEO_SLIDES.name}</h3>
                                <p className="sres-section-sub">{SEO_SLIDES.description}</p>
                            </div>
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    </div>
                )}
            </section>

            {/* Topical Maps Section */}
            <section className="sres-section">
                <button
                    onClick={() => toggleSection('topicalMaps')}
                    className="sres-section-head"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="sres-section-icon">
                            <Map className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="sres-section-title">Topical Maps</h2>
                            <p className="sres-section-sub">Build topical authority with structured content mapping</p>
                        </div>
                    </div>
                    <div className="sres-chevron">
                        {expandedSections.topicalMaps ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                                className="sres-card group"
                            >
                                <div className="relative">
                                    <span className="sres-card-emoji mb-3">{map.icon}</span>
                                    <h3 className="sres-card-title">{map.name}</h3>
                                    <p className="sres-section-sub">{map.description}</p>
                                    <div className="sres-card-link">
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
            <section className="sres-section">
                <button
                    onClick={() => toggleSection('websites')}
                    className="sres-section-head"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="sres-section-icon">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="sres-section-title">Semantic Websites for Research</h2>
                            <p className="sres-section-sub">{SEMANTIC_WEBSITES.length} hand-picked websites with excellent semantic SEO</p>
                        </div>
                    </div>
                    <div className="sres-chevron">
                        {expandedSections.websites ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </button>

                {expandedSections.websites && (
                    <div className="px-6 pb-6">
                        {/* Search */}
                        <div className="mb-4 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sres-search-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or niche..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sres-search-input pl-11 pr-4"
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
                                    className="sres-site group"
                                >
                                    <div className="sres-favicon">
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
                                        <h4 className="sres-site-name">{site.name}</h4>
                                        <span className="sres-site-niche">{site.niche}</span>
                                    </div>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Semantic Tools Section */}
            <section className="sres-section">
                <button
                    onClick={() => toggleSection('tools')}
                    className="sres-section-head"
                >
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="sres-section-icon">
                            <Link2 className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="sres-section-title">Semantic Tools</h2>
                            <p className="sres-section-sub">Tools for entity research and knowledge graph visualization</p>
                        </div>
                    </div>
                    <div className="sres-chevron">
                        {expandedSections.tools ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                                className="sres-card sres-row group"
                            >
                                <span className="sres-card-emoji">{tool.icon}</span>
                                <div className="flex-1">
                                    <h3 className="sres-card-title">{tool.name}</h3>
                                    <p className="sres-section-sub">{tool.description}</p>
                                </div>
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
};

export default SemanticResourcesPage;
