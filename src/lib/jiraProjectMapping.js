/**
 * Which Jira board the Jira Tickets page should show, given which SEOX
 * project the user has selected at the top of the app.
 *
 * *** WHY THIS IS A FUNCTION AND NOT AN EFFECT ***
 * The page used to pick `jiraProjects[0]`, so a SEOX project with no Jira
 * mapping - or one mapped to a board its credential can no longer see - was
 * shown an unrelated board's tickets under its own name. Replacing that with
 * "select the mapped one" is a small change in the happy case and an entirely
 * different question in every other: the answer depends on four asynchronous
 * sources, and getting it wrong in either direction is a lie on screen.
 *
 * So the decision is a pure function of the four, testable without React and
 * without a Jira account, and the component does nothing but apply it.
 *
 * *** THE MAPPING IS READ, NEVER INVENTED ***
 * `mappedJiraKey` comes from the mapping saved at /settings/general?tab=jira
 * (`jira_project_mappings.jira_project_key`, served by GET /api/jira/status).
 * Nothing here knows a Jira project id, key or name of its own, and no second
 * mapping mechanism exists to drift from the first.
 *
 * *** FOUR OUTCOMES, AND 'waiting' IS ONE OF THEM ***
 *   waiting  - at least one source has not answered. Say nothing yet.
 *   ready    - `key` is the mapped board, and it is selectable.
 *   blocked  - resolved, and there is no board to select. `state` says why,
 *              shaped like the server's own state objects so the page's
 *              existing renderer explains it.
 *
 * `waiting` is deliberately never folded into `blocked`. The project
 * inventory, the rehydrated selection, the mapping read and the Jira project
 * list all arrive separately; a verdict of "not mapped" before they have all
 * settled is what every page refresh would have hit.
 *
 * *** NOTHING IS EVER GUESSED ***
 * No branch returns a key that is not the mapped one. An unavailable mapping
 * produces `blocked`, not the nearest available board: showing project B's
 * tickets under project A's name is worse than showing none.
 */

/** A mapping read that has not answered yet - not a mapping that is absent. */
const PENDING_FETCH_STATUSES = new Set(['idle', 'loading']);

const waiting = () => ({ status: 'waiting', key: '', state: null });

const blocked = (code, message) => ({
  status: 'blocked',
  key: '',
  state: { ok: false, code, message },
});

/**
 * @param {object}  input
 * @param {boolean} input.projectSelectionSettled  project list AND the restored selection have both loaded
 * @param {string}  input.seoxProjectId            the selected SEOX project, '' when there is none
 * @param {string}  input.seoxProjectName          for the messages only
 * @param {string}  input.mappingFetchStatus       'idle'|'loading'|'refreshing'|'success'|'error'
 * @param {object}  [input.mappingError]           the failure behind an 'error' status
 * @param {boolean} input.jiraConnected            the project has a working Jira connection
 * @param {string}  input.mappedJiraKey            mapping.jiraProjectKey, '' when unmapped
 * @param {string}  [input.mappedJiraName]         mapping.jiraProjectName, for the messages only
 * @param {Array}   input.jiraProjects             the boards the credential can see
 * @param {object}  [input.jiraProjectsState]      that list's own state, null before it is fetched
 * @param {boolean} [input.jiraProjectsComplete]   false when the server could not list them all
 * @param {boolean} [input.loadingProjects]        that list is in flight
 * @returns {{status: 'waiting'|'ready'|'blocked', key: string, state: object|null}}
 */
export function resolveMappedJiraProject({
  projectSelectionSettled = false,
  seoxProjectId = '',
  seoxProjectName = '',
  mappingFetchStatus = 'idle',
  mappingError = null,
  jiraConnected = false,
  mappedJiraKey = '',
  mappedJiraName = '',
  jiraProjects = [],
  jiraProjectsState = null,
  jiraProjectsComplete = true,
  loadingProjects = false,
} = {}) {
  const projectLabel = seoxProjectName || 'this project';

  // A page refresh, or a direct visit to /jira/tickets, lands here first.
  if (!projectSelectionSettled) return waiting();

  if (!seoxProjectId) {
    return blocked(
      'SEOX_PROJECT_NOT_SELECTED',
      'No project is selected. Choose one in the selector at the top of the page and its mapped Jira board will load here.'
    );
  }

  if (PENDING_FETCH_STATUSES.has(mappingFetchStatus)) return waiting();

  if (mappingFetchStatus === 'error') {
    return blocked(
      'JIRA_MAPPING_UNREADABLE',
      mappingError?.message || `SEOX could not read the Jira mapping for ${projectLabel}.`
    );
  }

  // Connected is checked before mapped, so a project that never had Jira set
  // up is not told it is "missing a mapping" - it is missing the connection
  // the mapping would hang off, and that is a different screen to fix.
  if (!jiraConnected) {
    return blocked(
      'JIRA_NOT_CONFIGURED',
      `Jira is not connected for ${projectLabel}, so no Jira project is mapped to it.`
    );
  }

  if (!mappedJiraKey) {
    return blocked(
      'JIRA_PROJECT_MAPPING_MISSING',
      `No Jira project is mapped to ${projectLabel}. Map one in Settings > Jira and its tickets will appear here.`
    );
  }

  // A mapping exists. Whether the board behind it is reachable can only be
  // judged once the Jira project list has come back - until then this is
  // still `waiting`, never "unavailable".
  if (loadingProjects || !jiraProjectsState) return waiting();
  // The list failed outright. The page renders that failure on its own, and
  // it says nothing about whether the mapping is good - so this must not
  // convict the mapping of a problem the list is having.
  if (jiraProjectsState.ok === false) return waiting();

  const match = (Array.isArray(jiraProjects) ? jiraProjects : []).find(
    (entry) => entry?.key === mappedJiraKey
  );

  if (!match) {
    // *** ABSENT FROM A PARTIAL LIST IS NOT ABSENT FROM JIRA ***
    // The server walks Jira's pagination and reports whether it finished. If
    // it did not, a board missing from what came back proves nothing about
    // the mapping, and accusing the mapping would send the user to re-map a
    // project that is configured correctly.
    if (!jiraProjectsComplete) {
      return blocked(
        'JIRA_PROJECT_LIST_INCOMPLETE',
        `SEOX could not list every Jira project this account can see, and ${mappedJiraKey}${
          mappedJiraName ? ` (${mappedJiraName})` : ''
        } was not among the ones it did list. The mapping may well be fine - the list is not complete enough to tell.`
      );
    }

    return blocked(
      'JIRA_MAPPED_PROJECT_UNAVAILABLE',
      `${seoxProjectName || 'This project'} is mapped to Jira project ${mappedJiraKey}${
        mappedJiraName ? ` (${mappedJiraName})` : ''
      }, but that project is not among the ${
        (jiraProjects || []).length
      } the connected Jira account can see. It may have been deleted or archived, or the account may have lost access to it. Re-map it in Settings > Jira.`
    );
  }

  return { status: 'ready', key: match.key, state: null };
}
