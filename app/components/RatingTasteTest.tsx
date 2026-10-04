'use client';
import { useEffect, useRef, useState } from 'react';
import type { Book } from '@/app/data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { ROUND_GOAL, NEW_ROUND_GOALS, type RatingRoundState, type RoundAction } from '@/lib/taste-test/rating-round';
import { MIN_RATING, MAX_RATING } from '@/lib/ratings/model';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { BookCover } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
type Response = { authenticated: boolean; available: boolean; state: RatingRoundState | null; book: Book | null };
export function RatingTasteTest({ authState, swipePrototype }: { authState: HeaderAuthState; swipePrototype: boolean }) {
  const { locale } = useLumiScoreLocale();
  const nl = locale === 'nl';
  const [data, setData] = useState<Response | null>(null);
  const [language, setLanguage] = useState<'nl' | 'en'>(locale);
  const [goal, setGoal] = useState<number>(10);
  const [score, setScore] = useState<number | null>(null);
  const [intent, setIntent] = useState<'read' | 'skip' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [searchError, setSearchError] = useState(false);
  const lock = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const reload = async () => {
    try { const r = await fetch('/api/taste-test/rounds', { cache: 'no-store' }); if (!r.ok) throw new Error(); setData(await r.json()); setError(false); }
    catch { setError(true); }
  };
  useEffect(() => { const controller = new AbortController(); fetch('/api/taste-test/rounds', { cache: 'no-store', signal: controller.signal }).then(async r => {
    if (!r.ok) throw new Error(); const next = await r.json() as Response; if (!controller.signal.aborted) setData(next);
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
    lock.current = true; setPending(true); setError(false);
    try {
      const r = await fetch('/api/taste-test/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, roundId: data?.state?.round?.id, workId, score: rating, language, goal:action==='start' ? goal : action==='extend' ? extensionGoal : undefined }) });
      if (!r.ok) throw new Error();
      setData(await r.json()); setScore(null); setIntent(null); setResults([]); setQuery('');
      if (action === 'rate') { try { sessionStorage.setItem('lumiscore-rating-changed', '1'); } catch { /* Optional. */ } }
    } catch { setError(true); } finally { lock.current = false; setPending(false); }
  };
  const round = data?.state?.round;
  const book = data?.book;
  return <DiscoveryPageShell authState={authState} path="/taste-test"><section className="featured-section taste-rating-test" aria-labelledby="taste-rating-title">
    <h1 id="taste-rating-title">{nl ? 'Ontdek je leessmaak' : 'Discover your reading taste'}</h1>
    <p>{nl ? 'Kies 10, 15 of 30 verschillende boeken die je echt hebt gelezen, met dezelfde 1–10-schaal als op de boekpagina. Na tien beoordelingen kun je al je resultaat bekijken. Onbekend of overslaan telt niet mee. Je kunt altijd pauzeren.' : 'Choose 10, 15 or 30 different books you have actually read, on the same 1–10 scale as the book page. After ten ratings you can already see your result. Unknown books and skips do not count. Pause at any time.'}</p>
    {swipePrototype && <p className="prototype-label">{nl ? 'Reviewprototype — swipes kiezen alleen een intentie, nooit een score.' : 'Review prototype — swipes choose intent, never a score.'}</p>}
    {error && <div role="alert"><p>{nl ? 'De actie is niet bevestigd. Bestaande ratings worden nooit overschreven. Vernieuw je voortgang om een eventuele opgeslagen actie te controleren.' : 'The action was not confirmed. Existing ratings are never overwritten. Refresh progress to check whether an action was saved.'}</p><button type="button" disabled={pending} onClick={reload}>{nl ? 'Voortgang vernieuwen' : 'Refresh progress'}</button></div>}
    {!data && !error && <p role="status">{nl ? 'Voortgang laden…' : 'Loading progress…'}</p>}
    {data && !data.authenticated ? <><p>{nl ? 'Meld je aan om echte ratings en rondes op te slaan. De bestaande gasttest bewaart alleen smaakkeuzes op dit apparaat, geen boekratings.' : 'Sign in to save real ratings and rounds. The existing guest test only saves taste choices on this device, not book ratings.'}</p><a className="primary-cta" href="/login?next=%2Ftaste-test">{nl ? 'Aanmelden en beoordelen' : 'Sign in and rate'}</a><a href="/taste-test/preferences">{nl ? 'Gastvoorkeuren hervatten' : 'Resume guest preferences'}</a></>
      : data && !data.available ? <p role="status">{nl ? 'Deze review wacht op de voortgangsmigratie in een aparte testdatabase. Op productie worden geen testratings geschreven.' : 'This review awaits the progress migration in a separate test database. No test ratings are written to production.'}</p>
      : data?.authenticated && <>
        <p aria-live="polite">{nl ? 'Ronde' : 'Round'} {round?.number ?? 1}: {round?.ratedCount ?? 0} {nl ? 'van' : 'of'} {round?.goal ?? (round ? ROUND_GOAL : goal)} {nl ? 'boeken beoordeeld' : 'books rated'}</p>
        {round && (round.ratedCount>=10 || data.state?.exhausted || round.complete) && <p><a className="primary-cta" href="/taste-test/result">{nl?'Bekijk je persoonlijke resultaat':'See your personal result'}</a> {nl?'Eerdere beoordelingen helpen je totale profiel, maar tellen niet als nieuwe antwoorden.':'Earlier ratings help your overall profile but do not count as new answers.'}</p>}
        {round && [10,15].includes(round.goal ?? 20) && <div><p>{nl?'Vrijwillig uitbreiden — meer beoordelingen helpen je profiel verfijnen.':'Extend voluntarily — more ratings help refine your profile.'}</p>{[15,30].filter(n=>n>(round.goal ?? 20)).map(n=><button key={n} disabled={pending} onClick={()=>act('extend',undefined,undefined,n)}>{nl?`Doorgaan tot ${n}`:`Continue to ${n}`}</button>)}</div>}
        {(!round || round.complete) && <><label>{nl ? 'Boektaal voor de volgende ronde' : 'Book language for the next round'} <select value={language} onChange={e => setLanguage(e.target.value as 'nl' | 'en')}><option value="nl">Nederlands</option><option value="en">English</option></select></label>
          <label>{nl?'Lengte van de nieuwe ronde':'New round length'} <select value={goal} onChange={e=>setGoal(Number(e.target.value))}>{NEW_ROUND_GOALS.map(n=><option value={n} key={n}>{n} — {n===10 ? nl?'Snelle kennismaking':'Quick introduction' : n===15 ? nl?'Uitgebreider profiel':'Broader profile' : nl?'Meer diepgang':'More depth'}</option>)}</select></label>
          {round?.complete && <p>{nl ? 'Je expliciete ratings zijn opgeslagen, ook op je boekpagina en in je profiel.' : 'Your explicit ratings are saved, also on book pages and in your profile.'}</p>}
          <button className="primary-cta" type="button" disabled={pending} onClick={() => act('start')}>{round?.complete ? nl ? 'Vrijwillig volgende ronde starten' : 'Start another round voluntarily' : nl ? 'Start ronde 1' : 'Start round 1'}</button></>}
        {round && !round.complete && <>
          <p>{nl ? 'Boektaal' : 'Book language'}: {round.language === 'nl' ? 'Nederlands' : 'English'} · <a href="/">{nl ? 'Pauzeren — voortgang blijft bewaard' : 'Pause — progress remains saved'}</a></p>
          {book && <article className="taste-rating-card" tabIndex={swipePrototype ? 0 : undefined} aria-label={swipePrototype ? nl ? 'Swipekaart: links voor overslaan, rechts voor scorekeuze.' : 'Swipe card: left for skip, right for score choices.' : undefined}
            onKeyDown={e => { if (!swipePrototype || pending || e.target !== e.currentTarget) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setIntent(e.key === 'ArrowLeft' ? 'skip' : 'read'); } }}
            onPointerDown={e => { if (swipePrototype && !pending && !(e.target as HTMLElement).closest('button,a,input,select')) swipeStart.current = { x: e.clientX, y: e.clientY }; }}
            onPointerCancel={() => { swipeStart.current = null; }}
            onPointerUp={e => { const start = swipeStart.current; swipeStart.current = null; if (!start || !swipePrototype || pending) return; const dx = e.clientX - start.x; if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 2) setIntent(dx > 0 ? 'read' : 'skip'); }}>
            <BookCover book={book} resolveMissing={false} /><h2>{book.title}</h2><p>{book.author}</p>
            {swipePrototype && <div><button type="button" disabled={pending} onClick={() => setIntent('skip')}>{nl ? 'Onbekend / overslaan' : 'Unknown / skip'}</button><button type="button" disabled={pending} onClick={() => setIntent('read')}>{nl ? 'Gelezen — kies score' : 'Read — choose score'}</button></div>}
            {(!swipePrototype || intent === 'read') && <><fieldset disabled={pending}><legend>{nl ? 'Jouw expliciete boekrating (1–10)' : 'Your explicit book rating (1–10)'}</legend><div className="taste-score-buttons">{Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, i) => i + MIN_RATING).map(n => <button type="button" key={n} aria-pressed={score === n} onClick={() => setScore(n)}>{n}</button>)}</div></fieldset>
              <button className="primary-cta" type="button" disabled={pending || score === null} onClick={() => act('rate', book.workId!, score!)}>{nl ? `Score ${score ?? '—'} bevestigen en opslaan` : `Confirm and save score ${score ?? '—'}`}</button></>}
            {(!swipePrototype || intent === 'skip') && <button type="button" disabled={pending} onClick={() => act('skip', book.workId!)}>{swipePrototype ? nl ? 'Overslaan bevestigen — geen rating' : 'Confirm skip — no rating' : nl ? 'Niet gelezen / ken ik niet / overslaan' : 'Not read / unknown / skip'}</button>}
            {swipePrototype && intent && <button type="button" disabled={pending} onClick={() => { setIntent(null); setScore(null); }}>{nl ? 'Annuleren' : 'Cancel'}</button>}
          </article>}
          {data.state?.exhausted && <p role="status">{nl ? 'Geen nieuwe boeken meer in deze taal. We herhalen geen oude aanbiedingen. Zoek bewust een ander gelezen, nog niet beoordeeld boek of probeer later opnieuw.' : 'No new books remain in this language. We do not repeat previous offers. Deliberately search for another read, unrated book or try again later.'}<button type="button" disabled={pending} onClick={() => act('resume')}>{nl ? 'Nieuwe voorraad controleren' : 'Check for new inventory'}</button></p>}
          <label>{nl ? 'Zoek zelf een gelezen boek' : 'Find a book you have read'}<input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} /></label>
          {searchError && <p role="status">{nl ? 'Zoeken is tijdelijk niet beschikbaar.' : 'Search is temporarily unavailable.'}</p>}
          <p>{nl ? 'Een ander boek kiezen slaat het huidige aanbod over, zonder rating. Al beoordeelde of eerder aangeboden boeken worden niet herhaald.' : 'Choosing another book skips the current offer without a rating. Rated or previously offered books are not repeated.'}</p>
          <ul className="taste-search-results">{results.filter(b => b.workId && b.workId !== book?.workId).map(b => <li key={b.workId}><button type="button" disabled={pending} onClick={() => act('choose', b.workId!)}>{b.title} — {b.author}</button></li>)}</ul>
        </>}
      </>}
  </section></DiscoveryPageShell>;
}
