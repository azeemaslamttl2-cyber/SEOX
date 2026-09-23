import {
  AlertTriangle,
  Ban,
  CloudOff,
  KeyRound,
  Link2Off,
  PlugZap,
  SearchX,
  ServerCrash,
  Ticket,
} from 'lucide-react';

/**
 * How each server-side state is explained to the user.
 *
 * *** THE POINT OF THIS FILE ***
 * Before it, every one of these outcomes reached the screen as "No Jira
 * tickets found" - a project that was never connected looked exactly like a
 * project whose backlog is genuinely clear. Each state now has its own
 * heading, its own explanation, and where there is one, the single action
 * that fixes it.
 *
 * `tone: 'error'` means SEOX could not get an answer. `tone: 'empty'` means
 * it did, and the answer was zero. Only the second may ever be phrased as
 * "no tickets".
 */

const SETTINGS_JIRA = '/settings/general?tab=jira';

export const STATE_PRESENTATION = Object.freeze({
  OK: {
    tone: 'empty',
    icon: Ticket,
    title: 'No Jira tickets found for this project',
    // Deliberately says what was checked. "No tickets" on its own is the
    // sentence that hid this bug for as long as it did.
    detail: (s) =>
      s?.jira?.project_key
        ? `SEOX queried Jira project ${s.jira.project_key} successfully and it returned no matching issues. Try the "All" view if you are filtering by status.`
        : 'Jira was queried successfully and returned no matching issues.',
    action: null,
  },

  PROJECT_NOT_FOUND: {
    tone: 'error',
    icon: SearchX,
    title: 'SEOX project not found',
    detail: () =>
      'The selected project could not be found for this admin token. It may have been deleted, or the token may belong to a different account.',
    action: { label: 'Open projects', href: '/projects' },
  },

  JIRA_NOT_CONFIGURED: {
    tone: 'error',
    icon: PlugZap,
    title: 'Jira is not connected for this project',
    detail: (s) =>
      s?.message ||
      'This SEOX project has no Jira connection, so there is nothing to retrieve tickets from.',
    action: { label: 'Connect Jira', href: SETTINGS_JIRA },
  },

  JIRA_PROJECT_MAPPING_MISSING: {
    tone: 'error',
    icon: Link2Off,
    title: 'No Jira project is mapped',
    detail: (s) =>
      s?.message ||
      'Jira is connected, but this SEOX project is not mapped to a Jira project yet, so SEOX does not know which board to read.',
    action: { label: 'Map a Jira project', href: SETTINGS_JIRA },
  },

  // Reading is broader than writing: the page lists every Jira project the
  // credential can see, but SEOX only CHANGES issues in a board the user has
  // mapped. This is that boundary, said out loud.
  JIRA_PROJECT_NOT_MAPPED: {
    tone: 'error',
    icon: Link2Off,
    title: 'This Jira project is not mapped to a SEOX project',
    detail: (s) =>
      s?.message ||
      'SEOX can show this board’s tickets, but will not change them until the Jira project is mapped to a SEOX project.',
    action: { label: 'Map this Jira project', href: SETTINGS_JIRA },
  },

  JIRA_PROJECT_KEY_MISSING: {
    tone: 'error',
    icon: Link2Off,
    title: 'The Jira mapping has no project key',
    detail: (s) =>
      s?.message ||
      'This SEOX project is mapped to Jira, but the mapping is missing its Jira project key. Re-saving the mapping will repair it.',
    action: { label: 'Fix the mapping', href: SETTINGS_JIRA },
  },

  JIRA_AUTHENTICATION_FAILED: {
    tone: 'error',
    icon: KeyRound,
    title: 'Jira authentication failed',
    detail: (s) =>
      s?.message ||
      'Jira rejected the stored credentials. An API token that has been revoked or has expired is the usual cause.',
    action: { label: 'Reconnect Jira', href: SETTINGS_JIRA },
  },

  JIRA_PROJECT_NOT_FOUND: {
    tone: 'error',
    icon: SearchX,
    title: 'The mapped Jira project could not be found',
    detail: (s) =>
      s?.message ||
      'Jira does not recognise the mapped project key, or the connected Jira account cannot see that project.',
    action: { label: 'Check the mapping', href: SETTINGS_JIRA },
  },

  JIRA_PERMISSION_DENIED: {
    tone: 'error',
    icon: Ban,
    title: 'Jira permission denied',
    detail: (s) =>
      s?.message ||
      'The connected Jira account does not have permission to browse issues in this Jira project. A Jira administrator needs to grant it the Browse Projects permission.',
    action: { label: 'Review the connection', href: SETTINGS_JIRA },
  },

  JIRA_API_UNAVAILABLE: {
    tone: 'error',
    icon: CloudOff,
    title: 'Unable to connect to Jira',
    detail: (s) => {
      const base = s?.message || 'Jira could not be reached.';
      return s?.retry_after_seconds
        ? `${base} Try again in about ${Math.ceil(s.retry_after_seconds / 60)} minute(s).`
        : `${base} The rest of SEOX is unaffected.`;
    },
    action: null,
    retryable: true,
  },

  JIRA_API_ERROR: {
    tone: 'error',
    icon: ServerCrash,
    title: 'Jira returned an unexpected response',
    detail: (s) => s?.message || 'Jira responded, but not in a way SEOX could use.',
    action: null,
    retryable: true,
  },

  // Client-side, not from the server.

  // The Jira project shown on /jira/tickets is the one mapped to the project
  // chosen in the top project selector. These three states are that lookup
  // failing, and each says which link of the chain gave way - the selector,
  // the mapping read, or the mapped board itself.
  SEOX_PROJECT_NOT_SELECTED: {
    tone: 'error',
    icon: SearchX,
    title: 'No project is selected',
    detail: (s) =>
      s?.message ||
      'Choose a project in the selector at the top of the page. The Jira board shown here is the one that project is mapped to.',
    action: { label: 'Open projects', href: '/projects' },
  },

  JIRA_MAPPING_UNREADABLE: {
    tone: 'error',
    icon: ServerCrash,
    title: 'The Jira mapping could not be read',
    detail: (s) =>
      s?.message ||
      'SEOX could not read which Jira project this project is mapped to, so it will not guess at a board.',
    action: null,
    retryable: true,
  },

  // The board list came back incomplete, so nothing can be concluded from a
  // board's absence. Retryable, because a second walk usually finishes.
  JIRA_PROJECT_LIST_INCOMPLETE: {
    tone: 'error',
    icon: ServerCrash,
    title: 'The Jira project list is incomplete',
    detail: (s) =>
      s?.message ||
      'SEOX could not list every Jira project this account can see, so it cannot confirm which board this project is mapped to.',
    action: null,
    retryable: true,
  },

  // The mapping names a Jira project that is not in the list the credential
  // can see. Selecting a different board would show the wrong tickets under
  // the right project name, so nothing is selected at all.
  JIRA_MAPPED_PROJECT_UNAVAILABLE: {
    tone: 'error',
    icon: SearchX,
    title: 'The mapped Jira project is not available',
    detail: (s) =>
      s?.message ||
      'This project is mapped to a Jira project that the connected Jira account can no longer see. Re-map it in Settings.',
    action: { label: 'Check the mapping', href: SETTINGS_JIRA },
  },

  NETWORK_ERROR: {
    tone: 'error',
    icon: CloudOff,
    title: 'Could not reach SEOX',
    detail: () => 'The request did not get through. Check your connection and try again.',
    action: null,
    retryable: true,
  },

  NO_ADMIN_TOKEN: {
    tone: 'error',
    icon: KeyRound,
    title: 'An admin token is required',
    detail: () => 'The Jira ticket APIs authenticate with your SEOX admin token.',
    action: null,
  },
});

const FALLBACK = {
  tone: 'error',
  icon: AlertTriangle,
  title: 'Jira tickets could not be loaded',
  detail: (s) => s?.message || 'SEOX could not retrieve Jira tickets for this project.',
  action: null,
  retryable: true,
};

/** The presentation for a state object `{code, message, ...}`. */
export function presentState(state) {
  const preset = STATE_PRESENTATION[String(state?.code || '')] || FALLBACK;
  return {
    code: state?.code || 'UNKNOWN',
    tone: preset.tone,
    Icon: preset.icon,
    title: preset.title,
    detail: preset.detail(state),
    action: preset.action,
    retryable: Boolean(preset.retryable),
  };
}

/** True when the state means SEOX genuinely asked Jira and got an answer. */
export function isTrustworthy(state) {
  return state?.ok === true || state?.code === 'OK';
}
