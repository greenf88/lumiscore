'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import { GUEST_ROUND_GOAL, guestRoundResult, guestRoundState, type GuestDecision, type GuestOffer } from '@/lib/taste-test/guest-round';
import { getTasteProfileConfidenceCopy } from '@/lib/taste-test/profile';
import { emptyTasteVector } from '@/lib/taste-test/traits';
import { guestRoundSessionKey, newGuestRoundExpiry, readGuestRoundSession } from '@/lib/taste-test/guest-round-session';
import { parsePublicBooks, type PublicBook } from '@/lib/books/public-book';
import type { GuestRatingResult } from '@/lib/taste-test/guest-rating-result';
import { getGuestWantedStorageId, getGuestWantedWorkIds } from '@/lib/collections/guest-want-to-read';
import { CATALOG_SEARCH_DEBOUNCE_MS, isCatalogSearchQuery } from '@/lib/books/catalog-search';
import { DirectRatingScores } from './DirectRatingScores';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { EditionPresentationLabel } from './EditionPresentationLabel';
import { BookCover, BookCard } from './LumiScoreHome';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';
import { measureTasteResultViewOnce, emitBrowserMetric } from '@/lib/product-metrics/browser';
import { TasteProfileSummary } from './TasteProfileSummary';
import { RecommendationMeasurement } from './RecommendationMeasurement';
import { readGuestWantedFromLocalStorage, useWantToRead } from './useWantToRead';

type GuestProps = { offers: GuestOffer[] | null; authState: HeaderAuthState };
const subscribeHydration = () => () => {};
export function GuestRatingTasteTest(props: GuestProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const { locale } = useLumiScoreLocale();
  return hydrated ? <GuestRatingContent key={locale} {...props} /> : <DiscoveryPageShell authState={props.authState} path="/taste-test/preferences"><section className="featured-section" role="status">{locale === 'nl' ? 'Je voortgang laden…' : 'Loading your progress…'}</section></DiscoveryPageShell>;
}
function GuestRatingContent({ offers, authState }: GuestProps) {
  const { locale, t } = useLumiScoreLocale(), nl = locale === 'nl';
  const [initial] = useState(() => { const expires = newGuestRoundExpiry(); try { const saved = readGuestRoundSession(sessionStorage.getItem(guestRoundSessionKey(locale))); return { saved, expires: saved?.expires ?? expires, failed: false }; } catch { return { saved: null, expires, failed: true }; } });
  const [decisions, setDecisions] = useState<GuestDecision[]>(initial.saved?.decisions ?? []);
  const decisionsRef = useRef(decisions);
  const [addedBooks, setAddedBooks] = useState<PublicBook[]>(initial.saved?.books ?? []);
  const [storageFailed, setStorageFailed] = useState(initial.failed);
  const expires = useRef(initial.expires);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState(''), [searchResults, setSearchResults] = useState<PublicBook[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [loaded, setLoaded] = useState<GuestRatingResult | null>(initial.saved?.result ?? null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const allOffers = useMemo(() => {
    const byId = new Map((offers ?? []).map(x => [x.book.workId, x]));
    for (const book of addedBooks) if (book.workId && !byId.has(book.workId)) byId.set(book.workId, { book: { ...book, workId: book.workId }, traits: emptyTasteVector() });
    return [...byId.values()];
  }, [offers, addedBooks]);
  const { ratings, next } = guestRoundState(allOffers, decisions);
  const complete = ratings.length === GUEST_ROUND_GOAL;
  const book = allOffers.find(x => x.book.workId === selected && !decisions.some(d => d.workId === selected))?.book ?? next?.book;
  const ratingsKey = JSON.stringify(ratings.map(({ workId, rating }) => ({ workId, rating })));
  const recommendationBooks = useMemo(() => loaded?.recommendations.map(x => x.book) ?? [], [loaded]);
  const { wanted, statuses, toggleWanted, error: saveError } = useWantToRead(false, recommendationBooks);

  function saveProgress(next: GuestDecision[], extra: PublicBook[]) {
    const snapshot = new Map(extra.map(b => [b.workId, b]));
    for (const offer of allOffers) if (next.some(d => d.workId === offer.book.workId && d.rating !== null)) snapshot.set(offer.book.workId, parsePublicBooks([offer.book])[0]);
    try { sessionStorage.setItem(guestRoundSessionKey(locale), JSON.stringify({ expires: expires.current, decisions: next, books: [...snapshot.values()] })); }
    catch { setStorageFailed(true); }
  }

  useEffect(() => {
    if (!complete || loaded) return;
    const controller = new AbortController();
    let excluded: string[] = [];
    try { excluded = getGuestWantedWorkIds(readGuestWantedFromLocalStorage(), 500); } catch { /* Saving can be unavailable. */ }
    void fetch('/api/taste-test/guest-result', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
      body: JSON.stringify({ ratings: JSON.parse(ratingsKey), excluded: excluded.slice(0, 500), locale }),
    }).then(async response => {
      if (!response.ok) throw new Error('Unavailable');
      const result = await response.json() as GuestRatingResult;
      if (!controller.signal.aborted) {
        setLoaded(result);
        try {
          const saved=readGuestRoundSession(sessionStorage.getItem(guestRoundSessionKey(locale)));
          if(saved)sessionStorage.setItem(guestRoundSessionKey(locale),JSON.stringify({...saved,result}));
        } catch { setStorageFailed(true); }
        if (!result.recommendations.length) emitBrowserMetric('guest_suggestions_empty',{locale,surface:'taste_result'});
      }
    }).catch(() => { if (!controller.signal.aborted) { setFailed(true); emitBrowserMetric('guest_suggestions_failed',{locale,surface:'taste_result'}); } });
    return () => controller.abort();
  }, [complete, ratingsKey, locale, retry, loaded]);

  useEffect(() => {
    if (!isCatalogSearchQuery(query) || complete) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/catalog/search?q=${encodeURIComponent(query)}&locale=${locale}`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error();
          const data = await response.json() as { results?: unknown };
          if (!controller.signal.aborted) { setSearchResults(parsePublicBooks(data.results)); setSearchStatus('success'); }
        }).catch(() => { if (!controller.signal.aborted) setSearchStatus('error'); });
    }, CATALOG_SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, locale, complete]);

  function decide(workId: string, rating: number | null) {
    const previous = decisionsRef.current;
    if (previous.some(item => item.workId === workId) || previous.filter(x => x.rating !== null).length >= GUEST_ROUND_GOAL) return;
    const next = [...previous, { workId, rating }]; decisionsRef.current = next;
    if (previous.length === 0) emitBrowserMetric('guest_round_started',{locale,surface:'taste_test'});
    if (rating !== null && next.filter(x=>x.rating!==null).length === GUEST_ROUND_GOAL) emitBrowserMetric('guest_round_completed',{locale,surface:'taste_result'});
    setDecisions(next); saveProgress(next, addedBooks);
    setSelected(null);
  }
  const result = complete ? loaded?.profile ?? guestRoundResult(allOffers, decisions, locale) : null;
  const confidence = result ? getTasteProfileConfidenceCopy(result.confidence, locale) : null;
  const resultMeasurement = useRef({ seen: Boolean(initial.saved?.result) });
  useEffect(() => { measureTasteResultViewOnce(resultMeasurement.current, Boolean(result), locale); }, [result, locale]);
  const knownResults = searchResults.filter(x => x.workId && !decisions.some(d => d.workId === x.workId));
  return <DiscoveryPageShell authState={authState} path="/taste-test/preferences">
    <section className="featured-section taste-rating-test taste-direct-test guest-direct-test" aria-labelledby="guest-taste-title">
      <h1 id="guest-taste-title">{t(result ? 'taste.readingTaste' : 'directTaste.label')}</h1>
      {result && confidence ? <div className="guest-taste-result">
        <TasteProfileSummary profile={result} headingId="guest-taste-profile" level={2} showInsufficient anchors={ratings.filter(x => x.rating >= 7).sort((a,b) => b.rating-a.rating).slice(0,3).flatMap(row => {
          const rated = allOffers.find(x => x.book.workId === row.workId); return rated ? [{ workId: row.workId, title: rated.book.title, rating: row.rating }] : [];
        })} />
        <div className="taste-confidence"><strong>{confidence.label}</strong><span>{confidence.description}</span></div>
        <h2>{nl ? 'Jouw volgende boek' : 'Your next book'}</h2>
        {failed ? <div role="alert"><p>{nl ? 'Je profiel is klaar, maar je leestips konden niet laden.' : 'Your profile is ready, but your book suggestions could not load.'}</p><button type="button" onClick={() => { setFailed(false); setRetry(x => x+1); }}>{nl ? 'Leestips opnieuw laden' : 'Retry suggestions'}</button></div>
        : !loaded ? <p role="status">{nl ? 'Passende boeken zoeken…' : 'Finding books for you…'}</p>
        : loaded.recommendations.length === 0 ? <p role="status">{nl ? 'Met deze beoordelingen en de beschikbare boekkenmerken kunnen we nog geen nieuwe boeken onderbouwen. Probeer ook boeken die je goed vond, of ontdek onze leesroutes.' : 'These ratings and the available book details do not yet support new recommendations. Try books you enjoyed too, or explore our reading lists.'}</p>
        : <div className="book-grid guest-recommendations">{loaded.recommendations.map((item, index) => <RecommendationMeasurement key={item.book.id} workId={item.book.workId} position={index+1} locale={locale} surface="taste_result"><div className="taste-recommendation">
          <BookCard book={item.book} wanted={wanted.has(getGuestWantedStorageId(item.book))} status={statuses.get(item.book.workId!)} onToggle={toggleWanted} resolveMissingCover={false} detailReturnContext={{ kind: 'recommendations', path: '/taste-test/preferences' }} />
          <p className="taste-recommendation-reason">{item.explanation}</p>
        </div></RecommendationMeasurement>)}</div>}
        {saveError && <p role="alert">{saveError}</p>}
        <p>{nl ? 'Je beoordelingen blijven privé en veranderen geen publieke scores. Bewaarde boeken staan op dit apparaat bij Mijn boeken.' : 'Your ratings stay private and do not change public scores. Saved books are in My books on this device.'}</p>
        <nav className="taste-next-steps" aria-label={nl ? 'Volgende stap' : 'Next step'}><LocaleLink className="primary-cta" href="/my-books">{nl ? 'Mijn bewaarde boeken' : 'My saved books'}</LocaleLink><LocaleLink href="/toplijsten">{nl ? 'Ontdek leesroutes' : 'Explore reading lists'}</LocaleLink><button type="button" onClick={() => { decisionsRef.current = []; setDecisions([]); setAddedBooks([]); setLoaded(null); setFailed(false); resultMeasurement.current.seen = false; expires.current = newGuestRoundExpiry(); saveProgress([], []); }}>{nl ? 'Opnieuw beginnen' : 'Start again'}</button></nav>
      </div> : <>
        <p className="guest-test-intro">{nl ? 'Zonder account: beoordeel 10 boeken die je kent. Sla onbekende boeken over. Daarna krijg je je leessmaak en passende nieuwe leestips.' : 'No account needed: rate 10 books you know. Skip unfamiliar books. Then discover your reading taste and new books for you.'}</p>
        <p className="taste-direct-progress" role="status" aria-live="polite">{t('directTaste.progress', { rated: ratings.length, goal: GUEST_ROUND_GOAL })}</p>
        <div className="guest-known-search"><label htmlFor="guest-known-book">{nl ? 'Zoek een boek dat je kent' : 'Find a book you know'}</label><input id="guest-known-book" type="search" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); setSearchResults([]); setSearchStatus(isCatalogSearchQuery(event.target.value) ? 'loading' : 'idle'); }} placeholder={nl ? 'Titel of auteur' : 'Title or author'} />
          {searchStatus === 'loading' && <p role="status">{t('home.searching')}</p>}
          {searchStatus === 'error' && <p role="alert">{t('home.searchUnavailable')}</p>}
          {searchStatus === 'success' && (knownResults.length ? <ul>{knownResults.slice(0,8).map(item => <li key={item.id}><button type="button" onClick={() => {
            const extra = addedBooks.some(x => x.workId === item.workId) ? addedBooks : [...addedBooks, item];
            setAddedBooks(extra); saveProgress(decisions, extra); setSelected(item.workId!); setQuery(''); setSearchResults([]); setSearchStatus('idle');
          }}><strong>{item.title}</strong><span>{item.author}</span></button></li>)}</ul> : <p role="status">{nl ? 'Geen nieuwe resultaten. Probeer een andere titel of auteur.' : 'No new results. Try another title or author.'}</p>)}
        </div>
        {book ? <article className="book-card taste-rating-card" key={book.workId}>
          <div className="taste-book-identity"><BookCover book={book} presentation="taste" resolveMissing={false} /><div className="book-card-body"><h2>{book.title}</h2><p>{book.author}</p><EditionPresentationLabel book={book} /></div></div>
          <div className="taste-rating-actions"><DirectRatingScores workId={book.workId} pending={false} selection={null} onRate={rating => decide(book.workId, rating)} /><button className="taste-skip-button" type="button" onClick={event => { if (event.detail <= 1) decide(book.workId, null); }}>{t('directTaste.skip')}</button></div>
        </article> : <p role="status">{nl ? 'Zoek hierboven een bekend boek om verder te gaan.' : 'Search for a familiar book above to continue.'}</p>}
        {offers === null && <p role="status">{nl ? 'De voorgestelde boeken konden niet laden. Je kunt zelf een boek zoeken.' : 'Suggested books could not load. You can search for a book yourself.'}</p>}
      </>}
      {<p className="guest-session-note" role={storageFailed ? 'status' : undefined}>{storageFailed
        ? (nl ? 'Deze browser kan je voortgang niet bewaren. Laat dit tabblad open tot je klaar bent.' : 'This browser cannot save your progress. Keep this tab open until you finish.')
        : (nl ? 'Je test blijft maximaal 24 uur in dit tabblad bewaard, ook als je een boek opent en teruggaat.' : 'Your test is kept in this tab for up to 24 hours, including when you open a book and return.')}</p>}
    </section>
  </DiscoveryPageShell>;
}
