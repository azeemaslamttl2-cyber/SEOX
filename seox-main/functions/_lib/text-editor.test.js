import test from 'node:test';
import assert from 'node:assert/strict';
import { transformTextEditor, validateTextEditorInput } from './text-editor.js';

test('text editor operations match the frontend transformations', () => {
  const cases = [
    ['dedupe', 'a\na\nb', 'a\nb'],
    ['brackets', '[a] (b) {c}', 'a b c'],
    ['empty', 'a\n\n b\n', 'a\n b'],
    ['keep', 'keep\ndrop\nkeep this', 'keep\nkeep this'],
    ['upper', 'a\nB', 'A\nB'],
    ['lower', 'A\nb', 'a\nb'],
    ['title', 'hello WORLD', 'Hello World'],
    ['single', 'a\nb\n', 'a b '],
    ['replace', 'a\nb', 'a,b'],
    ['prefix', 'a\nb', '> a\n> b'],
    ['suffix', 'a\nb', 'a;\nb;'],
  ];

  for (const [operation, text, expected] of cases) {
    const result = transformTextEditor({
      operation,
      text,
      filter: 'keep',
      replaceWith: ',',
      prefix: '> ',
      suffix: ';',
    });
    assert.equal(result.result, expected, operation);
  }
});

test('text editor applies the frontend defaults', () => {
  assert.equal(transformTextEditor({ operation: 'replace', text: 'one\ntwo' }).result, 'one,two');
  assert.equal(transformTextEditor({ operation: 'keep', text: 'keep\ndrop', filter: '' }).result, 'keep\ndrop');
});

test('text editor validates operation and text', () => {
  assert.throws(() => validateTextEditorInput({ operation: 'upper' }), /text is required/);
  assert.throws(() => validateTextEditorInput({ operation: 'unknown', text: 'value' }), /operation must be one of/);
  assert.throws(() => validateTextEditorInput({ operation: 'upper', text: 'x'.repeat(2_000_001) }), /characters or fewer/);
  assert.throws(() => validateTextEditorInput({ operation: 'upper', text: 'value', prefix: 42 }), /options must be strings/);
});
