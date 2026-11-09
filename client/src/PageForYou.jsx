import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from './api';

const languages = [['en', 'English'], ['hi', 'Hindi'], ['kn', 'Kannada'], ['ta', 'Tamil'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['ml', 'Malayalam'], ['mr', 'Marathi'], ['pa', 'Punjabi'], ['te', 'Telugu']];

export default function PageForYou() {
  const [data, setData] = useState(null), [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState({});

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(query);
    request(`/advice/random?${params}`).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  function load(nextQuery) { setError(''); setLoading(true); setQuery(nextQuery); }
  function changeLanguage(value) {
    setLanguage(value);
    if (data?.advice) load({ id: data.advice.id, ...(value && { language: value }) });
  }
  return <main className="page-for-you">
    <Link className="page-back" to="/explore">← Explore notebooks</Link>
    <p className="eyebrow">A LITTLE SOMETHING, JUST FOR YOU</p>
    <h1>A page for <em>you.</em></h1>
    <p className="muted">A stranger’s words, waiting to find you.</p>
    {loading ? <p role="status" className="page-message">Finding a page for you…</p> : error ? <div className="page-message"><p className="error" role="alert">{error}</p><button className="text-button" onClick={() => load(data?.advice ? { id: data.advice.id, ...(language && { language }) } : {})}>Try again</button></div> : !data?.advice ? <div className="page-message"><span aria-hidden="true">✳</span><h2>No pages to discover just yet.</h2><p>Come back later, or explore the notebooks.</p><Link to="/explore">Explore notebooks ↗</Link></div> : <>
      <article className="found-page"><p className="eyebrow">A NOTE FROM A STRANGER &nbsp; ✳</p><div className="found-page-text">{data.advice.translatedText || data.advice.originalText}</div><p className="found-page-source">From <em>{data.advice.notebook.title}</em></p></article>
      <label className="reading-language">Read in<select value={language} onChange={e => changeLanguage(e.target.value)}><option value="">Original language</option>{languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      {data.translationError && <p className="muted" role="status">{data.translationError}</p>}
      <div className="found-page-actions"><button className="button" onClick={() => load({ exclude: data.advice.id, ...(language && { language }) })}>Another page →</button><Link className="text-button" to={`/n/${encodeURIComponent(data.advice.notebook.slug)}`}>Open this notebook ↗</Link></div>
    </>}
  </main>;
}
