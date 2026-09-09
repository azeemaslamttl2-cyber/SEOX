import { requireAuthenticatedUser } from "../_lib/request-auth.js";
import { fetchPublicHttpUrl } from "../_lib/url-security.js";
import { getStoredDocument } from "../_lib/mysql-storage.js";

const MAX_PROXY_BODY_BYTES = 5_000_000;
const DATAFORSEO_API_BASE = 'https://api.dataforseo.com/v3';
const DATAFORSEO_MENTION_PLATFORMS = new Set(['google', 'chat_gpt']);
const API_SETTINGS_COLLECTION = 'adminSettings';
const API_SETTINGS_DOCUMENT = 'apis';

function compactString(value, maxLength = 250) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeDataForSeoDomain(value) {
    const raw = compactString(value, 300).replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    return raw.split(/[/?#]/)[0].toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 63);
}

function brandNameFromDomain(domain) {
    const clean = normalizeDataForSeoDomain(domain);
    const firstLabel = clean.split('.')[0] || '';
    return firstLabel
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeBrandRadarEntity(input) {
    if (typeof input === 'string') {
        const value = compactString(input);
        const looksLikeDomain = /\.[a-z]{2,}$/i.test(value.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || '');
        const domain = looksLikeDomain ? normalizeDataForSeoDomain(value) : '';
        return {
            name: looksLikeDomain ? brandNameFromDomain(domain) : value,
            domain
        };
    }

    const domain = normalizeDataForSeoDomain(input?.domain || input?.url || '');
    const name = compactString(input?.name || input?.brand || input?.keyword || brandNameFromDomain(domain));
    return { name, domain };
}

function normalizeBrandRadarEntities(body) {
    const rawTargets = Array.isArray(body.targets) && body.targets.length
        ? body.targets
        : [body.brand, ...(Array.isArray(body.competitors) ? body.competitors : [])];

    const seen = new Set();
    return rawTargets
        .map(normalizeBrandRadarEntity)
        .filter((entity) => entity.name || entity.domain)
        .filter((entity) => {
            const key = `${entity.name.toLowerCase()}|${entity.domain}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 10);
}

function buildBrandRadarTarget(entity, scope = 'answer') {
    const target = [];
    if (entity.domain) {
        target.push({
            domain: entity.domain,
            search_filter: 'include',
            search_scope: scope === 'sources' ? ['sources'] : ['any'],
            include_subdomains: true
        });
    }
    if (entity.name) {
        target.push({
            keyword: entity.name,
            search_filter: 'include',
            search_scope: [scope],
            match_type: 'word_match'
        });
    }
    return target;
}

function normalizeMentionPlatforms(platformInput, platformsInput) {
    const requested = Array.isArray(platformsInput) && platformsInput.length
        ? platformsInput
        : [platformInput || 'google'];
    const normalized = requested
        .flatMap((platform) => (platform === 'all' ? [...DATAFORSEO_MENTION_PLATFORMS] : [platform]))
        .map((platform) => String(platform || '').trim().toLowerCase())
        .filter((platform) => DATAFORSEO_MENTION_PLATFORMS.has(platform));
    const unique = [...new Set(normalized)].slice(0, 2);
    return unique.length ? unique : ['google'];
}

function mentionLocationCode(platform, locationCode) {
    return platform === 'chat_gpt' ? 2840 : locationCode;
}

function mentionLanguageCode(platform, languageCode) {
    return platform === 'chat_gpt' ? 'en' : languageCode;
}

function metricGroupValue(groups, fallback = {}) {
    const group = Array.isArray(groups) ? groups[0] : null;
    return {
        mentions: Number(group?.mentions || fallback?.mentions || 0),
        ai_search_volume: Number(group?.ai_search_volume || fallback?.ai_search_volume || 0),
        impressions: Number(group?.impressions || fallback?.impressions || 0)
    };
}

function normalizeGroupItems(groups, limit = 20) {
    return (Array.isArray(groups) ? groups : []).slice(0, limit).map((item) => ({
        key: item?.key || '',
        mentions: Number(item?.mentions || 0),
        ai_search_volume: Number(item?.ai_search_volume || 0),
        impressions: Number(item?.impressions || 0)
    }));
}

function mergeMetricTotals(target, source) {
    target.mentions += Number(source?.mentions || 0);
    target.ai_search_volume += Number(source?.ai_search_volume || 0);
    target.impressions += Number(source?.impressions || 0);
}

function firstTaskResult(data) {
    return data?.tasks?.[0]?.result?.[0] || null;
}

async function getSavedDataForSeoCredentials() {
    try {
        const collection = process.env.ADMIN_SETTINGS_COLLECTION || API_SETTINGS_COLLECTION;
        const settings = await getStoredDocument(process.env, collection, API_SETTINGS_DOCUMENT);
        return {
            login: String(settings?.dataforseoLogin || '').trim(),
            password: String(settings?.dataforseoPassword || '').trim()
        };
    } catch (error) {
        console.warn('Could not load saved DataForSEO credentials:', error?.message || error);
        return { login: '', password: '' };
    }
}

async function resolveDataForSeoCredentials(body = {}) {
    const requestLogin = typeof body?.dataforseoLogin === 'string' ? body.dataforseoLogin.trim() : '';
    const requestPassword = typeof body?.dataforseoApiKey === 'string'
        ? body.dataforseoApiKey.trim()
        : (typeof body?.dataforseoPassword === 'string' ? body.dataforseoPassword.trim() : '');
    const saved = await getSavedDataForSeoCredentials();

    return {
        login: requestLogin || saved.login || process.env.DATAFORSEO_LOGIN || process.env.VITE_DATAFORSEO_LOGIN || '',
        password: requestPassword || saved.password || process.env.DATAFORSEO_PASSWORD || process.env.VITE_DATAFORSEO_PASSWORD || ''
    };
}

async function callDataForSEO(endpoint, postData, authHeader) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.status_message || data.message || `DataForSEO HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    const task = data?.tasks?.[0];
    if (task && task.status_code !== 20000) {
        const message = task.status_message || data.status_message || 'DataForSEO request failed';
        const noResults = task.status_code === 40501 || task.status_code === 40102 || message.toLowerCase().includes('no search results');
        if (noResults) {
            return { ...data, tasks: [{ ...task, result: [] }] };
        }
        const error = new Error(message);
        error.status = 400;
        error.data = data;
        throw error;
    }

    return data;
}

// Shared Node-style handler for proxy and DataforSEO requests.
// Supports CORS proxy requests and DataforSEO API calls
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control, Pragma, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Handle preflight 
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!req.internalAdminAuthorized) {
        try {
            await requireAuthenticatedUser(req);
        } catch (error) {
            return res.status(error?.status || 401).json({ error: error?.message || 'Unauthorized' });
        }
    }

    // Check if this is a DataforSEO request
    if (req.method === 'POST' && req.body?.service === 'dataforseo') {
        return handleDataForSEO(req, res);
    }

    // Otherwise, handle as standard proxy
    return handleProxy(req, res);
}

// DataforSEO API Handler
async function handleDataForSEO(req, res) {
    const {
        login: DATAFORSEO_LOGIN,
        password: DATAFORSEO_PASSWORD
    } = await resolveDataForSeoCredentials(req.body);

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
        return res.status(500).json({
            error: 'DataforSEO API credentials not configured',
            message: 'Please add DataForSEO credentials in Admin > APIs or set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables'
        });
    }

    const { action, keyword, domain, location_code, language_code, keywords } = req.body;

    if (!action) {
        return res.status(400).json({ error: 'Action is required' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    try {
        if (action.startsWith('brand_radar_')) {
            return handleBrandRadarDataForSEO(req, res, authHeader);
        }

        let endpoint = '';
        let postData = [];

        switch (action) {
            case 'keywords_for_site':
                if (!domain) {
                    return res.status(400).json({ error: 'Domain is required for keywords_for_site' });
                }
                endpoint = 'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_site/live';
                postData = [{
                    target: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
                    location_code: location_code || 2840,
                    language_code: language_code || 'en',
                    include_adult_keywords: false,
                    sort_by: 'search_volume'
                }];
                break;

            case 'search_volume':
                if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
                    return res.status(400).json({ error: 'Keywords array is required for search_volume' });
                }
                endpoint = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
                postData = [{
                    keywords: keywords.slice(0, 1000),
                    location_code: location_code || 2840,
                    language_code: language_code || 'en'
                }];
                break;

            case 'keyword_suggestions':
                if (!keyword) {
                    return res.status(400).json({ error: 'Keyword is required for keyword_suggestions' });
                }
                endpoint = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live';
                postData = [{
                    keyword: keyword,
                    location_code: location_code || 2840,
                    language_code: language_code || 'en',
                    include_seed_keyword: true,
                    limit: 100
                }];
                break;

            case 'related_keywords':
                if (!keyword) {
                    return res.status(400).json({ error: 'Keyword is required for related_keywords' });
                }
                endpoint = 'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live';
                postData = [{
                    keyword: keyword,
                    location_code: location_code || 2840,
                    language_code: language_code || 'en',
                    limit: 100,
                    include_seed_keyword: true
                }];
                break;

            case 'google_maps_serp': {
                const { lat, lng, keyword: searchKeyword, zoom } = req.body;
                if (!lat || !lng || !searchKeyword) {
                    return res.status(400).json({ error: 'lat, lng, and keyword are required for google_maps_serp' });
                }
                const roundedLat = parseFloat(parseFloat(lat).toFixed(7));
                const roundedLng = parseFloat(parseFloat(lng).toFixed(7));
                endpoint = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced';
                postData = [{
                    keyword: searchKeyword,
                    location_coordinate: `${roundedLat},${roundedLng},${zoom || 15}z`,
                    language_code: language_code || 'en',
                    device: 'desktop',
                    os: 'windows',
                    depth: 20,
                    search_this_area: false
                }];
                break;
            }

            case 'plagiarism_serp_search': {
                const { phrase, depth: searchDepth } = req.body;
                if (!phrase) {
                    return res.status(400).json({ error: 'phrase is required for plagiarism_serp_search' });
                }
                endpoint = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
                postData = [{
                    keyword: `"${phrase.replace(/"/g, '')}"`,
                    location_code: location_code || 2840,
                    language_code: language_code || 'en',
                    device: 'desktop',
                    depth: searchDepth || 100
                }];
                break;
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('DataforSEO API Error:', JSON.stringify(data, null, 2));
            return res.status(response.status).json({
                error: 'DataforSEO API error',
                status_code: data.status_code,
                status_message: data.status_message
            });
        }

        if (data.tasks && data.tasks[0] && data.tasks[0].status_code !== 20000) {
            const taskStatus = data.tasks[0].status_code;
            const taskMessage = data.tasks[0].status_message || '';

            if (taskStatus === 40501 || taskStatus === 40102 || taskMessage.toLowerCase().includes('no search results')) {
                return res.status(200).json({
                    success: true,
                    action,
                    results: [],
                    cost: data.cost || 0,
                    total_count: 0
                });
            }

            return res.status(400).json({
                error: 'DataforSEO request failed',
                status_code: taskStatus,
                status_message: taskMessage
            });
        }

        let results = [];
        let cost = data.cost || 0;

        if (data.tasks && data.tasks[0] && data.tasks[0].result) {
            const taskResult = data.tasks[0].result;

            if (action === 'keywords_for_site' || action === 'search_volume') {
                results = taskResult.map(item => ({
                    keyword: item.keyword,
                    search_volume: item.search_volume,
                    competition: item.competition,
                    competition_index: item.competition_index,
                    cpc: item.cpc,
                    low_top_of_page_bid: item.low_top_of_page_bid,
                    high_top_of_page_bid: item.high_top_of_page_bid,
                    monthly_searches: item.monthly_searches || []
                }));
            } else if (action === 'plagiarism_serp_search') {
                if (taskResult[0] && taskResult[0].items) {
                    results = taskResult[0].items
                        .filter(item => item.type === 'organic')
                        .map(item => ({
                            url: item.url,
                            domain: item.domain,
                            title: item.title,
                            snippet: item.description || item.snippet || '',
                            breadcrumb: item.breadcrumb,
                            position: item.rank_absolute || item.rank_group,
                            etv: item.estimated_paid_traffic_cost
                        }));
                }
            } else if (action === 'google_maps_serp') {
                if (taskResult[0] && taskResult[0].items) {
                    results = taskResult[0].items
                        .filter(item => item.type === 'maps_search')
                        .map(item => ({
                            type: item.type,
                            title: item.title || '',
                            domain: item.domain || '',
                            url: item.url || '',
                            address: item.address || item.snippet || '',
                            place_id: item.place_id || '',
                            rank_group: item.rank_group,
                            rank_absolute: item.rank_absolute,
                            rating: item.rating?.value || null,
                            votes_count: item.rating?.votes_count || 0,
                            category: item.category || '',
                            latitude: item.latitude,
                            longitude: item.longitude,
                            is_claimed: item.is_claimed || false,
                            phone: item.phone || null,
                            main_image: item.main_image || null
                        }));
                }
            } else if (action === 'keyword_suggestions' || action === 'related_keywords') {
                if (taskResult[0] && taskResult[0].items) {
                    results = taskResult[0].items.map(item => ({
                        keyword: item.keyword,
                        search_volume: item.keyword_info?.search_volume || 0,
                        competition: item.keyword_info?.competition || null,
                        competition_index: item.keyword_info?.competition_index || null,
                        cpc: item.keyword_info?.cpc || 0,
                        low_top_of_page_bid: item.keyword_info?.low_top_of_page_bid || 0,
                        high_top_of_page_bid: item.keyword_info?.high_top_of_page_bid || 0,
                        monthly_searches: item.keyword_info?.monthly_searches || []
                    }));
                }
            }
        }

        res.status(200).json({
            success: true,
            action,
            results,
            cost,
            total_count: results.length
        });

    } catch (error) {
        console.error('DataforSEO Server error:', error);
        res.status(500).json({
            error: 'Failed to call DataforSEO API',
            message: error.message
        });
    }
}

async function handleBrandRadarDataForSEO(req, res, authHeader) {
    const action = req.body.action;
    const location_code = Number(req.body.location_code || 2840);
    const language_code = compactString(req.body.language_code || 'en', 10) || 'en';
    const language_name = compactString(req.body.language_name || 'English', 80) || 'English';
    const platforms = normalizeMentionPlatforms(req.body.platform, req.body.platforms);
    const targets = normalizeBrandRadarEntities(req.body);
    const limit = Math.max(1, Math.min(Number(req.body.limit || 25), 100));
    const offset = Math.max(0, Number(req.body.offset || 0));

    if (!targets.length && !req.body.keyword && !Array.isArray(req.body.keywords)) {
        return res.status(400).json({ error: 'Brand, targets, keyword, or keywords are required' });
    }

    try {
        switch (action) {
            case 'brand_radar_cross_metrics': {
                const endpoint = `${DATAFORSEO_API_BASE}/ai_optimization/llm_mentions/cross_aggregated_metrics/live`;
                const dataByPlatform = await Promise.all(platforms.map(async (platform) => {
                    const payload = [{
                        language_code: mentionLanguageCode(platform, language_code),
                        location_code: mentionLocationCode(platform, location_code),
                        platform,
                        targets: targets.map((target) => ({
                            aggregation_key: target.name || target.domain,
                            target: buildBrandRadarTarget(target, 'answer')
                        })),
                        initial_dataset_filters: req.body.initial_dataset_filters || undefined,
                        internal_list_limit: Math.max(1, Math.min(Number(req.body.internal_list_limit || 10), 50))
                    }];
                    const data = await callDataForSEO(endpoint, payload, authHeader);
                    return { platform, data };
                }));

                const brandMap = new Map();
                const sourceDomains = new Map();
                let cost = 0;

                dataByPlatform.forEach(({ platform, data }) => {
                    cost += Number(data.cost || 0);
                    const result = firstTaskResult(data);
                    const items = Array.isArray(result?.items) ? result.items : [];

                    items.forEach((item) => {
                        const key = item?.key || item?.target || item?.aggregation_key || 'Unknown';
                        const existing = brandMap.get(key) || {
                            name: key,
                            mentions: 0,
                            ai_search_volume: 0,
                            impressions: 0,
                            platforms: {}
                        };
                        const groupValue = metricGroupValue(item?.platform || item?.location || item?.language, item);
                        existing.platforms[platform] = {
                            ...groupValue,
                            sources_domain: normalizeGroupItems(item?.sources_domain, 10),
                            search_results_domain: normalizeGroupItems(item?.search_results_domain, 10),
                            brand_entities_title: normalizeGroupItems(item?.brand_entities_title, 10),
                            brand_entities_category: normalizeGroupItems(item?.brand_entities_category, 10)
                        };
                        mergeMetricTotals(existing, groupValue);
                        normalizeGroupItems(item?.sources_domain, 10).forEach((domain) => {
                            if (!domain.key) return;
                            const current = sourceDomains.get(domain.key) || {
                                domain: domain.key,
                                mentions: 0,
                                ai_search_volume: 0,
                                impressions: 0
                            };
                            mergeMetricTotals(current, domain);
                            sourceDomains.set(domain.key, current);
                        });
                        brandMap.set(key, existing);
                    });
                });

                const brands = Array.from(brandMap.values()).map((brand) => ({
                    ...brand,
                    share_of_voice: 0
                }));
                const totalMentions = brands.reduce((sum, brand) => sum + brand.mentions, 0);
                brands.forEach((brand) => {
                    brand.share_of_voice = totalMentions ? (brand.mentions / totalMentions) * 100 : 0;
                });

                return res.status(200).json({
                    success: true,
                    action,
                    platforms,
                    brands,
                    top_source_domains: Array.from(sourceDomains.values())
                        .sort((a, b) => b.mentions - a.mentions)
                        .slice(0, 20),
                    cost,
                    total_count: brands.length
                });
            }

            case 'brand_radar_search_mentions': {
                const platform = platforms[0] || 'google';
                const endpoint = `${DATAFORSEO_API_BASE}/ai_optimization/llm_mentions/search/live`;
                const primaryTarget = targets[0] || normalizeBrandRadarEntity(req.body.keyword);
                const data = await callDataForSEO(endpoint, [{
                    language_code: mentionLanguageCode(platform, language_code),
                    location_code: mentionLocationCode(platform, location_code),
                    platform,
                    target: buildBrandRadarTarget(primaryTarget, 'answer'),
                    filters: req.body.filters || undefined,
                    order_by: req.body.order_by || ['ai_search_volume,desc'],
                    offset,
                    limit
                }], authHeader);
                const result = firstTaskResult(data);
                const items = Array.isArray(result?.items) ? result.items : [];
                return res.status(200).json({
                    success: true,
                    action,
                    platform,
                    results: items.map((item) => normalizeBrandRadarMention(item, targets, platform)),
                    cost: Number(data.cost || 0),
                    total_count: Number(result?.total_count || result?.items_count || items.length)
                });
            }

            case 'brand_radar_top_pages':
            case 'brand_radar_top_domains': {
                const platform = platforms[0] || 'google';
                const endpointName = action === 'brand_radar_top_pages' ? 'top_pages' : 'top_domains';
                const endpoint = `${DATAFORSEO_API_BASE}/ai_optimization/llm_mentions/${endpointName}/live`;
                const primaryTarget = targets[0] || normalizeBrandRadarEntity(req.body.keyword);
                const data = await callDataForSEO(endpoint, [{
                    language_code: mentionLanguageCode(platform, language_code),
                    location_code: mentionLocationCode(platform, location_code),
                    platform,
                    target: buildBrandRadarTarget(primaryTarget, req.body.scope === 'sources' ? 'sources' : 'answer'),
                    filters: req.body.filters || undefined,
                    order_by: req.body.order_by || ['mentions,desc'],
                    offset,
                    limit
                }], authHeader);
                const result = firstTaskResult(data);
                const items = Array.isArray(result?.items) ? result.items : [];
                return res.status(200).json({
                    success: true,
                    action,
                    platform,
                    results: items.map((item) => action === 'brand_radar_top_pages'
                        ? normalizeBrandRadarPage(item)
                        : normalizeBrandRadarDomain(item)),
                    cost: Number(data.cost || 0),
                    total_count: Number(result?.total_count || result?.items_count || items.length)
                });
            }

            case 'brand_radar_ai_search_volume': {
                const keywords = (Array.isArray(req.body.keywords) && req.body.keywords.length
                    ? req.body.keywords
                    : targets.map((target) => target.name)
                ).map((keyword) => compactString(keyword, 250)).filter(Boolean).slice(0, 1000);

                if (!keywords.length) {
                    return res.status(400).json({ error: 'Keywords are required for brand_radar_ai_search_volume' });
                }

                const data = await callDataForSEO(`${DATAFORSEO_API_BASE}/ai_optimization/ai_keyword_data/keywords_search_volume/live`, [{
                    language_name,
                    location_code,
                    keywords
                }], authHeader);
                const result = firstTaskResult(data);
                const items = Array.isArray(result?.items) ? result.items : [];
                return res.status(200).json({
                    success: true,
                    action,
                    results: items.map((item) => ({
                        keyword: item?.keyword || '',
                        ai_search_volume: Number(item?.ai_search_volume || 0),
                        ai_monthly_searches: Array.isArray(item?.ai_monthly_searches) ? item.ai_monthly_searches : []
                    })),
                    cost: Number(data.cost || 0),
                    total_count: items.length
                });
            }

            case 'brand_radar_google_ai_mode':
            case 'brand_radar_google_ai_overview': {
                const keyword = compactString(req.body.keyword || targets[0]?.name, 700);
                if (!keyword) {
                    return res.status(400).json({ error: 'Keyword is required for Google AI SERP lookups' });
                }

                const isAiMode = action === 'brand_radar_google_ai_mode';
                const endpoint = isAiMode
                    ? `${DATAFORSEO_API_BASE}/serp/google/ai_mode/live/advanced`
                    : `${DATAFORSEO_API_BASE}/serp/google/organic/live/advanced`;
                const data = await callDataForSEO(endpoint, [{
                    keyword,
                    location_code,
                    language_code,
                    device: req.body.device || 'desktop',
                    os: req.body.os || 'windows',
                    depth: Math.max(10, Math.min(Number(req.body.depth || 20), 100)),
                    load_async_ai_overview: isAiMode ? undefined : true
                }], authHeader);
                const result = firstTaskResult(data);
                const items = Array.isArray(result?.items) ? result.items : [];
                return res.status(200).json({
                    success: true,
                    action,
                    keyword,
                    check_url: result?.check_url || '',
                    results: normalizeGoogleAiSerpItems(items),
                    raw_items_count: items.length,
                    cost: Number(data.cost || 0),
                    total_count: Number(result?.items_count || items.length)
                });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error) {
        console.error(`DataforSEO Brand Radar error [${action}]:`, error?.data ? JSON.stringify(error.data, null, 2) : error);
        return res.status(error?.status || 500).json({
            error: 'DataforSEO Brand Radar request failed',
            message: error?.message || 'Failed to call DataforSEO Brand Radar endpoint',
            status_code: error?.data?.status_code,
            status_message: error?.data?.status_message
        });
    }
}

function normalizeBrandRadarMention(item, targets, platform) {
    const question = item?.question || item?.keyword || item?.prompt || '';
    const answer = item?.answer || item?.markdown || item?.text || item?.description || '';
    const sourceItems = [
        ...(Array.isArray(item?.sources) ? item.sources : []),
        ...(Array.isArray(item?.cited_sources) ? item.cited_sources : []),
        ...(Array.isArray(item?.source_items) ? item.source_items : [])
    ];
    const targetNames = targets.map((target) => target.name).filter(Boolean);
    const haystack = `${question} ${answer}`.toLowerCase();
    const mentions = targetNames.filter((name) => haystack.includes(name.toLowerCase()));

    return {
        question,
        answer,
        platform,
        ai_search_volume: Number(item?.ai_search_volume || 0),
        ai_monthly_searches: Array.isArray(item?.ai_monthly_searches) ? item.ai_monthly_searches : [],
        mentions,
        sources: sourceItems.map((source) => ({
            title: source?.title || source?.page_title || '',
            url: source?.url || source?.source_url || '',
            domain: source?.domain || normalizeDataForSeoDomain(source?.url || ''),
            text: source?.text || source?.snippet || source?.description || '',
            rank: source?.rank_group || source?.rank_absolute || null
        })).filter((source) => source.url || source.domain || source.title),
        search_results: (Array.isArray(item?.search_results) ? item.search_results : []).map((result) => ({
            title: result?.title || '',
            url: result?.url || '',
            domain: result?.domain || normalizeDataForSeoDomain(result?.url || ''),
            rank: result?.rank_group || result?.rank_absolute || null
        })),
        updated: item?.last_updated_time || item?.datetime || item?.date || '',
        raw_type: item?.type || ''
    };
}

function normalizeBrandRadarPage(item) {
    return {
        url: item?.url || item?.page_url || item?.key || '',
        title: item?.title || item?.page_title || item?.key || '',
        domain: item?.domain || normalizeDataForSeoDomain(item?.url || item?.page_url || item?.key || ''),
        mentions: Number(item?.mentions || 0),
        ai_search_volume: Number(item?.ai_search_volume || 0),
        impressions: Number(item?.impressions || 0),
        platform: normalizeGroupItems(item?.platform, 5),
        sources_domain: normalizeGroupItems(item?.sources_domain, 10),
        search_results_domain: normalizeGroupItems(item?.search_results_domain, 10),
        location: normalizeGroupItems(item?.location, 5),
        language: normalizeGroupItems(item?.language, 5)
    };
}

function normalizeBrandRadarDomain(item) {
    return {
        domain: item?.key || item?.domain || '',
        mentions: Number(item?.mentions || 0),
        ai_search_volume: Number(item?.ai_search_volume || 0),
        impressions: Number(item?.impressions || 0),
        platform: normalizeGroupItems(item?.platform, 5),
        sources_domain: normalizeGroupItems(item?.sources_domain, 10),
        search_results_domain: normalizeGroupItems(item?.search_results_domain, 10),
        brand_entities_title: normalizeGroupItems(item?.brand_entities_title, 10),
        location: normalizeGroupItems(item?.location, 5),
        language: normalizeGroupItems(item?.language, 5)
    };
}

function normalizeGoogleAiSerpItems(items) {
    const aiItems = items.filter((item) => String(item?.type || '').includes('ai'));
    return (aiItems.length ? aiItems : items.slice(0, 10)).map((item) => ({
        type: item?.type || '',
        title: item?.title || '',
        markdown: item?.markdown || item?.description || item?.snippet || '',
        url: item?.url || '',
        domain: item?.domain || normalizeDataForSeoDomain(item?.url || ''),
        rank_group: item?.rank_group || null,
        rank_absolute: item?.rank_absolute || null,
        items: Array.isArray(item?.items) ? item.items : [],
        references: Array.isArray(item?.references) ? item.references : []
    }));
}

// Standard Proxy Handler
async function handleProxy(req, res) {
    let targetUrl, userAgent;

    if (req.method === 'POST') {
        targetUrl = req.body?.url;
        userAgent = req.body?.ua;
    } else {
        targetUrl = req.query?.url;
        userAgent = req.query?.ua;
    }

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    const finalUserAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetchPublicHttpUrl(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': finalUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
        }).finally(() => clearTimeout(timeoutId));

        const contentType = response.headers.get('content-type') || '';
        const contentLength = response.headers.get('content-length');
        if (Number(contentLength || 0) > MAX_PROXY_BODY_BYTES) {
            return res.status(413).json({ error: 'Fetched response is too large' });
        }
        const auditHeaderNames = new Set([
            'strict-transport-security',
            'content-security-policy',
            'x-content-type-options',
            'x-frame-options',
            'referrer-policy'
        ]);
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            const normalizedKey = key.toLowerCase();
            if (auditHeaderNames.has(normalizedKey)) {
                responseHeaders[normalizedKey] = value;
            }
        });
        const text = (await response.text()).slice(0, MAX_PROXY_BODY_BYTES);

        if (req.method === 'POST') {
            return res.status(200).json({
                content: text,
                statusCode: response.status,
                url: response.url,
                contentType: contentType,
                contentLength: contentLength ? Number(contentLength) : null,
                headers: responseHeaders,
                redirected: response.redirected
            });
        }

        res.setHeader('Content-Type', contentType || 'text/html');
        res.status(response.status).send(text);
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('Proxy error:', error);

        if (error?.name === 'AbortError') {
            return res.status(504).json({
                error: 'Proxy request timed out',
                message: 'The remote request took too long and was aborted.',
            });
        }

        res.status(error?.status || 500).json({
            error: 'Failed to fetch URL',
            message: error?.message || 'An unexpected error occurred while proxying the request.',
        });
    }
}
