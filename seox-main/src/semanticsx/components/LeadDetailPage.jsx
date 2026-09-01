import { useMemo, useState } from 'react';
import {
  ArrowLeft, Globe, Phone, MapPin, Star, Mail, Copy, Bookmark,
  MessageSquare, Sparkles, Download, ChevronDown, ChevronRight,
  Shield, Monitor, TrendingUp, Check, XCircle, AlertCircle,
  FileSearch, Send, Briefcase, Linkedin, Hash, Clock, Search,
  ExternalLink,
} from 'lucide-react';

const TAB_LABELS = ['Score', 'Issues', 'Contact', 'Website', 'Pitch', 'Activity'];

const CONNECTIONS = [
  { icon: FileSearch, label: 'Proposals', count: 0 },
  { icon: Briefcase, label: 'Case Studies', count: 0 },
  { icon: Shield, label: 'Audits', count: 0 },
  { icon: Globe, label: 'Generated Websites', count: 0 },
  { icon: Send, label: 'Follow-up Sequences', count: 0 },
];

const ScoreRing = ({ value, size = 90, stroke = 7, color }) => {
  const normalizedValue = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (normalizedValue / 100) * circ;

  return (
    <svg width={size} height={size} className="ld-score-ring" aria-label={`Score ${normalizedValue} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize={size * 0.32} fontWeight={800}>
        {normalizedValue}
      </text>
    </svg>
  );
};

const MetricCard = ({ icon: Icon, value, label, color = '#f1f5f9' }) => (
  <div className="ld-metric-card">
    {Icon && <Icon size={18} className="ld-metric-icon" style={{ color }} />}
    <span className="ld-metric-value" style={{ color }}>{value}</span>
    <span className="ld-metric-label">{label}</span>
  </div>
);

const SeoCheckRow = ({ label, passed, value }) => (
  <div className="ld-seo-check-row">
    <span className="ld-seo-check-label">{label}</span>
    <span className="ld-seo-check-status">
      {value && <span className="ld-seo-check-value">{value}</span>}
      {passed ? <Check size={15} className="ld-check-pass" /> : <XCircle size={15} className="ld-check-fail" />}
    </span>
  </div>
);

const AuthorityStat = ({ label, value, color = '#64748b' }) => (
  <div className="ld-authority-stat">
    <div className="ld-authority-bar" style={{ background: color }} />
    <span className="ld-authority-label">{label}</span>
    {value !== undefined && <span className="ld-score-card-label">{value}</span>}
  </div>
);

const LeadDetailPage = ({ lead, isSaved = false, onToggleSave, onBack }) => {
  const [activeTab, setActiveTab] = useState('Score');
  const [copiedKey, setCopiedKey] = useState('');

  const detail = useMemo(() => buildLeadDetail(lead), [lead]);
  const scoreColor = getScoreColor(detail.overallScore);
  const tabs = useMemo(
    () => TAB_LABELS.map((label) => (label === 'Issues' ? `Issues (${detail.issues.length})` : label)),
    [detail.issues.length],
  );

  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1400);
  };

  const openExternal = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadReport = () => {
    const blob = new Blob([buildReportText(detail)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(detail.name)}-lead-report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ld-root">
      <button className="ld-back-btn" onClick={onBack} type="button">
        <ArrowLeft size={16} /> Back to leads
      </button>

      <div className="ld-header">
        <div className="ld-header-left">
          <h1 className="ld-business-name">{detail.name}</h1>
          <div className="ld-header-meta">
            <span className="ld-meta-row"><MapPin size={13} /> {detail.location || 'Location unavailable'}</span>
            <span className="ld-meta-row"><Phone size={13} /> {detail.phone || 'No phone listed'}</span>
          </div>
        </div>
        <div className="ld-header-right">
          <button className="ld-save-btn" type="button" onClick={onToggleSave}>
            <Bookmark size={14} /> {isSaved ? 'Saved' : 'Save Lead'}
          </button>
          <span className="ld-score-pill" style={{ background: `${scoreColor}22`, color: scoreColor, borderColor: `${scoreColor}44` }}>
            {detail.scoreLabel}
          </span>
        </div>
      </div>

      <div className="ld-quick-actions">
        <button className="ld-more-actions" type="button" onClick={() => copyText(detail.pitch, 'pitch-menu')}>
          {copiedKey === 'pitch-menu' ? 'Pitch copied' : 'Copy pitch'} <ChevronDown size={14} />
        </button>
        <div className="ld-action-pills">
          <button className="ld-pill ld-pill-default" type="button" disabled={!detail.websiteUrl} onClick={() => openExternal(detail.websiteUrl)}>
            <Globe size={13} /> Visit Website
          </button>
          <button className="ld-pill ld-pill-default" type="button" onClick={() => openExternal(detail.mapsUrl)}>
            <MapPin size={13} /> Maps
          </button>
          <button className="ld-pill ld-pill-whatsapp" type="button" disabled={!detail.whatsappUrl} onClick={() => openExternal(detail.whatsappUrl)}>
            <MessageSquare size={13} /> WhatsApp
          </button>
          <button className="ld-pill ld-pill-pitch" type="button" onClick={() => copyText(detail.pitch, 'pitch')}>
            <Sparkles size={13} /> {copiedKey === 'pitch' ? 'Copied' : 'Copy AI Pitch'}
          </button>
          <button className="ld-pill ld-pill-default" type="button" onClick={downloadReport}>
            <Download size={13} /> Download Report <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="ld-tabs">
        {tabs.map((tab) => {
          const tabKey = tab.startsWith('Issues') ? 'Issues' : tab;
          return (
            <button
              key={tab}
              className={`ld-tab ${activeTab === tabKey ? 'ld-tab-active' : ''}`}
              onClick={() => setActiveTab(tabKey)}
              type="button"
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="ld-body">
        <div className="ld-main">
          {activeTab === 'Score' && (
            <>
              <div className="ld-card">
                <div className="ld-card-header"><Shield size={16} className="ld-card-icon" /> Site signals</div>
                <div className="ld-site-signal-banner">
                  <div className="ld-signal-text">
                    <strong><Bookmark size={14} /> {isSaved ? 'Lead saved' : 'Save this lead'}</strong>
                    <span>{detail.siteSignalSummary}</span>
                  </div>
                  <button className="ld-signal-save-btn" type="button" onClick={onToggleSave}>
                    <Bookmark size={13} /> {isSaved ? 'Saved' : 'Save lead'}
                  </button>
                </div>
              </div>

              <div className="ld-scores-grid">
                <div className="ld-score-card ld-score-main">
                  <ScoreRing value={detail.overallScore} size={80} color={scoreColor} />
                  <span className="ld-score-card-label">Overall</span>
                  <span className="ld-score-badge-sm" style={{ color: scoreColor, background: `${scoreColor}1a` }}>
                    {detail.scoreLabel}
                  </span>
                  <span className="ld-score-analyzed"><Clock size={11} /> Analyzed now</span>
                </div>
                <MetricCard icon={Globe} value={detail.websiteScore} label="Website" color="#3b82f6" />
                <MetricCard icon={TrendingUp} value={detail.seoScore} label="SEO" color="#22c55e" />
                <MetricCard icon={Monitor} value={detail.contactScore} label="Contact" color="#f1f5f9" />
                <MetricCard icon={Star} value={detail.reviewCount} label="Reviews" color="#eab308" />
              </div>

              <div className="ld-card">
                <div className="ld-card-header">
                  <TrendingUp size={16} className="ld-card-icon" style={{ color: '#22c55e' }} /> SEO Authority
                  <span className="ld-just-now"><Clock size={11} /> live lead data</span>
                </div>
                <div className="ld-authority-grid">
                  <AuthorityStat label="Website" value={detail.website ? 'Found' : 'Missing'} color={detail.website ? '#22c55e' : '#ef4444'} />
                  <AuthorityStat label="Direct Email" value={detail.primaryEmail ? 'Found' : 'Missing'} color={detail.primaryEmail ? '#22c55e' : '#64748b'} />
                  <AuthorityStat label="LinkedIn" value={detail.linkedinUrl ? 'Found' : 'Search'} color={detail.linkedinUrl ? '#38bdf8' : '#64748b'} />
                  <AuthorityStat label="GBP" value={detail.mapsUrl ? 'Found' : 'Search'} color="#eab308" />
                </div>
                <div className="ld-seo-checks-grid">
                  <SeoCheckRow label="Website listed" passed={Boolean(detail.websiteUrl)} />
                  <SeoCheckRow label="Direct email discovered" passed={Boolean(detail.primaryEmail)} />
                  <SeoCheckRow label="Phone listed" passed={Boolean(detail.phone)} />
                  <SeoCheckRow label="Review base" passed={detail.reviewCount >= 20} value={`${detail.reviewCount} reviews`} />
                  <SeoCheckRow label="Rating strength" passed={Boolean(detail.rating && detail.rating >= 4)} value={detail.rating ? `${detail.rating} stars` : 'No rating'} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'Issues' && (
            <div className="ld-card">
              <div className="ld-card-header"><AlertCircle size={16} className="ld-card-icon" style={{ color: '#eab308' }} /> Lead issues</div>
              {detail.issues.length ? (
                <div className="ld-seo-checks-grid">
                  {detail.issues.map((issue) => (
                    <SeoCheckRow key={issue} label={issue} passed={false} />
                  ))}
                </div>
              ) : (
                <p className="ld-muted-text">No major pitch issues were detected from the available Places data.</p>
              )}
            </div>
          )}

          {activeTab === 'Contact' && (
            <div className="ld-card">
              <div className="ld-card-header"><Mail size={16} className="ld-card-icon" /> Contact options</div>
              {detail.primaryEmail ? (
                <div className="ld-email-row">
                  <span className="ld-email-addr">{detail.primaryEmail}</span>
                  <span className="ld-email-status"><Check size={12} /> Direct email</span>
                  <button className="ld-copy-btn" onClick={() => copyText(detail.primaryEmail, 'email')} type="button">
                    {copiedKey === 'email' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                  <button className="ld-copy-btn" onClick={() => openExternal(detail.emailUrl)} type="button">
                    <Mail size={12} /> Email
                  </button>
                </div>
              ) : (
                <div className="ld-email-warn"><AlertCircle size={14} /> No direct email was discovered for this lead.</div>
              )}
              <div className="ld-email-row">
                <span className="ld-email-addr">{detail.phone || 'No phone listed'}</span>
                <span className="ld-email-status">{detail.phone ? 'Phone' : 'Missing'}</span>
                <button className="ld-copy-btn" onClick={() => copyText(detail.phone, 'phone')} disabled={!detail.phone} type="button">
                  {copiedKey === 'phone' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
                <button className="ld-copy-btn" onClick={() => openExternal(detail.phoneUrl)} disabled={!detail.phoneUrl} type="button">
                  <Phone size={12} /> Call
                </button>
              </div>
              <div className="ld-built-with">Source: <span className="ld-tech-badge">Google Places</span></div>
            </div>
          )}

          {activeTab === 'Website' && (
            <div className="ld-two-col">
              <div className="ld-card">
                <div className="ld-card-header"><Globe size={16} className="ld-card-icon" style={{ color: '#3b82f6' }} /> Website</div>
                <SeoCheckRow label="Website found" passed={Boolean(detail.websiteUrl)} value={detail.website || 'Missing'} />
                <SeoCheckRow label="Contact discovery" passed={Boolean(detail.primaryEmail)} value={detail.emailStatus} />
                <button className="ld-outline-btn" type="button" disabled={!detail.websiteUrl} onClick={() => openExternal(detail.websiteUrl)}>
                  <ExternalLink size={13} /> Open website
                </button>
              </div>
              <div className="ld-card">
                <div className="ld-card-header"><Hash size={16} className="ld-card-icon" style={{ color: '#eab308' }} /> Suggested angles</div>
                <div className="ld-seo-checks-grid">
                  {detail.pitchServices.map((service) => (
                    <SeoCheckRow key={service} label={service} passed />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Pitch' && (
            <div className="ld-card">
              <div className="ld-card-header"><Sparkles size={16} className="ld-card-icon" style={{ color: '#a855f7' }} /> Pitch</div>
              <p className="ld-sidebar-bold">{detail.pitch}</p>
              <p className="ld-sidebar-muted">{detail.outreachMessage}</p>
              <div className="ld-action-pills">
                <button className="ld-pill ld-pill-pitch" type="button" onClick={() => copyText(detail.outreachMessage, 'message')}>
                  <Copy size={13} /> {copiedKey === 'message' ? 'Copied' : 'Copy message'}
                </button>
                <button className="ld-pill ld-pill-whatsapp" type="button" disabled={!detail.whatsappUrl} onClick={() => openExternal(detail.whatsappUrl)}>
                  <MessageSquare size={13} /> WhatsApp
                </button>
                <button className="ld-pill ld-pill-default" type="button" disabled={!detail.emailUrl} onClick={() => openExternal(detail.emailUrl)}>
                  <Mail size={13} /> Email
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="ld-card">
              <div className="ld-card-header"><Clock size={16} className="ld-card-icon" /> Activity</div>
              <div className="ld-rating-notes">
                <div className="ld-note-row">Lead opened <span>Just now</span></div>
                <div className="ld-note-row">Saved status <span>{isSaved ? 'Saved' : 'Not saved'}</span></div>
                <div className="ld-note-row">Last search order <span>#{detail.searchOrder || '-'}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="ld-sidebar">
          <div className="ld-card">
            <div className="ld-card-header"><Sparkles size={16} className="ld-card-icon" style={{ color: '#eab308' }} /> Outreach</div>
            <p className="ld-sidebar-bold">{detail.pitch}</p>
            <p className="ld-sidebar-muted">{detail.outreachMessage}</p>
            <button className="ld-campaign-btn" type="button" onClick={() => copyText(detail.outreachMessage, 'campaign')}>
              <Send size={13} /> {copiedKey === 'campaign' ? 'Message copied' : 'Copy outreach'}
            </button>
          </div>

          <div className="ld-card">
            <div className="ld-card-header"><Linkedin size={16} className="ld-card-icon" style={{ color: '#38bdf8' }} /> LinkedIn</div>
            <p className="ld-sidebar-muted">
              {detail.linkedinUrl ? 'A LinkedIn profile was discovered for this lead.' : 'No LinkedIn profile was found, but you can search by business name.'}
            </p>
            <button className="ld-outline-btn" type="button" onClick={() => openExternal(detail.linkedinUrl || detail.linkedinSearchUrl)}>
              <Linkedin size={13} /> {detail.linkedinUrl ? 'Open LinkedIn' : 'Search LinkedIn'}
            </button>
          </div>

          <div className="ld-sidebar-note">
            <span className="ld-contact-dot" /> {detail.primaryEmail ? 'Direct email available' : 'Direct email not found'}
          </div>

          <div className="ld-card">
            <div className="ld-card-header"><Sparkles size={16} className="ld-card-icon" /> Connections</div>
            {CONNECTIONS.map((connection) => (
              <div key={connection.label} className="ld-connection-row">
                <ChevronRight size={14} className="ld-conn-chevron" />
                <connection.icon size={15} className="ld-conn-icon" />
                <span className="ld-conn-label">{connection.label}</span>
                <span className="ld-conn-count">{connection.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function buildLeadDetail(lead = {}) {
  const name = lead.name || 'Unnamed business';
  const location = lead.location || '';
  const phone = lead.phone || '';
  const websiteUrl = lead.websiteUrl || '';
  const website = lead.website || getWebsiteLabel(websiteUrl);
  const mapsUrl = lead.mapsUrl || buildGoogleMapsSearchUrl(lead);
  const primaryEmail = lead.emailAddress || '';
  const pitch = lead.pitch || 'Local SEO + Review Growth';
  const needs = Array.isArray(lead.needs) ? lead.needs : [];
  const rating = typeof lead.rating === 'number' ? lead.rating : null;
  const reviewCount = Number.isFinite(lead.reviewCount) ? lead.reviewCount : 0;
  const overallScore = clamp(Number(lead.score) || 0, 0, 100);
  const issues = buildIssues({ lead, needs, rating, reviewCount, websiteUrl, phone, primaryEmail });
  const pitchServices = needs.length ? needs.map((need) => pitchForNeed(need)) : [pitch];
  const outreachMessage = buildOutreachMessage({ name, pitch });

  return {
    ...lead,
    name,
    location,
    phone,
    website,
    websiteUrl,
    mapsUrl,
    primaryEmail,
    pitch,
    needs,
    rating,
    reviewCount,
    overallScore,
    scoreLabel: `${getPriorityLabel(lead.priority)} - ${overallScore}/100`,
    websiteScore: estimateWebsiteScore({ websiteUrl, primaryEmail }),
    seoScore: estimateSeoScore({ needs, rating, reviewCount, websiteUrl }),
    contactScore: estimateContactScore({ phone, primaryEmail, websiteUrl }),
    issues,
    pitchServices: [...new Set(pitchServices)],
    siteSignalSummary: websiteUrl
      ? 'Website and contact signals are based on the current Google Places result and lightweight contact discovery.'
      : 'No website was found in Google Places, making this a stronger website-build pitch.',
    emailStatus: primaryEmail ? 'Found' : lead.email === 'searching' ? 'Searching' : 'Not found',
    whatsappUrl: buildWhatsAppUrl(phone, outreachMessage),
    emailUrl: primaryEmail ? buildEmailUrl(primaryEmail, name, outreachMessage) : '',
    phoneUrl: buildPhoneUrl(phone),
    linkedinUrl: lead.linkedinUrl || '',
    linkedinSearchUrl: buildLinkedInSearchUrl({ name, location }),
    outreachMessage,
  };
}

function buildIssues({ needs, rating, reviewCount, websiteUrl, phone, primaryEmail }) {
  const issues = [...needs];
  if (!websiteUrl && !issues.includes('No Website')) issues.push('No Website');
  if (!phone && !issues.includes('No Phone Listed')) issues.push('No Phone Listed');
  if (!primaryEmail) issues.push('No Direct Email');
  if (!rating && !issues.includes('No Rating')) issues.push('No Rating');
  if (reviewCount < 20 && !issues.some((issue) => issue.includes('Reviews') || issue.includes('Zero'))) {
    issues.push('Few Reviews');
  }
  return [...new Set(issues)];
}

function pitchForNeed(need) {
  if (need.includes('No Website')) return 'Website Build';
  if (need.includes('SEO')) return 'Local SEO Setup';
  if (need.includes('Rating') || need.includes('Star')) return 'Reputation Management';
  if (need.includes('Review') || need.includes('Reviews') || need.includes('Zero')) return 'Review Growth';
  if (need.includes('Phone')) return 'Google Business Profile Optimization';
  if (need.includes('Email')) return 'Contact Discovery';
  return need;
}

function estimateWebsiteScore({ websiteUrl, primaryEmail }) {
  let score = websiteUrl ? 62 : 18;
  if (primaryEmail) score += 12;
  return clamp(score, 0, 100);
}

function estimateSeoScore({ needs, rating, reviewCount, websiteUrl }) {
  let score = websiteUrl ? 58 : 28;
  if (needs.some((need) => need.includes('SEO'))) score -= 12;
  if (rating && rating >= 4) score += 10;
  if (reviewCount >= 50) score += 12;
  if (reviewCount < 20) score -= 8;
  return clamp(score, 0, 100);
}

function estimateContactScore({ phone, primaryEmail, websiteUrl }) {
  let score = 20;
  if (phone) score += 30;
  if (primaryEmail) score += 35;
  if (websiteUrl) score += 10;
  return clamp(score, 0, 100);
}

function getPriorityLabel(priority) {
  const labels = {
    hot: 'Hot Lead',
    good: 'Good Opportunity',
    moderate: 'Moderate',
    low: 'Low Priority',
  };
  return labels[priority] || 'Lead';
}

function getScoreColor(score) {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function buildOutreachMessage({ name, pitch }) {
  return [
    `Hi, I came across ${name} and noticed an opportunity around ${pitch}.`,
    'I help local businesses improve visibility, reviews, and inbound leads.',
    'Do you have a moment to chat?',
  ].join('\n\n');
}

function buildWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizePhoneForMessaging(phone);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : '';
}

function buildEmailUrl(email, name, message) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Quick idea for ${name}`)}&body=${encodeURIComponent(message)}`;
}

function buildPhoneUrl(phone) {
  const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '');
  return normalizedPhone ? `tel:${normalizedPhone}` : '';
}

function buildGoogleMapsSearchUrl(lead) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name || ''} ${lead.location || ''}`)}`;
}

function buildLinkedInSearchUrl(lead) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${lead.name || ''} ${lead.location || ''}`)}`;
}

function normalizePhoneForMessaging(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `1${digits}` : digits;
}

function getWebsiteLabel(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function buildReportText(detail) {
  return [
    `Lead report: ${detail.name}`,
    `Location: ${detail.location || 'N/A'}`,
    `Phone: ${detail.phone || 'N/A'}`,
    `Website: ${detail.websiteUrl || 'N/A'}`,
    `Email: ${detail.primaryEmail || 'N/A'}`,
    `Score: ${detail.scoreLabel}`,
    `Rating: ${detail.rating || 'N/A'}`,
    `Reviews: ${detail.reviewCount}`,
    `Pitch: ${detail.pitch}`,
    '',
    'Issues:',
    ...(detail.issues.length ? detail.issues.map((issue) => `- ${issue}`) : ['- None detected']),
    '',
    'Outreach message:',
    detail.outreachMessage,
  ].join('\n');
}

function slugify(value) {
  return String(value || 'lead')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'lead';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default LeadDetailPage;
