import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle, CheckCircle, Download, ExternalLink, Globe, Key, Layers, Map as MapIcon,
  MapPin, Minus, Plus, Search, Star, TrendingUp, XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { buildLocationJobs, chunkItems, summarizeDomainChecks } from '../utils/localExpiredFinderScan';
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const COUNTRIES = [
  ['United States', 'US'], ['United Kingdom', 'GB'], ['Canada', 'CA'], ['Australia', 'AU'],
  ['Germany', 'DE'], ['France', 'FR'], ['Spain', 'ES'], ['Italy', 'IT'], ['India', 'IN'], ['UAE', 'AE'],
];
const STEPS = [
  ['Choose Niche', 'Select your business niche or service'],
  ['Pick Locations', 'Target one or more cities or areas'],
  ['Scan Businesses', 'Check every unique website in small batches'],
  ['View Leads', 'See dropped, expired, and expiring domains'],
];
const CHECK_BATCH_SIZE = 8;
const ENRICH_BATCH_SIZE = 10;
const DOMAIN_CACHE_KEY = 'localExpiredFinder.domainChecks.v1';
const DOMAIN_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

const createPinIcon = (index) => L.divIcon({
  className: 'lef-leaflet-pin',
  html: `<div class="lef-lpin"><span>${index + 1}</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function ZoomControls() {
  const map = useMap();
  return (
    <div className="lef-leaflet-zoom">
      <button className="lef-leaflet-zoom-btn" type="button" onClick={() => map.zoomIn()} aria-label="Zoom in"><Plus size={14} /></button>
      <button className="lef-leaflet-zoom-btn" type="button" onClick={() => map.zoomOut()} aria-label="Zoom out"><Minus size={14} /></button>
      <span className="lef-leaflet-zoom-btn lef-leaflet-zoom-layers"><Layers size={14} /></span>
    </div>
  );
}

const statusColor = (status) => {
  if (status === 'Available now') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.25)' };
  if (status === 'Expired') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' };
  if (status === 'Expiring') return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' };
  return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' };
};

const formatExpiration = (lead) => {
  if (lead.availableNow) return 'Available now';
  if (!lead.expires) return '—';
  const date = new Date(lead.expires);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const getStatusLabel = (lead) => lead.availableNow ? 'Available now' : lead.status;
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

async function postFinder(payload, signal, timeoutMs = 20000) {
  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');
  const controller = new AbortController();
  let timedOut = false;
  const abortFromScan = () => controller.abort();
  signal?.addEventListener('abort', abortFromScan, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await authenticatedFetch('/api/local-expired-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Scan request failed.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');
    if (timedOut) throw new Error('A scan batch timed out. It will be counted as an unresolved batch.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromScan);
  }
}

async function postFinderWithRetry(payload, signal, timeoutMs, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await postFinder(payload, signal, timeoutMs);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError;
}

function readDomainCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOMAIN_CACHE_KEY) || '{}');
    const now = Date.now();
    return new Map(Object.entries(parsed).filter(([, value]) =>
      value && value.status !== 'Unknown' && now - new Date(value.checkedAt).getTime() < DOMAIN_CACHE_TTL_MS));
  } catch {
    return new Map();
  }
}

function writeDomainCache(results) {
  try {
    const merged = readDomainCache();
    results.forEach((result) => {
      if (result.status === 'Unknown') return;
      merged.delete(result.domain);
      merged.set(result.domain, {
        status: result.status,
        opportunity: result.opportunity,
        availableNow: result.availableNow,
        expires: result.expires,
        daysRemaining: result.daysRemaining,
        lifecycleStatuses: result.lifecycleStatuses,
        rdapSource: result.rdapSource,
        dnsStatus: result.dnsStatus,
        checkReason: result.checkReason,
        checkedAt: result.checkedAt,
        da: result.da,
        pr: result.pr,
        score: result.score,
      });
    });
    const cacheEntries = Array.from(merged.entries()).slice(-750);
    localStorage.setItem(DOMAIN_CACHE_KEY, JSON.stringify(Object.fromEntries(cacheEntries)));
  } catch {
    // The scan remains functional when storage is unavailable or full.
  }
}

function unknownResult(business, message) {
  return {
    ...business,
    status: 'Unknown',
    opportunity: false,
    availableNow: false,
    expires: null,
    daysRemaining: null,
    lifecycleStatuses: [],
    rdapSource: '',
    dnsStatus: 'unknown',
    checkReason: message,
    checkedAt: new Date().toISOString(),
    da: null,
    pr: null,
    score: 0,
  };
}

export default function LocalExpiredFinder() {
  const { user } = useAuth();
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('United States');
  const [city, setCity] = useState('');
  const [businessLimit, setBusinessLimit] = useState(20);
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [leads, setLeads] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const [scanProgress, setScanProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const countryRef = useRef(null);
  const scanAbortRef = useRef(null);
  const googlePlacesApiKey = 'server-managed';
  const openPageRankApiKey = 'server-managed';

  useEffect(() => () => scanAbortRef.current?.abort(), []);

  const stats = useMemo(() => ({
    total: leads.length,
    available: leads.filter((lead) => lead.availableNow).length,
    expired: leads.filter((lead) => lead.status === 'Expired' && !lead.availableNow).length,
    expiring: leads.filter((lead) => lead.status === 'Expiring').length,
  }), [leads]);
  const mapLeads = useMemo(() => leads.filter((lead) =>
    Number.isFinite(lead.coordinates?.lat) && Number.isFinite(lead.coordinates?.lng)), [leads]);
  const mapCenter = mapLeads[0]?.coordinates ? [mapLeads[0].coordinates.lat, mapLeads[0].coordinates.lng] : [39.8283, -98.5795];

  const handleSearch = async () => {
    const locations = Array.from(new Set(city.split(',').map((value) => value.trim()).filter(Boolean))).slice(0, 50);
    if (!niche.trim()) return setError('Enter a business niche or service.');
    if (!googlePlacesApiKey) return setError('Add your Google Places API key in Settings before searching.');

    const scanLocations = locations.length ? locations : [country];
    const { jobs, requested, capacity } = buildLocationJobs(scanLocations, businessLimit);
    const regionCode = COUNTRIES.find(([name]) => name === country)?.[1] || 'US';
    const controller = new AbortController();
    const businessesByDomain = new Map();
    const checksByDomain = new Map();
    const cache = readDomainCache();
    const discoveryErrors = [];
    let successfulDiscoveryBatches = 0;
    const meta = {
      requested, capacity, placesFound: 0, websitesFound: 0, uniqueDomains: 0,
      checked: 0, available: 0, expired: 0, expiring: 0, registered: 0,
      unknown: 0, opportunities: 0, cached: 0, failedBatches: 0,
      locationsCompleted: 0, locationsTotal: jobs.length,
    };

    const publishMeta = () => setSearchMeta({ ...meta });
    const publishChecks = () => {
      Object.assign(meta, summarizeDomainChecks(Array.from(checksByDomain.values())));
      const opportunities = Array.from(checksByDomain.values())
        .filter((result) => result.opportunity)
        .sort((a, b) => b.score - a.score);
      setLeads(opportunities);
      publishMeta();
    };

    scanAbortRef.current = controller;
    setIsLoading(true);
    setError('');
    setNotice('');
    setHasSearched(false);
    setSearchMeta({ ...meta });
    setLeads([]);

    try {
      setScanProgress({ phase: 'discovering', current: 0, total: capacity, message: 'Finding businesses across your selected areas…' });
      await mapWithConcurrency(jobs, 2, async (job) => {
        let foundForLocation = 0;
        let pageToken = '';

        while (foundForLocation < job.target && !controller.signal.aborted) {
          const pageSize = Math.min(20, job.target - foundForLocation);
          try {
            const data = await postFinderWithRetry({
              action: 'discover', query: niche.trim(), location: job.location, regionCode,
              pageSize, pageToken,
            }, controller.signal, 15000, 2);
            successfulDiscoveryBatches += 1;
            const placesFound = Number(data.placesFound) || 0;
            foundForLocation += placesFound;
            meta.placesFound += placesFound;
            meta.websitesFound += Number(data.websitesFound) || 0;
            (Array.isArray(data.businesses) ? data.businesses : []).forEach((business) => {
              if (business.domain && !businessesByDomain.has(business.domain)) businessesByDomain.set(business.domain, business);
            });
            meta.uniqueDomains = businessesByDomain.size;
            publishMeta();
            setScanProgress({ phase: 'discovering', current: meta.placesFound, total: capacity, message: `Finding businesses in ${job.location}…` });
            pageToken = String(data.nextPageToken || '');
            if (!pageToken || placesFound === 0) break;
          } catch (requestError) {
            if (controller.signal.aborted) throw requestError;
            meta.failedBatches += 1;
            discoveryErrors.push(`${job.location}: ${requestError.message || 'Google Places request failed'}`);
            break;
          }
        }

        meta.locationsCompleted += 1;
        publishMeta();
      });

      if (successfulDiscoveryBatches === 0 && discoveryErrors.length > 0) {
        throw new Error(`Google Places search failed: ${discoveryErrors[0]}`);
      }

      const businesses = Array.from(businessesByDomain.values());
      const uncachedBusinesses = [];
      businesses.forEach((business) => {
        const cached = cache.get(business.domain);
        if (cached) {
          checksByDomain.set(business.domain, { ...business, ...cached });
          meta.cached += 1;
        } else {
          uncachedBusinesses.push(business);
        }
      });
      publishChecks();

      const checkBatches = chunkItems(uncachedBusinesses, CHECK_BATCH_SIZE);
      let checkedFresh = 0;
      setScanProgress({ phase: 'checking', current: meta.cached, total: businesses.length, message: 'Checking DNS and registry records…' });
      await mapWithConcurrency(checkBatches, 2, async (batch) => {
        try {
          const data = await postFinder({ action: 'check', businesses: batch }, controller.signal, 25000);
          (Array.isArray(data.results) ? data.results : []).forEach((result) => checksByDomain.set(result.domain, result));
        } catch (requestError) {
          if (controller.signal.aborted) throw requestError;
          meta.failedBatches += 1;
          batch.forEach((business) => checksByDomain.set(business.domain, unknownResult(business, requestError.message)));
        }
        checkedFresh += batch.length;
        publishChecks();
        setScanProgress({ phase: 'checking', current: Math.min(businesses.length, meta.cached + checkedFresh), total: businesses.length, message: 'Checking DNS and registry records…' });
      });

      const retryBusinesses = Array.from(checksByDomain.values()).filter((result) => result.status === 'Unknown');
      if (retryBusinesses.length > 0) {
        let retried = 0;
        setScanProgress({ phase: 'retrying', current: 0, total: retryBusinesses.length, message: 'Retrying unresolved registry checks…' });
        for (const batch of chunkItems(retryBusinesses, CHECK_BATCH_SIZE)) {
          if (controller.signal.aborted) throw new DOMException('Scan cancelled', 'AbortError');
          try {
            const data = await postFinder({ action: 'check', businesses: batch }, controller.signal, 25000);
            (Array.isArray(data.results) ? data.results : []).forEach((result) => checksByDomain.set(result.domain, result));
          } catch {
            meta.failedBatches += 1;
          }
          retried += batch.length;
          publishChecks();
          setScanProgress({ phase: 'retrying', current: retried, total: retryBusinesses.length, message: 'Retrying unresolved registry checks…' });
        }
      }

      const opportunities = Array.from(checksByDomain.values()).filter((result) => result.opportunity);
      let enriched = 0;
      if (opportunities.length > 0) {
        setScanProgress({ phase: 'enriching', current: 0, total: opportunities.length, message: 'Adding domain authority and PageRank…' });
        await mapWithConcurrency(chunkItems(opportunities, ENRICH_BATCH_SIZE), 2, async (batch) => {
          try {
            const data = await postFinder({
              action: 'enrich', leads: batch.map((lead) => ({
                domain: lead.domain, status: lead.status, availableNow: lead.availableNow,
                daysRemaining: lead.daysRemaining, rating: lead.rating, reviewCount: lead.reviewCount,
              })),
            }, controller.signal, 15000);
            (Array.isArray(data.metrics) ? data.metrics : []).forEach((metric) => {
              const existing = checksByDomain.get(metric.domain);
              if (existing) checksByDomain.set(metric.domain, { ...existing, ...metric });
            });
          } catch (requestError) {
            if (controller.signal.aborted) throw requestError;
            meta.failedBatches += 1;
          }
          enriched += batch.length;
          publishChecks();
          setScanProgress({ phase: 'enriching', current: enriched, total: opportunities.length, message: 'Adding domain authority and PageRank…' });
        });
      }

      writeDomainCache(checksByDomain);
      publishChecks();
      setScanProgress({ phase: 'complete', current: 1, total: 1, message: `Scan complete: ${meta.opportunities} opportunities from ${meta.checked} checked domains.` });
      if (meta.placesFound < requested) {
        const locationHint = capacity < requested ? ` Add at least ${Math.ceil((requested - capacity) / 60)} more areas to reach the selected target.` : '';
        const failureHint = discoveryErrors.length
          ? ` ${discoveryErrors.length} area search${discoveryErrors.length === 1 ? '' : 'es'} failed and were not counted as zero-result searches.`
          : '';
        setNotice(`Google Places returned ${meta.placesFound} of ${requested} requested businesses.${failureHint}${locationHint}`);
      } else if (meta.unknown > 0 || meta.failedBatches > 0) {
        setNotice(`${meta.unknown} domains remain unresolved after retrying. Confirmed opportunities are still shown.`);
      }
      setHasSearched(true);
    } catch (searchError) {
      if (searchError.name === 'AbortError' || controller.signal.aborted) {
        setNotice('Scan cancelled. Any confirmed opportunities found so far were kept.');
        setHasSearched(true);
      } else {
        setError(searchError.message || 'Search failed.');
      }
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null;
      setIsLoading(false);
    }
  };

  const cancelSearch = () => scanAbortRef.current?.abort();

  const exportCsv = () => {
    const header = ['Business', 'Category', 'Domain', 'Status', 'Available Now', 'Expiry', 'DA', 'Open PageRank', 'Score', 'Reason', 'DNS', 'RDAP Source', 'Website'];
    const rows = leads.map((lead) => [
      lead.business, lead.sub, lead.domain, getStatusLabel(lead), lead.availableNow ? 'Yes' : 'No',
      lead.expires || '', lead.da ?? '', lead.pr ?? '', lead.score, lead.checkReason || '',
      lead.dnsStatus || '', lead.rdapSource || '', lead.websiteUrl,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'local-domain-opportunities.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const progressPercent = scanProgress?.total
    ? Math.min(100, Math.round((scanProgress.current / scanProgress.total) * 100))
    : 0;

  return (
    <div className="lef-root">
      <header className="lef-topbar">
        <div className="lef-topbar-left"><div className="lef-logo-mark"><Globe size={18} /></div><span className="lef-logo-text">Local<span className="lef-logo-accent">Domain</span>Finder</span></div>
        <div className="lef-topbar-right"><a className="lef-topbar-btn" href="https://www.domcop.com/openpagerank/what-is-openpagerank" target="_blank" rel="noopener noreferrer"><Key size={13} /> Get API Key</a></div>
      </header>

      <section className="lef-hero">
        <div className="lef-hero-left"><h1 className="lef-hero-title">Find local businesses with<br /><span className="lef-hero-highlight">website opportunities.</span></h1><p className="lef-hero-sub">Search Google Maps, verify every unique website through DNS and RDAP, and surface domains that are available, expired, or expiring soon.</p></div>
        <div className="lef-steps">{STEPS.map(([title, description], index) => <div key={title} className="lef-step-card"><div className="lef-step-num-wrap"><div className="lef-step-num">{index + 1}</div></div><div className="lef-step-info"><span className="lef-step-title">{title}</span><span className="lef-step-desc">{description}</span></div></div>)}</div>
      </section>

      <section className="lef-form">
        <div className="lef-field"><label className="lef-label" htmlFor="local-niche">Niche / Service</label><div className="lef-input-wrap"><Search size={15} className="lef-input-icon" /><input id="local-niche" className="lef-input" placeholder="e.g. dentist, plumber, gym" value={niche} onChange={(event) => setNiche(event.target.value)} disabled={isLoading} /></div></div>
        <div className="lef-field" ref={countryRef}><label className="lef-label">Country</label><button className="lef-select-btn" type="button" onClick={() => setShowCountryDrop((open) => !open)} disabled={isLoading}><Globe size={15} className="lef-input-icon" /><span>{country}</span></button>{showCountryDrop && <div className="lef-dropdown">{COUNTRIES.map(([name]) => <button key={name} className="lef-dropdown-item" type="button" onClick={() => { setCountry(name); setShowCountryDrop(false); }}>{name}</button>)}</div>}</div>
        <div className="lef-field"><label className="lef-label" htmlFor="local-city">City / areas (optional)</label><div className="lef-input-wrap"><MapPin size={15} className="lef-input-icon" /><input id="local-city" className="lef-input" placeholder="e.g. Houston, Dallas, Austin" value={city} onChange={(event) => setCity(event.target.value)} disabled={isLoading} /></div><span className="lef-hint">Separate areas with commas for larger scans.</span></div>
        <div className="lef-field"><label className="lef-label" htmlFor="local-business-limit">Scan size</label><div className="lef-input-wrap"><TrendingUp size={15} className="lef-input-icon" /><select id="local-business-limit" className="lef-input" style={{ paddingLeft: 36 }} value={businessLimit} onChange={(event) => setBusinessLimit(Number(event.target.value))} disabled={isLoading}><option value={20}>20 businesses per area</option><option value={40}>40 businesses per area</option><option value={60}>60 businesses per area</option><option value={100}>100 businesses total</option><option value={200}>200 businesses total</option><option value={500}>500 businesses total</option></select></div></div>
        <div className="lef-field lef-field-cta"><button className="lef-cta" type="button" onClick={isLoading ? cancelSearch : handleSearch}>{isLoading ? <><XCircle size={15} /> Cancel Scan</> : <><Search size={15} /> Find Opportunities</>}</button></div>
      </section>

      {!googlePlacesApiKey && <div className="mx-6 mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"><AlertCircle size={16} /> Add your Google Places API key in <Link className="underline font-semibold" to="/settings">Settings</Link> to search live businesses.</div>}
      {error && <div className="mx-6 mb-5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"><AlertCircle size={16} /> {error}</div>}
      {notice && <div className="mx-6 mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"><AlertCircle size={16} /> {notice}</div>}

      {(scanProgress || searchMeta) && <div className="mx-7 mb-5 rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-300"><span className="flex items-center gap-2">{scanProgress?.phase === 'complete' ? <CheckCircle size={14} className="text-emerald-400" /> : <TrendingUp size={14} className="text-blue-400" />}{scanProgress?.message || 'Preparing scan…'}</span><span>{progressPercent}%</span></div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300" style={{ width: `${progressPercent}%` }} /></div>
        {searchMeta && <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3 xl:grid-cols-6">{[
          [searchMeta.placesFound, 'Places found'], [searchMeta.websitesFound, 'Websites'],
          [searchMeta.uniqueDomains, 'Unique domains'], [searchMeta.checked, 'Domains checked'],
          [searchMeta.unknown, 'Unresolved'], [searchMeta.opportunities, 'Opportunities'],
        ].map(([value, label]) => <div key={label} className="rounded-lg bg-slate-950/50 px-3 py-2"><div className="text-base font-bold text-slate-100">{value || 0}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div></div>)}</div>}
      </div>}

      {hasSearched && !isLoading && leads.length === 0 && <div className="mx-6 mb-5 flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-4 py-3 text-sm text-slate-300"><AlertCircle size={16} /> No confirmed expired or near-expiry domains were found among {searchMeta?.checked || 0} checked domains. {searchMeta?.unknown ? `${searchMeta.unknown} remained unresolved.` : ''}</div>}

      {leads.length > 0 && <>
        <div className="lef-stats-row">
          {[[stats.total, 'Opportunities Found', Globe, '#3b82f6'], [stats.available, 'Available Now', CheckCircle, '#10b981'], [stats.expired, 'Expired / Grace', AlertCircle, '#ef4444'], [stats.expiring, 'Expiring Soon', TrendingUp, '#f59e0b']].map(([value, label, Icon, color]) => <div key={label} className="lef-stat-card"><div className="lef-stat-icon-wrap" style={{ background: `${color}18` }}><Icon size={20} style={{ color }} /></div><div className="lef-stat-info"><div className="lef-stat-value" style={{ color }}>{value}</div><div className="lef-stat-label">{label}</div></div></div>)}
        </div>
        <div className="lef-results-grid">
          <div className="lef-panel lef-map-panel"><div className="lef-panel-header"><div className="lef-panel-header-left"><MapIcon size={14} /><span>Map Preview</span></div></div><div className="lef-map-body"><MapContainer key={`${mapCenter[0]}-${mapCenter[1]}`} center={mapCenter} zoom={mapLeads.length ? 11 : 3} className="lef-map-leaflet" zoomControl={false}><TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CARTO" />{mapLeads.map((lead, index) => <Marker key={lead.domain} position={[lead.coordinates.lat, lead.coordinates.lng]} icon={createPinIcon(index)}><Popup>{lead.business}<br />{lead.domain}<br />{getStatusLabel(lead)}</Popup></Marker>)}<ZoomControls /></MapContainer></div></div>
          <div className="lef-panel lef-opp-panel"><div className="lef-panel-header"><div className="lef-panel-header-left"><Star size={14} style={{ color: '#f59e0b' }} /><span className="lef-panel-title">Top Opportunities</span><span className="lef-opp-count">{leads.length} found</span></div><button className="lef-export-btn" type="button" onClick={exportCsv}>Export CSV <Download size={13} /></button></div><div className="lef-table-wrap"><table className="lef-table"><thead><tr><th>Business</th><th>Domain</th><th>Status</th><th>Expiry</th><th>DA</th><th>PR</th><th>Score</th><th>Actions</th></tr></thead><tbody>{leads.map((lead) => { const statusLabel = getStatusLabel(lead); const color = statusColor(statusLabel); return <tr key={lead.domain} className="lef-table-row" title={lead.checkReason}><td><div className="lef-biz-cell"><div className="lef-biz-avatar" style={{ background: lead.avatarColor }}>{lead.initial}</div><div><div className="lef-biz-name">{lead.business}</div><div className="lef-biz-sub">{lead.sub}</div></div></div></td><td className="lef-domain-cell">{lead.domain}</td><td><span className="lef-status-badge" style={{ background: color.bg, color: color.color, borderColor: color.border }}>{statusLabel}</span></td><td className="lef-pr-cell">{formatExpiration(lead)}</td><td className="lef-pr-cell">{lead.da ?? '—'}</td><td className="lef-pr-cell">{lead.pr ?? '—'}</td><td><span className="lef-score" style={{ background: lead.score >= 70 ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>{lead.score}</span></td><td><div className="lef-actions-cell"><a className="lef-action-btn" href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" title="Open website"><ExternalLink size={14} /></a></div></td></tr>; })}</tbody></table></div></div>
        </div>
      </>}
    </div>
  );
}
