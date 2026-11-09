import { useEffect, useRef, useState } from 'react';
import { request } from './api';

const options = [['indic-auto', 'Detect language'], ['en-IN', 'English'], ['hi-IN', 'Hindi'], ['kn-IN', 'Kannada'], ['ta-IN', 'Tamil'], ['bn-IN', 'Bengali'], ['gu-IN', 'Gujarati'], ['ml-IN', 'Malayalam'], ['mr-IN', 'Marathi'], ['pa-IN', 'Punjabi'], ['te-IN', 'Telugu']];

function wav(samples, rate) {
  const length = Math.floor(samples.length * 16000 / rate), buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) { const value = Math.max(-1, Math.min(1, samples[Math.floor(i * rate / 16000)])); view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true); }
  return new Blob([buffer], { type: 'audio/wav' });
}

export default function VoiceRecorder({ onTranscript }) {
  const [language, setLanguage] = useState('indic-auto'), [state, setState] = useState('idle'), [error, setError] = useState(''), [audio, setAudio] = useState(null);
  const active = useRef(null), mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; const a = active.current; if (a) { clearTimeout(a.timer); a.processor.disconnect(); a.source.disconnect(); a.stream.getTracks().forEach(track => track.stop()); a.context.close(); active.current = null; } }, []);
  async function start() {
    setError(''); setAudio(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return setError('Microphone recording requires a supported browser and HTTPS or localhost.');
    setState('starting');
    let stream, context;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); return; }
      context = new AudioContext(); const source = context.createMediaStreamSource(stream), processor = context.createScriptProcessor(4096, 1, 1), chunks = [];
      let collected = 0; processor.onaudioprocess = event => { const chunk = new Float32Array(event.inputBuffer.getChannelData(0)); collected += chunk.length; chunks.push(chunk); };
      source.connect(processor); processor.connect(context.destination);
      const recording = { stream, context, source, processor, chunks, get length() { return collected; } };
      active.current = recording; recording.timer = setTimeout(() => stop(), 29000); setState('recording');
    } catch { stream?.getTracks().forEach(track => track.stop()); if (context) context.close(); setState('idle'); setError('Microphone access was denied or is unavailable. Check your browser permissions.'); }
  }
  function stop() {
    const a = active.current; if (!a) return; active.current = null; clearTimeout(a.timer); a.processor.disconnect(); a.source.disconnect(); a.stream.getTracks().forEach(track => track.stop()); a.context.close();
    const all = new Float32Array(a.length); let offset = 0; for (const chunk of a.chunks) { all.set(chunk, offset); offset += chunk.length; }
    const blob = wav(all, a.context.sampleRate); if (blob.size <= 44 || blob.size > 960044) { setError('Recording was empty or too long. Please try again.'); setState('idle'); return; } setAudio(blob); setState('ready');
  }
  async function send() { setState('sending'); setError(''); try { const result = await request(`/speech/transcribe?language=${encodeURIComponent(language)}`, { method: 'POST', body: audio, headers: { 'Content-Type': 'audio/wav' } }); onTranscript(result.transcript, result.originalLanguage); setAudio(null); setState('idle'); } catch (err) { setError(err.message); setState('ready'); } }
  return <div className="voice-box"><label>Spoken language<select value={language} disabled={state === 'recording' || state === 'sending'} onChange={e => setLanguage(e.target.value)}>{options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><p className="muted">Up to 30 seconds. Your recording is sent to Gnani for transcription, not published or stored by this app. Provider and network metadata may be retained.</p>{error && <p className="error" role="alert">{error}</p>}<div className="voice-actions">{state === 'recording' ? <button type="button" className="button" onClick={stop}>■ Stop recording</button> : <button type="button" className="button" disabled={state === 'starting' || state === 'sending'} onClick={start}>{audio ? 'Record again' : '● Start recording'}</button>}{audio && <button type="button" className="text-button" disabled={state === 'sending'} onClick={send}>{state === 'sending' ? 'Transcribing…' : 'Transcribe recording →'}</button>}</div><p className="muted" aria-live="polite">{state === 'recording' ? 'Recording… Stops automatically after 29 seconds.' : state === 'ready' ? 'Ready to transcribe. You can retry if it fails.' : ''}</p></div>;
}
