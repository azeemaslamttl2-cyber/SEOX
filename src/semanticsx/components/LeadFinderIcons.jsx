/* Premium SVG icon set for Lead Finder Tool */

const s = (size) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' });

export const IcoSearch = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" /><path d="M15.5 15.5L20.5 20.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);

export const IcoSparkles = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" fill="currentColor" /><path d="M18 14l.9 2.7L21.6 17.6l-2.7.9L18 21.2l-.9-2.7-2.7-.9 2.7-.9L18 14z" fill="currentColor" opacity="0.6" /><path d="M6 16l.6 1.8 1.8.6-1.8.6L6 20.8l-.6-1.8L3.6 18.4l1.8-.6L6 16z" fill="currentColor" opacity="0.4" /></svg>
);

export const IcoFileSpreadsheet = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="4" y="2" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><rect x="4" y="2" width="16" height="5" rx="2.5" fill="currentColor" opacity="0.12" /></svg>
);

export const IcoFileDown = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M12 3v12M12 15l-3.5-3.5M12 15l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

export const IcoChevronDown = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoChevronRight = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoStar = ({ size = 16, className = '', fill }) => (
  <svg {...s(size)} className={className}><path d="M12 2.5l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 16.9l-5.6 2.8 1.1-6.2L3 9.1l6.2-.9L12 2.5z" fill={fill || 'currentColor'} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /></svg>
);

export const IcoMapPin = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="9" r="2.5" fill="currentColor" /></svg>
);

export const IcoPhone = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M5.2 3h4l1.5 4.5-2.3 1.3a13 13 0 006.8 6.8l1.3-2.3L21 14.8v4a2 2 0 01-2 2A17 17 0 013 4.8a2 2 0 012-1.8z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);

export const IcoGlobe = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 9h17M3.5 15h17" stroke="currentColor" strokeWidth="1.2" /></svg>
);

export const IcoMail = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.08" /><path d="M3.5 6.5l8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoBookmark = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M5 4.5A2.5 2.5 0 017.5 2h9A2.5 2.5 0 0119 4.5V22l-7-4.5L5 22V4.5z" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
);

export const IcoLinkedin = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.08" /><path d="M8 11v5M8 8v.01M12 16v-4a2 2 0 014 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoRefresh = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M4 12a8 8 0 0114.5-4.6L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 12a8 8 0 01-14.5 4.6L3 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoUsers = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><circle cx="9" cy="7" r="3.5" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" /><path d="M2 20c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M18 14c2.2.5 4 2.5 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
);

export const IcoTarget = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
);

export const IcoZap = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M13 2L4.5 13H12l-1 9 8.5-11H12l1-9z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);

export const IcoFlame = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M12 22c4-2 7-5 7-10 0-4-2-7-4-9l-1.5 3c-.6 1.2-2.4 1.2-3 0L9 3C7 5 5 8 5 12c0 5 3 8 7 10z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 22c1.5-1 3-2.5 3-5s-1.5-4-3-5c-1.5 1-3 2.5-3 5s1.5 4 3 5z" fill="currentColor" opacity="0.3" /></svg>
);

export const IcoWarning = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M10.3 3.2L1.8 18.5a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.2a2 2 0 00-3.4 0z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1" fill="currentColor" /></svg>
);

export const IcoClose = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);

export const IcoSliders = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M4 6h3M11 6h9M4 12h9M17 12h3M4 18h5M13 18h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8.5" cy="6" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.4" /><circle cx="15.5" cy="12" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.4" /><circle cx="11" cy="18" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.4" /></svg>
);

export const IcoCheckSquare = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12.5l2.8 2.8L16 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const IcoSquare = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" /></svg>
);

export const IcoBarChart = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.2" /><rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.2" /><rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.2" /></svg>
);

export const IcoBuilding = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><rect x="4" y="3" width="16" height="19" rx="2" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.06" /><rect x="8" y="7" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.5" /><rect x="13.5" y="7" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.5" /><rect x="8" y="12.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.5" /><rect x="13.5" y="12.5" width="2.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.5" /><rect x="10" y="18" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.3" /></svg>
);

export const IcoWhatsApp = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><path d="M12 2a10 10 0 00-8.6 15l-1.2 4.2 4.3-1.1A10 10 0 1012 2z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.06" /><path d="M9 10c0-.6.4-1.2 1-1.5.3-.2.7 0 .8.3l.4 1c.1.2 0 .5-.2.6l-.3.2c-.1.1-.1.3 0 .5.4.7 1 1.3 1.7 1.7.2.1.4.1.5 0l.2-.3c.1-.2.4-.3.6-.2l1 .4c.3.1.5.5.3.8-.3.6-.9 1-1.5 1-2.5 0-4.5-2-4.5-4.5z" fill="currentColor" /></svg>
);

export const IcoCompass = ({ size = 16, className = '' }) => (
  <svg {...s(size)} className={className}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M16.2 7.8l-2.4 5.8-5.8 2.4 2.4-5.8 5.8-2.4z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>
);
