export const languages = ['en', 'hi', 'kn', 'ta', 'bn', 'gu', 'ml', 'mr', 'pa', 'te'];

// Google Cloud Translation Basic v2: https://cloud.google.com/translate/docs/reference/rest/v2/translate
export async function translate(text, target, source) {
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) throw new Error('Translation unavailable');
  const body = { q: text, target, format: 'text' };
  if (languages.includes(source)) body.source = source;
  const response = await fetch('https://translation.googleapis.com/language/translate/v2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GOOGLE_TRANSLATE_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Translation unavailable');
  const result = await response.json();
  const textResult = result.data?.translations?.[0]?.translatedText;
  if (typeof textResult !== 'string' || !textResult.trim() || textResult.length > 10000) throw new Error('Translation unavailable');
  return textResult;
}
