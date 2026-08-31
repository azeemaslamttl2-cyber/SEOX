import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRobots,
  calculateEeat,
  calculateModule,
  calculateBacklinks,
  calculatePlagiarism,
} from './_lib/module-calculator.js';

// Test URL (publicly available for testing)
const TEST_URL = 'https://example.com';
const TEST_ROBOTS_URL = 'https://example.com/robots.txt';

test('calculateRobots returns proper result structure', async () => {
  const result = await calculateRobots(TEST_URL);
  
  assert.ok(result, 'Result should exist');
  assert.ok(result.url, 'Should have url field');
  assert.ok(typeof result.statusCode === 'number', 'Should have numeric statusCode');
  assert.ok(typeof result.isAccessible === 'boolean', 'Should have boolean isAccessible');
  assert.ok(Array.isArray(result.checks), 'Should have checks array');
  assert.ok(typeof result.score === 'number', 'Should have numeric score');
  assert.ok(typeof result.analyzedAt === 'string', 'Should have analyzedAt timestamp');
});

test('calculateRobots handles fetch errors gracefully', async () => {
  const result = await calculateRobots('https://invalid-domain-12345-xyz.local');
  
  assert.ok(result, 'Should return result even on error');
  assert.ok(result.error, 'Should have error field');
  assert.equal(result.statusCode, 0, 'Should have 0 statusCode on error');
  assert.equal(result.isAccessible, false, 'Should be inaccessible on error');
  assert.equal(Array.isArray(result.checks), true, 'Should have checks array');
  assert.equal(result.score, 0, 'Should have 0 score on error');
});

test('calculateEeat returns proper result structure', async () => {
  const result = await calculateEeat(TEST_URL);
  
  assert.ok(result, 'Result should exist');
  assert.ok(result.url, 'Should have url field');
  assert.ok(typeof result.score === 'number' || result.score === null, 'Should have score field');
  assert.ok(Array.isArray(result.checks), 'Should have checks array');
  assert.ok(typeof result.analyzedAt === 'string', 'Should have analyzedAt timestamp');
  assert.ok(typeof result.signals === 'object', 'Should have signals object');
});

test('calculateEeat handles errors gracefully', async () => {
  const result = await calculateEeat('https://invalid-domain-12345-xyz.local');
  
  assert.ok(result, 'Should return result even on error');
  assert.ok(result.error, 'Should have error field');
  assert.ok(result.url, 'Should preserve url field');
  assert.equal(Array.isArray(result.checks), true, 'Should have checks array');
  assert.equal(result.score, 0, 'Should have 0 score on error');
});

test('calculateModule dispatches to correct calculator', async () => {
  const robotsResult = await calculateModule('robots', TEST_URL);
  const eeatResult = await calculateModule('eeat', TEST_URL);
  
  assert.ok(robotsResult.url, 'Robots should have url');
  assert.ok(eeatResult.url, 'EEAT should have url');
  assert.ok(robotsResult.robotsContent !== undefined, 'Robots should have robotsContent');
  assert.ok(eeatResult.signals !== undefined, 'EEAT should have signals');
});

test('calculateModule returns error for unknown module', async () => {
  const result = await calculateModule('nonexistent', TEST_URL);
  
  assert.ok(result.error, 'Should have error for unknown module');
  assert.ok(result.error.includes('Unknown module'), 'Error should mention unknown module');
});

test('calculateBacklinks returns skipped status', async () => {
  const result = await calculateBacklinks(TEST_URL);
  
  assert.equal(result.status, 'skipped', 'Should be skipped');
  assert.ok(result.reason, 'Should have reason field');
  assert.ok(Array.isArray(result.backlinks), 'Should have backlinks array');
});

test('calculatePlagiarism returns skipped status', async () => {
  const result = await calculatePlagiarism(TEST_URL);
  
  assert.equal(result.status, 'skipped', 'Should be skipped');
  assert.ok(result.reason, 'Should have reason field');
  assert.ok(Array.isArray(result.results), 'Should have results array');
});

test('module calculators return consistent timestamp format', async () => {
  const robotsResult = await calculateRobots(TEST_URL);
  const eeatResult = await calculateEeat(TEST_URL);
  
  // Check ISO 8601 format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  assert.ok(iso8601Regex.test(robotsResult.analyzedAt), 'Robots timestamp should be ISO 8601');
  assert.ok(iso8601Regex.test(eeatResult.analyzedAt), 'EEAT timestamp should be ISO 8601');
});
