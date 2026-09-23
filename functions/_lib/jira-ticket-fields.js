// Turning one Jira issue resource into the ticket object the UI renders.
//
// Everything here is shaping, not fetching: the caller has already asked Jira
// through jira-client.js / jira-search.js, and this module decides what of the
// answer crosses the wire. Three things make that less trivial than it sounds.
//
// 1. DESCRIPTIONS AND COMMENTS ARE NOT STRINGS. Jira REST v3 returns them as
//    ADF - Atlassian Document Format - a nested {type, content} tree. Handing
//    that to a browser that expects text renders "[object Object]", and
//    JSON.stringify renders the markup. flattenAdf() walks it into text.
//
// 2. SPRINT AND STORY POINTS HAVE NO FIXED FIELD ID. They are custom fields,
//    so they are `customfield_10020` on one Jira site and something else on
//    the next. Hardcoding the ids seen on one tenant is how an integration
//    silently returns null for every ticket on another, so they are
//    DISCOVERED from /rest/api/3/field by their schema type and cached.
//
// 3. A JIRA USER'S EMAIL IS THIRD-PARTY PERSONAL DATA. accountId and
//    displayName identify a person well enough to render an assignee column;
//    an email address is data about someone who never used SEOX, so it is not
//    read, not stored and not forwarded - the same rule readIssueFields() in
//    jira-status-map.js already follows. Most Jira sites do not return it at
//    all under their GDPR privacy setting, so code that depended on it would
//    be broken as often as not.
//
// No credential, authorization header or encrypted column can reach a caller
// through this module: it only ever reads `issue.fields`.

import { jiraRequestForConnection } from './jira-client.js';
import { toIso } from './jira-status-map.js';

/**
 * The fields /api/jira/tickets asks Jira for.
 *
 * Explicit, and in one place. The search API returns only id and key when
 * `fields` is omitted, which looks exactly like an issue whose fields are all
 * empty - so "forgot to list it" and "Jira has no value for it" become
 * indistinguishable. Listing them also keeps the payload to what is actually
 * rendered: `*all` on this tenant returns 42 populated fields per issue, most
 * of them time-tracking and plugin state nobody asked for.
 */
export const TICKET_FIELDS = [
  'summary',
  'description',
  'status',
  'resolution',
  'assignee',
  'reporter',
  'creator',
  'priority',
  'issuetype',
  'labels',
  'components',
  'fixVersions',
  'project',
  'parent',
  'duedate',
  'created',
  'updated',
  'comment',
  'attachment',
];

/** How many comments travel with a ticket in a LIST response. */
const MAX_COMMENTS = 5;
/** And how much of each one. Full threads belong in Jira, not in a table. */
const MAX_COMMENT_CHARS = 2000;
/** A description is shown in a detail panel, not stored; this is a guard. */
const MAX_DESCRIPTION_CHARS = 20000;

// --- Atlassian Document Format ---------------------------------------------

/**
 * ADF to plain text.
 *
 * Deliberately lossy and deliberately total: every node type Jira has now or
 * adds later is handled, because the fallback is "recurse into content and
 * ignore what you do not understand". A renderer that threw on an unknown
 * node would break a ticket list the first time somebody used a new macro.
 *
 * Hard limits on depth and length: ADF is user-authored and arbitrarily
 * nested, and this runs inside a request.
 */
export function flattenAdf(node, { maxChars = MAX_DESCRIPTION_CHARS } = {}) {
  if (node === null || node === undefined) return '';
  // Already text: a Jira site on the v2 API, or a field that was never ADF.
  if (typeof node === 'string') return node.slice(0, maxChars);

  const out = [];
  let budget = maxChars;

  const walk = (current, depth) => {
    if (budget <= 0 || depth > 24 || !current || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      for (const child of current) walk(child, depth + 1);
      return;
    }

    switch (current.type) {
      case 'text': {
        const text = String(current.text || '');
        out.push(text.slice(0, budget));
        budget -= text.length;
        return;
      }
      case 'hardBreak':
        out.push('\n');
        budget -= 1;
        return;
      case 'mention':
        // The rendered form of a mention is its display text, and that is
        // what a reader of the description expects to see.
        out.push(`@${current.attrs?.text?.replace(/^@/, '') || 'user'}`);
        return;
      case 'emoji':
        out.push(current.attrs?.text || current.attrs?.shortName || '');
        return;
      case 'inlineCard':
      case 'blockCard':
        out.push(current.attrs?.url || '');
        return;
      case 'rule':
        out.push('\n---\n');
        return;
      default:
        break;
    }

    walk(current.content, depth + 1);

    // Block-level nodes end a line, so paragraphs and list items do not run
    // together into one unreadable string. Paragraphs and headings are
    // separated by a BLANK line, the way they read in Jira; list items and
    // table rows by a single one, because a blank line between bullets is
    // not how a list looks anywhere.
    if (['paragraph', 'heading', 'blockquote', 'codeBlock', 'panel'].includes(current.type)) {
      out.push('\n\n');
      budget -= 2;
    } else if (['listItem', 'tableRow'].includes(current.type)) {
      out.push('\n');
      budget -= 1;
    }
  };

  walk(node, 0);

  return out
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

// --- small shapers ----------------------------------------------------------

/**
 * A Jira user, without their email address. See the header for why.
 *
 * Returns null rather than an empty object for an unassigned field, so the
 * UI can test `ticket.assignee` instead of `ticket.assignee.displayName`.
 */
export function describeUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    accountId: String(user.accountId || ''),
    displayName: user.displayName || '',
    avatarUrl: user.avatarUrls?.['48x48'] || user.avatarUrls?.['24x24'] || '',
    active: user.active !== false,
  };
}

function describeNamed(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: String(value.id || ''),
    name: value.name || '',
    ...(value.iconUrl ? { iconUrl: value.iconUrl } : {}),
  };
}

function describeStatus(status) {
  if (!status || typeof status !== 'object') return null;
  return {
    id: String(status.id || ''),
    name: status.name || '',
    // The KEY, not the display name: 'done' is stable across projects and
    // languages, "Done" is neither. Every resolved/open decision in SEOX is
    // made on this value.
    category: status.statusCategory?.key || '',
    categoryName: status.statusCategory?.name || '',
    categoryColor: status.statusCategory?.colorName || '',
  };
}

function describeIssueType(type) {
  if (!type || typeof type !== 'object') return null;
  return {
    id: String(type.id || ''),
    name: type.name || '',
    iconUrl: type.iconUrl || '',
    subtask: Boolean(type.subtask),
    hierarchyLevel: Number.isFinite(type.hierarchyLevel) ? type.hierarchyLevel : null,
  };
}

function describeComment(comment, baseUrl, issueKey) {
  if (!comment || typeof comment !== 'object') return null;
  return {
    id: String(comment.id || ''),
    author: describeUser(comment.author),
    body: flattenAdf(comment.body, { maxChars: MAX_COMMENT_CHARS }),
    created: toIso(comment.created),
    updated: toIso(comment.updated),
    // Deep link to the comment itself, so "3 comments" can be clicked.
    url: baseUrl && issueKey ? `${baseUrl}/browse/${issueKey}?focusedCommentId=${comment.id}` : '',
  };
}

/**
 * Attachment METADATA only.
 *
 * `content` is the authenticated download URL. Opening it requires the Jira
 * credential, which the browser does not have and must never be given, so it
 * is offered as a link the user follows while logged into Jira rather than as
 * something SEOX proxies.
 */
function describeAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  return {
    id: String(attachment.id || ''),
    filename: attachment.filename || '',
    mimeType: attachment.mimeType || '',
    size: Number(attachment.size || 0),
    author: describeUser(attachment.author),
    created: toIso(attachment.created),
    url: attachment.content || '',
    thumbnailUrl: attachment.thumbnail || '',
  };
}

// --- custom fields ----------------------------------------------------------

/**
 * Sprint and story points, found by schema rather than by id.
 *
 * Jira identifies a custom field by an id that is allocated per site, so
 * `customfield_10020` is Sprint on one tenant and "Request Type" on the next.
 * What IS stable is `schema.custom`, the plugin key that says what kind of
 * field it is - so that is what is matched. Story points have two well-known
 * keys because team-managed and company-managed projects use different
 * fields, and a site can have both.
 */
const SPRINT_SCHEMA = 'com.pyxis.greenhopper.jira:gh-sprint';
const STORY_POINT_SCHEMAS = [
  'com.pyxis.greenhopper.jira:jsw-story-points',
  'com.atlassian.jira.plugin.system.customfieldtypes:float',
];

const fieldCache = new Map();
const FIELD_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * @returns {Promise<{sprint: string, storyPoints: string[]}>} field ids, or
 *          empty when this site has no such field - which is normal, and must
 *          not be an error.
 */
export async function discoverTicketCustomFields(env, connection) {
  const key = String(connection?.id || '');
  const cached = fieldCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let fields = [];
  try {
    const { data } = await jiraRequestForConnection(env, connection, {
      path: '/rest/api/3/field',
      kind: 'interactive',
    });
    fields = Array.isArray(data) ? data : [];
  } catch (error) {
    // A ticket list without story points is still a ticket list. This lookup
    // must never be the reason the page fails to load.
    console.warn('Jira custom field discovery failed:', error?.message || error);
    return { sprint: '', storyPoints: [] };
  }

  const sprint = fields.find((field) => field?.schema?.custom === SPRINT_SCHEMA);
  const storyPoints = fields
    .filter(
      (field) =>
        STORY_POINT_SCHEMAS.includes(field?.schema?.custom) &&
        // The float schema is shared by every numeric custom field on the
        // site, so for that one the name has to agree too.
        (field.schema.custom !== STORY_POINT_SCHEMAS[1] || /story\s*point/i.test(field.name || ''))
    )
    .map((field) => String(field.id));

  const value = { sprint: sprint ? String(sprint.id) : '', storyPoints };
  if (fieldCache.size > 100) fieldCache.clear();
  fieldCache.set(key, { value, expiresAt: Date.now() + FIELD_CACHE_TTL_MS });
  return value;
}

/** The field ids to append to TICKET_FIELDS for this connection. */
export function customFieldIds(customFields) {
  return [customFields?.sprint || '', ...(customFields?.storyPoints || [])].filter(Boolean);
}

/**
 * Sprints, as the board shows them.
 *
 * The value is an array because an issue carries its whole sprint history,
 * closed ones included. The active or future one is what a reader means by
 * "which sprint is this in", so it is surfaced separately from the list.
 */
function describeSprints(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((sprint) => sprint && typeof sprint === 'object')
    .map((sprint) => ({
      id: String(sprint.id || ''),
      name: sprint.name || '',
      state: sprint.state || '',
      boardId: sprint.boardId ? String(sprint.boardId) : '',
      startDate: toIso(sprint.startDate),
      endDate: toIso(sprint.endDate),
    }));
}

function readStoryPoints(fields, customFields) {
  for (const id of customFields?.storyPoints || []) {
    const value = fields?.[id];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

// --- the ticket -------------------------------------------------------------

/**
 * One Jira issue as /api/jira/tickets returns it.
 *
 * `url` is built from the connection's own stored base URL - the same value
 * the user entered in Settings > Jira - so it is correct for whatever site
 * this project is connected to and is never a hardcoded domain. It is the
 * field the UI opens when a row is clicked, so it is present on every ticket
 * whether or not SEOX has ever touched the issue.
 *
 * @param {object} issue        a Jira issue resource
 * @param {object} options
 * @param {string} options.baseUrl       the connection's base URL
 * @param {object} [options.customFields] from discoverTicketCustomFields()
 * @param {object} [options.seox]        SEOX's own side, or null
 */
export function describeTicket(issue, { baseUrl = '', customFields = null, seox = null } = {}) {
  const fields = issue?.fields || {};
  const key = String(issue?.key || '');
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const commentContainer = fields.comment || {};
  const comments = Array.isArray(commentContainer.comments) ? commentContainer.comments : [];

  return {
    id: String(issue?.id || ''),
    key,
    // Every ticket carries a directly usable link. The frontend opens
    // `ticket.url` and needs to know nothing about Jira's URL scheme.
    url: base && key ? `${base}/browse/${key}` : '',
    self: '', // Jira's own API URL is deliberately not forwarded.

    summary: fields.summary || '',
    description: flattenAdf(fields.description),

    issueType: describeIssueType(fields.issuetype),
    status: describeStatus(fields.status),
    resolution: describeNamed(fields.resolution),
    priority: describeNamed(fields.priority),

    assignee: describeUser(fields.assignee),
    reporter: describeUser(fields.reporter),
    creator: describeUser(fields.creator),

    created: toIso(fields.created),
    updated: toIso(fields.updated),
    // A date, not a timestamp: Jira stores "2026-07-24" and adding a
    // midnight-UTC time to it would shift the day for half the world.
    dueDate: fields.duedate || null,

    labels: Array.isArray(fields.labels) ? fields.labels : [],
    components: Array.isArray(fields.components) ? fields.components.map(describeNamed).filter(Boolean) : [],
    fixVersions: Array.isArray(fields.fixVersions)
      ? fields.fixVersions.map((version) => ({
          id: String(version?.id || ''),
          name: version?.name || '',
          released: Boolean(version?.released),
          releaseDate: version?.releaseDate || null,
        }))
      : [],

    parent: fields.parent
      ? {
          id: String(fields.parent.id || ''),
          key: String(fields.parent.key || ''),
          summary: fields.parent.fields?.summary || '',
          url: base && fields.parent.key ? `${base}/browse/${fields.parent.key}` : '',
        }
      : null,

    project: fields.project
      ? {
          id: String(fields.project.id || ''),
          key: fields.project.key || '',
          name: fields.project.name || '',
          projectTypeKey: fields.project.projectTypeKey || '',
          avatarUrl: fields.project.avatarUrls?.['24x24'] || '',
        }
      : null,

    sprints: describeSprints(customFields?.sprint ? fields[customFields.sprint] : null),
    storyPoints: readStoryPoints(fields, customFields),

    comments: comments.slice(-MAX_COMMENTS).map((c) => describeComment(c, base, key)).filter(Boolean),
    // The count is Jira's own total, not the length of the slice above, so
    // "5 of 23" is honest rather than looking like the whole thread.
    commentCount: Number(commentContainer.total || comments.length || 0),

    attachments: Array.isArray(fields.attachment)
      ? fields.attachment.map(describeAttachment).filter(Boolean)
      : [],

    // Did SEOX file this ticket from an SEO finding? Null for the ones the
    // team raised by hand, which on a real board is most of them.
    createdBySeox: Boolean(seox),
    seox,
  };
}
