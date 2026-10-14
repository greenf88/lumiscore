'use client';

import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';
import { localizedHref } from '@/lib/i18n/paths';
import { useEffect, useRef, useState } from 'react';
import type { Book } from '@/app/data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { NEW_ROUND_GOALS, type RatingRoundState, type RoundAction } from '@/lib/taste-test/rating-round';
import { MIN_RATING, MAX_RATING } from '@/lib/ratings/model';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { BookCover } from './LumiScoreHome';
import { buildRoundRequest } from '@/lib/taste-test/round-request';
import { readRoundPause, writeRoundPause } from '@/lib/taste-test/round-pause';
import { shouldOpenCompletedResult } from '@/lib/taste-test/result-presentation';
import { canOpenRoundResult, createRoundActionGate, isPendingWorkScore, roundProgress, type PendingWorkScore } from '@/lib/taste-test/direct-rating';

type Response = { authenticated: boolean; available: boolean; state: RatingRoundState | null; book: Book | null };
const scores = Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, i) => i + MIN_RATING);

export function RatingTasteTest({ authState, swipePrototype }: { authState: HeaderAuthState; swipePrototype: boolean }) {
  const { locale, t } = useLumiScoreLocale();
  const [data, setData] = useState<Response | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedScore, setSelectedScore] = useState<PendingWorkScore>(null);
  const [prototypeIntent, setPrototypeIntent] = useState<'read' | 'skip' | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [searchError, setSearchError] = useState(false);
  const gate = useRef<ReturnType<typeof createRoundActionGate> | null>(null);
  if (gate.current === null) { gate.current = createRoundActionGate(); }
  const revision = useRef(0);
  const mounted = useRef(true);
  const bookHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);
  const returnFromSearch = useRef(false);
  const round = data?.state?.round;
  const book = data?.book;
  const workId = book?.workId;
  const progress = roundProgress(data?.state ?? null);
  const active = Boolean(round && !round.complete && !paused);
  const hasResult = canOpenRoundResult(data?.state ?? null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const version = revision.current;
    fetch(`/api/taste-test/rounds?locale=${locale}`, { cache: 'no-store', signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const next = await r.json() as Response;
      if (controller.signal.aborted || revision.current !== version) return;
      setData(next); setError(false);
      try { setPaused(Boolean(next.state?.round && !next.state.round.complete && readRoundPause(sessionStorage, next.state.round.id))); }
      catch { /* Optional session storage; server progress is never reset. */ }
    }).catch(() => { if (!controller.signal.aborted && revision.current === version) setError(true); });
    return () => controller.abort();
  }, [locale]);
  useEffect(() => {
    if (focusNext.current && workId && active && !searchOpen) {
      bookHeading.current?.focus({ preventScroll: true });
      if (returnFromSearch.current) {
        bookHeading.current?.closest('article')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        returnFromSearch.current = false;
      }
      focusNext.current = false;
    }
  }, [workId, active, searchOpen]);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!searchOpen || pending || paused || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(async r => {
        if (!r.ok) throw new Error();
        const result = await r.json() as { results?: Book[] };
        if (!controller.signal.aborted) { setResults(result.results ?? []); setSearchError(false); }
      }).catch(() => { if (!controller.signal.aborted) setSearchError(true); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen, pending, paused]);

  const act = (action: RoundAction['action'], chosenWork?: string, rating?: number, goal = 10) => {
    if (!gate.current || gate.current.isBusy()) return;
    if (action === 'start' && round && !round.complete) return;
    const before = data?.state ?? null;
    revision.current++;
    setError(false); setSaved(false);
    setSelectedScore(action === 'rate' && chosenWork && rating !== undefined ? { workId: chosenWork, score: rating } : null);
    return gate.current.run(async () => {
      const r = await fetch(`/api/taste-test/rounds?locale=${locale}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRoundRequest(action, before, locale, goal, chosenWork, rating)),
      });
      if (!r.ok) throw new Error();
      const next = await r.json() as Response;
      if (!next.authenticated || !next.available || !next.state?.round) throw new Error();
      return next;
    }, next => {
      if (!mounted.current) return;
      if (action === 'resume' && before?.round) {
        try { writeRoundPause(sessionStorage, before.round.id, false); } catch { /* Optional. */ }
      }
      focusNext.current = true;
      returnFromSearch.current = action === 'choose';
      setData(next); setSelectedScore(null); setPrototypeIntent(null); setPaused(false); setSearchOpen(false); setResults([]); setQuery('');
      setSaved(action === 'rate');
      if (action === 'rate') {
        try { sessionStorage.setItem('lumiscore-rating-changed', '1'); } catch { /* Optional. */ }
      }
      if (shouldOpenCompletedResult(action, before, next)) window.location.assign(localizedHref('/taste-test/result', locale));
    }, () => { if (mounted.current) setError(true); }, value => {
      if (mounted.current) { setPending(value); if (!value) setSelectedScore(null); }
    });
  };
  const reload = () => {
    if (!gate.current || gate.current.isBusy()) return;
    revision.current++;
    return gate.current.run(async () => {
      const r = await fetch(`/api/taste-test/rounds?locale=${locale}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      return await r.json() as Response;
    }, next => { if (mounted.current) { setData(next); setError(false); } },
    () => { if (mounted.current) setError(true); }, value => { if (mounted.current) setPending(value); });
  };
  const pause = () => {
    if (!round || gate.current?.isBusy()) return;
    try { writeRoundPause(sessionStorage, round.id, true); } catch { /* Optional. */ }
    setPaused(true); setSaved(false); setSearchOpen(false);
  };
  const closeSearch = () => {
    if (gate.current?.isBusy()) return;
    setSearchOpen(false); setQuery(''); setResults([]); setSearchError(false);
    searchButton.current?.focus({ preventScroll: true });
  };

  return <DiscoveryPageShell authState={authState} path="/taste-test">
    <section className="featured-section taste-rating-test taste-direct-test" aria-labelledby="taste-rating-title" aria-busy={pending}>
      <div className="taste-round-heading"><span className="eyebrow">{t('directTaste.label')}</span>
        {active && <button type="button" disabled={pending} onClick={pause}>{t('directTaste.pause')}</button>}
      </div>
      {swipePrototype && <p className="prototype-label">{t('directTaste.prototype')}</p>}
      {error && <div className="taste-action-error" role="alert"><p>{t('directTaste.error')}</p>
        <button type="button" disabled={pending} onClick={reload}>{t('directTaste.refresh')}</button></div>}
      {!data && !error && <p role="status">{t('directTaste.loading')}</p>}
      {data && !data.authenticated ? <><h1 id="taste-rating-title">{t('directTaste.label')}</h1>
        <p>{t('directTaste.signInCopy')}</p><LocaleLink className="primary-cta" href="/login?next=%2Ftaste-test">{t('directTaste.signIn')}</LocaleLink>
        <LocaleLink href="/taste-test/preferences">{t('directTaste.guest')}</LocaleLink></>
        : data && !data.available ? <p role="status">{t('directTaste.unavailable')}</p>
        : data?.authenticated && <>
          {(!round || round.complete) && <div className="taste-start-screen">
            <h1 id="taste-rating-title">{t('directTaste.question')}</h1>
            <div className="taste-start-choices" role="group" aria-label={t('directTaste.question')}>
              {NEW_ROUND_GOALS.map(n => <button type="button" key={n} disabled={pending}
                aria-label={t('directTaste.startChoice', { count: n })} onClick={() => act('start', undefined, undefined, n)}>
                <strong>{n}</strong><span>{t('directTaste.books')}</span>
              </button>)}
            </div>
          </div>}
          {round && !round.complete && <>
            <h1 id="taste-rating-title" className="sr-only">{t('directTaste.label')}</h1>
            <div className="taste-direct-progress" role="status" aria-live="polite" aria-atomic="true">
              <span>{t('directTaste.progress', { rated: progress.rated, goal: progress.goal })}</span>
              <div role="progressbar" aria-label={t('directTaste.ratedBooks')} aria-valuemin={0}
                aria-valuemax={progress.goal} aria-valuenow={progress.rated}><span style={{ width: `${progress.percent}%` }} /></div>
            </div>
            {paused ? <div className="taste-paused"><p role="status">{t('directTaste.paused')}</p>
              <button className="primary-cta" type="button" disabled={pending} onClick={() => act('resume')}>{t('directTaste.resume')}</button></div>
              : <>
                <p className="sr-only" role="status" aria-live="polite">{pending ? t('directTaste.saving') : saved ? t('directTaste.saved') : ''}</p>
                {book && <article className="book-card taste-rating-card" key={`${round.id}:${workId}`}
                  tabIndex={swipePrototype ? 0 : undefined} aria-label={swipePrototype ? t('directTaste.prototype') : undefined}
                  onKeyDown={e => { if (!swipePrototype || gate.current?.isBusy() || e.target !== e.currentTarget) return;
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setPrototypeIntent(e.key === 'ArrowLeft' ? 'skip' : 'read'); } }}
                  onPointerDown={e => { if (swipePrototype && !gate.current?.isBusy() && !(e.target as HTMLElement).closest('button,a,input')) swipeStart.current = { x: e.clientX, y: e.clientY }; }}
                  onPointerCancel={() => { swipeStart.current = null; }}
                  onPointerUp={e => { const start = swipeStart.current; swipeStart.current = null;
                    if (!start || !swipePrototype || gate.current?.isBusy()) return;
                    const dx = e.clientX - start.x;
                    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 2) setPrototypeIntent(dx > 0 ? 'read' : 'skip'); }}>
                  <div className={`taste-book-identity${book.title.length > 90 || book.author.length > 60 ? ' taste-long-identity' : ''}`}><BookCover book={book} presentation="taste" resolveMissing={false} />
                    <div className="book-card-body"><h2 ref={bookHeading} tabIndex={-1}>{book.title}</h2><p>{book.author}</p></div>
                  </div>
                  <div className="taste-rating-actions">
                    {swipePrototype && <div><button type="button" disabled={pending} onClick={() => setPrototypeIntent('skip')}>{locale === 'nl' ? 'Onbekend / overslaan' : 'Unknown / skip'}</button>
                      <button type="button" disabled={pending} onClick={() => setPrototypeIntent('read')}>{locale === 'nl' ? 'Gelezen — kies score' : 'Read — choose score'}</button></div>}
                    {(!swipePrototype || prototypeIntent === 'read') && <fieldset disabled={pending || !workId}><legend>{t('directTaste.yourRating')}</legend>
                    <div className="taste-score-buttons">{scores.map(n => <button type="button" key={n}
                      aria-label={t('directTaste.rate', { score: n })} aria-pressed={isPendingWorkScore(selectedScore, workId, n, pending)}
                      onKeyDown={e => { if (e.repeat) e.preventDefault(); }}
                      onClick={e => { if (e.detail <= 1 && workId) void act('rate', workId, n); }}>{n}</button>)}</div>
                  </fieldset>}
                    {(!swipePrototype || prototypeIntent === 'skip') && <button className="taste-skip-button" type="button" disabled={pending || !workId}
                      onClick={e => { if (e.detail <= 1 && workId) void act('skip', workId); }}>{t('directTaste.skip')}</button>}
                  </div>
                </article>}
                {(data.state?.exhausted || !book) && <div className="taste-exhausted" role="status"><p>{t('directTaste.exhausted')}</p>
                  <button type="button" disabled={pending} onClick={() => act('resume')}>{t('directTaste.checkInventory')}</button></div>}
                <button ref={searchButton} className="taste-search-toggle" type="button" disabled={pending}
                  aria-expanded={searchOpen} aria-controls="taste-search-panel" onClick={() => {
                    if (gate.current?.isBusy()) return;
                    if (searchOpen) closeSearch(); else { setSearchOpen(true); setSearchError(false); }
                  }}><span aria-hidden="true">+</span>{t('directTaste.find')}</button>
                {searchOpen && <div id="taste-search-panel" className="taste-book-search" onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}>
                  <label htmlFor="taste-book-query">{t('directTaste.searchLabel')}</label>
                  <input ref={searchInput} id="taste-book-query" value={query} maxLength={100} disabled={pending}
                    onChange={e => { setQuery(e.target.value); setResults([]); setSearchError(false); }} />
                  <button type="button" disabled={pending} onClick={closeSearch}>{t('directTaste.closeSearch')}</button>
                  {searchError && <p role="status">{t('directTaste.searchError')}</p>}
                  <ul className="taste-search-results">{results.filter(b => b.workId && b.workId !== workId).map(b => <li key={b.workId}>
                    <button type="button" disabled={pending} onClick={() => act('choose', b.workId!)}>{b.title} — {b.author}</button>
                  </li>)}</ul>
                </div>}
              </>}
          </>}
          {hasResult && <LocaleLink className="taste-result-link" href="/taste-test/result">{t('directTaste.result')}</LocaleLink>}
        </>}
    </section>
  </DiscoveryPageShell>;
}
