'use client';

import { LocaleLink } from './LumiScoreLocale';

import { useCallback, useMemo, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import type { EditorialQuery } from '@/lib/catalog/editorial-query';
import { EditorialCatalogControls } from './EditorialCatalogControls';
import { updateBrowseReturnPath } from '@/lib/navigation/browse-return';
import { BookCard, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { useWantToRead } from './useWantToRead';
import type { EditorialPage } from '@/lib/supabase/editorial-catalog';

type LumiScoreBrowsePageProps = {
  data: EditorialPage;
  authState: HeaderAuthState;
  returnTo: string;
  filters: EditorialQuery;
};

function paginationPages(currentPage: number, pageCount: number): Array<number | 'ellipsis'> {
  const visible = [...new Set([
    1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    pageCount,
  ].filter((page) => page >= 1 && page <= pageCount))].sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  for (const page of visible) {
    const previous = result[result.length - 1];
    if (typeof previous === 'number' && page - previous > 1) result.push('ellipsis');
    result.push(page);
  }
  return result;
}

export function LumiScoreBrowsePage({ data, authState, returnTo, filters }: LumiScoreBrowsePageProps) {
  const { locale, t } = useLumiScoreLocale();
  const [query, setQuery] = useState('');
  const { wanted, statuses, toggleWanted } = useWantToRead(
    authState.authenticated,
    data.books,
  );
  const pageItems = useMemo(
    () => paginationPages(data.page, data.pageCount),
    [data.page, data.pageCount],
  );
  const detailReturnContext = useMemo(
    () => ({ kind: 'browse' as const, path: returnTo }),
    [returnTo],
  );

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  return (
    <main className="site-shell browse-page-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={authState}
        returnTo={returnTo}
      />
      <section className="browse-page" aria-labelledby="browse-title">
        <nav className="directory-switcher" aria-label={t('browse.directoryNavigation')}>
          <LocaleLink href="/browse" aria-current="page">{t('browse.books')}</LocaleLink>
          <LocaleLink href="/collections">{t('browse.collections')}</LocaleLink>
        </nav>
        <div className="browse-heading">
          <div>
            <span className="eyebrow">{t('browse.eyebrow')}</span>
            <h1 id="browse-title">{t('browse.heading')}</h1>
            <p>{t('browse.copy')}</p>
          </div>
          <strong>
            {data.available
              ? t('browse.catalogCount', {
                  count: data.total.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US'),
                })
              : t('home.catalogUnavailable')}
          </strong>
        </div>

        <EditorialCatalogControls key={returnTo} state={filters} facets={data.facets} selectionCount={data.selectionCount} route="/browse" categories={data.categories} selectedAuthor={data.selectedAuthor} discoveryAvailable={data.discoveryAvailable} />

        {!data.available ? (
          <div className="empty-results" role="status">
            <span>⌕</span>
            <h2>{t('home.catalogUnavailable')}</h2>
            <p>{t('home.tryAgain')}</p>
          </div>
        ) : data.books.length > 0 ? (
          <div className="book-grid browse-book-grid">
            {data.books.map((book) => (
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
            <p>{t('browse.empty')}</p>
          </div>
        )}

        {data.available && data.pageCount > 1 && (
          <nav className="browse-pagination" aria-label={t('browse.pagination')}>
            {data.page > 1 ? (
              <LocaleLink href={updateBrowseReturnPath(returnTo, { page: data.page - 1 })} rel="prev">
                ← {t('browse.previous')}
              </LocaleLink>
            ) : <span aria-disabled="true">← {t('browse.previous')}</span>}
            <div>
              {pageItems.map((item, index) => item === 'ellipsis' ? (
                <span className="pagination-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
              ) : (
                <LocaleLink
                  href={updateBrowseReturnPath(returnTo, { page: item })}
                  aria-current={item === data.page ? 'page' : undefined}
                  aria-label={t('browse.pageLabel', { page: item })}
                  key={item}
                >
                  {item}
                </LocaleLink>
              ))}
            </div>
            {data.page < data.pageCount ? (
              <LocaleLink href={updateBrowseReturnPath(returnTo, { page: data.page + 1 })} rel="next">
                {t('browse.next')} →
              </LocaleLink>
            ) : <span aria-disabled="true">{t('browse.next')} →</span>}
          </nav>
        )}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
