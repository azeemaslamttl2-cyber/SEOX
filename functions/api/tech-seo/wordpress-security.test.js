import test from 'node:test';
import assert from 'node:assert/strict';

import { projectSiteUrl, resolveTargetUrl } from './wordpress-security.js';

// The row as `user_projects` stores it. The website URL lives in the columns,
// not in the project_data blob, which is what made a project with a perfectly
// good URL report that it had none.
const row = (overrides = {}) => ({
  project_id: 'proj_1788773954218',
  project_name: 'Zero Carbon',
  domain: 'stg-zerocarbon-staging.kinsta.cloud',
  full_url: 'https://stg-zerocarbon-staging.kinsta.cloud',
  project_data: '{}',
  ...overrides,
});

test('the website URL comes from the project row the selector points at', () => {
  assert.equal(
    projectSiteUrl(row()),
    'https://stg-zerocarbon-staging.kinsta.cloud/'
  );
});

test('a project_data blob without a URL does not hide the column that has one', () => {
  const stored = row({ project_data: JSON.stringify({ owner: 'someone', schedule: 'weekly' }) });
  assert.equal(projectSiteUrl(stored), 'https://stg-zerocarbon-staging.kinsta.cloud/');
  assert.doesNotThrow(() => resolveTargetUrl(stored));
});

test('the domain column carries the project when full_url was never filled in', () => {
  assert.equal(projectSiteUrl(row({ full_url: '' })), 'https://stg-zerocarbon-staging.kinsta.cloud/');
  assert.equal(projectSiteUrl(row({ full_url: null })), 'https://stg-zerocarbon-staging.kinsta.cloud/');
});

test('a URL kept in project_data by an older release is still found', () => {
  const stored = row({
    full_url: '',
    domain: '',
    project_data: JSON.stringify({ fullUrl: 'https://example.com/shop' }),
  });
  assert.equal(projectSiteUrl(stored), 'https://example.com/shop');
});

test('the configured protocol and port are kept as they are', () => {
  assert.equal(projectSiteUrl(row({ full_url: 'http://example.com' })), 'http://example.com/');
  assert.equal(projectSiteUrl(row({ full_url: 'https://example.com:8443/site' })), 'https://example.com:8443/site');
});

test('only a project that genuinely has no URL reports that it has none', () => {
  const empty = row({ full_url: '', domain: '', project_data: '{}' });
  assert.equal(projectSiteUrl(empty), null);
  assert.throws(() => resolveTargetUrl(empty), (error) => {
    assert.equal(error.status, 400);
    assert.match(error.message, /no website URL/);
    return true;
  });
});

test('the URL the page sends is used when it is the project\'s own site', () => {
  assert.equal(
    resolveTargetUrl(row(), 'https://stg-zerocarbon-staging.kinsta.cloud/'),
    'https://stg-zerocarbon-staging.kinsta.cloud/'
  );
  // www is the same site as far as the project is concerned.
  assert.equal(
    resolveTargetUrl(row(), 'https://www.stg-zerocarbon-staging.kinsta.cloud/'),
    'https://www.stg-zerocarbon-staging.kinsta.cloud/'
  );
});

test('a URL for a different host is refused, so the scan cannot be aimed elsewhere', () => {
  assert.throws(() => resolveTargetUrl(row(), 'https://someone-else.example/'), (error) => {
    assert.equal(error.status, 403);
    assert.match(error.message, /does not match this project/);
    return true;
  });
});

test('an empty URL from the page falls back to the project record', () => {
  assert.equal(resolveTargetUrl(row(), ''), 'https://stg-zerocarbon-staging.kinsta.cloud/');
  assert.equal(resolveTargetUrl(row(), undefined), 'https://stg-zerocarbon-staging.kinsta.cloud/');
});
