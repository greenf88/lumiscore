'use client';
import { useEffect, useState } from 'react';
import type { AuthorOption } from '@/lib/catalog/discovery';
export function AuthorFilter({ selected, id, nl }: { selected: AuthorOption | null; id: string; nl: boolean }) {
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState(selected);
  const [authorId, setAuthorId] = useState(id);
  const [results, setResults] = useState<AuthorOption[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); return; }
      fetch(`/api/catalog/authors?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => { if (!controller.signal.aborted) { setResults((data as { authors: AuthorOption[] }).authors); setError(false); } })
        .catch(() => { if (!controller.signal.aborted) setError(true); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <fieldset><legend>{nl ? 'Schrijver' : 'Author'}</legend>
    <input type="hidden" name="author" value={authorId} />
    {authorId && <span>{author?.name ?? `Author #${authorId}`} <button type="button" onClick={() => { setAuthor(null); setAuthorId(''); setQuery(''); }}>{nl ? 'Verwijder schrijver' : 'Remove author'}</button></span>}
    <label>{nl ? 'Zoek en selecteer een schrijver' : 'Find and select an author'}
      <input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} autoComplete="off" /></label>
    {error && <p role="status">{nl ? 'Schrijvers zoeken is tijdelijk niet beschikbaar.' : 'Author search is temporarily unavailable.'}</p>}
    {results.length > 0 && <ul>{results.map(a => <li key={a.id}><button type="button" onClick={() => { setAuthor(a); setAuthorId(a.id); setQuery(''); setResults([]); }}>{a.name}</button></li>)}</ul>}
  </fieldset>;
}
