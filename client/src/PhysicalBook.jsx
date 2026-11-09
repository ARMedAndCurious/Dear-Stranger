import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildSpreads } from './paginateText';

function Page({ page, number, empty = false }) {
  return <div className="book-page-content">{page && <><div className="book-page-text" style={{ fontSize: `${page.fontSize}px` }} lang={page.language || undefined}>{page.text}</div><span className="book-page-number">{number}</span></>}{empty && <div className="book-page-empty">No advice pages have been added yet. Every story starts with an empty page.</div>}</div>;
}

export default function PhysicalBook({ title, advice, total, open, onOpen, onClose, loadAdvice, disabled }) {
  const frame = useRef(null), measure = useRef(null), cover = useRef(null), close = useRef(null), timer = useRef(null), lock = useRef(false), mounted = useRef(true), focusAfterCover = useRef(false);
  const entries = useRef(advice ? [advice] : []), physical = useRef([]), loadedAll = useRef(total <= (advice ? 1 : 0)), loadRef = useRef(loadAdvice);
  const [pages, setPages] = useState([]), [position, setPosition] = useState(0), [turn, setTurn] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [coverMoving, setCoverMoving] = useState(false);
  loadRef.current = loadAdvice;
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const rebuild = useCallback(() => {
    const box = measure.current;
    if (!box || !box.clientWidth || !box.clientHeight) return [];
    const previous = physical.current;
    const result = buildSpreads(entries.current, (value, size) => { box.style.fontSize = `${size}px`; box.textContent = value; return box.scrollHeight <= box.clientHeight; });
    physical.current = result; setPages(result);
    setPosition(value => {
      const anchor = previous[value];
      if (!anchor) return Math.min(value, Math.max(0, result.length - 1));
      const index = result.findIndex((page, i) => page.entryIndex === anchor.entryIndex && page.offset <= anchor.offset && (!result[i + 1] || result[i + 1].entryIndex !== anchor.entryIndex || result[i + 1].offset > anchor.offset));
      return index < 0 ? Math.min(value, Math.max(0, result.length - 1)) : index;
    });
    return result;
  }, []);
  useLayoutEffect(() => {
    rebuild();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(rebuild) : null;
    if (frame.current) observer?.observe(frame.current);
    window.addEventListener('resize', rebuild);
    const fonts = document.fonts; fonts?.addEventListener?.('loadingdone', rebuild);
    fonts?.ready.then(() => { if (mounted.current) rebuild(); });
    return () => { observer?.disconnect(); window.removeEventListener('resize', rebuild); fonts?.removeEventListener?.('loadingdone', rebuild); };
  }, [rebuild]);
  useEffect(() => () => { mounted.current = false; clearTimeout(timer.current); }, []);
  useEffect(() => { if (focusAfterCover.current) { (open ? close.current : cover.current)?.focus(); focusAfterCover.current = false; } }, [open]);
  async function ensure(index) {
    let current = physical.current;
    while (index >= current.length && entries.current.length < total && !loadedAll.current) {
      const result = await loadRef.current(entries.current.length + 1);
      if (!mounted.current) return [];
      if (!result.advice) { loadedAll.current = true; break; }
      if (result.translationError) setError(result.translationError);
      entries.current.push(result.advice); current = rebuild();
    }
    if (entries.current.length >= total) loadedAll.current = true;
    return current;
  }
  function changeCover(opening) {
    if (lock.current || disabled || opening === open) return;
    lock.current = true; setCoverMoving(true);
    focusAfterCover.current = true;
    if (opening) onOpen(); else onClose();
    // Keep focus within the reader while the same cover rotates in either direction.
    timer.current = setTimeout(() => { lock.current = false; setCoverMoving(false); }, reducedMotion() ? 0 : 800);
  }
  async function navigate(direction) {
    if (!open || lock.current || disabled || !total) return;
    const target = direction > 0 ? position + 1 : Math.max(0, position - 1);
    if (target === position) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const available = direction > 0 ? await ensure(target) : physical.current;
      if (!mounted.current) return;
      if (direction > 0 && target >= available.length) { lock.current = false; setBusy(false); return; }
      setTurn({ direction, target }); setBusy(false);
      timer.current = setTimeout(() => { setPosition(target); setTurn(null); lock.current = false; }, reducedMotion() ? 0 : 680);
    } catch { if (mounted.current) { setError('Could not load the next page. Please try again.'); setBusy(false); lock.current = false; } }
  }
  function keyDown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigate(event.key === 'ArrowLeft' ? -1 : 1); }
  }
  const turningForward = turn?.direction === 1, turningBack = turn?.direction === -1;
  const right = pages[position];
  const target = turn?.target ?? position;
  const underneath = turn ? pages[target] : right;
  const leafFront = turningBack ? pages[target] : right;
  const canNext = position + 1 < pages.length || !loadedAll.current;
  return <section className="physical-reader" aria-label="Notebook reader" onKeyDown={keyDown}>
    <div className={`book-object ${open ? 'book-object-open' : ''} ${turn ? `book-turn-${turn.direction > 0 ? 'next' : 'previous'}` : ''}`} ref={frame}>
      <div className="book-back-cover" aria-hidden="true"/>
      <div className="book-left-page" aria-hidden="true"><span className="book-page-ornament">✳</span>{total > 0 && <span className="book-page-number">{position * 2 + 1}</span>}</div>
      <div className="book-right-page" aria-hidden={!open}><Page page={underneath} number={(turn ? target : position) * 2 + 2} empty={!total}/></div>
      {turn && <div className="book-turning-leaf" aria-hidden="true"><div className="book-leaf-front"><Page page={leafFront} number={(turningBack ? target : position) * 2 + 2}/></div><div className="book-leaf-back"><span className="book-page-ornament">✳</span><span className="book-page-number">{(turningForward ? target : position) * 2 + 1}</span></div></div>}
      <div className="book-measure-page" aria-hidden="true"><div className="book-page-text book-measure-text" ref={measure}/></div>
      <div className="book-cover-hinge"><button ref={cover} type="button" className="book-cover-front" onClick={() => changeCover(true)} aria-label={`Open notebook: ${title}`} tabIndex={open ? -1 : 0}><span>{title}</span></button><div className="book-cover-inside" aria-hidden="true"/></div>
    </div>
    <div className={`book-controls ${open ? 'book-controls-open' : ''}`} aria-hidden={!open}>
      <button type="button" onClick={() => navigate(-1)} aria-disabled={!open || coverMoving || busy || !!turn || position === 0} tabIndex={open ? 0 : -1} aria-label="Previous pages">← Previous</button>
      <span aria-live="polite">{busy ? 'Opening pages…' : !total ? 'Empty notebook' : right ? `Advice ${right.entryIndex + 1} of ${total}${right.partCount > 1 ? ` · Part ${right.partIndex + 1} of ${right.partCount}` : ''} · Pages ${position * 2 + 1}–${position * 2 + 2}` : 'Preparing pages…'}</span>
      <button type="button" onClick={() => navigate(1)} aria-disabled={!open || coverMoving || busy || !!turn || !total || !canNext} tabIndex={open ? 0 : -1} aria-label="Next pages">Next →</button>
      <button ref={close} type="button" className="book-close" onClick={() => changeCover(false)} aria-disabled={!open || busy || !!turn} tabIndex={open ? 0 : -1}>Close notebook</button>
    </div>
    {open && pages[position]?.translated && <p className="book-translation-label">Translated text</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
