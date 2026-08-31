import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBacklinksToolResult } from '../src/lib/backlinksPersistence.js';

test('buildBacklinksToolResult captures analysis state for persistence', () => {
  const payload = buildBacklinksToolResult({
    backlinks: [{ domain: 'example.com' }],
    fileName: 'sample.csv',
    csvFormat: 'url',
    nicheKeywords: 'seo, marketing',
    pasteInput: 'domain,dr',
    enabledChecks: { foreign: true },
    filter: 'critical',
  });

  assert.equal(payload.status, 'ready');
  assert.equal(payload.fileName, 'sample.csv');
  assert.equal(payload.csvFormat, 'url');
  assert.equal(payload.filter, 'critical');
  assert.equal(payload.backlinks[0].domain, 'example.com');
  assert.equal(payload.enabledChecks.foreign, true);
  assert.match(payload.updatedAt, /T/);
});
