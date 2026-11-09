import { describe, expect, it } from 'vitest';
import { paginateText } from '../../client/src/paginateText.js';

describe('fixed diary page text layout', () => {
  it('uses the largest readable font that fits', () => {
    const result = paginateText('hello', (_text, size) => size <= 19);
    expect(result).toEqual({ pages: ['hello'], fontSize: 19 });
  });
  it('splits long multilingual text without losing or rearranging characters', () => {
    const text = 'नमस्ते 🙏🏽\nHello world! '.repeat(30);
    const result = paginateText(text, value => Array.from(value).length <= 18);
    expect(result.fontSize).toBe(16);
    expect(result.pages.length).toBeGreaterThan(1);
    expect(result.pages.join('')).toBe(text);
    expect(result.pages.every(Boolean)).toBe(true);
  });
  it('makes progress even if one grapheme cannot fit', () => {
    const result = paginateText('abc', () => false);
    expect(result.pages).toEqual(['a', 'b', 'c']);
  });
});
