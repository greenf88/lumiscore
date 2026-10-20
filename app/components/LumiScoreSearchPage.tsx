'use client';

import { LocaleLink } from './LumiScoreLocale';

import { useCallback, useMemo, useState } from 'react';
import type { Book } from '../data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { BookCard, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { useWantToRead } from './useWantToRead';
import type { EditorialQuery } from '@/lib/catalog/editorial-query';
import { EditorialPagination } from './EditorialCatalogControls';
import { BrowseCatalogControls } from './BrowseCatalogControls';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
import type { PublicCategory, AuthorOption } from '@/lib/catalog/discovery';

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
  selectionCount: number | null;
  categories: PublicCategory[];
  selectedAuthor: AuthorOption | null;
  discoveryAvailable: boolean;
};

export function LumiScoreSearchPage({
  initialQuery,
  results,
  searchFailed,
  authState,
  searchReturnTo,
  filters, total, facets, pageCount, selectionCount, categories, selectedAuthor, discoveryAvailable,
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

  const hasQuery = initialQuery.length >= 2;

  return (
    <main className="site-shell search-page-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={authState}
        returnTo={searchReturnTo}
        searchTargetId="browse-query"
      />
      <section
        className="featured-section search-results-section"
        aria-labelledby="search-results-title"
      >
        <div className="section-heading search-results-heading">
          <div>
            <h1 id="search-results-title">
              {initialQuery.length >= 2 ? t('search.resultsFor', { query: initialQuery }) : t('search.title')}
            </h1>
          </div>
          <div className="section-tools">
            <span>
              {searchFailed ? t('home.searchUnavailable') : hasQuery
                ? `${total.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')} ${t(total === 1 ? 'common.book' : 'common.books')}`
                : t('search.enterTitle')}
            </span>
          </div>
        </div>

        <BrowseCatalogControls key={searchReturnTo} state={filters} facets={facets} selectionCount={selectionCount} route="/search" categories={categories} selectedAuthor={selectedAuthor} discoveryAvailable={discoveryAvailable} resultCount={null} />
        {searchFailed ? (
          <div className="empty-results" role="status">
            <span>⌕</span>
            <h2>{t('home.searchUnavailable')}</h2>
            <p>{t('home.tryAgain')} {locale === 'nl' ? 'Probeer ook een specifiekere titel of auteursnaam.' : 'Try a more specific title or author name.'}</p>
          </div>
        ) : !hasQuery ? (
          <div className="empty-results">
            <span>⌕</span>
            <h2>{t('search.findBook')}</h2>
            <p>{t('search.instructions')}</p>
            <LocaleLink className="empty-results-action" href="/browse">
              {t('search.browseAll')} <span aria-hidden="true">→</span>
            </LocaleLink>
          </div>
        ) : results.length > 0 ? (
          <div className="book-grid browse-book-grid">
            {results.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                variant="browse"
                wanted={wanted.has(getGuestWantedStorageId(book))}
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
