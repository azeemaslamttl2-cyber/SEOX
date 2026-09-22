import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGES,
  createDiagnostics,
  failurePayload,
  markStage,
  successPayload,
} from './gbp-diagnostics.js';

test('a failure reports the stages that already succeeded, not just the one that broke', () => {
  const diagnostics = createDiagnostics();
  markStage(diagnostics, STAGES.SCOPE_CHECK, {
    authentication: true,
    permission_granted: true,
    token_received: true,
  });
  markStage(diagnostics, STAGES.BUSINESS_PROFILE_API);

  const payload = failurePayload(diagnostics, {
    message: "Quota exceeded for quota metric 'Requests'",
    status: 429,
    code: 'QUOTA_NOT_APPROVED',
  });

  // The whole point: the consent worked, and the payload says so.
  assert.equal(payload.success, false);
  assert.equal(payload.authentication, true);
  assert.equal(payload.permission_granted, true);
  assert.equal(payload.token_received, true);
  assert.equal(payload.accounts_fetched, false);
  assert.equal(payload.stage, STAGES.BUSINESS_PROFILE_API);
  assert.equal(payload.error_code, 429);
  assert.equal(payload.error_type, 'QUOTA_NOT_APPROVED');
  assert.match(payload.possible_cause, /quota of zero|approves/i);
  assert.equal(payload.owner, 'google_cloud');
});

test('a network failure is attributed to the application, not the Google account', () => {
  const payload = failurePayload(createDiagnostics(), {
    message: 'Could not reach oauth2.googleapis.com (ETIMEDOUT).',
    status: 502,
    code: 'NETWORK',
  });

  assert.equal(payload.owner, 'application');
  assert.match(payload.possible_cause, /Nothing is wrong with the Google account/i);
});

test('a denied permission points at Business Profile Manager', () => {
  const payload = failurePayload(createDiagnostics(), {
    message: 'The caller does not have permission',
    status: 403,
    code: 'PERMISSION_DENIED',
  });

  assert.equal(payload.owner, 'google_account');
  assert.match(payload.possible_cause, /owner or manager/i);
});

test('no payload ever carries a credential', () => {
  // `token_received` is a boolean about a token, which is exactly what the
  // browser needs and reveals nothing. The credentials themselves must never
  // appear under any name.
  const FORBIDDEN_KEYS = [
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'client_secret',
    'clientSecret',
    'id_token',
    'password',
  ];

  const diagnostics = createDiagnostics();
  const payloads = [
    failurePayload(diagnostics, { message: 'x', status: 500, code: 'GBP_ERROR' }),
    successPayload(diagnostics, { connected: true, profiles_found: true }),
  ];

  for (const payload of payloads) {
    for (const forbidden of FORBIDDEN_KEYS) {
      assert.ok(!(forbidden in payload), `payload must not expose "${forbidden}"`);
    }
    // Every value is a primitive the UI renders; no nested object can smuggle
    // a credential through.
    for (const value of Object.values(payload)) {
      assert.ok(
        value === null || ['string', 'number', 'boolean'].includes(typeof value),
        'diagnostics values must stay primitive'
      );
    }
  }
});

test('a success payload marks the flow complete', () => {
  const payload = successPayload(createDiagnostics(), { profiles_found: true });
  assert.equal(payload.success, true);
  assert.equal(payload.stage, STAGES.COMPLETE);
});
