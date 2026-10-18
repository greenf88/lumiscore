'use client';
import {EditionPresentationLabel} from './EditionPresentationLabel';
import {useEffect, useRef, useState} from 'react';
import type {CollectionPageData} from '@/lib/supabase/collections';
import type {HeaderAuthState} from '@/lib/auth/header';
import {quickRatingProgress, quickRatingStorageKey, reconcileQuickSession, uniqueCollectionBooks, type QuickRatingSession} from '@/lib/collections/quick-rating';
import {createRoundActionGate, type PendingWorkScore} from '@/lib/taste-test/direct-rating';
import {parseRating} from '@/lib/ratings/model';
import {DiscoveryPageShell} from './DiscoveryPageShell';
import {DirectRatingScores} from './DirectRatingScores';
import {BookCover} from './LumiScoreHome';
import {LocaleLink, useLumiScoreLocale} from './LumiScoreLocale';

export function CollectionQuickRating({initial, userId, authState}: {initial: CollectionPageData; userId: string; authState: HeaderAuthState}) {
  const {t,locale} = useLumiScoreLocale();
  const [data, setData] = useState(initial), [session, setSession] = useState<QuickRatingSession | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(false), [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState<PendingWorkScore>(null), [storageUnavailable, setStorageUnavailable] = useState(false);
  const gate = useRef<ReturnType<typeof createRoundActionGate> | null>(null);
  if (gate.current === null) {gate.current = createRoundActionGate();}
  const mounted = useRef(true), focusNext = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const path = `/collection/${data.collection.slug}`, key = quickRatingStorageKey(userId, data.collection.id);
  const progress = session ? quickRatingProgress(data.books, data.ratedWorkIds, session) : null;
  const item = progress?.remaining[0], workId = item?.workId;
  useEffect(() => {
    mounted.current = true;
    // Read browser-only storage after hydration; never treat it as rating truth.
    Promise.resolve().then(() => {
      if (!mounted.current) return;
      let raw: unknown = null;
      try {raw = JSON.parse(localStorage.getItem(key) ?? 'null');} catch {setStorageUnavailable(true);}
      setSession(reconcileQuickSession(raw, userId, initial.collection.id, uniqueCollectionBooks(initial.books).map(book => book.workId), initial.ratedWorkIds));
    });
    return () => {mounted.current = false;};
  }, [key, userId, initial]);
  useEffect(() => {
    if (focusNext.current) {heading.current?.focus({preventScroll: true}); focusNext.current = false;}
  }, [workId]);
  const remember = (next: QuickRatingSession) => {
    try {localStorage.setItem(key, JSON.stringify(next));} catch {setStorageUnavailable(true);}
    setSession(next);
  };
  const fresh = async () => {
    const response = await fetch(`/api/collections/${encodeURIComponent(data.collection.slug)}/rating-session?locale=${locale}`, {cache: 'no-store'});
    if (!response.ok) throw new Error('PROGRESS_UNAVAILABLE');
    const snapshot = await response.json() as {data: CollectionPageData; userId: string};
    if (snapshot.userId !== userId || snapshot.data.collection.id !== data.collection.id || !snapshot.data.authenticated) throw new Error('SESSION_CHANGED');
    return snapshot.data;
  };
  const accept = (value: {data: CollectionPageData; session: QuickRatingSession}, didSave: boolean) => {
    if (!mounted.current) return;
    focusNext.current = true; setData(value.data); remember(value.session); setSelection(null); setError(false); setSaved(didSave);
    if (didSave) {try {sessionStorage.setItem('lumiscore-rating-changed', '1');} catch { /* Optional BFCache freshness, same as the taste test. */ }}
  };
  const failed = () => {if (mounted.current) setError(true);};
  const pendingChanged = (value: boolean) => {if (mounted.current) {setPending(value); if (!value) setSelection(null);}};
  const rate = (score: number) => {
    if (!session || !workId || gate.current?.isBusy()) return;
    const chosen = workId;
    setSelection({workId: chosen, score}); setError(false); setSaved(false);
    void gate.current!.run(async () => {
      // Every attempt first reads authoritative membership, identity and ratings.
      // Ambiguous responses must never cause a blind retry or overwrite.
      const current = await fresh();
      if (!uniqueCollectionBooks(current.books).some(book => book.workId === chosen)) throw new Error('MEMBER_REMOVED');
      let created = false, canonical = current.userRatings[chosen];
      if (!current.ratedWorkIds.includes(chosen)) {
        const response = await fetch(`/api/ratings/${encodeURIComponent(chosen)}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rating: score, onlyIfUnrated: true, expectedUserId: userId})});
        if (!response.ok) throw new Error('SAVE_NOT_CONFIRMED');
        const payload = await response.json() as {state?: {authenticated?: boolean; userRating?: number; created?: boolean}};
        if (!payload.state?.authenticated || parseRating(payload.state.userRating) === null || typeof payload.state.created !== 'boolean') throw new Error('SAVE_NOT_CONFIRMED');
        created = payload.state.created; canonical = payload.state.userRating!;
      }
      if (parseRating(canonical) === null) throw new Error('SAVE_NOT_CONFIRMED');
      const next = {...current, ratedWorkIds: [...new Set([...current.ratedWorkIds, chosen])], userRatings: {...current.userRatings, [chosen]: canonical}};
      return {data: next, session: reconcileQuickSession({...session, newRatedIds: created ? [...session.newRatedIds, chosen] : session.newRatedIds}, userId, next.collection.id, next.books.map(book => book.workId), next.ratedWorkIds)};
    }, value => accept(value, true), failed, pendingChanged);
  };
  const skip = () => {
    if (!session || !workId || gate.current?.isBusy()) return;
    void gate.current!.run(async () => ({data, session: {...session, skippedIds: [...new Set([...session.skippedIds, workId])]}}), value => accept(value, false), failed, pendingChanged);
  };
  const refresh = (restart = false) => {
    if (!session || gate.current?.isBusy()) return;
    void gate.current!.run(async () => {
      const current = await fresh();
      return {data: current, session: reconcileQuickSession(restart ? null : session, userId, current.collection.id, current.books.map(book => book.workId), current.ratedWorkIds)};
    }, value => accept(value, false), failed, pendingChanged);
  };
  return <DiscoveryPageShell authState={authState} path={`${path}/rate`}>
    <section className="featured-section taste-rating-test taste-direct-test collection-quick-rating" aria-busy={pending}>
      <div className="taste-round-heading"><span className="eyebrow">{data.collection.name}</span>
        <LocaleLink className="ui-control ui-secondary" href={path} aria-disabled={pending} onClick={event => {if (gate.current?.isBusy()) event.preventDefault();}}>{t('quickCollection.stop')}</LocaleLink></div>
      {!progress && <p role="status">{t('directTaste.loading')}</p>}
      {storageUnavailable && <p className="collection-session-note" role="status">{t('quickCollection.localUnavailable')}</p>}
      {error && <div className="taste-action-error" role="alert"><p>{t('quickCollection.error')}</p><button className="ui-control ui-secondary" type="button" disabled={pending} onClick={() => refresh()}>{t('directTaste.refresh')}</button></div>}
      <p className="sr-only" role="status" aria-live="polite">{saved ? t('directTaste.saved') : pending ? t(selection ? 'directTaste.saving' : 'directTaste.loading') : ''}</p>
      {progress && item && <>
        <h1 className="sr-only">{t('quickCollection.entry')}</h1>
        <div className="taste-direct-progress" role="status" aria-live="polite" aria-atomic="true"><span>{t('quickCollection.progress', {rated: progress.newRated, remaining: progress.remaining.length})}</span>
          {progress.previouslyRated > 0 && <small>{t('quickCollection.existing', {count: progress.previouslyRated})}</small>}
          <div role="progressbar" aria-label={t('quickCollection.viewed')} aria-valuemin={0} aria-valuemax={progress.toView} aria-valuenow={progress.viewed}><span style={{width: `${progress.viewed / Math.max(1, progress.toView) * 100}%`}} /></div>
        </div>
        <article className="book-card taste-rating-card" key={workId}>
          <div className={`taste-book-identity${item.book.title.length > 90 || item.book.author.length > 60 ? ' taste-long-identity' : ''}`}><BookCover book={item.book} presentation="taste" resolveMissing={false} />
            <div className="book-card-body"><h2 ref={heading} tabIndex={-1}>{item.book.title}</h2><p>{item.book.author}</p><EditionPresentationLabel book={item.book}/>{item.book.firstPublishYear && <small>{t('common.firstPublished', {year: item.book.firstPublishYear})}</small>}</div></div>
          <div className="taste-rating-actions"><DirectRatingScores workId={item.workId} pending={pending} selection={selection} onRate={rate} />
            <button type="button" className="taste-skip-button" disabled={pending} onClick={skip}>{t('directTaste.skip')}</button><p className="collection-session-note">{t('quickCollection.skipCopy')}</p></div>
        </article>
      </>}
      {progress && !item && <div className="collection-rating-complete"><h1 ref={heading} tabIndex={-1}>{t(progress.total === 0 ? 'quickCollection.empty' : 'quickCollection.done')}</h1>
        <p role="status">{t('quickCollection.result', {count: progress.newRated})}</p>{progress.previouslyRated > 0 && <p>{t('quickCollection.existing', {count: progress.previouslyRated})}</p>}
        <LocaleLink className="ui-control ui-primary" href={path}>{t('quickCollection.view')}</LocaleLink>
        {progress.skipped > 0 && <button type="button" className="ui-control ui-secondary" disabled={pending} onClick={() => refresh(true)}>{t('quickCollection.revisit')}</button>}
      </div>}
    </section>
  </DiscoveryPageShell>;
}
