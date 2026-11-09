import { afterEach, describe, expect, it, vi } from 'vitest';
import { moderate } from '../src/services/moderation.js';

afterEach(() => { vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY; delete process.env.OPENAI_MODERATION_MODEL; });
describe('translation safety review', () => {
  it('sends original and translated text to a translation-specific safety review', async () => {
    process.env.OPENAI_API_KEY = 'test-only'; process.env.OPENAI_MODERATION_MODEL = 'test-model';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ decision: 'approved', reasonCategory: 'safe_advice', confidence: 0.99, humanReviewRequired: false }) } }] }) });
    vi.stubGlobal('fetch', fetcher);
    expect((await moderate('सुरक्षित सलाह', { translationOf: 'Safe advice' })).status).toBe('approved');
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.messages[0].content).toMatch(/Do not re-evaluate whether the advice is meaningful or relevant/);
    expect(JSON.parse(payload.messages[1].content)).toEqual({ original: 'Safe advice', translated: 'सुरक्षित सलाह' });
  });
  it('keeps original submission moderation unchanged and fails closed for unsafe translations', async () => {
    process.env.OPENAI_API_KEY = 'test-only'; process.env.OPENAI_MODERATION_MODEL = 'test-model';
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ decision: 'rejected', reasonCategory: 'harmful_instructions', confidence: 0.99, humanReviewRequired: false }) } }] }) });
    vi.stubGlobal('fetch', fetcher);
    expect((await moderate('Translation', { translationOf: 'Safe original' })).status).toBe('rejected');
    await moderate('Original advice');
    const payload = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(payload.messages[0].content).toMatch(/Moderate anonymous advice/);
    expect(payload.messages[1].content).toBe('Original advice');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));
    expect((await moderate('Translation', { translationOf: 'Safe original' })).status).toBe('needs_review');
  });
});
