// Gnani Timbre v2.5 REST: https://docs.gnani.ai/api/TTS/tts-inference.md
// Voices are language-specific: https://docs.gnani.ai/api/TTS/available-voices.md
export const ttsVoices = { en: 'Shlok', hi: 'Yashvi', kn: 'Saanvi', ta: 'Trisha', bn: 'Kirra', gu: 'Falak', ml: 'Reshma', mr: 'Ishaan', pa: 'Zayan', te: 'Suhana' };

export async function synthesize(text, language) {
  if (!process.env.GNANI_API_KEY) throw new Error('TTS unavailable');
  const response = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': process.env.GNANI_API_KEY },
    body: JSON.stringify({ text, voice: ttsVoices[language], model: 'timbre-v2.5', language: `${language}-IN`, speed: 1, audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('TTS unavailable');
  if (!response.headers.get('content-type')?.toLowerCase().includes('audio/wav')) throw new Error('Unexpected audio format');
  const size = Number(response.headers.get('content-length'));
  if (size > 5_000_000) throw new Error('Audio too large');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 44 || buffer.length > 5_000_000 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid audio response');
  return buffer;
}
