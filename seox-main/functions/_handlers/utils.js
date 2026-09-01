// utils.js - Combined utility API
// Routes by ?action= query param:
//   ?action=geocode  → geocode proxy (was /api/geocode)
//   ?action=indexnow → IndexNow submission (was /api/indexnow)

import { requireFirebaseAuthFromNodeRequest } from "../_lib/request-auth.js";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await requireFirebaseAuthFromNodeRequest(req);
    } catch (error) {
        return res.status(error?.status || 401).json({ error: error?.message || 'Unauthorized' });
    }

    const { action } = req.query;

    // ─── GEOCODE ──────────────────────────────────────────────────────────────
    if (action === 'geocode') {
        const { address, hl = 'en', gl = 'US' } = req.query;

        if (!address) {
            return res.status(400).json({ error: 'Missing address parameter' });
        }

        // Try valentin.app geocode first
        try {
            const valentinUrl = `https://valentin.app/geocode?address=${encodeURIComponent(address.toLowerCase())}&hl=${hl}&gl=${gl}`;
            const valentinResponse = await fetch(valentinUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (valentinResponse.ok) {
                const data = await valentinResponse.json();
                if (data.status === 'OK' && data.results?.length > 0) {
                    return res.status(200).json(data);
                }
            }
        } catch (error) {
            console.log('Valentin geocode failed:', error.message);
        }

        // Fallback to Nominatim (OpenStreetMap)
        try {
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            const nominatimResponse = await fetch(nominatimUrl, {
                headers: { 'User-Agent': 'AISmartSeo-SERP-Checker/1.0' }
            });

            if (nominatimResponse.ok) {
                const data = await nominatimResponse.json();
                if (data.length > 0) {
                    return res.status(200).json({
                        status: 'OK',
                        results: [{
                            geometry: {
                                location: {
                                    lat: parseFloat(data[0].lat),
                                    lng: parseFloat(data[0].lon)
                                }
                            },
                            formatted_address: data[0].display_name
                        }]
                    });
                }
            }
        } catch (error) {
            console.error('Nominatim geocode failed:', error.message);
        }

        return res.status(404).json({ status: 'ZERO_RESULTS', error: 'Location not found' });
    }

    // ─── INDEXNOW ─────────────────────────────────────────────────────────────
    if (action === 'indexnow') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { urls, key, keyLocation, host } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        const indexNowKey = key || 'your-indexnow-key';

        const results = {
            bing:   { success: false, message: '', urls: [] },
            yandex: { success: false, message: '', urls: [] }
        };

        const endpoints = [
            { name: 'bing',   url: 'https://www.bing.com/indexnow' },
            { name: 'yandex', url: 'https://yandex.com/indexnow' }
        ];

        const payload = {
            host: host || new URL(urls[0]).hostname,
            key: indexNowKey,
            keyLocation: keyLocation || `https://${host || new URL(urls[0]).hostname}/${indexNowKey}.txt`,
            urlList: urls.slice(0, 10000)
        };

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                const statusCode = response.status;

                if (statusCode === 200 || statusCode === 202) {
                    results[endpoint.name] = {
                        success: true,
                        message: statusCode === 200 ? 'URLs submitted successfully' : 'URLs accepted for processing',
                        statusCode,
                        urlsSubmitted: urls.length
                    };
                } else {
                    let errorMessage = 'Unknown error';
                    if (statusCode === 400) errorMessage = 'Invalid request format';
                    else if (statusCode === 403) errorMessage = 'Key not valid - ensure your IndexNow key file is hosted on your domain';
                    else if (statusCode === 422) errorMessage = 'URLs do not belong to the specified host';
                    else if (statusCode === 429) errorMessage = 'Rate limited - too many requests';

                    results[endpoint.name] = { success: false, message: errorMessage, statusCode };
                }
            } catch (error) {
                results[endpoint.name] = { success: false, message: `Network error: ${error.message}`, statusCode: 0 };
            }
        }

        return res.status(200).json({
            submitted: urls.length,
            results,
            note: 'For IndexNow to work properly, you must host a key file at your domain. See: https://www.indexnow.org/documentation'
        });
    }

    // ─── UNKNOWN ACTION ───────────────────────────────────────────────────────
    return res.status(400).json({ error: 'Missing or unknown action. Use ?action=geocode or ?action=indexnow' });
}
