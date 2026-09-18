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

export function LumiScoreCollectionPage({ data }: { data: CollectionPageData }) {
  const { collection, books, authenticated } = data;
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, ReadingStatus>>(data.statuses);
  const statusMap = useMemo(() => new Map(Object.entries(statuses)), [statuses]);
  const seriesProgress = collection.collectionType === 'series'
    ? calculateSeriesProgress(books, statusMap, collection.expectedMainSeriesTotal)
    : null;
  const progress = seriesProgress ?? calculateCollectionProgress(books, statusMap);
  const progressLabel = canShowProgressDenominator(progress.total)
    ? t('collection.readProgress', { read: progress.read, total: progress.total })
    : t('collection.readCount', { read: progress.read });
  const nextWorkId = seriesProgress?.nextBook?.workId ?? null;
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
          <div className="collection-progress" aria-label={progressLabel}>
            <strong>{progressLabel}</strong>
            {progress.percentage !== null && <span>{progress.percentage}%</span>}
            {progress.percentage !== null && <i><b style={{ width: `${progress.percentage}%` }} /></i>}
          </div>
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
          const isNext = item.workId === nextWorkId;
          const isHighlighted = item.workId === highlightedUnread;
          const seriesTotal = seriesProgress?.total ?? null;
          return (
            <article className={`collection-book-row${isNext || isHighlighted ? ' is-highlighted' : ''}`} key={item.workId}>
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
                  {(isNext || isHighlighted) && (
                    <em>{isNext
                      ? t('collection.nextInSeries')
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
