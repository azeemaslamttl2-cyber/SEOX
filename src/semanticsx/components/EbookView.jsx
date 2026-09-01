import React, { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronUp, Play, BookOpen, ExternalLink } from 'lucide-react';
import { ebookPathMap } from '../data/ebookPathMap';
import { useTheme } from '../contexts/ThemeContext';

// Color map for section styling - with dark mode support
const COLOR_MAP = {
    blue: {
        light: {
            header: 'bg-gradient-to-r from-blue-100 to-blue-200 hover:from-blue-200 hover:to-blue-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(59,130,246,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-blue-50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-blue-500',
            button: 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-blue-600 to-blue-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(59,130,246,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-blue-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]',
            cardText: 'text-white',
            icon: 'text-blue-400',
            button: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-[0_0_12px_rgba(59,130,246,0.5)]',
            chevron: 'text-white/80'
        }
    },
    purple: {
        light: {
            header: 'bg-gradient-to-r from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(147,51,234,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-purple-50 hover:shadow-[0_0_15px_rgba(147,51,234,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-purple-500',
            button: 'bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-purple-600 to-purple-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(147,51,234,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-purple-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(147,51,234,0.3)]',
            cardText: 'text-white',
            icon: 'text-purple-400',
            button: 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-[0_0_12px_rgba(147,51,234,0.5)]',
            chevron: 'text-white/80'
        }
    },
    green: {
        light: {
            header: 'bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(34,197,94,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-green-50 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-green-500',
            button: 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 shadow-[0_0_12px_rgba(34,197,94,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-green-600 to-green-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(34,197,94,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-green-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]',
            cardText: 'text-white',
            icon: 'text-green-400',
            button: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-[0_0_12px_rgba(34,197,94,0.5)]',
            chevron: 'text-white/80'
        }
    },
    teal: {
        light: {
            header: 'bg-gradient-to-r from-teal-100 to-teal-200 hover:from-teal-200 hover:to-teal-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(20,184,166,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-teal-50 hover:shadow-[0_0_15px_rgba(20,184,166,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-teal-500',
            button: 'bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 shadow-[0_0_12px_rgba(20,184,166,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-teal-600 to-teal-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(20,184,166,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-teal-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)]',
            cardText: 'text-white',
            icon: 'text-teal-400',
            button: 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-[0_0_12px_rgba(20,184,166,0.5)]',
            chevron: 'text-white/80'
        }
    },
    cyan: {
        light: {
            header: 'bg-gradient-to-r from-cyan-100 to-cyan-200 hover:from-cyan-200 hover:to-cyan-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(6,182,212,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-cyan-50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-cyan-500',
            button: 'bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 shadow-[0_0_12px_rgba(6,182,212,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-cyan-600 to-cyan-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(6,182,212,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-cyan-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]',
            cardText: 'text-white',
            icon: 'text-cyan-400',
            button: 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 shadow-[0_0_12px_rgba(6,182,212,0.5)]',
            chevron: 'text-white/80'
        }
    },
    orange: {
        light: {
            header: 'bg-gradient-to-r from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(249,115,22,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-orange-50 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-orange-500',
            button: 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 shadow-[0_0_12px_rgba(249,115,22,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-orange-600 to-orange-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(249,115,22,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-orange-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]',
            cardText: 'text-white',
            icon: 'text-orange-400',
            button: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-[0_0_12px_rgba(249,115,22,0.5)]',
            chevron: 'text-white/80'
        }
    },
    amber: {
        light: {
            header: 'bg-gradient-to-r from-amber-100 to-amber-200 hover:from-amber-200 hover:to-amber-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(245,158,11,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-amber-50 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-amber-500',
            button: 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-amber-600 to-amber-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(245,158,11,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-amber-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]',
            cardText: 'text-white',
            icon: 'text-amber-400',
            button: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
            chevron: 'text-white/80'
        }
    },
    emerald: {
        light: {
            header: 'bg-gradient-to-r from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(16,185,129,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-emerald-50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-emerald-500',
            button: 'bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(16,185,129,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-emerald-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]',
            cardText: 'text-white',
            icon: 'text-emerald-400',
            button: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
            chevron: 'text-white/80'
        }
    },
    rose: {
        light: {
            header: 'bg-gradient-to-r from-rose-100 to-rose-200 hover:from-rose-200 hover:to-rose-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(244,63,94,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-rose-50 hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-rose-500',
            button: 'bg-gradient-to-r from-rose-400 to-rose-500 hover:from-rose-500 hover:to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-rose-600 to-rose-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(244,63,94,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-rose-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]',
            cardText: 'text-white',
            icon: 'text-rose-400',
            button: 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.5)]',
            chevron: 'text-white/80'
        }
    },
    indigo: {
        light: {
            header: 'bg-gradient-to-r from-indigo-100 to-indigo-200 hover:from-indigo-200 hover:to-indigo-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(99,102,241,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-indigo-50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-indigo-500',
            button: 'bg-gradient-to-r from-indigo-400 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(99,102,241,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-indigo-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]',
            cardText: 'text-white',
            icon: 'text-indigo-400',
            button: 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-[0_0_12px_rgba(99,102,241,0.5)]',
            chevron: 'text-white/80'
        }
    },
    yellow: {
        light: {
            header: 'bg-gradient-to-r from-yellow-100 to-yellow-200 hover:from-yellow-200 hover:to-yellow-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(234,179,8,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-yellow-50 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-yellow-600',
            button: 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-[0_0_12px_rgba(234,179,8,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-yellow-600 to-yellow-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(234,179,8,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-yellow-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]',
            cardText: 'text-white',
            icon: 'text-yellow-400',
            button: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-[0_0_12px_rgba(234,179,8,0.5)]',
            chevron: 'text-white/80'
        }
    },
    pink: {
        light: {
            header: 'bg-gradient-to-r from-pink-100 to-pink-200 hover:from-pink-200 hover:to-pink-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(236,72,153,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-pink-50 hover:shadow-[0_0_15px_rgba(236,72,153,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-pink-500',
            button: 'bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 shadow-[0_0_12px_rgba(236,72,153,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-pink-600 to-pink-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(236,72,153,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-pink-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]',
            cardText: 'text-white',
            icon: 'text-pink-400',
            button: 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 shadow-[0_0_12px_rgba(236,72,153,0.5)]',
            chevron: 'text-white/80'
        }
    },
    red: {
        light: {
            header: 'bg-gradient-to-r from-red-100 to-red-200 hover:from-red-200 hover:to-red-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(239,68,68,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-red-50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-red-500',
            button: 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-red-600 to-red-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(239,68,68,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-red-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]',
            cardText: 'text-white',
            icon: 'text-red-400',
            button: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
            chevron: 'text-white/80'
        }
    },
    violet: {
        light: {
            header: 'bg-gradient-to-r from-violet-100 to-violet-200 hover:from-violet-200 hover:to-violet-300',
            headerShadow: 'shadow-[0_4px_20px_rgba(139,92,246,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-violet-50 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-violet-500',
            button: 'bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-500 hover:to-violet-600 shadow-[0_0_12px_rgba(139,92,246,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-violet-600 to-violet-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(139,92,246,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-violet-200',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]',
            cardText: 'text-white',
            icon: 'text-violet-400',
            button: 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 shadow-[0_0_12px_rgba(139,92,246,0.5)]',
            chevron: 'text-white/80'
        }
    },
    slate: {
        light: {
            header: 'bg-gradient-to-r from-slate-200 to-slate-300 hover:from-slate-300 hover:to-slate-400',
            headerShadow: 'shadow-[0_4px_20px_rgba(100,116,139,0.3)]',
            headerText: 'text-slate-900',
            headerSubtext: 'text-slate-600',
            card: 'bg-white hover:bg-slate-50 hover:shadow-[0_0_15px_rgba(100,116,139,0.2)]',
            cardText: 'text-slate-800',
            icon: 'text-slate-500',
            button: 'bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 shadow-[0_0_12px_rgba(100,116,139,0.4)]',
            chevron: 'text-slate-600'
        },
        dark: {
            header: 'bg-gradient-to-r from-slate-600 to-slate-700',
            headerShadow: 'shadow-[0_4px_20px_rgba(100,116,139,0.4)]',
            headerText: 'text-white',
            headerSubtext: 'text-slate-300',
            card: 'bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(100,116,139,0.3)]',
            cardText: 'text-white',
            icon: 'text-slate-400',
            button: 'bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 shadow-[0_0_12px_rgba(100,116,139,0.5)]',
            chevron: 'text-white/80'
        }
    }
};

const getColors = (colorName, isDarkMode) => {
    const colorSet = COLOR_MAP[colorName] || COLOR_MAP.blue;
    return isDarkMode ? colorSet.dark : colorSet.light;
};

const EbookView = ({
    sections,
    config,
    searchQuery,
    setSearchQuery,
    onTopicClick
}) => {
    const { isDarkMode } = useTheme();
    const [expandedSections, setExpandedSections] = useState(() => {
        // Initialize all sections as expanded by default
        const initial = {};
        sections.forEach(section => {
            initial[section.id] = true;
        });
        return initial;
    });

    // Filter topics based on search query
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) {
            return sections;
        }
        const query = searchQuery.toLowerCase();
        return sections
            .map(section => ({
                ...section,
                topics: section.topics.filter(topic =>
                    topic.title.toLowerCase().includes(query)
                )
            }))
            .filter(section => section.topics.length > 0);
    }, [searchQuery, sections]);

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const expandAll = () => {
        const allExpanded = {};
        sections.forEach(section => {
            allExpanded[section.id] = true;
        });
        setExpandedSections(allExpanded);
    };

    const collapseAll = () => {
        setExpandedSections({});
    };

    return (
        <div className={isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}>
            {/* Attribution Banner */}
            {/*
            <div className="max-w-3xl mx-auto my-8 px-4">
                <div className="p-6 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg">
                    <p className="text-center text-white text-sm md:text-base">
                        Special thanks to Sir <strong className="font-bold">Koray Tuğberk GÜBÜR</strong> for introducing these concepts, and to <span className="italic"><b>Muhammad Ahmad Khan, Muhammad Hamid Khan, Behzad Hussain, Faheem Iqbal Badar, Ehsan Khan</b></span> for sharing their research.
                    </p>
                </div>
            </div>
            */}

            {/* Search Bar */}
            <div className="max-w-7xl mx-auto px-4 mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-12 pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 shadow-lg ${isDarkMode
                                ? 'bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:ring-blue-500/50'
                                : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:ring-blue-500/50'
                            }`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expand/Collapse Controls */}
            <div className="max-w-7xl mx-auto px-4 mb-4">
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={expandAll}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${isDarkMode
                                ? 'text-blue-400 hover:bg-slate-800'
                                : 'text-blue-600 hover:bg-blue-50'
                            }`}
                    >
                        Expand All
                    </button>
                    <button
                        onClick={collapseAll}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${isDarkMode
                                ? 'text-slate-400 hover:bg-slate-800'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Content - Accordion Sections */}
            <main className="px-4 pb-12">
                {filteredSections.length === 0 ? (
                    <div className="text-center py-20">
                        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl shadow-lg mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                            <BookOpen className={`w-12 h-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        </div>
                        <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                            {sections.length === 0 ? 'No Topics Yet' : 'No topics found'}
                        </h3>
                        <p className={`max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {sections.length === 0 ? config.emptyMessage : 'Try a different search term'}
                        </p>
                    </div>
                ) : (
                    <div id="accordion" className="space-y-6">
                        {filteredSections.map((section) => {
                            const colors = getColors(section.color, isDarkMode);
                            return (
                                <div
                                    key={section.id}
                                    className={`accordion-section border rounded-xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                                        }`}
                                >
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={`accordion-header w-full ${colors.header} ${colors.headerShadow} cursor-pointer p-4 flex justify-between items-center transition-all duration-300`}
                                    >
                                        <div className="text-left">
                                            <h2 className={`font-bold text-xl ${colors.headerText}`}>{section.name}</h2>
                                            <p className={`text-sm mt-1 ${colors.headerSubtext}`}>
                                                {section.topics.length} {section.topics.length === 1 ? 'topic' : 'topics'}
                                            </p>
                                        </div>
                                        {expandedSections[section.id] ? (
                                            <ChevronUp className={`w-6 h-6 ${colors.chevron} transform transition-transform duration-200`} />
                                        ) : (
                                            <ChevronDown className={`w-6 h-6 ${colors.chevron} transform transition-transform duration-200`} />
                                        )}
                                    </button>

                                    {/* Section Content */}
                                    {expandedSections[section.id] && (
                                        <div className={`accordion-content p-4 ${isDarkMode ? 'bg-slate-800/50' : ''}`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {section.topics.map((topic) => (
                                                    <div
                                                        key={topic.id}
                                                        className={`topic-card p-4 border rounded-lg shadow-sm ${colors.card} transition-all duration-300 flex items-center justify-between group ${isDarkMode ? 'border-slate-700' : 'border-slate-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center space-x-3 flex-1">
                                                            <svg className={`w-6 h-6 ${colors.icon} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4"></path>
                                                            </svg>
                                                            <span className={`font-medium ${colors.cardText}`}>{topic.title}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => onTopicClick(topic.id, topic.title)}
                                                            className={`ml-3 ${colors.button} text-white px-3 py-1.5 rounded-lg transition flex items-center justify-center`}
                                                            aria-label="Click to Read"
                                                        >
                                                            <Play className="w-4 h-4 fill-current" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default EbookView;

