import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWordCounter, countWords, validateWordCounterInput } from './word-counter.js';

test('word counter matches the frontend statistics', () => {
  const result = countWords('Hello world! How are you?\n\nThis is a test.');

  assert.deepEqual(result, {
    words: 9,
    characters: 42,
    sentences: 3,
    paragraphs: 2,
    reading: 1,
  });
});

test('word counter counts punctuation groups and rounds reading time up', () => {
  const text = `${Array(201).fill('word').join(' ')}!!!`;
  const result = calculateWordCounter({ text });

  assert.equal(result.words, 201);
  assert.equal(result.sentences, 1);
  assert.equal(result.reading, 2);
});

test('word counter preserves whitespace in character count and returns empty zeros', () => {
  assert.deepEqual(countWords('   '), {
    words: 0,
    characters: 3,
    sentences: 0,
    paragraphs: 0,
    reading: 0,
  });
  assert.deepEqual(calculateWordCounter({ text: '' }), {
    text: '',
    words: 0,
    characters: 0,
    sentences: 0,
    paragraphs: 0,
    reading: 0,
  });
});

test('word counter validates text input', () => {
  assert.throws(() => validateWordCounterInput({}), /text is required/);
  assert.throws(() => validateWordCounterInput({ text: 42 }), /text is required/);
  assert.throws(() => validateWordCounterInput({ text: 'x'.repeat(2_000_001) }), /characters or fewer/);
});
