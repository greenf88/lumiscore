'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  countMyBooksByStatus,
  filterMyBooks,
  MY_BOOKS_STATUSES,
  type MyBooksItem,
} from '@/lib/collections/my-books';
import type { ReadingStatus } from '@/lib/collections/model';
import type { MyBooksPageData } from '@/lib/supabase/book-status';
import { formatPublicRatingDisplay } from '@/lib/ratings/card-summaries';
import { BookCover, Footer, Header } from './LumiScoreHome';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreReadingStatus } from './LumiScoreReadingStatus';
import { migrateGuestWantToReadFromLocal } from './useWantToRead';

const STATUS_KEYS: Record<ReadingStatus, 'myBooks.wantToRead' | 'myBooks.reading' | 'myBooks.read' | 'myBooks.dnf'> = {
  want_to_read: 'myBooks.wantToRead',
  reading: 'myBooks.reading',
  read: 'myBooks.read',
  dnf: 'myBooks.dnf',
};

const EMPTY_KEYS: Record<ReadingStatus, 'myBooks.emptyWantToRead' | 'myBooks.emptyReading' | 'myBooks.emptyRead' | 'myBooks.emptyDnf'> = {
  want_to_read: 'myBooks.emptyWantToRead',
  reading: 'myBooks.emptyReading',
  read: 'myBooks.emptyRead',
  dnf: 'myBooks.emptyDnf',
};

function MyBooksCard({
  item,
  onStatusChange,
}: {
  item: MyBooksItem;
  onStatusChange: (status: ReadingStatus | null) => void;
}) {
  const { locale, t } = useLumiScoreLocale();
  const { book, status } = item;
  const rating = formatPublicRatingDisplay(book.score, book.ratingsCount ?? 0, locale);
  const statusLabel = t(STATUS_KEYS[status]);

  return (
    <article className="book-card my-books-card">
      <a className="book-card-main-link" href={`/book/${book.workId}`} aria-label={t('home.viewBook', { title: book.title, author: book.author })}>
        <div className="card-cover-wrap">
          <span className="score-badge"><strong>{rating.score}</strong><small>LumiScore</small></span>
          <BookCover book={book} />
        </div>
        <div className="book-card-body">
          <span className="book-genre">{book.firstPublishYear ? t('common.firstPublished', { year: book.firstPublishYear }) : t('common.publicationUnavailable')}</span>
          <h3>{book.title}</h3>
          <p>{book.author}</p>
          <div className="book-meta"><span>{rating.count}</span></div>
        </div>
      </a>
      <div className="book-card-action my-books-card-action">
        <span className="my-books-status" aria-label={t('myBooks.currentStatus', { status: statusLabel })}>{statusLabel}</span>
        <LumiScoreReadingStatus
          workId={book.workId!}
          status={status}
          authenticated
          returnTo="/my-books"
          compact
          onStatusChange={onStatusChange}
        />
      </div>
    </article>
  );
}

export function LumiScoreMyBooks({ data }: { data: MyBooksPageData }) {
  const { t } = useLumiScoreLocale();
  const [query, setQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState<ReadingStatus>('want_to_read');
  const [items, setItems] = useState(data.items);
  const migrationStarted = useRef(false);
  const counts = useMemo(() => countMyBooksByStatus(items), [items]);
  const visibleItems = useMemo(
    () => filterMyBooks(items, activeStatus),
    [activeStatus, items],
  );

  useEffect(() => {
    if (!data.authenticated || migrationStarted.current) return;
    migrationStarted.current = true;
    const controller = new AbortController();
    void migrateGuestWantToReadFromLocal(controller.signal)
      .then((migrated) => {
        if (migrated) window.location.reload();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [data.authenticated]);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const updateItemStatus = (workId: string, status: ReadingStatus | null) => {
    setItems((current) => status
      ? current.map((item) => item.book.workId === workId ? { ...item, status } : item)
      : current.filter((item) => item.book.workId !== workId));
  };

  return (
    <main className="site-shell my-books-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={{ authenticated: data.authenticated }}
        returnTo="/my-books"
      />
      <section className="my-books-page">
        <div className="my-books-heading">
          <span className="eyebrow">{t('myBooks.eyebrow')}</span>
          <h1>{t('myBooks.heading')}</h1>
          <p>{t('myBooks.copy')}</p>
        </div>

        {!data.authenticated ? (
          <div className="my-books-gate">
            <h2>{t('myBooks.signInHeading')}</h2>
            <p>{t('myBooks.signInCopy')}</p>
            <a className="primary-cta" href="/login?next=%2Fmy-books">{t('myBooks.signIn')} <span>→</span></a>
          </div>
        ) : !data.available ? (
          <div className="my-books-empty" role="status">
            <h2>{t('myBooks.unavailable')}</h2>
            <p>{t('myBooks.unavailableCopy')}</p>
          </div>
        ) : (
          <>
            <div className="my-books-tabs" role="tablist" aria-label={t('myBooks.heading')}>
              {MY_BOOKS_STATUSES.map((status) => (
                <button
                  key={status}
                  id={`my-books-tab-${status}`}
                  type="button"
                  role="tab"
                  aria-selected={activeStatus === status}
                  aria-controls="my-books-panel"
                  onClick={() => setActiveStatus(status)}
                >
                  {t(STATUS_KEYS[status])} <span>{counts[status]}</span>
                </button>
              ))}
            </div>
            <div
              id="my-books-panel"
              className="my-books-panel"
              role="tabpanel"
              aria-labelledby={`my-books-tab-${activeStatus}`}
            >
              {visibleItems.length > 0 ? (
                <div className="book-grid my-books-grid">
                  {visibleItems.map((item) => (
                    <MyBooksCard
                      key={item.book.workId}
                      item={item}
                      onStatusChange={(status) => updateItemStatus(item.book.workId!, status)}
                    />
                  ))}
                </div>
              ) : (
                <div className="my-books-empty">
                  <h2>{t(EMPTY_KEYS[activeStatus])}</h2>
                  <a href="/#discover">{t('myBooks.discover')} →</a>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
