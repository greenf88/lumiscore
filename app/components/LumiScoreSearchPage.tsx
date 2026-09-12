'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Book } from '../data/books';
import { BookCard, Footer, Header } from './LumiScoreHome';

type LumiScoreSearchPageProps = {
  initialQuery: string;
  results: Book[];
  searchFailed: boolean;
};

export function LumiScoreSearchPage({
  initialQuery,
  results,
  searchFailed,
}: LumiScoreSearchPageProps) {
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
      />
      <section
        className="featured-section search-results-section"
        aria-labelledby="search-results-title"
      >
        <div className="section-heading search-results-heading">
          <div>
            <span className="eyebrow">FULL CATALOG</span>
            <h1 id="search-results-title">
              {hasQuery ? `Results for “${initialQuery}”` : 'Search books'}
            </h1>
          </div>
          <div className="section-tools">
            <span>
              {hasQuery
                ? `${results.length} ${results.length === 1 ? 'book' : 'books'}`
                : 'Enter a title or author'}
            </span>
          </div>
        </div>

        {searchFailed ? (
          <div className="empty-results" role="status">
            <span>⌕</span>
            <h2>Search unavailable</h2>
            <p>Please try again in a moment.</p>
          </div>
        ) : !hasQuery ? (
          <div className="empty-results">
            <span>⌕</span>
            <h2>Find a book</h2>
            <p>Search by title or author using the field above.</p>
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
            <h2>No books found</h2>
            <p>Try another title or author.</p>
          </div>
        )}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
