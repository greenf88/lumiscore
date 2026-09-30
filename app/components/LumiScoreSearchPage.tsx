'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Book } from '../data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { BookCard, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { useWantToRead } from './useWantToRead';
import type { EditorialQuery } from '@/lib/catalog/editorial-query';
import { EditorialCatalogControls, EditorialPagination } from './EditorialCatalogControls';

type LumiScoreSearchPageProps = {
  initialQuery: string;
  results: Book[];
  searchFailed: boolean;
  authState: HeaderAuthState;
  searchReturnTo: string;
  filters: EditorialQuery;
  total: number;
  facets: Record<string, number>;
  pageCount: number;
};

export function LumiScoreSearchPage({
  initialQuery,
  results,
  searchFailed,
  authState,
  searchReturnTo,
  filters, total, facets, pageCount,
}: LumiScoreSearchPageProps) {
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState(initialQuery);
  const { wanted, statuses, toggleWanted } = useWantToRead(authState.authenticated, results);
  const detailReturnContext = useMemo(
    () => ({ kind: 'search', path: searchReturnTo } as const),
    [searchReturnTo],
  );

  const toggleTheme = useCallback(() => {
    const next =
      document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme =
      next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const hasQuery = initialQuery.length >= 2 || filters.categories.length > 0 || Boolean(filters.selection) || filters.languages.length > 0;

  return (
    <main className="site-shell search-page-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={authState}
        returnTo={searchReturnTo}
      />
      <section
        className="featured-section search-results-section"
        aria-labelledby="search-results-title"
      >
        <div className="section-heading search-results-heading">
          <div>
            <span className="eyebrow">{t('search.fullCatalog')}</span>
            <h1 id="search-results-title">
              {initialQuery.length >= 2 ? t('search.resultsFor', { query: initialQuery }) : t('search.title')}
            </h1>
          </div>
          <div className="section-tools">
            <span>
              {hasQuery
                ? `${total.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')} ${t(total === 1 ? 'common.book' : 'common.books')}`
                : t('search.enterTitle')}
            </span>
          </div>
        </div>

        <EditorialCatalogControls key={searchReturnTo} state={filters} facets={facets} route="/search" />
        {searchFailed ? (
          <div className="empty-results" role="status">
            <span>⌕</span>
            <h2>{t('home.searchUnavailable')}</h2>
            <p>{t('home.tryAgain')}</p>
          </div>
        ) : !hasQuery ? (
          <div className="empty-results">
            <span>⌕</span>
            <h2>{t('search.findBook')}</h2>
            <p>{t('search.instructions')}</p>
            <a className="empty-results-action" href="/browse">
              {t('search.browseAll')} <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : results.length > 0 ? (
          <div className="book-grid">
            {results.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                wanted={wanted.has(book.id)}
                status={book.workId ? statuses.get(book.workId) : null}
                onToggle={toggleWanted}
                resolveMissingCover={false}
                detailReturnContext={detailReturnContext}
              />
            ))}
          </div>
        ) : (
          <div className="empty-results">
            <span>⌕</span>
            <h2>{t('home.noBooks')}</h2>
            <p>{t('home.tryAnother')}</p>
          </div>
        )}
        {hasQuery && <EditorialPagination state={filters} pageCount={pageCount} route="/search" />}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
