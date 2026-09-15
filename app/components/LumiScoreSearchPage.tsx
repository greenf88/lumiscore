'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Book } from '../data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import { BookCard, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';

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
  const [wanted, setWanted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let animationFrame = 0;
    try {
      const stored = JSON.parse(
        localStorage.getItem('lumiscore-wanted') ?? '[]',
      ) as string[];
      animationFrame = requestAnimationFrame(() => setWanted(new Set(stored)));
    } catch {
      // This local preference is optional.
    }
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const toggleTheme = useCallback(() => {
    const next =
      document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme =
      next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const toggleWanted = useCallback((id: string) => {
    setWanted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('lumiscore-wanted', JSON.stringify([...next]));
      return next;
    });
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
          </div>
        ) : results.length > 0 ? (
          <div className="book-grid">
            {results.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                wanted={wanted.has(book.id)}
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
