// Turning a SEOX finding into a Jira issue payload.
//
// Jira Cloud REST v3 wants Atlassian Document Format for rich text, not wiki
// markup, so the description is built as an ADF document. Everything here is
// pure: the same finding always produces the same payload, which makes it
// directly testable and keeps the network code in jira-client.js.
//
// Two details that are easy to get wrong and expensive to miss:
//   - the "seox" label must always survive, because the webhook JQL filter
//     and the reconcile query both depend on it
//   - an auditor finding can carry up to 250 URLs (ISSUE_URL_LIMIT in
//     src/lib/auditIssues.js); a 250-item bullet list is unreadable and
//     oversized, so the rendered list is capped and the true total stated

import { describeCheck } from './jira-verification.js';
import { normalizeSeverity, resolvePriorityId } from './jira-status-map.js';

export const SUMMARY_MAX = 255;
export const SUMMARY_PREFIX = '[SEOX] ';
export const URL_RENDER_LIMIT = 50;
export const REQUIRED_LABEL = 'seox';

const SEVERITY_WORDS = {
  error: 'Error',
  warning: 'Warning',
  notice: 'Notice',
};

// --- ADF primitives --------------------------------------------------------

const text = (value) => ({ type: 'text', text: String(value ?? '') });

const strong = (value) => ({
  type: 'text',
  text: String(value ?? ''),
  marks: [{ type: 'strong' }],
});

const link = (value, href) => ({
  type: 'text',
  text: String(value ?? ''),
  marks: [{ type: 'link', attrs: { href } }],
});

const paragraph = (content) => ({
  type: 'paragraph',
  content: Array.isArray(content) ? content : [text(content)],
});

const heading = (value, level = 3) => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

const bulletList = (items) => ({
  type: 'bulletList',
  content: items.map((item) => ({
    type: 'listItem',
    content: [paragraph(Array.isArray(item) ? item : [text(item)])],
  })),
});

const codeBlock = (value) => ({
  type: 'codeBlock',
  attrs: {},
  content: [text(value)],
});

const rule = () => ({ type: 'rule' });

// --- Helpers ---------------------------------------------------------------

function truncate(value, max) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (raw.length <= max) return raw;
  const cut = raw.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}`;
    return path && path !== '/' ? path : url.hostname;
  } catch {
    return String(value || '');
  }
}

/** Jira rejects labels containing whitespace. */
export function sanitizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 60);
}

export function buildLabels({ sourceModule, severity, creationMode, extraLabels = [], mappingLabels = [] }) {
  const labels = new Set([REQUIRED_LABEL]);
  if (sourceModule) labels.add(sanitizeLabel(`seox-${sourceModule}`));
  if (severity) labels.add(sanitizeLabel(`seox-${normalizeSeverity(severity)}`));
  if (creationMode === 'auto') labels.add('seox-auto');
  for (const label of [...mappingLabels, ...extraLabels]) {
    const clean = sanitizeLabel(label);
    if (clean) labels.add(clean);
  }
  return [...labels].filter(Boolean);
}

export function buildSummary(finding) {
  const title = String(finding.title || finding.findingType || 'SEO issue').trim();
  const count = Number(finding.affectedUrlCount || 1);

  let scope = '';
  if (finding.scopeKind === 'site') scope = 'site-wide';
  else if (count > 1) scope = `${count} URLs`;
  else if (finding.url) scope = shortUrl(finding.url);

  const base = scope ? `${title} - ${scope}` : title;
  return `${SUMMARY_PREFIX}${truncate(base, SUMMARY_MAX - SUMMARY_PREFIX.length)}`;
}

// --- Description -----------------------------------------------------------

/**
 * @param {object} finding    the normalised finding (see jira-issue.js)
 * @param {object} options
 * @param {string} options.fingerprint
 * @param {object} [options.ai]           AI-generated fields, already capped
 * @param {object} [options.verification] the derived verification spec
 * @param {string} [options.appUrl]       for the deep link back into SEOX
 * @param {string} [options.projectName]
 */
export function buildDescriptionAdf(finding, options = {}) {
  const { fingerprint, ai, verification, appUrl, projectName } = options;
  const severity = normalizeSeverity(finding.severity);
  const content = [];

  // 1. What is wrong
  content.push(
    paragraph([
      strong(`${SEVERITY_WORDS[severity] || 'Issue'}: `),
      text(finding.title || finding.findingType),
    ])
  );
  if (ai?.technicalDescription) {
    content.push(paragraph(ai.technicalDescription));
  } else if (finding.description) {
    content.push(paragraph(finding.description));
  }

  // 2. Affected URLs
  const urls = Array.isArray(finding.urls) && finding.urls.length
    ? finding.urls
    : finding.url
      ? [finding.url]
      : [];
  if (urls.length) {
    content.push(heading('Affected URLs'));
    const shown = urls.slice(0, URL_RENDER_LIMIT);
    content.push(bulletList(shown.map((url) => [link(url, url)])));
    if (urls.length > shown.length) {
      content.push(
        paragraph(`…and ${urls.length - shown.length} more. The full list is in SEOX.`)
      );
    }
  }

  // 3/4. Current vs expected
  if (finding.currentValue || finding.expectedValue) {
    content.push(heading('Current and expected'));
    const rows = [];
    if (finding.currentValue) rows.push([strong('Current: '), text(finding.currentValue)]);
    if (finding.expectedValue) rows.push([strong('Expected: '), text(finding.expectedValue)]);
    content.push(bulletList(rows));
  }

  // 5. Root cause (AI only - SEOX cannot infer one)
  if (ai?.rootCause) {
    content.push(heading('Likely root cause'));
    content.push(paragraph(ai.rootCause));
  }

  // 6. Recommended fix
  const recommendation = ai?.recommendedFix || finding.recommendation;
  if (recommendation) {
    content.push(heading('Recommended fix'));
    content.push(paragraph(recommendation));
  }
  if (Array.isArray(ai?.developerInstructions) && ai.developerInstructions.length) {
    content.push(bulletList(ai.developerInstructions));
  }

  // 7. Acceptance criteria - from AI when available, otherwise derived from
  // the verification spec, which is exactly what SEOX will actually check.
  const acceptance = Array.isArray(ai?.acceptanceCriteria) && ai.acceptanceCriteria.length
    ? ai.acceptanceCriteria
    : (verification?.checks || []).map(describeCheck);
  if (acceptance.length) {
    content.push(heading('Acceptance criteria'));
    content.push(bulletList(acceptance));
  }

  // 8. SEO impact
  const impact = ai?.seoImpact || finding.seoImpact;
  if (impact) {
    content.push(heading('SEO impact'));
    content.push(paragraph(impact));
  }

  // 9. How this gets verified
  content.push(heading('How this will be verified'));
  if (verification && verification.kind !== 'manual') {
    content.push(
      paragraph(
        'When this issue is moved to a Done status, SEOX automatically re-checks the URL and either confirms the fix or reopens this issue with what it found.'
      )
    );
  } else {
    content.push(
      paragraph(
        verification?.reason ||
          'SEOX cannot check this one automatically. Re-run the relevant SEOX audit to confirm the fix.'
      )
    );
  }
  if (Array.isArray(ai?.testingInstructions) && ai.testingInstructions.length) {
    content.push(bulletList(ai.testingInstructions));
  }

  // 10. Evidence
  if (finding.evidence && Object.keys(finding.evidence).length) {
    content.push(heading('Evidence from the crawl'));
    content.push(
      bulletList(
        Object.entries(finding.evidence)
          .slice(0, 12)
          .map(([key, value]) => [strong(`${key}: `), text(formatEvidenceValue(value))])
      )
    );
  }

  // Source and fingerprint
  content.push(rule());
  const sourceBits = [];
  if (projectName) sourceBits.push(`Project: ${projectName}`);
  sourceBits.push(`Source: SEOX ${finding.sourceModule || 'auditor'}`);
  if (finding.crawledAt) sourceBits.push(`Detected: ${finding.crawledAt}`);
  content.push(paragraph(sourceBits.join('  •  ')));

  if (appUrl && finding.seoxPath) {
    const href = `${String(appUrl).replace(/\/+$/, '')}${finding.seoxPath}`;
    content.push(paragraph([link('Open this finding in SEOX', href)]));
  }
  if (ai) {
    content.push(
      paragraph(
        `Description drafted by SEOX AI${options.actorEmail ? ` and reviewed by ${options.actorEmail}` : ''}.`
      )
    );
  }
  content.push(paragraph([text('SEOX fingerprint (do not edit):')]));
  content.push(codeBlock(fingerprint || ''));

  return { type: 'doc', version: 1, content };
}

function formatEvidenceValue(value) {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) {
    return value.slice(0, 5).map(String).join(', ') + (value.length > 5 ? `, …(${value.length})` : '');
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 200);
  return String(value).slice(0, 300);
}

// --- The full create payload -----------------------------------------------

/**
 * Build the body for POST /rest/api/3/issue.
 *
 * Only fields SEOX actually owns are set. Notably absent: sprint, epic link,
 * due date and any custom field - those belong to the team.
 */
export function buildCreateIssuePayload({ finding, mapping, overrides = {}, fingerprint, ai, verification, appUrl, projectName, actorEmail, creationMode = 'manual' }) {
  const severity = normalizeSeverity(finding.severity);

  const fields = {
    project: { id: String(mapping.jiraProjectId) },
    issuetype: { id: String(overrides.issueTypeId || mapping.defaultIssueTypeId) },
    summary: overrides.summary
      ? truncate(String(overrides.summary), SUMMARY_MAX)
      : buildSummary(finding),
    description:
      overrides.descriptionAdf ||
      buildDescriptionAdf(finding, {
        fingerprint,
        ai,
        verification,
        appUrl,
        projectName,
        actorEmail,
      }),
    labels: buildLabels({
      sourceModule: finding.sourceModule,
      severity,
      creationMode,
      extraLabels: overrides.labels || [],
      mappingLabels: mapping.defaultLabels || [],
    }),
  };

  // Some Jira projects do not expose priority on the create screen at all;
  // the mapping records that so the field is simply omitted.
  if (mapping.prioritySupported !== false) {
    const priorityId = overrides.priorityId || resolvePriorityId(severity, mapping.severityPriorityMap, mapping.defaultPriorityId);
    if (priorityId) fields.priority = { id: String(priorityId) };
  }

  const assignee = overrides.assigneeAccountId ?? mapping.defaultAssigneeAccountId;
  if (assignee) fields.assignee = { id: String(assignee) };

  const components = overrides.components || mapping.components || [];
  if (Array.isArray(components) && components.length) {
    fields.components = components.map((id) => ({ id: String(id) }));
  }

  return { fields };
}

/** A short ADF document, for the comments SEOX posts back. */
export function buildCommentAdf(paragraphs) {
  return {
    type: 'doc',
    version: 1,
    content: (Array.isArray(paragraphs) ? paragraphs : [paragraphs])
      .filter(Boolean)
      .map((value) => (typeof value === 'string' ? paragraph(value) : value)),
  };
}

export function buildVerificationComment(result, { url, passed }) {
  const when = new Date(result.checkedAt || Date.now()).toISOString().slice(0, 10);

  if (passed) {
    return buildCommentAdf([
      paragraph([
        strong('SEOX verified this fix. '),
        text(`Re-checked ${url} on ${when} and the issue is no longer present.`),
      ]),
    ]);
  }

  const failed = (result.checks || []).filter((check) => !check.passed && !check.skipped);
  return buildCommentAdf([
    paragraph([
      strong('SEOX re-checked this and the issue is still present. '),
      text(`Checked ${url} on ${when}.`),
    ]),
    bulletList(
      failed.slice(0, 8).map((check) => [
        text(`Expected ${check.expected}; found ${check.actual}.`),
      ])
    ),
  ]);
}

export function buildRecurrenceComment({ url, when }) {
  return buildCommentAdf([
    paragraph([
      strong('SEOX detected this issue again. '),
      text(`Found at ${url} on ${when}.`),
    ]),
  ]);
}

/** Plain-text flattening of an ADF document, for displaying Jira comments. */
export function adfToPlainText(node, depth = 0) {
  if (!node || depth > 12) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((child) => adfToPlainText(child, depth + 1)).join('');
  if (node.type === 'text') return String(node.text || '');
  if (node.type === 'hardBreak' || node.type === 'rule') return '\n';
  const inner = adfToPlainText(node.content, depth + 1);
  if (['paragraph', 'heading', 'listItem', 'codeBlock'].includes(node.type)) return `${inner}\n`;
  return inner;
}
