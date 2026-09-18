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
import { BookCover, Footer, Header } from './LumiScoreHome';
import { LumiScoreReadingStatus } from './LumiScoreReadingStatus';
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
  const statusMap = useMemo(() => new Map(Object.entries(statuses)), [statuses]);
  const ratedWorkIds = useMemo(() => new Set(data.ratedWorkIds), [data.ratedWorkIds]);
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

  return (
    <main className="site-shell collection-page-shell">
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
                <a href={`/book/${actionBook.workId}`}>{actionBook.book.title}</a>
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

      <section className="collection-book-list" aria-label={collection.name}>
        {books.map((item) => {
          const rating = formatPublicRatingDisplay(item.book.score, item.book.ratingsCount ?? 0, locale);
          const itemStatus = statuses[item.workId] ?? null;
          const isAction = item.workId === actionWorkId;
          const isContinue = isAction && seriesProgress?.continueBook?.workId === item.workId;
          const isHighlighted = item.workId === highlightedUnread;
          const seriesTotal = seriesProgress?.total ?? null;
          return (
            <article className={`collection-book-row${isAction || isHighlighted ? ' is-highlighted' : ''}${itemStatus ? ` has-status status-${itemStatus}` : ''}`} key={item.workId}>
              <a className="collection-book-main" href={`/book/${item.workId}`}>
                <BookCover book={item.book} small label={item.book.title} />
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
              <LumiScoreReadingStatus
                workId={item.workId}
                status={statuses[item.workId] ?? null}
                authenticated={authenticated}
                returnTo={returnTo}
                compact
                showGuestCta={false}
                onStatusChange={(status) => setStatuses((current) => {
                  const next = { ...current };
                  if (status) next[item.workId] = status;
                  else delete next[item.workId];
                  return next;
                })}
              />
            </article>
          );
        })}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
