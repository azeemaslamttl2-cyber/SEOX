import { getDomain } from 'tldts';
import {
  applyApiSecurity,
  enforceRateLimit,
  requireFirebaseUser,
  requireJsonBody
} from './security.js';
import { getAhrefsApiToken } from './ahrefs-config.js';

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const RDAP_URL = 'https://rdap.org/domain/';
const DNS_OVER_HTTPS_URL = 'https://dns.google/resolve';
const OPEN_PAGE_RANK_URL = 'https://openpagerank.com/api/v1.0/getPageRank';
const AHREFS_DR_URL = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const MAX_PLACES_PAGE_SIZE = 20;
const MAX_CHECK_BATCH_SIZE = 8;
const MAX_ENRICH_BATCH_SIZE = 10;
const NEAR_EXPIRY_DAYS = 30;

const RDAP_REGISTRY_URLS = {
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
  io: 'https://rdap.nic.io/domain/',
  co: 'https://rdap.nic.co/domain/',
  me: 'https://rdap.nic.me/domain/',
  biz: 'https://rdap.nic.biz/domain/',
  info: 'https://rdap.identitydigital.services/rdap/domain/',
};

const IGNORED_HOSTING_DOMAINS = [
  'tumblr.com', 'blogspot.com', 'wordpress.com', 'myshopify.com', 'appspot.com',
  'weebly.com', 'wixsite.com', 'squarespace.com', 'github.io', 'gitlab.io',
  'netlify.app', 'herokuapp.com', 'vercel.app', 'firebaseapp.com', 'web.app',
  'azurewebsites.net', 'cloudfront.net', 'akamaized.net', 'amazonaws.com',
  's3.amazonaws.com', 'cloudflare.com', 'pages.dev', 'blogspot.co.uk', 'blogspot.in',
  'livejournal.com', 'typepad.com', 'medium.com', 'substack.com', 'ghost.io',
  'carrd.co', 'notion.site', 'sites.google.com', 'docs.google.com', 'drive.google.com',
  'forms.gle', 'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'fb.me', 'linktr.ee',
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'youtu.be', 'tiktok.com', 'pinterest.com', 'reddit.com', 'quora.com',
  'slideshare.net', 'scribd.com', 'issuu.com', 'flickr.com', 'imgur.com',
  'photobucket.com', 'deviantart.com', 'behance.net', 'dribbble.com', 'soundcloud.com',
  'bandcamp.com', 'spotify.com', 'mixcloud.com', 'vimeo.com', 'dailymotion.com',
  'twitch.tv', 'discord.gg', 'discord.com', 'slack.com', 'trello.com',
  'asana.com', 'monday.com', 'airtable.com', 'figma.com', 'canva.com',
  'dropbox.com', 'box.com', 'onedrive.live.com', 'sharepoint.com', 'zoom.us',
  'meet.google.com', 'teams.microsoft.com', 'calendly.com', 'eventbrite.com',
  'meetup.com', 'mailchimp.com', 'hubspot.com', 'salesforce.com', 'zendesk.com',
  'intercom.io', 'crisp.chat', 'freshdesk.com', 'helpscout.com', 'typeform.com',
  'jotform.com', 'surveymonkey.com', 'google.com', 'bing.com', 'yahoo.com',
  'duckduckgo.com', 'baidu.com', 'yandex.com', 'ecosia.org', 'globo.com', 'uk.com',
  'business.site', 'maps.app.goo.gl', 'yelp.com', 'yellowpages.com', 'tripadvisor.com',
];

const PLACE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',');

export default async function handler(req, res) {
  if (!applyApiSecurity(req, res, { methods: ['POST', 'OPTIONS'] })) return;
  if (!enforceRateLimit(req, res, { key: 'local-expired-finder', limit: 60 })) return;
  if (!requireJsonBody(req, res, { maxBytes: 96_000 })) return;
  if (!await requireFirebaseUser(req, res)) return;

  const action = String(req.body?.action || '').trim().toLowerCase();

  try {
    if (action === 'discover') return await handleDiscover(req, res);
    if (action === 'check') return await handleCheck(req, res);
    if (action === 'enrich') return await handleEnrich(req, res);

    return res.status(400).json({
      code: 'SCAN_ACTION_REQUIRED',
      error: 'A scan action is required.',
      message: 'Refresh the Local Expired Finder and start the scan again.',
    });
  } catch (error) {
    console.error(`Local expired finder ${action || 'unknown'} error:`, error);
    return res.status(error.status || 500).json({
      error: 'Unable to process the local domain scan.',
      message: error.message || 'Unknown error',
    });
  }
}

export async function handleDiscover(req, res) {
  const query = String(req.body?.query || '').trim().slice(0, 160);
  const location = String(req.body?.location || '').trim().slice(0, 160);
  const googlePlacesApiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
  const regionCode = String(req.body?.regionCode || 'US').trim().toUpperCase().slice(0, 2);
  const pageToken = String(req.body?.pageToken || '').trim();
  const pageSize = clamp(Number(req.body?.pageSize) || MAX_PLACES_PAGE_SIZE, 1, MAX_PLACES_PAGE_SIZE);

  if (query.length < 2) return res.status(400).json({ error: 'Enter a business niche or service.' });
  if (!googlePlacesApiKey) {
    return res.status(400).json({
      code: 'GOOGLE_PLACES_API_KEY_REQUIRED',
      error: 'Google Places API key is required.',
      message: 'Ask an administrator to configure GOOGLE_PLACES_API_KEY before searching.',
    });
  }

  const textQuery = location ? `${query} in ${location}` : query;
  const data = await searchPlacesPage({ textQuery, googlePlacesApiKey, regionCode, pageSize, pageToken });
  const mappedBusinesses = data.places.map((place, index) => toBusiness(place, index));
  const businesses = mappedBusinesses.filter((business) => business.domain);

  return res.status(200).json({
    success: true,
    action: 'discover',
    query,
    location,
    placesFound: data.places.length,
    websitesFound: businesses.length,
    ignoredWebsites: mappedBusinesses.length - businesses.length,
    businesses,
    nextPageToken: data.nextPageToken,
  });
}

export async function handleCheck(req, res) {
  const businesses = normalizeBusinesses(req.body?.businesses).slice(0, MAX_CHECK_BATCH_SIZE);
  if (businesses.length === 0) {
    return res.status(400).json({ error: 'Provide at least one valid business website to check.' });
  }

  // Three workers, with DNS and RDAP running together per domain, stays within
  // Cloudflare's six simultaneous outbound connection limit.
  const results = await mapWithConcurrency(businesses, 3, async (business) => {
    const [domainInfo, dnsInfo] = await Promise.all([
      checkDomainRdap(business.domain),
      checkDomainDns(business.domain),
    ]);
    const hasAvailabilityConflict = domainInfo.registered === false && dnsInfo.status === 'resolved';
    const verifiedDomainInfo = hasAvailabilityConflict ? {
      ...domainInfo,
      registered: null,
      expired: false,
      error: 'The registry reported no domain record, but DNS still resolves. The result was withheld to avoid a false positive.',
    } : domainInfo;
    const status = getDomainStatus(verifiedDomainInfo);
    const availableNow = verifiedDomainInfo.registered === false;
    const opportunity = status === 'Expired' || status === 'Expiring';
    const daysRemaining = getDaysRemaining(verifiedDomainInfo.expires);
    const baseScore = scoreOpportunity({
      status,
      availableNow,
      daysRemaining,
      pageRank: null,
      domainAuthority: null,
      rating: business.rating,
      reviewCount: business.reviewCount,
    });

    return {
      ...business,
      status,
      opportunity,
      availableNow,
      expires: verifiedDomainInfo.expires,
      daysRemaining,
      lifecycleStatuses: verifiedDomainInfo.statuses,
      rdapSource: verifiedDomainInfo.source,
      dnsStatus: dnsInfo.status,
      checkReason: getCheckReason({ status, availableNow, daysRemaining, domainInfo: verifiedDomainInfo }),
      checkedAt: new Date().toISOString(),
      da: null,
      pr: null,
      score: baseScore,
    };
  });

  return res.status(200).json({
    success: true,
    action: 'check',
    checked: results.length,
    summary: summarizeChecks(results),
    results,
  });
}

export async function handleEnrich(req, res) {
  const leads = normalizeEnrichmentLeads(req.body?.leads).slice(0, MAX_ENRICH_BATCH_SIZE);
  const openPageRankApiKey = String(process.env.OPEN_PAGERANK_API_KEY || '').trim();

  if (leads.length === 0) {
    return res.status(400).json({ error: 'Provide at least one opportunity to enrich.' });
  }

  const domains = leads.map((lead) => lead.domain);
  const [pageRanks, domainAuthorities] = await Promise.all([
    getPageRanks(domains, openPageRankApiKey),
    getAhrefsDomainRatings(domains),
  ]);

  const metrics = leads.map((lead) => {
    const pageRank = pageRanks.get(lead.domain) ?? null;
    const domainAuthority = domainAuthorities.get(lead.domain) ?? null;
    return {
      domain: lead.domain,
      da: domainAuthority,
      pr: pageRank,
      score: scoreOpportunity({ ...lead, pageRank, domainAuthority }),
    };
  });

  return res.status(200).json({ success: true, action: 'enrich', metrics });
}

async function searchPlacesPage({ textQuery, googlePlacesApiKey, regionCode, pageSize, pageToken }) {
  const body = { textQuery, pageSize, languageCode: 'en', regionCode };
  if (pageToken) body.pageToken = pageToken;

  const response = await fetchWithTimeout(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googlePlacesApiKey,
      'X-Goog-FieldMask': PLACE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  }, 10000);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || `Google Places returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return {
    places: Array.isArray(data.places) ? data.places : [],
    nextPageToken: String(data.nextPageToken || ''),
  };
}

function toBusiness(place, index) {
  const websiteUrl = normalizeUrl(place.websiteUri);
  const domain = domainFromUrl(websiteUrl);
  const name = place.displayName?.text || 'Local business';

  return {
    id: place.id || `business-${index + 1}`,
    business: name,
    initial: name.charAt(0).toUpperCase(),
    sub: place.primaryTypeDisplayName?.text || 'Local business',
    domain,
    websiteUrl,
    mapsUrl: normalizeUrl(place.googleMapsUri),
    rating: Number.isFinite(place.rating) ? place.rating : null,
    reviewCount: Number.isFinite(place.userRatingCount) ? place.userRatingCount : 0,
    coordinates: normalizeCoordinates(place.location),
    avatarColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index % 5],
  };
}

function normalizeBusinesses(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const websiteUrl = normalizeUrl(item.websiteUrl);
    const domain = websiteUrl ? domainFromUrl(websiteUrl) : normalizeDomain(item.domain);
    if (!domain || unique.has(domain)) return;
    const business = String(item.business || 'Local business').trim().slice(0, 180);

    unique.set(domain, {
      id: String(item.id || `business-${index + 1}`).slice(0, 180),
      business,
      initial: business.charAt(0).toUpperCase(),
      sub: String(item.sub || 'Local business').trim().slice(0, 120),
      domain,
      websiteUrl,
      mapsUrl: normalizeUrl(item.mapsUrl),
      rating: Number.isFinite(item.rating) ? item.rating : null,
      reviewCount: Number.isFinite(item.reviewCount) ? item.reviewCount : 0,
      coordinates: normalizeCoordinates(item.coordinates),
      avatarColor: /^#[0-9a-f]{6}$/i.test(item.avatarColor || '') ? item.avatarColor : '#3b82f6',
    });
  });

  return Array.from(unique.values());
}

function normalizeEnrichmentLeads(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();

  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const domain = normalizeDomain(item.domain);
    if (!domain || unique.has(domain)) return;
    unique.set(domain, {
      domain,
      status: item.status === 'Expiring' ? 'Expiring' : 'Expired',
      availableNow: Boolean(item.availableNow),
      daysRemaining: Number.isFinite(item.daysRemaining) ? item.daysRemaining : null,
      rating: Number.isFinite(item.rating) ? item.rating : null,
      reviewCount: Number.isFinite(item.reviewCount) ? item.reviewCount : 0,
    });
  });

  return Array.from(unique.values());
}

async function checkDomainDns(domain) {
  try {
    const url = new URL(DNS_OVER_HTTPS_URL);
    url.searchParams.set('name', domain);
    url.searchParams.set('type', 'A');
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/dns-json' } }, 3000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'unknown' };
    if (Number(data.Status) === 3) return { status: 'nxdomain' };
    if (Array.isArray(data.Answer) && data.Answer.length > 0) return { status: 'resolved' };
    return { status: 'no-address' };
  } catch {
    return { status: 'unknown' };
  }
}

async function checkDomainRdap(domain) {
  const errors = [];

  for (const url of getRdapUrls(domain)) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Accept: 'application/rdap+json, application/json' },
      }, 4000);

      const requestedHost = new URL(url).hostname;
      const responseHost = response.url ? new URL(response.url).hostname : requestedHost;

      if (response.status === 404 && !(requestedHost === 'rdap.org' && responseHost === 'rdap.org')) {
        return {
          registered: false,
          expires: null,
          expired: true,
          statuses: [],
          source: responseHost,
          error: null,
        };
      }

      if (response.status === 404) {
        errors.push('rdap.org: no authoritative registry response');
        continue;
      }

      if (!response.ok) {
        errors.push(`${new URL(url).hostname}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      const expires = findExpirationDate(data);
      const statuses = normalizeRdapStatuses(data.status);
      const lifecycleExpired = statuses.some((status) =>
        status.includes('pending delete') || status.includes('redemption period') || status.includes('pending restore'));
      const expiryTime = expires ? new Date(expires).getTime() : Number.NaN;

      return {
        registered: true,
        expires,
        expired: lifecycleExpired || (Number.isFinite(expiryTime) && expiryTime < Date.now()),
        statuses,
        source: responseHost,
        error: null,
      };
    } catch (error) {
      errors.push(`${new URL(url).hostname}: ${error.name === 'AbortError' ? 'timeout' : error.message || 'network error'}`);
    }
  }

  return {
    registered: null,
    expires: null,
    expired: false,
    statuses: [],
    source: '',
    error: errors.join('; ') || 'RDAP lookup failed',
  };
}

function getRdapUrls(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const registryUrl = RDAP_REGISTRY_URLS[tld];
  const urls = registryUrl ? [`${registryUrl}${encodeURIComponent(domain)}`] : [];
  urls.push(`${RDAP_URL}${encodeURIComponent(domain)}`);
  return Array.from(new Set(urls));
}

function findExpirationDate(data) {
  const dates = (Array.isArray(data.events) ? data.events : [])
    .filter((event) => /expir/i.test(String(event?.eventAction || '')))
    .map((event) => String(event?.eventDate || ''))
    .filter((date) => Number.isFinite(new Date(date).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return dates[0] || null;
}

function normalizeRdapStatuses(value) {
  if (!Array.isArray(value)) return [];
  return value.map((status) => String(status || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase())
    .filter(Boolean);
}

async function getPageRanks(domains, apiKey) {
  const ranks = new Map();
  if (!apiKey || domains.length === 0) return ranks;

  try {
    const url = new URL(OPEN_PAGE_RANK_URL);
    domains.forEach((domain) => url.searchParams.append('domains[]', domain));
    const response = await fetchWithTimeout(url, { headers: { 'API-OPR': apiKey } }, 4000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.response)) return ranks;

    data.response.forEach((item) => {
      const domain = normalizeDomain(item.domain);
      const rank = Number(item.page_rank_integer);
      if (domain && Number.isFinite(rank)) ranks.set(domain, rank);
    });
  } catch {
    // PageRank is optional and must never block opportunity results.
  }

  return ranks;
}

async function getAhrefsDomainRatings(domains) {
  const ratings = new Map();
  const apiToken = getAhrefsApiToken();
  if (!apiToken) return ratings;

  await mapWithConcurrency(domains, 4, async (domain) => {
    try {
      const url = new URL(AHREFS_DR_URL);
      url.searchParams.set('target', domain);
      url.searchParams.set('output', 'json');
      const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${apiToken}` } }, 4000);
      const data = await response.json().catch(() => ({}));
      const rating = Number(data?.domain_rating?.domain_rating);
      if (response.ok && Number.isFinite(rating)) ratings.set(domain, rating);
    } catch {
      // Domain Authority is optional and must never block opportunity results.
    }
  });

  return ratings;
}

function getDomainStatus({ registered, expires, expired }) {
  if (registered === false) return 'Expired';
  if (registered === null) return 'Unknown';
  if (expired) return 'Expired';
  const daysRemaining = getDaysRemaining(expires);
  if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= NEAR_EXPIRY_DAYS) return 'Expiring';
  return 'Registered';
}

function getDaysRemaining(expires) {
  if (!expires) return null;
  const expiryTime = new Date(expires).getTime();
  if (!Number.isFinite(expiryTime)) return null;
  return Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000));
}

function getCheckReason({ status, availableNow, daysRemaining, domainInfo }) {
  if (availableNow) return 'The registry reports this previously listed website domain is available now.';
  if (status === 'Expired' && domainInfo.statuses.length > 0) {
    return `Registry lifecycle status: ${domainInfo.statuses.join(', ')}.`;
  }
  if (status === 'Expired') return 'The registry expiration date has passed.';
  if (status === 'Expiring') {
    const days = Math.max(0, daysRemaining);
    return `${days} ${days === 1 ? 'day remains' : 'days remain'} until the registry expiration date.`;
  }
  if (status === 'Unknown') return domainInfo.error || 'The registry did not return a definitive result.';
  return domainInfo.expires ? 'The domain is registered outside the near-expiry window.' : 'The domain is registered; no public expiry date was returned.';
}

function summarizeChecks(results) {
  return results.reduce((summary, result) => {
    summary.checked += 1;
    if (result.availableNow) summary.available += 1;
    else if (result.status === 'Expired') summary.expired += 1;
    else if (result.status === 'Expiring') summary.expiring += 1;
    else if (result.status === 'Registered') summary.registered += 1;
    else summary.unknown += 1;
    if (result.opportunity) summary.opportunities += 1;
    return summary;
  }, { checked: 0, available: 0, expired: 0, expiring: 0, registered: 0, unknown: 0, opportunities: 0 });
}

function scoreOpportunity({ status, availableNow, daysRemaining, pageRank, domainAuthority, rating, reviewCount }) {
  let score = availableNow ? 90 : status === 'Expired' ? 80 : status === 'Expiring' ? 65 : 0;
  if (status === 'Expiring' && Number.isFinite(daysRemaining)) score += Math.max(0, NEAR_EXPIRY_DAYS - daysRemaining) / 3;
  score += (pageRank || 0) * 3;
  score += Math.min(domainAuthority || 0, 20) / 2;
  if (rating !== null && rating < 4) score += 5;
  if (reviewCount < 20) score += 4;
  return Math.round(clamp(score, 0, 100));
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function domainFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (isIgnoredHostingDomain(hostname)) return '';
    return normalizeDomain(hostname);
  } catch {
    return '';
  }
}

function normalizeDomain(value) {
  const hostname = String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!hostname || isIgnoredHostingDomain(hostname)) return '';
  return getDomain(hostname, { allowPrivateDomains: true }) || '';
}

function isIgnoredHostingDomain(hostname) {
  return IGNORED_HOSTING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function normalizeCoordinates(value) {
  const lat = Number(value?.latitude ?? value?.lat);
  const lng = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
