import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  IcoSearch, IcoSparkles, IcoFileSpreadsheet, IcoFileDown, IcoChevronDown, IcoChevronRight,
  IcoStar, IcoMapPin, IcoPhone, IcoGlobe, IcoMail, IcoBookmark, IcoLinkedin, IcoRefresh,
  IcoUsers, IcoTarget, IcoZap, IcoFlame, IcoWarning, IcoClose, IcoSliders, IcoCheckSquare,
  IcoSquare, IcoBarChart, IcoBuilding, IcoWhatsApp, IcoCompass
} from './LeadFinderIcons';
import LeadDetailPage from './LeadDetailPage';
import { authenticatedFetch } from '../lib/authenticatedFetch.js';

const SORT_OPTIONS = [
  'Best Leads First',
  'AI Relevance',
  'Search Order',
  'Weakest SEO First',
  'Strongest SEO First',
  'Lowest Rating First',
  'Highest Rating First',
  'Fewest Reviews First',
  'Most Reviews First',
];

const SUGGESTIONS = [
  'Dentists in New York',
  'Plumbers in New York without websites',
  'Restaurants with low ratings in Brooklyn',
  'Landscapers in Brooklyn',
  'Chiropractors under 20 reviews in Jersey City',
];

const GOOGLE_PLACES_API_WARNING = 'Add your Google Places API key in Settings before running Lead Finder searches.';

const FEATURES = [
  {
    icon: IcoTarget,
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.1)',
    title: 'AI-Scored Leads',
    desc: 'Every business gets an opportunity score based on SEO gaps, reviews, and online presence.',
  },
  {
    icon: IcoMail,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.1)',
    title: 'Auto Email Discovery',
    desc: 'The finder checks discovered websites for direct emails and LinkedIn links when they are available.',
  },
  {
    icon: IcoZap,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
    title: 'Instant Pitch Ideas',
    desc: 'Pitch suggestions are generated from each lead source, rating, website, and review profile.',
  },
];

const ScoreBadge = ({ score, priority }) => {
  const config = {
    hot: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', label: 'HOT' },
    good: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e', label: 'GOOD' },
    moderate: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', text: '#eab308', label: 'MED' },
    low: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)', text: '#94a3b8', label: 'LOW' },
  };
  const c = config[priority] || config.low;

  return (
    <div className="lead-score-badge" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
      <span className="lead-score-number">{score}</span>
      <span className="lead-score-label">{c.label}</span>
    </div>
  );
};

const PriorityTag = ({ priority }) => {
  const config = {
    hot: { label: 'Hot Lead', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    good: { label: 'Good Opportunity', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    moderate: { label: 'Moderate', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
    low: { label: 'Low Priority', color: '#94a3b8', bg: 'rgba(100,116,139,0.15)' },
  };
  const c = config[priority] || config.low;

  return (
    <span className="lead-priority-tag" style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
};

const NeedBadge = ({ text }) => {
  const isWarning = text.includes('No Website') || text.includes('Zero') || text.includes('Star Rating') || text.includes('No Rating');

  return (
    <span className={`lead-need-badge ${isWarning ? 'lead-need-warning' : 'lead-need-info'}`}>
      <IcoWarning size={10} />
      {text}
    </span>
  );
};

const LinkedInStatus = ({ status }) => {
  const config = {
    found: { label: 'Found', color: '#22c55e' },
    on_linkedin: { label: 'On LinkedIn', color: '#3b82f6' },
    not_found: { label: 'Not Found', color: '#6b7280' },
  };
  const c = config[status] || config.not_found;

  return (
    <span className="lead-linkedin-tag" style={{ color: c.color, borderColor: `${c.color}44` }}>
      <IcoLinkedin size={10} />
      {c.label}
    </span>
  );
};

const EmailStatus = ({ status, hasDirectEmail }) => {
  if (hasDirectEmail) {
    return (
      <span className="lead-email-tag lead-email-found">
        <IcoMail size={10} />
        Direct email
      </span>
    );
  }

  if (status === 'searching') {
    return (
      <span className="lead-email-tag lead-email-searching">
        <IcoRefresh size={10} className="lead-spin" />
        Finding...
      </span>
    );
  }

  return null;
};

const ActionButton = ({ icon: Icon, label, title, variant = 'default', disabled = false, onClick }) => {
  const classes = variant === 'primary'
    ? 'lead-action-btn lead-action-primary'
    : variant === 'linkedin'
      ? 'lead-action-btn lead-action-linkedin'
      : variant === 'whatsapp'
        ? 'lead-action-btn lead-action-whatsapp'
        : variant === 'email'
          ? 'lead-action-btn lead-action-email'
          : 'lead-action-btn';

  return (
    <button
      className={`${classes} ${disabled ? 'lead-action-disabled' : ''}`}
      onClick={onClick}
      title={title || label}
      aria-label={title || label}
      disabled={disabled}
      type="button"
    >
      <Icon size={13} />
      {label && <span>{label}</span>}
    </button>
  );
};

const GooglePlacesApiWarning = () => (
  <div className="lead-api-warning" role="alert">
    <IcoWarning size={18} />
    <div>
      <strong>Google Places API key required</strong>
      <span>
        Lead Finder now uses your own Google Places API key. Add it in <Link to="/settings">Settings</Link> to search live local businesses.
      </span>
    </div>
  </div>
);

const LeadCard = ({ lead, isSelected, isSaved, onToggleSelect, onToggleSave, onOpenDetail }) => {
  const mapsUrl = lead.mapsUrl || buildGoogleMapsSearchUrl(lead);
  const linkedInUrl = lead.linkedinUrl || buildLinkedInSearchUrl(lead);
  const whatsappUrl = buildWhatsAppUrl(lead);
  const emailUrl = buildEmailUrl(lead);

  return (
    <div className={`lead-card ${isSelected ? 'lead-card-selected' : ''}`}>
      <div className="lead-card-inner">
        <button className="lead-checkbox" onClick={() => onToggleSelect(lead.id)} type="button" aria-label="Select lead">
          {isSelected ? <IcoCheckSquare size={16} className="lead-check-active" /> : <IcoSquare size={16} />}
        </button>

        <ScoreBadge score={lead.score} priority={lead.priority} />

        <div className="lead-info">
          <div className="lead-info-header">
            <h3 className="lead-name">{lead.name}</h3>
            <PriorityTag priority={lead.priority} />
            <EmailStatus status={lead.email} hasDirectEmail={lead.hasDirectEmail} />
          </div>

          <div className="lead-meta">
            {lead.location && (
              <span className="lead-meta-item">
                <IcoMapPin size={12} className="lead-meta-icon" />
                {lead.location}
              </span>
            )}
            {lead.rating ? (
              <span className={`lead-meta-item ${lead.rating < 3.5 ? 'lead-meta-warning' : ''}`}>
                <IcoStar size={12} className="lead-meta-icon" fill="currentColor" />
                {lead.rating} ({lead.reviewCount})
              </span>
            ) : (
              <span className="lead-meta-item lead-meta-warning">
                <IcoStar size={12} className="lead-meta-icon" />
                No rating
              </span>
            )}
            {lead.phone && (
              <a className="lead-meta-item lead-meta-link" href={buildPhoneUrl(lead.phone)} title={`Call ${lead.phone}`}>
                <IcoPhone size={12} className="lead-meta-icon" />
                {lead.phone}
              </a>
            )}
            {lead.website && (
              <span className="lead-meta-item">
                <IcoGlobe size={12} className="lead-meta-icon" />
                {lead.website}
              </span>
            )}
          </div>

          <div className="lead-bottom-row">
            <div className="lead-needs-row">
              <span className="lead-needs-label">Needs:</span>
              {lead.needs.map((need) => <NeedBadge key={need} text={need} />)}
            </div>
            <LinkedInStatus status={lead.linkedinStatus} />
            {!lead.linkedinUrl && (
              <span className="lead-open-detail">Open lead detail to verify the owner profile</span>
            )}
          </div>

          {lead.pitch && (
            <div className="lead-pitch">
              <IcoSparkles size={12} className="lead-pitch-icon" />
              Pitch: {lead.pitch}
            </div>
          )}
        </div>

        <div className="lead-actions">
          <ActionButton
            icon={IcoBookmark}
            label={isSaved ? 'Saved' : 'Save'}
            title={isSaved ? 'Remove saved lead' : 'Save lead'}
            variant={isSaved ? 'primary' : 'default'}
            onClick={() => onToggleSave(lead.id)}
          />
          <ActionButton
            icon={IcoLinkedin}
            variant="linkedin"
            title={lead.linkedinUrl ? 'Open LinkedIn profile' : 'Search LinkedIn'}
            onClick={() => openExternal(linkedInUrl)}
          />
          <ActionButton
            icon={IcoGlobe}
            title={lead.websiteUrl ? 'Open website' : 'No website found'}
            disabled={!lead.websiteUrl}
            onClick={() => openExternal(lead.websiteUrl)}
          />
          <ActionButton
            icon={IcoBuilding}
            title="Open Google business listing"
            onClick={() => openExternal(mapsUrl)}
          />
          <ActionButton
            icon={IcoWhatsApp}
            variant="whatsapp"
            title={whatsappUrl ? `Message ${lead.name} on WhatsApp` : 'No phone number for WhatsApp'}
            disabled={!whatsappUrl}
            onClick={() => openExternal(whatsappUrl)}
          />
          <ActionButton
            icon={IcoMail}
            title={lead.emailAddress ? 'Email lead' : 'No direct email found'}
            variant="email"
            disabled={!lead.emailAddress}
            onClick={() => openExternal(emailUrl)}
          />
          <ActionButton
            icon={IcoMapPin}
            title="Open on Google Maps"
            onClick={() => openExternal(mapsUrl)}
          />
          <button className="lead-details-btn" onClick={() => onOpenDetail(lead)} type="button">
            Explorer <IcoCompass size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const LeadFinderTool = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [promptQuery, setPromptQuery] = useState('');
  const [lastSearch, setLastSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('Best Leads First');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [savedLeads, setSavedLeads] = useState(new Set());
  const [showNeedFilter, setShowNeedFilter] = useState({ website: false, seo: false, reviews: false });
  const [ownerOperatedFilter, setOwnerOperatedFilter] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [error, setError] = useState('');
  const sortRef = useRef(null);
  const abortRef = useRef(null);
  const googlePlacesApiKey = useMemo(() => getGooglePlacesApiKey(user), [user?.googlePlacesApiKey]);
  const hasGooglePlacesApiKey = true;

  useEffect(() => {
    const handler = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const runLeadSearch = useCallback(async (query) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError('Enter a business type and location to search.');
      return;
    }

    if (!hasGooglePlacesApiKey) {
      setError(GOOGLE_PLACES_API_WARNING);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setHasSearched(true);
    setIsLoading(true);
    setError('');
    setLastSearch(trimmedQuery);
    setPromptQuery(trimmedQuery);
    setSearchQuery('');
    setActiveFilter('all');
    setSelectedLeads(new Set());

    try {
      const response = await authenticatedFetch('/api/local-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: trimmedQuery,
          limit: 40,
          discoverContacts: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Lead search failed.');
      }

      setLeads(Array.isArray(data.leads) ? data.leads : []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setLeads([]);
        setError(err.message || 'Lead search failed.');
      }
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
        abortRef.current = null;
      }
    }
  }, [googlePlacesApiKey, hasGooglePlacesApiKey]);

  const filterTabs = useMemo(() => ([
    { id: 'all', label: 'All Results', count: leads.length },
    { id: 'hot', label: 'Hot Leads', count: leads.filter((lead) => lead.priority === 'hot').length, color: '#ef4444' },
    { id: 'weak_seo', label: 'Weak SEO', count: leads.filter(hasWeakSeo).length, color: '#eab308' },
    { id: 'no_website', label: 'No Website', count: leads.filter((lead) => !lead.website).length, color: '#f97316' },
    { id: 'under_20', label: 'Under 20 reviews', count: leads.filter((lead) => lead.reviewCount < 20).length },
    { id: 'low_rating', label: 'Low Rating', count: leads.filter((lead) => lead.rating && lead.rating < 3.5).length, color: '#ef4444' },
    { id: 'has_phone', label: 'Has Phone', count: leads.filter((lead) => lead.phone).length },
  ]), [leads]);

  const categories = useMemo(() => {
    const counts = new Map();
    leads.forEach((lead) => {
      counts.set(lead.category, (counts.get(lead.category) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
  }, [leads]);

  const needCounts = useMemo(() => ({
    website: leads.filter((lead) => !lead.website).length,
    seo: leads.filter(hasWeakSeo).length,
    reviews: leads.filter(hasReviewNeed).length,
  }), [leads]);

  const filteredLeads = useMemo(() => {
    let next = [...leads];

    if (activeFilter === 'hot') next = next.filter((lead) => lead.priority === 'hot');
    else if (activeFilter === 'no_website') next = next.filter((lead) => !lead.website);
    else if (activeFilter === 'weak_seo') next = next.filter(hasWeakSeo);
    else if (activeFilter === 'low_rating') next = next.filter((lead) => lead.rating && lead.rating < 3.5);
    else if (activeFilter === 'has_phone') next = next.filter((lead) => lead.phone);
    else if (activeFilter === 'under_20') next = next.filter((lead) => lead.reviewCount < 20);

    if (ownerOperatedFilter) {
      next = next.filter((lead) => lead.ownerOperated);
    }

    if (showNeedFilter.website || showNeedFilter.seo || showNeedFilter.reviews) {
      next = next.filter((lead) => (
        (showNeedFilter.website && !lead.website) ||
        (showNeedFilter.seo && hasWeakSeo(lead)) ||
        (showNeedFilter.reviews && hasReviewNeed(lead))
      ));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      next = next.filter((lead) => [
        lead.name,
        lead.category,
        lead.location,
        lead.phone,
        lead.website,
        lead.emailAddress,
      ].some((value) => String(value || '').toLowerCase().includes(q)));
    }

    return sortLeads(next, sortBy);
  }, [activeFilter, ownerOperatedFilter, searchQuery, showNeedFilter, leads, sortBy]);

  const groupedLeads = useMemo(() => {
    const groups = {};
    const order = ['hot', 'good', 'moderate', 'low'];
    const labels = {
      hot: 'Hot Leads',
      good: 'Good Opportunities',
      moderate: 'Moderate Leads',
      low: 'Low Priority',
    };

    order.forEach((priority) => {
      groups[priority] = { label: labels[priority], leads: [] };
    });
    filteredLeads.forEach((lead) => {
      if (groups[lead.priority]) groups[lead.priority].leads.push(lead);
    });

    return Object.entries(groups).filter(([, group]) => group.leads.length > 0);
  }, [filteredLeads]);

  const stats = useMemo(() => ([
    { label: 'Hot Leads', value: leads.filter((lead) => lead.priority === 'hot').length, icon: IcoFlame, tone: 'error' },
    { label: 'No Website', value: needCounts.website, icon: IcoGlobe, tone: 'info' },
    { label: 'Weak SEO', value: needCounts.seo, icon: IcoTarget, tone: 'warning' },
    { label: 'Few Reviews', value: needCounts.reviews, icon: IcoStar, tone: 'brand' },
  ]), [leads, needCounts]);

  const emailsFound = leads.filter((lead) => lead.hasDirectEmail).length;
  const emailsSearching = leads.filter((lead) => lead.email === 'searching').length;
  const noWebsite = needCounts.website;
  const coverage = leads.length ? Math.round((emailsFound / leads.length) * 100) : 0;
  const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeads.has(lead.id));

  const toggleSelect = (id) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);

      if (allFilteredSelected) {
        filteredLeads.forEach((lead) => next.delete(lead.id));
      } else {
        filteredLeads.forEach((lead) => next.add(lead.id));
      }

      return next;
    });
  };

  const toggleSave = (id) => {
    setSavedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSearch = () => {
    runLeadSearch(promptQuery || searchQuery);
  };

  const handleHeaderSearch = () => {
    runLeadSearch(searchQuery || promptQuery || lastSearch);
  };

  const handleNewSearch = () => {
    abortRef.current?.abort();
    setHasSearched(false);
    setSearchQuery('');
    setPromptQuery('');
    setLastSearch('');
    setActiveFilter('all');
    setSelectedLeads(new Set());
    setLeads([]);
    setError('');
    setIsLoading(false);
  };

  const handleSuggestionClick = (suggestion) => {
    setPromptQuery(suggestion);
    runLeadSearch(suggestion);
  };

  const handleDownloadCsv = () => {
    const rows = selectedLeads.size
      ? leads.filter((lead) => selectedLeads.has(lead.id))
      : filteredLeads;

    downloadLeadsCsv(rows);
  };

  if (selectedLead) {
    return (
      <div className="lead-finder-root">
        <LeadDetailPage lead={selectedLead} onBack={() => setSelectedLead(null)} />
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="lead-finder-root">
        <div className="lead-homepage">
          <div className="lead-homepage-hero">
            <div className="lead-homepage-icon">
              <IcoSparkles size={20} />
            </div>
            <div className="lead-homepage-hero-text">
              <h1 className="lead-homepage-title">AI Lead Finder</h1>
              <p className="lead-homepage-desc">
                Describe the businesses you want to find. The finder searches Google Places,
                scores opportunities, and surfaces contacts that are ready to pitch.
              </p>
            </div>
          </div>

          <div className="lead-homepage-search">
            {!hasGooglePlacesApiKey && <GooglePlacesApiWarning />}

            <div className="lead-search-bar">
              <IcoSearch size={18} className="lead-search-icon" />
              <input
                type="text"
                placeholder="Try 'Dentists in Brooklyn with under 10 reviews'..."
                value={promptQuery}
                onChange={(event) => setPromptQuery(event.target.value)}
                className="lead-search-input"
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
              />
              <button className="lead-search-btn" onClick={handleSearch} disabled={!hasGooglePlacesApiKey} type="button">
                <IcoSparkles size={14} /> AI Search
              </button>
            </div>

            {error && <div className="lead-inline-error">{error}</div>}

            <div className="lead-homepage-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} className="lead-suggestion-chip" onClick={() => handleSuggestionClick(suggestion)} disabled={!hasGooglePlacesApiKey} type="button">
                  <IcoSearch size={11} />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="lead-homepage-steps">
            <div className="lead-step">
              <span className="lead-step-number">1</span>
              Describe your target
            </div>
            <IcoChevronRight size={16} className="lead-step-arrow" />
            <div className="lead-step">
              <span className="lead-step-number">2</span>
              Google Places finds leads
            </div>
            <IcoChevronRight size={16} className="lead-step-arrow" />
            <div className="lead-step">
              <span className="lead-step-number">3</span>
              Export and pitch
            </div>
          </div>

          <div className="lead-homepage-features">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="lead-feature-card">
                <div className="lead-feature-icon" style={{ background: feature.bg }}>
                  <feature.icon size={20} style={{ color: feature.color }} />
                </div>
                <div className="lead-feature-title">{feature.title}</div>
                <div className="lead-feature-desc">{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lead-finder-root">
      <div className="lead-finder-header">
        <div className="lead-finder-title-row">
          <div className="lead-finder-title-group">
            <div className="lead-finder-logo">
              <IcoSparkles size={20} />
            </div>
            <div>
              <h1 className="lead-finder-title">AI Lead Finder</h1>
              <p className="lead-finder-subtitle">
                {lastSearch ? `Live Google Places results for "${lastSearch}".` : 'Search local businesses and pull matching leads.'}
              </p>
            </div>
          </div>
          <div className="lead-finder-header-actions">
            <button className="lead-header-btn lead-csv-btn" onClick={handleDownloadCsv} disabled={!filteredLeads.length} type="button">
              <IcoFileSpreadsheet size={15} />
              <span>Export CSV</span>
              <IcoFileDown size={13} className="lead-csv-arrow" />
            </button>
            <button className="lead-header-btn" onClick={handleNewSearch} type="button">
              <IcoRefresh size={15} /> New Search
            </button>
          </div>
        </div>

        <div className="lead-search-bar">
          <IcoSearch size={18} className="lead-search-icon" />
          <input
            type="text"
            placeholder="Filter current leads, or enter a new search..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="lead-search-input"
            onKeyDown={(event) => event.key === 'Enter' && handleHeaderSearch()}
          />
          <button className="lead-search-btn" onClick={handleHeaderSearch} disabled={isLoading || !hasGooglePlacesApiKey} type="button">
            {isLoading ? <IcoRefresh size={14} className="lead-spin" /> : <IcoSparkles size={14} />}
            AI Search
          </button>
        </div>

        {!hasGooglePlacesApiKey && <GooglePlacesApiWarning />}
      </div>

      <div className="lead-stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="lead-stat-card" data-tone={stat.tone}>
            <div className="lead-stat-icon">
              <stat.icon size={18} />
            </div>
            <div>
              <div className="lead-stat-value">{stat.value}</div>
              <div className="lead-stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="lead-filters-section">
        <div className="lead-filter-tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              className={`lead-filter-tab ${activeFilter === tab.id ? 'lead-filter-active' : ''}`}
              onClick={() => setActiveFilter(tab.id)}
              type="button"
            >
              {tab.id === 'all' && <IcoSliders size={13} />}
              {tab.label} <span className="lead-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="lead-secondary-filters">
          <button
            className={`lead-owner-filter ${ownerOperatedFilter ? 'lead-owner-active' : ''}`}
            onClick={() => setOwnerOperatedFilter(!ownerOperatedFilter)}
            type="button"
          >
            <IcoUsers size={13} />
            Owner-operated {ownerOperatedFilter && <IcoClose size={12} />}
          </button>

          <div className="lead-sort-wrapper" ref={sortRef}>
            <button className="lead-sort-btn" onClick={() => setShowSortDropdown(!showSortDropdown)} type="button">
              <IcoBarChart size={13} /> {sortBy} <IcoChevronDown size={14} />
            </button>
            {showSortDropdown && (
              <div className="lead-sort-dropdown">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`lead-sort-option ${sortBy === option ? 'lead-sort-selected' : ''}`}
                    onClick={() => { setSortBy(option); setShowSortDropdown(false); }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="lead-categories">
          <span className="lead-cat-label">CATEGORIES</span>
          {categories.map((category) => (
            <button key={category.label} className="lead-cat-tag" type="button">
              {category.label} <span className="lead-cat-count">{category.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="lead-needs-filter">
        <span className="lead-needs-filter-label">
          <span className="lead-needs-dot" /> Show leads needing:
        </span>
        <button className={`lead-need-toggle ${showNeedFilter.website ? 'active' : ''}`} onClick={() => setShowNeedFilter((prev) => ({ ...prev, website: !prev.website }))} type="button">Website {needCounts.website}</button>
        <button className={`lead-need-toggle ${showNeedFilter.seo ? 'active' : ''}`} onClick={() => setShowNeedFilter((prev) => ({ ...prev, seo: !prev.seo }))} type="button">SEO {needCounts.seo}</button>
        <button className={`lead-need-toggle ${showNeedFilter.reviews ? 'active' : ''}`} onClick={() => setShowNeedFilter((prev) => ({ ...prev, reviews: !prev.reviews }))} type="button">Reviews {needCounts.reviews}</button>
      </div>

      <div className="lead-email-bar">
        <div className="lead-email-bar-inner">
          <IcoRefresh size={14} className={isLoading || emailsSearching ? 'lead-spin' : ''} />
          <span>
            {isLoading ? (
              <strong>Fetching Google Places data...</strong>
            ) : (
              <>
                <strong>{emailsFound} emails found</strong> | {emailsSearching} searching | {noWebsite} no website |{' '}
                <span className="lead-coverage">{coverage}% coverage of scrapable rows</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="lead-select-all">
        <button className="lead-checkbox" onClick={toggleSelectAll} disabled={!filteredLeads.length} type="button" aria-label="Select all leads">
          {allFilteredSelected ? <IcoCheckSquare size={16} className="lead-check-active" /> : <IcoSquare size={16} />}
        </button>
        <span>Select all {filteredLeads.length}</span>
      </div>

      <div className="lead-list">
        {isLoading && (
          <div className="lead-empty">
            <IcoRefresh size={40} className="lead-empty-icon lead-spin" />
            <h3>Searching Google Places</h3>
            <p>Fetching business details, websites, phones, and contact signals.</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="lead-empty lead-error">
            <IcoWarning size={40} className="lead-empty-icon" />
            <h3>Search failed</h3>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && groupedLeads.map(([priority, group]) => (
          <div key={priority} className="lead-group">
            <div className="lead-group-header">
              <span className="lead-group-dot" data-priority={priority} />
              <span className="lead-group-title">{group.label}</span>
            </div>
            {group.leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isSelected={selectedLeads.has(lead.id)}
                isSaved={savedLeads.has(lead.id)}
                onToggleSelect={toggleSelect}
                onToggleSave={toggleSave}
                onOpenDetail={setSelectedLead}
              />
            ))}
          </div>
        ))}

        {!isLoading && !error && filteredLeads.length === 0 && (
          <div className="lead-empty">
            <IcoSearch size={40} className="lead-empty-icon" />
            <h3>No leads found</h3>
            <p>Try a broader business type, city, or filter set.</p>
          </div>
        )}
      </div>
    </div>
  );
};

function hasWeakSeo(lead) {
  return lead.needs?.some((need) => need.includes('SEO')) || !lead.website;
}

function getGooglePlacesApiKey(user) {
  const savedKey = user?.googlePlacesApiKey || (
    typeof window !== 'undefined' ? window.localStorage.getItem('googlePlacesApiKey') : ''
  );

  return String(savedKey || '').trim();
}

function hasReviewNeed(lead) {
  return lead.reviewCount < 20 || lead.needs?.some((need) => need.includes('Review') || need.includes('Rating'));
}

function sortLeads(leads, sortBy) {
  const next = [...leads];

  const seoWeakness = (lead) => (lead.website ? 0 : 2) + (hasWeakSeo(lead) ? 1 : 0);
  const ratingValue = (lead) => (typeof lead.rating === 'number' ? lead.rating : -1);
  const reviewValue = (lead) => Number.isFinite(lead.reviewCount) ? lead.reviewCount : 0;

  if (sortBy === 'Search Order') {
    return next.sort((a, b) => (a.searchOrder || 0) - (b.searchOrder || 0));
  }

  if (sortBy === 'Weakest SEO First') {
    return next.sort((a, b) => seoWeakness(b) - seoWeakness(a) || b.score - a.score);
  }

  if (sortBy === 'Strongest SEO First') {
    return next.sort((a, b) => seoWeakness(a) - seoWeakness(b) || b.score - a.score);
  }

  if (sortBy === 'Lowest Rating First') {
    return next.sort((a, b) => ratingValue(a) - ratingValue(b));
  }

  if (sortBy === 'Highest Rating First') {
    return next.sort((a, b) => ratingValue(b) - ratingValue(a));
  }

  if (sortBy === 'Fewest Reviews First') {
    return next.sort((a, b) => reviewValue(a) - reviewValue(b));
  }

  if (sortBy === 'Most Reviews First') {
    return next.sort((a, b) => reviewValue(b) - reviewValue(a));
  }

  return next.sort((a, b) => b.score - a.score);
}

function downloadLeadsCsv(leads) {
  if (!leads.length) return;

  const headers = [
    'Name',
    'Category',
    'Score',
    'Priority',
    'Location',
    'Rating',
    'Reviews',
    'Phone',
    'Website',
    'Email',
    'LinkedIn',
    'Needs',
    'Pitch',
    'Google Maps URL',
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.category,
    lead.score,
    lead.priority,
    lead.location,
    lead.rating || '',
    lead.reviewCount,
    lead.phone,
    lead.websiteUrl || '',
    lead.emailAddress || '',
    lead.linkedinUrl || '',
    lead.needs.join('; '),
    lead.pitch,
    lead.mapsUrl || buildGoogleMapsSearchUrl(lead),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `local-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const cell = String(value ?? '');
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function buildGoogleMapsSearchUrl(lead) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.location || ''}`)}`;
}

function buildLinkedInSearchUrl(lead) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${lead.name} ${lead.location || ''}`)}`;
}

function buildWhatsAppUrl(lead) {
  const phone = normalizePhoneForMessaging(lead.phone);
  if (!phone) return '';

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildOutreachMessage(lead))}`;
}

function buildEmailUrl(lead) {
  if (!lead.emailAddress) return '';

  const subject = `Quick idea for ${lead.name}`;
  const body = buildOutreachMessage(lead);

  return `mailto:${encodeURIComponent(lead.emailAddress)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildPhoneUrl(phone) {
  const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '');
  return normalizedPhone ? `tel:${normalizedPhone}` : '';
}

function buildOutreachMessage(lead) {
  const pitch = lead.pitch || 'your local online presence';

  return [
    `Hi, I came across ${lead.name} and noticed an opportunity around ${pitch}.`,
    'I help local businesses improve visibility, reviews, and inbound leads.',
    'Do you have a moment to chat?',
  ].join('\n\n');
}

function normalizePhoneForMessaging(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `1${digits}` : digits;
}

function openExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default LeadFinderTool;
