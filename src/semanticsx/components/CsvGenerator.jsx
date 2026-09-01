// src/components/CsvGenerator.jsx
import React, { useState } from "react";
import { Download, Bot, Settings, FileSpreadsheet, RefreshCw, LayoutTemplate, ToggleLeft, ToggleRight, UserPlus, Wand2, Link as LinkIcon, Command } from "lucide-react";
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

// --- 1. SCHEMAS & CONSTANTS ---

// API key is stored server-side for security

const BACKLINK_TYPES = [
    { id: "comment", label: "Comment Backlinks" },
    { id: "edu-backlinks", label: "EDU Backlinks" },
    { id: "gov-backlinks", label: "Gov Backlinks" },
    { id: "social-links", label: "Social Links" },
    { id: "profile-backlinks", label: "Profile Backlinks" },
    { id: "company-backlinks", label: "Company Backlinks" },
    { id: "tools-websites", label: "Tools Websites" },
    { id: "review-sites", label: "Review Sites" },
    { id: "forum-backlinks", label: "Forum Backlinks" },
    { id: "social-bookmarking", label: "Social Bookmarking" },
    { id: "article-submission", label: "Guest Posting" },
    { id: "local-citations", label: "Local Citations" },
    { id: "product-launching", label: "Product Launching" }
];

const CSV_SCHEMAS = {
    comment: ["Comment", "Name", "Email", "Website"],
    "edu-backlinks": ["Comment", "Name", "Email", "Password", "Website"],
    "gov-backlinks": ["Comment", "Name", "Email", "Website"],
    "social-links": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "profile-backlinks": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "product-launching": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "forum-backlinks": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "social-bookmarking": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address"],
    "review-sites": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "company-backlinks": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "tools-websites": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "article-submission": ["Username", "Name", "First Name", "Last Name", "Email", "Website Name", "Website", "Password", "Address", "Bio"],
    "local-citations": ["Username", "Name", "First", "Last", "Email", "Title", "Website", "Password", "Company", "Phone", "Address", "City", "State", "Zip", "Bio"]
};

// Mock Data for Random Generation
const FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez"];
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "proton.me", "icloud.com"];

// --- 2. UTILS ---

const generateCSV = (data) => {
    if (!data || !data.length) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(","), // Header row
        ...data.map(row =>
            headers.map(fieldName => {
                const val = row[fieldName] || "";
                // Remove commas and double quotes to prevent CSV parsing issues
                const sanitized = ('' + val).replace(/,/g, '').replace(/"/g, '');
                return sanitized;
            }).join(",")
        )
    ];
    return csvRows.join("\n");
};

// Helper to extract domain name (fallback if AI fails)
const extractDomainName = (url) => {
    try {
        const safeUrl = url.startsWith('http') ? url : `https://${url}`;
        const hostname = new URL(safeUrl).hostname;
        const parts = hostname.split('.');
        let name = parts[0] === 'www' ? parts[1] : parts[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (e) {
        return "";
    }
};

const getRandomIdentity = () => {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
    const num = Math.floor(Math.random() * 999);

    return {
        firstName: first,
        lastName: last,
        fullName: `${first} ${last}`,
        username: `${first.toLowerCase()}${last.toLowerCase()}${num}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${num}@${domain}`
    };
};

const generateStrongPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// --- 3. DEEPSEEK API INTEGRATION (via server-side endpoint) ---

const generateWithDeepSeek = async (type, topic, count, command = "", extraContext = []) => {
    try {
        const response = await authenticatedFetch('/api/ai-tools', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                operation: 'csv.generate',
                inputs: { type, topic, count, command, extraContext }
            })
        });

        if (!response.ok) {
            // Improved error parsing to debug API issues
            let errorMsg = response.statusText;
            try {
                const errorBody = await response.json();
                errorMsg = JSON.stringify(errorBody);
            } catch (e) {
                // Ignore parsing error
            }
            throw new Error(`DeepSeek API Error: ${response.status} - ${errorMsg}`);
        }

        const data = await response.json();
        const text = data.text;

        if (!text) throw new Error("No text returned from DeepSeek");

        const parsed = JSON.parse(text);
        return parsed.results || [];

    } catch (error) {
        console.error("DeepSeek Generation Failed:", error);
        // Return fallback data so the app doesn't crash
        return Array.from({ length: count }, (_, i) => `[Fallback] ${type} for ${topic} #${i + 1}`);
    }
};

// --- 4. MAIN COMPONENT ---

export default function CsvGenerator() {
    const [activeType, setActiveType] = useState(BACKLINK_TYPES[0].id);

    // Modes
    const [multiDomainMode, setMultiDomainMode] = useState(false);
    const [useRandomIdentity, setUseRandomIdentity] = useState(false);

    // Inputs
    const [rowCount, setRowCount] = useState(17);
    const [rawDomains, setRawDomains] = useState("");
    const [aiTopic, setAiTopic] = useState("");
    const [customPrompt, setCustomPrompt] = useState("");

    const [baseData, setBaseData] = useState({
        Name: "John Doe",
        Email: "john@example.com",
        Website: "https://example.com",
        Username: "johndoe",
        Password: "Password123!",
        "Website Name": "My Awesome Site",
        // Local Citations fields
        "Company": "",
        "Phone": "",
        "Address": "",
        "City": "",
        "State": "",
        "Zip": "",
        "Title": ""
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedRows, setGeneratedRows] = useState([]);
    const [notification, setNotification] = useState(null);

    // Get headers for current type
    const headers = CSV_SCHEMAS[activeType] || [];

    // Update default Row Count when switching types
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setActiveType(newType);
        setGeneratedRows([]);
        // Set specific row counts for each category
        const rowCounts = {
            "local-citations": 28,
            "forum-backlinks": 11,
            "tools-websites": 5,
            "company-backlinks": 3,
            "profile-backlinks": 67,
            "edu-backlinks": 20,
            "gov-backlinks": 1,
            "comment": 17
        };
        setRowCount(rowCounts[newType] || 5);
    };

    const handleBaseDataChange = (field, value) => {
        setBaseData((prev) => ({ ...prev, [field]: value }));
    };

    const generateData = async () => {
        setIsGenerating(true);
        setGeneratedRows([]);

        // Determine source of "rows"
        let domainList = [];
        let countToGenerate = rowCount;

        if (multiDomainMode) {
            // Filter empty lines
            domainList = rawDomains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
            countToGenerate = domainList.length;
            if (countToGenerate === 0) {
                showNotification("Please paste at least one domain.");
                setIsGenerating(false);
                return;
            }
        }

        let comments = [];
        let bios = [];
        let refinedNames = [];

        const needsComment = headers.includes("Comment");
        const needsBio = headers.includes("Bio");
        // "Website Name" is relevant if we are extracting from domains
        const needsWebsiteName = headers.includes("Website Name") && multiDomainMode;

        // 1. Generate AI Content
        try {
            const tasks = [];

            if (aiTopic && needsComment) {
                tasks.push(generateWithDeepSeek("comment", aiTopic, countToGenerate, customPrompt).then(res => comments = res));
            }
            if (aiTopic && needsBio) {
                // Use profile-bio for profile-backlinks to get website overview instead of random enthusiast bios
                const bioType = activeType === 'profile-backlinks' ? 'profile-bio' : 'bio';
                tasks.push(generateWithDeepSeek(bioType, aiTopic, countToGenerate, customPrompt).then(res => bios = res));
            }
            if (needsWebsiteName) {
                // Send the list of domains to AI to extract clean names
                // Pass customPrompt here so user can instruct "Remove LLC" etc.
                tasks.push(generateWithDeepSeek("domain-refine", "", countToGenerate, customPrompt, domainList).then(res => refinedNames = res));
            }

            await Promise.all(tasks);

        } catch (e) {
            console.error("AI Generation failed", e);
            showNotification("AI Generation failed. Using fallbacks.");
        }

        // 2. Build Rows
        const newRows = Array.from({ length: countToGenerate }).map((_, i) => {
            const row = {};
            const randomId = useRandomIdentity ? getRandomIdentity() : null;
            const currentDomain = multiDomainMode ? domainList[i] : (baseData["Website"] || "");

            headers.forEach((header) => {
                // Helper to sanitize CSV-breaking characters
                const sanitize = (str) => ('' + str).replace(/,/g, '').replace(/"/g, '');

                // --- CONTENT FIELDS ---
                if (header === "Comment") {
                    const rawComment = comments[i] || (aiTopic ? `[Pending AI] ${aiTopic}` : "Great post!");
                    row[header] = sanitize(rawComment);
                } else if (header === "Bio") {
                    const rawBio = bios[i] || (aiTopic ? `[Pending AI] ${aiTopic} enthusiast.` : "Content Creator.");
                    row[header] = sanitize(rawBio);

                    // --- IDENTITY FIELDS ---
                } else if (header === "Name" || header === "First" || header === "Last" || header === "First Name" || header === "Last Name") {
                    if (useRandomIdentity) {
                        if (header === "Name") row[header] = randomId.fullName;
                        if (header === "First" || header === "First Name") row[header] = randomId.firstName;
                        if (header === "Last" || header === "Last Name") row[header] = randomId.lastName;
                    } else {
                        if (header === "Name") row[header] = baseData.Name;
                        const parts = baseData.Name.split(' ');
                        if (header === "First" || header === "First Name") row[header] = parts[0] || "";
                        if (header === "Last" || header === "Last Name") row[header] = parts.slice(1).join(' ') || "";
                    }

                } else if (header === "Email") {
                    // STRICT RULE FOR EDU & Profile Backlinks: No randomization, no aliases. Use input as is.
                    if (activeType === "edu-backlinks" || activeType === "profile-backlinks") {
                        row[header] = baseData["Email"] || "";
                    } else if (useRandomIdentity) {
                        row[header] = randomId.email;
                    } else {
                        // Aliasing logic (Standard for others)
                        const [user, domain] = (baseData["Email"] || "test@test.com").split("@");
                        row[header] = `${user}+${i + 1}@${domain || 'test.com'}`;
                    }

                } else if (header === "Address") {
                    row[header] = baseData["Address"] || "";

                } else if (header === "Username") {
                    if (useRandomIdentity) {
                        row[header] = randomId.username;
                    } else {
                        row[header] = `${baseData["Username"] || "user"}${i + 1}`;
                    }

                    // --- PASSWORD FIELD ---
                } else if (header === "Password") {
                    if (activeType === "edu-backlinks") {
                        row[header] = generateStrongPassword();
                    } else {
                        row[header] = baseData.Password || "Password123!";
                    }

                    // --- WEBSITE FIELDS ---
                } else if (header === "Website") {
                    row[header] = currentDomain;

                } else if (header === "Website Name") {
                    if (multiDomainMode) {
                        // Use AI refined name if available, else fallback to extraction function
                        row[header] = refinedNames[i] || extractDomainName(currentDomain);
                    } else {
                        row[header] = baseData["Website Name"];
                    }

                } else {
                    // Fallback to base data or empty
                    row[header] = baseData[header] || "";
                }
            });
            return row;
        });

        setGeneratedRows(newRows);
        setIsGenerating(false);
        showNotification(`Generated ${newRows.length} rows successfully!`);
    };

    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    }

    const downloadCSV = () => {
        if (!generatedRows.length) return;

        const csvContent = generateCSV(generatedRows);
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${activeType}_${multiDomainMode ? 'multi' : 'single'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification("CSV Downloaded!");
    };

    return (
        <div className="h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">

                {notification && (
                    <div className="mb-4 inline-block animate-fade-in bg-green-100 text-green-700 border border-green-300 px-4 py-2 rounded-full text-sm font-medium">
                        {notification}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">

                    {/* LEFT: Sidebar / Config */}
                    <div className="w-full lg:w-1/3 space-y-6">

                        {/* Type Selector */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                                <LayoutTemplate className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-bold text-slate-700">Backlink Type</span>
                            </div>
                            <div className="p-5">
                                <select
                                    value={activeType}
                                    onChange={handleTypeChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
                                >
                                    {BACKLINK_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Configuration Form */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-bold text-slate-700">Configuration</span>
                            </div>

                            <div className="p-5 space-y-6">

                                {/* 1. DOMAIN MODE TOGGLE */}
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">Multiple Domains</span>
                                        <span className="text-[10px] text-slate-400">Turn on if you want to create backlinks for multiple domains</span>
                                    </div>
                                    <button
                                        onClick={() => setMultiDomainMode(!multiDomainMode)}
                                        className="text-blue-500 hover:text-blue-600 transition"
                                    >
                                        {multiDomainMode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                                    </button>
                                </div>

                                {/* 2. ROW SOURCE (Count vs List) */}
                                {multiDomainMode ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider flex items-center gap-2">
                                            <LinkIcon className="w-3 h-3" />
                                            Paste Domains (One per line)
                                        </label>
                                        <textarea
                                            rows={6}
                                            placeholder={`https://example.com\nhttps://mysite.org\nwww.anotherone.net`}
                                            value={rawDomains}
                                            onChange={(e) => setRawDomains(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 outline-none resize-none"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1 text-right">
                                            {rawDomains.split('\n').filter(Boolean).length} valid rows
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Row Count</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={rowCount}
                                            readOnly
                                            disabled
                                            className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-slate-500 cursor-not-allowed outline-none"
                                        />
                                    </div>
                                )}

                                <div className="h-px bg-slate-200"></div>

                                {/* 3. IDENTITY SETTINGS */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identity</span>
                                        <div
                                            className="flex items-center gap-2 cursor-pointer group"
                                            onClick={() => setUseRandomIdentity(!useRandomIdentity)}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${useRandomIdentity ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                                {useRandomIdentity && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                            <span className={`text-xs ${useRandomIdentity ? 'text-blue-500' : 'text-slate-400'} group-hover:text-blue-400 transition`}>Randomize?</span>
                                        </div>
                                    </div>

                                    {/* Base Data Inputs (Hidden if Random is ON) */}
                                    {!useRandomIdentity ? (
                                        <div className="space-y-3 animate-fade-in">
                                            {headers.includes("Name") && (
                                                <input
                                                    placeholder="Base Name (e.g. John Doe)"
                                                    value={baseData.Name}
                                                    onChange={(e) => handleBaseDataChange("Name", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            )}
                                            {headers.includes("Email") && (
                                                <input
                                                    placeholder="Base Email (e.g. john@site.com)"
                                                    value={baseData.Email}
                                                    onChange={(e) => handleBaseDataChange("Email", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            )}
                                            {headers.includes("Username") && (
                                                <input
                                                    placeholder="Base Username (e.g. johndoe)"
                                                    value={baseData.Username}
                                                    onChange={(e) => handleBaseDataChange("Username", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-3">
                                                <UserPlus className="w-5 h-5 text-blue-500" />
                                                <div className="flex flex-col">
                                                    <p className="text-xs text-blue-600">Generating unique identities.</p>
                                                </div>
                                            </div>

                                            {/* Special Case: Show Email input for EDU & Profile Backlinks even if Random is ON */}
                                            {(activeType === 'edu-backlinks' || activeType === 'profile-backlinks') && headers.includes("Email") && (
                                                <div className="animate-fade-in">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                        Static Email (Required)
                                                    </label>
                                                    <input
                                                        placeholder="Base Email (e.g. john@site.com)"
                                                        value={baseData.Email}
                                                        onChange={(e) => handleBaseDataChange("Email", e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Website Inputs (Hidden if Multi-Domain is ON) */}
                                    {!multiDomainMode && (
                                        <div className="space-y-3 pt-2">
                                            {headers.includes("Website") && (
                                                <input
                                                    placeholder="Website URL"
                                                    value={baseData.Website}
                                                    onChange={(e) => handleBaseDataChange("Website", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            )}
                                            {headers.includes("Website Name") && (
                                                <input
                                                    placeholder="Website Name (e.g. My Site)"
                                                    value={baseData["Website Name"]}
                                                    onChange={(e) => handleBaseDataChange("Website Name", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {headers.includes("Password") && activeType !== 'edu-backlinks' && (
                                        <input
                                            type="text"
                                            placeholder="Default Password"
                                            value={baseData.Password}
                                            onChange={(e) => handleBaseDataChange("Password", e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                        />
                                    )}
                                    {activeType === 'edu-backlinks' && (
                                        <div className="text-[10px] text-green-600 bg-green-50 p-2 rounded border border-green-200 text-center">
                                            Strong unique passwords enabled for EDU.
                                        </div>
                                    )}

                                    {/* Address Field for Profile Backlinks */}
                                    {activeType === 'profile-backlinks' && headers.includes("Address") && (
                                        <input
                                            placeholder="Address"
                                            value={baseData["Address"]}
                                            onChange={(e) => handleBaseDataChange("Address", e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                        />
                                    )}

                                    {/* Local Citations Fields */}
                                    {activeType === 'local-citations' && (
                                        <div className="space-y-3 pt-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Local Business Details
                                            </label>
                                            <input
                                                placeholder="Company"
                                                value={baseData["Company"]}
                                                onChange={(e) => handleBaseDataChange("Company", e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Title (e.g. Owner, Manager)"
                                                value={baseData["Title"]}
                                                onChange={(e) => handleBaseDataChange("Title", e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Phone"
                                                value={baseData["Phone"]}
                                                onChange={(e) => handleBaseDataChange("Phone", e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Address"
                                                value={baseData["Address"]}
                                                onChange={(e) => handleBaseDataChange("Address", e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    placeholder="City"
                                                    value={baseData["City"]}
                                                    onChange={(e) => handleBaseDataChange("City", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                                <input
                                                    placeholder="State"
                                                    value={baseData["State"]}
                                                    onChange={(e) => handleBaseDataChange("State", e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                            <input
                                                placeholder="Zip"
                                                value={baseData["Zip"]}
                                                onChange={(e) => handleBaseDataChange("Zip", e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-slate-200"></div>

                                {/* 4. AI CONFIGURATION */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Bot className="w-3 h-3" />
                                        AI Settings
                                    </label>

                                    <input
                                        type="text"
                                        placeholder="Company Name / Topic (Required for Content)"
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        className="w-full bg-slate-50 border border-blue-300 rounded-lg p-2.5 text-slate-800 focus:border-blue-500 transition"
                                    />

                                    <div className="relative">
                                        <Command className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Custom Command (e.g. 'Use emojis', 'Be witty')"
                                            value={customPrompt}
                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 p-2.5 text-slate-800 focus:border-purple-500 transition text-xs"
                                        />
                                    </div>
                                </div>


                                {/* ACTION BUTTON */}
                                <button
                                    onClick={generateData}
                                    disabled={isGenerating}
                                    className={`w-full py-3.5 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-4
                    ${isGenerating ? 'bg-slate-400 cursor-wait' : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 hover:shadow-blue-500/25'}`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            {multiDomainMode ? 'Processing Domains...' : 'Generating...'}
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-5 h-5" />
                                            Generate Data
                                        </>
                                    )}
                                </button>

                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Preview Table */}
                    <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                                Data Preview
                            </h3>
                            {generatedRows.length > 0 && (
                                <button
                                    onClick={downloadCSV}
                                    className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition hover:shadow-lg hover:shadow-green-500/20"
                                >
                                    <Download className="w-4 h-4" />
                                    Download CSV
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto">
                            {generatedRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center h-96">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Settings className="w-10 h-10 opacity-50" />
                                    </div>
                                    <h4 className="text-lg font-medium text-slate-600 mb-2">Ready to Generate</h4>
                                    <p className="text-sm max-w-sm">
                                        {multiDomainMode
                                            ? "Paste your domains on the left and click Generate to extract names and build the CSV."
                                            : "Configure your settings and click Generate to see the results here."}
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm text-slate-600 border-collapse">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-slate-200 w-12 text-center bg-slate-50">#</th>
                                            {headers.map(h => (
                                                <th key={h} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap bg-slate-50 font-semibold tracking-wide">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedRows.map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition group">
                                                <td className="px-4 py-3 font-mono text-slate-400 text-center border-r border-slate-100">{idx + 1}</td>
                                                {headers.map(h => (
                                                    <td key={h} className="px-4 py-3 max-w-[250px] truncate group-hover:text-slate-800 transition-colors" title={row[h]}>
                                                        {row[h]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-2 bg-slate-50 border-t border-slate-200 text-xs text-center text-slate-400 flex justify-between px-4">
                            <span>Status: {isGenerating ? 'Processing...' : 'Ready'}</span>
                            <span>{generatedRows.length} rows generated</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
