'use client';

import { useCallback, useState } from 'react';
import type { Book } from '../data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { BookCard, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { useWantToRead } from './useWantToRead';

type LumiScoreSearchPageProps = {
  initialQuery: string;
  results: Book[];
  searchFailed: boolean;
  authState: HeaderAuthState;
};

export function LumiScoreSearchPage({
  initialQuery,
  results,
  searchFailed,
  authState,
}: LumiScoreSearchPageProps) {
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState(initialQuery);
  const { wanted, statuses, toggleWanted } = useWantToRead(authState.authenticated, results);

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
        returnTo={initialQuery ? `/search?q=${encodeURIComponent(initialQuery)}` : '/search'}
      />
      <section
        className="featured-section search-results-section"
        aria-labelledby="search-results-title"
      >
        <div className="section-heading search-results-heading">
          <div>
            <span className="eyebrow">{t('search.fullCatalog')}</span>
            <h1 id="search-results-title">
              {hasQuery ? t('search.resultsFor', { query: initialQuery }) : t('search.title')}
            </h1>
          </div>
          <div className="section-tools">
            <span>
              {hasQuery
                ? `${results.length.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')} ${t(results.length === 1 ? 'common.book' : 'common.books')}`
                : t('search.enterTitle')}
            </span>
          </div>
        </div>

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
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
