export default function Logo({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-brand" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A7F3D0" />
          <stop offset="0.5" stopColor="#7ABDBC" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="lg-spark" x1="12" y1="9" x2="28" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ECFEFF" />
          <stop offset="1" stopColor="#A7F3D0" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="16" fill="#0B1517" />
      <circle cx="20" cy="20" r="15" fill="none" stroke="url(#lg-brand)" strokeWidth="2" />
      <path
        d="M12 27L18.5 12.5L25 27M15.2 21.5H21.8"
        stroke="url(#lg-spark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 13.5V26.5"
        stroke="url(#lg-brand)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="29" cy="9.5" r="1.8" fill="#A7F3D0" />
      <circle cx="32.5" cy="18" r="1.35" fill="#60A5FA" opacity="0.85" />
    </svg>
  );
}
