import assert from 'node:assert/strict';
import test from 'node:test';

import { maskToken, tokenEncryptionAvailable } from './wpscan-token.js';

/* The DB-backed functions in this module need a live connection, so the tests
   here cover the parts that decide what a caller sees: how a token is masked
   for display, and whether the page may claim encryption at rest. */

test('a token is masked to its last four characters', () => {
  assert.equal(maskToken('abcdefghijklmnop'), '********mnop');
  // The mask never grows past eight stars, so a long token does not reveal
  // its length through the width of the placeholder.
  assert.equal(maskToken('a'.repeat(120)).length, 12);
});

test('a short or empty token never leaks its characters', () => {
  assert.equal(maskToken('abcd'), '****');
  assert.equal(maskToken('ab'), '**');
  assert.equal(maskToken(''), null);
  assert.equal(maskToken(null), null);
  assert.equal(maskToken(undefined), null);
});

test('surrounding whitespace is trimmed before masking', () => {
  assert.equal(maskToken('  abcdefghijklmnop\n'), '********mnop');
});

test('encryption is only claimed when a key is actually configured', () => {
  assert.equal(tokenEncryptionAvailable({ GBP_TOKEN_ENCRYPTION_KEY: 'x'.repeat(44) }), true);
  assert.equal(tokenEncryptionAvailable({ GBP_TOKEN_ENCRYPTION_KEY: '   ' }), false);
  assert.equal(tokenEncryptionAvailable({}), false);
  assert.equal(tokenEncryptionAvailable(null), false);
});
