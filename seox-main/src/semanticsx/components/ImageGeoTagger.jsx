import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    MapPin, Upload, Image as ImageIcon, Download, Trash2, CheckCircle,
    AlertCircle, X, Map, Globe, Copy, Check, Loader2, RefreshCw,
    ZoomIn, ZoomOut, RotateCw, Settings, ChevronDown, Search, Navigation2, Crosshair, Tag
} from 'lucide-react';

// ============================================================================
// PIEXIF.JS - Minimal EXIF GPS Writer (embedded implementation)
// Based on piexifjs library principles for GPS EXIF modification
// ============================================================================

const EXIF_TAGS = {
    // EXIF IFD Pointer
    ExifIFDPointer: 0x8769,
    GPSInfoIFDPointer: 0x8825,
    // GPS IFD Tags
    GPSVersionID: 0x0000,
    GPSLatitudeRef: 0x0001,
    GPSLatitude: 0x0002,
    GPSLongitudeRef: 0x0003,
    GPSLongitude: 0x0004,
    GPSAltitudeRef: 0x0005,
    GPSAltitude: 0x0006,
};

// Convert decimal degrees to DMS (Degrees, Minutes, Seconds) format
const decimalToDMS = (decimal) => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesFloat = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = Math.round((minutesFloat - minutes) * 60 * 10000) / 10000;
    return { degrees, minutes, seconds };
};

// Create GPS EXIF data bytes for embedding
const createGPSExifBytes = (lat, lng, alt = 0) => {
    const latRef = lat >= 0 ? 'N' : 'S';
    const lngRef = lng >= 0 ? 'E' : 'W';
    const latDMS = decimalToDMS(lat);
    const lngDMS = decimalToDMS(lng);

    return {
        latRef,
        lat: latDMS,
        lngRef,
        lng: lngDMS,
        altRef: alt >= 0 ? 0 : 1,
        alt: Math.abs(alt)
    };
};

// Insert GPS EXIF data into JPEG
const insertGPSIntoJPEG = async (dataUrl, lat, lng, alt = 0, keyword = '') => {
    return new Promise((resolve, reject) => {
        try {
            // Extract base64 data from data URL
            const base64Data = dataUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Check if it's a valid JPEG (starts with 0xFFD8)
            if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
                // Not a JPEG, try to convert via canvas
                resolve(convertAndAddGPS(dataUrl, lat, lng, alt, keyword));
                return;
            }

            // Create GPS segment and optional XMP segment
            const gpsSegment = buildGPSSegment(lat, lng, alt);
            const xmpSegment = buildXMPSegment(keyword);
            const xmpLength = xmpSegment ? xmpSegment.length : 0;

            // Find position after SOI marker (0xFFD8) to insert EXIF
            const newBytes = new Uint8Array(bytes.length + gpsSegment.length + xmpLength);

            // Copy SOI marker (first 2 bytes)
            newBytes[0] = bytes[0]; // 0xFF
            newBytes[1] = bytes[1]; // 0xD8

            // Insert GPS/EXIF segment
            let offset = 2;
            for (let i = 0; i < gpsSegment.length; i++) {
                newBytes[offset + i] = gpsSegment[i];
            }
            offset += gpsSegment.length;

            // Insert XMP segment if keyword provided
            if (xmpSegment) {
                for (let i = 0; i < xmpSegment.length; i++) {
                    newBytes[offset + i] = xmpSegment[i];
                }
                offset += xmpSegment.length;
            }

            // Copy rest of original image
            for (let i = 2; i < bytes.length; i++) {
                newBytes[offset + i - 2] = bytes[i];
            }

            // Convert back to data URL
            const blob = new Blob([newBytes], { type: 'image/jpeg' });
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to create data URL'));
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('EXIF insertion error:', error);
            // Fallback to canvas method
            resolve(convertAndAddGPS(dataUrl, lat, lng, alt, keyword));
        }
    });
};

// Build a minimal GPS EXIF APP1 segment
const buildGPSSegment = (lat, lng, alt) => {
    // GPS Data
    const latRef = lat >= 0 ? 'N' : 'S';
    const lngRef = lng >= 0 ? 'E' : 'W';
    const latAbs = Math.abs(lat);
    const lngAbs = Math.abs(lng);

    // Convert to DMS with rational number format
    const latDeg = Math.floor(latAbs);
    const latMin = Math.floor((latAbs - latDeg) * 60);
    const latSec = Math.round(((latAbs - latDeg) * 60 - latMin) * 60 * 10000);

    const lngDeg = Math.floor(lngAbs);
    const lngMin = Math.floor((lngAbs - lngDeg) * 60);
    const lngSec = Math.round(((lngAbs - lngDeg) * 60 - lngMin) * 60 * 10000);

    // Build APP1 EXIF segment with GPS IFD
    // Format: APP1 Marker (FFE1) + Length + "Exif\0\0" + TIFF Header + IFD0 + GPS IFD

    const exifData = [];

    // EXIF header: "Exif\0\0"
    const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];

    // TIFF Header (Little Endian)
    const tiffHeader = [
        0x49, 0x49,       // "II" - Little endian
        0x2A, 0x00,       // TIFF magic number
        0x08, 0x00, 0x00, 0x00  // Offset to IFD0 (8 bytes from start)
    ];

    // IFD0 - with GPS IFD Pointer
    // Number of entries (1)
    const ifd0NumEntries = [0x01, 0x00];

    // GPS IFD Pointer entry (Tag 0x8825)
    // Points to GPS IFD at offset 26 (8 + 2 + 12 + 4)
    const gpsIFDOffset = 26;
    const gpsPointerEntry = [
        0x25, 0x88,       // Tag: GPSInfoIFDPointer (0x8825)
        0x04, 0x00,       // Type: LONG (4)
        0x01, 0x00, 0x00, 0x00,  // Count: 1
        gpsIFDOffset, 0x00, 0x00, 0x00  // Value: offset to GPS IFD
    ];

    // Next IFD offset (0 = no more IFDs)
    const nextIFD = [0x00, 0x00, 0x00, 0x00];

    // GPS IFD
    // Number of entries (6)
    const gpsNumEntries = [0x06, 0x00];

    // GPS data values start after GPS IFD entries
    // GPS IFD is at offset 26
    // GPS IFD header (2 bytes) + 6 entries (72 bytes) + next IFD (4 bytes) = 78 bytes
    // So data starts at offset 26 + 2 + 72 + 4 = 104
    let dataOffset = gpsIFDOffset + 2 + (6 * 12) + 4;

    const gpsEntries = [];
    const gpsData = [];

    // Entry 1: GPSVersionID (0x0000) - BYTE[4] = [2, 3, 0, 0]
    gpsEntries.push(
        0x00, 0x00,       // Tag
        0x01, 0x00,       // Type: BYTE
        0x04, 0x00, 0x00, 0x00,  // Count: 4
        0x02, 0x03, 0x00, 0x00   // Value: [2, 3, 0, 0]
    );

    // Entry 2: GPSLatitudeRef (0x0001) - ASCII[2]
    gpsEntries.push(
        0x01, 0x00,       // Tag
        0x02, 0x00,       // Type: ASCII
        0x02, 0x00, 0x00, 0x00,  // Count: 2
        latRef.charCodeAt(0), 0x00, 0x00, 0x00  // Value: 'N' or 'S'
    );

    // Entry 3: GPSLatitude (0x0002) - RATIONAL[3] (needs offset)
    const latDataOffset = dataOffset;
    gpsEntries.push(
        0x02, 0x00,       // Tag
        0x05, 0x00,       // Type: RATIONAL
        0x03, 0x00, 0x00, 0x00,  // Count: 3
        latDataOffset & 0xFF, (latDataOffset >> 8) & 0xFF, 0x00, 0x00
    );
    // Add latitude data (3 rationals = 24 bytes)
    gpsData.push(
        latDeg & 0xFF, (latDeg >> 8) & 0xFF, 0x00, 0x00,  // Degrees numerator
        0x01, 0x00, 0x00, 0x00,  // Degrees denominator (1)
        latMin & 0xFF, (latMin >> 8) & 0xFF, 0x00, 0x00,  // Minutes numerator
        0x01, 0x00, 0x00, 0x00,  // Minutes denominator (1)
        latSec & 0xFF, (latSec >> 8) & 0xFF, (latSec >> 16) & 0xFF, (latSec >> 24) & 0xFF,  // Seconds numerator
        0x10, 0x27, 0x00, 0x00   // Seconds denominator (10000)
    );
    dataOffset += 24;

    // Entry 4: GPSLongitudeRef (0x0003) - ASCII[2]
    gpsEntries.push(
        0x03, 0x00,       // Tag
        0x02, 0x00,       // Type: ASCII
        0x02, 0x00, 0x00, 0x00,  // Count: 2
        lngRef.charCodeAt(0), 0x00, 0x00, 0x00  // Value: 'E' or 'W'
    );

    // Entry 5: GPSLongitude (0x0004) - RATIONAL[3] (needs offset)
    const lngDataOffset = dataOffset;
    gpsEntries.push(
        0x04, 0x00,       // Tag
        0x05, 0x00,       // Type: RATIONAL
        0x03, 0x00, 0x00, 0x00,  // Count: 3
        lngDataOffset & 0xFF, (lngDataOffset >> 8) & 0xFF, 0x00, 0x00
    );
    // Add longitude data (3 rationals = 24 bytes)
    gpsData.push(
        lngDeg & 0xFF, (lngDeg >> 8) & 0xFF, 0x00, 0x00,  // Degrees numerator
        0x01, 0x00, 0x00, 0x00,  // Degrees denominator (1)
        lngMin & 0xFF, (lngMin >> 8) & 0xFF, 0x00, 0x00,  // Minutes numerator
        0x01, 0x00, 0x00, 0x00,  // Minutes denominator (1)
        lngSec & 0xFF, (lngSec >> 8) & 0xFF, (lngSec >> 16) & 0xFF, (lngSec >> 24) & 0xFF,  // Seconds numerator
        0x10, 0x27, 0x00, 0x00   // Seconds denominator (10000)
    );
    dataOffset += 24;

    // Entry 6: GPSAltitude (0x0006) - RATIONAL[1]
    const altValue = Math.abs(Math.round(alt * 100));
    gpsEntries.push(
        0x06, 0x00,       // Tag
        0x05, 0x00,       // Type: RATIONAL
        0x01, 0x00, 0x00, 0x00,  // Count: 1
        altValue & 0xFF, (altValue >> 8) & 0xFF, 0x00, 0x00  // Numerator (fits in 4 bytes for reasonable altitudes)
    );
    // Note: denominator 100 fits inline

    // Build the complete segment
    const allData = [
        ...exifHeader,
        ...tiffHeader,
        ...ifd0NumEntries,
        ...gpsPointerEntry,
        ...nextIFD,
        ...gpsNumEntries,
        ...gpsEntries,
        ...nextIFD,  // Next GPS IFD = none
        ...gpsData
    ];

    // Calculate length (including length bytes but excluding marker)
    const length = allData.length + 2;

    // Build final segment with APP1 marker
    const segment = [
        0xFF, 0xE1,  // APP1 marker
        (length >> 8) & 0xFF, length & 0xFF,  // Length (big endian)
        ...allData
    ];

    return new Uint8Array(segment);
};

// Build an XMP APP1 segment for IPTC-like metadata (Title, Subject, Keywords, Description, Creator)
const buildXMPSegment = (keyword) => {
    if (!keyword || !keyword.trim()) return null;

    const escapedKeyword = keyword
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    // Build XMP packet with Dublin Core, Photoshop, IPTC, EXIF, TIFF, and Microsoft namespaces
    const xmpPacket = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:MicrosoftPhoto="http://ns.microsoft.com/photo/1.0/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapedKeyword}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:subject>
    <rdf:Bag>
     <rdf:li>${escapedKeyword}</rdf:li>
    </rdf:Bag>
   </dc:subject>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapedKeyword}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:creator>
    <rdf:Seq>
     <rdf:li>${escapedKeyword}</rdf:li>
    </rdf:Seq>
   </dc:creator>
   <photoshop:Headline>${escapedKeyword}</photoshop:Headline>
   <photoshop:Caption>${escapedKeyword}</photoshop:Caption>
   <xmp:Label>${escapedKeyword}</xmp:Label>
   <Iptc4xmpCore:SubjectCode>
    <rdf:Bag>
     <rdf:li>${escapedKeyword}</rdf:li>
    </rdf:Bag>
   </Iptc4xmpCore:SubjectCode>
   <exif:UserComment>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${escapedKeyword}</rdf:li>
    </rdf:Alt>
   </exif:UserComment>
   <tiff:ImageDescription>${escapedKeyword}</tiff:ImageDescription>
   <tiff:Artist>${escapedKeyword}</tiff:Artist>
   <MicrosoftPhoto:LastKeywordXMP>
    <rdf:Bag>
     <rdf:li>${escapedKeyword}</rdf:li>
    </rdf:Bag>
   </MicrosoftPhoto:LastKeywordXMP>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    // XMP APP1 marker format: FFE1 + length + "http://ns.adobe.com/xap/1.0/\0" + XMP data
    const xmpNamespace = 'http://ns.adobe.com/xap/1.0/\0';
    const encoder = new TextEncoder();
    const namespaceBytes = encoder.encode(xmpNamespace);
    const xmpBytes = encoder.encode(xmpPacket);

    const totalLength = 2 + namespaceBytes.length + xmpBytes.length; // 2 for length field itself

    const segment = new Uint8Array(4 + namespaceBytes.length + xmpBytes.length);
    segment[0] = 0xFF;
    segment[1] = 0xE1; // APP1 marker
    segment[2] = (totalLength >> 8) & 0xFF;
    segment[3] = totalLength & 0xFF;
    segment.set(namespaceBytes, 4);
    segment.set(xmpBytes, 4 + namespaceBytes.length);

    return segment;
};

// Fallback: Convert image via canvas and return with GPS and optional keyword metadata
const convertAndAddGPS = async (dataUrl, lat, lng, alt, keyword = '') => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // For non-JPEG or conversion fallback, we return the canvas JPEG
            // with GPS data embedded using our EXIF builder
            canvas.toBlob(async (blob) => {
                const reader = new FileReader();
                reader.onload = async () => {
                    const jpegDataUrl = reader.result;
                    // Now insert GPS and optionally XMP into this JPEG
                    const base64Data = jpegDataUrl.split(',')[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    const gpsSegment = buildGPSSegment(lat, lng, alt);
                    const xmpSegment = buildXMPSegment(keyword);

                    // Calculate total size needed
                    const xmpLength = xmpSegment ? xmpSegment.length : 0;
                    const newBytes = new Uint8Array(bytes.length + gpsSegment.length + xmpLength);

                    // Insert: SOI (2 bytes) + GPS segment + XMP segment (if any) + rest of image
                    newBytes[0] = bytes[0];
                    newBytes[1] = bytes[1];

                    let offset = 2;
                    for (let i = 0; i < gpsSegment.length; i++) {
                        newBytes[offset + i] = gpsSegment[i];
                    }
                    offset += gpsSegment.length;

                    if (xmpSegment) {
                        for (let i = 0; i < xmpSegment.length; i++) {
                            newBytes[offset + i] = xmpSegment[i];
                        }
                        offset += xmpSegment.length;
                    }

                    for (let i = 2; i < bytes.length; i++) {
                        newBytes[offset + i - 2] = bytes[i];
                    }

                    const finalBlob = new Blob([newBytes], { type: 'image/jpeg' });
                    const finalReader = new FileReader();
                    finalReader.onload = () => resolve(finalReader.result);
                    finalReader.readAsDataURL(finalBlob);
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.95);
        };
        img.onerror = () => resolve(dataUrl); // Return original on error
        img.src = dataUrl;
    });
};

// ============================================================================
// IMAGE GEO TAGGER COMPONENT
// ============================================================================

const ImageGeoTagger = () => {
    const [images, setImages] = useState([]);
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [altitude, setAltitude] = useState('0');
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [showMap, setShowMap] = useState(true); // Show map by default
    const [mapRef, setMapRef] = useState(null);
    const [markerRef, setMarkerRef] = useState(null);
    const [locationSearch, setLocationSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState('');
    const [primaryKeyword, setPrimaryKeyword] = useState(''); // Optional keyword for EXIF metadata
    const fileInputRef = useRef(null);
    const mapContainerRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    // Initialize Leaflet map - dynamically load Leaflet library like SEOTools
    useEffect(() => {
        if (!showMap || !mapContainerRef.current || mapRef) return;

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

            const map = L.map(mapContainerRef.current, {
                zoomControl: false // We'll add custom controls
            }).setView([33.6844, 73.0479], 12); // Default to Islamabad

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Add zoom control to bottom right
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            const marker = L.marker([33.6844, 73.0479], {
                draggable: true,
                autoPan: true
            }).addTo(map);

            // Custom icon for better visibility
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background: linear-gradient(135deg, #14b8a6, #06b6d4); width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            });
            marker.setIcon(customIcon);

            marker.on('dragend', async (e) => {
                const pos = e.target.getLatLng();
                setLatitude(pos.lat.toFixed(6));
                setLongitude(pos.lng.toFixed(6));
                // Reverse geocode to get address
                reverseGeocode(pos.lat, pos.lng);
            });

            map.on('click', async (e) => {
                marker.setLatLng(e.latlng);
                setLatitude(e.latlng.lat.toFixed(6));
                setLongitude(e.latlng.lng.toFixed(6));
                // Reverse geocode to get address
                reverseGeocode(e.latlng.lat, e.latlng.lng);
            });

            setMapRef(map);
            setMarkerRef(marker);
        };

        loadLeaflet();

        return () => {
            if (mapRef) {
                mapRef.remove();
                setMapRef(null);
                setMarkerRef(null);
            }
        };
    }, [showMap]);

    // Update marker when lat/lng changes manually
    useEffect(() => {
        if (markerRef && latitude && longitude) {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                markerRef.setLatLng([lat, lng]);
                if (mapRef) {
                    mapRef.setView([lat, lng], mapRef.getZoom());
                }
            }
        }
    }, [latitude, longitude, markerRef, mapRef]);

    // Reverse geocode to get address from coordinates
    const reverseGeocode = async (lat, lng) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await response.json();
            if (data.display_name) {
                setSelectedAddress(data.display_name);
            }
        } catch (error) {
            console.error('Reverse geocode error:', error);
        }
    };

    // Search for locations using Nominatim
    const searchLocation = async (query) => {
        if (!query || query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error('Location search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Handle search input with debounce
    const handleSearchChange = (value) => {
        setLocationSearch(value);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            searchLocation(value);
        }, 500);
    };

    // Select a location from search results
    const selectLocation = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setSelectedAddress(result.display_name);
        setLocationSearch('');
        setSearchResults([]);

        if (markerRef && mapRef) {
            markerRef.setLatLng([lat, lng]);
            mapRef.setView([lat, lng], 15);
        }
    };

    // Get current location
    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setLatitude(lat.toFixed(6));
                    setLongitude(lng.toFixed(6));

                    if (markerRef && mapRef) {
                        markerRef.setLatLng([lat, lng]);
                        mapRef.setView([lat, lng], 15);
                    }

                    reverseGeocode(lat, lng);
                },
                (error) => {
                    alert('Unable to get your location. Please enable location permissions.');
                    console.error('Geolocation error:', error);
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    };

    // Handle file drop
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(
            file => file.type.startsWith('image/')
        );
        processFiles(files);
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files).filter(
            file => file.type.startsWith('image/')
        );
        processFiles(files);
    };

    const processFiles = async (files) => {
        const newImages = await Promise.all(
            files.map(async (file) => {
                const preview = await readFileAsDataURL(file);
                return {
                    id: Date.now() + Math.random(),
                    file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    preview,
                    newGPS: null,
                    processedDataUrl: null,
                    processed: false
                };
            })
        );
        setImages(prev => [...prev, ...newImages]);
    };

    const readFileAsDataURL = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    };

    // Apply GPS to selected images - NOW ACTUALLY EMBEDS GPS DATA
    const applyGPSToSelected = async () => {
        if (!latitude || !longitude) {
            alert('Please enter latitude and longitude');
            return;
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const alt = parseFloat(altitude) || 0;

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            alert('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
            return;
        }

        setIsProcessing(true);

        const gpsData = { latitude: lat, longitude: lng, altitude: alt };

        // Process each image and embed GPS data
        const updatedImages = await Promise.all(
            images.map(async (img) => {
                if (selectedImages.has(img.id) || selectedImages.size === 0) {
                    try {
                        // Actually embed GPS and keyword data into the image
                        const processedDataUrl = await insertGPSIntoJPEG(img.preview, lat, lng, alt, primaryKeyword);
                        return {
                            ...img,
                            newGPS: gpsData,
                            processedDataUrl,
                            processed: true
                        };
                    } catch (error) {
                        console.error('Error processing image:', error);
                        return { ...img, newGPS: gpsData, processed: false };
                    }
                }
                return img;
            })
        );

        setImages(updatedImages);
        setIsProcessing(false);
    };

    // Download image with GPS EXIF data embedded
    const downloadImage = async (image) => {
        if (!image.processedDataUrl) {
            // Download original if not processed
            const link = document.createElement('a');
            link.href = image.preview;
            link.download = image.name;
            link.click();
            return;
        }

        // Download the GPS-embedded image
        const link = document.createElement('a');
        link.href = image.processedDataUrl;
        // Always save as JPEG since we convert for GPS embedding
        const baseName = image.name.replace(/\.[^/.]+$/, '');
        link.download = `geotagged_${baseName}.jpg`;
        link.click();
    };

    // Download all processed images
    const downloadAll = async () => {
        const processedImages = images.filter(img => img.processed && img.processedDataUrl);
        for (const image of processedImages) {
            await downloadImage(image);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    // Toggle image selection
    const toggleSelection = (id) => {
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedImages(new Set(images.map(img => img.id)));
    };

    const deselectAll = () => {
        setSelectedImages(new Set());
    };

    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const clearAll = () => {
        setImages([]);
        setSelectedImages(new Set());
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col overflow-auto p-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-6 text-white mb-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <MapPin className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Image Geo Tagger</h1>
                                <p className="text-white/70">Add GPS EXIF data to your images for Local SEO</p>
                            </div>
                        </div>
                        <button
                            onClick={clearAll}
                            disabled={images.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-sm font-medium transition backdrop-blur-sm disabled:opacity-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear All
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel - Location Settings */}
                    <div className="space-y-6">
                        {/* GPS Coordinates Input */}
                        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
                            <h3 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-brand-400" />
                                GPS Coordinates
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-1">
                                        Latitude
                                    </label>
                                    <input
                                        type="text"
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        placeholder="e.g., 40.7128"
                                        className="w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40"
                                    />
                                    <p className="text-xs text-white/40 mt-1">Range: -90 to 90</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-1">
                                        Longitude
                                    </label>
                                    <input
                                        type="text"
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        placeholder="e.g., -74.0060"
                                        className="w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40"
                                    />
                                    <p className="text-xs text-white/40 mt-1">Range: -180 to 180</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-1">
                                        Altitude (meters)
                                    </label>
                                    <input
                                        type="text"
                                        value={altitude}
                                        onChange={(e) => setAltitude(e.target.value)}
                                        placeholder="e.g., 10"
                                        className="w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40"
                                    />
                                </div>

                                {/* Primary Keyword - Optional */}
                                <div className="pt-2 border-t border-white/[0.06] mt-2">
                                    <label className="block text-sm font-medium text-white/60 mb-1 flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-amber-500" />
                                        Primary Keyword
                                        <span className="text-xs text-white/30 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={primaryKeyword}
                                        onChange={(e) => setPrimaryKeyword(e.target.value)}
                                        placeholder="e.g., Best Coffee Shop NYC"
                                        className="w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40"
                                    />
                                    <p className="text-xs text-white/40 mt-1">
                                        Fills: Title, Subject, Tags, Description, Author
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowMap(!showMap)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg text-sm font-medium text-white/60 transition"
                                >
                                    <Map className="w-4 h-4" />
                                    {showMap ? 'Hide Map' : 'Pick from Map'}
                                </button>

                                {showMap && (
                                    <div className="space-y-3">
                                        {/* Location Search */}
                                        <div className="relative">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                                    <input
                                                        type="text"
                                                        value={locationSearch}
                                                        onChange={(e) => handleSearchChange(e.target.value)}
                                                        placeholder="Search for a location..."
                                                        className="w-full pl-10 pr-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm"
                                                    />
                                                    {isSearching && (
                                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 animate-spin" />
                                                    )}
                                                </div>
                                                <button
                                                    onClick={getCurrentLocation}
                                                    className="px-3 py-2 bg-teal-100 hover:bg-teal-200 text-brand-300 rounded-lg transition"
                                                    title="Use my current location"
                                                >
                                                    <Crosshair className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Search Results Dropdown */}
                                            {searchResults.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-[#0d1117] border border-white/[0.12] rounded-lg shadow-lg max-h-60 overflow-auto">
                                                    {searchResults.map((result, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() => selectLocation(result)}
                                                            className="w-full px-4 py-3 text-left hover:bg-brand-500/10 border-b border-white/[0.06] last:border-0 transition"
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-sm font-medium text-white/90 line-clamp-1">
                                                                        {result.display_name.split(',')[0]}
                                                                    </p>
                                                                    <p className="text-xs text-white/40 line-clamp-1">
                                                                        {result.display_name.split(',').slice(1).join(',').trim()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Map Container */}
                                        <div
                                            ref={mapContainerRef}
                                            className="h-72 rounded-lg border border-white/[0.08] overflow-hidden"
                                            style={{ zIndex: 1 }}
                                        />

                                        {/* Selected Address Display */}
                                        {selectedAddress && (
                                            <div className="p-3 bg-brand-500/[0.06] border border-brand-500/20 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-brand-200 line-clamp-2">{selectedAddress}</p>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-xs text-white/40 text-center">
                                            Click on the map or drag the marker to select a location
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={applyGPSToSelected}
                                    disabled={!latitude || !longitude || images.length === 0 || isProcessing}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50"
                                >
                                    {isProcessing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <MapPin className="w-4 h-4" />
                                    )}
                                    {isProcessing ? 'Processing...' : `Apply GPS to ${selectedImages.size > 0 ? `${selectedImages.size} Selected` : 'All Images'}`}
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6">
                            <h3 className="text-lg font-semibold text-white/90 mb-4">Statistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 bg-white/[0.03] rounded-xl">
                                    <div className="text-2xl font-bold text-white/90">{images.length}</div>
                                    <div className="text-sm text-white/40">Total Images</div>
                                </div>
                                <div className="text-center p-4 bg-emerald-500/[0.06] rounded-xl">
                                    <div className="text-2xl font-bold text-emerald-400">{images.filter(i => i.processed).length}</div>
                                    <div className="text-sm text-white/40">Geo-Tagged</div>
                                </div>
                                <div className="text-center p-4 bg-blue-500/[0.06] rounded-xl">
                                    <div className="text-2xl font-bold text-brand-400">{selectedImages.size}</div>
                                    <div className="text-sm text-white/40">Selected</div>
                                </div>
                                <div className="text-center p-4 bg-purple-500/[0.06] rounded-xl">
                                    <div className="text-2xl font-bold text-purple-400">
                                        {images.filter(i => i.processedDataUrl).length}
                                    </div>
                                    <div className="text-sm text-white/40">Ready</div>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-brand-500/[0.06] rounded-xl border border-brand-500/20 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-brand-200">
                                    <p className="font-medium mb-1">How it works:</p>
                                    <ol className="list-decimal list-inside space-y-1 text-brand-300">
                                        <li>Upload your images</li>
                                        <li>Set GPS coordinates or pick from map</li>
                                        <li>Click "Apply GPS" to embed EXIF data</li>
                                        <li>Download your geo-tagged images</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Images */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Upload Zone */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white/[0.02] border-2 border-dashed border-white/[0.10] rounded-2xl p-8 text-center cursor-pointer hover:border-brand-500/40 hover:bg-brand-500/[0.04] transition"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <Upload className="w-12 h-12 text-white/30 mx-auto mb-4" />
                            <p className="text-lg font-medium text-white/60 mb-1">
                                Drop images here or click to upload
                            </p>
                            <p className="text-sm text-white/40">
                                Supports JPEG, PNG, WebP images. Bulk upload supported.
                            </p>
                        </div>

                        {/* Image Actions */}
                        {images.length > 0 && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg text-sm font-medium text-white/60 transition"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={deselectAll}
                                        className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg text-sm font-medium text-white/60 transition"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                                <button
                                    onClick={downloadAll}
                                    disabled={images.filter(i => i.processedDataUrl).length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700 transition disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    Download All Geo-Tagged
                                </button>
                            </div>
                        )}

                        {/* Image Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {images.map((image) => (
                                <div
                                    key={image.id}
                                    className={`relative bg-[#0d1117] rounded-xl border-2 overflow-hidden transition cursor-pointer ${selectedImages.has(image.id)
                                        ? 'border-brand-500 ring-2 ring-brand-500/30'
                                        : 'border-white/[0.08] hover:border-white/[0.15]'
                                        }`}
                                    onClick={() => toggleSelection(image.id)}
                                >
                                    {/* Image Preview */}
                                    <div className="aspect-square bg-white/[0.03] relative">
                                        <img
                                            src={image.preview}
                                            alt={image.name}
                                            className="w-full h-full object-cover"
                                        />

                                        {/* Selection checkbox */}
                                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center ${selectedImages.has(image.id)
                                            ? 'bg-brand-500 text-white'
                                            : 'bg-white/80'
                                            }`}>
                                            {selectedImages.has(image.id) && <Check className="w-4 h-4" />}
                                        </div>

                                        {/* Status badge */}
                                        <div className="absolute top-2 right-2">
                                            {image.processed && image.processedDataUrl ? (
                                                <div className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    GPS Added
                                                </div>
                                            ) : image.processed ? (
                                                <div className="px-2 py-1 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Error
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Remove button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                                            className="absolute bottom-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Image Info */}
                                    <div className="p-3">
                                        <p className="text-sm font-medium text-white/90 truncate">{image.name}</p>
                                        <p className="text-xs text-white/40">{formatSize(image.size)}</p>
                                        {image.newGPS && (
                                            <p className="text-xs text-brand-400 mt-1">
                                                📍 {image.newGPS.latitude.toFixed(4)}, {image.newGPS.longitude.toFixed(4)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Download button for processed images */}
                                    {image.processedDataUrl && (
                                        <div className="px-3 pb-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); downloadImage(image); }}
                                                className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-teal-100 text-brand-300 rounded-lg text-sm font-medium hover:bg-teal-200 transition"
                                            >
                                                <Download className="w-3 h-3" />
                                                Download
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Empty State */}
                        {images.length === 0 && (
                            <div className="text-center py-12 text-white/40">
                                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">No images uploaded yet</p>
                                <p className="text-sm">Upload images to start adding GPS data</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageGeoTagger;
