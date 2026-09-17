'use client';

import { useCallback, useMemo, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import { hasUsableInitialBookCover } from '@/lib/books/book-cover-state';
import {
  COLLECTION_DIRECTORY_FILTERS,
  filterCollectionDirectoryItems,
  getCollectionDirectoryCoverage,
  getCollectionDirectoryHref,
  getCollectionHref,
  type CollectionDirectoryFilter,
} from '@/lib/collections/directory';
import type { CollectionType } from '@/lib/collections/model';
import type {
  CollectionDirectoryItem,
  CollectionsDirectoryData,
} from '@/lib/supabase/collections';
import type { TranslationKey } from '@/lib/i18n/translations';
import { BookCover, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';

const FILTER_LABELS: Record<CollectionDirectoryFilter, TranslationKey> = {
  all: 'collections.filterAll',
  series: 'collection.series',
  universe: 'collection.universe',
  author_collection: 'collection.authorCollection',
};

const TYPE_LABELS: Record<CollectionType, TranslationKey> = {
  series: 'collection.series',
  universe: 'collection.universe',
  author_collection: 'collection.authorCollection',
};

function CollectionDirectoryCard({ item }: { item: CollectionDirectoryItem }) {
  const { t } = useLumiScoreLocale();
  const { collection } = item;
  const covers = item.representativeBooks
    .filter(hasUsableInitialBookCover)
    .slice(0, 3);
  const coverage = getCollectionDirectoryCoverage(item);
  const coverageLabel = coverage.kind === 'count'
    ? t(
        coverage.count === 1
          ? 'collections.oneBook'
          : 'collections.bookCount',
        { count: coverage.count },
      )
    : coverage.kind === 'complete'
      ? t('collections.completeCount', { count: coverage.total })
      : t('collections.coverageCount', {
          count: coverage.count,
          total: coverage.total,
        });

  return (
    <article className="collection-directory-card">
      <a href={getCollectionHref(collection.slug)}>
        <div className={`collection-cover-stack cover-count-${covers.length}`} aria-hidden="true">
          {covers.length > 0 ? covers.map((book) => (
            <BookCover key={book.workId} book={book} small resolveMissing={false} />
          )) : <span className="collection-cover-empty">✦</span>}
        </div>
        <span className="eyebrow">{t(TYPE_LABELS[collection.collectionType])}</span>
        <h2>{collection.name}</h2>
        <p>{coverageLabel}</p>
        {collection.collectionType !== 'series' && (
          <small>{t('collection.noOfficialOrder')}</small>
        )}
        <b>{t('collections.open')} <span aria-hidden="true">→</span></b>
      </a>
    </article>
  );
}

export function LumiScoreCollectionsPage({
  data,
  filter,
  authState,
}: {
  data: CollectionsDirectoryData & { available: boolean };
  filter: CollectionDirectoryFilter;
  authState: HeaderAuthState;
}) {
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState('');
  const visibleCollections = useMemo(
    () => filterCollectionDirectoryItems(data.collections, filter),
    [data.collections, filter],
  );

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  return (
    <main className="site-shell collections-directory-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={authState}
        returnTo={getCollectionDirectoryHref(filter)}
      />
      <section className="collections-directory" aria-labelledby="collections-title">
        <nav className="directory-switcher" aria-label={t('browse.directoryNavigation')}>
          <a href="/browse">{t('browse.books')}</a>
          <a href="/collections" aria-current="page">{t('browse.collections')}</a>
        </nav>
        <div className="browse-heading">
          <div>
            <span className="eyebrow">{t('collections.eyebrow')}</span>
            <h1 id="collections-title">{t('collections.heading')}</h1>
            <p>{t('collections.copy')}</p>
          </div>
          <strong>{data.available
            ? t('collections.count', {
                count: data.total.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US'),
              })
            : t('collections.unavailable')}</strong>
        </div>

        <nav className="collection-filters" aria-label={t('collections.filterLabel')}>
          {COLLECTION_DIRECTORY_FILTERS.map((value) => (
            <a
              href={getCollectionDirectoryHref(value)}
              aria-current={filter === value ? 'page' : undefined}
              key={value}
            >
              {t(FILTER_LABELS[value])}
            </a>
          ))}
        </nav>

        {!data.available ? (
          <div className="empty-results" role="status">
            <span>⌕</span>
            <h2>{t('collections.unavailable')}</h2>
            <p>{t('home.tryAgain')}</p>
          </div>
        ) : visibleCollections.length > 0 ? (
          <div className="collections-directory-grid">
            {visibleCollections.map((item) => (
              <CollectionDirectoryCard item={item} key={item.collection.id} />
            ))}
          </div>
        ) : (
          <div className="empty-results">
            <span>⌕</span>
            <h2>{t('collections.empty')}</h2>
          </div>
        )}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
