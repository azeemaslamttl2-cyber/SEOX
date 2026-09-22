import test from 'node:test';
import assert from 'node:assert/strict';

import { safeReturnTo, signGbpState, verifyGbpState } from './gbp-state.js';

const ENV = { AUTH_JWT_SECRET: 'x'.repeat(48) };

test('a signed state round-trips its project and return path', async () => {
  const state = await signGbpState({ projectId: 'proj_1', returnTo: '/local-seo/gbp', userId: 7 }, ENV);
  const payload = await verifyGbpState(state, ENV, { userId: 7 });

  assert.equal(payload.projectId, 'proj_1');
  assert.equal(payload.returnTo, '/local-seo/gbp');
});

test('the payload stays readable by the browser, which needs the project id', async () => {
  const state = await signGbpState({ projectId: 'proj_1' }, ENV);
  const [, body] = state.split('.');
  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

  assert.equal(decoded.projectId, 'proj_1');
});

test('a forged state is rejected rather than trusted', async () => {
  // What the old unsigned encoding allowed: hand-write a state naming any
  // project and have the exchange bind a Google account to it.
  const forged = Buffer.from(JSON.stringify({ projectId: 'someone-elses-project' })).toString(
    'base64url'
  );

  await assert.rejects(() => verifyGbpState(forged, ENV), (error) => {
    assert.equal(error.code, 'INVALID_OAUTH_STATE');
    assert.equal(error.status, 400);
    return true;
  });
});

test('a state signed with a different secret is rejected', async () => {
  const state = await signGbpState({ projectId: 'proj_1' }, { AUTH_JWT_SECRET: 'y'.repeat(48) });
  await assert.rejects(() => verifyGbpState(state, ENV));
});

test('a state minted for another signed-in user is rejected', async () => {
  const state = await signGbpState({ projectId: 'proj_1', userId: 7 }, ENV);
  await assert.rejects(() => verifyGbpState(state, ENV, { userId: 8 }), (error) => {
    assert.equal(error.code, 'INVALID_OAUTH_STATE');
    return true;
  });
});

test('returnTo can only ever be a path inside this application', () => {
  assert.equal(safeReturnTo('https://evil.example/steal'), '/local-seo/gbp');
  assert.equal(safeReturnTo('//evil.example'), '/local-seo/gbp');
  assert.equal(safeReturnTo(''), '/local-seo/gbp');
  assert.equal(safeReturnTo('/local-seo/gbp/overview'), '/local-seo/gbp/overview');
});
