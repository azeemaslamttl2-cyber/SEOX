import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Link2, ExternalLink, Download, Chrome, Play, ChevronRight, ChevronDown,
    CheckCircle, Video, BookOpen, Zap, Target, Lightbulb, AlertTriangle, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AIBacklinkGenerator = () => {
    const [expandedTutorial, setExpandedTutorial] = useState(null);
    const { user, isAdmin } = useAuth();

    // Check if user has enterprise access
    const isEnterprise = isAdmin || user?.level === 'enterprise';
    // Check if user is SEBT tier
    const isSEBT = user?.level === 'sebt';

    const features = [
        {
            icon: Zap,
            title: 'Automated Link Building',
            description: 'Automatically fill forms and submit your backlinks with AI-generated content'
        },
        {
            icon: Target,
            title: '152+ Link Opportunities',
            description: 'Access our curated database of high-authority backlink sources'
        },
        {
            icon: CheckCircle,
            title: 'Smart Form Detection',
            description: 'AI detects form fields and fills them with relevant information'
        },
        {
            icon: Lightbulb,
            title: 'AI Content Generation',
            description: 'Generate unique comments, bios, and descriptions for each submission'
        }
    ];

    const tutorials = [
        {
            id: 1,
            title: 'How to Install Extension',
            description: 'Learn how to install and configure the AI Link Builder extension',
            youtubeId: 'YbbC7lFQsNY'
        },
        {
            id: 2,
            title: 'How to Build EDU Backlinks',
            description: 'Step-by-step guide to building high-authority EDU backlinks automatically',
            youtubeId: '3d7yYcll6x4'
        },
        {
            id: 3,
            title: 'How to Record Steps for Websites',
            description: 'Learn how to record custom automation steps for any website',
            youtubeId: '5pDn6DnetRs'
        },
        {
            id: 4,
            title: 'AI Link Builder Webinar',
            description: 'Complete webinar covering Overview and best practices for AI Link Builder',
            youtubeId: 'HE25lqEAIu4'
        }
    ];

    const toggleTutorial = (id) => {
        setExpandedTutorial(expandedTutorial === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                        {/* Left side - Text content */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                                    <Link2 className="w-8 h-8" />
                                </div>
                                <span className="text-indigo-200 font-medium">Chrome Extension</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold mb-4">AI Link Builder</h1>
                            <p className="text-xl text-indigo-100 max-w-2xl mb-8">
                                Automate your link building with AI-powered form filling, smart content generation,
                                and access to 152+ curated backlink opportunities.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                {isEnterprise ? (
                                    <a
                                        href="https://drive.google.com/file/d/1XP6tpdwMD0VXHueBBwyIb4BxoXkw_24A/view?usp=sharing"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-lg"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Extension (V 1.2)
                                    </a>
                                ) : (
                                    <Link
                                        to="/upgrade"
                                        className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all border border-white/30"
                                    >
                                        <Lock className="w-5 h-5" />
                                        Enterprise Only - Upgrade
                                    </Link>
                                )}
                                <a
                                    href="#tutorials"
                                    className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
                                >
                                    <Play className="w-5 h-5" />
                                    Watch Tutorials
                                </a>
                            </div>
                        </div>
                        {/* Right side - Image */}
                        <div className="flex-shrink-0">
                            <img
                                src="/ailinkbuilding.jpg"
                                alt="AI Link Building"
                                className="w-full max-w-md lg:max-w-lg rounded-2xl shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12">

                {/* Features Grid */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">Key Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {features.map((feature, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-indigo-50 rounded-lg">
                                        <feature.icon className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                                        <p className="text-gray-600 text-sm">{feature.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How It Works */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">How It Works</h2>
                    <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-bold text-indigo-600">1</span>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Install Extension</h3>
                                <p className="text-gray-600 text-sm">Download and add the AI Link Builder to your Chrome browser</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-bold text-indigo-600">2</span>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Configure Settings</h3>
                                <p className="text-gray-600 text-sm">Add your website details and customize AI settings</p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl font-bold text-indigo-600">3</span>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Build Backlinks</h3>
                                <p className="text-gray-600 text-sm">Let the AI automate your link building process</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Available Link Categories */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">Available Link Categories</h2>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                            {[
                                { name: 'Profile Backlinks', count: 67, color: 'bg-blue-500' },
                                { name: 'Local Citations', count: 28, color: 'bg-emerald-500' },
                                { name: 'EDU Backlinks', count: 20, color: 'bg-purple-500' },
                                { name: 'Comment Backlinks', count: 17, color: 'bg-amber-500' },
                                { name: 'Forum Backlinks', count: 11, color: 'bg-rose-500' },
                                { name: 'Tool Websites', count: 5, color: 'bg-cyan-500' },
                                { name: 'Company Backlinks', count: 3, color: 'bg-orange-500' },
                                { name: 'Gov Backlinks', count: 1, color: 'bg-slate-500' }
                            ].map((category, i) => (
                                <div key={i} className="p-5 border-b border-r border-gray-100 hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{category.name}</p>
                                            <p className="text-xs text-gray-500">{category.count} recipes</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3 border-t border-gray-100">
                            <p className="text-sm text-indigo-700 font-medium text-center">
                                <span className="font-bold">152+ Total Recipes</span>
                                {isSEBT && " — More categories coming soon!"}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Tutorials Section - Collapsible with Video Players */}
                <section id="tutorials" className="mb-16">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Video Tutorials</h2>
                        <span className="text-indigo-600 font-medium">{tutorials.length} videos</span>
                    </div>
                    <div className="space-y-4">
                        {tutorials.map((tutorial) => (
                            <div
                                key={tutorial.id}
                                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all"
                            >
                                {/* Tutorial Header - Collapsible Button */}
                                <button
                                    onClick={() => toggleTutorial(tutorial.id)}
                                    className="w-full p-5 flex items-center gap-5 hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <div className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md transition-transform ${expandedTutorial === tutorial.id ? 'scale-90' : ''}`}>
                                            {expandedTutorial === tutorial.id ? (
                                                <ChevronDown className="w-5 h-5 text-indigo-600" />
                                            ) : (
                                                <Play className="w-4 h-4 text-indigo-600 ml-0.5" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 mb-1">
                                            {tutorial.title}
                                        </h3>
                                        <p className="text-gray-500 text-sm">{tutorial.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        {expandedTutorial === tutorial.id ? (
                                            <span className="text-sm font-medium">Close</span>
                                        ) : (
                                            <>
                                                <span className="text-sm font-medium">Watch</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </div>
                                </button>

                                {/* Collapsible Video Player */}
                                {expandedTutorial === tutorial.id && (
                                    <div className="px-5 pb-5">
                                        <div className="aspect-video rounded-lg overflow-hidden bg-black">
                                            <iframe
                                                width="100%"
                                                height="100%"
                                                src={`https://www.youtube.com/embed/${tutorial.youtubeId}?autoplay=1`}
                                                title={tutorial.title}
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="w-full h-full"
                                            ></iframe>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Download Section */}
                <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white text-center">
                    <Chrome className="w-12 h-12 mx-auto mb-4 opacity-80" />
                    <h2 className="text-2xl font-bold mb-2">Ready to automate your link building?</h2>
                    <p className="text-indigo-100 mb-2 max-w-lg mx-auto">
                        Download the AI Link Builder extension and start building high-quality backlinks today.
                    </p>
                    <p className="text-indigo-200 text-sm mb-6">
                        Current Version: <span className="font-semibold text-white">V 1.1</span>
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {isEnterprise ? (
                            <a
                                href="https://drive.google.com/file/d/1XP6tpdwMD0VXHueBBwyIb4BxoXkw_24A/view?usp=sharing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-lg"
                            >
                                <Download className="w-5 h-5" />
                                Download for Chrome (V 1.2)
                            </a>
                        ) : (
                            <Link
                                to="/upgrade"
                                className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all border border-white/30"
                            >
                                <Lock className="w-5 h-5" />
                                Enterprise Only ( Upgrade )
                            </Link>
                        )}
                        <a
                            href="#tutorials"
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
                        >
                            <Video className="w-5 h-5" />
                            Watch Tutorials
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AIBacklinkGenerator;
