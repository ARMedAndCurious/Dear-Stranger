import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpreads } from '../src/paginateText.js';

const fits = text => Array.from(text).length <= 12;
test('empty, single and three entries produce ordered advice spreads', () => {
  assert.deepEqual(buildSpreads([], fits), []);
  assert.deepEqual(buildSpreads([{ originalText: 'one' }], fits).map(page => page.text), ['one']);
  const spreads = buildSpreads(['one', 'two', 'three'].map(originalText => ({ originalText })), fits);
  assert.deepEqual(spreads.map(page => [page.entryIndex, page.text]), [[0, 'one'], [1, 'two'], [2, 'three']]);
});
test('continuations stay together before the next advice', () => {
  const text = 'A long message with several parts to read.';
  const spreads = buildSpreads([{ originalText: text }, { originalText: 'next' }], fits);
  const first = spreads.filter(page => page.entryIndex === 0);
  assert.ok(first.length > 1);
  assert.equal(first.map(page => page.text).join(''), text);
  assert.deepEqual(first.map(page => page.partIndex), first.map((_, i) => i));
  assert.ok(first.every(page => page.partCount === first.length));
  assert.equal(spreads.at(-1).text, 'next');
});
test('translated text is paginated instead of the original, without altering it', () => {
  const entry = { originalText: 'Original', originalLanguage: 'en', translatedText: 'Translated words for you', translationLanguage: 'hi' };
  const translated = buildSpreads([entry], fits);
  assert.equal(translated.map(page => page.text).join(''), entry.translatedText);
  assert.ok(translated.every(page => page.translated && page.language === 'hi'));
  assert.equal(buildSpreads([{ ...entry, translatedText: null }], fits)[0].text, 'Original');
});
