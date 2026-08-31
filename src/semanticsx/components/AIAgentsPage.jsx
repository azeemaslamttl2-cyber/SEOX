import React, { useState } from 'react';
import {
    Bot, Search, ExternalLink, ChevronDown, ChevronUp, ArrowLeft,
    Brain, Sparkles, Network, MessageSquare, Shield, BarChart3,
    FileText, Code, BookOpen, Languages, Target, Users, Wand2,
    // Additional icons for agents
    Filter, Scissors, TreePine, Type, Gauge, BookMarked, HelpCircle,
    Globe, Layers, Hash, Quote, Lightbulb, GitBranch, Database,
    Boxes, Link2, UserCircle, Scale, FileQuestion, ListTree, Tags,
    TrendingUp, Route, ClipboardList, Binary, Ruler, AlignLeft,
    RefreshCw, MessageCircle, Heart, ThumbsUp, CheckCircle, AlertTriangle,
    Bug, Calendar, Image, LineChart, FileSpreadsheet, DollarSign,
    Link, Newspaper, Clock, List, ShieldCheck, PenTool, Calculator,
    Zap, Package, Play, Eye, User, PlusCircle, XCircle
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

// ============================================================================
// AI AGENTS DATA (Parsed from CSV - Credits: Koray Tuğberk GÜBÜR)
// ============================================================================

const AI_AGENTS_DATA = [
    {
        category: "Linguistic & Syntactic Analysis",
        description: "GPT's that operate at sentence, word, or grammatical structure level",
        icon: Languages,
        color: "indigo",
        agents: [
            {
                name: "Algorithmic Authorship (Sentence Filterer)",
                url: "https://chatgpt.com/g/g-I5etqezpw-algorithmic-authorship-sentence-filterer",
                exampleUrl: "https://chatgpt.com/share/6860fae3-3414-8009-af37-4601cb879ab3",
                description: "Scans documents and identifies sentences that match specific problems or patterns, such as sentences starting with 'If', sentences with unnecessary words, unclear nested statements, and more.",
                fullDescription: [
                    "Sentences starting with 'If'",
                    "Sentences with unnecessary words (e.g., also, additionally, in addition to)",
                    "Sentences that should be questions but are not written as questions",
                    "Sentences with unclear nested statements",
                    "Sentences using plural nouns without examples",
                    "Sentences that state something without giving reasons"
                ],
                useCases: ["Editing", "Proofreading", "Document quality checks", "Academic writing", "Policy/technical review"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Metadata (titles, meta descriptions)",
                    "Content briefs or outlines"
                ],
                icon: Filter,
                emoji: "🔍"
            },
            {
                name: "Tokenizer, Lemmatizer and Stemmer",
                url: "https://chatgpt.com/g/g-kvxrpbbl3-tokenizer-lemmatizer-and-stemmer",
                exampleUrl: "https://chatgpt.com/share/68604684-2258-8009-a941-0bd8f6b52c8f",
                description: "Parses short texts and turns them into a detailed NLP table with tokens, lemmas, stems, POS tags, spelling suggestions, and dependency relations.",
                fullDescription: [
                    "Breaking the text into ordered tokens with their positions",
                    "Generating lemmatized and stemmed versions of each token",
                    "Assigning part-of-speech tags (NOUN, VERB, ADJ, etc.)",
                    "Offering spelling suggestions for tokens that look incorrect",
                    "Briefly describing the sense/meaning in context for each token",
                    "Mapping dependency relations (parent token and relation type)",
                    "Providing start and end character offsets for each token"
                ],
                useCases: ["SEO/content analysis", "NLP debugging", "Annotation prep", "Keyword research", "Educational/teaching"],
                requiredInput: [
                    "A single sentence, headline, or paragraph (short to medium length)",
                    "Multiple short sentences or paragraphs as plain text",
                    "English prose without HTML, code, or markdown tables",
                    "Content roughly between 5 and 300 words"
                ],
                icon: Scissors,
                emoji: "✂️"
            },
            {
                name: "Syntax Tree Creator",
                url: "https://chatgpt.com/g/g-Fbys6jtCm-syntax-tree-creator",
                exampleUrl: "https://chatgpt.com/share/6860ffba-cb1c-8009-91ea-a7196ebe449b",
                description: "Analyzes text and reveals its grammatical structure by parsing paragraphs into sentences, clauses, and phrases, creating syntax trees and dependency trees.",
                fullDescription: [
                    "Parsing paragraphs into sentences, clauses, and phrases",
                    "Identifying subjects, verbs, objects, and modifiers",
                    "Creating syntax trees that show hierarchical phrase structure (NP, VP, PP)",
                    "Visualizing dependency trees showing which words depend on which heads",
                    "Highlighting core grammatical relations like nsubj, dobj, aux, advmod",
                    "Helping users understand how sentences are built and meaning is organized"
                ],
                useCases: ["Syntax learning", "SEO content refinement", "Translation QA", "NLP preprocessing", "Technical writing"],
                requiredInput: [
                    "A single sentence (preferable for clean trees)",
                    "A short paragraph (will split into sentences)",
                    "English text written as normal prose (not bullet fragments)",
                    "Blog posts, landing page copy, product descriptions",
                    "Metadata (titles, meta descriptions)"
                ],
                icon: TreePine,
                emoji: "🌳"
            },
            {
                name: "Contextless Word Remover",
                url: "https://chatgpt.com/g/g-7StYq44bk-contextless-word-remover",
                exampleUrl: "https://chatgpt.com/share/696e4b3d-46d0-8007-804b-575207989abc",
                description: "Scans paragraphs and removes words that don't contribute to core meaning, including stop words, vague fillers, redundant helper phrases, and wordy constructs.",
                fullDescription: [
                    "Stop words that add length but not value",
                    "Vague fillers like 'some', 'one of the', 'a number of'",
                    "Redundant helper phrases like 'is able to', 'in order to', 'due to the fact that'",
                    "Wordy constructs that can be shortened (e.g., 'make use of' → 'use')",
                    "Repeated ideas that don't add new information",
                    "Unnecessary softening or hedging language that weakens clarity"
                ],
                useCases: ["SEO editing", "Conversion copy optimization", "Content brief refinement", "Metadata improvement", "Client report polishing"],
                requiredInput: [
                    "A single paragraph with at least 2-3 full sentences",
                    "Multiple short paragraphs pasted together as plain text",
                    "English prose without HTML, code, or markdown tables",
                    "Content roughly between 30 and 800 words"
                ],
                icon: Scissors,
                emoji: "🧹"
            },
            {
                name: "Vocabulary Richness Auditor",
                url: "https://chatgpt.com/g/g-lBtMS9Jk3-vocabulary-richness-auditor",
                exampleUrl: "https://chatgpt.com/share/6860fa47-a930-8009-b917-f5472abb1d1d",
                description: "Analyzes paragraphs and measures how complex, varied, and readable the language is by calculating metrics like sentence count, type/token ratio, and syllable patterns.",
                fullDescription: [
                    "Sentence count and average sentence length",
                    "Total tokens and unique word types (excluding numbers)",
                    "Type/token ratio to assess vocabulary diversity",
                    "Total syllable count and average syllables per word and per sentence",
                    "Number of words with more than 2 syllables, plus their percentage",
                    "Syllables per 100 words to approximate readability levels",
                    "Overall vocabulary richness and readability score"
                ],
                useCases: ["SEO content optimization", "Content quality auditing", "Brand voice consistency", "Training writers", "Localization checks"],
                requiredInput: [
                    "A single paragraph with at least 2-3 full sentences",
                    "Multiple short paragraphs pasted together as plain text",
                    "English prose without HTML, code, or markdown tables",
                    "Content roughly between 30 and 800 words for meaningful statistics"
                ],
                icon: Gauge,
                emoji: "📊"
            },
            {
                name: "Metadiscourse Markers Auditor",
                url: "https://chatgpt.com/g/g-bLXDSltHK-metadiscourse-markers-auditor",
                exampleUrl: "https://chatgpt.com/share/696e4bd7-0e4c-8007-ab49-9c6e6cc9e3a8",
                description: "Scans texts and identifies metadiscourse markers that organize, connect, and explain discourse, including frame markers, enumerative markers, and result markers.",
                fullDescription: [
                    "Frame markers that introduce or situate the topic (setting context or main theme)",
                    "Enumerative markers that list or sequence key components or steps",
                    "Result markers that signal consequences or outcomes of earlier statements",
                    "Elaborative markers that clarify, explain further, or restate ideas",
                    "Interactive markers that highlight social/communal involvement in the discourse"
                ],
                useCases: ["SEO content optimization", "Content clarity & flow", "Conversion copy tuning", "Brand/voice consistency", "Content brief review"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Metadata (titles, meta descriptions)",
                    "Content briefs or outlines",
                    "1-5 paragraphs at a time for best results"
                ],
                icon: BookMarked,
                emoji: "📑"
            },
            {
                name: "Question Logic Analyzer",
                url: "https://chatgpt.com/g/g-fOnweol81-question-logic-analyzer",
                exampleUrl: "https://chatgpt.com/g/g-fOnweol81-question-logic-analyzer",
                description: "Analyzes questions and maps the logical relationships between entities, breaking down connections step by step and discovering supporting entities.",
                fullDescription: [
                    "Questions containing two entities that need to know if related",
                    "Breaking down X and Y connections step by step",
                    "Numbered listicle-style explanations of how and why entities are linked",
                    "Discovering additional supporting entities around the main pair",
                    "Tables showing: entity, why it's related, and how it helps answer the question",
                    "Explicitly stating when entities are not connected and explaining why"
                ],
                useCases: ["Entity relationship analysis", "SEO strategy", "Content brief creation", "Knowledge graph thinking", "Problem diagnosis"],
                requiredInput: [
                    "A single clear question with at least two entities",
                    "Examples: 'How is internal linking related to crawl budget?'",
                    "'What is the relationship between backlinks and domain authority?'",
                    "Optional: context, goal, language, or constraints"
                ],
                icon: HelpCircle,
                emoji: "❓"
            },
            {
                name: "Translator (Context-based)",
                url: "https://chatgpt.com/g/g-Si7XVSASq-translator-context-based",
                exampleUrl: "https://chatgpt.com/share/696e4c8c-6e48-8007-8629-cb211270b0d8",
                description: "Translates English documents into Turkish while preserving SEO context and topical relevance, adapting phrases naturally while keeping keywords recognizable.",
                fullDescription: [
                    "Translating key SEO terms and entities without losing search intent",
                    "Adapting phrases to natural Turkish while keeping keywords recognizable",
                    "Preserving topical authority by keeping semantic fields aligned",
                    "Choosing Turkish equivalents based on context, not literal translation",
                    "Maintaining consistent terminology across the whole document",
                    "Avoiding keyword loss or dilution when rephrasing for fluency"
                ],
                useCases: ["SEO translation", "Content localization", "Metadata optimization", "Topical authority building", "Terminology consistency"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Metadata (titles, meta descriptions)",
                    "Optional: primary keywords, target audience, tone of voice"
                ],
                icon: Globe,
                emoji: "🌍"
            }
        ]
    },
    {
        category: "Semantic Analysis & Meaning Extraction",
        description: "GPT's focused on meaning, roles, frames, and semantic relationships",
        icon: Brain,
        color: "purple",
        agents: [
            {
                name: "Frame Semantics Analyzer",
                url: "https://chatgpt.com/g/g-rjl1840ZD-frame-semantics-analyzer",
                exampleUrl: "https://chatgpt.com/g/g-rjl1840ZD-frame-semantics-analyzer",
                description: "Examines sentences and maps out their meaning using frame semantics, identifying predicates, frame elements, and showing how surface syntax connects to semantic roles.",
                fullDescription: [
                    "Identifying the main predicate and determining which semantic frame it evokes",
                    "Listing frame elements (Agent, Patient, Experiencer, Instrument, Goal)",
                    "Organizing analysis into tables with columns for Predicate, Frame, Frame Element, etc.",
                    "Highlighting frame-related concepts (core vs non-core frame elements, lexical units)",
                    "Showing how surface syntax connects to underlying semantic roles",
                    "Comparing predicate behavior across different sentences and domains"
                ],
                useCases: ["SEO content analysis", "Content optimization", "SERP analysis", "Entity and schema strategy", "Brand messaging consistency"],
                requiredInput: [
                    "Blog posts (full article or selected paragraphs/sentences)",
                    "Landing page sections (hero, features, benefits, CTAs)",
                    "Product or service descriptions",
                    "Category descriptions for e-commerce or blog hubs",
                    "Metadata (titles, meta descriptions, headings)",
                    "Optional: Target keyword(s), user intent, market/industry"
                ],
                icon: Layers,
                emoji: "🎯"
            },
            {
                name: "Semantic Role Labeler",
                url: "https://chatgpt.com/g/g-PizPW64TT-semantic-role-labeler",
                exampleUrl: "https://chatgpt.com/share/696e4cea-582c-8007-8552-134d91259ee8",
                description: "Analyzes sentences and marks who did what to whom, when, where, and how, identifying AGENT, PATIENT, EXPERIENCER, INSTRUMENT, LOCATION, and more.",
                fullDescription: [
                    "Identifying the AGENT (the doer of the action) in each clause",
                    "Marking the PATIENT or THEME (the entity affected by the action)",
                    "Tagging the EXPERIENCER (the entity that feels or perceives)",
                    "Labeling INSTRUMENT (what is used to carry out the action)",
                    "Marking LOCATION, SOURCE, and GOAL (where something is, comes from, or goes)",
                    "Tagging TIME and MANNER (when and how the event happens)",
                    "Distinguishing between MAIN PREDICATE and its semantic arguments"
                ],
                useCases: ["SEO content analysis", "On-page optimization", "Content brief refinement", "Competitive teardown", "Entity/knowledge graph prep"],
                requiredInput: [
                    "A single sentence for detailed breakdown",
                    "A short paragraph (2-5 sentences) from a blog post or landing page",
                    "Above-the-fold copy of a page",
                    "A meta title + meta description pair",
                    "Optional: target keyword or topic, page type"
                ],
                icon: Tags,
                emoji: "🏷️"
            },
            {
                name: "Word Meaning Extractor",
                url: "https://chatgpt.com/g/g-hsoXezgrH-word-meaning-extractor",
                exampleUrl: "https://chatgpt.com/share/696e4d51-d040-8007-b328-f0a0705a43a1",
                description: "Parses paragraphs and identifies all possible meanings of each word, then highlights which meaning is actually used in context with scoring.",
                fullDescription: [
                    "Listing every dictionary sense of each word (even if only one is used)",
                    "Computing contextual entailment scores showing how well each meaning fits",
                    "Providing a 'best-fit' sense for each word based on scores",
                    "Separating contextual score, prior score, and total score for each meaning",
                    "Handling polysemous words with multiple senses and ranking by relevance",
                    "Supporting semantic analysis, NLP feature engineering, and SEO"
                ],
                useCases: ["Word-sense disambiguation", "SEO keyword clarity", "Semantic/NLP analysis", "Copy review for precision", "Education & linguistics"],
                requiredInput: [
                    "A single paragraph (recommended for fine-grained analysis)",
                    "Multiple paragraphs from an article or landing page",
                    "A snippet of copy (e.g., H1 + first paragraph)",
                    "A sentence list for checking ambiguous words",
                    "Optional: list of focus words to emphasize"
                ],
                icon: Hash,
                emoji: "💬"
            },
            {
                name: "Semantic Emphasizer",
                url: "https://chatgpt.com/g/g-bEksrenhC-semantic-emphasizer",
                exampleUrl: "https://chatgpt.com/share/696e4dc6-d3c4-8007-a418-2b634853d273",
                description: "Analyzes text and highlights its most semantically important concepts, creating summary tables with relevance and importance scores.",
                fullDescription: [
                    "Identifying the primary topic of a passage and focusing analysis around it",
                    "Boldening key entities (people, places, things, concepts) related to main topic",
                    "Boldening important attributes (qualities, features, metrics) of those entities",
                    "Boldening predicates and relationships (actions, connections, cause-effect links)",
                    "Creating a summary table of bolded terms with relevance and importance scores",
                    "Providing brief reason/description explaining why each term was highlighted"
                ],
                useCases: ["SEO content analysis", "Topical authority mapping", "Schema & structured data support", "Content audits", "Optimization planning"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "FAQ sections",
                    "Service pages",
                    "Short snippets (1-2 paragraphs) or entire pages"
                ],
                icon: Lightbulb,
                emoji: "💡"
            },
            {
                name: "Lexical Path Analyzer",
                url: "https://chatgpt.com/g/g-HFCxIzKVi-lexical-path-analyzer",
                exampleUrl: "https://chatgpt.com/g/g-HFCxIzKVi-lexical-path-analyzer",
                description: "Analyzes concepts and maps how they are lexically related, identifying synonyms, antonyms, hypernyms, hyponyms, and tracing multi-step lexical paths.",
                fullDescription: [
                    "Identifying synonyms, antonyms, hypernyms, and hyponyms for a concept",
                    "Tracing multi-step lexical paths (e.g., 'cat → animal → living thing')",
                    "Showing how two concepts are connected through intermediate terms",
                    "Providing short context notes explaining how and where a relation is relevant",
                    "Helping with topical clustering by revealing closely related concepts",
                    "Clarifying ambiguous terms by listing different senses and lexical neighborhoods"
                ],
                useCases: ["Topical mapping", "Content clustering", "Internal linking strategy", "Entity enrichment", "Keyword clarification"],
                requiredInput: [
                    "Blog posts or specific sections",
                    "Landing page copy",
                    "Product descriptions",
                    "Keyword lists or entity lists",
                    "FAQ sections or question lists",
                    "Short text, list of concepts, or a mix of both"
                ],
                icon: GitBranch,
                emoji: "🔀"
            },
            {
                name: "Triple Generator",
                url: "https://chatgpt.com/g/g-Ch2V2HlaE-triple-generator",
                exampleUrl: "https://chatgpt.com/share/6860fe2b-a168-8009-903d-35d26f743e04",
                description: "Parses paragraphs and converts their meaning into structured subject-predicate-object triples with prominence scores.",
                fullDescription: [
                    "Extracting subject-predicate-object (S-P-O) relationships from sentences",
                    "Organizing all extracted triples inside a clear, readable table",
                    "Assigning a prominence score to show how central/important each triple is",
                    "Explaining why each triple received its given prominence score",
                    "Helping you quickly see main entities, actions, and facts in any text"
                ],
                useCases: ["Knowledge graph building", "Topical authority mapping", "Schema planning", "Competitive analysis", "Brief validation"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Metadata (titles, meta descriptions)",
                    "Content briefs or outlines"
                ],
                icon: Database,
                emoji: "🗃️"
            },
            {
                name: "Microsemantics – Relevant Item Finder",
                url: "https://chatgpt.com/g/g-znmMnj16M-microsemantics-relevant-item-finder",
                exampleUrl: "https://chatgpt.com/share/696e4ea6-63f8-8007-96fc-a68ad9ebcc45",
                description: "Scans documents and pinpoints the single most topically relevant content unit for a given phrase, concept, or keyword.",
                fullDescription: [
                    "Finding the paragraph that best matches a target keyword or topic",
                    "Selecting the list item most aligned with a specific user intent",
                    "Identifying the table entry semantically closest to a concept",
                    "Explaining why that item is the most crucial match",
                    "Mapping lexical relations and related entities between phrase and content",
                    "Rewriting/inserting the contextual phrase into selected content unit"
                ],
                useCases: ["Keyword targeting", "Internal linking", "Topical alignment", "Content expansion", "On-page SEO audits"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Content briefs or outlines",
                    "One contextual phrase/concept/keyword to match"
                ],
                icon: Target,
                emoji: "🎯"
            },
            {
                name: "Knowledge Domain Terms Extractor",
                url: "https://chatgpt.com/g/g-pTlMNH1VD-knowledge-domain-term-extractor",
                exampleUrl: "https://chatgpt.com/share/685f9cb7-bbd4-8009-a2ce-f4fbb6531717",
                description: "Takes a topic name and generates a structured glossary with 100+ semantically relevant terms, definitions, importance scores, and relationships.",
                fullDescription: [
                    "Extracting at least 100 semantically relevant terms related to the topic",
                    "Providing concise definitions for each term in the context of the topic",
                    "Assigning an importance score showing how central each term is",
                    "Mapping adjacent or neighboring contexts for every term",
                    "Identifying most important named entities connected to each term",
                    "Listing most essential predicates that describe how each term behaves"
                ],
                useCases: ["Topical map design", "Entity-first SEO", "Content briefing", "Niche onboarding", "Semantic clustering"],
                requiredInput: [
                    "One clear topic name, such as:",
                    "'Technical SEO'",
                    "'Local SEO for dentists'",
                    "'Programmatic SEO'",
                    "'E-commerce product page SEO'",
                    "Format: Topic: [your topic name]"
                ],
                icon: BookOpen,
                emoji: "📖"
            },
            {
                name: "Entity Type Root, Rare, Unique Attribute Extractor",
                url: "https://chatgpt.com/g/g-6K7j5kit3-entity-type-root-rare-unique-attribute-extractor",
                exampleUrl: "https://chatgpt.com/share/696e4f34-1458-8007-8fca-124d4874e822",
                description: "Analyzes any entity type and extracts structured attributes: root (present in all), rare (present in some), and unique (belonging to specific entities).",
                fullDescription: [
                    "Attributes that are root (present in all entities of that type)",
                    "Attributes that are rare (present only in some entities)",
                    "Attributes that are unique (belonging only to specific entities)",
                    "Organized table with attribute type, prominence, definition, relevance",
                    "Example entities mapped to the attributes in the table",
                    "Support for schema/ontology design and semantic SEO"
                ],
                useCases: ["Entity schema design", "Faceted navigation", "Programmatic SEO templates", "Competitive comparison pages", "Taxonomy building"],
                requiredInput: [
                    "The entity type you want analyzed",
                    "e.g., 'SEO agency', 'project management software', 'electric car'",
                    "Optional: SEO/business context (target market, audience)",
                    "Optional: example entities if you have them",
                    "Optional: number of attributes you want (minimum >20)"
                ],
                icon: Boxes,
                emoji: "📦"
            }
        ]
    },
    {
        category: "Entity & Knowledge Graph Oriented",
        description: "GPT's concerned with entities, attributes, and structured knowledge",
        icon: Network,
        color: "emerald",
        agents: [
            {
                name: "Named Entity Inserter",
                url: "https://chatgpt.com/g/g-9Qzc9llQP-named-entity-inserter",
                exampleUrl: "https://chatgpt.com/share/696e50ee-5f90-8007-aa83-c858f960013e",
                description: "Enriches paragraphs by inserting missing but topically related entities, explaining their relevance and comparing topicality scores before and after.",
                fullDescription: [
                    "Detecting important entities implied by heading but not mentioned in text",
                    "Adding entities directly into paragraph with new words in bold",
                    "Keeping original context intact by only inserting strengthening entities",
                    "Explaining why each new entity fits and how it improves topical depth",
                    "Comparing topicality scores before and after enhancement",
                    "Listing newly added entities with their effect on topicality"
                ],
                useCases: ["Content enrichment", "Topical authority building", "On-page optimization", "E-commerce/category SEO", "Knowledge base docs"],
                requiredInput: [
                    "A heading (H1/H2/H3) that states the main topic",
                    "A subordinate text/paragraph that expands that heading",
                    "Optional: target keywords or entities you care about",
                    "Optional: page type (blog, product page, category page)",
                    "Optional: constraints (e.g., 'no more than 2 added entities')"
                ],
                icon: PlusCircle,
                emoji: "➕"
            },
            {
                name: "Named Entity Suggester",
                url: "https://chatgpt.com/g/g-nIcqotc6c-named-entity-suggester",
                exampleUrl: "https://chatgpt.com/share/696e5145-4cf4-8007-8253-f4d0ed6de909",
                description: "Analyzes paragraphs and uncovers missing but contextually relevant entities, ranking them by prominence with related predicates and adjectives.",
                fullDescription: [
                    "Identifying important people, brands, places, events, concepts that should be mentioned",
                    "Ranking suggested entities by prominence and importance to the topic",
                    "Providing each entity with related attributes (type, role, category)",
                    "Explaining why each entity matters in terms of topical relevance",
                    "Generating detailed table with context, topicality, relevance score",
                    "Listing most related predicates and adjectives for each entity"
                ],
                useCases: ["Content expansion", "Topical authority building", "On-page SEO optimization", "Entity gap analysis", "Internal linking strategy"],
                requiredInput: [
                    "Blog posts",
                    "Landing page copy",
                    "Product descriptions",
                    "Category pages",
                    "Metadata (titles, meta descriptions)",
                    "Optional: main keyword/topic of the content"
                ],
                icon: Sparkles,
                emoji: "✨"
            },
            {
                name: "Named Entity Suggester (Person Type)",
                url: "https://chatgpt.com/g/g-UAw6VbQIH-named-entity-suggester-person-type",
                exampleUrl: "https://chatgpt.com/share/696e51b2-4834-8007-b4ed-b71434a81eb6",
                description: "Takes two main subjects and builds a shared contextual domain by discovering key named entities with a focus on people.",
                fullDescription: [
                    "Discovering key named entities connecting two main subjects",
                    "Focusing on people (experts, influencers, researchers, founders)",
                    "Building shared contextual domains between concepts",
                    "Identifying bridge entities for content connections",
                    "Supporting topical mapping and PR outreach"
                ],
                useCases: ["Topical mapping", "Content strategy", "Digital PR & outreach", "Internal linking", "Expert sourcing"],
                requiredInput: [
                    "Two main subjects or topics you want to connect",
                    "e.g., 'Technical SEO' and 'Machine Learning'",
                    "Optional: focus area or industry context",
                    "Optional: target audience or content goal"
                ],
                icon: Users,
                emoji: "👥"
            },
            {
                name: "Which-Agent",
                url: "https://chatgpt.com/g/g-67a14ab7285c8191a12dc09e19b4ec57-which-agent",
                exampleUrl: "https://chatgpt.com/share/68612cbb-fcc8-8009-969a-0c3081322f74",
                description: "Helps you decide 'which one and why' when comparing things—tools, assets, concepts, strategies—with tailored comparisons based on your purpose.",
                fullDescription: [
                    "Comparing tools, assets, concepts, or strategies",
                    "Tailored comparisons based on your specific purpose",
                    "Structured decision-making framework",
                    "Clear pros/cons and recommendation reasoning",
                    "Supporting 'which one' and 'why' questions"
                ],
                useCases: ["Product comparison", "Plan/pricing decisions", "Technology choice", "Strategy selection", "Vendor evaluation"],
                requiredInput: [
                    "Two or more items to compare",
                    "Your specific purpose or use case",
                    "Optional: criteria that matter most to you",
                    "Optional: constraints (budget, time, team size)"
                ],
                icon: HelpCircle,
                emoji: "❓"
            },
            {
                name: "Who-Agent",
                url: "https://chatgpt.com/g/g-67a1484c4e1881919b091ccdbf5b9d05-who-agent",
                exampleUrl: "https://chatgpt.com/share/68612f0f-eeb4-8009-8305-c271b45d435a",
                description: "Generates structured, context-rich profiles of people, linking them to their historical and professional landscape with achievements and related figures.",
                fullDescription: [
                    "Generating structured profiles of people",
                    "Linking to historical and professional landscape",
                    "Documenting achievements and contributions",
                    "Identifying related figures and connections",
                    "Context-rich biographical information"
                ],
                useCases: ["Biographical lookup", "Career-context analysis", "Thought-leadership mapping", "Historical placement", "Expert profiling"],
                requiredInput: [
                    "Name of the person you want to learn about",
                    "Optional: specific context or field of interest",
                    "Optional: time period or era of focus",
                    "Optional: connection to another person or topic"
                ],
                icon: User,
                emoji: "👤"
            },
            {
                name: "What-Agent",
                url: "https://chatgpt.com/g/g-67a1463cdd8481919717cf106e8b1152-what-agent",
                exampleUrl: "https://chatgpt.com/share/6861308a-3f1c-8009-a216-85d3ee29f41b",
                description: "Takes 'What is X?' questions and creates consistent 8-sentence explanations with definitions, statistics, quotes, and related entities.",
                fullDescription: [
                    "Creating consistent 8-sentence explanations",
                    "Including definitions and core concepts",
                    "Adding relevant statistics and data",
                    "Incorporating expert quotes when available",
                    "Linking to related entities and concepts"
                ],
                useCases: ["Concept glossaries", "Onboarding & training", "Documentation", "Marketing & SEO glossaries", "Educational content"],
                requiredInput: [
                    "A 'What is X?' question",
                    "e.g., 'What is Technical SEO?'",
                    "Optional: target audience level (beginner, expert)",
                    "Optional: industry or domain context"
                ],
                icon: FileQuestion,
                emoji: "❔"
            },
            {
                name: "Information Graph Creator with Variables (Legal)",
                url: "https://chatgpt.com/g/g-68cd4244c1f88191862ec91cf1995d87-information-graph-creator-with-variables-legal",
                exampleUrl: "https://chatgpt.com/share/696e5227-f3b8-8007-adbd-fbc4aae5d68a",
                description: "Analyzes legal documents and builds arrow-based entity-relationship maps capturing central entities, connections, and missing variables.",
                fullDescription: [
                    "Analyzing legal documents for entity relationships",
                    "Building arrow-based entity-relationship maps",
                    "Capturing central entities and their connections",
                    "Identifying missing variables and gaps",
                    "Visual representation of document structure"
                ],
                useCases: ["Content modeling", "Information architecture", "Gap analysis", "Knowledge graph design", "Legal document analysis"],
                requiredInput: [
                    "Legal documents or contracts",
                    "Terms and conditions",
                    "Policy documents",
                    "Compliance requirements",
                    "Any structured or semi-structured legal text"
                ],
                icon: Scale,
                emoji: "⚖️"
            },
            {
                name: "Irrelevant Attribute Auditor",
                url: "https://chatgpt.com/g/g-vmLdcF72R-irrelevant-attribute-auditor",
                exampleUrl: "https://chatgpt.com/share/696e5079-8c28-8007-96e5-d543ab299cd8",
                description: "Scans lists of entities and their attributes, deciding which attributes are actually relevant and flagging sensitive or unnecessary ones.",
                fullDescription: [
                    "Identifying when demographic attributes are irrelevant",
                    "Flagging sensitive or unnecessary attributes",
                    "Separating business-relevant from distracting attributes",
                    "Scoring relevance of each entity-attribute pair",
                    "Generating structured relevance tables"
                ],
                useCases: ["Data cleaning", "Bias auditing", "ML feature review", "Form & survey design", "HR and hiring audits"],
                requiredInput: [
                    "Tables with rows = entities and columns = attributes",
                    "Bullet lists of entities and their attributes",
                    "JSON-like or schema-like entity descriptions",
                    "Documentation listing fields collected"
                ],
                icon: XCircle,
                emoji: "❌"
            }
        ]
    },
    {
        category: "Topicality, Authority & Coverage Analysis",
        description: "GPT's designed to evaluate topic alignment, completeness, and authority",
        icon: Target,
        color: "amber",
        agents: [
            {
                name: "Topicality Scorer",
                url: "https://chatgpt.com/g/g-rMSJ0YQ5R-topicality-scorer",
                exampleUrl: "https://chatgpt.com/share/6860423d-6690-8009-a4b3-66cedc563030",
                description: "Reads a paragraph and evaluates how relevant it is to different topics by scoring each topic's connection with contextual phrases and related entities.",
                fullDescription: [
                    "Evaluating paragraph relevance to multiple topics",
                    "Scoring each topic's connection with contextual phrases",
                    "Identifying related entities to support scoring",
                    "Comparative topicality analysis across topics",
                    "Structured output with scores and explanations"
                ],
                useCases: ["SEO content auditing", "Content planning", "Competitor analysis", "Brief validation", "Topical alignment"],
                requiredInput: [
                    "A paragraph or text to analyze",
                    "List of topics to score against",
                    "Optional: target keyword or main topic",
                    "Optional: context about the page or site"
                ],
                icon: Target,
                emoji: "🎯"
            },
            {
                name: "Bridge Topic Suggester",
                url: "https://chatgpt.com/g/g-mwMdydt0B-bridge-topic-suggester",
                exampleUrl: "https://chatgpt.com/share/685fa7e2-8628-8009-8823-3f29606a6394",
                description: "Analyzes website title tags and URL structures to uncover topical gaps and propose new, relevant topics with SEO-friendly URLs.",
                fullDescription: [
                    "Analyzing website title tags and URL structures",
                    "Uncovering topical gaps in existing content",
                    "Proposing new, relevant topics to bridge gaps",
                    "Generating SEO-friendly URL suggestions",
                    "Supporting topical authority and content expansion"
                ],
                useCases: ["Topical gap analysis", "Content expansion", "Site architecture planning", "Internal linking strategy", "Content roadmap"],
                requiredInput: [
                    "List of title tags from your site",
                    "URL structures from your site",
                    "Optional: competitor title tags and URLs",
                    "Optional: target niche or industry"
                ],
                icon: Route,
                emoji: "🌉"
            },
            {
                name: "Topic Clusterer",
                url: "https://chatgpt.com/g/g-kZcx3WcNd-topic-clusterer",
                exampleUrl: "https://chatgpt.com/share/696e8872-3de0-8007-a2c6-02235afe325a",
                description: "Takes keyword lists and automatically builds topical clusters with visualizations based on semantic similarity and search behavior.",
                fullDescription: [
                    "Building topical clusters from keyword lists",
                    "Using semantic similarity to group keywords",
                    "Creating visualizations of cluster relationships",
                    "Considering search behavior patterns",
                    "Supporting content silo and hub-spoke structures"
                ],
                useCases: ["Keyword research organization", "Topical authority planning", "Content silo structure", "Intent-based strategy", "Cluster visualization"],
                requiredInput: [
                    "Keyword lists (CSV, text, or pasted)",
                    "Optional: search volume or difficulty data",
                    "Optional: target topic or main keyword",
                    "Optional: number of desired clusters"
                ],
                icon: ListTree,
                emoji: "🌳"
            },
            {
                name: "Query Term Weight Calculator",
                url: "https://chatgpt.com/g/g-V9W7h1wlU-query-term-weight-calculator",
                exampleUrl: "https://chatgpt.com/share/68604373-9780-8009-84ff-2dd55ce33b98",
                description: "Analyzes search queries and computes how important each term is under different processing methods (lexical and BERT-based).",
                fullDescription: [
                    "Computing term importance for search queries",
                    "Using lexical and BERT-based processing methods",
                    "Comparative weight analysis across methods",
                    "Identifying which terms matter most for ranking",
                    "Supporting query expansion and optimization"
                ],
                useCases: ["Query intent analysis", "SEO keyword prioritization", "Query expansion", "Content strategy & briefs", "Term importance ranking"],
                requiredInput: [
                    "A search query or list of queries",
                    "Optional: target page or content context",
                    "Optional: industry or niche context",
                    "Optional: specific analysis method preference"
                ],
                icon: Calculator,
                emoji: "🧮"
            },
            {
                name: "Title-Query Coverage Ratio Auditor",
                url: "https://chatgpt.com/g/g-ZIbgBUInP-title-query-coverage-ratio-auditor",
                exampleUrl: "https://chatgpt.com/share/6862e8ef-db14-8009-a7e3-1bb04a29d2dd",
                description: "Analyzes SEO spreadsheets and measures how well page titles cover their target queries with coverage ratio calculations.",
                fullDescription: [
                    "Measuring title-to-query coverage ratios",
                    "Analyzing SEO spreadsheets with title and query data",
                    "Calculating coverage percentages and gaps",
                    "Identifying optimization opportunities",
                    "Supporting metadata cleanup and audits"
                ],
                useCases: ["Content audits", "On-page optimization", "Migration QA", "Metadata cleanup", "Title optimization"],
                requiredInput: [
                    "CSV or spreadsheet with page titles and target queries",
                    "GSC export data with queries and pages",
                    "Optional: click/impression data for prioritization",
                    "Optional: target coverage threshold"
                ],
                icon: Ruler,
                emoji: "📏"
            },
            {
                name: "Contextual Vector Sharpener and Aligner",
                url: "https://chatgpt.com/g/g-677cf1dfc514819183f3fb3152a14b32-contextual-vector-sharpener-and-aligner",
                exampleUrl: "https://chatgpt.com/share/6860fc17-917c-8009-888b-dd1051318874",
                description: "Analyzes web page context paragraphs and rewrites them to maximize semantic relevance to target search queries.",
                fullDescription: [
                    "Analyzing context paragraphs for semantic relevance",
                    "Rewriting content to maximize query alignment",
                    "Sharpening semantic vectors for better ranking",
                    "Preserving meaning while improving relevance",
                    "Entity enrichment and topic alignment"
                ],
                useCases: ["SEO intro optimization", "Landing page relevance", "Blog topic focus", "Entity enrichment", "Content rewriting"],
                requiredInput: [
                    "Context paragraph or page intro",
                    "Target search query or keyword",
                    "Optional: page type (blog, product, category)",
                    "Optional: existing entities to preserve"
                ],
                icon: Zap,
                emoji: "⚡"
            },
            {
                name: "Context Paragraph Refresher",
                url: "https://chatgpt.com/g/g-67a142859d808191ba16e6e14116bf66-context-paragraph-refresher",
                exampleUrl: "https://chatgpt.com/share/68619e0c-f5d4-8009-9f3c-8c7c6686c168",
                description: "Revises existing text to become more context-rich and expert-level with definitions, statistics, expert quotes, and named entities.",
                fullDescription: [
                    "Enriching text with definitions and context",
                    "Adding relevant statistics and data points",
                    "Incorporating expert quotes when appropriate",
                    "Inserting named entities for topical depth",
                    "Elevating content to expert-level quality"
                ],
                useCases: ["SEO content refinement", "Landing page optimization", "B2B/technical content", "Academic-style overviews", "E-E-A-T enhancement"],
                requiredInput: [
                    "Paragraph or text to refresh",
                    "Target topic or keyword",
                    "Optional: desired tone (professional, academic, casual)",
                    "Optional: specific entities or experts to include"
                ],
                icon: RefreshCw,
                emoji: "🔄"
            }
        ]
    },
    {
        category: "Sentiment, Opinion & Comment Processing",
        description: "GPT's focused on opinions, tone, and sentiment optimization",
        icon: MessageSquare,
        color: "pink",
        agents: [
            {
                name: "Comment Creator (Pros, Cons, Sentiments)",
                url: "https://chatgpt.com/g/g-IjyLmgXzO-comment-creator-pros-cons-sentiments",
                exampleUrl: "https://chatgpt.com/share/68603faf-d0d8-8009-8591-106d0098bf9c",
                description: "Analyzes multiple customer comments and generates structured sentiment summaries with pros, cons, and recurring themes.",
                fullDescription: [
                    "Analyzing multiple customer comments and reviews",
                    "Generating structured sentiment summaries",
                    "Extracting pros and cons from reviews",
                    "Identifying recurring themes across comments",
                    "Supporting product comparison and optimization"
                ],
                useCases: ["Review mining", "Product comparison support", "E-commerce optimization", "Feature prioritization", "Voice of customer analysis"],
                requiredInput: [
                    "Multiple customer comments or reviews",
                    "Product or service name",
                    "Optional: specific aspects to analyze",
                    "Optional: comparison products"
                ],
                icon: MessageCircle,
                emoji: "💬"
            },
            {
                name: "Comment Sentiment Optimizer",
                url: "https://chatgpt.com/g/g-dALg8sDMD-comment-sentiment-optimizer",
                exampleUrl: "https://chatgpt.com/share/696e8931-e838-8007-809a-ea617d912797",
                description: "Transforms reviews by softening emotional extremes and amplifying constructive positivity, with detailed comparison tables.",
                fullDescription: [
                    "Softening emotional extremes in reviews",
                    "Amplifying constructive positivity",
                    "Generating detailed before/after comparison tables",
                    "Preserving authentic voice while improving tone",
                    "Supporting reputation management"
                ],
                useCases: ["Review rewriting", "Reputation management", "Comment polishing", "Support scripts", "Social media moderation"],
                requiredInput: [
                    "Review or comment to optimize",
                    "Optional: desired tone direction",
                    "Optional: specific issues to address",
                    "Optional: brand voice guidelines"
                ],
                icon: Heart,
                emoji: "❤️"
            }
        ]
    },
    {
        category: "SEO, Search Quality & Google Policy Auditing",
        description: "GPT's that analyze content against search engine quality guidelines and policies",
        icon: Shield,
        color: "red",
        agents: [
            {
                name: "HCU Auditor",
                url: "https://chatgpt.com/g/g-x0aRhKXDZ-hcu-auditor",
                exampleUrl: "https://chatgpt.com/share/685fa264-2340-8009-81f7-000e926b338f",
                description: "Evaluates content against helpfulness, quality, originality, and trust criteria with scored tables checking for original reporting, substantial coverage, and more.",
                fullDescription: [
                    "Evaluating content against helpfulness criteria",
                    "Checking quality, originality, and trust signals",
                    "Scoring for original reporting and substantial coverage",
                    "Identifying AI-generated content patterns",
                    "Structured tables with detailed scores"
                ],
                useCases: ["Content quality checks", "SEO content audits", "Originality review", "AI-content screening", "HCU recovery planning"],
                requiredInput: [
                    "Content to audit (blog post, landing page)",
                    "Optional: target keyword or topic",
                    "Optional: comparison to competitor content",
                    "Optional: specific criteria to focus on"
                ],
                icon: ShieldCheck,
                emoji: "✅"
            },
            {
                name: "Quality Update Auditor",
                url: "https://chatgpt.com/g/g-ryDwHihx9-quality-update-auditor",
                exampleUrl: "https://chatgpt.com/share/696e8b33-c124-8007-ad93-acea162339e2",
                description: "Analyzes how Google updates affect website traffic, mapping data to specific updates with visualizations and impact analysis.",
                fullDescription: [
                    "Mapping traffic changes to specific Google updates",
                    "Creating visualizations of update impacts",
                    "Analyzing patterns in traffic forensics",
                    "Identifying recovery opportunities",
                    "Historical update impact comparison"
                ],
                useCases: ["Traffic forensics", "Update impact analysis", "Visual reporting", "Recovery diagnostics", "Client communication"],
                requiredInput: [
                    "Traffic data (GSC, GA export)",
                    "Date range covering update periods",
                    "Optional: specific updates to analyze",
                    "Optional: site sections or URL patterns"
                ],
                icon: TrendingUp,
                emoji: "📈"
            },
            {
                name: "Spam Hit Detector",
                url: "https://chatgpt.com/g/g-5DyGVjt1E-spam-hit-detector",
                exampleUrl: "https://chatgpt.com/share/68603d54-51b4-8009-913f-e20aaa974406",
                description: "Analyzes SEO traffic data from CSV files to detect whether a website was hit by specific Google spam or link spam updates.",
                fullDescription: [
                    "Detecting spam and link spam update impacts",
                    "Analyzing traffic patterns from CSV exports",
                    "Identifying specific update hit signatures",
                    "Supporting recovery tracking over time",
                    "Client-ready reporting format"
                ],
                useCases: ["Traffic forensics", "Ranking loss analysis", "Client reporting", "Recovery tracking", "Penalty diagnosis"],
                requiredInput: [
                    "SEO traffic data (CSV export)",
                    "Date range covering suspected impact",
                    "Optional: GSC performance data",
                    "Optional: specific URL patterns to analyze"
                ],
                icon: Bug,
                emoji: "🐛"
            },
            {
                name: "Publication Frequency Auditor",
                url: "https://chatgpt.com/g/g-VfwPUMo7J-publication-frequency-auditor",
                description: "Reads sitemap CSV files and analyzes how a website publishes content over time with bar charts, pie charts, and URL structure analysis.",
                fullDescription: [
                    "Analyzing publication frequency from sitemaps",
                    "Creating bar charts and pie charts of publishing patterns",
                    "URL structure analysis for content categories",
                    "Editorial calendar insights",
                    "Competitor publication comparison"
                ],
                useCases: ["Content auditing", "Editorial planning", "Site architecture analysis", "Competitor research", "Content velocity tracking"],
                requiredInput: [
                    "Sitemap CSV file with URLs and dates",
                    "Optional: competitor sitemap data",
                    "Optional: specific date range focus",
                    "Optional: content category filters"
                ],
                icon: Calendar,
                emoji: "📅"
            },
            {
                name: "Image Auditor",
                url: "https://chatgpt.com/g/g-d38v2QHzn-image-auditor",
                exampleUrl: "https://chatgpt.com/share/68619d51-d01c-8009-b6b9-c6c68977c127",
                description: "Evaluates images for how well they match a given textual concept, checking visibility, entity identification, and topicality scores.",
                fullDescription: [
                    "Evaluating image-to-concept alignment",
                    "Checking visibility and clarity of subjects",
                    "Identifying entities within images",
                    "Scoring topicality and relevance",
                    "Supporting image optimization for SEO"
                ],
                useCases: ["SEO & content images", "Ad creatives", "E-commerce pages", "Thumbnails & social posts", "Image-text alignment"],
                requiredInput: [
                    "Image to audit (upload or URL)",
                    "Target concept or keyword",
                    "Optional: intended use (hero, thumbnail, product)",
                    "Optional: comparison images"
                ],
                icon: Image,
                emoji: "🖼️"
            }
        ]
    },
    {
        category: "Data, Logs & Performance Analysis",
        description: "GPT's that analyze datasets, logs, metrics, and performance signals",
        icon: BarChart3,
        color: "cyan",
        agents: [
            {
                name: "Data Analyzer (Unique Queries)",
                url: "https://chatgpt.com/g/g-XxVoiB70s-data-analyzer-unique-queries",
                description: "Scans SEO keyword datasets and identifies patterns including query lengths, unique company names, correlations, and question words.",
                fullDescription: [
                    "Scanning SEO keyword datasets for patterns",
                    "Analyzing query lengths and structures",
                    "Identifying unique company names and brands",
                    "Finding correlations between query properties",
                    "Extracting question words and FAQ opportunities"
                ],
                useCases: ["Keyword research", "Competitor gap analysis", "Intent & topic mapping", "Question & FAQ discovery", "Pattern recognition"],
                requiredInput: [
                    "Keyword dataset (CSV or exported data)",
                    "Optional: search volume and difficulty metrics",
                    "Optional: competitor keywords",
                    "Optional: specific patterns to look for"
                ],
                icon: LineChart,
                emoji: "📉"
            },
            {
                name: "Log File Analyzer",
                url: "https://chatgpt.com/g/g-jpP44o5kg-log-file-analyzer",
                description: "Processes crawl log files and highlights how Googlebot discovers your site with referrer URL visualizations and frequency tables.",
                fullDescription: [
                    "Processing crawl log files for insights",
                    "Highlighting Googlebot discovery patterns",
                    "Creating referrer URL visualizations",
                    "Generating crawl frequency tables",
                    "Internal linking effectiveness analysis"
                ],
                useCases: ["Crawl behavior analysis", "Internal linking evaluation", "Content discovery insights", "Crawl optimization planning", "Bot behavior tracking"],
                requiredInput: [
                    "Server log files with Googlebot requests",
                    "Optional: specific URL patterns to analyze",
                    "Optional: date range for analysis",
                    "Optional: comparison to previous periods"
                ],
                icon: FileText,
                emoji: "📝"
            },
            {
                name: "Outranking Cost Calculator",
                url: "https://chatgpt.com/g/g-mVKmi9tYN-outranking-cost-calculator",
                description: "Analyzes competitor SEO datasets and visualizes how difficult and costly it may be to outrank competitors using multiple metrics.",
                fullDescription: [
                    "Analyzing competitor SEO datasets",
                    "Visualizing difficulty and cost to outrank",
                    "Using multiple metrics for calculation",
                    "Supporting SEO budgeting decisions",
                    "Opportunity mapping and prioritization"
                ],
                useCases: ["Competitor analysis", "SEO budgeting", "Opportunity mapping", "Client pitches & reporting", "ROI forecasting"],
                requiredInput: [
                    "Competitor SEO data (backlinks, DR, traffic)",
                    "Target keywords or rankings",
                    "Optional: your current metrics for comparison",
                    "Optional: budget constraints"
                ],
                icon: DollarSign,
                emoji: "💰"
            },
            {
                name: "Backlink Analyzer",
                url: "https://chatgpt.com/g/g-ZKfSmSSk9-backlink-analyzer",
                description: "Compares two websites' backlink profiles with DR bin visualizations, traffic correlations, and written comparison summaries.",
                fullDescription: [
                    "Comparing two websites' backlink profiles",
                    "Creating DR bin visualizations",
                    "Analyzing traffic correlations with links",
                    "Generating written comparison summaries",
                    "Authority growth tracking insights"
                ],
                useCases: ["Competitor backlink analysis", "Link-building prioritization", "Authority growth tracking", "SEO reporting", "Gap identification"],
                requiredInput: [
                    "Backlink data for two websites",
                    "Export from Ahrefs, Moz, or similar tools",
                    "Optional: specific metrics to focus on",
                    "Optional: historical data for trends"
                ],
                icon: Link,
                emoji: "🔗"
            }
        ]
    },
    {
        category: "Content Structure, Summarization & Safety",
        description: "GPT's that organize, condense, validate, or sanitize content",
        icon: FileText,
        color: "teal",
        agents: [
            {
                name: "Key Fact Summarizer",
                url: "https://chatgpt.com/g/g-fVqF9kdKY-key-fact-summarizer",
                description: "Analyzes texts and extracts structured critical information, ranking factual statements by prominence with named entities and attributes.",
                fullDescription: [
                    "Extracting structured critical information from texts",
                    "Ranking factual statements by prominence",
                    "Identifying named entities and their attributes",
                    "Supporting content briefing and research",
                    "Competitive analysis fact extraction"
                ],
                useCases: ["SEO content analysis", "Entity & attribute mapping", "Content briefing", "Competitive research", "Key fact extraction"],
                requiredInput: [
                    "Text to analyze (article, page, document)",
                    "Optional: specific topics or entities to focus on",
                    "Optional: number of key facts to extract",
                    "Optional: output format preference"
                ],
                icon: ClipboardList,
                emoji: "📋"
            },
            {
                name: "Safe Answer Generator",
                url: "https://chatgpt.com/g/g-YZRY831A5-safe-answer-generator",
                description: "Analyzes questions from multiple expert angles (customer, researcher, manufacturer) and provides rich, safe, structured explanations.",
                fullDescription: [
                    "Analyzing questions from multiple expert perspectives",
                    "Customer, researcher, and manufacturer viewpoints",
                    "Providing rich, safe, structured explanations",
                    "Supporting stakeholder communication",
                    "Educational and training content"
                ],
                useCases: ["Multi-angle SEO analysis", "Strategy decision support", "Stakeholder communication", "Educational use", "Safe content generation"],
                requiredInput: [
                    "Question to analyze and answer",
                    "Optional: specific perspectives to include",
                    "Optional: target audience",
                    "Optional: constraints or guidelines"
                ],
                icon: Shield,
                emoji: "🛡️"
            },
            {
                name: "Footer Link Suggester",
                url: "https://chatgpt.com/g/g-47xJT89HP-footer-link-suggester",
                description: "Analyzes page-level metadata and content to propose SEO-friendly footer structures with 5 primary columns and contextual anchor texts.",
                fullDescription: [
                    "Analyzing page-level metadata and content",
                    "Proposing SEO-friendly footer structures",
                    "Creating 5 primary column layouts",
                    "Generating contextual anchor texts",
                    "Supporting topical authority and navigation"
                ],
                useCases: ["Footer architecture", "Internal linking", "Topical authority", "Redesign/migrations", "Site navigation"],
                requiredInput: [
                    "Current footer content or sitemap",
                    "Page metadata and structure",
                    "Optional: target keywords or topics",
                    "Optional: competitor footer examples"
                ],
                icon: Link2,
                emoji: "🔗"
            }
        ]
    },
    {
        category: "Technical / Structured Output Generators",
        description: "GPT's that generate strictly formatted, schema-driven, or machine-readable outputs",
        icon: Code,
        color: "violet",
        agents: [
            {
                name: "Semantic HTML Math Formula Creator",
                url: "https://chatgpt.com/g/g-B3zBTyda3-semantic-html-math-formula-creator",
                description: "Converts mathematical formulas into semantic HTML using the <math> element with proper operators, fractions, roots, and matrices.",
                fullDescription: [
                    "Converting mathematical formulas to semantic HTML",
                    "Using proper <math> element structure",
                    "Supporting operators, fractions, roots, and matrices",
                    "Ensuring accessibility compliance",
                    "SEO-optimized mathematical content"
                ],
                useCases: ["Equation publishing", "Accessibility", "SEO optimization", "Educational content", "Technical documentation"],
                requiredInput: [
                    "Mathematical formula (LaTeX, text, or description)",
                    "Optional: specific output format preferences",
                    "Optional: accessibility requirements",
                    "Optional: styling preferences"
                ],
                icon: Code,
                emoji: "💻"
            },
            {
                name: "Product Specs Generator",
                url: "https://chatgpt.com/g/g-oc5hraOuK-product-specs-generator",
                description: "Analyzes products and transforms them into structured lists of 40+ specifications ordered by decision-making importance with definitions and measurement methods.",
                fullDescription: [
                    "Generating 40+ structured product specifications",
                    "Ordering specs by decision-making importance",
                    "Including definitions and measurement methods",
                    "Supporting buyer guides and comparisons",
                    "E-commerce optimization ready"
                ],
                useCases: ["Product research", "Buyer guides", "E-commerce optimization", "Product management", "Comparison pages"],
                requiredInput: [
                    "Product name or type",
                    "Optional: specific category or niche",
                    "Optional: number of specs to generate",
                    "Optional: focus areas (technical, usability, etc.)"
                ],
                icon: Package,
                emoji: "📦"
            }
        ]
    }
];

// Color mapping for categories — dark theme
const CATEGORY_COLORS = {
    indigo: { bg: "from-indigo-500 to-indigo-600", light: "from-indigo-500/10 to-transparent", border: "border-indigo-500/30", text: "text-indigo-300", badge: "bg-indigo-500/15 text-indigo-300" },
    purple: { bg: "from-purple-500 to-purple-600", light: "from-purple-500/10 to-transparent", border: "border-purple-500/30", text: "text-purple-300", badge: "bg-purple-500/15 text-purple-300" },
    emerald: { bg: "from-emerald-500 to-emerald-600", light: "from-emerald-500/10 to-transparent", border: "border-emerald-500/30", text: "text-emerald-300", badge: "bg-emerald-500/15 text-emerald-300" },
    amber: { bg: "from-amber-500 to-amber-600", light: "from-amber-500/10 to-transparent", border: "border-amber-500/30", text: "text-amber-300", badge: "bg-amber-500/15 text-amber-300" },
    pink: { bg: "from-pink-500 to-pink-600", light: "from-pink-500/10 to-transparent", border: "border-pink-500/30", text: "text-pink-300", badge: "bg-pink-500/15 text-pink-300" },
    red: { bg: "from-red-500 to-red-600", light: "from-red-500/10 to-transparent", border: "border-red-500/30", text: "text-red-300", badge: "bg-red-500/15 text-red-300" },
    cyan: { bg: "from-cyan-500 to-cyan-600", light: "from-cyan-500/10 to-transparent", border: "border-cyan-500/30", text: "text-cyan-300", badge: "bg-cyan-500/15 text-cyan-300" },
    teal: { bg: "from-teal-500 to-teal-600", light: "from-teal-500/10 to-transparent", border: "border-teal-500/30", text: "text-teal-300", badge: "bg-teal-500/15 text-teal-300" },
    violet: { bg: "from-violet-500 to-violet-600", light: "from-violet-500/10 to-transparent", border: "border-violet-500/30", text: "text-violet-300", badge: "bg-violet-500/15 text-violet-300" }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AIAgentsPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(
        AI_AGENTS_DATA.reduce((acc, cat, idx) => ({ ...acc, [idx]: true }), {})
    );
    const [expandedAgents, setExpandedAgents] = useState({});

    const toggleAgent = (categoryIdx, agentIdx) => {
        const key = `${categoryIdx}-${agentIdx}`;
        setExpandedAgents(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleCategory = (index) => {
        setExpandedCategories(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const expandAll = () => {
        setExpandedCategories(AI_AGENTS_DATA.reduce((acc, _, idx) => ({ ...acc, [idx]: true }), {}));
    };

    const collapseAll = () => {
        setExpandedCategories(AI_AGENTS_DATA.reduce((acc, _, idx) => ({ ...acc, [idx]: false }), {}));
    };

    // Filter agents based on search
    const filteredCategories = AI_AGENTS_DATA.map(category => ({
        ...category,
        agents: category.agents.filter(agent =>
            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.useCases.some(uc => uc.toLowerCase().includes(searchQuery.toLowerCase())) ||
            category.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.agents.length > 0);

    const totalAgents = AI_AGENTS_DATA.reduce((sum, cat) => sum + cat.agents.length, 0);
    const filteredAgentsCount = filteredCategories.reduce((sum, cat) => sum + cat.agents.length, 0);

    return (
        <div className="p-3 md:p-6">
            <div className="max-w-7xl mx-auto">
            {/* Animation Keyframes */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Hero Header */}
            <div className="bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-4 md:p-8 text-white mb-6 shadow-xl">
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Bot className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold">AI Agents for SEO</h1>
                        <p className="text-sm md:text-base text-white/70">
                            {totalAgents} powerful AI agents across {AI_AGENTS_DATA.length} categories
                        </p>
                    </div>
                </div>
                <p className="text-white/60 text-sm md:text-base">
                    Enhance your semantic SEO workflow with curated GPT agents. All credits to <span className="text-white font-medium">Koray Tuğberk GÜBÜR</span>
                </p>
            </div>

            <div className="space-y-6">
                {/* Search & Controls */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative flex-1 w-full md:max-w-lg">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search agents by name, category, or use case..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#010409] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 focus:outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/20 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-white/40">
                                {searchQuery ? `${filteredAgentsCount} of ${totalAgents} agents` : `${totalAgents} agents`}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={expandAll}
                                    className="px-3 py-2 text-sm font-medium text-white/40 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors"
                                >
                                    Expand All
                                </button>
                                <button
                                    onClick={collapseAll}
                                    className="px-3 py-2 text-sm font-medium text-white/40 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors"
                                >
                                    Collapse All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Categories */}
                {filteredCategories.map((category, catIdx) => {
                    const originalIndex = AI_AGENTS_DATA.findIndex(c => c.category === category.category);
                    const colors = CATEGORY_COLORS[category.color];
                    const IconComponent = category.icon;

                    return (
                        <section key={category.category} className="rounded-2xl border border-white/[0.08] bg-[#0d1117] overflow-hidden hover:border-white/[0.12] transition-all">
                            <button
                                onClick={() => toggleCategory(originalIndex)}
                                className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.04] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 bg-gradient-to-br ${colors.bg} rounded-xl shadow-lg`}>
                                        <IconComponent className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl font-semibold text-white/90">{category.category}</h2>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                                                {category.agents.length} agents
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/40">{category.description}</p>
                                    </div>
                                </div>
                                <div className="p-2 rounded-full bg-white/[0.06]">
                                    {expandedCategories[originalIndex] ? (
                                        <ChevronUp className="w-5 h-5 text-white/40" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-white/40" />
                                    )}
                                </div>
                            </button>

                            {expandedCategories[originalIndex] && (
                                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {category.agents.map((agent, agentIdx) => {
                                        const agentKey = `${originalIndex}-${agentIdx}`;
                                        const isExpanded = expandedAgents[agentKey];

                                        return (
                                            <div
                                                key={agentIdx}
                                                className={`group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300`}
                                                style={{
                                                    animation: `fadeInUp 0.4s ease-out ${agentIdx * 0.05}s both`
                                                }}
                                            >
                                                {/* Card Header */}
                                                <div className={`p-5 bg-gradient-to-br ${colors.light}`}>
                                                    <div className="flex items-start justify-between mb-3">
                                                        {agent.emoji ? (
                                                            <span className="text-3xl drop-shadow-sm">{agent.emoji}</span>
                                                        ) : (
                                                            <div className={`p-2.5 bg-gradient-to-br ${colors.bg} rounded-xl shadow-md`}>
                                                                <Wand2 className="w-5 h-5 text-white" />
                                                            </div>
                                                        )}
                                                        <a
                                                            href={agent.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`p-1.5 rounded-lg hover:bg-white/80 transition-colors`}
                                                        >
                                                            <ExternalLink className={`w-4 h-4 text-stone-400 hover:${colors.text}`} />
                                                        </a>
                                                    </div>
                                                    <h3 className={`font-semibold text-white/90 mb-2 text-lg`}>
                                                        {agent.name}
                                                    </h3>
                                                    <p className="text-sm text-white/50 leading-relaxed">
                                                        {agent.description}
                                                    </p>
                                                </div>

                                                {/* Expandable Content Toggle */}
                                                <button
                                                    onClick={() => toggleAgent(originalIndex, agentIdx)}
                                                    className={`w-full px-5 py-3 flex items-center justify-between text-sm font-medium ${colors.text} bg-white/[0.03] hover:bg-white/[0.06] transition-colors border-t border-white/[0.06]`}
                                                >
                                                    <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] bg-white/[0.02]">

                                                        {/* What it Does Section */}
                                                        {agent.fullDescription && agent.fullDescription.length > 0 && (
                                                            <div className="pt-4">
                                                                <h4 className={`text-sm font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                                                                    <Sparkles className="w-4 h-4" />
                                                                    What It Detects / Does
                                                                </h4>
                                                                <ul className="space-y-1.5">
                                                                    {agent.fullDescription.map((item, idx) => (
                                                                        <li key={idx} className="text-sm text-white/50 flex items-start gap-2">
                                                                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-${category.color}-400 flex-shrink-0`}></span>
                                                                            {item}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Use Cases Section */}
                                                        <div className={agent.fullDescription ? '' : 'pt-4'}>
                                                            <h4 className={`text-sm font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                                                                <Target className="w-4 h-4" />
                                                                Use Cases
                                                            </h4>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {agent.useCases.map((useCase, ucIdx) => (
                                                                    <span
                                                                        key={ucIdx}
                                                                        className={`px-2.5 py-1 bg-white/[0.06] border border-white/[0.1] ${colors.text} text-xs rounded-full`}
                                                                    >
                                                                        {useCase}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Required Input Section */}
                                                        {agent.requiredInput && agent.requiredInput.length > 0 && (
                                                            <div>
                                                                <h4 className={`text-sm font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                                                                    <FileText className="w-4 h-4" />
                                                                    Required Input
                                                                </h4>
                                                                <ul className="space-y-1.5">
                                                                    {agent.requiredInput.map((input, idx) => (
                                                                        <li key={idx} className="text-sm text-white/50 flex items-start gap-2">
                                                                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-${category.color}-400 flex-shrink-0`}></span>
                                                                            {input}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Action Buttons Footer */}
                                                <div className={`flex gap-2 px-5 py-3 bg-white/[0.03] border-t border-white/[0.06]`}>
                                                    {agent.exampleUrl && (
                                                        <a
                                                            href={agent.exampleUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${colors.text} bg-white/[0.06] border ${colors.border} rounded-lg hover:bg-white/[0.1] transition-all duration-200 hover:scale-105`}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            Example
                                                        </a>
                                                    )}
                                                    <a
                                                        href={agent.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gradient-to-r ${colors.bg} rounded-lg hover:shadow-md transition-all duration-200 hover:scale-105 ml-auto`}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        Open Agent
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    );
                })}

                {/* Empty State */}
                {filteredCategories.length === 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-12 text-center">
                        <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white/60 mb-2">No agents found</h3>
                        <p className="text-white/40">Try adjusting your search query</p>
                    </div>
                )}

                {/* Credit Footer */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <Sparkles className="w-5 h-5 text-brand-400" />
                        <span className="text-white font-semibold">All Credits</span>
                        <Sparkles className="w-5 h-5 text-brand-400" />
                    </div>
                    <p className="text-white/40">
                        These AI agents were compiled by{' '}
                        <a
                            href="https://twitter.com/KorayGubur"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                        >
                            Koray Tuğberk GÜBÜR
                        </a>
                    </p>
                </div>
            </div>
            </div>
        </div>
    );
};

export default AIAgentsPage;
