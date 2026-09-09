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
        <div className="alb-page">
            {/* Hero Section */}
            <div className="alb-hero">
                <div>
                    <div className="alb-hero-inner">
                        <div className="alb-title-row">
                            <span className="edf-tile">
                                <Link2 className="h-5 w-5" />
                            </span>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="alb-title font-display">AI Link Builder</h1>
                                    <span className="admin-badge badge-sebt">Chrome Extension</span>
                                </div>
                                <p className="alb-lead">
                                    Automate your link building with AI-powered form filling, smart content
                                    generation, and access to 152+ curated backlink opportunities.
                                </p>
                            </div>
                        </div>
                        <div className="alb-hero-actions">
                                {isEnterprise ? (
                                    <a
                                        href="https://drive.google.com/file/d/1XP6tpdwMD0VXHueBBwyIb4BxoXkw_24A/view?usp=sharing"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ui-button alb-action alb-action-secondary"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Extension (V 1.2)
                                    </a>
                                ) : (
                                    <Link
                                        to="/upgrade"
                                        className="ui-button alb-action alb-action-secondary"
                                    >
                                        <Lock className="w-5 h-5" />
                                        Enterprise Only - Upgrade
                                    </Link>
                                )}
                                <a
                                    href="#tutorials"
                                    className="ui-button ui-button-primary alb-action"
                                >
                                    <Play className="w-5 h-5" />
                                    Watch Tutorials
                                </a>
                            </div>
                    </div>
                </div>
            </div>

            <div className="alb-body">

                {/* Features Grid */}
                <section className="mb-16">
                    <h2 className="alb-section-title font-display">Key Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {features.map((feature, i) => (
                            <div key={i} className="alb-feature-card">
                                <div className="flex items-start gap-4">
                                    <span className="alb-feature-icon">
                                        <feature.icon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h3 className="alb-feature-title">{feature.title}</h3>
                                        <p className="text-gray-600 text-sm">{feature.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How It Works */}
                <section className="mb-16">
                    <h2 className="alb-section-title font-display">How It Works</h2>
                    <div className="alb-steps-card">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="alb-step-num">
                                    <span>1</span>
                                </div>
                                <h3 className="alb-step-title">Install Extension</h3>
                                <p className="text-gray-600 text-sm">Download and add the AI Link Builder to your Chrome browser</p>
                            </div>
                            <div className="text-center">
                                <div className="alb-step-num">
                                    <span>2</span>
                                </div>
                                <h3 className="alb-step-title">Configure Settings</h3>
                                <p className="text-gray-600 text-sm">Add your website details and customize AI settings</p>
                            </div>
                            <div className="text-center">
                                <div className="alb-step-num">
                                    <span>3</span>
                                </div>
                                <h3 className="alb-step-title">Build Backlinks</h3>
                                <p className="text-gray-600 text-sm">Let the AI automate your link building process</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Available Link Categories */}
                <section className="mb-16">
                    <h2 className="alb-section-title font-display">Available Link Categories</h2>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                            {[
                                { name: 'Profile Backlinks', count: 67, color: 'bg-blue-500' },
                                { name: 'Local Citations', count: 28, color: 'bg-emerald-500' },
                                { name: 'EDU Backlinks', count: 20, color: 'bg-navy-700' },
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
                        <div className="alb-note">
                            <p className="alb-note-text">
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
                        <span className="admin-badge badge-sebt">{tutorials.length} videos</span>
                    </div>
                    <div className="space-y-4">
                        {tutorials.map((tutorial) => (
                            <div
                                key={tutorial.id}
                                className="alb-tutorial-card"
                            >
                                {/* Tutorial Header - Collapsible Button */}
                                <button
                                    onClick={() => toggleTutorial(tutorial.id)}
                                    className="alb-tutorial-header"
                                >
                                    <div className="alb-tutorial-thumb">
                                        <div className="alb-tutorial-play">
                                            {expandedTutorial === tutorial.id ? (
                                                <ChevronDown className="w-5 h-5" />
                                            ) : (
                                                <Play className="w-4 h-4 ml-0.5" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="alb-feature-title">
                                            {tutorial.title}
                                        </h3>
                                        <p className="alb-tutorial-desc">{tutorial.description}</p>
                                    </div>
                                    <div className="alb-tutorial-meta flex items-center gap-2">
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
                <section className="alb-cta">
                    <span className="edf-tile alb-cta-tile"><Chrome className="h-5 w-5" /></span>
                    <h2 className="alb-cta-title font-display">Ready to automate your link building?</h2>
                    <p className="alb-cta-body">
                        Download the AI Link Builder extension and start building high-quality backlinks today.
                    </p>
                    <p className="alb-cta-version">
                        Current Version: <span>V 1.1</span>
                    </p>
                    <div className="alb-cta-actions">
                        {isEnterprise ? (
                            <a
                                href="https://drive.google.com/file/d/1XP6tpdwMD0VXHueBBwyIb4BxoXkw_24A/view?usp=sharing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ui-button alb-action alb-action-secondary"
                            >
                                <Download className="w-5 h-5" />
                                Download for Chrome (V 1.2)
                            </a>
                        ) : (
                            <Link
                                to="/upgrade"
                                className="ui-button alb-action alb-action-secondary"
                            >
                                <Lock className="w-5 h-5" />
                                Enterprise Only ( Upgrade )
                            </Link>
                        )}
                        <a
                            href="#tutorials"
                            className="ui-button ui-button-primary alb-action"
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
