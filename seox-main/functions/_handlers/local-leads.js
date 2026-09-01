const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DEFAULT_MAX_RESULTS = 40;
const MAX_PAGE_SIZE = 20;
const CONTACT_SCAN_LIMIT = 16;
const CONTACT_EXTRA_PAGE_LIMIT = 1;
const CONTACT_SCAN_CONCURRENCY = 2;
const CONTACT_FETCH_TIMEOUT_MS = 5500;

const PLACE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.pureServiceAreaBusiness',
  'nextPageToken',
].join(',');

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LINKEDIN_PATTERN = /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:company|in)\/[^"'<>\s)]+/gi;
const CONTACT_LINK_PATTERN = /href=["']([^"']*(?:contact|about|team|staff|email)[^"']*)["']/gi;
const BAD_EMAIL_SEGMENTS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  'example.com',
  'domain.com',
  'email.com',
  'sentry.io',
  'wixpress.com',
];

export default async function handler(req, res) {
  if (!applyApiSecurity(req, res, { methods: ['GET', 'POST', 'OPTIONS'] })) return;
  if (!enforceRateLimit(req, res, { key: 'local-leads', limit: 15 })) return;
  if (req.method === 'POST' && !requireJsonBody(req, res, { maxBytes: 32_000 })) return;
  if (!await requireFirebaseUser(req, res)) return;

  const query = getRequestValue(req, 'query');
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'A local business search query is required.' });
  }

  const apiKey = getGooglePlacesKey(req);
  if (!apiKey) {
    return res.status(400).json({
      code: 'GOOGLE_PLACES_API_KEY_REQUIRED',
      error: 'Google Places API key is required.',
      message: 'Ask an administrator to configure GOOGLE_PLACES_API_KEY before running Lead Finder searches.',
    });
  }

  const maxResults = clampNumber(Number(getRequestValue(req, 'limit')) || DEFAULT_MAX_RESULTS, 1, 60);
  const languageCode = getRequestValue(req, 'languageCode') || 'en';
  const regionCode = getRequestValue(req, 'regionCode') || 'US';
  const discoverContacts = getRequestValue(req, 'discoverContacts');
  const shouldDiscoverContacts = discoverContacts === false ? false : String(discoverContacts ?? 'true') !== 'false';
  const intent = parseLeadIntent(query);

  try {
    const places = await fetchPlaces({
      apiKey,
      textQuery: intent.placesQuery || query,
      languageCode,
      regionCode,
      maxResults,
    });

    let leads = places
      .map((place, index) => mapPlaceToLead(place, index))
      .filter((lead) => lead.name)
      .filter((lead) => matchesIntentFilters(lead, intent.filters));

    if (shouldDiscoverContacts) {
      leads = await enrichLeadsWithContactSignals(leads);
    }

    return res.status(200).json({
      success: true,
      query,
      searchedQuery: intent.placesQuery || query,
      filters: intent.filters,
      total: leads.length,
      leads,
    });
  } catch (error) {
    console.error('Local leads search error:', error);
    return res.status(error.status || 500).json({
      error: 'Failed to fetch local leads.',
      message: error.message || 'Unknown error',
      details: error.details,
    });
  }
}

function getRequestValue(req, key) {
  const bodyValue = req.body && typeof req.body === 'object' ? req.body[key] : undefined;
  const queryValue = req.query && typeof req.query === 'object' ? req.query[key] : undefined;
  return bodyValue ?? queryValue;
}

function getGooglePlacesKey(req) {
  return String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
}

async function fetchPlaces({ apiKey, textQuery, languageCode, regionCode, maxResults }) {
  const places = [];
  let nextPageToken = '';

  while (places.length < maxResults) {
    const pageSize = Math.min(MAX_PAGE_SIZE, maxResults - places.length);
    const body = {
      textQuery,
      pageSize,
      languageCode,
      regionCode,
    };

    if (nextPageToken) {
      body.pageToken = nextPageToken;
    }

    const response = await fetch(PLACES_TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACE_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error?.message || `Google Places returned ${response.status}`);
      error.status = response.status;
      error.details = data.error || data;
      throw error;
    }

    places.push(...(Array.isArray(data.places) ? data.places : []));
    nextPageToken = data.nextPageToken || '';

    if (!nextPageToken) {
      break;
    }
  }

  return places.slice(0, maxResults);
}

function parseLeadIntent(rawQuery) {
  const query = String(rawQuery || '').trim();
  const filters = {
    noWebsite: /\b(?:without|no)\s+(?:a\s+)?websites?\b/i.test(query),
    hasPhone: /\b(?:has|with)\s+(?:a\s+)?phones?\b/i.test(query),
    lowRating: /\b(?:low|bad|poor)\s+ratings?\b/i.test(query),
    ownerOperated: /\bowner[-\s]?operated\b/i.test(query),
    underReviews: null,
  };

  const underReviewsMatch = query.match(/\b(?:under|fewer than|less than)\s+(\d+)\s+reviews?\b/i);
  if (underReviewsMatch) {
    filters.underReviews = Number(underReviewsMatch[1]);
  }

  let placesQuery = query
    .replace(/\b(?:with|that have|having)?\s*(?:under|fewer than|less than)\s+\d+\s+reviews?\b/gi, ' ')
    .replace(/\b(?:with|that have|having)?\s*(?:without|no)\s+(?:a\s+)?websites?\b/gi, ' ')
    .replace(/\b(?:with|that have|having)?\s*(?:low|bad|poor)\s+ratings?\b/gi, ' ')
    .replace(/\bowner[-\s]?operated\b/gi, ' ')
    .replace(/\b(?:has|with)\s+(?:a\s+)?phones?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (placesQuery.length < 2) {
    placesQuery = query;
  }

  return { placesQuery, filters };
}

function matchesIntentFilters(lead, filters) {
  if (filters.noWebsite && lead.website) return false;
  if (filters.hasPhone && !lead.phone) return false;
  if (filters.ownerOperated && !lead.ownerOperated) return false;
  if (filters.lowRating && (!lead.rating || lead.rating >= 3.5)) return false;
  if (Number.isFinite(filters.underReviews) && lead.reviewCount >= filters.underReviews) return false;
  return true;
}

function mapPlaceToLead(place, index) {
  const name = place.displayName?.text || '';
  const category = getPlaceCategory(place);
  const websiteUrl = normalizeWebsiteUrl(place.websiteUri);
  const rating = typeof place.rating === 'number' ? Number(place.rating.toFixed(1)) : null;
  const reviewCount = Number.isFinite(place.userRatingCount) ? place.userRatingCount : 0;
  const phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';
  const needs = getLeadNeeds({ rating, reviewCount, websiteUrl, phone });
  const score = scoreLead({ rating, reviewCount, websiteUrl, phone, needs });
  const priority = getPriority(score);

  return {
    id: place.id || `place-${index + 1}`,
    searchOrder: index + 1,
    placeId: place.id || '',
    name,
    category,
    score,
    priority,
    location: place.shortFormattedAddress || place.formattedAddress || '',
    rating,
    reviewCount,
    phone,
    website: websiteUrl ? formatWebsiteLabel(websiteUrl) : null,
    websiteUrl,
    email: websiteUrl ? 'searching' : 'not_found',
    emailAddress: '',
    ownerOperated: inferOwnerOperated(name, category, reviewCount),
    needs,
    pitch: getPitch(needs),
    hasDirectEmail: false,
    linkedinStatus: 'not_found',
    linkedinUrl: '',
    mapsUrl: place.googleMapsUri || '',
    businessStatus: place.businessStatus || '',
    coordinates: place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null,
  };
}

function getPlaceCategory(place) {
  const displayName = place.primaryTypeDisplayName?.text;
  if (displayName) return displayName;

  const type = place.primaryType || (Array.isArray(place.types) ? place.types.find((item) => item !== 'point_of_interest' && item !== 'establishment') : '');
  return formatTypeLabel(type || 'Local business');
}

function formatTypeLabel(type) {
  return String(type)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeWebsiteUrl(value) {
  if (!value || typeof value !== 'string') return '';

  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function formatWebsiteLabel(value) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function getLeadNeeds({ rating, reviewCount, websiteUrl, phone }) {
  const needs = [];

  if (!websiteUrl) needs.push('No Website');
  if (!phone) needs.push('No Phone Listed');
  if (!rating) needs.push('No Rating');
  else if (rating < 3.5) needs.push(`${rating} Star Rating`);
  else if (rating < 4) needs.push('Weak Rating');

  if (reviewCount === 0) needs.push('Zero Reviews');
  else if (reviewCount < 20) needs.push(`${reviewCount} Reviews`);

  if (websiteUrl && (reviewCount < 30 || (rating && rating < 4))) {
    needs.push('Weak SEO');
  }

  if (needs.length === 0) {
    needs.push('Review Growth');
  }

  return needs;
}

function scoreLead({ rating, reviewCount, websiteUrl, phone, needs }) {
  let score = 20;

  if (!websiteUrl) score += 35;
  if (!phone) score += 6;
  if (!rating) score += 16;
  else if (rating < 3.5) score += 22;
  else if (rating < 4) score += 12;

  if (reviewCount === 0) score += 18;
  else if (reviewCount < 10) score += 16;
  else if (reviewCount < 20) score += 12;
  else if (reviewCount < 50) score += 6;

  if (needs.some((need) => need.includes('SEO'))) score += 10;

  return clampNumber(score, 0, 100);
}

function getPriority(score) {
  if (score >= 75) return 'hot';
  if (score >= 58) return 'good';
  if (score >= 38) return 'moderate';
  return 'low';
}

function getPitch(needs) {
  const services = [];

  if (needs.includes('No Website')) services.push('Website Build');
  if (needs.some((need) => need.includes('SEO'))) services.push('Local SEO Setup');
  if (needs.some((need) => need.includes('Rating') || need.includes('Star'))) services.push('Reputation Management');
  if (needs.some((need) => need.includes('Reviews'))) services.push('Review Growth');
  if (needs.includes('No Phone Listed')) services.push('Google Business Profile Optimization');

  return unique(services).join(' + ') || 'Local SEO + Review Growth';
}

function inferOwnerOperated(name, category, reviewCount) {
  const chainHints = /\b(?:inc|llc|group|corp|corporation|holdings|franchise|company)\b/i;
  const ownerCategory = /\b(?:plumb|landscap|roof|electric|clean|dental|chiropr|auto|restaurant|bakery|salon|spa|contractor|repair|law|account)\b/i;
  return ownerCategory.test(category) && reviewCount < 75 && !chainHints.test(name);
}

async function enrichLeadsWithContactSignals(leads) {
  const contactCandidates = leads
    .filter((lead) => lead.websiteUrl)
    .slice(0, CONTACT_SCAN_LIMIT);
  const contactMap = new Map();

  await runLimited(contactCandidates, CONTACT_SCAN_CONCURRENCY, async (lead) => {
    try {
      const signals = await discoverContactSignals(lead.websiteUrl);
      contactMap.set(lead.id, signals);
    } catch (error) {
      console.warn('Contact discovery skipped for lead:', lead.id, error?.message || error);
    }
  });

  return leads.map((lead) => {
    const signals = contactMap.get(lead.id);
    if (!signals) {
      return lead.websiteUrl ? { ...lead, email: 'not_found' } : lead;
    }

    const emailAddress = signals.emails[0] || '';
    const linkedinUrl = signals.linkedinUrls[0] || '';

    return {
      ...lead,
      email: emailAddress ? 'found' : (lead.websiteUrl ? 'not_found' : 'not_found'),
      emailAddress,
      hasDirectEmail: Boolean(emailAddress),
      linkedinStatus: linkedinUrl ? 'found' : 'not_found',
      linkedinUrl,
    };
  });
}

async function discoverContactSignals(websiteUrl) {
  const pages = new Set([websiteUrl]);
  const firstPage = await fetchWebsiteText(websiteUrl);

  collectContactLinks(firstPage, websiteUrl).slice(0, CONTACT_EXTRA_PAGE_LIMIT).forEach((url) => pages.add(url));

  const pageTexts = [firstPage];
  const extraPages = [...pages].filter((url) => url !== websiteUrl);
  const extraTexts = await Promise.all(extraPages.map((url) => fetchWebsiteText(url)));
  pageTexts.push(...extraTexts);

  const combined = pageTexts.join('\n').slice(0, 1000000);

  return {
    emails: extractEmails(combined),
    linkedinUrls: extractLinkedInUrls(combined),
  };
}

async function fetchWebsiteText(url) {
  if (!url) return '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONTACT_FETCH_TIMEOUT_MS);

  try {
    const response = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return '';
    }

    return (await response.text()).slice(0, 500000);
  } catch {
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}

function collectContactLinks(html, baseUrl) {
  if (!html) return [];

  const links = [];
  const base = new URL(baseUrl);
  let match = CONTACT_LINK_PATTERN.exec(html);

  while (match) {
    try {
      const candidate = new URL(match[1].replace(/&amp;/g, '&'), base);
      const sameSite = candidate.hostname === base.hostname || candidate.hostname.endsWith(`.${base.hostname}`);
      if (sameSite && (candidate.protocol === 'http:' || candidate.protocol === 'https:')) {
        links.push(candidate.toString());
      }
    } catch {
      // Ignore malformed href values from third-party markup.
    }
    match = CONTACT_LINK_PATTERN.exec(html);
  }

  return unique(links);
}

function extractEmails(text) {
  if (!text) return [];

  return unique((text.match(EMAIL_PATTERN) || [])
    .map((email) => email.toLowerCase())
    .filter((email) => !BAD_EMAIL_SEGMENTS.some((segment) => email.includes(segment))));
}

function extractLinkedInUrls(text) {
  if (!text) return [];

  return unique((text.match(LINKEDIN_PATTERN) || [])
    .map((url) => url.replace(/&amp;/g, '&').replace(/[.,;]+$/, '')));
}

async function runLimited(items, limit, worker) {
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve().then(() => worker(item));
    executing.add(promise);
    promise.finally(() => executing.delete(promise));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
import {
  applyApiSecurity,
  enforceRateLimit,
  requireFirebaseUser,
  requireJsonBody,
  safeFetch
} from './security.js';
