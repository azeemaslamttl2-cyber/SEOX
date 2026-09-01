import { downloadProfessionalPdfReport, getPdfBranding, safePdfFilenamePart } from './professionalPdfReport.js';

const asArray = (value) => Array.isArray(value) ? value : [];
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const percent = (value, digits = 1) => `${number(value).toFixed(digits)}%`;
const dateStamp = (date = new Date()) => date.toISOString().slice(0, 10);
const scoreTone = (score) => score >= 90 ? 'success' : score >= 60 ? 'warning' : 'danger';
const scoreStatus = (score) => score >= 90 ? 'Strong' : score >= 60 ? 'Needs improvement' : 'Action required';
const capRows = (rows, limit = 150) => ({
    rows: rows.slice(0, limit),
    note: rows.length > limit ? `Showing the first ${limit.toLocaleString()} of ${rows.length.toLocaleString()} records. Export the companion CSV for the complete raw dataset.` : ''
});

const reportBranding = (userOrBranding) => userOrBranding?.name ? userOrBranding : getPdfBranding(userOrBranding);

export const buildRobotsPdfModel = ({ domain, analysisResults, user, generatedAt = new Date() }) => {
    const rules = Object.entries(analysisResults?.rules || {}).map(([id, rule]) => {
        const passed = rule.positive ? Boolean(rule.found) : !rule.found;
        const status = passed ? 'PASS' : rule.found ? 'ISSUE' : 'MISSING';
        return { id, ...rule, passed, status };
    });
    const total = number(analysisResults?.stats?.total, rules.filter(rule => rule.positive).length);
    const passed = number(analysisResults?.stats?.passed, rules.filter(rule => rule.positive && rule.found).length);
    const critical = number(analysisResults?.stats?.critical, rules.filter(rule => rule.found && rule.severity === 'critical').length);
    const score = total ? Math.round((passed / total) * 100) : 0;
    const priorities = rules.filter(rule => !rule.passed).sort((a, b) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low', 'info'].indexOf(b.severity)).slice(0, 12);

    return {
        title: 'Robots.txt Analysis Report',
        subtitle: 'Crawler access, directives, sitemap discovery, and robots.txt quality',
        target: domain,
        generatedAt,
        filename: `robots-analysis-${safePdfFilenamePart(domain, 'website')}-${dateStamp(generatedAt)}.pdf`,
        theme: [234, 88, 12],
        branding: reportBranding(user),
        score: { value: `${score}%`, label: 'Directive score', status: scoreStatus(score), tone: scoreTone(score) },
        summary: `The robots.txt file contains ${analysisResults?.lines || 0} lines. ${passed} of ${total} beneficial directives were confirmed, while ${critical} critical crawler-control issue${critical === 1 ? '' : 's'} require review.`,
        metrics: [
            { label: 'Passed checks', value: passed, tone: 'success' },
            { label: 'Needs action', value: priorities.length, tone: priorities.length ? 'danger' : 'success' },
            { label: 'Critical issues', value: critical, tone: critical ? 'danger' : 'success' },
            { label: 'File lines', value: analysisResults?.lines || 0, tone: 'info' }
        ],
        priorities: priorities.map(rule => ({ severity: rule.severity || 'Review', title: rule.name || rule.id, detail: rule.description || 'Review this robots.txt directive.' })),
        sections: [{
            title: 'Directive Review',
            description: 'Every configured rule is included. PASS means the observed state matches the expected crawler-control practice.',
            columns: ['Status', 'Directive / check', 'Severity', 'Evidence and guidance'],
            rows: rules.map(rule => [rule.status, rule.name || rule.id, rule.severity || 'info', rule.description || '-']),
            columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 2: { cellWidth: 20 }, 3: { cellWidth: 77 } }
        }],
        methodology: [
            'The report evaluates the retrieved robots.txt text against configured crawler-access and sitemap rules.',
            'A robots.txt directive controls crawler access but does not guarantee that a URL will be removed from a search index.',
            'Review critical directives before publishing changes because an overly broad Disallow rule can remove important pages from crawling.'
        ]
    };
};

export const buildCrawlPdfModel = ({ url, checkResults, user, generatedAt = new Date() }) => {
    const checks = Object.values(checkResults || {});
    const issues = checks.filter(check => check.found);
    const clean = checks.length - issues.length;
    const high = issues.filter(check => check.severity === 'high').length;
    const medium = issues.filter(check => check.severity === 'medium').length;
    const low = issues.filter(check => check.severity === 'low').length;
    const score = checks.length ? Math.round((clean / checks.length) * 100) : 0;
    const priorities = issues.sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity)).slice(0, 15);

    return {
        title: 'Crawl Optimization Report',
        subtitle: 'Technical crawl efficiency, metadata overhead, and source-code findings',
        target: url,
        generatedAt,
        filename: `crawl-optimization-${safePdfFilenamePart(url, 'website')}-${dateStamp(generatedAt)}.pdf`,
        theme: [124, 58, 237],
        branding: reportBranding(user),
        score: { value: `${score}%`, label: 'Crawl health', status: scoreStatus(score), tone: scoreTone(score) },
        summary: `${checks.length} crawl-efficiency checks were completed. ${clean} checks were clean and ${issues.length} issues were detected, including ${high} high-priority finding${high === 1 ? '' : 's'}.`,
        metrics: [
            { label: 'Clean checks', value: clean, tone: 'success' },
            { label: 'High priority', value: high, tone: high ? 'danger' : 'success' },
            { label: 'Medium priority', value: medium, tone: medium ? 'warning' : 'success' },
            { label: 'Low priority', value: low, tone: low ? 'info' : 'success' }
        ],
        priorities: priorities.map(check => ({ severity: check.severity, title: check.name, detail: `${check.description || 'Remove or correct the detected element.'}${check.count ? ` Detected ${check.count} time${check.count === 1 ? '' : 's'}.` : ''}` })),
        sections: [{
            title: 'Complete Crawl Checklist',
            description: 'The result table includes clean checks as well as detected issues and representative source matches.',
            columns: ['Status', 'Check', 'Severity', 'Count', 'Finding / evidence'],
            rows: checks.map(check => [check.found ? 'ISSUE' : 'PASS', check.name || check.id, check.severity || 'info', check.count || 0, [check.description, ...asArray(check.matches)].filter(Boolean).join(' | ')]),
            columnStyles: { 0: { cellWidth: 17, fontStyle: 'bold' }, 2: { cellWidth: 18 }, 3: { cellWidth: 13, halign: 'right' }, 4: { cellWidth: 74 } }
        }],
        methodology: [
            'The checker evaluates the fetched HTML source against crawl-optimization patterns configured in SemanticsX.',
            'Pattern matches indicate implementation signals, not guaranteed search-engine behavior. Validate important findings in the rendered page and server response.',
            'Run the report again after deployment to confirm that source-level issues were actually removed.'
        ]
    };
};

export const buildSpeedPdfModel = ({ url, results, user, generatedAt = new Date() }) => {
    const categories = Object.values(results?.categories || {});
    const checks = categories.flatMap(category => asArray(category.checks).map(check => ({ category: category.name, ...check })));
    const passed = checks.filter(check => check.passed).length;
    const issues = checks.filter(check => !check.passed && !check.isInfo);
    const infoChecks = checks.filter(check => check.isInfo);
    const mobileScore = number(results?.mobileScore);
    const desktopScore = number(results?.desktopScore);
    const overall = Math.round((mobileScore + desktopScore) / 2);
    const vitals = Object.entries(results?.coreWebVitals || {});
    const priorities = [
        ...asArray(results?.opportunities).map(item => ({ severity: item.score < 0.5 ? 'High' : 'Medium', title: item.title, detail: [item.displayValue, item.savings, item.description].filter(Boolean).join(' - ') })),
        ...issues.map(check => ({ severity: check.score < 0.5 ? 'High' : 'Medium', title: check.name, detail: [check.category, check.details, check.savings].filter(Boolean).join(' - ') }))
    ].slice(0, 15);

    return {
        title: 'Speed Optimization Report',
        subtitle: 'PageSpeed performance, Core Web Vitals, and implementation priorities',
        target: results?.analyzedUrl || url,
        generatedAt,
        filename: `speed-optimization-${safePdfFilenamePart(results?.analyzedUrl || url, 'website')}-${dateStamp(generatedAt)}.pdf`,
        theme: [249, 115, 22],
        branding: reportBranding(user),
        score: { value: `${overall}`, label: 'Average score', status: scoreStatus(overall), tone: scoreTone(overall) },
        summary: `Mobile performance scored ${mobileScore}/100 and desktop performance scored ${desktopScore}/100. ${passed} implementation checks passed, ${issues.length} require action, and ${infoChecks.length} are informational.`,
        metrics: [
            { label: 'Mobile score', value: mobileScore, tone: scoreTone(mobileScore) },
            { label: 'Desktop score', value: desktopScore, tone: scoreTone(desktopScore) },
            { label: 'Checks passed', value: passed, tone: 'success' },
            { label: 'Issues found', value: issues.length, tone: issues.length ? 'danger' : 'success' }
        ],
        priorities,
        sections: [
            {
                title: 'Core Web Vitals and Lab Metrics',
                description: 'Mobile and desktop values are shown side by side. Status is based on the mobile audit score supplied by PageSpeed Insights.',
                columns: ['Metric', 'Mobile', 'Desktop', 'Status'],
                rows: vitals.map(([key, vital]) => [key.toUpperCase(), vital.mobile || 'N/A', vital.desktop || 'N/A', number(vital.score) >= 0.9 ? 'GOOD' : number(vital.score) >= 0.5 ? 'IMPROVE' : 'POOR']),
                columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } }
            },
            ...categories.map(category => ({
                title: category.name || 'Optimization Checks',
                columns: ['Status', 'Check', 'Finding', 'Potential savings'],
                rows: asArray(category.checks).map(check => [check.isInfo ? 'INFO' : check.passed ? 'PASS' : 'ACTION', check.name, check.details || '-', check.savings || '-']),
                columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold' }, 1: { cellWidth: 48 }, 3: { cellWidth: 34 } }
            })),
            {
                title: 'Diagnostics',
                columns: ['Diagnostic', 'Observed value', 'Details'],
                rows: asArray(results?.diagnostics).map(item => [item.title, item.displayValue || '-', item.description || '-']),
                emptyMessage: 'No additional diagnostics were returned.'
            }
        ],
        methodology: [
            'Scores and lab metrics are based on the Google PageSpeed Insights response available at the time of the audit.',
            'Lab data can vary between runs because of network, device, server, and third-party conditions. Confirm improvements with multiple tests and field data where available.',
            'Treat the action plan as a prioritized engineering queue; validate each recommendation against the site architecture before deployment.'
        ]
    };
};

const searchValue = (row, key) => row?.[key] ?? row?.[`${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? 0;
const pageUrl = (page) => page?.displayUrl || page?.url || page?.keys?.[0] || '';
const queryText = (query) => query?.query || query?.Query || query?.keys?.[0] || '';
const changePercentLabel = (value) => String(value ?? 0).includes('%') ? String(value) : `${number(value).toFixed(0)}%`;

export const buildSearchPerformancePdfModel = ({ engine = 'Google Search Console', site, dateRange, performanceData, user, generatedAt = new Date() }) => {
    const isBing = /bing/i.test(engine);
    const ctrPercent = (value) => isBing ? number(value) : number(value) * 100;
    const totals = performanceData?.totals || {};
    const clicks = number(totals.clicks);
    const impressions = number(totals.impressions);
    const ctrValue = ctrPercent(totals.ctr);
    const position = number(totals.position ?? totals.avgPosition);
    const highPotential = asArray(performanceData?.highPotentialPages);
    const penalized = asArray(performanceData?.penalizedPages);
    const dead = asArray(performanceData?.deadPages);
    const ranked = asArray(performanceData?.rankedPages);
    const topQueries = asArray(performanceData?.topQueries);
    const topPages = asArray(performanceData?.topPages);
    const priorities = [
        ...penalized.slice(0, 8).map(page => ({ severity: 'High', title: `Recover declining page: ${pageUrl(page)}`, detail: page.change != null ? `Clicks changed by ${page.change} (${changePercentLabel(page.changePercent)}).` : `${page.clicks || 0} clicks from ${page.impressions || 0} impressions.` })),
        ...highPotential.slice(0, 8).map(page => ({ severity: 'Medium', title: `Improve CTR: ${pageUrl(page)}`, detail: `${page.impressions || 0} impressions, ${page.clicks || 0} clicks, ${percent(page.ctr == null ? ((page.clicks / Math.max(page.impressions, 1)) * 100) : ctrPercent(page.ctr))} CTR.` })),
        ...dead.slice(0, 5).map(page => ({ severity: 'Review', title: `Review inactive page: ${pageUrl(page)}`, detail: `${page.impressions || 0} impressions and ${page.clicks || 0} clicks in the selected period.` }))
    ].slice(0, 18);
    const reportTitle = isBing ? 'Bing Webmaster Performance Report' : 'Google Search Console Audit Report';
    const theme = isBing ? [0, 131, 116] : [37, 99, 235];

    return {
        title: reportTitle,
        subtitle: 'Organic search visibility, traffic, query performance, and page opportunities',
        target: site,
        period: `Last ${dateRange} days`,
        generatedAt,
        filename: `${isBing ? 'bing-webmaster' : 'gsc-audit'}-${safePdfFilenamePart(site, 'website')}-${dateStamp(generatedAt)}.pdf`,
        theme,
        branding: reportBranding(user),
        summary: `${site} generated ${clicks.toLocaleString()} clicks from ${impressions.toLocaleString()} impressions during the selected period, with ${percent(ctrValue)} CTR${position ? ` and an average position of ${position.toFixed(1)}` : ''}. The action plan highlights declining, low-CTR, and inactive pages.`,
        metrics: [
            { label: 'Clicks', value: clicks.toLocaleString(), tone: 'success' },
            { label: 'Impressions', value: impressions.toLocaleString(), tone: 'info' },
            { label: 'CTR', value: percent(ctrValue), tone: ctrValue >= 3 ? 'success' : 'warning' },
            { label: 'Avg. position', value: position ? position.toFixed(1) : 'N/A', tone: position && position <= 10 ? 'success' : 'warning' }
        ],
        priorities,
        sections: [
            {
                title: 'Top Queries',
                columns: ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
                rows: topQueries.slice(0, 100).map(query => {
                    const queryClicks = searchValue(query, 'clicks');
                    const queryImpressions = searchValue(query, 'impressions');
                    const queryCtr = query.ctr == null && query.CTR == null ? (queryClicks / Math.max(queryImpressions, 1)) * 100 : ctrPercent(query.ctr ?? query.CTR);
                    return [queryText(query), queryClicks, queryImpressions, percent(queryCtr), query.position == null && query.Position == null ? '-' : number(query.position ?? query.Position).toFixed(1)];
                }),
                emptyMessage: 'No query data was returned for this period.',
                note: topQueries.length > 100 ? `Showing the first 100 of ${topQueries.length} queries.` : ''
            },
            {
                title: 'Top Pages',
                columns: ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
                rows: topPages.slice(0, 100).map(page => [pageUrl(page), page.clicks || 0, page.impressions || 0, percent(page.ctr == null ? ((page.clicks || 0) / Math.max(page.impressions || 0, 1)) * 100 : ctrPercent(page.ctr)), page.position == null ? '-' : number(page.position).toFixed(1)]),
                emptyMessage: 'No page data was returned for this period.',
                note: topPages.length > 100 ? `Showing the first 100 of ${topPages.length} pages.` : ''
            },
            { title: 'High-Potential Pages', description: 'Pages with meaningful visibility but low click-through rate.', columns: ['Page', 'Impressions', 'Clicks', 'CTR'], rows: highPotential.map(page => [pageUrl(page), page.impressions || 0, page.clicks || 0, percent(page.ctr == null ? ((page.clicks / Math.max(page.impressions, 1)) * 100) : ctrPercent(page.ctr))]) },
            { title: 'Declining / Penalized Pages', description: 'Pages that lost traffic or were classified as declining by the audit.', columns: ['Page', 'Current clicks', 'Previous clicks', 'Change'], rows: penalized.map(page => [pageUrl(page), page.currentClicks ?? page.clicks ?? 0, page.prevClicks ?? '-', page.change != null ? `${page.change} (${changePercentLabel(page.changePercent)})` : percent(page.ctr)]) },
            { title: 'Growing Pages', columns: ['Page', 'Current clicks', 'Previous clicks', 'Change'], rows: ranked.map(page => [pageUrl(page), page.currentClicks ?? page.clicks ?? 0, page.prevClicks ?? '-', page.change != null ? `+${page.change} (${changePercentLabel(page.changePercent)})` : percent(page.ctr)]) },
            { title: 'Inactive / Dead Pages', columns: ['Page', 'Impressions', 'Clicks'], rows: dead.map(page => [pageUrl(page), page.impressions || 0, page.clicks || 0]) }
        ],
        methodology: [
            `Performance data is provided by ${engine} for the selected property and date range.`,
            'Search platform data can be delayed, sampled, anonymized, or rounded. Totals may not equal the sum of every visible row.',
            'Opportunity labels are prioritization heuristics. Review intent, seasonality, tracking changes, and page history before making major content decisions.'
        ]
    };
};

export const buildScreamingFrogPdfModel = ({ analysisResults, categories, checkedItems = {}, user, generatedAt = new Date() }) => {
    const categoryList = asArray(categories);
    const items = categoryList.flatMap(category => asArray(category.items).map(item => ({ category: category.name, ...item, result: analysisResults?.[item.id] || {} })));
    const affected = items.filter(item => number(item.result.count) > 0);
    const urlsAffected = affected.reduce((sum, item) => sum + number(item.result.count), 0);
    const completed = items.filter(item => checkedItems[item.id]).length;
    const score = items.length ? Math.round(((items.length - affected.length) / items.length) * 100) : 0;
    const detailed = capRows(affected.flatMap(item => {
        const urls = asArray(item.result.urls);
        if (!urls.length) return [[item.category, item.name, item.result.count || 0, '-', checkedItems[item.id] ? 'REVIEWED' : 'OPEN']];
        return urls.map(url => [item.category, item.name, 1, url, checkedItems[item.id] ? 'REVIEWED' : 'OPEN']);
    }), 300);

    return {
        title: 'Screaming Frog Audit Report',
        subtitle: 'Technical SEO checklist, affected URLs, and remediation tracking',
        target: 'Uploaded Screaming Frog crawl exports',
        generatedAt,
        filename: `screaming-frog-audit-${dateStamp(generatedAt)}.pdf`,
        theme: [5, 150, 105],
        branding: reportBranding(user),
        score: { value: `${score}%`, label: 'Technical health', status: scoreStatus(score), tone: scoreTone(score) },
        summary: `${items.length} technical checks across ${categoryList.length} categories were evaluated. ${affected.length} issue types affect ${urlsAffected.toLocaleString()} URL records, and ${completed} checklist items have been marked reviewed.`,
        metrics: [
            { label: 'Checks evaluated', value: items.length, tone: 'info' },
            { label: 'Issue types', value: affected.length, tone: affected.length ? 'danger' : 'success' },
            { label: 'Affected URLs', value: urlsAffected.toLocaleString(), tone: urlsAffected ? 'warning' : 'success' },
            { label: 'Marked reviewed', value: completed, tone: 'success' }
        ],
        priorities: affected.sort((a, b) => number(b.result.count) - number(a.result.count)).slice(0, 15).map(item => ({ severity: number(item.result.count) >= 50 ? 'High' : number(item.result.count) >= 10 ? 'Medium' : 'Review', title: item.name, detail: `${item.result.count} affected URL${number(item.result.count) === 1 ? '' : 's'} in ${item.category}.` })),
        sections: [
            ...categoryList.map(category => ({
                title: category.name,
                columns: ['Status', 'Check', 'Issues', 'Workflow'],
                rows: asArray(category.items).map(item => {
                    const result = analysisResults?.[item.id] || {};
                    return [number(result.count) ? 'ISSUE' : 'PASS', item.name, number(result.count), checkedItems[item.id] ? 'Reviewed' : 'Open'];
                })
            })),
            { title: 'Affected URL Evidence', description: 'Representative affected URLs grouped by technical issue.', columns: ['Category', 'Issue', 'Count', 'URL', 'Workflow'], rows: detailed.rows, note: detailed.note, columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 42 }, 2: { cellWidth: 13, halign: 'right' }, 4: { cellWidth: 18 } } }
        ],
        methodology: [
            'The report analyzes the uploaded Screaming Frog CSV exports and maps their rows to the SemanticsX technical audit checklist.',
            'Counts represent occurrences in the supplied exports. Missing or incomplete crawl files can reduce coverage.',
            'The Reviewed state is a workflow marker and does not independently confirm that a technical issue has been fixed on the live website.'
        ]
    };
};

export const buildBacklinksPdfModel = ({ backlinks, stats, excludedLinks, fileName, niche, advancedData = {}, user, generatedAt = new Date() }) => {
    const links = asArray(backlinks);
    const excluded = excludedLinks instanceof Set ? excludedLinks : new Set(asArray(excludedLinks));
    const flagged = links.filter(link => asArray(link.flags).length > 0);
    const clean = number(stats?.clean, links.length - flagged.length);
    const score = links.length ? Math.round((clean / links.length) * 100) : 0;
    const severity = link => {
        const levels = ['critical', 'high', 'medium', 'low', 'info'];
        return levels.find(level => asArray(link.flags).some(flag => flag.severity === level)) || 'clean';
    };
    const capped = capRows([...links].sort((a, b) => ['critical', 'high', 'medium', 'low', 'info', 'clean'].indexOf(severity(a)) - ['critical', 'high', 'medium', 'low', 'info', 'clean'].indexOf(severity(b))).map(link => [
        excluded.has(link.id) ? 'EXCLUDED' : severity(link).toUpperCase(),
        link.domain,
        link.dr ?? '-',
        link.backlinks ?? 1,
        asArray(link.flags).map(flag => flag.message).join('; ') || 'No configured issue detected',
        advancedData?.[link.id]?.aiSpamScore != null ? `${advancedData[link.id].aiSpamScore}%` : '-'
    ]), 300);

    return {
        title: 'Backlinks Audit Report',
        subtitle: 'Link profile health, spam signals, relevance, and disavow review',
        target: fileName || 'Uploaded backlink export',
        period: niche ? `Niche: ${niche}` : '',
        generatedAt,
        filename: `backlinks-audit-${dateStamp(generatedAt)}.pdf`,
        theme: [245, 158, 11],
        branding: reportBranding(user),
        score: { value: `${score}%`, label: 'Clean-link ratio', status: scoreStatus(score), tone: scoreTone(score) },
        summary: `${links.length.toLocaleString()} backlink records were reviewed. ${clean.toLocaleString()} were clean under the enabled checks, ${flagged.length.toLocaleString()} were flagged, and ${excluded.size.toLocaleString()} have been excluded from the disavow selection.`,
        metrics: [
            { label: 'Total links', value: links.length.toLocaleString(), tone: 'info' },
            { label: 'Clean links', value: clean.toLocaleString(), tone: 'success' },
            { label: 'Flagged links', value: flagged.length.toLocaleString(), tone: flagged.length ? 'danger' : 'success' },
            { label: 'Excluded', value: excluded.size.toLocaleString(), tone: 'warning' }
        ],
        priorities: flagged.slice(0, 15).map(link => ({ severity: severity(link), title: `Review ${link.domain}`, detail: asArray(link.flags).map(flag => flag.message).join('; ') })),
        sections: [
            { title: 'Risk Distribution', columns: ['Classification', 'Links'], rows: [['Spammy TLD / critical', stats?.critical || 0], ['Foreign-language / high', stats?.high || 0], ['Adult or gambling / medium', stats?.medium || 0], ['Irrelevant / low', stats?.low || 0], ['Low quality / info', stats?.info || 0], ['Clean', clean]] },
            { title: 'Backlink Evidence', description: 'Links are ordered from highest configured risk to clean. Exclusion means the link was removed from the current disavow selection.', columns: ['Status', 'Domain', 'AS/DR', 'Links', 'Detected signals', 'AI spam'], rows: capped.rows, note: capped.note, columnStyles: { 0: { cellWidth: 19, fontStyle: 'bold' }, 1: { cellWidth: 39 }, 2: { cellWidth: 15 }, 3: { cellWidth: 14 }, 5: { cellWidth: 17 } } }
        ],
        methodology: [
            'The report applies the backlink checks enabled in the tool to the uploaded Semrush or Ahrefs-compatible export.',
            'A flag is a review signal, not proof that a link is harmful. Manually assess context, traffic, ownership, and link intent before disavowing.',
            'The PDF is an audit record. Use the separate Disavow export to produce a search-engine submission file.'
        ]
    };
};

export const buildDuplicatePdfModel = ({ url, summary, results, skippedPages = [], user, generatedAt = new Date() }) => {
    const pages = asArray(results);
    const sorted = [...pages].sort((a, b) => number(b.matchPercent) - number(a.matchPercent));
    const duplicate = number(summary?.duplicatePercent);
    const common = number(summary?.commonPercent);
    const unique = number(summary?.uniquePercent);
    const score = Math.max(0, Math.min(100, unique));
    const capped = capRows(sorted.map(page => [page.url, page.title || '-', page.wordCount || 0, page.matchWords || 0, percent(page.matchPercent, 0), page.matchPages || 0, `${percent(page.duplicatePercent, 0)} / ${percent(page.commonPercent, 0)} / ${percent(page.uniquePercent, 0)}`]), 250);

    return {
        title: 'Duplicate Content Audit Report',
        subtitle: 'Site-wide internal duplication, shared content, and page-level evidence',
        target: url,
        generatedAt,
        filename: `duplicate-content-${safePdfFilenamePart(url, 'website')}-${dateStamp(generatedAt)}.pdf`,
        theme: [99, 102, 241],
        branding: reportBranding(user),
        score: { value: `${score}%`, label: 'Unique content', status: scoreStatus(score), tone: scoreTone(score) },
        summary: `${summary?.totalPages || pages.length} pages and ${number(summary?.totalWords).toLocaleString()} words were compared. The corpus is ${percent(duplicate, 0)} duplicate, ${percent(common, 0)} commonly shared, and ${percent(unique, 0)} unique.`,
        metrics: [
            { label: 'Duplicate content', value: percent(duplicate, 0), tone: duplicate > 20 ? 'danger' : duplicate > 5 ? 'warning' : 'success' },
            { label: 'Common content', value: percent(common, 0), tone: common > 30 ? 'warning' : 'info' },
            { label: 'Unique content', value: percent(unique, 0), tone: scoreTone(unique) },
            { label: 'Pages affected', value: summary?.pagesWithDuplicates || sorted.filter(page => number(page.matchPercent) > 0).length, tone: 'warning' }
        ],
        priorities: sorted.filter(page => number(page.matchPercent) > 0).slice(0, 15).map(page => ({ severity: number(page.matchPercent) >= 50 ? 'High' : number(page.matchPercent) >= 20 ? 'Medium' : 'Review', title: page.title || page.url, detail: `${percent(page.matchPercent, 0)} matched across ${page.matchPages || 0} page${page.matchPages === 1 ? '' : 's'} (${page.matchWords || 0} words).` })),
        sections: [
            { title: 'Page-Level Similarity', description: 'The content split column shows duplicate / common / unique percentages.', columns: ['Page URL', 'Title', 'Words', 'Matched', 'Match', 'Pages', 'Content split'], rows: capped.rows, note: capped.note, columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 34 }, 2: { cellWidth: 14 }, 3: { cellWidth: 14 }, 4: { cellWidth: 13 }, 5: { cellWidth: 13 } } },
            { title: 'Crawl Coverage', columns: ['Metric', 'Value'], rows: [['Average page size', `${summary?.avgPageSizeKB || 0} KB`], ['Average words per page', summary?.avgWordsPerPage || 0], ['Text-to-HTML ratio', percent(summary?.textToHtmlRatio, 0)], ['Internal links per page', summary?.internalLinksPerPage || 0], ['External links per page', summary?.externalLinksPerPage || 0], ['Average inbound links', summary?.avgInboundLinksPerPage || 0], ['Skipped pages', skippedPages.length]] }
        ],
        methodology: [
            'Crawled pages are normalized and compared for duplicate, commonly repeated, and unique text segments.',
            'Navigation, templates, legal text, and repeated calls to action can legitimately produce shared-content percentages.',
            'Investigate high-match pages for cannibalization, copied landing pages, or weak differentiation before consolidating or rewriting content.'
        ]
    };
};

export const buildPlagiarismPdfModel = ({ source, sourceTitle, results, user, generatedAt = new Date() }) => {
    const matches = asArray(results?.matches);
    const score = number(results?.overallScore);
    const uniqueScore = Math.max(0, 100 - score);
    const sourceLabel = source || sourceTitle || 'Pasted text';
    const capped = capRows(matches.map(match => [match.matchScore != null ? percent(match.matchScore, 0) : '-', match.title || '-', match.url || '-', asArray(match.matchedPhrases).length, asArray(match.matchedPhrases).join(' | ')]), 100);

    return {
        title: 'Plagiarism Analysis Report',
        subtitle: 'Web similarity signals, matching sources, and phrase-level evidence',
        target: sourceLabel,
        generatedAt,
        filename: `plagiarism-analysis-${safePdfFilenamePart(sourceTitle || source, 'content')}-${dateStamp(generatedAt)}.pdf`,
        theme: [220, 38, 38],
        branding: reportBranding(user),
        score: { value: `${uniqueScore}%`, label: 'Estimated uniqueness', status: uniqueScore >= 90 ? 'Low similarity' : uniqueScore >= 70 ? 'Review matches' : 'High similarity', tone: scoreTone(uniqueScore) },
        summary: `${number(results?.totalWordsChecked).toLocaleString()} words across ${number(results?.totalPhrases)} representative phrases were checked. ${number(results?.phrasesWithMatches)} phrases matched ${matches.length} potential source${matches.length === 1 ? '' : 's'}, with a maximum source match of ${percent(score, 0)}.`,
        metrics: [
            { label: 'Words checked', value: number(results?.totalWordsChecked).toLocaleString(), tone: 'info' },
            { label: 'Phrases checked', value: number(results?.totalPhrases), tone: 'info' },
            { label: 'Matched phrases', value: number(results?.phrasesWithMatches), tone: number(results?.phrasesWithMatches) ? 'warning' : 'success' },
            { label: 'Potential sources', value: matches.length, tone: matches.length ? 'danger' : 'success' }
        ],
        priorities: matches.slice(0, 15).map(match => ({ severity: number(match.matchScore) >= 60 ? 'High' : number(match.matchScore) >= 30 ? 'Medium' : 'Review', title: match.title || match.url, detail: `${percent(match.matchScore, 0)} match across ${asArray(match.matchedPhrases).length} phrase${asArray(match.matchedPhrases).length === 1 ? '' : 's'}: ${match.url}` })),
        sections: [{ title: 'Potential Source Evidence', description: 'Matched phrases are included in full so the report can be independently reviewed.', columns: ['Match', 'Source title', 'Source URL', 'Phrases', 'Matched phrase evidence'], rows: capped.rows, note: capped.note, emptyMessage: 'No matching web sources were detected.', columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 34 }, 2: { cellWidth: 48 }, 3: { cellWidth: 15 } } }],
        methodology: [
            'The tool searches representative phrases from the analyzed content and groups matching search results by source URL.',
            'The score is a similarity indicator, not a legal conclusion about authorship, copyright ownership, fair use, or plagiarism.',
            'Common phrases, citations, syndicated content, and earlier publication dates require manual review before taking action.'
        ]
    };
};

export const downloadRobotsPdf = options => downloadProfessionalPdfReport(buildRobotsPdfModel(options));
export const downloadCrawlPdf = options => downloadProfessionalPdfReport(buildCrawlPdfModel(options));
export const downloadSpeedPdf = options => downloadProfessionalPdfReport(buildSpeedPdfModel(options));
export const downloadSearchPerformancePdf = options => downloadProfessionalPdfReport(buildSearchPerformancePdfModel(options));
export const downloadScreamingFrogPdf = options => downloadProfessionalPdfReport(buildScreamingFrogPdfModel(options));
export const downloadBacklinksPdf = options => downloadProfessionalPdfReport(buildBacklinksPdfModel(options));
export const downloadDuplicatePdf = options => downloadProfessionalPdfReport(buildDuplicatePdfModel(options));
export const downloadPlagiarismPdf = options => downloadProfessionalPdfReport(buildPlagiarismPdfModel(options));
