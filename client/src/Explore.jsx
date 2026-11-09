import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from './api';

const categories = ['Love & Relationships', 'Family', 'Friendship', 'Career & Studies', 'Personal Growth', 'Life Lessons', 'Other', 'Uncategorized'];

export default function Explore() {
  const [input, setInput] = useState(''), [search, setSearch] = useState(''), [category, setCategory] = useState('');
  const [page, setPage] = useState(1), [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    request(`/notebooks/discover/list?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&page=${page}`)
      .then(result => { if (active) setData(result); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [search, category, page]);
  return <main className="explore">
    <p className="eyebrow">A LIBRARY OF OPEN PAGES</p><h1>Explore notebooks<span>.</span></h1>
    <p className="muted">Read advice from strangers, or leave a few words of your own. No account needed to contribute.</p>
    <Link className="button" to="/a-page-for-you">A Page for You ↗</Link>
    <form className="explore-search" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(input.trim()); }}>
      <label htmlFor="search-books">Search by title</label><div><input id="search-books" value={input} maxLength="100" onChange={e => setInput(e.target.value)} placeholder="Find a notebook…"/><button className="button">Search</button></div>
      <label htmlFor="category-filter">Category</label><select id="category-filter" value={category} onChange={e => { setPage(1); setCategory(e.target.value); }}><option value="">All Categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Finding notebooks…</p>}
    {data && !data.notebooks.length && <div className="empty-dashboard"><div aria-hidden="true">✳</div><h2>{search || category ? 'No matching notebooks.' : 'No public notebooks yet.'}</h2><p>{search || category ? 'Try another search or category.' : 'Only public notebooks appear here. Unlisted notebooks remain available by link.'}</p></div>}
    {data && <><p className="muted explore-count" aria-live="polite">{data.total} public {data.total === 1 ? 'notebook' : 'notebooks'}</p>
      <div className="bookshelf">{data.notebooks.map(book => <article className="cover" key={book.slug}>
        <p className="cover-label">DEAR, STRANGER &nbsp; ✳ &nbsp; {book.category || 'Uncategorized'}</p>
        <h2><Link to={`/n/${book.slug}`}>{book.title}</Link></h2><p className="cover-description">{book.description || 'A little space for words that matter.'}</p>
        <div className="cover-bottom"><span>{book.approvedCount} {book.approvedCount === 1 ? 'PAGE' : 'PAGES'}</span><div className="cover-actions"><Link to={`/n/${book.slug}`}>Read notebook</Link><Link to={`/n/${book.slug}#contribute`}>Leave advice</Link></div></div>
      </article>)}</div>
      <div className="page-nav"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span><button disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Next →</button></div>
    </>}
  </main>;
}
