import { afterEach, describe, expect, it, vi } from 'vitest';
import Notebook from '../src/models/Notebook.js';
import Advice from '../src/models/Advice.js';
import { pages } from '../src/controllers/advice.js';
import { translate } from '../src/services/translation.js';
import { moderate } from '../src/services/moderation.js';

vi.mock('../src/services/translation.js', () => ({ languages: ['en', 'hi', 'kn'], translate: vi.fn() }));
vi.mock('../src/services/moderation.js', () => ({ moderate: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
function setup(entry, language = 'hi') {
  vi.spyOn(Notebook, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'notebook' }) }) });
  vi.spyOn(Advice, 'countDocuments').mockResolvedValue(1);
  vi.spyOn(Advice, 'findOne').mockReturnValue({ sort: () => ({ skip: () => ({ select: () => ({ lean: async () => entry }) }) }) });
  vi.spyOn(Advice, 'exists').mockResolvedValue({ _id: entry._id });
  const update = vi.spyOn(Advice, 'updateOne').mockResolvedValue({ matchedCount: 1 });
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return { req: { params: { slug: 'book' }, query: { page: '1', language } }, res, update };
}
describe('approved page translations', () => {
  const original = { _id: 'id', originalText: 'Be kind to yourself.', originalLanguage: 'en', createdAt: new Date() };
  it.each(['hi', 'kn'])('reviews and caches a safe %s translation with the original for context', async language => {
    const { req, res, update } = setup({ ...original, translations: {} }, language);
    translate.mockResolvedValue('Safe translated advice'); moderate.mockResolvedValue({ status: 'approved' });
    await pages(req, res);
    expect(translate).toHaveBeenCalledWith(original.originalText, language, 'en');
    expect(moderate).toHaveBeenCalledWith('Safe translated advice', { translationOf: original.originalText });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ moderationStatus: 'approved', originalText: original.originalText }), { $set: { [`translations.${language}`]: 'Safe translated advice' } });
    expect(res.json.mock.calls[0][0].advice).toMatchObject({ originalText: original.originalText, translatedText: 'Safe translated advice', translationLanguage: language });
  });
  it('uses a cached translation without calling the provider and keeps the original', async () => { const { req, res } = setup({ ...original, translations: { hi: 'अपने प्रति दयालु बनें।' } }); await pages(req, res); expect(translate).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0].advice).toMatchObject({ originalText: original.originalText, translatedText: 'अपने प्रति दयालु बनें।' }); });
  it('never displays or caches a translation that fails moderation', async () => { const { req, res, update } = setup({ ...original, translations: {} }); translate.mockResolvedValue('Unsafe translation'); moderate.mockResolvedValue({ status: 'needs_review' }); await pages(req, res); expect(update).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0]).toMatchObject({ advice: { translatedText: null, originalText: original.originalText }, translationError: 'Translation is unavailable. Showing the original.' }); });
  it('keeps the original readable when Google translation fails', async () => { const { req, res, update } = setup({ ...original, translations: {} }, 'kn'); translate.mockRejectedValue(new Error('Provider unavailable')); await pages(req, res); expect(moderate).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0]).toMatchObject({ advice: { translatedText: null, originalText: original.originalText }, translationError: 'Translation is unavailable. Showing the original.' }); });
  it('does not translate unsupported languages', async () => { const { req, res } = setup(original, 'xx'); await pages(req, res); expect(res.status).toHaveBeenCalledWith(400); expect(translate).not.toHaveBeenCalled(); });
});
