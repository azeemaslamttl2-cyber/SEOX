import test from 'node:test';
import assert from 'node:assert/strict';
import { viewAsBot } from './seo-tools.js';

test('Bot Viewer returns the exact frontend result for the default bot', () => {
  assert.deepEqual(viewAsBot({ url: 'https://example.com' }), {
    bot: 'Googlebot',
    url: 'https://example.com',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    status: 200,
    title: 'Example Page Title',
    meta: 'Page meta description as seen by the crawler.',
  });
});

test('Bot Viewer supports every bot shown in the frontend', () => {
  for (const bot of ['Googlebot', 'Bingbot', 'Facebook', 'Twitter', 'Baidu', 'Yandex', 'DuckDuckGo', 'GPTBot (OpenAI)']) {
    const result = viewAsBot({ bot, url: 'https://example.com/page' });
    assert.equal(result.bot, bot);
    assert.equal(result.status, 200);
    assert.ok(result.userAgent);
  }
});

test('Bot Viewer matches frontend empty input behavior and validates API input', () => {
  assert.throws(() => viewAsBot({ url: '' }), /url is required/);
  assert.throws(() => viewAsBot({ url: 'https://example.com', bot: 'Unknown' }), /Unsupported bot/);
  assert.throws(() => viewAsBot({ url: 42 }), /url is required/);
});
