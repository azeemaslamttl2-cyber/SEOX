import React, { useState, useEffect } from 'react';
import {
    Search,
    MessageSquare,
    Globe,
    Cpu,
    TrendingUp,
    CheckCircle,
    Target,
    Layout,
    ArrowRight,
    ShieldCheck,
    Zap,
    BarChart,
    Users,
    Compass,
    MousePointerClick,
    Sparkles,
    MessageCircle,
    Bot,
    Library,
    BookOpen
} from 'lucide-react';

// --- Components ---

const Section = ({ children, className = "", id = "" }) => (
    <section id={id} className={`py-16 px-4 md:px-8 max-w-6xl mx-auto ${className}`}>
        {children}
    </section>
);

const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 ${className}`}>
        {children}
    </div>
);

const Badge = ({ children, color = "blue" }) => {
    const colors = {
        blue: "bg-blue-50 text-blue-600 border-blue-200",
        green: "bg-emerald-50 text-emerald-600 border-emerald-200",
        purple: "bg-purple-50 text-purple-600 border-purple-200",
        orange: "bg-orange-50 text-orange-600 border-orange-200",
        teal: "bg-teal-50 text-teal-600 border-teal-200",
    };
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[color]} inline-flex items-center gap-1`}>
            {children}
        </span>
    );
};

// --- Interactive Metaphor: Storefront vs Tour Guide ---

const MetaphorVisualizer = () => {
    const [mode, setMode] = useState('seo'); // 'seo' or 'geo'
    const [seoClicks, setSeoClicks] = useState(0);
    const [clickEffects, setClickEffects] = useState([]);
    const [geoState, setGeoState] = useState('idle'); // idle, thinking, recommending

    // Reset states when switching modes
    useEffect(() => {
        setSeoClicks(0);
        setClickEffects([]);
        setGeoState('idle');
    }, [mode]);

    const handleStoreClick = (e) => {
        if (mode !== 'seo') return;
        setSeoClicks(prev => prev + 1);

        // Add a floating "+1" effect
        const id = Date.now();
        setClickEffects(prev => [...prev, { id, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }]);
        setTimeout(() => {
            setClickEffects(prev => prev.filter(effect => effect.id !== id));
        }, 1000);
    };

    const handleGuideClick = () => {
        if (mode !== 'geo' || geoState !== 'idle') return;
        setGeoState('thinking');
        setTimeout(() => setGeoState('recommending'), 1500);
        setTimeout(() => setGeoState('idle'), 4500); // Reset after showing recommendation
    };

    return (
        <div className="my-12 p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
            <div className="flex justify-center mb-8">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm inline-flex">
                    <button
                        onClick={() => setMode('seo')}
                        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${mode === 'seo' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Traditional SEO
                    </button>
                    <button
                        onClick={() => setMode('geo')}
                        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${mode === 'geo' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        GEO (New)
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="text-center md:text-left space-y-4">
                    <h3 className="text-2xl font-bold text-slate-900">
                        {mode === 'seo' ? 'The "Best Storefront" Approach' : 'The "Trusted Tour Guide" Approach'}
                    </h3>
                    <p className="text-slate-600 leading-relaxed min-h-[80px]">
                        {mode === 'seo'
                            ? 'Traditional SEO is like competing for the best spot on a busy street. Click the storefront to simulate fighting for traffic!'
                            : 'GEO is like a hotel concierge. Click the robot to ask for a recommendation and see how it directs users straight to you.'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {mode === 'seo' ? (
                            <>
                                <Badge color="orange">Chase Clicks</Badge>
                                <div className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                                    Visits: {seoClicks}
                                </div>
                            </>
                        ) : (
                            <>
                                <Badge color="blue">Brand Trust</Badge>
                                <Badge color="blue">Direct Answers</Badge>
                            </>
                        )}
                    </div>
                </div>

                {/* Visual Animation Container */}
                <div className="relative h-72 bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden flex items-center justify-center select-none">

                    {mode === 'seo' ? (
                        <div className="relative w-full h-full flex items-end justify-center pb-8 gap-2">
                            {/* Background Elements */}
                            <div className="absolute top-4 right-4 animate-pulse text-yellow-400">☀️</div>
                            <div className="absolute top-10 left-10 text-slate-200">☁️</div>

                            {/* Other Store Left */}
                            <div className="w-16 h-24 bg-slate-200 rounded-t-lg opacity-50 transform scale-90 flex items-end justify-center">
                                <div className="w-8 h-12 bg-slate-300 mb-2 rounded-t-sm"></div>
                            </div>

                            {/* Interactive Store */}
                            <div
                                onClick={handleStoreClick}
                                className="w-32 h-40 bg-orange-50 border-2 border-orange-400 rounded-t-lg flex flex-col items-center justify-end relative shadow-lg cursor-pointer active:scale-95 transition-transform group"
                            >
                                <div className="absolute -top-12 animate-bounce bg-white px-3 py-1 rounded-full shadow-md border border-orange-100 text-xs font-bold text-orange-600 group-hover:scale-110 transition-transform">
                                    👇 Click Me!
                                </div>
                                <div className="text-3xl mb-2">🏪</div>
                                <div className="w-full bg-orange-100 py-1 text-center border-t border-b border-orange-200 mb-2">
                                    <span className="text-[10px] font-bold text-orange-800 tracking-wider">YOUR BRAND</span>
                                </div>
                                <div className="w-12 h-16 bg-white border border-slate-200 rounded-t-md shadow-inner mb-0"></div>

                                {/* Click Effects */}
                                {clickEffects.map(effect => (
                                    <div
                                        key={effect.id}
                                        className="absolute text-green-600 font-bold text-sm animate-floatUp"
                                        style={{ left: effect.x, top: effect.y - 40 }}
                                    >
                                        +1 Visitor
                                    </div>
                                ))}
                            </div>

                            {/* Other Store Right */}
                            <div className="w-16 h-20 bg-slate-200 rounded-t-lg opacity-50 transform scale-90 flex items-end justify-center">
                                <div className="w-8 h-10 bg-slate-300 mb-2 rounded-t-sm"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center relative">
                            {/* Connection Line */}
                            <svg className="absolute w-full h-full pointer-events-none">
                                {geoState === 'recommending' && (
                                    <line
                                        x1="40%" y1="50%" x2="65%" y2="50%"
                                        className="stroke-emerald-400 stroke-2 animate-dash"
                                        strokeDasharray="5,5"
                                    />
                                )}
                            </svg>

                            <div className="flex items-center gap-12 z-10">
                                {/* The Guide (AI) */}
                                <div
                                    onClick={handleGuideClick}
                                    className={`w-28 h-28 bg-blue-50 rounded-full flex flex-col items-center justify-center border-4 border-white shadow-xl cursor-pointer transition-all hover:bg-blue-100 ${geoState === 'thinking' ? 'animate-pulse' : ''}`}
                                >
                                    <span className="text-4xl">{geoState === 'thinking' ? '⏳' : '🤖'}</span>
                                    <span className="text-[10px] font-bold text-blue-600 mt-2 bg-white px-2 py-0.5 rounded-full border border-blue-100">
                                        {geoState === 'idle' ? 'Ask Me' : geoState === 'thinking' ? 'Thinking...' : 'Answer'}
                                    </span>

                                    {/* Chat Bubble Recommendation */}
                                    {geoState === 'recommending' && (
                                        <div className="absolute -top-16 -left-4 w-48 bg-white p-3 rounded-xl rounded-bl-none shadow-xl border border-emerald-100 animate-fadeIn text-left">
                                            <p className="text-xs text-slate-600 leading-tight">
                                                The best option is <span className="font-bold text-emerald-600">Your Brand</span> because of their quality and reviews.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Your Brand */}
                                <div className={`w-24 h-24 bg-white rounded-xl border-2 ${geoState === 'recommending' ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105' : 'border-slate-200'} shadow-lg flex flex-col items-center justify-center transition-all duration-500`}>
                                    <span className="text-3xl">🌟</span>
                                    <span className="text-[10px] font-bold text-slate-600 mt-2">Your Brand</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- New Component: Search Evolution Demo ---

const SearchEvolutionDemo = () => {
    const [activeView, setActiveView] = useState('traditional');
    // Options: 'traditional', 'google_ai', 'chatgpt', 'gemini', 'perplexity'

    const TabButton = ({ id, label, icon: Icon, colorClass, activeColorClass }) => (
        <button
            onClick={() => setActiveView(id)}
            className={`flex-1 py-3 text-[10px] md:text-xs font-semibold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-all ${activeView === id
                    ? `${activeColorClass} border-b-2`
                    : 'text-slate-500 hover:bg-slate-50 border-b-2 border-transparent'
                }`}
        >
            <Icon size={14} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="my-20">
            <div className="text-center mb-8">
                <Badge color="purple">Interactive Demo</Badge>
                <h2 className="text-3xl font-bold mt-4 mb-2">Experience the Difference</h2>
                <p className="text-slate-500">See how your brand visibility changes across different AI engines.</p>
            </div>

            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                {/* Browser Bar - conditional for chatgpt/gemini/perplexity */}
                {(activeView === 'traditional' || activeView === 'google_ai') && (
                    <div className="bg-slate-100 border-b border-slate-200 p-4 flex items-center gap-4">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="flex-1 bg-white h-9 rounded-md border border-slate-200 flex items-center px-3 text-sm text-slate-600 shadow-sm">
                            <Search size={14} className="mr-2 text-slate-400" />
                            Best eco-friendly coffee cup
                        </div>
                    </div>
                )}

                {/* Toggle Controls */}
                <div className="border-b border-slate-100 flex overflow-x-auto no-scrollbar">
                    <TabButton
                        id="traditional"
                        label="Classic SEO"
                        icon={Layout}
                        activeColorClass="text-blue-600 border-blue-600 bg-blue-50/50"
                    />
                    <TabButton
                        id="google_ai"
                        label="Google AI"
                        icon={Sparkles}
                        activeColorClass="text-purple-600 border-purple-600 bg-purple-50/50"
                    />
                    <TabButton
                        id="chatgpt"
                        label="ChatGPT"
                        icon={Bot}
                        activeColorClass="text-emerald-600 border-emerald-600 bg-emerald-50/50"
                    />
                    <TabButton
                        id="gemini"
                        label="Gemini"
                        icon={Cpu}
                        activeColorClass="text-blue-500 border-blue-500 bg-blue-50/50"
                    />
                    <TabButton
                        id="perplexity"
                        label="Perplexity"
                        icon={Compass}
                        activeColorClass="text-teal-600 border-teal-600 bg-teal-50/50"
                    />
                </div>

                {/* Content View */}
                <div className="flex-grow bg-slate-50/50 relative overflow-y-auto max-h-[500px]">

                    {/* 1. Traditional SEO */}
                    {activeView === 'traditional' && (
                        <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
                            <div className="flex flex-col gap-1">
                                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                <div className="h-6 w-3/4 bg-blue-700/80 rounded"></div>
                                <div className="h-4 w-full bg-slate-300 rounded"></div>
                                <div className="h-4 w-2/3 bg-slate-300 rounded"></div>
                            </div>
                            <div className="flex flex-col gap-1 opacity-60">
                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                                <div className="h-6 w-2/3 bg-blue-700/40 rounded"></div>
                                <div className="h-4 w-full bg-slate-200 rounded"></div>
                            </div>
                            {/* Your Brand buried */}
                            <div className="flex flex-col gap-1 p-4 border border-orange-200 bg-orange-50 rounded-lg relative">
                                <div className="absolute -left-2 top-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Rank #3</div>
                                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                <div className="h-6 w-2/3 bg-blue-600 rounded"></div>
                                <div className="h-4 w-full bg-slate-400 rounded"></div>
                                <p className="text-xs text-orange-600 font-bold mt-1">Your brand is here, fighting for a click.</p>
                            </div>
                        </div>
                    )}

                    {/* 2. Google AI Overview */}
                    {activeView === 'google_ai' && (
                        <div className="p-6 md:p-8 animate-fadeIn">
                            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl border border-purple-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles size={18} className="text-purple-600" />
                                    <h4 className="font-bold text-slate-800">AI Overview</h4>
                                </div>
                                <p className="text-slate-700 leading-relaxed mb-4 text-sm">
                                    When looking for the best eco-friendly coffee cups, durability and material sustainability are key.
                                </p>
                                <p className="text-slate-700 leading-relaxed mb-6 text-sm">
                                    <strong className="text-purple-700 bg-purple-100 px-1 rounded">Your Brand</strong> is highly recommended for its double-wall insulation and 100% biodegradable materials.
                                </p>

                                {/* Citation Cards */}
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    <div className="min-w-[140px] bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-purple-300 transition-colors cursor-pointer">
                                        <div className="w-6 h-6 rounded-full bg-purple-100 mb-2 flex items-center justify-center text-purple-600 text-xs font-bold">Y</div>
                                        <div className="text-xs font-bold text-slate-700 truncate">Your Brand</div>
                                        <div className="text-[10px] text-slate-400">Official Site</div>
                                    </div>
                                    <div className="min-w-[140px] bg-white p-3 rounded-lg border border-slate-200 shadow-sm opacity-60">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 mb-2"></div>
                                        <div className="text-xs font-bold text-slate-400">Top Reviewer</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                                    ☝️ SGE (Search Generative Experience) sits above organic results.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 3. ChatGPT Interface */}
                    {activeView === 'chatgpt' && (
                        <div className="flex flex-col h-full bg-white animate-fadeIn">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
                                    <span className="text-lg">ChatGPT</span>
                                    <span className="text-slate-400 text-sm">4o</span>
                                </div>
                            </div>

                            <div className="flex-1 p-6 space-y-8">
                                <div className="flex justify-end">
                                    <div className="bg-slate-100 text-slate-800 px-5 py-3 rounded-3xl rounded-tr-sm max-w-[80%] text-sm font-medium">
                                        What is the best eco-friendly coffee cup?
                                    </div>
                                </div>

                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border border-emerald-500">
                                        <div className="w-5 h-5 text-white"><Bot size={18} /></div>
                                    </div>
                                    <div className="space-y-4 text-slate-800 text-sm leading-relaxed max-w-[90%]">
                                        <p>Based on reviews, <strong className="font-bold text-emerald-700">Your Brand</strong> is widely considered the top choice.</p>
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 my-2">
                                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                                <CheckCircle size={14} className="text-emerald-500" /> Why it stands out:
                                            </h4>
                                            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                                <li><span className="font-semibold">Material:</span> 100% recycled bamboo fiber.</li>
                                                <li><span className="font-semibold">End-of-life:</span> Fully biodegradable.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Gemini Interface */}
                    {activeView === 'gemini' && (
                        <div className="flex flex-col h-full bg-white animate-fadeIn">
                            <div className="p-4 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white z-10">
                                <Sparkles size={18} className="text-blue-500 fill-blue-500" />
                                <span className="font-semibold text-slate-700">Gemini</span>
                            </div>

                            <div className="flex-1 p-6">
                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <Cpu size={16} className="text-blue-600" />
                                    </div>
                                    <div className="space-y-4 text-slate-800 text-sm leading-relaxed max-w-[95%]">
                                        <p>I found a few great options for eco-friendly coffee cups. Here is the breakdown:</p>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4">
                                                <h3 className="text-blue-700 font-bold mb-1">1. Your Brand (Top Pick)</h3>
                                                <p className="text-slate-600 mb-2">Best for overall sustainability and heat retention.</p>
                                                <div className="flex gap-2">
                                                    <Badge color="blue">Bamboo</Badge>
                                                    <Badge color="blue">Compostable</Badge>
                                                </div>
                                            </div>
                                            <div className="border border-slate-200 rounded-lg p-4 opacity-70">
                                                <h3 className="text-slate-700 font-bold mb-1">2. GlassKeep</h3>
                                                <p className="text-slate-600">Good durability but heavier to carry.</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                            <img src="https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" alt="Google" className="h-4 opacity-50" />
                                            <span>Double-check response</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. Perplexity Interface */}
                    {activeView === 'perplexity' && (
                        <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn">
                            <div className="p-4 border-b border-slate-200 sticky top-0 bg-slate-50/95 z-10 backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Compass size={20} className="text-teal-600" />
                                    <span className="font-bold text-xl font-serif text-slate-800">perplexity</span>
                                </div>
                                <h3 className="text-xl font-medium text-slate-800">What is the best eco-friendly coffee cup?</h3>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Sources */}
                                <div>
                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                        <Library size={12} /> Sources
                                    </h4>
                                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="min-w-[120px] bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-xs hover:border-teal-300 cursor-pointer transition-colors">
                                                <div className="font-bold text-slate-700 truncate mb-1 line-clamp-1">
                                                    {i === 1 ? "Your Brand Official" : i === 2 ? "Best Coffee Gear" : "Eco Life Blog"}
                                                </div>
                                                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                                                    <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                                                    <span>Article • {i}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Answer */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded bg-teal-600 flex items-center justify-center text-white text-[10px] font-bold">
                                            <Compass size={12} />
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-sm">Answer</h3>
                                    </div>
                                    <div className="text-slate-800 text-sm leading-relaxed space-y-3">
                                        <p>
                                            Based on the search results, <span className="text-teal-700 font-semibold border-b border-teal-200 hover:bg-teal-50 cursor-pointer">Your Brand</span> is consistently ranked as the best eco-friendly coffee cup [1].
                                        </p>
                                        <p>
                                            It distinguishes itself through a proprietary bamboo-fiber composite that offers superior heat retention compared to glass alternatives [2]. Reviews specifically highlight its 100% biodegradability as a key differentiator from standard reusable cups [3][4].
                                        </p>
                                    </div>
                                </div>

                                {/* Related */}
                                <div className="pt-4 border-t border-slate-200">
                                    <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase">Related</h4>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
                                            <span>How long does Your Brand cup last?</span>
                                            <span className="text-slate-400">+</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
                                            <span>Is Your Brand dishwasher safe?</span>
                                            <span className="text-slate-400">+</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Strategy Cards ---

const StrategyCard = ({ icon: Icon, title, description, examples }) => (
    <Card className="p-6 h-full flex flex-col hover:-translate-y-1 transition-transform group">
        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Icon size={24} />
        </div>
        <h4 className="text-lg font-bold text-slate-800 mb-2">{title}</h4>
        <p className="text-slate-600 text-sm mb-4 flex-grow">{description}</p>
        <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Examples:</p>
            <ul className="text-xs text-slate-600 space-y-1">
                {examples.map((ex, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span> {ex}
                    </li>
                ))}
            </ul>
        </div>
    </Card>
);

// --- Main Article Component ---

const WhatIsGEOArticle = () => {
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100">

            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
                        <span className="font-bold text-lg tracking-tight">GEO Guide</span>
                    </div>
                    <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
                        <a href="#what-is-geo" className="hover:text-blue-600 transition-colors">Definition</a>
                        <a href="#strategy" className="hover:text-blue-600 transition-colors">Strategy</a>
                        <a href="#comparison" className="hover:text-blue-600 transition-colors">Comparison</a>
                        <a href="#benefits" className="hover:text-blue-600 transition-colors">Benefits</a>
                    </div>
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-slate-800 transition-colors">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <Section id="what-is-geo" className="pt-24 pb-12 text-center">
                <Badge color="purple">The Future of Search</Badge>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mt-6 mb-6 text-slate-900">
                    What is <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">GEO?</span>
                </h1>
                <p className="text-xl md:text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
                    Generative Engine Optimization. Getting your brand noticed and accurately represented in AI-generated answers.
                </p>

                <div className="flex flex-wrap justify-center gap-4 mt-8 opacity-80">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 text-sm font-medium text-slate-600">
                        <Globe size={16} /> Google AI Overviews
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 text-sm font-medium text-slate-600">
                        <MessageSquare size={16} /> ChatGPT
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 text-sm font-medium text-slate-600">
                        <Cpu size={16} /> Gemini
                    </div>
                </div>
            </Section>

            {/* The Metaphor */}
            <Section className="bg-white">
                <MetaphorVisualizer />

                <div className="grid md:grid-cols-3 gap-8 mt-16">
                    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
                        <Target className="text-blue-600 mb-4" size={28} />
                        <h3 className="font-bold text-lg mb-2">The Goal</h3>
                        <p className="text-slate-600 text-sm">Make sure your brand shows up when AI tools answer user questions—even if no one clicks a link.</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100">
                        <TrendingUp className="text-emerald-600 mb-4" size={28} />
                        <h3 className="font-bold text-lg mb-2">The Shift</h3>
                        <p className="text-slate-600 text-sm">Digital marketing is shifting: from chasing clicks 🖱️ to building brand visibility and trust right inside the AI's answer.</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100">
                        <ShieldCheck className="text-purple-600 mb-4" size={28} />
                        <h3 className="font-bold text-lg mb-2">Brand Safety</h3>
                        <p className="text-slate-600 text-sm">Ensure the AI recommends you accurately, protecting your reputation in generated responses.</p>
                    </div>
                </div>
            </Section>

            {/* New Search Evolution Demo */}
            <Section>
                <SearchEvolutionDemo />
            </Section>

            {/* Strategy Section */}
            <Section id="strategy" className="bg-slate-50 rounded-3xl my-12">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold mb-4">Beyond Keywords: A Holistic Strategy</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        GEO isn't just about optimizing pages—it's about ensuring your brand becomes part of the knowledge base AI tools use to generate answers.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <StrategyCard
                        icon={Compass}
                        title="Strategic Placement"
                        description="Publishing content in the right places where AI tools are most likely to discover and index it."
                        examples={["Industry Wikis & Forums", "High-Authority News Sites", "Niche Communities (Reddit/Quora)"]}
                    />
                    <StrategyCard
                        icon={MessageSquare}
                        title="Brand Mentions"
                        description="Earning positive brand mentions across the web—even without direct links. AI learns from context."
                        examples={["Expert Quotes in Articles", "Podcast Transcripts", "Influencer Discussions"]}
                    />
                    <StrategyCard
                        icon={Layout}
                        title="Technical Accessibility"
                        description="Ensuring technical accessibility so AI crawlers can easily access, parse, & interpret your content structure."
                        examples={["Schema Markup (JSON-LD)", "Clear Heading Hierarchies", "Fast API/Feed Access"]}
                    />
                </div>
            </Section>

            {/* Comparison Table Replica */}
            <Section id="comparison">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold">SEO vs. GEO</h2>
                        <p className="text-slate-500 mt-2">The fundamental shift in how we approach visibility.</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-1 bg-slate-100 rounded text-xs font-semibold text-slate-600">Traditional Search</div>
                        <ArrowRight size={16} className="text-slate-400 self-center" />
                        <div className="px-3 py-1 bg-blue-100 rounded text-xs font-semibold text-blue-600">AI Answers</div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 md:p-6 font-semibold text-slate-500 text-sm uppercase tracking-wider w-1/4">Aspect</th>
                                <th className="p-4 md:p-6 font-bold text-slate-800 w-1/3">
                                    <div className="flex items-center gap-2">
                                        <Search size={18} /> SEO (Search Engine Optimization)
                                    </div>
                                </th>
                                <th className="p-4 md:p-6 font-bold text-blue-700 bg-blue-50/50 w-1/3">
                                    <div className="flex items-center gap-2">
                                        <Zap size={18} /> GEO (Generative Engine Optimization)
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[
                                { aspect: "Objective", seo: "Helps websites rank higher in search engines to attract clicks.", geo: "Boosts visibility in AI-generated answers, even without clicks." },
                                { aspect: "Content Goal", seo: "Bring users to your website via blue links.", geo: "Ensure AI tools mention and represent your brand directly." },
                                { aspect: "Authority Signals", seo: "Backlinks, domain history, URL structure.", geo: "Presence across trusted platforms, fact-based content, semantic clarity." },
                                { aspect: "Response Type", seo: "List of ranked links (SERP).", geo: "Direct, summarized answers composed of synthesized data." },
                                { aspect: "Interaction", seo: "Short search queries, click-based exploration.", geo: "Conversational, long prompts, often zero-click satisfaction." },
                                { aspect: "Data Source", seo: "Indexed web pages matched to keywords.", geo: "Combination of built-in LLM knowledge + Live Search (RAG)." },
                            ].map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-4 md:p-6 font-medium text-slate-500">{row.aspect}</td>
                                    <td className="p-4 md:p-6 text-slate-700 leading-relaxed">{row.seo}</td>
                                    <td className="p-4 md:p-6 text-slate-800 font-medium bg-blue-50/30 group-hover:bg-blue-50/50 leading-relaxed">{row.geo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* The Nutshell Visualization */}
            <Section className="bg-slate-900 text-white rounded-3xl py-20 relative overflow-hidden">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

                <div className="relative z-10 text-center mb-12">
                    <h2 className="text-3xl font-bold">In A Nutshell 🥜</h2>
                    <p className="text-slate-400 mt-2">How user behavior is evolving</p>
                </div>

                <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center max-w-4xl mx-auto">
                    {/* Left Side: Traditional */}
                    <div className="space-y-6 text-right border-r border-slate-700 pr-12">
                        <div className="group">
                            <h4 className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Traditional Search</h4>
                            <p className="text-xl font-medium group-hover:text-white transition-colors">Gives you a list of links to explore 🔎</p>
                        </div>
                        <div className="group">
                            <h4 className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">The Game</h4>
                            <p className="text-xl font-medium group-hover:text-white transition-colors">Competing for clicks ⚔️</p>
                        </div>
                        <div className="group">
                            <h4 className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">User Action</h4>
                            <p className="text-xl font-medium group-hover:text-white transition-colors">"Click & Explore" 🔗</p>
                        </div>
                    </div>

                    {/* Right Side: AI Search */}
                    <div className="space-y-6 text-left pl-4">
                        <div className="group">
                            <h4 className="text-blue-400 text-sm font-semibold mb-1 uppercase tracking-wider">AI Search</h4>
                            <p className="text-xl font-medium text-white">Gives you direct answers 🤖</p>
                        </div>
                        <div className="group">
                            <h4 className="text-blue-400 text-sm font-semibold mb-1 uppercase tracking-wider">The Game</h4>
                            <p className="text-xl font-medium text-white">Being cited within the answer 📑</p>
                        </div>
                        <div className="group">
                            <h4 className="text-blue-400 text-sm font-semibold mb-1 uppercase tracking-wider">User Action</h4>
                            <p className="text-xl font-medium text-white">"Ask & Receive" 🎯</p>
                        </div>
                    </div>
                </div>
            </Section>

            {/* The Good News Section */}
            <Section id="benefits" className="mb-20">
                <div className="bg-emerald-50 rounded-3xl p-8 md:p-12 border border-emerald-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="text-3xl font-bold text-emerald-950">The Good News</h2>
                    </div>

                    <p className="text-emerald-800 text-lg mb-8 max-w-3xl">
                        Before panicking about overhauling your marketing strategy, here's what you need to know.
                        <span className="font-bold"> Good content + solid SEO fundamentals still matter most.</span>
                    </p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="bg-white/80 p-6 border-emerald-100/50 shadow-sm hover:shadow-emerald-100">
                            <BarChart className="text-emerald-500 mb-4" />
                            <h4 className="font-bold text-slate-800 mb-2">High Conversion</h4>
                            <p className="text-sm text-slate-600">AI-driven traffic converts better—up to <span className="font-bold text-emerald-600">23x higher</span> than traditional traffic.</p>
                        </Card>

                        <Card className="bg-white/80 p-6 border-emerald-100/50 shadow-sm hover:shadow-emerald-100">
                            <Users className="text-emerald-500 mb-4" />
                            <h4 className="font-bold text-slate-800 mb-2">RAG Technology</h4>
                            <p className="text-sm text-slate-600">AI assistants use RAG (Retrieval-Augmented Generation). If you rank well in search, you're in the running for AI mentions.</p>
                        </Card>

                        <Card className="bg-white/80 p-6 border-emerald-100/50 shadow-sm hover:shadow-emerald-100">
                            <Layout className="text-emerald-500 mb-4" />
                            <h4 className="font-bold text-slate-800 mb-2">Google's Advice</h4>
                            <p className="text-sm text-slate-600">Gary Illyes noted specialized "AI SEO" isn't necessary. High-quality content remains king.</p>
                        </Card>

                        <Card className="bg-white/80 p-6 border-emerald-100/50 shadow-sm hover:shadow-emerald-100">
                            <TrendingUp className="text-emerald-500 mb-4" />
                            <h4 className="font-bold text-slate-800 mb-2">Growth Potential</h4>
                            <p className="text-sm text-slate-600">Example: Ahrefs' pages have been cited 7,470 times across 2,309 pages without any AI-specific optimization.</p>
                        </Card>
                    </div>
                </div>
            </Section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-100 py-12 text-center">
                <p className="text-slate-400 text-sm">
                    GEO Visual Guide &copy; 2024. Designed for the Future of Search.
                </p>
            </footer>

        </div>
    );
};

export default WhatIsGEOArticle;
