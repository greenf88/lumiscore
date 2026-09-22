'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  calculateCollectionProgress,
  calculateSeriesProgress,
  selectHighestRatedUnread,
  type ReadingStatus,
} from '@/lib/collections/model';
import type { CollectionPageData } from '@/lib/supabase/collections';
import {
  canShowProgressDenominator,
  canShowSeriesDenominator,
} from '@/lib/collections/presentation';
import { formatPublicRatingDisplay } from '@/lib/ratings/card-summaries';
import { getBookHref } from '@/lib/books/book-navigation';
import { BookCover, Footer, Header } from './LumiScoreHome';
import { LumiScoreCollectionBookControls } from './LumiScoreCollectionBookControls';
import {
  LumiScoreCollectionBulkProgress,
} from './LumiScoreCollectionBulkProgress';
import {
  filterCollectionWorkIds,
  type CollectionBulkFilter,
} from '@/lib/collections/bulk-progress';
import { useLumiScoreLocale } from './LumiScoreLocale';

const STATUS_KEYS: Record<ReadingStatus, 'collection.wantToRead' | 'collection.reading' | 'collection.read' | 'collection.dnf'> = {
  want_to_read: 'collection.wantToRead',
  reading: 'collection.reading',
  read: 'collection.read',
  dnf: 'collection.dnf',
};

export function LumiScoreCollectionPage({ data }: { data: CollectionPageData }) {
  const { collection, books, authenticated } = data;
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, ReadingStatus>>(data.statuses);
  const [ratings, setRatings] = useState<Record<string, number>>(data.userRatings);
  const [ratedIds, setRatedIds] = useState(() => new Set(data.ratedWorkIds));
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkFilter, setBulkFilter] = useState<CollectionBulkFilter>('all');
  const [selectedWorkIds, setSelectedWorkIds] = useState(() => new Set<string>());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkError, setBulkError] = useState('');
  const statusMap = useMemo(() => new Map(Object.entries(statuses)), [statuses]);
  const ratedWorkIds = ratedIds;
  const visibleWorkIds = useMemo(() => filterCollectionWorkIds(
    books,
    statuses,
    ratedWorkIds,
    bulkActive ? bulkFilter : 'all',
  ), [books, bulkActive, bulkFilter, ratedWorkIds, statuses]);
  const visibleWorkIdSet = useMemo(() => new Set(visibleWorkIds), [visibleWorkIds]);
  const seriesProgress = collection.collectionType === 'series'
    ? calculateSeriesProgress(
      books,
      statusMap,
      collection.expectedMainSeriesTotal,
      ratedWorkIds,
    )
    : null;
  const progress = seriesProgress ?? calculateCollectionProgress(
    books,
    statusMap,
    ratedWorkIds,
  );
  const progressLabel = canShowProgressDenominator(progress.total)
    ? t('collection.readProgress', { read: progress.read, total: progress.total })
    : t('collection.readCount', { read: progress.read });
  const actionWorkId = seriesProgress?.actionBook?.workId ?? null;
  const actionBook = books.find(({ workId }) => workId === actionWorkId) ?? null;
  const highlightedUnread = collection.collectionType === 'author_collection'
    ? selectHighestRatedUnread(books, statusMap)?.workId ?? null
    : null;
  const highlightedBook = books.find(({ workId }) => workId === highlightedUnread)?.book ?? null;
  const returnTo = `/collection/${collection.slug}`;
  const bookReturnContext = { kind: 'collection', slug: collection.slug } as const;

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const typeLabel = collection.collectionType === 'series'
    ? t('collection.series')
    : collection.collectionType === 'universe'
      ? t('collection.universe')
      : t('collection.authorCollection');

  const updateLocalStatus = (workId: string, status: ReadingStatus | null) => {
    setStatuses((current) => {
      const next = { ...current };
      if (status) next[workId] = status;
      else delete next[workId];
      return next;
    });
  };

  const updateLocalRating = (workId: string, rating: number | null) => {
    setRatings((current) => {
      const next = { ...current };
      if (rating === null) delete next[workId];
      else next[workId] = rating;
      return next;
    });
    setRatedIds((current) => {
      const next = new Set(current);
      if (rating === null) next.delete(workId);
      else next.add(workId);
      return next;
    });
  };

  const toggleSelected = (workId: string) => {
    setSelectedWorkIds((current) => {
      const next = new Set(current);
      if (next.has(workId)) next.delete(workId);
      else if (next.size < 100) next.add(workId);
      return next;
    });
  };

  const openBulkMode = useCallback(() => {
    setBulkActive(true);
    setBulkMessage('');
    setBulkError('');
  }, []);

  const closeBulkMode = useCallback(() => {
    if (bulkPending) return;
    setBulkActive(false);
    setSelectedWorkIds(new Set());
    setBulkMessage('');
    setBulkError('');
  }, [bulkPending]);

  const applyBulkStatus = async (nextStatus: ReadingStatus | null) => {
    const workIds = [...selectedWorkIds];
    const ratedConflicts = nextStatus === 'read'
      ? []
      : workIds.filter((workId) => ratedWorkIds.has(workId));
    if (ratedConflicts.length > 0) {
      setBulkError(t('collection.bulkRatedConflict', { count: ratedConflicts.length }));
      setBulkMessage('');
      return;
    }
    if (!window.confirm(t('collection.bulkConfirm', { count: workIds.length }))) return;

    const snapshot = { ...statuses };
    setStatuses((current) => {
      const next = { ...current };
      for (const workId of workIds) {
        if (nextStatus) next[workId] = nextStatus;
        else delete next[workId];
      }
      return next;
    });
    setBulkPending(true);
    setBulkError('');
    setBulkMessage('');
    let receivedResponse = false;
    let ambiguousOutcome = false;
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(collection.slug)}/statuses/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workIds,
          action: nextStatus ? 'set' : 'clear',
          status: nextStatus,
        }),
      });
      receivedResponse = true;
      const payload = await response.json().catch(() => ({})) as {
        statuses?: Record<string, ReadingStatus>;
        ratedWorkIds?: string[];
        changed?: number;
        error?: string;
        code?: string;
        conflictingWorkIds?: string[];
      };
      ambiguousOutcome = payload.code === 'status_reconciliation_failed';
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (response.status === 409 && payload.code === 'rated_work_conflict') {
        const conflicts = payload.conflictingWorkIds ?? [];
        setRatedIds((current) => new Set([...current, ...conflicts]));
        throw new Error(t('collection.bulkRatedConflict', { count: conflicts.length }));
      }
      if (!response.ok) throw new Error(payload.error ?? t('collection.bulkError'));
      setStatuses((current) => {
        const next = { ...current };
        for (const workId of workIds) {
          const canonical = payload.statuses?.[workId] ?? null;
          if (canonical) next[workId] = canonical;
          else delete next[workId];
        }
        return next;
      });
      const returnedRatedWorkIds = payload.ratedWorkIds;
      if (returnedRatedWorkIds) {
        setRatedIds((current) => new Set([...current, ...returnedRatedWorkIds]));
      }
      setBulkMessage(t('collection.bulkSuccess', { count: payload.changed ?? 0 }));
    } catch (caught) {
      if (!receivedResponse || ambiguousOutcome) {
        try {
          const reconcile = await fetch(`/api/book-status?workIds=${encodeURIComponent(workIds.join(','))}`, {
            cache: 'no-store',
          });
          if (!reconcile.ok) throw new Error('RECONCILE_FAILED');
          const payload = await reconcile.json() as { statuses?: Record<string, ReadingStatus> };
          setStatuses((current) => {
            const next = { ...current };
            for (const workId of workIds) {
              const canonical = payload.statuses?.[workId] ?? null;
              if (canonical) next[workId] = canonical;
              else delete next[workId];
            }
            return next;
          });
        } catch {
          setStatuses(snapshot);
        }
      } else {
        setStatuses(snapshot);
      }
      setBulkError(caught instanceof Error ? caught.message : t('collection.bulkError'));
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <main className={`site-shell collection-page-shell${bulkActive ? ' has-bulk-mode' : ''}`}>
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={{ authenticated }}
        returnTo={returnTo}
      />
      <section className="collection-hero">
        <a className="detail-back-link" href="/">← {t('collection.backToBooks')}</a>
        <span className="eyebrow">{typeLabel.toUpperCase()}</span>
        <h1>{collection.name}</h1>
        <p className="collection-book-count">
          {t(
            books.length === 1
              ? 'collections.oneBook'
              : 'collections.bookCount',
            { count: books.length },
          )}
        </p>
        {collection.description && <p>{collection.description}</p>}
        {authenticated ? (
          <>
            <div className="collection-progress" aria-label={progressLabel}>
              <strong>{progressLabel}</strong>
              {progress.percentage !== null && <span>{progress.percentage}%</span>}
              {progress.percentage !== null && <i><b style={{ width: `${progress.percentage}%` }} /></i>}
            </div>
            {seriesProgress?.complete ? (
              <p className="collection-complete">{t('collection.seriesComplete')}</p>
            ) : actionBook ? (
              <p className="collection-next-book">
                <span>{t(seriesProgress?.continueBook
                  ? 'collection.continueReading'
                  : 'collection.nextInSeries')}</span>
                <a href={getBookHref(actionBook.book, bookReturnContext) ?? '/browse'}>{actionBook.book.title}</a>
              </p>
            ) : null}
          </>
        ) : (
          <a className="status-sign-in collection-sign-in" href={`/login?next=${encodeURIComponent(returnTo)}`}>
            {t('collection.signInTrack')}
          </a>
        )}
        {collection.collectionType !== 'series' && (
          <p className="collection-order-note">{t('collection.noOfficialOrder')}</p>
        )}
      </section>

      {authenticated && (
        <LumiScoreCollectionBulkProgress
          active={bulkActive}
          filter={bulkFilter}
          visibleWorkIds={visibleWorkIds}
          selectedWorkIds={selectedWorkIds}
          ratedWorkIds={ratedWorkIds}
          pending={bulkPending}
          message={bulkMessage}
          error={bulkError}
          onOpen={openBulkMode}
          onClose={closeBulkMode}
          onFilterChange={setBulkFilter}
          onSelectVisible={() => setSelectedWorkIds(new Set(visibleWorkIds.slice(0, 100)))}
          onSelectUnknown={() => setSelectedWorkIds(new Set(
            books.filter(({ workId }) => !statuses[workId]).map(({ workId }) => workId).slice(0, 100),
          ))}
          onDeselectRated={() => setSelectedWorkIds((current) => new Set(
            [...current].filter((workId) => !ratedWorkIds.has(workId)),
          ))}
          onClearSelection={() => setSelectedWorkIds(new Set())}
          onApply={(status) => void applyBulkStatus(status)}
        />
      )}

      <section className="collection-book-list" aria-label={collection.name}>
        {books.filter(({ workId }) => visibleWorkIdSet.has(workId)).map((item) => {
          const rating = formatPublicRatingDisplay(item.book.score, item.book.ratingsCount ?? 0, locale);
          const itemStatus = statuses[item.workId] ?? null;
          const isAction = item.workId === actionWorkId;
          const isContinue = isAction && seriesProgress?.continueBook?.workId === item.workId;
          const isHighlighted = item.workId === highlightedUnread;
          const seriesTotal = seriesProgress?.total ?? null;
          return (
            <article className={`collection-book-row${bulkActive ? ' is-bulk-mode' : ''}${selectedWorkIds.has(item.workId) ? ' is-selected' : ''}${isAction || isHighlighted ? ' is-highlighted' : ''}${itemStatus ? ` has-status status-${itemStatus}` : ''}`} key={item.workId}>
              {bulkActive && (
                <label className="collection-book-select">
                  <input type="checkbox" checked={selectedWorkIds.has(item.workId)}
                    onChange={() => toggleSelected(item.workId)} />
                  <span>{t('collection.selectBook', { title: item.book.title })}</span>
                </label>
              )}
              <a className="collection-book-main" href={getBookHref(item.book, bookReturnContext) ?? '/browse'}>
                <BookCover book={item.book} small label={item.book.title} resolveMissing={!bulkActive} />
                <span className="collection-book-copy">
                  {collection.collectionType === 'series' && item.sequenceNumber !== null && (
                    <small>{canShowSeriesDenominator(item.sequenceNumber, seriesTotal)
                      ? t('collection.bookOf', { position: item.sequenceNumber, total: seriesTotal })
                      : t('collection.bookPosition', { position: item.sequenceNumber })}</small>
                  )}
                  <strong>{item.book.title}</strong>
                  <span>{item.book.author}{item.book.firstPublishYear ? ` · ${item.book.firstPublishYear}` : ''}</span>
                  {authenticated && itemStatus && (
                    <small className="collection-book-status">{t(STATUS_KEYS[itemStatus])}</small>
                  )}
                  {(isAction || isHighlighted) && (
                    <em>{isAction
                      ? t(isContinue ? 'collection.continueReading' : 'collection.nextInSeries')
                      : highlightedBook?.score !== null && (highlightedBook?.ratingsCount ?? 0) > 0
                        ? t('collection.highestUnread')
                        : t('collection.nextUnread')}</em>
                  )}
                </span>
                <span className="mini-score"><strong>{rating.score}</strong><small>LumiScore</small></span>
              </a>
              {authenticated && !bulkActive && (
                <LumiScoreCollectionBookControls
                  workId={item.workId}
                  status={statuses[item.workId] ?? null}
                  rating={ratings[item.workId] ?? null}
                  onStatusChange={(status) => updateLocalStatus(item.workId, status)}
                  onRatingChange={(ratingValue) => updateLocalRating(item.workId, ratingValue)}
                />
              )}
            </article>
          );
        })}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
