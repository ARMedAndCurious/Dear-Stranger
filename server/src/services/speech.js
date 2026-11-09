export const speechLanguages = ['indic-auto', 'en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'bn-IN', 'gu-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'te-IN'];

export function validWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 46 || buffer.length > 960044) return false;
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.readUInt32LE(4) === buffer.length - 8 && buffer.toString('ascii', 8, 16) === 'WAVEfmt ' && buffer.readUInt32LE(16) === 16 && buffer.readUInt16LE(20) === 1 && buffer.readUInt16LE(22) === 1 && buffer.readUInt32LE(24) === 16000 && buffer.readUInt32LE(28) === 32000 && buffer.readUInt16LE(32) === 2 && buffer.readUInt16LE(34) === 16 && buffer.toString('ascii', 36, 40) === 'data' && buffer.readUInt32LE(40) === buffer.length - 44 && (buffer.length - 44) % 2 === 0;
}

// Gnani Prisma REST: https://docs.gnani.ai/api/STT/speech-to-text.md
export async function transcribe(audio, language) {
  if (!process.env.GNANI_API_KEY) throw new Error('Speech transcription is not configured');
  const form = new FormData();
  form.append('audio_file', new Blob([audio], { type: 'audio/wav' }), 'recording.wav');
  form.append('model', 'prisma-v3.0');
  form.append('language_code', language);
  const response = await fetch('https://api.vachana.ai/stt/v3', { method: 'POST', headers: { 'X-API-Key-ID': process.env.GNANI_API_KEY }, body: form, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Transcription failed. Please try again.');
  const result = await response.json();
  if (result.success !== true || typeof result.transcript !== 'string' || result.transcript.length > 10000 || result.truncated) throw new Error('Transcription incomplete. Please try a shorter recording.');
  if (!result.transcript.trim()) throw new Error('No speech was detected. Please try again.');
  const detected = speechLanguages.includes(result.detected_language_code) && result.detected_language_code !== 'indic-auto' ? result.detected_language_code.slice(0, 2) : null;
  return { transcript: result.transcript, originalLanguage: detected };
}
