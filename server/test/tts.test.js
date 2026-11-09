import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import { createApp } from '../src/app.js';
import Advice from '../src/models/Advice.js';
import Notebook from '../src/models/Notebook.js';
import { synthesize } from '../src/services/tts.js';

vi.mock('../src/services/tts.js', async original => ({ ...(await original()), synthesize: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
const app = createApp({ store: new session.MemoryStore(), secret: 'test-secret-longer-than-thirty-two-characters', clientOrigin: 'http://localhost:5173' });
const body = { page: 1, offset: 0, length: 4, language: 'hi' };
async function visitor() { const agent = request.agent(app); const response = await agent.get('/api/auth/me'); return { agent, token: response.body.csrfToken }; }
describe('Read Aloud endpoint', () => {
  it('requires CSRF and rejects arbitrary text or invalid language', async () => {
    const { agent, token } = await visitor();
    expect((await agent.post('/api/tts/book').send(body)).status).toBe(403);
    expect((await agent.post('/api/tts/book').set('X-CSRF-Token', token).send({ ...body, text: 'anything' })).status).toBe(400);
    expect((await agent.post('/api/tts/book').set('X-CSRF-Token', token).send({ ...body, language: 'xx' })).status).toBe(400);
  });
  it('synthesizes only approved cached translations in the requested language', async () => {
    vi.spyOn(Notebook, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'notebook' }) }) });
    const find = vi.spyOn(Advice, 'findOne').mockReturnValue({ sort: () => ({ skip: () => ({ select: () => ({ lean: async () => ({ _id: 'entry', originalText: 'English text', originalLanguage: 'en', translations: { hi: 'नमस्ते' } }) }) }) }) });
    vi.spyOn(Advice, 'exists').mockResolvedValue(true);
    synthesize.mockResolvedValue(Buffer.from('RIFF0000WAVE audio'));
    const { agent, token } = await visitor();
    const result = await agent.post('/api/tts/book').set('X-CSRF-Token', token).send(body);
    expect(result.status).toBe(200); expect(result.headers['content-type']).toMatch(/audio\/wav/);
    expect(synthesize).toHaveBeenCalledWith('नमस्ते'.slice(0, 4), 'hi');
    expect(find).toHaveBeenCalledWith({ notebookId: 'notebook', moderationStatus: 'approved' });
    expect((await agent.post('/api/tts/book').set('X-CSRF-Token', token).send({ ...body, length: 2000 })).status).toBe(400);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
  it('never synthesizes absent or unapproved entries', async () => {
    vi.spyOn(Notebook, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'notebook' }) }) });
    vi.spyOn(Advice, 'findOne').mockReturnValue({ sort: () => ({ skip: () => ({ select: () => ({ lean: async () => null }) }) }) });
    const { agent, token } = await visitor();
    expect((await agent.post('/api/tts/book').set('X-CSRF-Token', token).send(body)).status).toBe(404);
    expect(synthesize).not.toHaveBeenCalled();
  });
  it('returns a safe error on provider failure and never returns private text', async () => {
    vi.spyOn(Notebook, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'notebook' }) }) });
    vi.spyOn(Advice, 'findOne').mockReturnValue({ sort: () => ({ skip: () => ({ select: () => ({ lean: async () => ({ _id: 'entry', originalText: 'Private internal text', originalLanguage: 'en', translations: {} }) }) }) }) });
    synthesize.mockRejectedValue(new Error('Provider returned internal details'));
    const { agent, token } = await visitor();
    const result = await agent.post('/api/tts/book').set('X-CSRF-Token', token).send({ ...body, language: 'en' });
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toMatch(/Private internal text|Provider returned internal details/);
  });
  it('throttles repeated synthesis requests before hitting the provider', async () => {
    const limitedApp = createApp({ store: new session.MemoryStore(), secret: 'test-secret-longer-than-thirty-two-characters', clientOrigin: 'http://localhost:5173' });
    const agent = request.agent(limitedApp);
    const token = (await agent.get('/api/auth/me')).body.csrfToken;
    let result;
    for (let index = 0; index < 16; index++) result = await agent.post('/api/tts/book').set('X-CSRF-Token', token).send({ ...body, language: 'unsupported' });
    expect(result.status).toBe(429);
    expect(synthesize).not.toHaveBeenCalled();
  });
});
