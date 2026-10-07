'use client';
import { useEffect, useRef, useState } from 'react';
import type { Book } from '@/app/data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { ROUND_GOAL, NEW_ROUND_GOALS, type RatingRoundState, type RoundAction } from '@/lib/taste-test/rating-round';
import { MIN_RATING, MAX_RATING } from '@/lib/ratings/model';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { BookCover } from './LumiScoreHome';
import { buildRoundRequest } from '@/lib/taste-test/round-request';
import { readRoundPause, writeRoundPause } from '@/lib/taste-test/round-pause';
import { useLumiScoreLocale } from './LumiScoreLocale';
type Response = { authenticated: boolean; available: boolean; state: RatingRoundState | null; book: Book | null };
export function RatingTasteTest({ authState, swipePrototype }: { authState: HeaderAuthState; swipePrototype: boolean }) {
  const { locale } = useLumiScoreLocale();
  const nl = locale === 'nl';
  const [data, setData] = useState<Response | null>(null);
  const [goal, setGoal] = useState<number>(10);
  const [score, setScore] = useState<number | null>(null);
  const [intent, setIntent] = useState<'read' | 'skip' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [searchError, setSearchError] = useState(false);
  const lock = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const receive = (next: Response) => {
    setData(next);
    try { setPaused(Boolean(next.state?.round && !next.state.round.complete && readRoundPause(sessionStorage, next.state.round.id))); }
    catch { /* Keep the in-memory pause choice if optional storage is unavailable. */ }
  };
  const reload = async () => {
    try { const r = await fetch('/api/taste-test/rounds', { cache: 'no-store' }); if (!r.ok) throw new Error(); receive(await r.json()); setError(false); }
    catch { setError(true); }
  };
  useEffect(() => { const controller = new AbortController(); fetch('/api/taste-test/rounds', { cache: 'no-store', signal: controller.signal }).then(async r => {
    if (!r.ok) throw new Error(); const next = await r.json() as Response; if (!controller.signal.aborted) receive(next);
  }).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); return; }
      fetch(`/api/catalog/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(async r => {
        if (!r.ok) throw new Error(); const result = await r.json() as { results?: Book[] }; if (!controller.signal.aborted) { setResults(result.results ?? []); setSearchError(false); }
      }).catch(() => { if (!controller.signal.aborted) setSearchError(true); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const act = async (action: RoundAction['action'], workId?: string, rating?: number, extensionGoal?: number) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(false); setSaved(false);
    try {
      const r = await fetch('/api/taste-test/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRoundRequest(action, data?.state ?? null, locale, goal, workId, rating, extensionGoal)) });
      if (!r.ok) throw new Error();
      const next = await r.json() as Response;
      if (action === 'resume' && data?.state?.round) {
        try { writeRoundPause(sessionStorage, data.state.round.id, false); } catch { /* Storage is optional. */ }
      }
      setData(next); setPaused(false); setScore(null); setIntent(null); setResults([]); setQuery('');
      setSaved(action === 'rate');
      if (action === 'rate') { try { sessionStorage.setItem('lumiscore-rating-changed', '1'); } catch { /* Optional. */ } }
    } catch { setError(true); } finally { lock.current = false; setPending(false); }
  };
  const round = data?.state?.round;
  const book = data?.book;
  const workId = book?.workId;
  useEffect(() => {
    // Choosing a search result must also bring the next scoring controls into view.
    if (workId) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [workId]);
  const pause = () => {
    if (!round || pending) return;
    try { writeRoundPause(sessionStorage, round.id, true); } catch { /* Storage is optional. */ }
    setPaused(true); setSaved(false);
  };
  return <DiscoveryPageShell authState={authState} path="/taste-test"><section className="featured-section taste-rating-test" aria-labelledby="taste-rating-title">
    <div className="taste-round-heading">
      <h1 id="taste-rating-title">{nl ? 'Smaaktest' : 'Taste test'}</h1>
      {data?.authenticated && data.available && <div className="taste-round-toolbar">
        <span className="rating-round-progress" aria-live="polite" aria-label={nl ? 'Beoordeelde boeken' : 'Books rated'}>{round?.ratedCount ?? 0}/{round?.goal ?? (round ? ROUND_GOAL : goal)}</span>
        {round && !round.complete && (paused
          ? <button type="button" disabled={pending} onClick={() => act('resume')}>{nl ? 'Hervatten' : 'Resume'}</button>
          : <button type="button" disabled={pending} onClick={pause}>{nl ? 'Pauzeren' : 'Pause'}</button>)}
      </div>}
    </div>
    {swipePrototype && <p className="prototype-label">{nl ? 'Reviewprototype — swipes kiezen alleen een intentie, nooit een score.' : 'Review prototype — swipes choose intent, never a score.'}</p>}
    {error && <div role="alert"><p>{nl ? 'De actie is niet bevestigd. Bestaande ratings worden nooit overschreven. Vernieuw je voortgang om een eventuele opgeslagen actie te controleren.' : 'The action was not confirmed. Existing ratings are never overwritten. Refresh progress to check whether an action was saved.'}</p><button type="button" disabled={pending} onClick={reload}>{nl ? 'Voortgang vernieuwen' : 'Refresh progress'}</button></div>}
    {!data && !error && <p role="status">{nl ? 'Voortgang laden…' : 'Loading progress…'}</p>}
    {data && !data.authenticated ? <><p>{nl ? 'Meld je aan om echte ratings en rondes op te slaan. De bestaande gasttest bewaart alleen smaakkeuzes op dit apparaat, geen boekratings.' : 'Sign in to save real ratings and rounds. The existing guest test only saves taste choices on this device, not book ratings.'}</p><a className="primary-cta" href="/login?next=%2Ftaste-test">{nl ? 'Aanmelden en beoordelen' : 'Sign in and rate'}</a><a href="/taste-test/preferences">{nl ? 'Gastvoorkeuren hervatten' : 'Resume guest preferences'}</a></>
      : data && !data.available ? <p role="status">{nl ? 'Deze review wacht op de voortgangsmigratie in een aparte testdatabase. Op productie worden geen testratings geschreven.' : 'This review awaits the progress migration in a separate test database. No test ratings are written to production.'}</p>
      : data?.authenticated && <>
        {round && !round.complete && <div className="taste-feedback" role="status">{paused
          ? (nl ? 'Gepauzeerd — voortgang bewaard.' : 'Paused — progress saved.')
          : saved ? (nl ? 'Beoordeling opgeslagen.' : 'Rating saved.') : ''}</div>}
        {saved && round?.complete && <p className="taste-saved" role="status">{nl ? 'Beoordeling opgeslagen.' : 'Rating saved.'}</p>}
        {(!round || round.complete) && <><div className="taste-round-choices" role="group" aria-label={nl ? 'Aantal boeken' : 'Number of books'}>{NEW_ROUND_GOALS.map(n => <button type="button" key={n} disabled={pending} aria-pressed={goal === n} onClick={() => setGoal(n)}>{n}</button>)}</div>
          <button className="primary-cta" type="button" disabled={pending} onClick={() => act('start')}>{nl ? 'Starten' : 'Start'}</button></>}
        {round && !round.complete && !paused && <>
          {book && <article className="book-card taste-rating-card" tabIndex={swipePrototype ? 0 : undefined} aria-label={swipePrototype ? nl ? 'Swipekaart: links voor overslaan, rechts voor scorekeuze.' : 'Swipe card: left for skip, right for score choices.' : undefined}
            onKeyDown={e => { if (!swipePrototype || pending || e.target !== e.currentTarget) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setIntent(e.key === 'ArrowLeft' ? 'skip' : 'read'); } }}
            onPointerDown={e => { if (swipePrototype && !pending && !(e.target as HTMLElement).closest('button,a,input,select')) swipeStart.current = { x: e.clientX, y: e.clientY }; }}
            onPointerCancel={() => { swipeStart.current = null; }}
            onPointerUp={e => { const start = swipeStart.current; swipeStart.current = null; if (!start || !swipePrototype || pending) return; const dx = e.clientX - start.x; if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 2) setIntent(dx > 0 ? 'read' : 'skip'); }}>
            <div className="taste-book-identity">
              <BookCover book={book} presentation="taste" resolveMissing={false} />
              <div className="book-card-body"><h3 title={book.title}>{book.title}</h3><p title={book.author}>{book.author}</p></div>
            </div>
            <div className="taste-rating-actions">
            {swipePrototype && <div><button type="button" disabled={pending} onClick={() => setIntent('skip')}>{nl ? 'Onbekend / overslaan' : 'Unknown / skip'}</button><button type="button" disabled={pending} onClick={() => setIntent('read')}>{nl ? 'Gelezen — kies score' : 'Read — choose score'}</button></div>}
            {(!swipePrototype || intent === 'read') && <><fieldset disabled={pending}><legend>{nl ? 'Jouw beoordeling' : 'Your rating'}</legend><div className="taste-score-buttons">{Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, i) => i + MIN_RATING).map(n => <button type="button" key={n} aria-pressed={score === n} onClick={() => { setScore(n); setSaved(false); }}>{n}</button>)}</div></fieldset>
              </>}
            <div className="taste-save-skip">
            {(!swipePrototype || intent === 'read') && <button className="primary-cta" type="button" disabled={pending || score === null || !book.workId} onClick={() => act('rate', book.workId!, score!)}>{nl ? 'Opslaan' : 'Save rating'}</button>}
            {(!swipePrototype || intent === 'skip') && <button type="button" disabled={pending || !book.workId} onClick={() => act('skip', book.workId!)}>{nl ? 'Overslaan' : 'Skip'}</button>}
            </div>
            {swipePrototype && intent && <button type="button" disabled={pending} onClick={() => { setIntent(null); setScore(null); }}>{nl ? 'Annuleren' : 'Cancel'}</button>}
            </div>
          </article>}
          {data.state?.exhausted && <p role="status">{nl ? 'Geen nieuwe boeken meer in deze taal. We herhalen geen oude aanbiedingen. Zoek bewust een ander gelezen, nog niet beoordeeld boek of probeer later opnieuw.' : 'No new books remain in this language. We do not repeat previous offers. Deliberately search for another read, unrated book or try again later.'}<button type="button" disabled={pending} onClick={() => act('resume')}>{nl ? 'Nieuwe voorraad controleren' : 'Check for new inventory'}</button></p>}
          <details className="taste-book-search"><summary>{nl ? 'Zoek een gelezen boek' : 'Find a book you have read'}</summary>
          <label><span className="sr-only">{nl ? 'Boek zoeken' : 'Search books'}</span><input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} /></label>
          {searchError && <p role="status">{nl ? 'Zoeken is tijdelijk niet beschikbaar.' : 'Search is temporarily unavailable.'}</p>}
          <ul className="taste-search-results">{results.filter(b => b.workId && b.workId !== book?.workId).map(b => <li key={b.workId}><button type="button" disabled={pending} onClick={() => act('choose', b.workId!)}>{b.title} — {b.author}</button></li>)}</ul>
          </details>
        </>}
        {round && (round.ratedCount >= 10 || data.state?.exhausted || round.complete) && <a className="primary-cta taste-result-link" href="/taste-test/result">{nl ? 'Resultaat bekijken' : 'See result'}</a>}
      </>}
  </section></DiscoveryPageShell>;
}
