'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '@/app/data/books';
import {
  GUEST_WANTED_STORAGE_KEY,
  getGuestWantedWorkIds,
} from '@/lib/collections/guest-want-to-read';
import {
  countMyBooksByStatus,
  createGuestWantToReadItems,
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
import {
  migrateGuestWantToReadFromLocal,
  readGuestWantedFromLocalStorage,
  useWantToRead,
} from './useWantToRead';

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
  authenticated,
  onStatusChange,
  onGuestRemove,
}: {
  item: MyBooksItem;
  authenticated: boolean;
  onStatusChange: (status: ReadingStatus | null) => void;
  onGuestRemove?: () => void;
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
          <BookCover book={book} resolveMissing={authenticated} />
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
        {authenticated ? (
          <LumiScoreReadingStatus
            workId={book.workId!}
            status={status}
            authenticated
            returnTo="/my-books"
            compact
            onStatusChange={onStatusChange}
          />
        ) : (
          <button
            className="my-books-remove"
            type="button"
            aria-label={t('myBooks.removeLabel', { title: book.title })}
            onClick={onGuestRemove}
          >
            {t('myBooks.remove')}
          </button>
        )}
      </div>
    </article>
  );
}

type GuestMyBooksState = {
  available: boolean;
  items: MyBooksItem[];
  loading: boolean;
};

function GuestMyBooks() {
  const { t } = useLumiScoreLocale();
  const [state, setState] = useState<GuestMyBooksState>({
    available: true,
    items: [],
    loading: true,
  });
  const books = useMemo(() => state.items.map((item) => item.book), [state.items]);
  const { toggleWanted } = useWantToRead(false, books);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      const workIds = getGuestWantedWorkIds(readGuestWantedFromLocalStorage());
      if (workIds.length === 0) {
        if (active) setState({ available: true, items: [], loading: false });
        return;
      }

      if (active) setState((current) => ({ ...current, loading: true }));
      try {
        const response = await fetch(
          `/api/catalog/books?workIds=${encodeURIComponent(workIds.join(','))}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Guest books could not be loaded.');
        const payload = (await response.json()) as { books?: Book[] };
        if (!active) return;
        setState({
          available: true,
          items: createGuestWantToReadItems(payload.books ?? [], workIds),
          loading: false,
        });
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setState({ available: false, items: [], loading: false });
      }
    };

    void load();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GUEST_WANTED_STORAGE_KEY) void load();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const removeBook = (book: Book) => {
    toggleWanted(book);
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.book.workId !== book.workId),
    }));
  };

  return (
    <>
      <aside className="my-books-guest-cta">
        <p>{t('myBooks.guestSignInCopy')}</p>
        <a href="/login?next=%2Fmy-books">{t('myBooks.signIn')} <span>→</span></a>
      </aside>
      {state.loading ? (
        <div className="my-books-loading" role="status">{t('myBooks.loading')}</div>
      ) : !state.available ? (
        <div className="my-books-empty" role="status">
          <h2>{t('myBooks.unavailable')}</h2>
          <p>{t('myBooks.unavailableCopy')}</p>
        </div>
      ) : state.items.length > 0 ? (
        <div className="book-grid my-books-grid guest-my-books-grid">
          {state.items.map((item) => (
            <MyBooksCard
              key={item.book.workId}
              item={item}
              authenticated={false}
              onStatusChange={() => undefined}
              onGuestRemove={() => removeBook(item.book)}
            />
          ))}
        </div>
      ) : (
        <div className="my-books-empty">
          <h2>{t('myBooks.emptyWantToRead')}</h2>
          <p>{t('myBooks.emptyWantToReadCopy')}</p>
          <a href="/#discover">{t('myBooks.discover')} →</a>
        </div>
      )}
    </>
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
          <p>{t(data.authenticated ? 'myBooks.copy' : 'myBooks.guestCopy')}</p>
        </div>

        {!data.authenticated ? (
          <GuestMyBooks />
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
                      authenticated
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
