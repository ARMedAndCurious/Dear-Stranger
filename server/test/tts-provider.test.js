import { afterEach, describe, expect, it, vi } from 'vitest';
import { synthesize, ttsVoices } from '../src/services/tts.js';

afterEach(() => { vi.unstubAllGlobals(); delete process.env.GNANI_API_KEY; });
describe('Gnani Timbre request', () => {
  it('sends matched voices and language, and returns validated WAV audio', async () => {
    process.env.GNANI_API_KEY = 'test-only';
    const wav = Buffer.alloc(48); wav.write('RIFF'); wav.write('WAVE', 8);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'audio/wav' }), arrayBuffer: async () => wav });
    vi.stubGlobal('fetch', fetcher);
    expect(ttsVoices.hi).toBe('Yashvi');
    expect(await synthesize('नमस्ते', 'hi')).toEqual(wav);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.vachana.ai/api/v1/tts/inference');
    expect(JSON.parse(options.body)).toMatchObject({ text: 'नमस्ते', voice: 'Yashvi', model: 'timbre-v2.5', language: 'hi-IN', audio_config: { container: 'wav' } });
  });
  it('rejects invalid audio and failed provider calls without exposing text', async () => {
    process.env.GNANI_API_KEY = 'test-only';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }) }));
    await expect(synthesize('Never log this', 'en')).rejects.toThrow('Unexpected audio format');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(synthesize('Never log this', 'en')).rejects.toThrow('TTS unavailable');
  });
});
