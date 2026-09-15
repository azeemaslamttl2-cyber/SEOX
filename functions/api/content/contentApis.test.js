import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as nlp } from './nlp.js';
import { onRequest as grammar } from './grammar.js';
import { onRequest as uniqueNgrams } from './unique-ngrams.js';
import { onRequest as skipGram } from './skip-gram.js';
import { onRequest as optimization } from './optimization.js';
import { onRequest as watermark } from './watermark-remover.js';
import { onRequest as semanticGenerator } from './semantic-generator.js';
import { onRequest as contentAnalyzer } from './content-analyzer.js';

const ENV = { AUTH_JWT_SECRET: '12345678901234567890123456789012', ADMIN_TOKEN: 'valid-token' };

const ARTICLE = `
  Google announced improvements to Search Engine Optimization tooling.
  Google says the best technical audits improve crawl budget and growth.
`;

const PAGE_HTML = `
  <html><head><title>SEO Guide</title></head>
    <body><main><h1>Google Ranking Factors</h1>
      <p>Google evaluates Search Engine Optimization signals and crawl budget.</p>
    </main></body></html>
`;

/** One row per endpoint: a valid body, and a body missing its required field. */
const ENDPOINTS = [
  { name: 'nlp', handler: nlp, valid: { mode: 'text', text: ARTICLE }, missing: { mode: 'text' }, field: 'text' },
  { name: 'grammar', handler: grammar, valid: { topic: 'technical seo' }, missing: {}, field: 'topic' },
  { name: 'unique-ngrams', handler: uniqueNgrams, valid: { topic: 'technical seo' }, missing: {}, field: 'topic' },
  { name: 'skip-gram', handler: skipGram, valid: { word: 'jaguar' }, missing: {}, field: 'word' },
  { name: 'optimization', handler: optimization, valid: { content: ARTICLE }, missing: {}, field: 'content' },
  { name: 'watermark-remover', handler: watermark, valid: { text: 'hello world' }, missing: {}, field: 'text' },
  { name: 'semantic-generator', handler: semanticGenerator, valid: { keyword: 'seo', sections: ['entities'] }, missing: {}, field: 'keyword' },
  {
    name: 'content-analyzer',
    handler: contentAnalyzer,
    valid: { urls: ['https://example.com'], sections: ['entities'] },
    missing: {},
    field: 'urls',
    needsFetch: true,
  },
];

function req(name, body, init = {}) {
  return new Request(`https://example.com/api/content/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: JSON.stringify(body),
  });
}

function aiJson(obj) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function withStubbedFetch(impl, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

/** Enough of a stub that every endpoint's happy path can complete. */
function permissiveFetch() {
  return async (url, init) => {
    if (String(url).includes('api.deepseek.com')) {
      const prompt = JSON.parse(init.body).messages.slice(-1)[0].content;
      if (prompt.includes('entities')) {
        return aiJson({
          entities: ['Google'],
          entityTypes: { people: [], organizations: ['Google'], concepts: [], products: [], locations: [] },
          people: [], organizations: ['Google'], locations: [], products: [], concepts: [], technologies: [],
        });
      }
      return aiJson({ ngrams: ['a b'], words: ['x'], synonyms: ['y'] });
    }
    return new Response(PAGE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
}

/* ── authentication: the same matrix for every endpoint ── */

for (const { name, handler, valid, needsFetch } of ENDPOINTS) {
  test(`${name}: rejects a request with no admin_token`, async () => {
    const response = await handler({ request: req(name, valid), env: ENV });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.errors.admin_token, 'admin_token is required.');
  });

  test(`${name}: rejects an invalid admin_token`, async () => {
    const response = await handler({
      request: req(name, { ...valid, admin_token: 'bogus' }),
      env: ENV,
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.status, 'unauthorized');
    assert.equal(payload.message, 'Invalid admin token.');
  });

  test(`${name}: accepts a valid admin_token`, async () => {
    const response = await withStubbedFetch(permissiveFetch(), () =>
      handler({
        request: req(name, { ...valid, admin_token: 'valid-token' }),
        env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
      })
    );

    assert.equal(response.status, 200, `${name} should succeed with a valid token`);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.status, 'success');
    assert.ok(payload.data && typeof payload.data === 'object');
  });

  test(`${name}: an Authorization header is never accepted instead`, async () => {
    const response = await handler({
      request: req(name, valid, { headers: { Authorization: 'Bearer valid-token' } }),
      env: ENV,
    });

    assert.equal(response.status, 400);
  });

  test(`${name}: advertises Content-Type only`, async () => {
    const response = await handler({
      request: new Request(`https://example.com/api/content/${name}`, { method: 'OPTIONS' }),
      env: ENV,
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type');
  });

  test(`${name}: rejects non-POST methods`, async () => {
    const response = await handler({
      request: new Request(`https://example.com/api/content/${name}`, { method: 'GET' }),
      env: ENV,
    });
    const payload = await response.json();

    assert.equal(response.status, 405);
    assert.equal(payload.status, 'method_not_allowed');
  });

  test(`${name}: rejects an empty payload`, async () => {
    const response = await handler({ request: req(name, {}), env: ENV });
    assert.equal(response.status, 400);
  });

  test(`${name}: rejects a missing required field`, async () => {
    const { missing, field } = ENDPOINTS.find((e) => e.name === name);
    const response = await handler({
      request: req(name, { ...missing, admin_token: 'valid-token' }),
      env: ENV,
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.status, 'validation_error');
    assert.ok(payload.errors[field], `expected an error on "${field}", got ${JSON.stringify(payload.errors)}`);
  });

  test(`${name}: does no work before authentication succeeds`, async () => {
    let called = false;
    await withStubbedFetch(
      async (...args) => {
        called = true;
        return permissiveFetch()(...args);
      },
      () => handler({
        request: req(name, { ...valid, admin_token: 'bogus' }),
        env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
      })
    );

    assert.equal(called, false, `${name} must not do any work for an unauthenticated caller`);
  });

  test(`${name}: never leaks secrets, the token, or stack traces`, async () => {
    const response = await withStubbedFetch(
      async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:3306 password=hunter2');
      },
      () => handler({
        request: req(name, { ...valid, admin_token: 'valid-token' }),
        env: { ...ENV, DEEPSEEK_API_KEY: 'super-secret-key' },
      })
    );

    const raw = await response.text();
    assert.doesNotMatch(raw, /hunter2/, `${name} leaked a db password`);
    assert.doesNotMatch(raw, /super-secret-key/, `${name} leaked the API key`);
    assert.doesNotMatch(raw, /valid-token/, `${name} echoed the admin token`);
    assert.doesNotMatch(raw, /at \w+ \(/, `${name} leaked a stack trace`);
    JSON.parse(raw);
    void needsFetch;
  });
}

/* ── per-endpoint result shape ── */

test('nlp: returns keyword objects', async () => {
  const response = await nlp({
    request: req('nlp', { admin_token: 'valid-token', mode: 'text', text: ARTICLE }),
    env: ENV,
  });
  const { data } = await response.json();

  assert.ok(data.keywordCount > 0);
  assert.deepEqual(Object.keys(data.keywords[0]).sort(), ['keyword', 'relevance', 'sentiment', 'type']);
});

test('grammar: returns the eight relation categories', async () => {
  const response = await grammar({
    request: req('grammar', { admin_token: 'valid-token', topic: 'technical seo' }),
    env: ENV,
  });
  const { data, message } = await response.json();

  assert.equal(data.categories.length, 8);
  assert.equal(data.ai.applied, false);
  assert.match(message, /local fallback/i);
});

test('watermark-remover: reports how many characters were stripped', async () => {
  const response = await watermark({
    request: req('watermark-remover', { admin_token: 'valid-token', text: 'Hello​world﻿!' }),
    env: ENV,
  });
  const { data, message } = await response.json();

  assert.equal(data.stats.invisibleCount, 2);
  assert.equal(data.cleaned, 'Helloworld!');
  assert.match(message, /removed successfully/i);
});

test('watermark-remover: says so when nothing was found', async () => {
  const response = await watermark({
    request: req('watermark-remover', { admin_token: 'valid-token', text: 'clean text' }),
    env: ENV,
  });
  const { message } = await response.json();

  assert.match(message, /No watermark characters were found/i);
});

test('optimization: advice is skipped unless requested', async () => {
  let called = false;
  const response = await withStubbedFetch(
    async (...args) => {
      called = true;
      return permissiveFetch()(...args);
    },
    () => optimization({
      request: req('optimization', { admin_token: 'valid-token', content: ARTICLE }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const { data } = await response.json();

  assert.equal(called, false);
  assert.equal(data.advice.requested, false);
  assert.equal(typeof data.score, 'number');
});

test('content-analyzer: 502 when no URL can be fetched', async () => {
  const response = await withStubbedFetch(
    async () => new Response('nope', { status: 503 }),
    () => contentAnalyzer({
      request: req('content-analyzer', {
        admin_token: 'valid-token',
        urls: ['https://example.com'],
        sections: ['entities'],
      }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.match(payload.message, /Could not fetch any of the provided URLs/i);
});

test('semantic-generator: reports per-section failures without failing the request', async () => {
  const response = await withStubbedFetch(
    async () => new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }),
    () => semanticGenerator({
      request: req('semantic-generator', {
        admin_token: 'valid-token',
        keyword: 'seo',
        sections: ['entities', 'ngrams'],
      }),
      env: { ...ENV, DEEPSEEK_API_KEY: 'env-key' },
    })
  );
  const { data } = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data.generated, []);
  assert.deepEqual(data.failed, ['entities', 'ngrams']);
  assert.match(data.errors.entities, /quota exceeded/i);
});
