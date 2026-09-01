/* ─── Off-Page SEO Mock Data ─── */

// ──────── EXPIRED DOMAIN FINDER ────────
export const expiredDomainData = {
  tips: [
    { icon: "refresh", title: "Batch Processing", desc: "Domains are checked in batches of 10 to avoid rate limiting. Large lists may take time." },
    { icon: "globe", title: "Supported TLDs", desc: ".com, .net, .org, .io, .co, .info, .me, .biz use RDAP. Others use HTTP fallback." },
    { icon: "alert", title: "Verify Results", desc: '"Available" domains should be verified at a registrar before purchase. Some may be premium priced.' },
  ],
};

// ──────── BACKLINK CLEANER ────────
export const backlinkCleanerData = {
  stats: {
    totalLinks: 137,
    clean: 84,
    flagged: 53,
    avgDR: 32,
    scanned: 0,
    excluded: 0,
  },
  fileId: "68a5def6-c17d-41f7-9eac-6d9e3cd70cc0.csv",
  domains: [
    { domain: "grandviewresearch.com", dr: 90, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "theregister.com", dr: 90, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "grokipedia.com", dr: 76, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "madeinbritain.org", dr: 75, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "webwiki.com", dr: 79, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "superagi.com", dr: 75, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "m5stack.com", dr: 73, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "rankongoogle.agency", dr: 73, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "datainsightsmarket.com", dr: 72, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "adigroup.org.uk", dr: 71, category: "-", title: "-", status: "-", issues: "Clean", excluded: false },
    { domain: "spammy-site.xyz", dr: 5, category: "-", title: "-", status: "-", issues: "Spammy TLD", excluded: false },
    { domain: "casino-links.bet", dr: 15, category: "-", title: "-", status: "-", issues: "Adult/Gambling", excluded: false },
  ],
};

// ──────── BACKLINK INDEXER ────────
export const backlinkIndexerData = {
  tabs: ["Ping Services", "Check Index Status", "Google Indexing API", "RSS Feed Generator", "Drip-Feed Scheduler"],
  pingServices: [
    { name: "Google Ping", enabled: true },
    { name: "Bing Ping", enabled: true },
    { name: "IndexNow", enabled: true },
    { name: "Pingomatic", enabled: true },
    { name: "Twingly", enabled: false },
  ],
  socialBookmarks: [
    { name: "Reddit", icon: "rd" },
    { name: "Mix (StumbleUpon)", icon: "mx" },
    { name: "Diigo", icon: "dg" },
    { name: "Pocket", icon: "pk" },
    { name: "Flipboard", icon: "fb" },
    { name: "Scoop.it", icon: "si" },
  ],
};
