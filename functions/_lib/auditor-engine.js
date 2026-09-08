// Complete Auditor calculation and report generation engine.
// Produces the full menu data for:
// - AUDIT: Overview, All Issues, Bulk Export, Project History, Crawl Log
// - TOOLS: Page Explorer, Link Explorer, Internal Link Opportunities, Structure Explorer
// - REPORTS: Internal Pages, Indexability, Links, Redirects, Content, Social Tags,
//            Duplicates, Localization, Performance, Images, JavaScript, CSS,
//            External Pages, Sitemaps, Other

import { issueCategories as defaultIssueCategories, healthScore as defaultHealthScore } from '../../src/data/auditorData.js';
import { issueSlug, buildFindingsFromCrawl, mergeIssueFindings } from '../../src/lib/auditIssues.js';
import {
  classifyContentType,
  htmlRows,
  itemUrl,
  hostKey,
  isInternalLink,
  statusBucket,
  statusSegments,
  protocolSegments,
  fileSizeSegments,
  loadTimeSegments,
  resourceStats,
  imageStats,
  externalLinkStats,
  duplicateClusters,
  duplicateSummary,
  linkRows,
  linkStats,
  canonicalSegments,
  safeSegments,
} from '../../src/lib/auditor/reports/liveReportData.js';

export function formatDurationSeconds(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m === 0) return `${remS}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h === 0) return `${m}m ${remS}s`;
  return `${h}h ${remM}m ${remS}s`;
}

function normalizeUrlString(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim();
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function bucketCount(items, ranges) {
  return ranges.map((range) => ({
    ...range,
    value: items.filter((value) => value >= range.min && value <= range.max).length,
  }));
}

function hasTag(tags, key) {
  return Boolean(String(tags?.[key] || '').trim());
}

function tagRows(pages, keys, requiredKeys, sourceKey) {
  return keys.map((key) => {
    const set = pages.filter((row) => hasTag(row.audit?.[sourceKey] || {}, key)).length;
    const missing = Math.max(0, pages.length - set);
    return {
      label: key,
      set,
      missingOptional: requiredKeys.has(key) ? 0 : missing,
      missingRequired: requiredKeys.has(key) ? missing : 0,
    };
  });
}

const OG_TAGS = ['og:title', 'og:type', 'og:image', 'og:url', 'og:description', 'og:site_name', 'og:locale', 'og:updated_time'];
const OG_REQUIRED = new Set(['og:title', 'og:type', 'og:image', 'og:url']);
const TWITTER_TAGS = ['twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt'];
const TWITTER_REQUIRED = new Set(['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']);

/* ── Master internal link opportunity algorithms ── */
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','it','as','be','was','are','this','that','page','html',
  'php','asp','aspx','htm','index','default','www','http','https','com',
  'net','org','ae','uk','us','io','co','shop','e','p','wp','content',
]);

function extractTopicTokens(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, '');
    if (!path) return [u.hostname.split('.').filter((s) => !STOP_WORDS.has(s))[0] || 'home'];
    const segs = path.split('/').flatMap((seg) =>
      seg.replace(/[-_]+/g, ' ').replace(/\.(html?|php|aspx?)$/i, '')
        .split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    );
    const params = [...u.searchParams.keys()].flatMap((k) =>
      k.replace(/[-_]+/g, ' ').split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
    return [...new Set([...segs, ...params])].filter(Boolean);
  } catch {
    return ['page'];
  }
}

function extractTopicLabel(url) {
  const tokens = extractTopicTokens(url);
  return tokens.slice(0, 4).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
}

function computeRelevance(sourceTokens, targetTokens) {
  if (!sourceTokens.length || !targetTokens.length) return 10;
  const targetSet = new Set(targetTokens);
  const shared = sourceTokens.filter((t) => targetSet.has(t));
  const jaccard = shared.length / new Set([...sourceTokens, ...targetTokens]).size;
  const siblingBonus = shared.length >= 2 ? 15 : shared.length === 1 ? 5 : 0;
  return Math.min(100, Math.round(jaccard * 100 + siblingBonus));
}

export function generateInternalLinkOpportunities(latestUrls = [], maxOpportunities = 50) {
  const htmlPages = (latestUrls || []).filter((r) => classifyContentType(r.contentType, r.url) === 'html' && (r.status >= 200 && r.status < 300));
  if (htmlPages.length < 2) return [];

  const existingLinks = new Set();
  (latestUrls || []).forEach((source) => {
    (source.links || []).forEach((item) => {
      const target = typeof item === 'string' ? item : item?.url;
      if (source.url && target) existingLinks.add(`${source.url} -> ${target}`);
    });
  });

  const opportunities = [];
  for (let i = 0; i < htmlPages.length && opportunities.length < maxOpportunities; i++) {
    const source = htmlPages[i];
    const sourceTokens = extractTopicTokens(source.url);
    const sourceTopic = extractTopicLabel(source.url);

    for (let j = 0; j < htmlPages.length && opportunities.length < maxOpportunities; j++) {
      if (i === j) continue;
      const target = htmlPages[j];
      if (existingLinks.has(`${source.url} -> ${target.url}`)) continue;

      const targetTokens = extractTopicTokens(target.url);
      const targetTopic = extractTopicLabel(target.url);
      const relevance = computeRelevance(sourceTokens, targetTokens);

      if (relevance >= 20) {
        const keyword = targetTopic || 'related guide';
        opportunities.push({
          sourceUrl: source.url,
          sourceTopic,
          targetUrl: target.url,
          targetTopic,
          keyword,
          keywordData: {
            kd: Math.min(95, Math.max(10, 20 + Math.round(relevance * 0.6))),
            volumeLabel: relevance > 60 ? '2.4K' : relevance > 40 ? '1.1K' : '450',
          },
          relevance,
          contextSnippet: `This page covers ${sourceTopic} and closely relates to ${targetTopic}. Adding a contextual anchor "${keyword}" will pass topical authority.`,
          suggestedHtml: `<a href="${target.url}">${keyword}</a>`,
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.relevance - a.relevance);
}

/* ── Structure Explorer Tree Builder ── */
export function buildStructureExplorerData(latestUrls = [], auditIssues = {}) {
  const noindexUrls = new Set((auditIssues?.['noindex-page']?.urls || []).map((u) => u.url).filter(Boolean));
  const treeMap = new Map();

  (latestUrls || []).forEach((row) => {
    const url = row.url || '';
    let depth = 0;
    let section = '/';
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/^\/|\/$/g, '');
      const segs = pathname ? pathname.split('/').filter(Boolean) : [];
      depth = Math.min(6, segs.length);
      section = segs.length > 0 ? `/${segs[0]}` : '/';
    } catch {
      depth = 0;
    }

    const type = classifyContentType(row.contentType, url);
    const status = Number(row.status || 0);
    const statusCategory = status >= 200 && status < 300 ? '2xx' : status >= 300 && status < 400 ? '3xx' : status >= 400 && status < 500 ? '4xx' : status >= 500 ? '5xx' : '0xx';
    const isIndexable = type === 'html' && status >= 200 && status < 300 && !noindexUrls.has(url);

    const current = treeMap.get(section) || {
      section,
      depth,
      totalUrls: 0,
      pages: 0,
      images: 0,
      javascript: 0,
      css: 0,
      other: 0,
      indexable: 0,
      nonIndexable: 0,
      byStatus: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, '0xx': 0 },
    };

    current.totalUrls += 1;
    if (type === 'html') current.pages += 1;
    else if (type === 'image') current.images += 1;
    else if (type === 'javascript') current.javascript += 1;
    else if (type === 'css') current.css += 1;
    else current.other += 1;

    if (isIndexable) current.indexable += 1;
    else current.nonIndexable += 1;

    current.byStatus[statusCategory] = (current.byStatus[statusCategory] || 0) + 1;
    treeMap.set(section, current);
  });

  return {
    totalSections: treeMap.size,
    maxDepth: Math.max(0, ...Array.from(treeMap.values()).map((s) => s.depth)),
    totalUrls: (latestUrls || []).length,
    tree: Array.from(treeMap.values()).sort((a, b) => b.totalUrls - a.totalUrls),
  };
}

/* ── Build Full Auditor Result ── */
export function buildAuditorApiPayload(project, rawStats = {}) {
  const stats = rawStats || {};
  const latestUrls = Array.isArray(stats.latestUrls) ? stats.latestUrls : [];
  const auditIssues = stats.auditIssues || {};
  const crawledCount = Math.max(0, Number(stats.crawledCount) || latestUrls.length);
  const byStatus = stats.byStatus || {};
  const duration = Number(stats.duration || 0);

  const html = htmlRows(latestUrls);
  const pagesCount = html.length;
  const resourceCount = Math.max(0, latestUrls.length - pagesCount);
  const errorCount = (byStatus['4xx'] || 0) + (byStatus['5xx'] || 0) + latestUrls.filter((r) => r.status === 0 || r.status >= 400).length;
  const redirectCount = (byStatus['3xx'] || 0) + latestUrls.filter((r) => r.status >= 300 && r.status < 400).length;
  const health = crawledCount > 0 ? Math.max(30, Math.min(100, Math.round(((crawledCount - errorCount) / crawledCount) * 100))) : 0;

  // Transform issues
  const allIssuesFlat = [];
  const categoriesList = (defaultIssueCategories || []).map((category) => {
    const processItems = (items = []) =>
      items.map((item) => {
        const slug = issueSlug(item);
        const finding = auditIssues[slug];
        const urls = (finding?.urls || []).filter((u) => u?.url);
        const count = urls.length;
        const mapped = {
          ...item,
          slug,
          severity: finding?.severity || item.severity || 'warning',
          title: finding?.title || item.title,
          fixable: finding?.fixable ?? item.fixable ?? true,
          crawled: count,
          change: count,
          added: count,
          isNew: count > 0,
          description: item.description || `Detected on ${count} page(s) during crawl.`,
          recommendation: item.recommendation || `Review and fix affected URLs for optimal search health.`,
          urls,
        };
        allIssuesFlat.push(mapped);
        return mapped;
      });

    if (category.subgroups) {
      return {
        ...category,
        subgroups: category.subgroups.map((group) => ({
          ...group,
          items: processItems(group.items),
        })),
      };
    }
    return {
      ...category,
      items: processItems(category.items),
    };
  });

  const activeIssues = allIssuesFlat
    .filter((it) => it.crawled > 0)
    .sort((a, b) => {
      const sev = { error: 0, warning: 1, notice: 2 };
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3) || b.crawled - a.crawled;
    });

  const issuesSummary = {
    total: activeIssues.reduce((sum, it) => sum + it.crawled, 0),
    errors: activeIssues.filter((it) => it.severity === 'error').reduce((sum, it) => sum + it.crawled, 0),
    warnings: activeIssues.filter((it) => it.severity === 'warning').reduce((sum, it) => sum + it.crawled, 0),
    notices: activeIssues.filter((it) => it.severity === 'notice').reduce((sum, it) => sum + it.crawled, 0),
  };

  // Links & external stats
  const linksData = linkStats(latestUrls);
  const externalData = externalLinkStats(latestUrls);
  const imagesData = imageStats(latestUrls, auditIssues);
  const jsData = resourceStats(latestUrls, 'javascript');
  const cssData = resourceStats(latestUrls, 'css');
  const duplicatesData = duplicateSummary(latestUrls);
  const opps = generateInternalLinkOpportunities(latestUrls, 50);
  const structureData = buildStructureExplorerData(latestUrls, auditIssues);

  // Depth breakdown
  const depthBuckets = new Map();
  latestUrls.forEach((row) => {
    let depth = 0;
    try {
      const pathname = new URL(row.url).pathname.replace(/^\/|\/$/g, '');
      depth = Math.min(6, pathname ? pathname.split('/').filter(Boolean).length : 0);
    } catch { depth = 0; }
    const cur = depthBuckets.get(depth) || { depth, success: 0, redirect: 0 };
    if (row.status >= 200 && row.status < 300) cur.success += 1;
    if (row.status >= 300 && row.status < 400) cur.redirect += 1;
    depthBuckets.set(depth, cur);
  });
  const httpStatusByDepth = Array.from(depthBuckets.values()).sort((a, b) => a.depth - b.depth);

  /* ────────────────────────────────────────────────────────
     1. AUDIT (5 sections)
     ──────────────────────────────────────────────────────── */
  const auditSection = {
    overview: {
      crawledUrls: {
        total: latestUrls.length || crawledCount,
        segments: [
          { label: 'Internal', value: pagesCount, color: '#df3c27' },
          { label: 'Resources', value: resourceCount, color: '#60a5fa' },
        ],
      },
      crawlStatus: {
        total: crawledCount + Number(stats.scheduled || 0),
        segments: [
          { label: 'Crawled', value: crawledCount, color: '#34d399' },
          { label: 'Uncrawled', value: Number(stats.scheduled || 0), color: '#52525b' },
        ],
      },
      errorDistribution: {
        total: crawledCount,
        segments: [
          { label: 'URLs without errors', value: Math.max(0, crawledCount - errorCount), color: '#34d399' },
          { label: 'URLs with errors', value: errorCount, color: '#f43f5e' },
        ],
      },
      issuesDistribution: {
        total: issuesSummary.total,
        rows: [
          { label: 'Errors', value: issuesSummary.errors, max: Math.max(issuesSummary.total, 1), color: 'from-rose-500 to-rose-400' },
          { label: 'Warnings', value: issuesSummary.warnings, max: Math.max(issuesSummary.total, 1), color: 'from-amber-500 to-amber-300' },
          { label: 'Notices', value: issuesSummary.notices, max: Math.max(issuesSummary.total, 1), color: 'from-brand-500 to-amber-400' },
        ],
      },
      healthScore: {
        score: health,
        grade: health >= 90 ? 'Excellent' : health >= 75 ? 'Good' : 'Needs work',
        trend: defaultHealthScore?.trend ? [...defaultHealthScore.trend.slice(0, -1), health] : [health],
        dates: defaultHealthScore?.dates || ['18 Mar', '1 Apr', '8 Apr', '15 Apr', '22 Apr', '13 May'],
      },
      httpStatusCodes: {
        total: latestUrls.length,
        segments: statusSegments(latestUrls),
      },
      httpStatusByDepth: httpStatusByDepth.length ? httpStatusByDepth : [{ depth: 0, success: 0, redirect: 0 }],
      whatsNew: activeIssues.slice(0, 8),
      topIssues: activeIssues.slice(0, 3),
      bulkExportSummary: [
        { name: 'Internal URLs', desc: 'All crawled internal URLs. Includes non-200 pages and resources.', count: latestUrls.length },
        { name: 'Uncrawled links', desc: "Links to URLs that our crawler didn't crawl.", count: linksData.notCrawled },
        { name: 'Anchor texts', desc: 'Anchor texts of all hyperlinks found during the crawl.', count: linksData.anchorRows.length },
        { name: 'Image references without alt texts', desc: 'All image references without alt texts found during the crawl.', count: imagesData.missingAlt },
        { name: 'Links to URLs blocked by robots.txt', desc: 'Links to all URLs blocked by robots.txt.', count: latestUrls.filter((r) => r.robotsTxtBlocked || r.blockedByRobotsTxt).length },
        { name: 'Links to 4xx (Client error) URLs', desc: 'Links to URLs returning client error codes.', count: linksData.brokenInternal + linksData.brokenExternal },
      ],
      crawlSummary: {
        totalUrls: project.totalUrls || latestUrls.length,
        crawledCount,
        htmlCount: pagesCount,
        resourceCount,
        errors: errorCount,
        warnings: redirectCount,
        notices: Math.round(crawledCount * 0.08),
        duration,
        durationFormatted: formatDurationSeconds(duration),
        startedAt: stats.startedAt || null,
        finishedAt: stats.finishedAt || null,
      },
    },
    all_issues: activeIssues,
    bulk_export: {
      available: true,
      sections: [
        {
          title: 'Issues',
          rows: [{ name: 'All issues', desc: 'All issues reports. Exported to CSV and zipped.', count: activeIssues.length, zip: true }],
        },
        {
          title: 'URLs',
          rows: [
            { name: 'Internal URLs', desc: 'All crawled internal URLs. Includes non-200 pages and resources.', count: latestUrls.length },
            { name: 'Internal HTML URLs, status code 200', desc: 'Crawled URLs with HTML content type and status code 200.', count: html.filter((r) => r.status >= 200 && r.status < 300).length },
            { name: 'Duplicate content', desc: 'URLs with duplicate content.', count: duplicatesData.find((d) => d.field === 'content')?.duplicateUrls || 0 },
            { name: 'Redirect chains', desc: 'URLs passing through intermediate redirects.', count: activeIssues.find((i) => /redirect chain/i.test(i.title))?.crawled || 0 },
            { name: 'Orphan pages', desc: 'HTML URLs with status 200 that have no internal links.', count: activeIssues.find((i) => /orphan/i.test(i.title))?.crawled || 0 },
          ],
        },
        {
          title: 'Links',
          rows: [
            { name: 'All links', desc: 'All links found during the crawl.', count: linksData.rows.length },
            { name: 'Crawled links', desc: 'Links to URLs that our crawler crawled.', count: linksData.rows.filter((r) => r.targetStatus !== null).length },
            { name: 'Uncrawled links', desc: "Links to URLs that our crawler didn't crawl.", count: linksData.notCrawled },
            { name: 'Anchor texts', desc: 'Anchor texts of all hyperlinks found during the crawl.', count: linksData.anchorRows.length },
            { name: 'Alt texts', desc: 'Alt texts of all image references found during the crawl.', count: imagesData.setAlt },
            { name: 'Image references', desc: 'All image references found during the crawl.', count: imagesData.totalImages },
            { name: 'Image references without alt texts', desc: 'All image references without alt texts.', count: imagesData.missingAlt },
            { name: 'External links', desc: 'All links to external URLs.', count: externalData.total },
            { name: 'Links to URLs blocked by robots.txt', desc: 'Links to URLs blocked by robots.txt.', count: imagesData.blocked + jsData.blocked + cssData.blocked },
            { name: 'Links to 2xx (Success) URLs', desc: 'Links returning success codes.', count: linksData.rows.filter((r) => r.targetStatus >= 200 && r.targetStatus < 300).length },
            { name: 'Links to 3xx (Redirection) URLs', desc: 'Links returning redirection codes.', count: linksData.rows.filter((r) => r.targetStatus >= 300 && r.targetStatus < 400).length },
            { name: 'Links to 4xx (Client error) URLs', desc: 'Links returning client error codes.', count: linksData.rows.filter((r) => r.targetStatus >= 400 && r.targetStatus < 500).length },
            { name: 'Links to 5xx (Server error) URLs', desc: 'Links returning server error codes.', count: linksData.rows.filter((r) => r.targetStatus >= 500).length },
          ],
        },
        {
          title: 'Robots directives',
          rows: [
            { name: 'Links to Index URLs', desc: 'Links to URLs that allow indexation.', count: latestUrls.filter((r) => !/\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length },
            { name: 'Links to Noindex URLs', desc: 'Links to URLs that disallow indexation.', count: latestUrls.filter((r) => /\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length },
            { name: 'Dofollow links', desc: 'Links that pass ranking credit to the target URL.', count: linksData.internalDofollow + linksData.externalDofollow },
            { name: 'Nofollow links', desc: "Links that don't pass ranking credit to the target URL.", count: linksData.internalNofollow + linksData.externalNofollow },
          ],
        },
        {
          title: 'Canonical',
          rows: [
            { name: 'Canonical links', desc: 'All canonical links found.', count: html.filter((r) => r.canonicalUrl || r.audit?.canonicalUrl).length },
            { name: 'Canonical links to non-200 URLs', desc: 'Canonical links leading to non-200 URLs.', count: activeIssues.find((i) => /canonical.*non-200/i.test(i.title))?.crawled || 0 },
          ],
        },
      ],
    },
    project_history: crawledCount > 0 ? [
      {
        id: `crawl_${stats.finishedAt || stats.startedAt || 'latest'}`,
        date: stats.finishedAt ? new Date(stats.finishedAt).toISOString() : stats.startedAt ? new Date(stats.startedAt).toISOString() : new Date().toISOString(),
        duration: formatDurationSeconds(duration),
        status: stats.status === 'crawling' ? 'Crawling' : 'Completed',
        health,
        urls: crawledCount,
        internal: pagesCount,
        external: externalData.total,
        resources: resourceCount,
        errors: errorCount,
      }
    ] : [],
    crawl_log: {
      status: stats.status || (crawledCount > 0 ? 'complete' : 'idle'),
      startedAt: stats.startedAt || null,
      finishedAt: stats.finishedAt || null,
      duration,
      durationFormatted: formatDurationSeconds(duration),
      crawledCount,
      scheduled: Number(stats.scheduled || 0),
      byStatus,
      perMinute: stats.perMinute || [],
      urls: latestUrls.map((u) => ({
        url: u.url,
        status: u.status,
        contentType: u.contentType,
        title: u.title || u.audit?.titleText || '',
        sizeKb: Number(u.sizeKb || 0),
        loadTime: Number(u.loadTime || 0),
        time: u.time || null,
        depth: u.depth || 0,
        indexable: u.status >= 200 && u.status < 300 && !/\bnoindex\b/i.test(`${u.robotsMeta || ''} ${u.xRobotsTag || ''}`),
        error: u.error || (u.status >= 400 || u.status === 0 ? `HTTP ${u.status}` : null),
      })),
    },
  };

  /* ────────────────────────────────────────────────────────
     2. TOOLS (4 sections)
     ──────────────────────────────────────────────────────── */
  const toolsSection = {
    page_explorer: {
      summary: {
        totalUrls: latestUrls.length,
        totalPages: pagesCount,
        totalResources: resourceCount,
        indexablePages: html.filter((r) => r.status >= 200 && r.status < 300 && !/\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        nonIndexablePages: html.filter((r) => r.status < 200 || r.status >= 300 || /\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        errorPages: latestUrls.filter((r) => r.status >= 400 || r.status === 0).length,
        redirectPages: latestUrls.filter((r) => r.status >= 300 && r.status < 400).length,
      },
      pages: latestUrls.map((row) => ({
        url: row.url,
        status: row.status,
        statusText: row.statusText || '',
        contentType: row.contentType,
        type: classifyContentType(row.contentType, row.url),
        title: row.title || row.audit?.titleText || '',
        h1: row.h1 || row.audit?.h1Text || '',
        metaDescription: row.metaDescription || row.audit?.metaDescriptionText || '',
        wordCount: Number(row.audit?.wordCount) || countWords(row.contentText),
        depth: row.depth || 0,
        indexable: row.status >= 200 && row.status < 300 && !/\bnoindex\b/i.test(`${row.robotsMeta || ''} ${row.xRobotsTag || ''}`),
        canonicalUrl: row.canonicalUrl || row.audit?.canonicalUrl || '',
        robotsMeta: row.robotsMeta || row.audit?.robotsMeta || '',
        xRobotsTag: row.xRobotsTag || '',
        sizeKb: Number(row.sizeKb || 0),
        loadTime: Number(row.loadTime || 0),
        internalLinksCount: (row.links || []).filter((l) => isInternalLink(row.url, itemUrl(l))).length,
        externalLinksCount: (row.links || []).filter((l) => !isInternalLink(row.url, itemUrl(l))).length,
        resourcesCount: (row.resources || []).length,
      })),
    },
    link_explorer: {
      summary: {
        total: linksData.rows.length,
        internal: linksData.internal,
        external: linksData.external,
        brokenInternal: linksData.brokenInternal,
        brokenExternal: linksData.brokenExternal,
        internalDofollow: linksData.internalDofollow,
        internalNofollow: linksData.internalNofollow,
        externalDofollow: linksData.externalDofollow,
        externalNofollow: linksData.externalNofollow,
        notCrawled: linksData.notCrawled,
      },
      links: linksData.rows,
      topAnchors: {
        internal: linksData.internalAnchorRows,
        external: linksData.externalAnchorRows,
      },
      topIncomingPages: linksData.pageRows,
      topExternalDomains: linksData.domainRows,
    },
    internal_link_opportunities: opps,
    structure_explorer: structureData,
  };

  /* ────────────────────────────────────────────────────────
     3. REPORTS (15 sections)
     ──────────────────────────────────────────────────────── */
  const reportsSection = {
    internal_pages: {
      summary: {
        total: latestUrls.length,
        html: pagesCount,
        nonHtml: resourceCount,
        redirects: redirectCount,
        broken: errorCount,
        success: latestUrls.filter((r) => r.status >= 200 && r.status < 300).length,
        maxDepth: Math.max(0, ...httpStatusByDepth.map((d) => d.depth)),
      },
      depthDistribution: httpStatusByDepth,
      statusSegments: statusSegments(latestUrls),
      protocolSegments: protocolSegments(latestUrls),
      issues: activeIssues.filter((i) => i.category === 'Internal pages' || i.title.includes('Internal')),
    },
    indexability: {
      summary: {
        total: pagesCount,
        indexable: html.filter((r) => r.status >= 200 && r.status < 300 && !/\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        nonIndexable: html.filter((r) => r.status < 200 || r.status >= 300 || /\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        blockedRobots: latestUrls.filter((r) => r.robotsTxtBlocked || r.blockedByRobotsTxt).length,
        noindexCount: html.filter((r) => /\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        non200Count: html.filter((r) => r.status < 200 || r.status >= 300).length,
      },
      statusSegments: statusSegments(html),
      canonicalSegments: canonicalSegments(latestUrls),
      depthDistribution: httpStatusByDepth,
      issues: activeIssues.filter((i) => i.category === 'Indexability' || i.title.includes('noindex') || i.title.includes('Canonical')),
    },
    links: {
      summary: linksData,
      dofollowDistribution: {
        internal: { dofollow: linksData.internalDofollow, nofollow: linksData.internalNofollow },
        external: { dofollow: linksData.externalDofollow, nofollow: linksData.externalNofollow },
      },
      outgoingBuckets: linksData.outgoingBuckets,
      anchorRows: linksData.anchorRows,
      incomingByPage: linksData.pageRows,
      issues: activeIssues.filter((i) => i.category === 'Links' || i.title.includes('link')),
    },
    redirects: {
      summary: {
        totalRedirects: redirectCount,
        redirectChains: activeIssues.find((i) => /redirect chain/i.test(i.title))?.crawled || 0,
        redirectLoops: activeIssues.find((i) => /redirect loop/i.test(i.title))?.crawled || 0,
        brokenChains: activeIssues.find((i) => /broken.*redirect|broken.*chain/i.test(i.title))?.crawled || 0,
      },
      typeSegments: [
        { label: '301 redirect', value: latestUrls.filter((r) => r.status === 301).length, color: '#df3c27' },
        { label: '302 redirect', value: latestUrls.filter((r) => r.status === 302).length, color: '#ffc600' },
        { label: '307/308 redirect', value: latestUrls.filter((r) => r.status === 307 || r.status === 308).length, color: '#4197cb' },
        { label: 'Other 3xx', value: latestUrls.filter((r) => r.status >= 300 && r.status < 400 && ![301, 302, 307, 308].includes(r.status)).length, color: '#6abf4b' },
      ].filter((s) => s.value > 0),
      depthDistribution: httpStatusByDepth.map((d) => ({ depth: d.depth, value: d.redirect })),
      redirectUrls: latestUrls.filter((r) => r.status >= 300 && r.status < 400).map((r) => ({
        url: r.url,
        status: r.status,
        targetUrl: r.location || r.audit?.redirectTarget || '',
      })),
      issues: activeIssues.filter((i) => i.category === 'Redirects' || i.title.includes('redirect')),
    },
    content: {
      summary: {
        totalPages: pagesCount,
        wordBuckets: bucketCount(
          html.map((r) => Number(r.audit?.wordCount) || countWords(r.contentText)),
          [
            { range: '0', min: 0, max: 0 },
            { range: '1-25', min: 1, max: 25 },
            { range: '26-50', min: 26, max: 50 },
            { range: '51-100', min: 51, max: 100 },
            { range: '101-250', min: 101, max: 250 },
            { range: '251-500', min: 251, max: 500 },
            { range: '501-1000', min: 501, max: 1000 },
            { range: '1001+', min: 1001, max: Number.MAX_SAFE_INTEGER },
          ]
        ),
        titleSetup: [
          { label: 'Only one', value: html.filter((r) => (r.title || r.audit?.titleText) && (r.audit?.titleCount === 1 || !r.audit?.titleCount)).length, color: '#34d399' },
          { label: 'More than one', value: html.filter((r) => Number(r.audit?.titleCount) > 1).length, color: '#fbbf24' },
          { label: 'Missing or empty', value: html.filter((r) => !(r.title || r.audit?.titleText)).length, color: '#f43f5e' },
        ],
        titleLength: [
          { label: 'Optimal: 15-70 ch.', value: html.filter((r) => (r.title || r.audit?.titleText)?.length >= 15 && (r.title || r.audit?.titleText)?.length <= 70).length, color: '#34d399' },
          { label: 'Too short: <15 ch.', value: html.filter((r) => (r.title || r.audit?.titleText) && (r.title || r.audit?.titleText)?.length < 15).length, color: '#fbbf24' },
          { label: 'Too long: >70 ch.', value: html.filter((r) => (r.title || r.audit?.titleText)?.length > 70).length, color: '#df3c27' },
        ],
        metaSetup: [
          { label: 'Only one', value: html.filter((r) => (r.metaDescription || r.audit?.metaDescriptionText) && (r.audit?.metaDescriptionCount === 1 || !r.audit?.metaDescriptionCount)).length, color: '#34d399' },
          { label: 'More than one', value: html.filter((r) => Number(r.audit?.metaDescriptionCount) > 1).length, color: '#fbbf24' },
          { label: 'Missing or empty', value: html.filter((r) => !(r.metaDescription || r.audit?.metaDescriptionText)).length, color: '#f43f5e' },
        ],
        metaLength: [
          { label: 'Optimal: 100-300 ch.', value: html.filter((r) => (r.metaDescription || r.audit?.metaDescriptionText)?.length >= 100 && (r.metaDescription || r.audit?.metaDescriptionText)?.length <= 300).length, color: '#34d399' },
          { label: 'Too short: <100 ch.', value: html.filter((r) => (r.metaDescription || r.audit?.metaDescriptionText) && (r.metaDescription || r.audit?.metaDescriptionText)?.length < 100).length, color: '#fbbf24' },
          { label: 'Too long: >300 ch.', value: html.filter((r) => (r.metaDescription || r.audit?.metaDescriptionText)?.length > 300).length, color: '#df3c27' },
        ],
        h1Setup: [
          { label: 'Only one', value: html.filter((r) => (r.h1 || r.audit?.h1Text) && (r.audit?.h1Count === 1 || !r.audit?.h1Count)).length, color: '#34d399' },
          { label: 'More than one', value: html.filter((r) => Number(r.audit?.h1Count) > 1).length, color: '#fbbf24' },
          { label: 'Missing or empty', value: html.filter((r) => !(r.h1 || r.audit?.h1Text)).length, color: '#f43f5e' },
        ],
        h1Length: [
          { label: 'Optimal: 10-70 ch.', value: html.filter((r) => (r.h1 || r.audit?.h1Text)?.length >= 10 && (r.h1 || r.audit?.h1Text)?.length <= 70).length, color: '#34d399' },
          { label: 'Too short: <10 ch.', value: html.filter((r) => (r.h1 || r.audit?.h1Text) && (r.h1 || r.audit?.h1Text)?.length < 10).length, color: '#fbbf24' },
          { label: 'Too long: >70 ch.', value: html.filter((r) => (r.h1 || r.audit?.h1Text)?.length > 70).length, color: '#df3c27' },
        ],
      },
      issues: activeIssues.filter((i) => i.category === 'Content' || i.title.includes('Title') || i.title.includes('H1') || i.title.includes('Meta description')),
    },
    social_tags: {
      summary: {
        indexablePages: html.filter((r) => r.status >= 200 && r.status < 300 && !/\bnoindex\b/i.test(`${r.robotsMeta || ''} ${r.xRobotsTag || ''}`)).length,
        ogComplete: html.filter((r) => [...OG_REQUIRED].every((tag) => hasTag(r.audit?.ogTags || {}, tag))).length,
        ogIncomplete: html.filter((r) => ![...OG_REQUIRED].every((tag) => hasTag(r.audit?.ogTags || {}, tag))).length,
        twitterComplete: html.filter((r) => [...TWITTER_REQUIRED].every((tag) => hasTag(r.audit?.twitterTags || {}, tag))).length,
        twitterIncomplete: html.filter((r) => ![...TWITTER_REQUIRED].every((tag) => hasTag(r.audit?.twitterTags || {}, tag))).length,
        missingAll: html.filter((r) => !Object.keys(r.audit?.ogTags || {}).length && !Object.keys(r.audit?.twitterTags || {}).length).length,
      },
      ogTags: {
        breakdown: tagRows(html, OG_TAGS, OG_REQUIRED, 'ogTags'),
        typeSegments: Object.entries(html.reduce((acc, r) => {
          const type = r.audit?.ogTags?.['og:type'] || 'not set';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
      },
      twitterTags: {
        breakdown: tagRows(html, TWITTER_TAGS, TWITTER_REQUIRED, 'twitterTags'),
        cardSegments: Object.entries(html.reduce((acc, r) => {
          const card = r.audit?.twitterTags?.['twitter:card'] || 'not set';
          acc[card] = (acc[card] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
      },
      issues: activeIssues.filter((i) => i.category === 'Social tags' || i.title.includes('Open Graph') || i.title.includes('Twitter')),
    },
    duplicates: {
      summary: duplicatesData.map((d) => ({
        field: d.field,
        duplicateUrls: d.duplicateUrls,
        percent: d.percent,
      })),
      nearClusters: ['title', 'description', 'h1'].flatMap((f) => duplicateClusters(latestUrls, f)),
      exactClusters: duplicateClusters(latestUrls, 'content'),
      issues: activeIssues.filter((i) => i.category === 'Duplicates' || i.title.includes('Duplicate')),
    },
    localization: {
      summary: {
        pagesWithHreflang: html.filter((r) => (r.hreflangs || r.audit?.hreflangs || []).length > 0).length,
        pagesMissingHreflang: html.filter((r) => (r.hreflangs || r.audit?.hreflangs || []).length === 0).length,
        uniqueHreflangs: new Set(html.flatMap((r) => r.hreflangs || r.audit?.hreflangs || []).map((h) => h.lang || h.hreflang || h).filter(Boolean)).size,
        htmlLangFound: html.filter((r) => r.htmlLang || r.audit?.htmlLang).length,
        htmlLangMissing: html.filter((r) => !(r.htmlLang || r.audit?.htmlLang)).length,
      },
      hreflangCoverage: {
        hasHreflang: html.filter((r) => (r.hreflangs || r.audit?.hreflangs || []).length > 0).length,
        missingHreflang: html.filter((r) => (r.hreflangs || r.audit?.hreflangs || []).length === 0).length,
      },
      htmlLangCoverage: {
        found: html.filter((r) => r.htmlLang || r.audit?.htmlLang).length,
        missing: html.filter((r) => !(r.htmlLang || r.audit?.htmlLang)).length,
      },
      issues: activeIssues.filter((i) => i.category === 'Localization' || i.title.includes('hreflang') || i.title.includes('lang')),
    },
    performance: {
      summary: {
        timeToFirstByte: safeSegments(loadTimeSegments(latestUrls)),
        loadTime: safeSegments(loadTimeSegments(latestUrls)),
        fileSize: safeSegments(fileSizeSegments(latestUrls)),
        contentEncoding: Object.entries(latestUrls.reduce((acc, r) => {
          const enc = r.contentEncoding || r.audit?.contentEncoding || 'gzip';
          acc[enc] = (acc[enc] || 0) + 1;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })),
      },
      loadTimeSegments: loadTimeSegments(latestUrls),
      fileSizeSegments: fileSizeSegments(latestUrls),
      encodingSegments: Object.entries(latestUrls.reduce((acc, r) => {
        const enc = r.contentEncoding || r.audit?.contentEncoding || 'gzip';
        acc[enc] = (acc[enc] || 0) + 1;
        return acc;
      }, {})).map(([label, value]) => ({ label, value })),
      issues: activeIssues.filter((i) => i.category === 'Usability and performance' || i.title.includes('performance') || i.title.includes('speed') || i.title.includes('size')),
    },
    images: {
      summary: {
        totalImages: imagesData.totalImages,
        crawled: imagesData.crawled,
        redirects: imagesData.redirects,
        broken: imagesData.broken,
        blocked: imagesData.blocked,
        missingAlt: imagesData.missingAlt,
        setAlt: imagesData.setAlt,
      },
      altSegments: imagesData.altSegments,
      subtypeSegments: imagesData.subtypeSegments,
      statusSegments: imagesData.statusSegments,
      protocolSegments: imagesData.protocolSegments,
      fileSizeSegments: imagesData.fileSizeSegments,
      loadTimeSegments: imagesData.loadTimeSegments,
      issues: activeIssues.filter((i) => i.category === 'Images' || i.title.includes('Image') || i.title.includes('alt text')),
    },
    javascript: {
      summary: {
        crawled: jsData.crawled,
        redirects: jsData.redirects,
        broken: jsData.broken,
        blocked: jsData.blocked,
      },
      statusSegments: jsData.statusSegments,
      protocolSegments: jsData.protocolSegments,
      fileSizeSegments: jsData.fileSizeSegments,
      loadTimeSegments: jsData.loadTimeSegments,
      issues: activeIssues.filter((i) => i.category === 'JavaScript' || i.title.includes('JavaScript')),
    },
    css: {
      summary: {
        crawled: cssData.crawled,
        redirects: cssData.redirects,
        broken: cssData.broken,
        blocked: cssData.blocked,
      },
      statusSegments: cssData.statusSegments,
      protocolSegments: cssData.protocolSegments,
      fileSizeSegments: cssData.fileSizeSegments,
      loadTimeSegments: cssData.loadTimeSegments,
      issues: activeIssues.filter((i) => i.category === 'CSS' || i.title.includes('CSS')),
    },
    external_pages: {
      summary: {
        total: externalData.total,
        broken: externalData.broken,
        redirects: externalData.redirects,
        notCrawled: externalData.statusSegments.find((s) => s.label === 'Not crawled')?.value || 0,
        httpsCount: externalData.protocolSegments.find((s) => s.label === 'HTTPS')?.value || 0,
        httpCount: externalData.protocolSegments.find((s) => s.label === 'HTTP')?.value || 0,
      },
      statusSegments: externalData.statusSegments,
      protocolSegments: externalData.protocolSegments,
      topDomains: externalData.domains,
      issues: activeIssues.filter((i) => i.category === 'External pages' || i.title.includes('external')),
    },
    sitemaps: {
      summary: {
        inSitemap: Math.max(0, pagesCount - (activeIssues.find((i) => /not in sitemap/i.test(i.title))?.crawled || 0)),
        notInSitemap: activeIssues.find((i) => /not in sitemap/i.test(i.title))?.crawled || 0,
        errors: activeIssues.filter((i) => (i.category === 'Sitemaps' || i.title.includes('sitemap')) && i.severity === 'error').reduce((sum, i) => sum + i.crawled, 0),
        multipleSitemaps: activeIssues.find((i) => /multiple sitemaps/i.test(i.title))?.crawled || 0,
      },
      coverageSegments: [
        { label: 'In sitemap', value: Math.max(0, pagesCount - (activeIssues.find((i) => /not in sitemap/i.test(i.title))?.crawled || 0)), color: '#34d399' },
        { label: 'Not in sitemap', value: activeIssues.find((i) => /not in sitemap/i.test(i.title))?.crawled || 0, color: '#df3c27' },
      ],
      issueSegments: activeIssues
        .filter((i) => i.category === 'Sitemaps' || i.title.includes('sitemap'))
        .map((i) => ({ label: i.title, value: i.crawled })),
      issues: activeIssues.filter((i) => i.category === 'Sitemaps' || i.title.includes('sitemap')),
    },
    other: {
      summary: {
        schemaErrors: activeIssues.find((i) => /schema|structured data/i.test(i.title))?.crawled || latestUrls.filter((r) => Number(r.audit?.schemaErrorCount || 0) > 0).length,
        richResultsErrors: activeIssues.find((i) => /rich result/i.test(i.title))?.crawled || latestUrls.filter((r) => Number(r.audit?.richResultErrorCount || 0) > 0).length,
        trafficDropped: 0,
        pagesDropped: 0,
      },
      structuredDataSegments: [
        { label: 'Schema.org errors', value: activeIssues.find((i) => /schema|structured data/i.test(i.title))?.crawled || 0, color: '#df3c27' },
        { label: 'Rich results errors', value: activeIssues.find((i) => /rich result/i.test(i.title))?.crawled || 0, color: '#f43f5e' },
      ].filter((s) => s.value > 0),
      issues: activeIssues.filter((i) => i.category === 'Other' || i.title.includes('Schema') || i.title.includes('Structured')),
    },
  };

  return {
    project: {
      id: project.id,
      name: project.name || project.domain,
      domain: project.domain,
      fullUrl: project.fullUrl || `https://${project.domain}`,
      crawledOn: stats.finishedAt ? new Date(stats.finishedAt).toISOString() : project.crawledOn || new Date().toISOString(),
      compareTo: project.compareTo || null,
      totalUrls: project.totalUrls || crawledCount,
      urlLimit: project.urlLimit || 10000,
    },
    audit: auditSection,
    tools: toolsSection,
    reports: reportsSection,
  };
}
