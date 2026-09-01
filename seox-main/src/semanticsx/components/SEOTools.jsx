import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link2, Type, Globe, Hash, Search, Eye, ArrowUpDown, Copy, Check, Trash2, Loader2, ChevronLeft, MapPin, Wrench, X, History, Settings, Map, FileCode, Database, Sparkles, Upload, Gauge, Download } from 'lucide-react';
import SitemapGenerator from './SitemapGenerator';
import RobotsTxtGenerator from './RobotsTxtGenerator';
import { sanitizeRemoteHtml } from '../lib/sanitizeRemoteHtml';
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

// Comprehensive Google Sites list from valentin.app/loc.js
const GOOGLE_SITES = [
    { name: "United States", gl: "US", lang: "English", hl: "en", url: "https://www.google.us/search" },
    { name: "United Kingdom", gl: "GB", lang: "English", hl: "en", url: "https://www.google.co.uk/search" },
    { name: "Japan", gl: "JP", lang: "日本語", hl: "ja", url: "https://www.google.jp/search" },
    { name: "Australia", gl: "AU", lang: "English", hl: "en", url: "https://www.google.com.au/search" },
    { name: "Germany", gl: "DE", lang: "Deutsch", hl: "de", url: "https://www.google.de/search" },
    { name: "Turkey", gl: "TR", lang: "Türkçe", hl: "tr", url: "https://www.google.com.tr/search" },
    { name: "Spain", gl: "ES", lang: "español", hl: "es", url: "https://www.google.es/search" },
    { name: "Canada", gl: "CA", lang: "English", hl: "en", url: "https://www.google.ca/search" },
    { name: "Canada", gl: "CA", lang: "Français", hl: "fr", url: "https://www.google.ca/search" },
    { name: "India", gl: "IN", lang: "English", hl: "en", url: "https://www.google.co.in/search" },
    { name: "India", gl: "IN", lang: "हिन्दी", hl: "hi", url: "https://www.google.co.in/search" },
    { name: "India", gl: "IN", lang: "বাংলা", hl: "bn", url: "https://www.google.co.in/search" },
    { name: "India", gl: "IN", lang: "తెలుగు", hl: "te", url: "https://www.google.co.in/search" },
    { name: "India", gl: "IN", lang: "தமிழ்", hl: "ta", url: "https://www.google.co.in/search" },
    { name: "Italy", gl: "IT", lang: "Italiano", hl: "it", url: "https://www.google.it/search" },
    { name: "Netherlands", gl: "NL", lang: "Nederlands", hl: "nl", url: "https://www.google.nl/search" },
    { name: "France", gl: "FR", lang: "Français", hl: "fr", url: "https://www.google.fr/search" },
    { name: "Austria", gl: "AT", lang: "Deutsch", hl: "de", url: "https://www.google.at/search" },
    { name: "Brazil", gl: "BR", lang: "Português (Brasil)", hl: "pt-BR", url: "https://www.google.com.br/search" },
    { name: "Belgium", gl: "BE", lang: "Nederlands", hl: "nl", url: "https://www.google.be/search" },
    { name: "Belgium", gl: "BE", lang: "Français", hl: "fr", url: "https://www.google.be/search" },
    { name: "Belgium", gl: "BE", lang: "Deutsch", hl: "de", url: "https://www.google.be/search" },
    { name: "Ireland", gl: "IE", lang: "English", hl: "en", url: "https://www.google.ie/search" },
    { name: "Afghanistan", gl: "AF", lang: "پښتو", hl: "ps", url: "https://www.google.com.af/search" },
    { name: "Afghanistan", gl: "AF", lang: "فارسی", hl: "fa", url: "https://www.google.com.af/search" },
    { name: "Albania", gl: "AL", lang: "Shqip", hl: "sq", url: "https://www.google.al/search" },
    { name: "Algeria", gl: "DZ", lang: "Français", hl: "fr", url: "https://www.google.dz/search" },
    { name: "Algeria", gl: "DZ", lang: "العربية", hl: "ar", url: "https://www.google.dz/search" },
    { name: "Argentina", gl: "AR", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.ar/search" },
    { name: "Armenia", gl: "AM", lang: "հdelays", hl: "hy", url: "https://www.google.am/search" },
    { name: "Azerbaijan", gl: "AZ", lang: "Azərbaycan dili", hl: "az", url: "https://www.google.az/search" },
    { name: "Bahrain", gl: "BH", lang: "العربية", hl: "ar", url: "https://www.google.com.bh/search" },
    { name: "Bangladesh", gl: "BD", lang: "বাংলা", hl: "bn", url: "https://www.google.com.bd/search" },
    { name: "Bangladesh", gl: "BD", lang: "English", hl: "en", url: "https://www.google.com.bd/search" },
    { name: "Belarus", gl: "BY", lang: "Беларуская", hl: "be", url: "https://www.google.by/search" },
    { name: "Belarus", gl: "BY", lang: "русский", hl: "ru", url: "https://www.google.by/search" },
    { name: "Bolivia", gl: "BO", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.bo/search" },
    { name: "Bosnia & Herzegovina", gl: "BA", lang: "bosanski", hl: "bs", url: "https://www.google.ba/search" },
    { name: "Bulgaria", gl: "BG", lang: "български", hl: "bg", url: "https://www.google.bg/search" },
    { name: "Cambodia", gl: "KH", lang: "ខ្មែរ", hl: "km", url: "https://www.google.com.kh/search" },
    { name: "Chile", gl: "CL", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.cl/search" },
    { name: "Colombia", gl: "CO", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.co/search" },
    { name: "Costa Rica", gl: "CR", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.co.cr/search" },
    { name: "Croatia", gl: "HR", lang: "hrvatski", hl: "hr", url: "https://www.google.hr/search" },
    { name: "Cyprus", gl: "CY", lang: "Ελληνικά", hl: "el", url: "https://www.google.com.cy/search" },
    { name: "Czechia", gl: "CZ", lang: "čeština", hl: "cs", url: "https://www.google.cz/search" },
    { name: "Denmark", gl: "DK", lang: "Dansk", hl: "da", url: "https://www.google.dk/search" },
    { name: "Dominican Republic", gl: "DO", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.do/search" },
    { name: "Ecuador", gl: "EC", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.ec/search" },
    { name: "Egypt", gl: "EG", lang: "العربية", hl: "ar", url: "https://www.google.com.eg/search" },
    { name: "Egypt", gl: "EG", lang: "English", hl: "en", url: "https://www.google.com.eg/search" },
    { name: "El Salvador", gl: "SV", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.sv/search" },
    { name: "Estonia", gl: "EE", lang: "eesti", hl: "et", url: "https://www.google.ee/search" },
    { name: "Finland", gl: "FI", lang: "suomi", hl: "fi", url: "https://www.google.fi/search" },
    { name: "Georgia", gl: "GE", lang: "ქართული", hl: "ka", url: "https://www.google.ge/search" },
    { name: "Ghana", gl: "GH", lang: "English", hl: "en", url: "https://www.google.com.gh/search" },
    { name: "Greece", gl: "GR", lang: "Ελληνικά", hl: "el", url: "https://www.google.gr/search" },
    { name: "Guatemala", gl: "GT", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.gt/search" },
    { name: "Honduras", gl: "HN", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.hn/search" },
    { name: "Hong Kong", gl: "HK", lang: "中文（繁體）", hl: "zh-TW", url: "https://www.google.hk/search" },
    { name: "Hong Kong", gl: "HK", lang: "English", hl: "en", url: "https://www.google.hk/search" },
    { name: "Hungary", gl: "HU", lang: "magyar", hl: "hu", url: "https://www.google.hu/search" },
    { name: "Iceland", gl: "IS", lang: "íslenska", hl: "is", url: "https://www.google.is/search" },
    { name: "Indonesia", gl: "ID", lang: "Indonesia", hl: "id", url: "https://www.google.co.id/search" },
    { name: "Iraq", gl: "IQ", lang: "العربية", hl: "ar", url: "https://www.google.iq/search" },
    { name: "Israel", gl: "IL", lang: "עברית", hl: "iw", url: "https://www.google.co.il/search" },
    { name: "Jamaica", gl: "JM", lang: "English", hl: "en", url: "https://www.google.com.jm/search" },
    { name: "Jordan", gl: "JO", lang: "العربية", hl: "ar", url: "https://www.google.jo/search" },
    { name: "Kazakhstan", gl: "KZ", lang: "қazaqша", hl: "kk", url: "https://www.google.kz/search" },
    { name: "Kenya", gl: "KE", lang: "English", hl: "en", url: "https://www.google.co.ke/search" },
    { name: "Kuwait", gl: "KW", lang: "العربية", hl: "ar", url: "https://www.google.com.kw/search" },
    { name: "Latvia", gl: "LV", lang: "latviešu", hl: "lv", url: "https://www.google.lv/search" },
    { name: "Lebanon", gl: "LB", lang: "العربية", hl: "ar", url: "https://www.google.com.lb/search" },
    { name: "Libya", gl: "LY", lang: "العربية", hl: "ar", url: "https://www.google.com.ly/search" },
    { name: "Lithuania", gl: "LT", lang: "lietuvių", hl: "lt", url: "https://www.google.lt/search" },
    { name: "Luxembourg", gl: "LU", lang: "Français", hl: "fr", url: "https://www.google.lu/search" },
    { name: "Malaysia", gl: "MY", lang: "English", hl: "en", url: "https://www.google.com.my/search" },
    { name: "Malaysia", gl: "MY", lang: "Melayu", hl: "ms", url: "https://www.google.com.my/search" },
    { name: "Malta", gl: "MT", lang: "English", hl: "en", url: "https://www.google.com.mt/search" },
    { name: "Mexico", gl: "MX", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.mx/search" },
    { name: "Morocco", gl: "MA", lang: "Français", hl: "fr", url: "https://www.google.co.ma/search" },
    { name: "Morocco", gl: "MA", lang: "العربية", hl: "ar", url: "https://www.google.co.ma/search" },
    { name: "Myanmar", gl: "MM", lang: "ဗမာ", hl: "my", url: "https://www.google.com.mm/search" },
    { name: "Nepal", gl: "NP", lang: "नेपाली", hl: "ne", url: "https://www.google.com.np/search" },
    { name: "Nepal", gl: "NP", lang: "English", hl: "en", url: "https://www.google.com.np/search" },
    { name: "New Zealand", gl: "NZ", lang: "English", hl: "en", url: "https://www.google.co.nz/search" },
    { name: "Nicaragua", gl: "NI", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.ni/search" },
    { name: "Nigeria", gl: "NG", lang: "English", hl: "en", url: "https://www.google.com.ng/search" },
    { name: "Norway", gl: "NO", lang: "norsk", hl: "no", url: "https://www.google.no/search" },
    { name: "Oman", gl: "OM", lang: "العربية", hl: "ar", url: "https://www.google.com.om/search" },
    { name: "Pakistan", gl: "PK", lang: "English", hl: "en", url: "https://www.google.com.pk/search" },
    { name: "Pakistan", gl: "PK", lang: "اردو", hl: "ur", url: "https://www.google.com.pk/search" },
    { name: "Panama", gl: "PA", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.pa/search" },
    { name: "Paraguay", gl: "PY", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.py/search" },
    { name: "Peru", gl: "PE", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.pe/search" },
    { name: "Philippines", gl: "PH", lang: "English", hl: "en", url: "https://www.google.com.ph/search" },
    { name: "Philippines", gl: "PH", lang: "Filipino", hl: "tl", url: "https://www.google.com.ph/search" },
    { name: "Poland", gl: "PL", lang: "polski", hl: "pl", url: "https://www.google.pl/search" },
    { name: "Portugal", gl: "PT", lang: "Português (Portugal)", hl: "pt-PT", url: "https://www.google.pt/search" },
    { name: "Puerto Rico", gl: "PR", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.pr/search" },
    { name: "Qatar", gl: "QA", lang: "العربية", hl: "ar", url: "https://www.google.com.qa/search" },
    { name: "Romania", gl: "RO", lang: "Română", hl: "ro", url: "https://www.google.ro/search" },
    { name: "Russia", gl: "RU", lang: "русский", hl: "ru", url: "https://www.google.ru/search" },
    { name: "Saudi Arabia", gl: "SA", lang: "العربية", hl: "ar", url: "https://www.google.com.sa/search" },
    { name: "Senegal", gl: "SN", lang: "Français", hl: "fr", url: "https://www.google.sn/search" },
    { name: "Serbia", gl: "RS", lang: "српски", hl: "sr", url: "https://www.google.rs/search" },
    { name: "Singapore", gl: "SG", lang: "English", hl: "en", url: "https://www.google.com.sg/search" },
    { name: "Singapore", gl: "SG", lang: "中文(简体)", hl: "zh-CN", url: "https://www.google.com.sg/search" },
    { name: "Slovakia", gl: "SK", lang: "slovenčina", hl: "sk", url: "https://www.google.sk/search" },
    { name: "Slovenia", gl: "SI", lang: "slovenščina", hl: "sl", url: "https://www.google.si/search" },
    { name: "South Africa", gl: "ZA", lang: "English", hl: "en", url: "https://www.google.co.za/search" },
    { name: "South Korea", gl: "KR", lang: "한국어", hl: "ko", url: "https://www.google.co.kr/search" },
    { name: "Sri Lanka", gl: "LK", lang: "English", hl: "en", url: "https://www.google.lk/search" },
    { name: "Sweden", gl: "SE", lang: "svenska", hl: "sv", url: "https://www.google.se/search" },
    { name: "Switzerland", gl: "CH", lang: "Deutsch", hl: "de", url: "https://www.google.ch/search" },
    { name: "Switzerland", gl: "CH", lang: "Français", hl: "fr", url: "https://www.google.ch/search" },
    { name: "Switzerland", gl: "CH", lang: "Italiano", hl: "it", url: "https://www.google.ch/search" },
    { name: "Taiwan", gl: "TW", lang: "中文（繁體）", hl: "zh-TW", url: "https://www.google.com.tw/search" },
    { name: "Tanzania", gl: "TZ", lang: "English", hl: "en", url: "https://www.google.co.tz/search" },
    { name: "Thailand", gl: "TH", lang: "ไทย", hl: "th", url: "https://www.google.co.th/search" },
    { name: "Tunisia", gl: "TN", lang: "Français", hl: "fr", url: "https://www.google.tn/search" },
    { name: "Tunisia", gl: "TN", lang: "العربية", hl: "ar", url: "https://www.google.tn/search" },
    { name: "United Arab Emirates", gl: "AE", lang: "العربية", hl: "ar", url: "https://www.google.ae/search" },
    { name: "United Arab Emirates", gl: "AE", lang: "فارسی", hl: "fa", url: "https://www.google.ae/search" },
    { name: "United Arab Emirates", gl: "AE", lang: "English", hl: "en", url: "https://www.google.ae/search" },
    { name: "United Arab Emirates", gl: "AE", lang: "हिन्दी", hl: "hi", url: "https://www.google.ae/search" },
    { name: "United Arab Emirates", gl: "AE", lang: "اردو", hl: "ur", url: "https://www.google.ae/search" },
    { name: "Uganda", gl: "UG", lang: "English", hl: "en", url: "https://www.google.co.ug/search" },
    { name: "Ukraine", gl: "UA", lang: "українська", hl: "uk", url: "https://www.google.com.ua/search" },
    { name: "Ukraine", gl: "UA", lang: "русский", hl: "ru", url: "https://www.google.com.ua/search" },
    { name: "Uruguay", gl: "UY", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.com.uy/search" },
    { name: "Uzbekistan", gl: "UZ", lang: "o'zbek", hl: "uz", url: "https://www.google.co.uz/search" },
    { name: "Venezuela", gl: "VE", lang: "Español (Latinoamérica)", hl: "es-419", url: "https://www.google.co.ve/search" },
    { name: "Vietnam", gl: "VN", lang: "Tiếng Việt", hl: "vi", url: "https://www.google.com.vn/search" },
    { name: "Zimbabwe", gl: "ZW", lang: "English", hl: "en", url: "https://www.google.co.zw/search" }
];

// UULE generation algorithm from valentin.app/loc.js
const genGeoCode = (latitude, longitude) => {
    const lat = Math.round(1E7 * parseFloat(latitude));
    const lng = Math.round(1E7 * parseFloat(longitude));
    const now = new Date().getTime();
    const radius = 150 * 620; // 93000 meters
    const timestamp = String(1E3 * Number(now));

    const parts = [
        "role:", 1,
        "\nproducer:", 12,
        "\nprovenance:", 6,
        "\ntimestamp:", timestamp,
        "\nlatlng{\nlatitude_e7:", lat,
        "\nlongitude_e7:", lng,
        "\n}\nradius:", radius
    ];

    const encoded = btoa(parts.join("")).replace(/\+/g, "-").replace(/\//g, "_");
    return 'a ' + encoded;
};

const SEOTools = ({ defaultTab }) => {
    const { toolId } = useParams();
    const navigate = useNavigate();

    // Tool ID to URL slug mapping
    const toolSlugMap = {
        'url': 'url-editor',
        'text': 'text-editor',
        'domain': 'domain-separator',
        'word': 'word-counter',
        'bot': 'bot-viewer',
        'dapa': 'dapa-checker',
        'dr': 'bulk-dr-checker',
        'sitemap': 'sitemap-generator',
        'robotstxt': 'robots-txt-generator',
        'xmlextract': 'xml-sitemap-extractor',
        'bulkextract': 'bulk-meta-extractor',
        'aientities': 'ai-keyword-entities',
        'serp': 'serp-checker'
    };

    const slugToToolMap = Object.fromEntries(
        Object.entries(toolSlugMap).map(([k, v]) => [v, k])
    );

    // Initialize active tool from URL or defaultTab prop
    const [activeTool, setActiveTool] = useState(() => {
        if (toolId && slugToToolMap[toolId]) {
            return slugToToolMap[toolId];
        }
        if (defaultTab) {
            return defaultTab;
        }
        return null;
    });

    // Sync URL when tool changes
    const selectTool = (id) => {
        setActiveTool(id);
        if (id && toolSlugMap[id]) {
            navigate(`/seo-tools/${toolSlugMap[id]}`);
        }
    };

    // Go back to tool list
    const goBack = () => {
        setActiveTool(null);
        navigate('/seo-tools/seo-tools');
    };

    const [copiedSection, setCopiedSection] = useState(null);
    const [operationMessage, setOperationMessage] = useState('');

    // Inline autocomplete state (for Tab-to-accept feature)
    const [inlineSuggestion, setInlineSuggestion] = useState('');

    const showMessage = (msg) => { setOperationMessage(msg); setTimeout(() => setOperationMessage(''), 3000); };
    const copyToClipboard = (text, section) => { navigator.clipboard.writeText(text); setCopiedSection(section); setTimeout(() => setCopiedSection(null), 2000); };

    // URL Editor
    const [urlInput, setUrlInput] = useState('');
    const urlOps = {
        trimToRoot: () => {
            const urls = urlInput.split('\n').filter(u => u.trim());
            let c = 0;
            const r = urls.map(u => {
                try {
                    let url = u.trim();
                    // Add protocol if missing
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    c++;
                    return new URL(url).origin;
                } catch { return u; }
            }).join('\n');
            setUrlInput(r);
            showMessage(`Trimmed ${c} URLs`);
        },
        removeParams: () => { const urls = urlInput.split('\n').filter(u => u.trim()); let c = 0; const r = urls.map(u => { try { const p = new URL(u.trim()); if (p.search) c++; return p.origin + p.pathname; } catch { return u; } }).join('\n'); setUrlInput(r); showMessage(`Removed params from ${c} URLs`); },
        removeDupes: () => { const urls = urlInput.split('\n').filter(u => u.trim()); const unique = [...new Set(urls)]; showMessage(`Removed ${urls.length - unique.length} duplicates`); setUrlInput(unique.join('\n')); },
        cleanSERP: () => { const urls = urlInput.split('\n').filter(u => u.trim()); let c = 0; const r = urls.map(u => { try { const p = new URL(u.trim()); if (p.hostname.includes('google')) { const up = p.searchParams.get('url') || p.searchParams.get('q'); if (up?.startsWith('http')) { c++; return up; } } c++; return p.origin + p.pathname; } catch { return u; } }).join('\n'); setUrlInput(r); showMessage(`Cleaned ${c} URLs`); },
        removeHash: () => { const urls = urlInput.split('\n').filter(u => u.trim()); const f = urls.filter(u => !u.includes('#')); showMessage(`Removed ${urls.length - f.length} URLs with #`); setUrlInput(f.join('\n')); },
        removeAmp: () => { const urls = urlInput.split('\n').filter(u => u.trim()); const f = urls.filter(u => !u.includes('&')); showMessage(`Removed ${urls.length - f.length} URLs with &`); setUrlInput(f.join('\n')); },
        keepTLD: () => {
            const urls = urlInput.split('\n').filter(u => u.trim());
            let c = 0;
            const r = urls.map(u => {
                try {
                    let url = u.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    const hostname = new URL(url).hostname.replace(/^www\./, '');
                    // Extract TLD (handles multi-part TLDs like .co.uk)
                    const parts = hostname.split('.');
                    if (parts.length >= 2) {
                        // Check for common 2-part TLDs
                        const last2 = parts.slice(-2).join('.');
                        const commonTwoPartTLDs = ['co.uk', 'com.au', 'co.nz', 'org.uk', 'com.br', 'co.in', 'co.jp', 'com.sg', 'com.mx', 'co.za'];
                        if (commonTwoPartTLDs.includes(last2)) {
                            c++;
                            return '.' + last2;
                        }
                        c++;
                        return '.' + parts[parts.length - 1];
                    }
                    return u;
                } catch { return u; }
            }).join('\n');
            setUrlInput(r);
            showMessage(`Extracted TLD from ${c} URLs`);
        }
    };

    // Text Editor
    const [textInput, setTextInput] = useState('');
    const [filterKw, setFilterKw] = useState('');
    const [sep, setSep] = useState(', ');
    const [repWord, setRepWord] = useState('');
    const [addS, setAddS] = useState('');
    const [addE, setAddE] = useState('');
    const textOps = {
        cleanNLP: () => { setTextInput(textInput.replace(/\d+\.\d+/g, '').replace(/salience:|score:|type:/gi, '').replace(/[\[\]\{\}]/g, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim()); showMessage('Cleaned NLP text'); },
        removeDupeLines: () => { const l = textInput.split('\n').filter(x => x.trim()); const u = [...new Set(l)]; showMessage(`Removed ${l.length - u.length} duplicates`); setTextInput(u.join('\n')); },
        removeBrackets: () => { const c = (textInput.match(/[\[\]\(\)\{\}]/g) || []).length; setTextInput(textInput.replace(/[\[\]\(\)\{\}]/g, '')); showMessage(`Removed ${c} brackets`); },
        removeEmpty: () => { const l = textInput.split('\n'); const f = l.filter(x => x.trim()); showMessage(`Removed ${l.length - f.length} empty lines`); setTextInput(f.join('\n')); },
        filterLines: () => { if (!filterKw.trim()) return; const l = textInput.split('\n'); const f = l.filter(x => x.toLowerCase().includes(filterKw.toLowerCase())); showMessage(`Kept ${f.length} lines containing "${filterKw}"`); setTextInput(f.join('\n')); },
        toSingle: () => { const l = textInput.split('\n').filter(x => x.trim()); setTextInput(l.join(' ')); showMessage(`Merged ${l.length} lines`); },
        replaceNL: () => { const l = textInput.split('\n').filter(x => x.trim()); setTextInput(l.join(sep)); showMessage(`Replaced newlines`); },
        replaceWord: () => { if (!repWord.trim()) return; const c = (textInput.match(new RegExp(repWord, 'g')) || []).length; setTextInput(textInput.split(repWord).join('\n')); showMessage(`Replaced ${c} occurrences`); },
        addStart: () => { const l = textInput.split('\n').map(x => addS + x); setTextInput(l.join('\n')); showMessage(`Added prefix to ${l.length} lines`); },
        addEnd: () => { const l = textInput.split('\n').map(x => x + addE); setTextInput(l.join('\n')); showMessage(`Added suffix to ${l.length} lines`); },
        upper: () => { setTextInput(textInput.toUpperCase()); showMessage('Uppercase'); },
        lower: () => { setTextInput(textInput.toLowerCase()); showMessage('Lowercase'); },
        title: () => { setTextInput(textInput.split('\n').map(l => l.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')).join('\n')); showMessage('Title case'); }
    };

    // Domain Separator
    const [domainInput, setDomainInput] = useState('');
    const [filtered, setFiltered] = useState({});
    const filterDomains = () => { const d = domainInput.split('\n').filter(x => x.trim()); const g = {}; d.forEach(dm => { const c = dm.trim().toLowerCase(); const t = '.' + c.split('.').pop(); if (!g[t]) g[t] = []; g[t].push(c); }); setFiltered(g); showMessage(`Grouped ${d.length} domains`); };

    // Word Counter
    const [wcInput, setWcInput] = useState('');
    const wcStats = useMemo(() => { const t = wcInput.trim(); if (!t) return { w: 0, c: 0, s: 0, p: 0, r: '0 min' }; const w = t.split(/\s+/).filter(x => x).length; return { w, c: t.length, s: t.split(/[.!?]+/).filter(x => x.trim()).length, p: t.split(/\n\s*\n/).filter(x => x.trim()).length || 1, r: `${Math.ceil(w / 200)} min` }; }, [wcInput]);

    // Bot Viewer - Mini Browser
    const [botUrl, setBotUrl] = useState('');
    const [bot, setBot] = useState('googlebot');
    const [botRes, setBotRes] = useState(null);
    const [botHtml, setBotHtml] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [showMetadata, setShowMetadata] = useState(false);
    const bots = {
        googlebot: { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
        bingbot: { name: 'Bingbot', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
        facebook: { name: 'Facebook', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
        twitter: { name: 'Twitter', ua: 'Twitterbot/1.0' },
        baidu: { name: 'Baidu', ua: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)' },
        yandex: { name: 'Yandex', ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)' },
        duckduckgo: { name: 'DuckDuckGo', ua: 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)' },
        gptbot: { name: 'GPTBot (OpenAI)', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36 GPTBot/1.0' }
    };
    const fetchBot = async () => {
        if (!botUrl.trim()) return;
        setIsFetching(true);
        setBotRes(null);
        setBotHtml('');
        try {
            // Fetch with bot user-agent via proxy
            const r = await authenticatedFetch(`/api/proxy?url=${encodeURIComponent(botUrl)}&ua=${encodeURIComponent(bots[bot].ua)}`);
            const h = await r.text();

            // Parse for metadata
            const d = new DOMParser().parseFromString(h, 'text/html');
            const m = {};
            d.querySelectorAll('meta').forEach(x => {
                const n = x.getAttribute('name') || x.getAttribute('property');
                const c = x.getAttribute('content');
                if (n && c) m[n] = c;
            });

            setBotRes({
                title: d.querySelector('title')?.textContent || 'No title',
                description: m['description'] || m['og:description'] || 'No description',
                canonical: d.querySelector('link[rel="canonical"]')?.getAttribute('href') || 'None',
                robots: m['robots'] || 'None',
                h1: d.querySelector('h1')?.textContent?.trim() || 'No H1',
                links: d.querySelectorAll('a').length,
                images: d.querySelectorAll('img').length,
                size: (h.length / 1024).toFixed(2) + ' KB'
            });

            setBotHtml(sanitizeRemoteHtml(h, { baseUrl: botUrl }));
        } catch (e) {
            setBotRes({ error: e.message });
        } finally {
            setIsFetching(false);
        }
    };

    // SERP Checker - Enhanced with valentin.app functionality
    const [serpKw, setSerpKw] = useState('');
    const [serpReg, setSerpReg] = useState('United States - English');
    const [serpLoc, setSerpLoc] = useState('');
    const [serpLat, setSerpLat] = useState('37.4210000');
    const [serpLng, setSerpLng] = useState('-122.0840000');
    const [serpHl, setSerpHl] = useState('en');
    const [serpGl, setSerpGl] = useState('US');
    const [serpUrl, setSerpUrl] = useState('https://www.google.com/search');
    const [isGeo, setIsGeo] = useState(false);
    const [regionSearch, setRegionSearch] = useState('');
    const [showRegions, setShowRegions] = useState(false);
    const [locationHistory, setLocationHistory] = useState([]);
    const [showLocHistory, setShowLocHistory] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [kwSuggestions, setKwSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const regionRef = useRef(null);
    const kwInputRef = useRef(null);
    const suggestionsRef = useRef(null);
    const debounceRef = useRef(null);
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    // Load location history from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('serpLocationHistory');
            if (saved) setLocationHistory(JSON.parse(saved));
        } catch (e) { }
    }, []);

    // Save location to history
    const saveToHistory = (lat, lng, name) => {
        const newLoc = { lat, lng, name, timestamp: Date.now() };
        const updated = [newLoc, ...locationHistory.filter(l => l.name !== name)].slice(0, 10);
        setLocationHistory(updated);
        try { localStorage.setItem('serpLocationHistory', JSON.stringify(updated)); } catch (e) { }
    };

    // Fetch keyword suggestions from Google Autocomplete via JSONP
    const fetchSuggestions = async (query) => {
        if (!query.trim() || query.length < 2) {
            setKwSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsLoadingSuggestions(true);

        // Create unique callback name
        const callbackName = `googleAC_${Date.now()}`;

        try {
            // Use JSONP to bypass CORS
            const promise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error('Request timeout'));
                }, 5000);

                const cleanup = () => {
                    clearTimeout(timeout);
                    delete window[callbackName];
                    const script = document.querySelector(`script[data-callback="${callbackName}"]`);
                    if (script) script.remove();
                };

                window[callbackName] = (data) => {
                    cleanup();
                    resolve(data);
                };

                const script = document.createElement('script');
                script.setAttribute('data-callback', callbackName);
                const params = new URLSearchParams({
                    q: query,
                    hl: serpHl,
                    gl: serpGl,
                    client: 'chrome',
                    callback: callbackName
                });
                script.src = `https://www.google.com/complete/search?${params.toString()}`;
                script.onerror = () => {
                    cleanup();
                    reject(new Error('Script load failed'));
                };
                document.head.appendChild(script);
            });

            const data = await promise;

            // Parse suggestions from response [query, [suggestions], ...]
            if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                const suggestions = data[1].map(item => {
                    // Handle both string and array formats
                    if (typeof item === 'string') return item;
                    if (Array.isArray(item) && item.length > 0) return item[0];
                    return null;
                }).filter(Boolean).slice(0, 10);

                setKwSuggestions(suggestions);
                setShowSuggestions(suggestions.length > 0);

                // Set first suggestion as inline hint for Tab-to-accept
                if (suggestions.length > 0) {
                    setInlineSuggestion(suggestions[0]);
                } else {
                    setInlineSuggestion('');
                }
            } else {
                setKwSuggestions([]);
                setShowSuggestions(false);
                setInlineSuggestion('');
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            setKwSuggestions([]);
            setShowSuggestions(false);
            setInlineSuggestion('');
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    // Debounced keyword input handler
    const handleKeywordChange = (value) => {
        setSerpKw(value);

        // Clear inline suggestion if input is cleared
        if (!value.trim()) {
            setInlineSuggestion('');
            setShowSuggestions(false);
            setKwSuggestions([]);
            return;
        }

        // Clear existing debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce the API call
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 150);
    };

    // Select a suggestion (also clears inline hint)
    const selectSuggestion = (suggestion) => {
        setSerpKw(suggestion);
        setShowSuggestions(false);
        setKwSuggestions([]);
        setInlineSuggestion('');
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutsideSuggestions = (e) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
                kwInputRef.current && !kwInputRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideSuggestions);
        return () => document.removeEventListener('mousedown', handleClickOutsideSuggestions);
    }, []);

    // Filter regions based on search
    const filteredRegions = useMemo(() => {
        if (!regionSearch.trim()) return GOOGLE_SITES;
        const search = regionSearch.toLowerCase();
        return GOOGLE_SITES.filter(s =>
            s.name.toLowerCase().includes(search) ||
            s.lang.toLowerCase().includes(search) ||
            s.gl.toLowerCase().includes(search)
        );
    }, [regionSearch]);

    // Geocode using server-side proxy (bypasses CORS)
    const geocode = async () => {
        if (!serpLoc.trim()) return;
        setIsGeo(true);

        try {
            // Use our proxy API to bypass CORS
            const proxyUrl = `/api/utils?action=geocode&address=${encodeURIComponent(serpLoc.toLowerCase())}&hl=${serpHl}&gl=${serpGl}`;
            const response = await authenticatedFetch(proxyUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.results?.length) {
                const result = data.results[0];
                const lat = parseFloat(result.geometry.location.lat).toFixed(7);
                const lng = parseFloat(result.geometry.location.lng).toFixed(7);
                setSerpLat(lat);
                setSerpLng(lng);
                const placeName = result.formatted_address || serpLoc;
                setSerpLoc('');
                saveToHistory(lat, lng, placeName);
                showMessage(`Location set: ${placeName.split(',')[0]}`);
            } else {
                showMessage('Location not found');
            }
        } catch (error) {
            console.error('Geocode error:', error);
            showMessage('Geocode failed');
        } finally {
            setIsGeo(false);
        }
    };

    // Handle region selection
    const handleRegion = (site) => {
        setSerpReg(`${site.name} - ${site.lang}`);
        setSerpHl(site.hl);
        setSerpGl(site.gl);
        setSerpUrl(site.url || 'https://www.google.com/search');
        setShowRegions(false);
        setRegionSearch('');
    };

    // Handle location history selection
    const selectFromHistory = (loc) => {
        setSerpLat(loc.lat);
        setSerpLng(loc.lng);
        setShowLocHistory(false);
        showMessage(`Location set: ${loc.name.split(',')[0]}`);
    };

    // Open Google with proper parameters
    const openGoogle = () => {
        if (!serpKw.trim()) return;
        const params = new URLSearchParams({
            q: serpKw,
            gl: serpGl,
            hl: serpHl,
            ie: 'utf-8',
            oe: 'utf-8',
            pws: '0'
        });

        // Add UULE if coordinates are set
        if (serpLat && serpLng) {
            const uule = genGeoCode(serpLat, serpLng);
            params.set('uule', uule);
        }

        window.open(`${serpUrl}?${params.toString()}`, '_blank');
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (regionRef.current && !regionRef.current.contains(e.target)) {
                setShowRegions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initialize Leaflet map when showMap is true
    useEffect(() => {
        if (!showMap || !mapContainerRef.current || mapInstanceRef.current) return;

        // Dynamically load Leaflet CSS and JS
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
            const map = L.map(mapContainerRef.current).setView([lat, lng], 17);
            mapInstanceRef.current = map;

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Add draggable marker
            const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            markerRef.current = marker;

            // Update coordinates on marker drag
            marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                setSerpLat(pos.lat.toFixed(7));
                setSerpLng(pos.lng.toFixed(7));
                showMessage('Location updated');
            });

            // Click on map to move marker
            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                marker.setLatLng([lat, lng]);
                setSerpLat(lat.toFixed(7));
                setSerpLng(lng.toFixed(7));
                showMessage('Location updated');
            });
        };

        loadLeaflet();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
            }
        };
    }, [showMap]);

    // Update marker position when coordinates change externally
    useEffect(() => {
        if (markerRef.current && mapInstanceRef.current && serpLat && serpLng) {
            const lat = parseFloat(serpLat);
            const lng = parseFloat(serpLng);
            if (!isNaN(lat) && !isNaN(lng)) {
                markerRef.current.setLatLng([lat, lng]);
                mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom());
            }
        }
    }, [serpLat, serpLng]);

    // DA/PA
    const [dapaUrls, setDapaUrls] = useState('');

    // Ahrefs Domain Rating
    const [drDomains, setDrDomains] = useState('');
    const [drResults, setDrResults] = useState([]);
    const [drLoading, setDrLoading] = useState(false);
    const [drProgress, setDrProgress] = useState(0);
    const [drCurrentTarget, setDrCurrentTarget] = useState('');

    // XML Sitemap Extractor
    const [xmlSitemapUrl, setXmlSitemapUrl] = useState('');
    const [xmlExtractedUrls, setXmlExtractedUrls] = useState([]);
    const [xmlLoading, setXmlLoading] = useState(false);
    const [xmlError, setXmlError] = useState('');

    // Bulk Meta Extractor
    const [bulkUrls, setBulkUrls] = useState('');
    const [bulkResults, setBulkResults] = useState([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(0);
    const [bulkOptions, setBulkOptions] = useState({
        title: true,
        metaDescription: true,
        canonical: true,
        robotsTag: true,
        metaKeywords: false,
        wordCount: true
    });

    // Extract URLs from XML Sitemap
    const extractXmlSitemap = async () => {
        if (!xmlSitemapUrl.trim()) return;

        setXmlLoading(true);
        setXmlError('');
        setXmlExtractedUrls([]);

        try {
            let sitemapUrl = xmlSitemapUrl.trim();
            if (!sitemapUrl.startsWith('http')) {
                sitemapUrl = 'https://' + sitemapUrl;
            }

            const response = await authenticatedFetch(`/api/proxy?url=${encodeURIComponent(sitemapUrl)}`);
            if (!response.ok) throw new Error('Failed to fetch sitemap');

            const xmlText = await response.text();

            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            let urls = [];

            // Check if this is a sitemap index (contains <sitemap> tags)
            const sitemapTags = xmlDoc.querySelectorAll('sitemap loc');

            if (sitemapTags.length > 0) {
                // This is a sitemap index - fetch all child sitemaps
                const childSitemapUrls = Array.from(sitemapTags).map(el => el.textContent).filter(Boolean);

                showMessage(`Found ${childSitemapUrls.length} child sitemaps. Extracting URLs...`);

                // Fetch each child sitemap and extract URLs
                for (const childUrl of childSitemapUrls.slice(0, 20)) { // Limit to 20 child sitemaps
                    try {
                        const childResponse = await authenticatedFetch(`/api/proxy?url=${encodeURIComponent(childUrl)}`);

                        if (childResponse.ok) {
                            const childXmlText = await childResponse.text();
                            const childXmlDoc = parser.parseFromString(childXmlText, 'text/xml');
                            const childLocs = childXmlDoc.querySelectorAll('url loc');
                            const childUrls = Array.from(childLocs).map(el => el.textContent).filter(Boolean);
                            urls.push(...childUrls);
                        }
                    } catch (e) {
                        console.log(`Failed to fetch child sitemap: ${childUrl}`);
                    }
                }
            } else {
                // Regular sitemap - extract URLs from <url><loc> tags
                const locElements = xmlDoc.querySelectorAll('url loc');
                urls = Array.from(locElements).map(el => el.textContent).filter(Boolean);

                // Fallback: try getting all <loc> tags if no <url><loc> found
                if (urls.length === 0) {
                    const allLocs = xmlDoc.querySelectorAll('loc');
                    urls = Array.from(allLocs).map(el => el.textContent).filter(Boolean);
                }
            }

            // Filter out image URLs
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif)$/i;
            urls = urls.filter(url => !imageExtensions.test(url));

            if (urls.length === 0) {
                throw new Error('No URLs found in sitemap. Make sure it is a valid XML sitemap.');
            }

            setXmlExtractedUrls(urls);
            showMessage(`Extracted ${urls.length} URLs from sitemap`);
        } catch (err) {
            setXmlError(err.message || 'Failed to extract URLs');
        } finally {
            setXmlLoading(false);
        }
    };

    // Bulk Meta Extraction
    const extractBulkMeta = async () => {
        const urls = bulkUrls.split('\n').filter(u => u.trim());
        if (urls.length === 0) return;

        setBulkLoading(true);
        setBulkProgress(0);
        setBulkResults([]);

        const results = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i].trim();
            try {
                let normalizedUrl = url;
                if (!normalizedUrl.startsWith('http')) {
                    normalizedUrl = 'https://' + normalizedUrl;
                }

                // Add timeout to prevent hanging on unresponsive domains
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                const response = await authenticatedFetch(`/api/proxy?url=${encodeURIComponent(normalizedUrl)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const html = await response.text();

                const result = { url: normalizedUrl, error: null };

                if (bulkOptions.title) {
                    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
                    result.title = titleMatch ? titleMatch[1].trim() : '';
                }

                if (bulkOptions.metaDescription) {
                    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
                    result.metaDescription = descMatch ? descMatch[1].trim() : '';
                }

                if (bulkOptions.canonical) {
                    const canonMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
                        html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
                    result.canonical = canonMatch ? canonMatch[1].trim() : '';
                }

                if (bulkOptions.robotsTag) {
                    const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);
                    result.robotsTag = robotsMatch ? robotsMatch[1].trim() : '';
                }

                if (bulkOptions.metaKeywords) {
                    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']keywords["']/i);
                    result.metaKeywords = keywordsMatch ? keywordsMatch[1].trim() : '';
                }

                if (bulkOptions.wordCount) {
                    // Remove scripts, styles, and tags, then count words
                    const textContent = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    result.wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
                }

                results.push(result);
            } catch (err) {
                const errorMsg = err.name === 'AbortError' ? 'Timeout after 15s' : (err.message || 'Failed to fetch');
                results.push({ url, error: errorMsg });
            }

            setBulkProgress(Math.round(((i + 1) / urls.length) * 100));
            setBulkResults([...results]);
        }

        setBulkLoading(false);
        showMessage(`Extracted data from ${results.filter(r => !r.error).length} of ${urls.length} URLs`);
    };

    // Export bulk results to CSV
    const exportBulkCsv = () => {
        if (bulkResults.length === 0) return;

        const headers = ['URL'];
        if (bulkOptions.title) headers.push('Title');
        if (bulkOptions.metaDescription) headers.push('Meta Description');
        if (bulkOptions.canonical) headers.push('Canonical');
        if (bulkOptions.robotsTag) headers.push('Robots Tag');
        if (bulkOptions.metaKeywords) headers.push('Meta Keywords');
        if (bulkOptions.wordCount) headers.push('Word Count');
        headers.push('Error');

        const rows = bulkResults.map(r => {
            const row = [r.url];
            if (bulkOptions.title) row.push(`"${(r.title || '').replace(/"/g, '""')}"`);
            if (bulkOptions.metaDescription) row.push(`"${(r.metaDescription || '').replace(/"/g, '""')}"`);
            if (bulkOptions.canonical) row.push(r.canonical || '');
            if (bulkOptions.robotsTag) row.push(r.robotsTag || '');
            if (bulkOptions.metaKeywords) row.push(`"${(r.metaKeywords || '').replace(/"/g, '""')}"`);
            if (bulkOptions.wordCount) row.push(r.wordCount || '');
            row.push(r.error || '');
            return row.join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'bulk-meta-extraction.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    const normalizeDrTarget = (value) => {
        const trimmed = value.trim().replace(/^["'<]+|[>"']+$/g, '');
        if (!trimmed) return null;

        try {
            const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            const parsed = new URL(withProtocol);
            const displayTarget = parsed.hostname.replace(/\.$/, '').toLowerCase();
            const hasUrlParts = /^https?:\/\//i.test(trimmed) || parsed.pathname !== '/' || parsed.search || parsed.hash;

            return {
                displayTarget,
                requestTarget: hasUrlParts ? parsed.href : displayTarget,
                dedupeKey: displayTarget
            };
        } catch {
            const fallbackTarget = trimmed
                .replace(/^https?:\/\//i, '')
                .split(/[/?#]/)[0]
                .replace(/\.$/, '')
                .toLowerCase();

            return fallbackTarget ? {
                displayTarget: fallbackTarget,
                requestTarget: fallbackTarget,
                dedupeKey: fallbackTarget
            } : null;
        }
    };

    const getDrTargets = () => {
        const targets = drDomains
            .split(/[\n,]+/)
            .map(normalizeDrTarget)
            .filter(Boolean);

        const seenTargets = new Set();
        return targets.filter(target => {
            if (seenTargets.has(target.dedupeKey)) {
                return false;
            }

            seenTargets.add(target.dedupeKey);
            return true;
        });
    };

    const waitForDrRequest = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const checkBulkDomainRating = async () => {
        const targets = getDrTargets();

        if (targets.length === 0) {
            showMessage('Add at least one domain');
            return;
        }

        setDrLoading(true);
        setDrProgress(0);
        setDrResults([]);
        setDrCurrentTarget('');

        const results = [];

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            setDrCurrentTarget(target.displayTarget);

            if (i > 0) {
                await waitForDrRequest(1800);
            }

            try {
                const response = await authenticatedFetch(`/api/ahrefs-dr?target=${encodeURIComponent(target.requestTarget)}`);
                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || 'Could not check this domain');
                }

                results.push({
                    target: target.displayTarget,
                    domainRating: data.domainRating,
                    error: null
                });
            } catch (err) {
                results.push({
                    target: target.displayTarget,
                    domainRating: null,
                    error: err.message || 'Failed to check DR'
                });
            }

            setDrProgress(Math.round(((i + 1) / targets.length) * 100));
            setDrResults([...results]);
        }

        setDrLoading(false);
        setDrCurrentTarget('');
        showMessage(`Checked DR for ${results.filter(r => !r.error).length} of ${targets.length} domains`);
    };

    const exportDrCsv = () => {
        if (drResults.length === 0) return;

        const rows = drResults.map(r => [
            `"${r.target.replace(/"/g, '""')}"`,
            Number.isFinite(r.domainRating) ? r.domainRating : '',
            `"${(r.error || '').replace(/"/g, '""')}"`
        ].join(','));

        const csv = ['Domain,Domain Rating,Error', ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'bulk-domain-rating.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    // AI Keyword Entities Generator
    const [aiKeywords, setAiKeywords] = useState('');
    const [aiEntityResults, setAiEntityResults] = useState([]);
    const [aiEntityLoading, setAiEntityLoading] = useState(false);
    const [aiEntityProgress, setAiEntityProgress] = useState(0);
    const [aiEntityCurrentKw, setAiEntityCurrentKw] = useState('');
    const fileInputRef = useRef(null);

    // Handle file upload for keywords
    const handleKeywordFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            setAiKeywords(prev => prev ? prev + '\n' + text : text);
        };
        reader.readAsText(file);
    };

    // Generate entities for keywords using AI
    const generateKeywordEntities = async () => {
        // Parse keywords from input (comma or newline separated)
        const keywords = aiKeywords
            .split(/[,\n]/)
            .map(k => k.trim())
            .filter(k => k.length > 0);

        if (keywords.length === 0) return;

        setAiEntityLoading(true);
        setAiEntityProgress(0);
        setAiEntityResults([]);

        const results = [];

        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            setAiEntityCurrentKw(keyword);

            try {
                const response = await authenticatedFetch('/api/ai-tools', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operation: 'entities.generate',
                        inputs: { keyword }
                    })
                });

                if (!response.ok) throw new Error('AI API error');

                const data = await response.json();
                const parsed = JSON.parse(data.text);

                results.push({
                    keyword,
                    entities: parsed.entities || [],
                    entityTypes: parsed.entityTypes || {},
                    error: null
                });
            } catch (err) {
                results.push({
                    keyword,
                    entities: [],
                    entityTypes: {},
                    error: err.message || 'Failed to generate'
                });
            }

            setAiEntityProgress(Math.round(((i + 1) / keywords.length) * 100));
            setAiEntityResults([...results]);
        }

        setAiEntityLoading(false);
        setAiEntityCurrentKw('');
        showMessage(`Generated entities for ${results.filter(r => !r.error).length} of ${keywords.length} keywords`);
    };

    // Export AI entities to CSV
    const exportAiEntitiesCsv = () => {
        if (aiEntityResults.length === 0) return;


        const rows = aiEntityResults.map(r => {
            return `"${r.keyword.replace(/"/g, '""')}","${(r.entities || []).join(', ').replace(/"/g, '""')}","${r.error || ''}"`;
        });

        const csv = ['Keyword,Entities,Error', ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'ai-keyword-entities.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    const tools = [
        { id: 'url', name: 'Ultimate URL Editor', icon: <Link2 className="w-8 h-8" />, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-gradient-to-br from-blue-50 to-cyan-50' },
        { id: 'text', name: 'Universal Text Editor', icon: <Type className="w-8 h-8" />, gradient: 'from-purple-500 to-pink-500', bg: 'bg-gradient-to-br from-purple-50 to-pink-50' },
        { id: 'domain', name: 'Domain Separator', icon: <Globe className="w-8 h-8" />, gradient: 'from-indigo-500 to-purple-500', bg: 'bg-gradient-to-br from-indigo-50 to-purple-50' },
        { id: 'word', name: 'Word Counter', icon: <Hash className="w-8 h-8" />, gradient: 'from-emerald-500 to-teal-500', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50' },
        { id: 'bot', name: 'Bot Viewer', icon: <Eye className="w-8 h-8" />, gradient: 'from-orange-500 to-red-500', bg: 'bg-gradient-to-br from-orange-50 to-red-50' },
        { id: 'serp', name: 'SERP Checker', icon: <Search className="w-8 h-8" />, gradient: 'from-green-500 to-emerald-500', bg: 'bg-gradient-to-br from-green-50 to-emerald-50', hidden: true },
        { id: 'dapa', name: 'Bulk DA/PA Checker', icon: <ArrowUpDown className="w-8 h-8" />, gradient: 'from-amber-500 to-orange-500', bg: 'bg-gradient-to-br from-amber-50 to-orange-50' },
        { id: 'dr', name: 'Bulk DR Checker', icon: <Gauge className="w-8 h-8" />, gradient: 'from-sky-500 to-blue-500', bg: 'bg-gradient-to-br from-sky-50 to-blue-50' },
        { id: 'sitemap', name: 'Sitemap Generator', icon: <Map className="w-8 h-8" />, gradient: 'from-rose-500 to-pink-500', bg: 'bg-gradient-to-br from-rose-50 to-pink-50' },
        { id: 'robotstxt', name: 'Robots.txt Generator', icon: <FileCode className="w-8 h-8" />, gradient: 'from-purple-500 to-pink-500', bg: 'bg-gradient-to-br from-purple-50 to-pink-50' },
        { id: 'xmlextract', name: 'XML Sitemap Extractor', icon: <FileCode className="w-8 h-8" />, gradient: 'from-teal-500 to-cyan-500', bg: 'bg-gradient-to-br from-teal-50 to-cyan-50' },
        { id: 'bulkextract', name: 'Bulk Meta Extractor', icon: <Database className="w-8 h-8" />, gradient: 'from-violet-500 to-purple-500', bg: 'bg-gradient-to-br from-violet-50 to-purple-50' }
    ];

    if (!activeTool) {
        return (
            <div className="tool-dark-surface min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"><Wrench className="w-8 h-8" /></div>
                            <div><h1 className="text-3xl font-bold">SEO Tools</h1><p className="text-blue-200">A collection of essential SEO utilities for professionals</p></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tools.filter(t => !t.hidden).map(t => (
                            <div key={t.id} onClick={() => selectTool(t.id)} className={`${t.bg} rounded-2xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:-translate-y-1`}>
                                <div className="flex flex-col items-center text-center">
                                    <div className={`w-16 h-16 bg-gradient-to-br ${t.gradient} rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-lg`}>{t.icon}</div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">{t.name}</h3>
                                    <button className={`px-6 py-2.5 bg-gradient-to-r ${t.gradient} text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all`}>Go to Tool</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const tool = tools.find(t => t.id === activeTool);

    return (
        <div className="tool-dark-surface min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className={activeTool === 'bot' ? 'max-w-[1600px] mx-auto' : 'max-w-5xl mx-auto'}>
                <div className="flex items-center justify-between mb-6">
                    <button onClick={goBack} className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 hover:text-gray-900 rounded-xl shadow-sm border border-gray-200 transition font-medium"><ChevronLeft className="w-5 h-5" />Back to Tools</button>
                    {operationMessage && <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg animate-pulse">✓ {operationMessage}</div>}
                </div>

                <div className={`bg-gradient-to-r ${tool?.gradient} rounded-2xl p-6 text-white mb-6 shadow-xl`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">{tool?.icon}</div>
                        <h2 className="text-2xl font-bold">{tool?.name}</h2>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                    {activeTool === 'url' && (<>
                        <textarea value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="Enter URLs (one per line)..." className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 mb-4 font-mono text-sm transition" />
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[['Trim to Root', urlOps.trimToRoot], ['Remove Params', urlOps.removeParams], ['Remove Duplicates', urlOps.removeDupes], ['Clean SERP', urlOps.cleanSERP], ['Remove # URLs', urlOps.removeHash], ['Remove & URLs', urlOps.removeAmp], ['Extract TLD', urlOps.keepTLD]].map(([l, f]) => <button key={l} onClick={f} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg transition text-sm font-semibold">{l}</button>)}
                        </div>
                        <div className="flex gap-2"><button onClick={() => copyToClipboard(urlInput, 'url')} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-medium flex items-center gap-2">{copiedSection === 'url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}Copy</button><button onClick={() => { setUrlInput(''); showMessage('Cleared'); }} className="px-4 py-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition text-sm font-medium flex items-center gap-2"><Trash2 className="w-4 h-4" />Clear</button></div>
                    </>)}

                    {activeTool === 'text' && (<>
                        <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Paste your text here..." className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 mb-6 transition text-sm" />

                        {/* Cleanup Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-md flex items-center justify-center text-xs font-bold">1</span>
                                Cleanup Operations
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {[['Remove Duplicate Lines', textOps.removeDupeLines, 'Keeps only unique lines'],
                                ['Remove Brackets', textOps.removeBrackets, 'Removes [], (), {} brackets'],
                                ['Remove Empty Lines', textOps.removeEmpty, 'Removes blank lines']
                                ].map(([label, fn, tip]) => (
                                    <button key={label} onClick={fn} title={tip} className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition text-sm font-medium">{label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Filter Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-md flex items-center justify-center text-xs font-bold">2</span>
                                Filter Lines
                            </h3>
                            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                                <input value={filterKw} onChange={e => setFilterKw(e.target.value)} placeholder="Enter keyword to filter..." className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/30" />
                                <button onClick={textOps.filterLines} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition whitespace-nowrap">Keep Lines Containing</button>
                            </div>
                        </div>

                        {/* Transform Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-cyan-100 text-cyan-600 rounded-md flex items-center justify-center text-xs font-bold">3</span>
                                Case Transformation
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {[['UPPERCASE', textOps.upper], ['lowercase', textOps.lower], ['Title Case', textOps.title], ['Single Line', textOps.toSingle]].map(([label, fn]) => (
                                    <button key={label} onClick={fn} className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl hover:shadow-lg transition text-sm font-medium">{label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Modify Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-md flex items-center justify-center text-xs font-bold">4</span>
                                Add & Replace
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                                    <label className="block text-xs font-semibold text-gray-600 mb-2">Replace Newlines With</label>
                                    <div className="flex gap-2">
                                        <input value={sep} onChange={e => setSep(e.target.value)} placeholder=", " className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                        <button onClick={textOps.replaceNL} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold">Apply</button>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                                    <label className="block text-xs font-semibold text-gray-600 mb-2">Add to Start of Lines</label>
                                    <div className="flex gap-2">
                                        <input value={addS} onChange={e => setAddS(e.target.value)} placeholder="Prefix..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                        <button onClick={textOps.addStart} className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-semibold">Add</button>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                                    <label className="block text-xs font-semibold text-gray-600 mb-2">Add to End of Lines</label>
                                    <div className="flex gap-2">
                                        <input value={addE} onChange={e => setAddE(e.target.value)} placeholder="Suffix..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                        <button onClick={textOps.addEnd} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-semibold">Add</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button onClick={() => copyToClipboard(textInput, 'text')} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold flex items-center justify-center gap-2">
                                {copiedSection === 'text' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                Copy Text
                            </button>
                            <button onClick={() => { setTextInput(''); showMessage('Cleared'); }} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition flex items-center justify-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                Clear All
                            </button>
                        </div>
                    </>)}

                    {activeTool === 'domain' && (<>
                        <textarea value={domainInput} onChange={e => setDomainInput(e.target.value)} placeholder="Enter domains (one per line)..." className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 mb-4" />
                        <div className="flex gap-2 mb-6"><button onClick={filterDomains} className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition"><Globe className="w-5 h-5" />Filter Domains</button><button onClick={() => { setDomainInput(''); setFiltered({}); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium flex items-center gap-2"><Trash2 className="w-5 h-5" />Clear</button></div>
                        {Object.keys(filtered).length > 0 && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Object.entries(filtered).map(([t, d]) => <div key={t} className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4"><div className="flex items-center justify-between mb-2"><span className="font-bold text-indigo-700">{t}</span><button onClick={() => copyToClipboard(d.join('\n'), t)} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg">{copiedSection === t ? 'Copied!' : 'Copy'}</button></div><div className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">{d.map((x, i) => <div key={i} className="text-indigo-600 truncate">{x}</div>)}</div><div className="text-xs text-gray-400 mt-2">{d.length} domain{d.length > 1 ? 's' : ''}</div></div>)}</div>}
                    </>)}

                    {activeTool === 'word' && (<>
                        <textarea value={wcInput} onChange={e => setWcInput(e.target.value)} placeholder="Paste or type your text here..." className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 mb-6" />
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[['Words', wcStats.w, 'from-blue-500 to-cyan-500'], ['Characters', wcStats.c, 'from-green-500 to-emerald-500'], ['Sentences', wcStats.s, 'from-purple-500 to-pink-500'], ['Paragraphs', wcStats.p, 'from-orange-500 to-red-500'], ['Reading', wcStats.r, 'from-indigo-500 to-purple-500']].map(([l, v, g]) => <div key={l} className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-center"><div className={`text-3xl font-bold bg-gradient-to-r ${g} bg-clip-text text-transparent`}>{v}</div><div className="text-sm text-gray-600 font-medium">{l}</div></div>)}</div>
                    </>)}

                    {activeTool === 'bot' && (<>
                        {/* Bot Selector & URL Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Bot / Crawler</label>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {Object.entries(bots).map(([k, b]) => (
                                    <button
                                        key={k}
                                        onClick={() => setBot(k)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${bot === k
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {b.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 mb-4">
                            <input
                                type="url"
                                value={botUrl}
                                onChange={e => setBotUrl(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchBot()}
                                placeholder="Enter URL to view as bot (e.g., https://example.com)"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                            />
                            <button
                                onClick={fetchBot}
                                disabled={!botUrl.trim() || isFetching}
                                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 hover:shadow-lg transition"
                            >
                                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                                View as {bots[bot].name}
                            </button>
                        </div>

                        {/* Mini Browser Frame - Desktop Width */}
                        {botHtml && (
                            <div className="mb-4 -mx-6">
                                <div className="mx-6 mb-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
                                    <span>💡</span>
                                    <span><strong>Note:</strong> This shows raw HTML as bots see it. Images may not load due to hotlink protection - bots rely on alt text and img src URLs, not actual images.</span>
                                </div>
                                <div className="bg-gray-800 rounded-t-xl px-4 py-2 flex items-center gap-3 mx-6">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                    <div className="flex-1 bg-gray-700 rounded-lg px-3 py-1 text-sm text-gray-300 truncate">
                                        {botUrl}
                                    </div>
                                    <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg">
                                        {bots[bot].name}
                                    </span>
                                </div>
                                <div className="border-2 border-gray-300 border-t-0 rounded-b-xl overflow-auto bg-white mx-6">
                                    <iframe
                                        srcDoc={botHtml}
                                        title="Bot Preview"
                                        style={{ width: '1400px', height: '700px', minWidth: '100%' }}
                                        referrerPolicy="no-referrer"
                                        sandbox=""
                                    />
                                </div>
                            </div>
                        )}

                        {/* Collapsible Metadata */}
                        {botRes && !botRes.error && (
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowMetadata(!showMetadata)}
                                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-orange-100/50 transition"
                                >
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <Eye className="w-5 h-5 text-orange-500" />
                                        SEO Metadata ({bots[bot].name})
                                    </h3>
                                    <span className="text-orange-500 text-sm font-medium">
                                        {showMetadata ? '▲ Hide' : '▼ Show Details'}
                                    </span>
                                </button>
                                {showMetadata && (
                                    <div className="px-6 pb-6">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {Object.entries(botRes).map(([k, v]) => (
                                                <div key={k} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <div className="text-xs text-gray-500 uppercase font-medium mb-1">{k.replace(/([A-Z])/g, ' $1')}</div>
                                                    <div className="text-sm font-semibold text-gray-900 truncate" title={String(v)}>{v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {botRes?.error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">Error: {botRes.error}</div>}

                        {/* Info Box when no results */}
                        {!botHtml && !isFetching && (
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-8 text-center border border-orange-200">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                                    <Eye className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Bot Viewer</h3>
                                <p className="text-gray-600 max-w-md mx-auto">
                                    Enter a URL and select a bot to see how search engine crawlers and social media bots view your website.
                                </p>
                            </div>
                        )}
                    </>)}

                    {activeTool === 'serp' && (<>
                        {/* Keyword Input with Suggestions */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Search Keyword
                                {inlineSuggestion && serpKw && inlineSuggestion.toLowerCase().startsWith(serpKw.toLowerCase()) && (
                                    <span className="ml-2 text-xs font-normal text-gray-400">Press Tab to accept suggestion</span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    {/* Inline suggestion background text */}
                                    {inlineSuggestion && serpKw && inlineSuggestion.toLowerCase().startsWith(serpKw.toLowerCase()) && (
                                        <div className="absolute inset-0 px-4 py-3 pointer-events-none flex items-center" style={{ whiteSpace: 'pre' }}>
                                            <span className="text-transparent">{serpKw}</span>
                                            <span className="text-gray-400">{inlineSuggestion.substring(serpKw.length)}</span>
                                        </div>
                                    )}
                                    <input
                                        ref={kwInputRef}
                                        type="text"
                                        value={serpKw}
                                        onChange={e => handleKeywordChange(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Tab' && inlineSuggestion && serpKw && inlineSuggestion.toLowerCase().startsWith(serpKw.toLowerCase())) {
                                                e.preventDefault();
                                                selectSuggestion(inlineSuggestion);
                                            } else if (e.key === 'Enter') {
                                                setShowSuggestions(false);
                                                setInlineSuggestion('');
                                                openGoogle();
                                            } else if (e.key === 'Escape') {
                                                setShowSuggestions(false);
                                                setInlineSuggestion('');
                                            } else if (e.key === 'ArrowDown' && showSuggestions && kwSuggestions.length > 0) {
                                                e.preventDefault();
                                                const firstSuggestion = suggestionsRef.current?.querySelector('[data-suggestion]');
                                                if (firstSuggestion) firstSuggestion.focus();
                                            }
                                        }}
                                        onFocus={() => {
                                            if (kwSuggestions.length > 0) setShowSuggestions(true);
                                        }}
                                        onBlur={() => {
                                            // Delay to allow click on suggestions to register
                                            setTimeout(() => {
                                                setInlineSuggestion('');
                                            }, 200);
                                        }}
                                        placeholder="Enter your search keyword"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-transparent relative z-10"
                                        autoComplete="off"
                                        style={{ caretColor: 'black' }}
                                    />

                                    {/* Loading indicator */}
                                    {isLoadingSuggestions && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                        </div>
                                    )}

                                    {/* Suggestions Dropdown */}
                                    {showSuggestions && kwSuggestions.length > 0 && (
                                        <div
                                            ref={suggestionsRef}
                                            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto"
                                        >
                                            {kwSuggestions.map((suggestion, index) => (
                                                <div
                                                    key={index}
                                                    data-suggestion
                                                    tabIndex={0}
                                                    onClick={() => selectSuggestion(suggestion)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            selectSuggestion(suggestion);
                                                        } else if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            const next = e.target.nextElementSibling;
                                                            if (next) next.focus();
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            const prev = e.target.previousElementSibling;
                                                            if (prev) prev.focus();
                                                            else kwInputRef.current?.focus();
                                                        } else if (e.key === 'Escape') {
                                                            setShowSuggestions(false);
                                                            kwInputRef.current?.focus();
                                                        }
                                                    }}
                                                    className="px-4 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3 focus:bg-green-50 focus:outline-none transition-colors"
                                                >
                                                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <span className="text-gray-700">{suggestion}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setShowSuggestions(false); openGoogle(); }}
                                    disabled={!serpKw.trim()}
                                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 hover:shadow-lg transition flex items-center gap-2"
                                >
                                    <Search className="w-5 h-5" />
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Region Selector with Search */}
                        <div className="mb-6" ref={regionRef}>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Country & Language</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={regionSearch || serpReg}
                                    onChange={e => {
                                        setRegionSearch(e.target.value);
                                        setShowRegions(true);
                                    }}
                                    onFocus={() => setShowRegions(true)}
                                    placeholder="United States - English"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-white"
                                />

                                {showRegions && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredRegions.map((s, i) => (
                                                <div
                                                    key={`${s.gl}-${s.hl}-${i}`}
                                                    onClick={() => {
                                                        handleRegion(s);
                                                        setRegionSearch('');
                                                    }}
                                                    className="px-4 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center justify-between"
                                                >
                                                    <span className="text-gray-900">{s.name} - <span className="text-gray-500">{s.lang}</span></span>
                                                    <span className="text-xs text-gray-400 font-mono">{s.gl}</span>
                                                </div>
                                            ))}
                                            {filteredRegions.length === 0 && (
                                                <div className="px-4 py-6 text-center text-gray-400">No regions found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Location Input with History */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Location <span className="text-gray-400 font-normal">(optional - for hyper-local results)</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={serpLoc}
                                        onChange={e => setSerpLoc(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && geocode()}
                                        onFocus={() => locationHistory.length > 0 && setShowLocHistory(true)}
                                        placeholder="e.g. 1600 Amphitheatre Pkwy, Mountain View, CA"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/30"
                                    />

                                    {showLocHistory && locationHistory.length > 0 && (
                                        <div className="absolute z-40 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-gray-500 uppercase">Recent Locations</span>
                                                <button onClick={() => setShowLocHistory(false)} className="text-gray-400 hover:text-gray-600">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {locationHistory.map((loc, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => selectFromHistory(loc)}
                                                    className="px-4 py-2.5 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3"
                                                >
                                                    <History className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-700 truncate">{loc.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={geocode}
                                    disabled={isGeo || !serpLoc.trim()}
                                    className="px-5 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2 hover:shadow-lg transition"
                                >
                                    {isGeo ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                                    Geocode
                                </button>
                            </div>
                        </div>

                        {/* Current Location Display */}
                        {serpLat && serpLng && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-semibold text-blue-600 uppercase mb-1">Current Location</div>
                                        <div className="text-sm text-gray-700 font-mono">
                                            Lat: {serpLat} | Lng: {serpLng}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSerpLat(''); setSerpLng(''); showMessage('Location cleared'); }}
                                        className="px-3 py-1.5 text-xs bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Advanced Settings */}
                        <details className="mb-6" onToggle={(e) => { if (e.target.open) setShowMap(true); }}>
                            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Advanced Settings
                            </summary>
                            <div className="mt-4 space-y-4">
                                {/* Parameter Inputs */}
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Host Language (hl)</label>
                                        <input value={serpHl} onChange={e => setSerpHl(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Geo Location (gl)</label>
                                        <input value={serpGl} onChange={e => setSerpGl(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                                        <input value={serpLat} onChange={e => setSerpLat(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                                        <input value={serpLng} onChange={e => setSerpLng(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-white" />
                                    </div>
                                </div>

                                {/* Interactive Map */}
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-600 uppercase">Interactive Map</span>
                                        <span className="text-xs text-gray-400">Click or drag marker to set location</span>
                                    </div>
                                    <div
                                        ref={mapContainerRef}
                                        className="w-full h-80"
                                        style={{ minHeight: '320px' }}
                                    />
                                </div>

                                {/* Map Controls */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (mapInstanceRef.current && serpLat && serpLng) {
                                                const lat = parseFloat(serpLat);
                                                const lng = parseFloat(serpLng);
                                                if (!isNaN(lat) && !isNaN(lng)) {
                                                    mapInstanceRef.current.setView([lat, lng], 17);
                                                    if (markerRef.current) {
                                                        markerRef.current.setLatLng([lat, lng]);
                                                    }
                                                }
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition flex items-center justify-center gap-2"
                                    >
                                        <MapPin className="w-4 h-4" />
                                        Center on Coordinates
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (navigator.geolocation) {
                                                navigator.geolocation.getCurrentPosition(
                                                    (pos) => {
                                                        const lat = pos.coords.latitude.toFixed(7);
                                                        const lng = pos.coords.longitude.toFixed(7);
                                                        setSerpLat(lat);
                                                        setSerpLng(lng);
                                                        showMessage('Used your current location');
                                                    },
                                                    () => showMessage('Location access denied')
                                                );
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition flex items-center justify-center gap-2"
                                    >
                                        <Globe className="w-4 h-4" />
                                        Use My Location
                                    </button>
                                </div>
                            </div>
                        </details>

                        {/* Search Button */}
                        <button
                            onClick={openGoogle}
                            disabled={!serpKw.trim()}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3 hover:shadow-xl transition-all hover:scale-[1.01]"
                        >
                            <Search className="w-6 h-6" />
                            Search on Google
                        </button>

                        {/* Info Box */}
                        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                            <p className="text-sm text-green-700">
                                <strong>How it works:</strong> Opens Google with gl (geo location), hl (host language), and UULE (encoded lat/lng) parameters for precise localized search results.
                                This replicates how Google shows results to users at that exact location.
                            </p>
                        </div>

                        {/* How to Use */}
                        <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">How to use</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                                <li>Select the region & language you want to search from</li>
                                <li>Enter a specific address or location and click "Geocode" for hyper-local results</li>
                                <li>Type your search query and hit "Search"</li>
                            </ol>
                        </div>
                    </>)}

                    {activeTool === 'dapa' && (<>
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6"><p className="text-amber-700 font-medium"><strong>Note:</strong> DA/PA checking requires Moz API integration.</p></div>
                        <textarea value={dapaUrls} onChange={e => setDapaUrls(e.target.value)} placeholder="Enter domains (one per line)..." className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 mb-4" />
                        <button disabled className="w-full py-3 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed font-semibold">Check DA/PA (API Required)</button>
                    </>)}

                    {activeTool === 'dr' && (<>
                        <p className="mb-3 text-xs text-gray-500">
                            Domain Rating by{' '}
                            <a
                                href="https://ahrefs.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                            >
                                Ahrefs
                            </a>
                        </p>
                        <textarea
                            value={drDomains}
                            onChange={e => setDrDomains(e.target.value)}
                            placeholder="Enter domains or URLs (one per line)&#10;example.com&#10;https://ahrefs.com/blog/&#10;semanticsx.com"
                            className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 mb-4 font-mono text-sm"
                        />

                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <button
                                onClick={checkBulkDomainRating}
                                disabled={drLoading || !drDomains.trim()}
                                className="flex-1 py-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3 hover:opacity-90 transition"
                            >
                                {drLoading ? (
                                    <><Loader2 className="w-6 h-6 animate-spin" /> Checking... {drProgress}%{drCurrentTarget && ` (${drCurrentTarget})`}</>
                                ) : (
                                    <><Gauge className="w-6 h-6" /> Check Domain Rating</>
                                )}
                            </button>
                            <button
                                onClick={() => { setDrDomains(''); setDrResults([]); setDrProgress(0); setDrCurrentTarget(''); showMessage('Cleared'); }}
                                disabled={drLoading}
                                className="px-5 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-5 h-5" /> Clear
                            </button>
                        </div>

                        {drLoading && (
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-300"
                                    style={{ width: `${drProgress}%` }}
                                />
                            </div>
                        )}

                        {drResults.length > 0 && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-sky-600 uppercase">Processed</p>
                                        <p className="text-2xl font-bold text-gray-900">{drResults.length}</p>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-emerald-600 uppercase">Successful</p>
                                        <p className="text-2xl font-bold text-gray-900">{drResults.filter(r => !r.error).length}</p>
                                    </div>
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-red-600 uppercase">Errors</p>
                                        <p className="text-2xl font-bold text-gray-900">{drResults.filter(r => r.error).length}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-gray-800">{drResults.length} domains checked</span>
                                    <button
                                        onClick={exportDrCsv}
                                        className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg font-medium hover:bg-sky-200 transition flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Export CSV
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b">Domain</th>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b">DR</th>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {drResults.map((r, i) => (
                                                <tr key={`${r.target}-${i}`} className={`border-b hover:bg-gray-50 ${r.error ? 'bg-red-50' : ''}`}>
                                                    <td className="p-3 font-mono text-xs max-w-[280px] truncate" title={r.target}>{r.target}</td>
                                                    <td className="p-3">
                                                        {r.error ? '-' : (
                                                            <span className="inline-flex min-w-[3rem] justify-center rounded-lg bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">
                                                                {Number(r.domainRating).toFixed(1)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        {r.error ? (
                                                            <span className="text-red-600">{r.error}</span>
                                                        ) : (
                                                            <span className="text-emerald-600 font-medium">Checked</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>)}

                    {activeTool === 'sitemap' && (
                        <div className="-mx-6 -mb-6">
                            <SitemapGenerator />
                        </div>
                    )}

                    {activeTool === 'robotstxt' && (
                        <div className="-mx-6 -mb-6">
                            <RobotsTxtGenerator />
                        </div>
                    )}

                    {activeTool === 'xmlextract' && (<>
                        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 mb-6">
                            <p className="text-teal-700 font-medium"><strong>XML Sitemap URL Extractor:</strong> Enter a sitemap.xml URL to extract all URLs from it.</p>
                        </div>

                        <div className="flex gap-4 mb-6">
                            <input
                                type="text"
                                value={xmlSitemapUrl}
                                onChange={e => setXmlSitemapUrl(e.target.value)}
                                placeholder="Enter sitemap URL (e.g., example.com/sitemap.xml)"
                                className="flex-1 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30"
                                onKeyDown={e => e.key === 'Enter' && !xmlLoading && extractXmlSitemap()}
                            />
                            <button
                                onClick={extractXmlSitemap}
                                disabled={xmlLoading || !xmlSitemapUrl.trim()}
                                className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {xmlLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting...</> : <><FileCode className="w-5 h-5" /> Extract URLs</>}
                            </button>
                        </div>

                        {xmlError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">{xmlError}</div>
                        )}

                        {xmlExtractedUrls.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-gray-800">{xmlExtractedUrls.length} URLs extracted</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => copyToClipboard(xmlExtractedUrls.join('\n'), 'xml')}
                                            className="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200 transition flex items-center gap-2"
                                        >
                                            {copiedSection === 'xml' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            {copiedSection === 'xml' ? 'Copied!' : 'Copy All'}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-sm">
                                    {xmlExtractedUrls.map((url, i) => (
                                        <div key={i} className="py-1 border-b border-gray-100 last:border-0 hover:bg-white px-2 rounded">{url}</div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>)}

                    {activeTool === 'bulkextract' && (<>
                        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 mb-6">
                            <p className="text-violet-700 font-medium"><strong>Bulk Meta Extractor:</strong> Enter URLs (one per line) and select what data to extract.</p>
                        </div>

                        {/* Extraction Options */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <p className="text-sm font-bold text-gray-700 mb-3">Select fields to extract:</p>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { key: 'title', label: 'Title' },
                                    { key: 'metaDescription', label: 'Meta Description' },
                                    { key: 'canonical', label: 'Canonical URL' },
                                    { key: 'robotsTag', label: 'Robots Tag' },
                                    { key: 'metaKeywords', label: 'Meta Keywords' },
                                    { key: 'wordCount', label: 'Word Count' }
                                ].map(opt => (
                                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={bulkOptions[opt.key]}
                                            onChange={e => setBulkOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                                        />
                                        <span className="text-sm text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <textarea
                            value={bulkUrls}
                            onChange={e => setBulkUrls(e.target.value)}
                            placeholder="Enter URLs (one per line)...&#10;example.com&#10;https://another-site.com/page"
                            className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/30 mb-4 font-mono text-sm"
                        />

                        <button
                            onClick={extractBulkMeta}
                            disabled={bulkLoading || !bulkUrls.trim()}
                            className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3 hover:opacity-90 transition mb-6"
                        >
                            {bulkLoading ? (
                                <><Loader2 className="w-6 h-6 animate-spin" /> Extracting... {bulkProgress}%</>
                            ) : (
                                <><Database className="w-6 h-6" /> Extract Meta Data</>
                            )}
                        </button>

                        {bulkLoading && (
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                                    style={{ width: `${bulkProgress}%` }}
                                />
                            </div>
                        )}

                        {bulkResults.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-gray-800">{bulkResults.length} URLs processed</span>
                                    <button
                                        onClick={exportBulkCsv}
                                        className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg font-medium hover:bg-violet-200 transition flex items-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" /> Export CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b">URL</th>
                                                {bulkOptions.title && <th className="text-left p-3 font-semibold text-gray-700 border-b">Title</th>}
                                                {bulkOptions.metaDescription && <th className="text-left p-3 font-semibold text-gray-700 border-b">Meta Desc</th>}
                                                {bulkOptions.canonical && <th className="text-left p-3 font-semibold text-gray-700 border-b">Canonical</th>}
                                                {bulkOptions.robotsTag && <th className="text-left p-3 font-semibold text-gray-700 border-b">Robots</th>}
                                                {bulkOptions.metaKeywords && <th className="text-left p-3 font-semibold text-gray-700 border-b">Keywords</th>}
                                                {bulkOptions.wordCount && <th className="text-left p-3 font-semibold text-gray-700 border-b">Words</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkResults.map((r, i) => (
                                                <tr key={i} className={`border-b hover:bg-gray-50 ${r.error ? 'bg-red-50' : ''}`}>
                                                    <td className="p-3 font-mono text-xs max-w-[200px] truncate" title={r.url}>{r.url}</td>
                                                    {bulkOptions.title && <td className="p-3 max-w-[200px] truncate" title={r.title}>{r.error ? <span className="text-red-500">{r.error}</span> : r.title || '-'}</td>}
                                                    {bulkOptions.metaDescription && <td className="p-3 max-w-[200px] truncate" title={r.metaDescription}>{r.metaDescription || '-'}</td>}
                                                    {bulkOptions.canonical && <td className="p-3 max-w-[150px] truncate" title={r.canonical}>{r.canonical || '-'}</td>}
                                                    {bulkOptions.robotsTag && <td className="p-3">{r.robotsTag || '-'}</td>}
                                                    {bulkOptions.metaKeywords && <td className="p-3 max-w-[150px] truncate" title={r.metaKeywords}>{r.metaKeywords || '-'}</td>}
                                                    {bulkOptions.wordCount && <td className="p-3 text-center">{r.wordCount || '-'}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>)}

                    {activeTool === 'aientities' && (<>
                        <div className="bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-fuchsia-200 rounded-xl p-4 mb-6">
                            <p className="text-fuchsia-700 font-medium"><strong>AI Keyword Entities Generator:</strong> Enter keywords separated by comma or newline, or upload a text file. AI will generate related entities for each keyword.</p>
                        </div>

                        {/* File Upload */}
                        <div className="flex gap-4 mb-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleKeywordFile}
                                accept=".txt,.csv"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-fuchsia-100 text-fuchsia-700 rounded-lg font-medium hover:bg-fuchsia-200 transition flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" /> Upload Keywords File
                            </button>
                        </div>

                        <textarea
                            value={aiKeywords}
                            onChange={e => setAiKeywords(e.target.value)}
                            placeholder="Enter keywords separated by comma or newline...&#10;keyword 1, keyword 2&#10;keyword 3&#10;keyword 4"
                            className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/30 mb-4 font-mono text-sm"
                        />

                        <button
                            onClick={generateKeywordEntities}
                            disabled={aiEntityLoading || !aiKeywords.trim()}
                            className="w-full py-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3 hover:opacity-90 transition mb-6"
                        >
                            {aiEntityLoading ? (
                                <><Loader2 className="w-6 h-6 animate-spin" /> Generating... {aiEntityProgress}% {aiEntityCurrentKw && `(${aiEntityCurrentKw})`}</>
                            ) : (
                                <><Sparkles className="w-6 h-6" /> Generate Entities with AI</>
                            )}
                        </button>

                        {aiEntityLoading && (
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-300"
                                    style={{ width: `${aiEntityProgress}%` }}
                                />
                            </div>
                        )}

                        {aiEntityResults.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-gray-800">{aiEntityResults.length} keywords processed</span>
                                    <button
                                        onClick={exportAiEntitiesCsv}
                                        className="px-4 py-2 bg-fuchsia-100 text-fuchsia-700 rounded-lg font-medium hover:bg-fuchsia-200 transition flex items-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" /> Export CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b w-1/4">Keyword</th>
                                                <th className="text-left p-3 font-semibold text-gray-700 border-b">Entities</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aiEntityResults.map((r, i) => (
                                                <tr key={i} className={`border-b hover:bg-gray-50 ${r.error ? 'bg-red-50' : ''}`}>
                                                    <td className="p-3 font-medium text-gray-900 align-top">{r.keyword}</td>
                                                    <td className="p-3">
                                                        {r.error ? (
                                                            <span className="text-red-500">{r.error}</span>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {r.entities.map((entity, j) => (
                                                                    <span key={j} className="px-2 py-1 bg-fuchsia-100 text-fuchsia-800 text-xs rounded-lg">
                                                                        {entity}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>)}
                </div>
            </div>
        </div>
    );
};

export default SEOTools;
