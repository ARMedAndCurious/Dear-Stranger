import { useEffect, useRef, useState } from 'react';
import { requestAudio } from './api';

function findVoice(synth, language) {
  if (!synth || !language) return null;
  return synth.getVoices().find(voice => voice.lang.toLowerCase() === language || voice.lang.toLowerCase().startsWith(`${language}-`)) || null;
}

function waitForVoice(synth, language, signal) {
  const available = findVoice(synth, language);
  if (available || !synth || !language || signal.aborted) return Promise.resolve(available);
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', changed); signal.removeEventListener('abort', aborted); resolve(findVoice(synth, language)); };
    const changed = () => { if (findVoice(synth, language)) finish(); };
    const aborted = () => finish();
    const timer = setTimeout(finish, 1000);
    synth.addEventListener('voiceschanged', changed);
    signal.addEventListener('abort', aborted, { once: true });
  });
}

export default function ReadAloud({ slug, page, adviceNumber }) {
  const [state, setState] = useState('idle'), [message, setMessage] = useState('');
  const active = useRef({});
  const language = page.language || null;

  function release() {
    const current = active.current;
    current.controller?.abort();
    if (current.audio) { current.audio.onended = null; current.audio.pause(); current.audio.removeAttribute('src'); current.audio.load(); }
    if (current.url) URL.revokeObjectURL(current.url);
    if (current.utterance) { current.utterance.onend = null; current.utterance.onerror = null; }
    window.speechSynthesis?.cancel();
    active.current = {};
  }
  useEffect(() => () => { release(); }, []);
  function stop() { release(); setState('idle'); setMessage(''); }

  async function listen() {
    release(); setState('loading'); setMessage('Preparing speech…');
    const controller = new AbortController(); active.current = { controller };
    try {
      const blob = await requestAudio(`/tts/${encodeURIComponent(slug)}`, { page: adviceNumber, offset: page.offset, length: page.text.length, language }, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), audio = new Audio(url);
      active.current = { controller, url, audio };
      audio.onended = () => { release(); setState('idle'); setMessage(''); };
      await audio.play();
      if (!controller.signal.aborted) { setState('playing'); setMessage('Playing with Gnani Timbre.'); }
      return;
    } catch {
      if (controller.signal.aborted) return;
    }
    release();
    const fallback = new AbortController(); active.current = { controller: fallback };
    const synth = window.speechSynthesis;
    const voice = await waitForVoice(synth, language, fallback.signal);
    if (fallback.signal.aborted) return;
    if (!voice || typeof SpeechSynthesisUtterance === 'undefined') { setState('idle'); setMessage('Read Aloud is unavailable for this language on this device.'); return; }
    const utterance = new SpeechSynthesisUtterance(page.text);
    utterance.voice = voice; utterance.lang = voice.lang;
    utterance.onend = () => { release(); setState('idle'); setMessage(''); };
    utterance.onerror = () => { release(); setState('idle'); setMessage('Browser speech could not play.'); };
    active.current.utterance = utterance;
    try { synth.speak(utterance); setState('browser-playing'); setMessage(`Playing with your browser's ${voice.lang} voice (Gnani unavailable).`); }
    catch { release(); setState('idle'); setMessage('Browser speech could not play.'); }
  }

  function pause() { if (active.current.audio) active.current.audio.pause(); else window.speechSynthesis?.pause(); setState('paused'); setMessage('Paused.'); }
  async function resume() {
    try { if (active.current.audio) { await active.current.audio.play(); setState('playing'); setMessage('Playing with Gnani Timbre.'); } else { window.speechSynthesis.resume(); setState('browser-playing'); setMessage('Playing with a matching browser voice.'); } }
    catch { stop(); setMessage('Could not resume audio.'); }
  }

  return <div className="read-aloud" aria-label="Read current advice aloud">
    <span>Read aloud</span>
    {state === 'idle' || state === 'loading' ? <button type="button" disabled={state === 'loading'} onClick={listen}>{state === 'loading' ? 'Preparing…' : 'Listen'}</button> : state === 'paused' ? <button type="button" onClick={resume}>Resume</button> : <button type="button" onClick={pause}>Pause</button>}
    {state !== 'idle' && <button type="button" onClick={stop}>Stop</button>}
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
