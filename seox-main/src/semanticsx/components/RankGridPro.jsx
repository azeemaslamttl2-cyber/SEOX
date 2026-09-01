import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../contexts/ThemeContext';
import { callDeepSeekAPI } from '../services/ai';
import {
    Hexagon,
    MapPin,
    Search,
    Globe,
    Zap,
    Key,
    ArrowRight,
    History,
    ChevronUp,
    ChevronDown,
    Plus,
    Minus,
    Layers,
    HelpCircle,
    Loader2,
    AlertCircle,
    CheckCircle,
    X,
    Menu,
    PanelLeftClose,
    FileDown,
    ChevronLeft,
    ChevronRight,
    Grid3X3,
    Target,
    Clock3,
    MapPinned,
    BarChart3,
    Sparkles,
    RefreshCcw,
    Star,
    Calendar,
    Trash2,
    Trophy
} from 'lucide-react';

// --- History localStorage helpers ---
const HISTORY_KEY = 'rankgrid_pro_history';

const loadHistory = () => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
};

const saveHistoryEntry = (entry) => {
    try {
        const entries = loadHistory();
        entries.unshift(entry); // newest first
        // Keep max 50 entries
        if (entries.length > 50) entries.length = 50;
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
        return entries;
    } catch { return []; }
};

const deleteHistoryEntry = (id) => {
    try {
        const entries = loadHistory().filter(e => e.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
        return entries;
    } catch { return []; }
};

// Calibrate radius behavior to match competitor scale
const COVERAGE_RADIUS_SCALE = 2;

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom zoom controls component using useMap hook
const ZoomControls = ({ isDarkMode }) => {
    const map = useMap();

    return (
        <div className="absolute top-16 right-4 z-[1000] flex flex-col gap-1">
            <button
                onClick={() => map.zoomIn()}
                className={`w-9 h-9 backdrop-blur-sm border rounded-md flex items-center justify-center transition-colors ${isDarkMode
                    ? 'bg-[#0f0f0f]/90 border-[#1f1f1f] hover:bg-[#1a1a1a]'
                    : 'bg-white/90 border-gray-200 hover:bg-gray-100'
                    }`}
            >
                <Plus className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
            <button
                onClick={() => map.zoomOut()}
                className={`w-9 h-9 backdrop-blur-sm border rounded-md flex items-center justify-center transition-colors ${isDarkMode
                    ? 'bg-[#0f0f0f]/90 border-[#1f1f1f] hover:bg-[#1a1a1a]'
                    : 'bg-white/90 border-gray-200 hover:bg-gray-100'
                    }`}
            >
                <Minus className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
            <div className="mt-2">
                <button className={`w-9 h-9 backdrop-blur-sm border rounded-md flex items-center justify-center transition-colors ${isDarkMode
                    ? 'bg-[#0f0f0f]/90 border-[#1f1f1f] hover:bg-[#1a1a1a]'
                    : 'bg-white/90 border-gray-200 hover:bg-gray-100'
                    }`}>
                    <Layers className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                </button>
            </div>
        </div>
    );
};

// Component to update map center and zoom programmatically
const MapUpdater = ({ center, zoom }) => {
    const map = useMap();

    useEffect(() => {
        if (center && center.lat && center.lng) {
            map.flyTo([center.lat, center.lng], zoom, {
                duration: 1.5
            });
        }
    }, [map, center, zoom]);

    return null;
};

// Component to fit map bounds to grid points when results are shown
const MapFitBounds = ({ gridPoints, active }) => {
    const map = useMap();

    useEffect(() => {
        if (active && gridPoints && gridPoints.length > 0) {
            const bounds = L.latLngBounds(gridPoints.map(p => [p.lat, p.lng]));
            // paddingTopLeft accounts for the results sidebar overlay
            map.fitBounds(bounds.pad(0.15), {
                paddingTopLeft: [580, 20],
                paddingBottomRight: [20, 20],
                maxZoom: 14,
                animate: true,
                duration: 1.2
            });
        }
    }, [map, active, gridPoints]);

    return null;
};

// Helper to render markdown-like text (bold, bullet points)
const InsightRenderer = ({ text }) => {
    if (!text) return null;

    // Split by newlines but filter out empty lines to avoid excess spacing
    const lines = text.split('\n').filter(line => line.trim() !== '');

    return (
        <div className="w-full text-left text-sm text-gray-700 leading-relaxed max-h-[280px] overflow-y-auto space-y-3 pr-2">
            {lines.map((line, i) => {
                const trimmed = line.trim();

                // Identify list items
                const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
                const content = isBullet ? trimmed.substring(2) : trimmed;

                // Parse bold syntax: **text**
                const parts = content.split(/(\*\*.*?\*\*)/g);

                const renderedContent = parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                });

                if (isBullet) {
                    return (
                        <div key={i} className="flex gap-2 items-start">
                            <span className="text-gray-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>{renderedContent}</span>
                        </div>
                    );
                }

                return <p key={i}>{renderedContent}</p>;
            })}
        </div>
    );
};

// Convert axial hex coordinates to latitude/longitude offsets
const axialToLatLng = (center, q, r, hexSizeKm) => {
    // Rotate lattice so ring vertices align with top/bottom apex (matches target shape)
    const xKm = hexSizeKm * 1.5 * q;
    const yKm = hexSizeKm * Math.sqrt(3) * (r + q / 2);
    const lat = center.lat + (yKm / 111);
    const lng = center.lng + (xKm / (111 * Math.cos(center.lat * Math.PI / 180)));
    return { lat, lng };
};

// Generate honeycomb grid points with true hex-lattice positioning
const generateHoneycombGrid = (center, rings, radiusMiles) => {
    const points = [];
    const radiusKm = radiusMiles * COVERAGE_RADIUS_SCALE * 1.60934;
    const hexSizeKm = radiusKm / (rings * 2 || 1);

    points.push({ lat: center.lat, lng: center.lng, ring: 0, index: 0, q: 0, r: 0 });
    if (rings === 0) return points;

    // Clockwise axial directions for pointy-top orientation
    const directions = [
        [1, 0],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [0, -1],
        [1, -1]
    ];

    for (let ring = 1; ring <= rings; ring++) {
        // Start from top vertex of each ring
        let q = 0;
        let r = -ring;

        for (let side = 0; side < 6; side++) {
            for (let step = 0; step < ring; step++) {
                const pos = axialToLatLng(center, q, r, hexSizeKm);
                points.push({
                    lat: pos.lat,
                    lng: pos.lng,
                    ring,
                    index: points.length,
                    q,
                    r
                });
                q += directions[side][0];
                r += directions[side][1];
            }
        }
    }

    return points;
};

// Calculate total points for given rings
const calculateTotalPoints = (rings) => {
    if (rings === 0) return 1;
    let total = 1;
    for (let r = 1; r <= rings; r++) {
        total += r * 6;
    }
    return total;
};

const distanceScore = (latA, lngA, latB, lngB) => {
    if (![latA, lngA, latB, lngB].every(Number.isFinite)) {
        return Number.POSITIVE_INFINITY;
    }
    const dLat = latA - latB;
    const dLng = lngA - lngB;
    return (dLat * dLat) + (dLng * dLng);
};

// Haversine distance in miles between two lat/lng points
const haversineDistanceMiles = (lat1, lng1, lat2, lng2) => {
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const extractBusinessFromGoogleMapsUrl = (rawUrl) => {
    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        throw new Error('Please paste a valid URL.');
    }

    const host = parsedUrl.hostname.toLowerCase();
    if (!host.includes('google.') || !parsedUrl.pathname.includes('/maps')) {
        throw new Error('Please paste a Google Maps business URL.');
    }

    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    const placePathMatch = decodedPath.match(/\/maps\/place\/([^/]+)/i);
    const placeName = placePathMatch?.[1]
        ? placePathMatch[1].replace(/\+/g, ' ').trim()
        : (parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query') || '').trim();

    const atMatch = rawUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    let lat = atMatch ? parseFloat(atMatch[1]) : null;
    let lng = atMatch ? parseFloat(atMatch[2]) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const llParam = parsedUrl.searchParams.get('ll') || parsedUrl.searchParams.get('sll');
        if (llParam) {
            const [llLat, llLng] = llParam.split(',').map((v) => parseFloat(v));
            lat = Number.isFinite(llLat) ? llLat : null;
            lng = Number.isFinite(llLng) ? llLng : null;
        }
    }

    return {
        placeName,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null
    };
};

// Custom hexagon marker for preview grid points (before analysis)
const createHexIcon = (accentColor, markerId, isCenter = false) => {
    const size = isCenter ? 24 : 20;
    const radius = isCenter ? 10 : 8;
    const strokeWidth = isCenter ? 2.5 : 1.5;
    const strokeOpacity = isCenter ? 1 : 0.7;
    const startOpacity = isCenter ? 0.7 : 0.49;
    const peakOpacity = isCenter ? 1 : 0.7;
    const animationName = `hexPulse-${markerId}`;
    const delay = (markerId * 0.05).toFixed(2);
    const gradientId = `hex-preview-gradient-${markerId}`;
    const viewHalf = size / 2;

    const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (-30 + i * 60) * Math.PI / 180;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return `${x},${y}`;
    }).join(' L');

    return L.divIcon({
        className: 'hexagon-preview-icon',
        html: `
            <svg width="${size}" height="${size}" viewBox="-${viewHalf} -${viewHalf} ${size} ${size}" style="overflow: visible;" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color: ${accentColor}; stop-opacity: 0.3" />
                        <stop offset="100%" style="stop-color: ${accentColor}; stop-opacity: 0.15" />
                    </linearGradient>
                </defs>
                <path d="M${points}Z"
                    fill="url(#${gradientId})"
                    stroke="${accentColor}"
                    stroke-width="${strokeWidth}"
                    stroke-opacity="${strokeOpacity}"
                    style="animation: ${animationName} 2s ease-in-out infinite; animation-delay: ${delay}s;" />
                ${isCenter ? `<circle cx="0" cy="0" r="3" fill="${accentColor}" opacity="0.9"></circle>` : ''}
            </svg>
            <style>
                @keyframes ${animationName} {
                    0%, 100% { opacity: ${startOpacity}; transform: scale(1); }
                    50% { opacity: ${peakOpacity}; transform: scale(1.05); }
                }
            </style>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

// Custom marker for rank display (after analysis)
const createRankIcon = (rank, isTargetBusiness, accentColor, markerId = 0, isSelected = false) => {
    const hasRank = rank !== null && rank !== undefined && rank > 0;

    // Color tiers for ranked businesses
    const getRankColors = (r) => {
        if (r <= 3) return { start: '#22c55e', end: '#16a34a' }; // green
        if (r <= 10) return { start: '#eab308', end: '#ca8a04' }; // yellow
        if (r <= 20) return { start: '#f97316', end: '#ea580c' }; // orange
        return { start: '#ef4444', end: '#dc2626' }; // red
    };

    // Not-found: gray gradient. Found: colored gradient
    const colors = hasRank ? getRankColors(rank) : { start: '#52525b', end: '#3f3f46' };
    const displayText = hasRank ? (rank > 20 ? '20+' : rank) : '—';
    const fontSize = hasRank ? (isSelected ? '13px' : '11px') : (isSelected ? '13px' : '11px');

    const size = isSelected ? 45.54 : 39.6;
    const half = size / 2;
    const hexR = isSelected ? 20.7 : 18;
    const gradId = `hex-grad-${markerId}-${rank || 'null'}`;

    // Pointy-top hexagon path
    const hexPath = Array.from({ length: 6 }, (_, i) => {
        const angle = (60 * i - 90) * Math.PI / 180;
        return `${Math.cos(angle) * hexR},${Math.sin(angle) * hexR}`;
    }).map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(' ') + 'Z';

    const strokeColor = isSelected ? '#ffffff' : 'rgba(0,0,0,0.3)';
    const strokeWidth = isSelected ? 2.5 : 1;
    const filterStyle = isSelected
        ? `filter: drop-shadow(0 0 6px rgba(${hasRank ? '34, 197, 94' : '82, 82, 91'}, 0.3)) drop-shadow(0 0 3px rgba(255,255,255,0.4));`
        : 'filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));';

    return L.divIcon({
        className: 'hexagon-marker',
        html: `
    <div class="hex-marker-wrapper " style="position: relative; width: ${size}px; height: ${size}px; ${filterStyle}">
      <svg width="${size}" height="${size}" viewBox="-${half} -${half} ${size} ${size}" style="overflow: visible;">
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${colors.start}"></stop>
            <stop offset="100%" stop-color="${colors.end}"></stop>
          </linearGradient>
        </defs>
        <path d="${hexPath}" fill="url(#${gradId})" stroke="${strokeColor}" stroke-width="${strokeWidth}"></path>
        <text x="0" y="1" text-anchor="middle" dominant-baseline="central" fill="white" font-weight="700" font-size="${fontSize}" font-family="system-ui, -apple-system, sans-serif" style="text-shadow: 0 1px 2px rgba(0,0,0,0.6);">${displayText}</text>
      </svg>
    </div>
        `,
        iconSize: [size, size],
        iconAnchor: [half, half],
    });
};

// Pulsing center icon for the main business location
const createCenterIcon = (centerRank) => {
    const rankDisplay = (centerRank && centerRank > 0) ? centerRank : '—';
    const badgeBg = (centerRank && centerRank > 0)
        ? (centerRank <= 3 ? '#22c55e' : centerRank <= 10 ? '#eab308' : '#f97316')
        : '#52525b';

    return L.divIcon({
        className: 'pulsing-center-icon',
        html: `
    <div class="pulsing-center-wrapper" style="position: relative; width: 56px; height: 56px;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(66, 133, 244, 0.5); animation: pulse-expand 2s ease-out infinite;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(66, 133, 244, 0.3); animation: pulse-expand 2s ease-out infinite 0.6s;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(66, 133, 244, 0.15); animation: pulse-expand 2s ease-out infinite 1.2s;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; border-radius: 8px; border: 2px solid rgba(66, 133, 244, 0.8); animation: pulse-ring 1.5s ease-out infinite;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; border-radius: 6px; background: #4285F4; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.4), 0 0 15px rgba(66, 133, 244, 0.35); overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 10px; display: flex;">
          <div style="flex: 1; background: #1A73E8;"></div>
          <div style="flex: 1; background: #4285F4;"></div>
          <div style="flex: 1; background: #1A73E8;"></div>
          <div style="flex: 1; background: #4285F4;"></div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="margin-top: 4px;">
          <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"></path>
        </svg>
      </div>
      <div style="position: absolute; bottom: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, ${badgeBg} 0%, ${badgeBg} 100%); border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 9px; box-shadow: 0 2px 5px rgba(0,0,0,0.4); font-family: system-ui, -apple-system, sans-serif;">${rankDisplay}</div>
    </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
    });
};

const RankGridPro = () => {
    const { isDarkMode } = useTheme();

    // State
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [businessSearch, setBusinessSearch] = useState('');
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [businessSuggestions, setBusinessSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isServiceAreaMode, setIsServiceAreaMode] = useState(false);
    const [serviceAreaUrl, setServiceAreaUrl] = useState('');
    const [isResolvingServiceAreaUrl, setIsResolvingServiceAreaUrl] = useState(false);
    const [serviceAreaError, setServiceAreaError] = useState('');
    const [keyword, setKeyword] = useState('');
    const [website, setWebsite] = useState('');
    const [rings, setRings] = useState(2);
    const [radius, setRadius] = useState(3);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [results, setResults] = useState(null);
    const [showResultsView, setShowResultsView] = useState(false);
    const [selectedResultPointIndex, setSelectedResultPointIndex] = useState(0);
    const [reportTimestamp, setReportTimestamp] = useState(null);
    const [analysisProgress, setAnalysisProgress] = useState({
        completed: 0,
        total: 0,
        message: 'Preparing analysis...',
        percent: 0
    });
    const [showResultGridPoints, setShowResultGridPoints] = useState(true);
    const [showTrafficHeatmap, setShowTrafficHeatmap] = useState(false);
    const [showBadgesLayer, setShowBadgesLayer] = useState(false);
    const [populationLayer, setPopulationLayer] = useState('None');
    const [gridPoints, setGridPoints] = useState([]);
    const [leaderboardTab, setLeaderboardTab] = useState('global');
    const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 }); // USA center
    const [mapZoom, setMapZoom] = useState(4);
    const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [insightsText, setInsightsText] = useState('');
    const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyEntries, setHistoryEntries] = useState(() => loadHistory());

    // Refs
    const mapRef = useRef(null);
    const businessInputRef = useRef(null);
    const autocompleteServiceRef = useRef(null);
    const placesServiceRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    // Calculate credits/cost
    const totalPoints = useMemo(() => calculateTotalPoints(rings), [rings]);

    // Google API Key from Vite environment (for Places Autocomplete)
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    // Load Google Maps Script
    useEffect(() => {
        if (!googleApiKey || googleMapsLoaded) return;

        // Check if already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
            setGoogleMapsLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            setGoogleMapsLoaded(true);
        };
        script.onerror = () => {
            console.error('Failed to load Google Maps script');
        };
        document.head.appendChild(script);

        return () => {
            // Cleanup if needed
        };
    }, [googleApiKey, googleMapsLoaded]);

    // Initialize Places services when Google Maps is loaded
    useEffect(() => {
        if (googleMapsLoaded && window.google && window.google.maps && window.google.maps.places) {
            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
            // Create a dummy div for PlacesService (required by Google)
            const dummyDiv = document.createElement('div');
            placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        }
    }, [googleMapsLoaded]);

    // Generate grid preview when business is selected
    useEffect(() => {
        if (selectedBusiness) {
            const points = generateHoneycombGrid(
                { lat: selectedBusiness.lat, lng: selectedBusiness.lng },
                rings,
                radius
            );
            setGridPoints(points);
            setMapCenter({ lat: selectedBusiness.lat, lng: selectedBusiness.lng });
            // Dynamic zoom based on effective competitor-matched radius
            const effectiveRadius = radius * COVERAGE_RADIUS_SCALE;
            const zoomLevel = effectiveRadius <= 6
                ? 13
                : effectiveRadius <= 10
                    ? 12.5
                    : effectiveRadius <= 14
                        ? 12
                        : effectiveRadius <= 20
                            ? 11
                            : 10.5;
            setMapZoom(zoomLevel);
        }
    }, [selectedBusiness, rings, radius]);

    // Handle business search with Google Places Autocomplete
    const handleBusinessSearchInput = useCallback((query) => {
        setBusinessSearch(query);

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!query || query.length < 2) {
            setBusinessSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Debounce search
        searchTimeoutRef.current = setTimeout(() => {
            if (autocompleteServiceRef.current && googleMapsLoaded) {
                setIsSearching(true);
                autocompleteServiceRef.current.getPlacePredictions(
                    {
                        input: query,
                        types: ['establishment'] // Focus on businesses
                    },
                    (predictions, status) => {
                        setIsSearching(false);
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                            setBusinessSuggestions(predictions);
                            setShowSuggestions(true);
                        } else {
                            setBusinessSuggestions([]);
                            // Try fallback on error
                            handleBusinessSearchFallback(query);
                        }
                    }
                );
            } else {
                // Fallback to Nominatim if Google isn't loaded
                handleBusinessSearchFallback(query);
            }
        }, 300);
    }, [googleMapsLoaded, googleApiKey]);

    // Select a business from suggestions
    const handleSelectBusiness = useCallback((prediction) => {
        if (!placesServiceRef.current) return;

        setIsSearching(true);
        placesServiceRef.current.getDetails(
            {
                placeId: prediction.place_id,
                fields: ['name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total']
            },
            (place, status) => {
                setIsSearching(false);
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    setSelectedBusiness({
                        name: place.name,
                        address: place.formatted_address,
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        rating: place.rating,
                        reviewCount: place.user_ratings_total,
                        placeId: prediction.place_id
                    });
                    setBusinessSearch(place.name);
                    setShowSuggestions(false);
                    setBusinessSuggestions([]);
                }
            }
        );
    }, []);

    // Fallback business search using Nominatim
    const handleBusinessSearchFallback = async (query) => {
        if (!query || query.length < 3) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const suggestions = data.map((place, idx) => ({
                    place_id: `nominatim_${idx}`,
                    description: place.display_name,
                    structured_formatting: {
                        main_text: place.display_name.split(',')[0],
                        secondary_text: place.display_name.split(',').slice(1).join(',').trim()
                    },
                    _nominatim: place // Store original data
                }));
                setBusinessSuggestions(suggestions);
                setShowSuggestions(true);
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle fallback selection (Nominatim)
    const handleSelectBusinessFallback = (suggestion) => {
        const place = suggestion._nominatim;
        setSelectedBusiness({
            name: place.display_name.split(',')[0],
            address: place.display_name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon)
        });
        setBusinessSearch(place.display_name.split(',')[0]);
        setShowSuggestions(false);
        setBusinessSuggestions([]);
    };

    const handleResolveServiceAreaBusiness = useCallback(async () => {
        setServiceAreaError('');

        const mapsUrl = serviceAreaUrl.trim();
        if (!mapsUrl) {
            setServiceAreaError('Paste a Google Maps URL first.');
            return;
        }

        let extracted;
        try {
            extracted = extractBusinessFromGoogleMapsUrl(mapsUrl);
        } catch (err) {
            setServiceAreaError(err.message);
            return;
        }

        if (!extracted.placeName && (!Number.isFinite(extracted.lat) || !Number.isFinite(extracted.lng))) {
            setServiceAreaError('Could not read business details from this URL.');
            return;
        }

        setIsResolvingServiceAreaUrl(true);
        try {
            if (placesServiceRef.current && window.google?.maps?.places) {
                const request = {
                    query: extracted.placeName || `${extracted.lat},${extracted.lng}`
                };

                if (Number.isFinite(extracted.lat) && Number.isFinite(extracted.lng)) {
                    request.location = new window.google.maps.LatLng(extracted.lat, extracted.lng);
                    request.radius = 5000;
                }

                const matchedPlace = await new Promise((resolve, reject) => {
                    placesServiceRef.current.textSearch(request, (results, status) => {
                        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
                            reject(new Error('No matching place found'));
                            return;
                        }

                        let bestMatch = results[0];
                        if (Number.isFinite(extracted.lat) && Number.isFinite(extracted.lng)) {
                            bestMatch = [...results].sort((a, b) => {
                                const latA = typeof a.geometry?.location?.lat === 'function' ? a.geometry.location.lat() : a.geometry?.location?.lat;
                                const lngA = typeof a.geometry?.location?.lng === 'function' ? a.geometry.location.lng() : a.geometry?.location?.lng;
                                const latB = typeof b.geometry?.location?.lat === 'function' ? b.geometry.location.lat() : b.geometry?.location?.lat;
                                const lngB = typeof b.geometry?.location?.lng === 'function' ? b.geometry.location.lng() : b.geometry?.location?.lng;
                                return distanceScore(latA, lngA, extracted.lat, extracted.lng) - distanceScore(latB, lngB, extracted.lat, extracted.lng);
                            })[0];
                        }

                        resolve(bestMatch);
                    });
                });

                const lat = typeof matchedPlace.geometry.location.lat === 'function'
                    ? matchedPlace.geometry.location.lat()
                    : matchedPlace.geometry.location.lat;
                const lng = typeof matchedPlace.geometry.location.lng === 'function'
                    ? matchedPlace.geometry.location.lng()
                    : matchedPlace.geometry.location.lng;

                setSelectedBusiness({
                    name: matchedPlace.name || extracted.placeName || 'Resolved Business',
                    address: matchedPlace.formatted_address || 'Address unavailable',
                    lat,
                    lng,
                    rating: matchedPlace.rating,
                    reviewCount: matchedPlace.user_ratings_total,
                    placeId: matchedPlace.place_id
                });
                setBusinessSearch(matchedPlace.name || extracted.placeName || '');
                setShowSuggestions(false);
                setBusinessSuggestions([]);
                setServiceAreaUrl('');
                setIsServiceAreaMode(false);
                return;
            }

            const fallbackQuery = extracted.placeName || `${extracted.lat},${extracted.lng}`;
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=5`
            );
            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No matching place found');
            }

            let bestMatch = data[0];
            if (Number.isFinite(extracted.lat) && Number.isFinite(extracted.lng)) {
                bestMatch = [...data].sort((a, b) => (
                    distanceScore(parseFloat(a.lat), parseFloat(a.lon), extracted.lat, extracted.lng)
                    - distanceScore(parseFloat(b.lat), parseFloat(b.lon), extracted.lat, extracted.lng)
                ))[0];
            }

            const resolvedName = extracted.placeName || bestMatch.display_name.split(',')[0];
            setSelectedBusiness({
                name: resolvedName,
                address: bestMatch.display_name,
                lat: parseFloat(bestMatch.lat),
                lng: parseFloat(bestMatch.lon)
            });
            setBusinessSearch(resolvedName);
            setShowSuggestions(false);
            setBusinessSuggestions([]);
            setServiceAreaUrl('');
            setIsServiceAreaMode(false);
        } catch {
            setServiceAreaError('Could not resolve this URL. Try a full Google Maps place link.');
        } finally {
            setIsResolvingServiceAreaUrl(false);
        }
    }, [serviceAreaUrl]);

    // Run analysis
    const runAnalysis = async () => {
        if (!selectedBusiness || !keyword) {
            setError('Please select a business and enter a keyword');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResults(null);
        setShowResultsView(false);
        setSelectedResultPointIndex(0);

        try {
            const points = generateHoneycombGrid(
                { lat: selectedBusiness.lat, lng: selectedBusiness.lng },
                rings,
                radius
            );

            const progressMessages = [
                "Scanning Google's Map Pack rankings...",
                'Checking local proximity signals...',
                'Evaluating each geogrid point...',
                'Collecting business rank positions...'
            ];

            setAnalysisProgress({
                completed: 0,
                total: points.length,
                message: progressMessages[0],
                percent: 0
            });

            setGridPoints(points);
            const allResults = new Array(points.length).fill(null);

            // Parse target domain once outside the loop
            let targetDomain = null;
            if (website) {
                try {
                    targetDomain = new URL(website.startsWith('http') ? website : `https://${website}`)
                        .hostname
                        .replace('www.', '');
                } catch {
                    targetDomain = null;
                }
            }
            const businessName = selectedBusiness.name.toLowerCase();

            // Process a single grid point and return the result
            const processPoint = async (point, index) => {
                try {
                    // Round coordinates to 7 decimal places (DataforSEO API limit)
                    const roundedLat = parseFloat(point.lat.toFixed(7));
                    const roundedLng = parseFloat(point.lng.toFixed(7));
                    const response = await fetch('/api/proxy', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            service: 'dataforseo',
                            action: 'google_maps_serp',
                            lat: roundedLat,
                            lng: roundedLng,
                            keyword: keyword,
                            language_code: 'en',
                            zoom: 15
                        })
                    });

                    const data = await response.json();
                    let resultPoint = { ...point, rank: null, found: false, error: 'No results' };

                    if (data.error) {
                        console.warn(`[RankGrid] Point ${index} failed:`, data.status_message || data.message || data.error);
                        resultPoint = { ...point, rank: null, found: false, error: data.status_message || data.message || data.error };
                    } else if (data.success && data.results) {
                        const items = data.results || [];

                        // Find target business rank
                        let rank = null;
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const itemDomain = (item.domain || '').replace('www.', '');
                            const itemTitle = (item.title || '').toLowerCase();

                            if (
                                (targetDomain && itemDomain.includes(targetDomain)) ||
                                itemTitle.includes(businessName)
                            ) {
                                rank = item.rank_absolute || (i + 1);
                                break;
                            }
                        }

                        resultPoint = {
                            ...point,
                            rank: rank,
                            found: rank !== null,
                            items: items
                        };
                    }
                    return resultPoint;
                } catch (err) {
                    return { ...point, rank: null, found: false, error: err.message };
                }
            };

            // Process in parallel batches (smaller batch = less rate-limit risk)
            const BATCH_SIZE = 3;
            let completedCount = 0;

            for (let batchStart = 0; batchStart < points.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, points.length);
                const batch = points.slice(batchStart, batchEnd);

                setAnalysisProgress({
                    completed: completedCount,
                    total: points.length,
                    message: progressMessages[batchStart % progressMessages.length],
                    percent: Math.round((completedCount / points.length) * 100)
                });

                // Fire all requests in this batch concurrently
                const batchResults = await Promise.all(
                    batch.map((point, i) => processPoint(point, batchStart + i))
                );

                // Store results in correct order
                for (let i = 0; i < batchResults.length; i++) {
                    allResults[batchStart + i] = batchResults[i];
                }
                completedCount += batchResults.length;

                setAnalysisProgress({
                    completed: completedCount,
                    total: points.length,
                    message: progressMessages[batchStart % progressMessages.length],
                    percent: Math.round((completedCount / points.length) * 100)
                });
                setGridPoints(allResults.filter(Boolean));

                // Small delay between batches to avoid rate limiting
                if (batchEnd < points.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setResults(allResults);
            setGridPoints(allResults);
            const ts = new Date();
            setReportTimestamp(ts);
            setShowResultsView(true);

            // Save to history
            const rankedPts = allResults.filter(p => typeof p.rank === 'number' && p.rank > 0);
            const avgR = rankedPts.length ? (rankedPts.reduce((a, p) => a + p.rank, 0) / rankedPts.length) : 0;
            const entry = {
                id: `rg_${Date.now()}`,
                businessName: selectedBusiness.name,
                keyword,
                website,
                lat: selectedBusiness.lat,
                lng: selectedBusiness.lng,
                rings,
                radius,
                totalPoints: points.length,
                foundCount: rankedPts.length,
                averageRank: parseFloat(avgR.toFixed(1)),
                timestamp: ts.toISOString(),
                results: allResults
            };
            setHistoryEntries(saveHistoryEntry(entry));

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };


    // Theme-aware accent color (#312e81 indigo scheme)
    const accentColor = isDarkMode ? '#818cf8' : '#312e81';
    const accentColorHover = isDarkMode ? '#a5b4fc' : '#3730a3';
    const markerAccentColor = (isLoading || showResultsView) ? '#8b5cf6' : accentColor;
    const boundaryColor = (isLoading || showResultsView) ? '#8b5cf6' : accentColor;
    const rankedResults = useMemo(
        () => (results || []).filter((point) => typeof point.rank === 'number' && point.rank > 0),
        [results]
    );
    const averageRank = useMemo(() => {
        if (!rankedResults.length) return 0;
        return rankedResults.reduce((acc, point) => acc + point.rank, 0) / rankedResults.length;
    }, [rankedResults]);
    const coveragePercent = useMemo(() => {
        if (!results?.length) return 0;
        return Math.round((rankedResults.length / results.length) * 100);
    }, [rankedResults, results]);
    const proximityScore = useMemo(() => {
        if (!rankedResults.length) return 0;
        return Math.max(0, Math.min(100, 100 - Math.round((averageRank - 1) * 10)));
    }, [averageRank, rankedResults]);
    const top10Count = useMemo(
        () => rankedResults.filter((point) => point.rank <= 10).length,
        [rankedResults]
    );
    const currentPointResult = results?.[selectedResultPointIndex] || null;
    const atPointRows = currentPointResult?.items || [];

    // Global leaderboard: aggregate all businesses across all grid points
    const globalLeaderboard = useMemo(() => {
        if (!results?.length) return [];
        const bizMap = {};
        for (const point of results) {
            if (!point.items?.length) continue;
            for (const item of point.items) {
                const key = item.title || item.domain || 'Unknown';
                if (!bizMap[key]) {
                    bizMap[key] = { title: key, ranks: [], totalAppearances: 0 };
                }
                bizMap[key].ranks.push(item.rank_absolute || item.rank_group || 20);
                bizMap[key].totalAppearances += 1;
            }
        }
        return Object.values(bizMap)
            .map((biz) => {
                const avgRank = biz.ranks.reduce((a, b) => a + b, 0) / biz.ranks.length;
                const prox = Math.max(0, Math.min(100, Math.round(100 - (avgRank - 1) * 5)));
                return {
                    title: biz.title,
                    avgRank: parseFloat(avgRank.toFixed(1)),
                    prox,
                    pts: biz.totalAppearances
                };
            })
            .sort((a, b) => a.avgRank - b.avgRank || b.prox - a.prox)
            .slice(0, 10);
    }, [results]);

    const leaderboardRows = leaderboardTab === 'global' ? globalLeaderboard : atPointRows;
    const reportTimeText = reportTimestamp
        ? reportTimestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '-';

    const resetToSetupMode = () => {
        setShowResultsView(false);
        setResults(null);
        setSelectedResultPointIndex(0);
        setInsightsText('');
        setIsGeneratingInsights(false);
        if (selectedBusiness) {
            const points = generateHoneycombGrid(
                { lat: selectedBusiness.lat, lng: selectedBusiness.lng },
                rings,
                radius
            );
            setGridPoints(points);
        }
    };

    const loadHistoryEntry = (entry) => {
        setResults(entry.results);
        setGridPoints(entry.results);
        setSelectedResultPointIndex(0);
        setReportTimestamp(new Date(entry.timestamp));
        setKeyword(entry.keyword);
        setWebsite(entry.website || '');
        setRings(entry.rings);
        setRadius(entry.radius);
        setSelectedBusiness({ name: entry.businessName, lat: entry.lat, lng: entry.lng });
        setBusinessSearch(entry.businessName);
        setMapCenter({ lat: entry.lat, lng: entry.lng });
        setMapZoom(12);
        setShowResultsView(true);
        setShowHistory(false);
        setShowResultGridPoints(true);
        setInsightsText('');
        setIsGeneratingInsights(false);
    };

    const handleDeleteHistory = (id) => {
        setHistoryEntries(deleteHistoryEntry(id));
    };

    const generateInsights = async () => {
        setIsGeneratingInsights(true);
        setInsightsText('');
        try {
            const top5 = globalLeaderboard.slice(0, 5).map((b, i) => `${i + 1}. ${b.title} (avg rank ${b.avgRank.toFixed(1)}, appeared at ${b.pts} points)`).join('\n');
            const prompt = `You are an expert local SEO analyst. Analyze the following Google Maps rank grid data and provide 3-5 concise, actionable insights.\n\nBusiness: ${selectedBusiness?.name || 'Unknown'}\nKeyword: "${keyword}"\nGrid: ${results?.length || 0} points, ${radius}mi radius\nAverage Rank: ${averageRank ? averageRank.toFixed(1) : 'N/A'}\nCoverage: ${coveragePercent}% (found at ${rankedResults.length}/${results?.length || 0} points)\nProximity Score: ${proximityScore}\n\nTop 5 competitors in the area:\n${top5}\n\nProvide actionable insights about:\n- How this business ranks relative to competitors\n- Geographic ranking patterns\n- Specific recommendations to improve local visibility\n\nKeep each insight to 1-2 sentences. Use bullet points.`;
            const response = await callDeepSeekAPI(prompt, 'rankgrid_insights');
            setInsightsText(response);
        } catch (err) {
            setInsightsText('⚠️ Could not generate insights. ' + (err.message || 'Please try again.'));
        } finally {
            setIsGeneratingInsights(false);
        }
    };

    return (
        <div className={`h-[calc(100vh-4rem)] flex relative overflow-hidden ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-100'}`}>
            {/* Pulse animation keyframes for center marker */}
            <style>{`
                @keyframes pulse-expand {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
                }
                @keyframes pulse-ring {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.4; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                }
                .pulsing-center-icon { background: none !important; border: none !important; }
                .hexagon-marker { background: none !important; border: none !important; }

                /* Print styles for Export PDF */
                @media print {
                    /* Hide everything in the page except our results */
                    body > *:not(#root),
                    nav, aside, header, footer,
                    .leaflet-container,
                    [data-rankgrid-map],
                    [data-rankgrid-noprint] {
                        display: none !important;
                    }

                    /* Make all parent containers flow naturally */
                    body, #root, #root > *, #root > * > * {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* The results panel: full-width, static, no backdrop */
                    [data-rankgrid-print] {
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                        backdrop-filter: none !important;
                        z-index: auto !important;
                        padding: 0 !important;
                    }

                    [data-rankgrid-print] * {
                        color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Hide action buttons row */
                    [data-rankgrid-print] .no-print {
                        display: none !important;
                    }

                    /* Make scrollable areas expand fully */
                    [data-rankgrid-print] [class*="max-h-"],
                    [data-rankgrid-print] [class*="overflow-y"],
                    [data-rankgrid-print] [class*="overflow-auto"] {
                        max-height: none !important;
                        overflow: visible !important;
                    }

                    @page {
                        margin: 0.5in;
                        size: portrait;
                    }
                }
            `}</style>
            {/* Map Container */}
            <div className="flex-1 relative">
                <MapContainer
                    ref={mapRef}
                    center={[mapCenter.lat, mapCenter.lng]}
                    zoom={mapZoom}
                    className="h-full w-full"
                    zoomControl={false}
                    zoomSnap={0.5}
                    zoomDelta={0.5}
                >
                    <TileLayer
                        url={isDarkMode
                            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        }
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    />

                    {/* Update map position when center/zoom changes */}
                    <MapUpdater center={mapCenter} zoom={mapZoom} />

                    {/* Zoom out to fit all grid points when results are shown */}
                    <MapFitBounds gridPoints={gridPoints} active={showResultsView} />

                    {/* Hexagonal coverage boundary (dashed) */}
                    {selectedBusiness && gridPoints.length > 0 && rings > 0 && (() => {
                        const radiusKm = radius * COVERAGE_RADIUS_SCALE * 1.60934;
                        const hexSizeKm = radiusKm / (rings * 2 || 1);

                        // Vertices of a pointy-top hex in axial coords (no extra padding)
                        const vertices = [
                            [0, -rings],
                            [rings, -rings],
                            [rings, 0],
                            [0, rings],
                            [-rings, rings],
                            [-rings, 0]
                        ];

                        const hexPoints = vertices.map(([q, r]) => {
                            const pos = axialToLatLng(selectedBusiness, q, r, hexSizeKm);
                            return [pos.lat, pos.lng];
                        });

                        return (
                            <Polygon
                                positions={hexPoints}
                                pathOptions={{
                                    color: boundaryColor,
                                    fillColor: boundaryColor,
                                    fillOpacity: 0.06,
                                    weight: 2,
                                    dashArray: '8, 8'
                                }}
                            />
                        );
                    })()}

                    {/* Grid points */}
                    {(!showResultsView || showResultGridPoints) && gridPoints.map((point, idx) => (
                        <Marker
                            key={`pt-${idx}-${point.rank}-${point.found}`}
                            position={[point.lat, point.lng]}
                            icon={
                                point.rank !== undefined
                                    ? createRankIcon(point.rank, point.found, markerAccentColor, idx, showResultsView && selectedResultPointIndex === idx)
                                    : createHexIcon(markerAccentColor, idx, point.ring === 0)
                            }
                            eventHandlers={showResultsView ? {
                                click: () => setSelectedResultPointIndex(idx)
                            } : {}}
                        >
                            {!showResultsView && (
                                <Popup>
                                    <div className="text-sm">
                                        <p className="font-semibold">Point {idx + 1}</p>
                                        {point.rank ? (
                                            <p className="text-green-600">Rank: #{point.rank}</p>
                                        ) : results ? (
                                            <p className="text-red-500">Not in top 20</p>
                                        ) : (
                                            <p className="text-gray-500">Pending analysis</p>
                                        )}
                                    </div>
                                </Popup>
                            )}
                        </Marker>
                    ))}

                    {/* Pulsing center marker for main business location */}
                    {showResultsView && selectedBusiness && (() => {
                        const centerPoint = results?.find(p => p.ring === 0);
                        const centerRank = centerPoint?.rank || null;
                        return (
                            <Marker
                                position={[selectedBusiness.lat, selectedBusiness.lng]}
                                icon={createCenterIcon(centerRank)}
                                zIndexOffset={1000}
                            />
                        );
                    })()}

                    {/* Zoom Controls - using useMap hook */}
                    <ZoomControls isDarkMode={isDarkMode} />
                </MapContainer>

                {showResultsView && (
                    <>
                        <div data-rankgrid-print="true" className="absolute inset-y-0 left-0 z-[1002] w-[min(58vw,980px)] bg-white/95 border-r border-gray-200 backdrop-blur-sm overflow-y-auto shadow-xl">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xl font-bold text-gray-900 truncate">
                                            {selectedBusiness?.name || 'RankGrid Results'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            "{keyword || 'N/A'}" · {totalPoints}x19 · {radius}mi
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 no-print">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                document.body.classList.add('rankgrid-printing');
                                                setTimeout(() => {
                                                    window.print();
                                                    document.body.classList.remove('rankgrid-printing');
                                                }, 100);
                                            }}
                                            className="h-10 px-3 rounded border border-gray-200 bg-white text-sm text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50 shadow-sm"
                                        >
                                            <FileDown className="w-4 h-4" />
                                            Export PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowHistory(true); setShowResultsView(false); }}
                                            className="h-10 px-3 rounded border border-gray-200 bg-white text-sm text-gray-700 inline-flex items-center gap-2 hover:bg-gray-50 shadow-sm"
                                        >
                                            <History className="w-4 h-4" />
                                            History
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetToSetupMode}
                                            className="h-10 px-4 rounded bg-[#312e81] text-white text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#3730a3] shadow-sm"
                                        >
                                            <RefreshCcw className="w-4 h-4" />
                                            New Analysis
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                                            <BarChart3 className="w-3 h-3" />
                                            Average Rank
                                        </p>
                                        <p className="text-3xl font-bold text-indigo-500 mt-1">
                                            {averageRank ? averageRank.toFixed(1) : '0.0'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {averageRank && averageRank <= 3 ? 'Excellent' : averageRank && averageRank <= 10 ? 'Competitive' : 'Needs work'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            Proximity Score
                                        </p>
                                        <p className="text-3xl font-bold text-pink-500 mt-1">{proximityScore}</p>
                                        <p className="text-xs text-gray-400 mt-1">Local only</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                                            <MapPinned className="w-3 h-3" />
                                            Coverage
                                        </p>
                                        <p className="text-3xl font-bold text-rose-500 mt-1">{coveragePercent}%</p>
                                        <p className="text-xs text-gray-400 mt-1">{rankedResults.length}/{results?.length || 0} points</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
                                            <Clock3 className="w-3 h-3" />
                                            Report Time
                                        </p>
                                        <p className="text-2xl font-bold text-gray-700 mt-1">{reportTimeText}</p>
                                        <p className="text-xs text-gray-400 mt-1">in less than a minute</p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedResultPointIndex((prev) => Math.max(0, prev - 1))}
                                            disabled={selectedResultPointIndex <= 0}
                                            className="w-8 h-8 rounded border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center hover:bg-gray-100"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="text-sm text-gray-800 font-semibold">
                                            Point {selectedResultPointIndex + 1} of {results?.length || 0}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedResultPointIndex((prev) => Math.min((results?.length || 1) - 1, prev + 1))}
                                            disabled={selectedResultPointIndex >= (results?.length || 1) - 1}
                                            className="w-8 h-8 rounded border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center hover:bg-gray-100"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {currentPointResult?.rank ? (
                                            <span className="h-8 px-4 rounded-full bg-indigo-500 text-white font-bold text-sm inline-flex items-center">
                                                #{currentPointResult.rank}
                                            </span>
                                        ) : (
                                            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 border-transparent bg-gray-200 text-gray-600 text-sm font-bold">
                                                Not Found
                                            </div>
                                        )}
                                        <span className="text-gray-500 text-sm">{top10Count} in Top 10</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[1.25fr_1fr] gap-2">
                                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                                        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                                            <span className="text-gray-800 font-semibold text-sm">Leaderboard</span>
                                            <div className="flex items-center gap-1 bg-gray-100 rounded p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setLeaderboardTab('global')}
                                                    className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${leaderboardTab === 'global'
                                                        ? 'bg-white text-gray-800 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    Top 10
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLeaderboardTab('point')}
                                                    className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${leaderboardTab === 'point'
                                                        ? 'bg-white text-gray-800 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                        }`}
                                                >
                                                    At Point
                                                </button>
                                            </div>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="text-gray-400 uppercase text-[10px] sticky top-0 bg-white z-10">
                                                    {leaderboardTab === 'global' ? (
                                                        <tr className="border-b border-gray-100">
                                                            <th className="px-2 py-2 text-left w-10">#</th>
                                                            <th className="px-2 py-2 text-left">Business</th>
                                                            <th className="px-2 py-2 text-right w-16">Avg Rank</th>
                                                            <th className="px-2 py-2 text-right w-14">Prox</th>
                                                            <th className="px-2 py-2 text-right w-12">Pts</th>
                                                        </tr>
                                                    ) : (
                                                        <tr className="border-b border-gray-100">
                                                            <th className="px-2 py-2 text-left w-10">#</th>
                                                            <th className="px-2 py-2 text-left">Business</th>
                                                            <th className="px-2 py-2 text-right w-16">Rating</th>
                                                            <th className="px-2 py-2 text-right w-16">Reviews</th>
                                                            <th className="px-2 py-2 text-right w-14">Dist</th>
                                                        </tr>
                                                    )}
                                                </thead>
                                                <tbody>
                                                    {leaderboardTab === 'global' ? (
                                                        globalLeaderboard.length > 0 ? globalLeaderboard.map((item, index) => {
                                                            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
                                                            return (
                                                                <tr key={`global-${item.title}-${index}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50">
                                                                    <td className="px-2 py-1.5 font-medium">{medal}</td>
                                                                    <td className="px-2 py-1.5 truncate max-w-[200px]">{item.title}</td>
                                                                    <td className="px-2 py-1.5 text-right">{item.avgRank.toFixed(1)}</td>
                                                                    <td className="px-2 py-1.5 text-right font-semibold text-indigo-500">{item.prox}</td>
                                                                    <td className="px-2 py-1.5 text-right text-gray-400">{item.pts}</td>
                                                                </tr>
                                                            );
                                                        }) : (
                                                            <tr>
                                                                <td className="px-2 py-4 text-gray-400" colSpan={5}>No data available.</td>
                                                            </tr>
                                                        )
                                                    ) : (
                                                        atPointRows.length > 0 ? atPointRows.map((item, index) => {
                                                            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
                                                            const rowTitle = item.title || item.domain || `Business ${index + 1}`;
                                                            const rating = item.rating;
                                                            const reviews = item.votes_count || 0;
                                                            const pointLat = currentPointResult?.lat;
                                                            const pointLng = currentPointResult?.lng;
                                                            const dist = haversineDistanceMiles(pointLat, pointLng, item.latitude, item.longitude);
                                                            return (
                                                                <tr key={`point-${rowTitle}-${index}`} className="border-b border-gray-100 text-gray-700 hover:bg-gray-50">
                                                                    <td className="px-2 py-1.5 font-medium">{medal}</td>
                                                                    <td className="px-2 py-1.5"><span className="truncate block max-w-[200px]">{rowTitle}</span></td>
                                                                    <td className="px-2 py-1.5 text-right">
                                                                        {rating != null ? (
                                                                            <span className="flex items-center justify-end gap-0.5">
                                                                                <Star className="w-2.5 h-2.5 text-yellow-500" />
                                                                                {rating}
                                                                            </span>
                                                                        ) : '—'}
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-right text-gray-500">{reviews}</td>
                                                                    <td className="px-2 py-1.5 text-right text-gray-500">{dist != null ? `${dist.toFixed(1)}mi` : '—'}</td>
                                                                </tr>
                                                            );
                                                        }) : (
                                                            <tr>
                                                                <td className="px-2 py-4 text-gray-400" colSpan={5}>No SERP rows found for this point.</td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-white p-5 flex flex-col items-center justify-center text-center shadow-sm">
                                        {insightsText ? (
                                            <>
                                                <InsightRenderer text={insightsText} />
                                                <button
                                                    type="button"
                                                    onClick={generateInsights}
                                                    disabled={isGeneratingInsights}
                                                    className="mt-4 h-9 px-4 rounded bg-gray-100 text-gray-600 font-semibold text-xs uppercase tracking-wider hover:bg-gray-200 inline-flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    <RefreshCcw className="w-3 h-3" />
                                                    Regenerate
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-6 h-6 text-amber-500" />
                                                <p className="text-gray-500 mt-3">Get AI-powered insights for your rankings</p>
                                                <button
                                                    type="button"
                                                    onClick={generateInsights}
                                                    disabled={isGeneratingInsights}
                                                    className="mt-4 h-10 px-5 rounded bg-[#312e81] text-white font-bold uppercase tracking-wider hover:bg-[#3730a3] disabled:opacity-50 inline-flex items-center gap-2"
                                                >
                                                    {isGeneratingInsights ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Analyzing...
                                                        </>
                                                    ) : (
                                                        'Generate Insights'
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <p className="text-gray-800 font-semibold">Traffic Tracking</p>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Enable tracking</p>
                                            <p className="text-xs text-gray-400">Monitor performance changes over time.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowTrafficHeatmap((prev) => !prev)}
                                            className={`w-14 h-7 rounded-full relative transition-colors ${showTrafficHeatmap ? 'bg-[#312e81]' : 'bg-gray-200'}`}
                                        >
                                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${showTrafficHeatmap ? 'left-8' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute top-20 right-6 z-[1003] group">
                            <button className="w-10 h-10 rounded-lg border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <Grid3X3 className="w-4 h-4 text-gray-600" />
                            </button>
                            <div className="absolute top-0 right-0 w-52 rounded-lg border border-gray-200 bg-white/95 p-3 backdrop-blur-sm shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-wide text-gray-400">Data Layers</p>
                                    <Grid3X3 className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="mt-3 space-y-3 text-sm">
                                    <label className="flex items-center justify-between text-gray-700">
                                        <span>Grid Points</span>
                                        <input
                                            type="checkbox"
                                            checked={showResultGridPoints}
                                            onChange={(e) => setShowResultGridPoints(e.target.checked)}
                                            className="accent-[#312e81]"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between text-gray-700">
                                        <span>Traffic Heatmap</span>
                                        <input
                                            type="checkbox"
                                            checked={showTrafficHeatmap}
                                            onChange={(e) => setShowTrafficHeatmap(e.target.checked)}
                                            className="accent-[#312e81]"
                                        />
                                    </label>
                                    <div className="space-y-1">
                                        <p className="text-gray-400 text-xs">Population Data</p>
                                        <select
                                            value={populationLayer}
                                            onChange={(e) => setPopulationLayer(e.target.value)}
                                            className="w-full h-9 rounded border border-gray-200 bg-white text-gray-700 text-sm px-2"
                                        >
                                            <option>None</option>
                                            <option>Density</option>
                                            <option>Household Income</option>
                                        </select>
                                    </div>
                                    <label className="flex items-center justify-between text-gray-700">
                                        <span>Ad Badges</span>
                                        <input
                                            type="checkbox"
                                            checked={showBadgesLayer}
                                            onChange={(e) => setShowBadgesLayer(e.target.checked)}
                                            className="accent-[#312e81]"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* History View */}
                {showHistory && (
                    <div className={`absolute inset-0 z-[1200] overflow-auto ${isDarkMode ? 'bg-[#080b12]' : 'bg-gray-50'}`}>
                        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        <Grid3X3 className="w-6 h-6 text-indigo-500" />
                                        RankGrid Pro History
                                    </h1>
                                    <p className="text-gray-500 text-sm mt-1">View your past grid analyses</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowHistory(false); resetToSetupMode(); }}
                                        className={`h-10 px-4 rounded text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-sm ${isDarkMode
                                            ? 'bg-[#c8ff00] text-black hover:bg-[#d4ff33]'
                                            : 'bg-[#312e81] text-white hover:bg-[#3730a3]'
                                        }`}
                                    >
                                        <Grid3X3 className="w-4 h-4" />
                                        New Analysis
                                    </button>
                                </div>
                            </div>

                            {historyEntries.length === 0 ? (
                                <div className={`rounded-xl border p-12 text-center ${isDarkMode
                                    ? 'border-gray-800 bg-[#0d1017]'
                                    : 'border-gray-200 bg-white shadow-sm'
                                }`}>
                                    <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No analyses yet</p>
                                    <p className="text-sm text-gray-500 mt-1">Run your first analysis to see it here.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {historyEntries.map((entry) => {
                                        const avgRank = entry.averageRank || 0;
                                        const badgeColor = avgRank <= 3 ? 'bg-green-500/10 text-green-500'
                                            : avgRank <= 7 ? 'bg-yellow-500/10 text-yellow-500'
                                            : 'bg-red-500/10 text-red-500';
                                        const date = new Date(entry.timestamp);
                                        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                                        return (
                                            <div
                                                key={entry.id}
                                                className={`rounded-xl border transition-colors ${isDarkMode
                                                    ? 'border-gray-800 bg-[#0d1017] hover:border-indigo-500/50'
                                                    : 'border-gray-200 bg-white shadow-sm hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="p-5">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                                {entry.businessName}
                                                            </h3>
                                                            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                                                                <Target className="w-3 h-3" />
                                                                {entry.keyword}
                                                            </p>
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}>
                                                            Avg: {avgRank}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-4">
                                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Grid3X3 className="w-3.5 h-3.5" />
                                                                {entry.totalPoints}pts
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                {entry.radius}mi
                                                            </span>
                                                            <span>Found: {entry.foundCount}/{entry.totalPoints}</span>
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {dateStr}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteHistory(entry.id)}
                                                                className={`p-2 rounded transition-colors ${isDarkMode
                                                                    ? 'hover:bg-red-500/10 text-gray-500 hover:text-red-400'
                                                                    : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                                                                }`}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => loadHistoryEntry(entry)}
                                                                className={`h-9 px-3 rounded text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${isDarkMode
                                                                    ? 'border border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                                                                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                View Results
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isLoading && (
                    <>
                        <div className={`absolute inset-0 z-[1100] backdrop-blur-[2px] ${isDarkMode ? 'bg-black/70' : 'bg-white/60'}`} />
                        <div className={`absolute left-4 top-4 z-[1102] w-[290px] rounded-xl border p-4 ${isDarkMode
                            ? 'border-[#1f2330] bg-[#080b12]/95'
                            : 'border-gray-200 bg-white/95 shadow-lg'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg border inline-flex items-center justify-center ${isDarkMode
                                    ? 'bg-indigo-400/10 border-indigo-400/30'
                                    : 'bg-indigo-50 border-indigo-200'
                                    }`}>
                                    <Grid3X3 className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`} />
                                </div>
                                <div>
                                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Analyzing Grid</p>
                                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{analysisProgress.message}</p>
                                </div>
                            </div>
                            <div className={`mt-3 h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1b2130]' : 'bg-gray-200'}`}>
                                <div
                                    className={`h-full transition-all duration-300 ${isDarkMode ? 'bg-indigo-400' : 'bg-[#312e81]'}`}
                                    style={{ width: `${analysisProgress.percent}%` }}
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs">
                                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{analysisProgress.completed} of {analysisProgress.total} points</span>
                                <span className={`font-semibold ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`}>{analysisProgress.percent}%</span>
                            </div>
                        </div>

                        <div className="absolute inset-0 z-[1101] flex items-center justify-center px-4">
                            <div className={`w-full max-w-[380px] rounded-3xl border p-7 text-center shadow-2xl ${isDarkMode
                                ? 'border-[#1f2330] bg-[#080b12]/95'
                                : 'border-gray-200 bg-white/95'
                                }`}>
                                <div className={`mx-auto w-20 h-20 rounded-2xl border inline-flex items-center justify-center ${isDarkMode
                                    ? 'bg-indigo-400/10 border-indigo-400/30'
                                    : 'bg-indigo-50 border-indigo-200'
                                    }`}>
                                    <Grid3X3 className={`w-9 h-9 ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`} />
                                </div>
                                <h3 className={`mt-6 text-3xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Analyzing Your Grid</h3>
                                <div className={`mt-6 h-3 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1b2130]' : 'bg-gray-200'}`}>
                                    <div
                                        className={`h-full transition-all duration-300 ${isDarkMode ? 'bg-indigo-400' : 'bg-[#312e81]'}`}
                                        style={{ width: `${analysisProgress.percent}%` }}
                                    />
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{analysisProgress.completed} of {analysisProgress.total} points</p>
                                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`}>{analysisProgress.percent}%</p>
                                </div>
                                <div className={`mt-5 h-12 rounded-lg border px-4 flex items-center gap-3 ${isDarkMode
                                    ? 'border-[#1f2330] bg-[#0b1018]'
                                    : 'border-gray-200 bg-gray-50'
                                    }`}>
                                    <Search className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`} />
                                    <p className={`text-sm text-left truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{analysisProgress.message}</p>
                                </div>
                            </div>
                        </div>

                        <div className={`absolute right-4 bottom-4 z-[1102] rounded-xl border px-4 py-3 text-sm ${isDarkMode
                            ? 'border-[#1f2330] bg-[#080b12]/95 text-gray-200'
                            : 'border-gray-200 bg-white/95 text-gray-700 shadow-lg'
                            }`}>
                            Running RankGrid analysis for {analysisProgress.total} points...
                        </div>
                    </>
                )}

                {/* Help button */}
                {!isLoading && !showResultsView && (
                    <div className="absolute top-4 right-4 z-[1000]">
                        <button className={`w-10 h-10 backdrop-blur-sm border rounded-md flex items-center justify-center transition-colors ${isDarkMode
                            ? 'bg-[#0f0f0f]/90 border-[#1f1f1f] hover:bg-[#1a1a1a]'
                            : 'bg-white/90 border-gray-200 hover:bg-gray-100'
                            }`}>
                            <HelpCircle className={`w-4 h-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                        </button>
                    </div>
                )}

                {/* Bottom message */}
                {!selectedBusiness && !showResultsView && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className={`backdrop-blur-sm border rounded-xl px-6 py-3 text-center ${isDarkMode
                            ? 'bg-[#0f0f0f]/90 border-[#1f1f1f]'
                            : 'bg-white/90 border-gray-200 shadow-lg'
                            }`}>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Search for your business to see the grid preview on the map
                            </p>
                        </div>
                    </div>
                )}

                {/* Mobile Toggle Button - Only visible on small screens */}
                {!showResultsView && (
                    <button
                        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                        className={`fixed bottom-6 right-6 z-[1001] md:hidden p-4 rounded-full shadow-lg transition-all ${isDarkMode
                            ? 'bg-[#312e81] text-white hover:bg-[#3730a3]'
                            : 'bg-[#312e81] text-white hover:bg-[#3730a3]'
                            }`}
                    >
                        {showMobileSidebar ? <PanelLeftClose className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                )}
            </div>

            {/* Configuration Panel */}
            {!showResultsView && (
                <div className={`absolute top-4 left-4 z-[1000] w-[380px] max-w-[calc(100vw-2rem)] backdrop-blur-xl border rounded-2xl shadow-2xl transition-all duration-300 ease-out max-h-[calc(100vh-6rem)] overflow-y-auto 
                ${isDarkMode
                        ? 'bg-[#0f0f0f]/95 border-[#1f1f1f] shadow-black/20'
                        : 'bg-white/95 border-gray-200 shadow-gray-300/30'
                    }
                ${showMobileSidebar ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100'}
            `}>
                    {/* Header */}
                    <div
                        className={`flex items-center justify-between p-4 cursor-pointer border-b ${isDarkMode ? 'border-[#1f1f1f]' : 'border-gray-200'
                            }`}
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-[#312e81]/10' : 'bg-indigo-100'}`}>
                                <Hexagon className={`w-5 h-5 ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`} />
                            </div>
                            <div>
                                <h2 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>RankGrid Pro</h2>
                                <p className="text-xs text-gray-500">Configure analysis</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                className={`p-2 rounded transition-colors ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-gray-100'}`}
                                onClick={(e) => { e.stopPropagation(); setShowHistory(true); setHistoryEntries(loadHistory()); }}
                            >
                                <History className="w-4 h-4 text-gray-400" />
                            </button>
                            <button className={`p-2 rounded transition-colors ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-gray-100'}`}>
                                {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                            </button>
                        </div>
                    </div>

                    {/* Form */}
                    {!isCollapsed && (
                        <form className="p-4 space-y-5" onSubmit={(e) => { e.preventDefault(); runAnalysis(); }}>
                            {/* Business Search */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center justify-between">
                                    <span>Your Business</span>
                                    {googleMapsLoaded && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                            Google Places ✓
                                        </span>
                                    )}
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        ref={businessInputRef}
                                        type="text"
                                        className={`w-full h-10 pl-9 pr-9 border rounded text-sm transition-colors focus:outline-none focus:ring-1 ${isDarkMode
                                            ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500/30'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#312e81] focus:ring-[#312e81]/30'
                                            }`}
                                        placeholder="Search for your Google Business..."
                                        value={businessSearch}
                                        onChange={(e) => handleBusinessSearchInput(e.target.value)}
                                        onFocus={() => businessSuggestions.length > 0 && setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                        </div>
                                    )}
                                    {businessSearch && !isSearching && (
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                            onClick={() => {
                                                setBusinessSearch('');
                                                setSelectedBusiness(null);
                                                setBusinessSuggestions([]);
                                                setShowSuggestions(false);
                                            }}
                                        >
                                            <X className={`w-4 h-4 ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                                        </button>
                                    )}

                                    {/* Suggestions Dropdown */}
                                    {showSuggestions && businessSuggestions.length > 0 && (
                                        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto ${isDarkMode
                                            ? 'bg-[#1a1a1a] border-[#2a2a2a]'
                                            : 'bg-white border-gray-200'
                                            }`}>
                                            {businessSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={suggestion.place_id || idx}
                                                    type="button"
                                                    className={`w-full px-3 py-2.5 text-left flex items-start gap-2 transition-colors ${isDarkMode
                                                        ? 'hover:bg-[#2a2a2a] border-b border-[#2a2a2a] last:border-0'
                                                        : 'hover:bg-gray-50 border-b border-gray-100 last:border-0'
                                                        }`}
                                                    onClick={() => {
                                                        if (suggestion._nominatim) {
                                                            handleSelectBusinessFallback(suggestion);
                                                        } else {
                                                            handleSelectBusiness(suggestion);
                                                        }
                                                    }}
                                                >
                                                    <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                                            {suggestion.structured_formatting?.main_text || suggestion.description?.split(',')[0]}
                                                        </p>
                                                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                            {suggestion.structured_formatting?.secondary_text || suggestion.description?.split(',').slice(1).join(',').trim()}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedBusiness && (
                                    <div className={`p-2 border rounded-lg ${isDarkMode
                                        ? 'bg-[#312e81]/10 border-[#312e81]/20'
                                        : 'bg-indigo-50 border-indigo-200'
                                        }`}>
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-medium ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`}>{selectedBusiness.name}</p>
                                                <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{selectedBusiness.address}</p>
                                            </div>
                                            {selectedBusiness.rating && (
                                                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                                    <span className="text-yellow-500">★</span>
                                                    <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {selectedBusiness.rating} ({selectedBusiness.reviewCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsServiceAreaMode((prev) => !prev);
                                        setServiceAreaError('');
                                    }}
                                    className={`text-xs transition-colors ${isDarkMode
                                        ? 'text-gray-500 hover:text-indigo-400'
                                        : 'text-gray-500 hover:text-[#312e81]'
                                        }`}
                                >
                                    Can't find your business? (Service Area Business)
                                </button>

                                {isServiceAreaMode && (
                                    <div className="space-y-3">
                                        <div className={`p-3 border rounded-lg ${isDarkMode
                                            ? 'bg-amber-500/10 border-amber-500/30'
                                            : 'bg-amber-50 border-amber-200'
                                            }`}>
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                                                <div>
                                                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                                                        Service Area Business Mode
                                                    </p>
                                                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        Paste your Google Maps URL to add a business with a hidden address.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className={`flex-1 h-10 px-3 border rounded text-sm transition-colors focus:outline-none focus:ring-1 ${isDarkMode
                                                    ? 'bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500/30'
                                                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#312e81] focus:ring-[#312e81]/30'
                                                    }`}
                                                placeholder="Paste Google Maps URL..."
                                                value={serviceAreaUrl}
                                                onChange={(e) => setServiceAreaUrl(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleResolveServiceAreaBusiness}
                                                disabled={isResolvingServiceAreaUrl}
                                                className={`h-10 px-4 rounded text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${isDarkMode
                                                    ? 'bg-[#312e81] text-white hover:bg-[#3730a3]'
                                                    : 'bg-[#312e81] text-white hover:bg-[#3730a3]'
                                                    }`}
                                            >
                                                {isResolvingServiceAreaUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolve'}
                                            </button>
                                        </div>

                                        {serviceAreaError && (
                                            <p className="text-xs text-red-400">{serviceAreaError}</p>
                                        )}

                                        {selectedBusiness && (
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <CheckCircle className="w-3 h-3 text-indigo-500" />
                                                <span className={`truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                                    {selectedBusiness.name}
                                                </span>
                                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                                                    SAB
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!googleApiKey && (
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKeyModal(true)}
                                        className={`text-xs transition-colors flex items-center gap-1 ${isDarkMode
                                            ? 'text-gray-500 hover:text-indigo-400'
                                            : 'text-gray-500 hover:text-[#312e81]'
                                            }`}
                                    >
                                        <Key className="w-3 h-3" />
                                        Add Google API key for better results
                                    </button>
                                )}
                            </div>

                            {/* Search Keyword */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Search Keyword
                                </label>
                                <input
                                    type="text"
                                    className={`w-full h-10 px-3 border rounded text-sm transition-colors focus:outline-none focus:ring-1 ${isDarkMode
                                        ? 'bg-[#1a1a1a]/50 border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500/30'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#312e81] focus:ring-[#312e81]/30'
                                        }`}
                                    placeholder="e.g., plumber near me"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                />
                            </div>

                            {/* Website (Optional) */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                                    <Globe className="w-3 h-3" />
                                    Website (Optional)
                                </label>
                                <input
                                    type="text"
                                    className={`w-full h-10 px-3 border rounded text-sm transition-colors focus:outline-none focus:ring-1 ${isDarkMode
                                        ? 'bg-[#1a1a1a]/50 border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500/30'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#312e81] focus:ring-[#312e81]/30'
                                        }`}
                                    placeholder="https://yourbusiness.com"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                />
                            </div>

                            {/* Analysis Settings */}
                            <div className={`space-y-4 p-3 rounded-xl border ${isDarkMode
                                ? 'bg-[#1a1a1a]/50 border-[#2a2a2a]'
                                : 'bg-gray-50 border-gray-200'
                                }`}>
                                {/* Analysis Rings */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                                            <Hexagon className="w-3 h-3" />
                                            Analysis Rings
                                        </label>
                                        <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`}>
                                            {rings} {rings === 1 ? 'ring' : 'rings'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((r) => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setRings(r)}
                                                className={`flex-1 h-9 rounded text-sm font-medium transition-colors ${rings === r
                                                    ? isDarkMode
                                                        ? 'bg-[#312e81] text-white'
                                                        : 'bg-[#312e81] text-white'
                                                    : isDarkMode
                                                        ? 'bg-transparent text-gray-400 hover:bg-[#1f1f1f]'
                                                        : 'bg-transparent text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalPoints}</span> analysis points in honeycomb pattern
                                    </p>
                                </div>

                                {/* Coverage Radius */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Coverage Radius
                                        </label>
                                        <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`}>
                                            {radius} mi
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        value={radius}
                                        onChange={(e) => setRadius(parseInt(e.target.value))}
                                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${(radius - 1) / 49 * 100}%, ${isDarkMode ? '#2a2a2a' : '#d1d5db'} ${(radius - 1) / 49 * 100}%, ${isDarkMode ? '#2a2a2a' : '#d1d5db'} 100%)`
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Cost Display */}
                            <div className="space-y-2">
                                <div className={`flex items-center justify-between p-3 border rounded-xl ${isDarkMode
                                    ? 'bg-[#312e81]/5 border-[#312e81]/20'
                                    : 'bg-indigo-50 border-indigo-200'
                                    }`}>
                                    <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Cost</span>
                                    <div className="flex items-center gap-2">
                                        <Zap className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-[#312e81]'}`} />
                                        <span className={`font-mono font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalPoints}</span>
                                        <span className="text-sm text-gray-500">credits</span>
                                    </div>
                                </div>

                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !selectedBusiness || !keyword}
                                className={`w-full h-12 font-semibold uppercase tracking-widest rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${isDarkMode
                                    ? 'bg-[#312e81] text-white shadow-[0_0_20px_rgba(49,46,129,0.4)] hover:bg-[#3730a3]'
                                    : 'bg-[#312e81] text-white shadow-lg shadow-[#312e81]/30 hover:bg-[#3730a3]'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Hexagon className="w-5 h-5" />
                                        Run Analysis
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default RankGridPro;
