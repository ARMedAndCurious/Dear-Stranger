// `fits` measures rendered text inside the fixed page; it never modifies the advice.
export function paginateText(text, fits) {
  if (!text) return { pages: [''], fontSize: 22 };
  for (let size = 22; size >= 16; size--) {
    if (fits(text, size)) return { pages: [text], fontSize: size };
  }
  const parts = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment)
    : Array.from(text);
  const pages = [];
  for (let start = 0; start < parts.length;) {
    let low = start + 1, high = parts.length, end = start;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(parts.slice(start, mid).join(''), 16)) { end = mid; low = mid + 1; }
      else high = mid - 1;
    }
    end = Math.max(start + 1, end);
    if (end < parts.length) {
      // Prefer a word boundary when that does not waste most of the page.
      for (let boundary = end; boundary > start + Math.floor((end - start) * 0.6); boundary--) {
        if (/\s/u.test(parts[boundary - 1])) { end = boundary; break; }
      }
    }
    pages.push(parts.slice(start, end).join(''));
    start = end;
  }
  return { pages, fontSize: 16 };
}

// Each result is one spread: its left page is decorative and its right page
// contains one part of exactly one advice entry.
export function buildSpreads(entries, fits) {
  return entries.flatMap((entry, entryIndex) => {
    const text = entry.translatedText || entry.originalText || '';
    const layout = paginateText(text, fits);
    let offset = 0;
    return layout.pages.map((part, partIndex) => {
      const spread = { text: part, fontSize: layout.fontSize, language: entry.translationLanguage || entry.originalLanguage, translated: Boolean(entry.translatedText), entryIndex, partIndex, partCount: layout.pages.length, offset };
      offset += part.length;
      return spread;
    });
  });
}
