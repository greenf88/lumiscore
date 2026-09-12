'use client';

import Image from 'next/image';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Book } from '../data/books';
import {
  getOpenLibraryCoverUrl,
  getOpenLibraryCoverVariantUrl,
} from '@/lib/books/covers';
import { getBookHref } from '@/lib/books/book-navigation';
import {
  CATALOG_SEARCH_DEBOUNCE_MS,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import { formatPublicRatingDisplay } from '@/lib/ratings/card-summaries';
import { LumiScoreWordmark } from './LumiScoreWordmark';

const resolvedCoverCache = new Map<
  string,
  { expiresAt: number; result: Promise<string[]> }
>();
const RESOLVED_COVER_CACHE_MS = 30 * 24 * 60 * 60 * 1_000;
const MISSING_COVER_CACHE_MS = 60 * 60 * 1_000;
const TEMPORARY_COVER_FAILURE_CACHE_MS = 60 * 1_000;
const catalogSearchCache = new Map<string, Book[]>();
const MAX_CACHED_SEARCHES = 50;

async function loadResolvedCovers(book: Book): Promise<string[]> {
  if (!book.openLibraryWorkId && !book.isbn13) return [];

  const cacheKey = `${book.workId ?? 'unknown'}:${book.openLibraryWorkId ?? 'native'}:${book.isbn13 ?? ''}`;
  const cached = resolvedCoverCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) resolvedCoverCache.delete(cacheKey);

  const params = new URLSearchParams({
    title: book.title,
    author: book.author,
  });
  if (book.openLibraryWorkId) params.set('workId', book.openLibraryWorkId);
  if (book.workId) params.set('lumiScoreWorkId', book.workId);
  if (book.isbn13) params.set('isbn13', book.isbn13);
  if (book.firstPublishYear) {
    params.set('year', String(book.firstPublishYear));
  }

  const request = fetch(`/api/open-library/covers?${params}`)
    .then(async (response) => {
      if (!response.ok) return [];

      const data = (await response.json()) as {
        coverUrls?: unknown;
        state?: unknown;
      };
      const coverUrls = Array.isArray(data.coverUrls)
        ? data.coverUrls.filter(
            (url): url is string => typeof url === 'string' && url.length > 0,
          )
        : [];
      const ttl = coverUrls.length
        ? RESOLVED_COVER_CACHE_MS
        : data.state === 'temporary_failure'
          ? TEMPORARY_COVER_FAILURE_CACHE_MS
          : MISSING_COVER_CACHE_MS;
      resolvedCoverCache.set(cacheKey, {
        expiresAt: Date.now() + ttl,
        result: Promise.resolve(coverUrls),
      });
      return coverUrls;
    })
    .catch(() => {
      resolvedCoverCache.delete(cacheKey);
      return [];
    });

  resolvedCoverCache.set(cacheKey, {
    expiresAt: Date.now() + TEMPORARY_COVER_FAILURE_CACHE_MS,
    result: request,
  });
  return request;
}

export const BookCover = memo(function BookCover({ book, small = false, label }: { book: Book; small?: boolean; label?: string }) {
  const initialCoverUrls = useMemo(
    () =>
      book.coverUrls?.length
        ? book.coverUrls
        : [getOpenLibraryCoverUrl(book.isbn13)].filter(
            (url): url is string => url !== null,
          ),
    [book.coverUrls, book.isbn13],
  );
  const [coverUrls, setCoverUrls] = useState(initialCoverUrls);
  const [coverIndex, setCoverIndex] = useState(0);
  const resolvedRequested = useRef(false);
  const coverUrl = coverUrls[coverIndex] ?? null;
  const displayedCoverUrl = coverUrl
    ? getOpenLibraryCoverVariantUrl(coverUrl, small ? 'M' : 'L')
    : null;

  const requestResolvedCovers = useCallback(() => {
    if (
      resolvedRequested.current ||
      (!book.openLibraryWorkId && !book.isbn13)
    ) return;

    resolvedRequested.current = true;
    void loadResolvedCovers(book).then((resolvedUrls) => {
      setCoverUrls((currentUrls) => [
        ...new Set([...currentUrls, ...resolvedUrls]),
      ]);
    });
  }, [book]);

  useEffect(() => {
    if (!coverUrl) requestResolvedCovers();
  }, [coverUrl, requestResolvedCovers]);

  return (
    <div
      className={`book-cover cover-${book.cover}${small ? ' book-cover-small' : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="cover-kicker">Lumi edition</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-mark">✦</span>
      <span className="cover-author">{book.author}</span>
      {displayedCoverUrl && (
        <Image
          key={displayedCoverUrl}
          className="book-cover-image"
          src={displayedCoverUrl}
          alt=""
          fill
          sizes={small ? '43px' : '(max-width: 820px) 245px, (max-width: 1180px) 30vw, 15vw'}
          loading="lazy"
          unoptimized
          onError={() => {
            requestResolvedCovers();
            setCoverIndex((index) => index + 1);
          }}
        />
      )}
    </div>
  );
});

function getDemoMatch(book: Book): number | null {
  return book.source === 'demo' ? book.match : null;
}

function SearchBar({ query, onChange, mobile = false }: { query: string; onChange: (value: string) => void; mobile?: boolean }) {
  const inputId = useId();

  return (
    <form className={`search-bar${mobile ? ' search-bar-mobile' : ''}`} action="/search" method="get" role="search">
      <label className="sr-only" htmlFor={inputId}>Search books or authors</label>
      <span className="search-icon" aria-hidden="true" />
      <input id={inputId} name="q" value={query} onChange={(event) => onChange(event.target.value)} placeholder="Search books or authors" />
      {!mobile && <kbd>⌘ K</kbd>}
    </form>
  );
}

export function ThemeToggle({ onToggle, labeled = false }: { onToggle: () => void; labeled?: boolean }) {
  return (
    <button className={`theme-toggle${labeled ? ' theme-toggle-labeled' : ''}`} type="button" onClick={onToggle} aria-label="Toggle Ink and Paper theme">
      {labeled && <><span className="toggle-label toggle-label-ink">Ink</span><span className="toggle-label toggle-label-paper">Paper</span></>}
      <span className="theme-sun" aria-hidden="true">☼</span>
      <span className="theme-track"><span className="theme-thumb" /></span>
      <span className="theme-moon" aria-hidden="true">☾</span>
    </button>
  );
}

export function Header({ onThemeToggle, query, onQueryChange }: { onThemeToggle: () => void; query: string; onQueryChange: (value: string) => void }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="site-header">
      <LumiScoreWordmark />
      <div className="header-search"><SearchBar query={query} onChange={onQueryChange} /></div>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="/#discover">Discover</a>
        <span className="nav-unavailable" aria-disabled="true" title="Reading lists are coming soon">My lists</span>
        <button className="mobile-search-button" type="button" aria-label="Open search" aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((open) => !open)}><span className="search-icon" aria-hidden="true" /></button>
        <ThemeToggle onToggle={onThemeToggle} />
        <button className="avatar" type="button" aria-label="Reader profile is not available yet" title="Reader profile is coming soon" disabled>RG</button>
      </nav>
      {mobileSearchOpen && <div className="mobile-search-drawer"><SearchBar query={query} onChange={onQueryChange} mobile /></div>}
    </header>
  );
}

const RecommendationRow = memo(function RecommendationRow({ book }: { book: Book }) {
  const score = book.score;
  const match = getDemoMatch(book);
  const ratingDisplay = formatPublicRatingDisplay(
    score,
    book.ratingsCount ?? 0,
  );
  const ratingStatus =
    book.source === 'demo' && score !== null && (book.ratingsCount ?? 0) > 0
      ? formatCardRatingCount(book)
      : ratingDisplay.count;
  const href = getBookHref(book);
  const content = (
    <>
      <BookCover book={book} small />
      <span className="recommendation-copy">
        <strong>{book.title}</strong>
        <span>{book.author}</span>
        <span className="match-line"><i /> {match === null ? ratingStatus : `${match}% match`}</span>
      </span>
      <span className="mini-score"><strong>{ratingDisplay.score}</strong><small>LumiScore</small></span>
    </>
  );

  return href ? (
    <a className="recommendation-row" href={href}>{content}</a>
  ) : (
    <div className="recommendation-row">{content}</div>
  );
});

const RecommendationPanel = memo(function RecommendationPanel({ books }: { books: Book[] }) {
  const recommendations = [books[1], books[2], books[5]].filter(
    (book): book is Book => Boolean(book),
  );
  return (
    <aside className="recommendation-panel" aria-labelledby="up-next-title">
      <div className="panel-heading">
        <div><span className="eyebrow">CURATED FOR YOUR TASTE</span><h2 id="up-next-title">Up next for you</h2></div>
        <button type="button" aria-label="More recommendations are not available yet" title="More recommendations are coming soon" disabled>↻</button>
      </div>
      <div className="recommendation-list">{recommendations.map((book) => <RecommendationRow key={book.id} book={book} />)}</div>
      <a className="view-all" href="#discover">View all recommendations <span>→</span></a>
    </aside>
  );
});

const Hero = memo(function Hero({ books, catalogStats }: { books: Book[]; catalogStats: CatalogStats }) {
  return (
    <section className="hero" id="top">
      <div className="hero-photo" aria-hidden="true" />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><i /> YOUR NEXT FIVE-STAR READ</span>
          <h1>Find your next<br /><em>great read</em></h1>
          <p className="hero-primary">Smart recommendations. Real reader matches.</p>
          <p className="hero-paper-copy">LumiScore analyzes millions of reader ratings to help you discover books you&apos;ll truly love.</p>
          <a className="primary-cta" href="#discover">Find your next book <span>→</span></a>
          <div className="paper-features">
            <div><i>✦</i><span><strong>Smart recommendations</strong><small>Personalized for you</small></span></div>
            <div><i>✓</i><span><strong>Trusted by readers</strong><small>Real ratings. Real matches.</small></span></div>
          </div>
          <a className="learn-link" href="#how-it-works">New here? Learn how LumiScore works <span>→</span></a>
          <dl className="hero-stats">
            <div><dt>{catalogStats.books.toLocaleString('en-US')}</dt><dd>Curated books</dd></div>
            <div><dt>{catalogStats.categories}</dt><dd>Categories</dd></div>
          </dl>
        </div>
        <RecommendationPanel books={books} />
      </div>
    </section>
  );
});

function formatRatings(count: number) {
  return count >= 1000 ? `${Math.round(count / 1000)}k ratings` : `${count} ratings`;
}

function formatCardRatingCount(book: Book): string {
  const count = book.ratingsCount ?? 0;
  return book.source === 'demo'
    ? formatRatings(count)
    : formatPublicRatingDisplay(book.score, count).count;
}

export const BookCard = memo(function BookCard({ book, wanted, onToggle }: { book: Book; wanted: boolean; onToggle: (id: string) => void }) {
  const score = book.score;
  const match = getDemoMatch(book);
  const ratingDisplay = formatPublicRatingDisplay(score, book.ratingsCount ?? 0);
  const hasRatings = ratingDisplay.score !== '—';
  const href = getBookHref(book);
  const bookContent = (
    <>
      <div className="card-cover-wrap">
        <span className="score-badge"><strong>{ratingDisplay.score}</strong><small>LumiScore</small></span>
        <BookCover book={book} />
      </div>
      <div className="book-card-body">
        <span className="book-genre">{book.genre ?? (book.firstPublishYear ? `First published ${book.firstPublishYear}` : 'Publication year unavailable')}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="book-meta">
          <span>{hasRatings ? formatCardRatingCount(book) : 'Not rated yet'}</span>
          {match !== null && <span className="book-match"><i /> {match}% match</span>}
        </div>
      </div>
    </>
  );

  return (
    <article className="book-card" id={book.id}>
      {href ? (
        // Vinext's production Link chunk loses navigateClientSide's named export.
        // Use native document navigation: Link cancels the click before throwing.
        <a
          className="book-card-main-link"
          href={href}
          aria-label={`View ${book.title} by ${book.author}`}
        >
          {bookContent}
        </a>
      ) : bookContent}
      <div className="book-card-action">
        <button className={`want-button${wanted ? ' is-wanted' : ''}`} type="button" onClick={() => onToggle(book.id)} aria-pressed={wanted}>
          <span aria-hidden="true">{wanted ? '✓' : '+'}</span>{wanted ? 'Want to read' : 'Want to read'}
        </button>
      </div>
    </article>
  );
});

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

function FeaturedBooks({ books, query, searchResults, searchStatus, wanted, onToggle }: { books: Book[]; query: string; searchResults: Book[]; searchStatus: SearchStatus; wanted: Set<string>; onToggle: (id: string) => void }) {
  const searchActive = isCatalogSearchQuery(query);
  const displayedBooks = searchActive ? searchResults : books;
  const isLoading = searchActive && searchStatus === 'loading';
  const hasError = searchActive && searchStatus === 'error';

  return (
    <section className="featured-section" id="discover" aria-labelledby="featured-title">
      <div className="section-heading">
        <div><span className="eyebrow">CHOSEN BY READERS</span><h2 id="featured-title">{searchActive ? 'Search results' : 'Featured today'}</h2></div>
        <div className="section-tools">
          <span aria-live="polite">{isLoading ? 'Searching…' : `${displayedBooks.length} ${displayedBooks.length === 1 ? 'book' : 'books'}`}</span>
          {searchActive && displayedBooks.length > 0 ? (
            <a href={`/search?q=${encodeURIComponent(normalizeCatalogSearchQuery(query))}`}>View all results <b aria-hidden="true">→</b></a>
          ) : (
            <span className="section-note">Search for the full catalog</span>
          )}
        </div>
      </div>
      {hasError ? (
        <div className="empty-results" role="status"><span>⌕</span><h3>Search unavailable</h3><p>Please try again in a moment.</p></div>
      ) : isLoading && displayedBooks.length === 0 ? (
        <div className="search-loading" role="status">Searching the LumiScore catalog…</div>
      ) : displayedBooks.length > 0 ? (
        <div className="book-grid">{displayedBooks.map((book) => <BookCard key={book.id} book={book} wanted={wanted.has(book.id)} onToggle={onToggle} />)}</div>
      ) : (
        <div className="empty-results"><span>⌕</span><h3>No books found</h3><p>Try another title or author.</p></div>
      )}
    </section>
  );
}

const values = [
  { icon: '✦', title: 'Personalized picks', copy: 'Made for your reading taste' },
  { icon: '◎', title: 'Real reader matches', copy: 'Taste-based, not sponsored' },
  { icon: '8.7', title: 'Trusted scores', copy: 'Millions of ratings distilled' },
  { icon: '✓', title: 'Track & discover', copy: 'One library, always with you' },
];

const ValueStrip = memo(function ValueStrip() {
  return (
    <section className="value-strip" id="how-it-works" aria-label="Why LumiScore">
      <div className="value-inner">{values.map((value) => (
        <div className="value-item" key={value.title}><span className="value-icon">{value.icon}</span><span><strong>{value.title}</strong><small>{value.copy}</small></span></div>
      ))}</div>
    </section>
  );
});

export function Footer({ onThemeToggle }: { onThemeToggle: () => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <LumiScoreWordmark />
        <p>Your next great read is closer than you think.</p>
        <a className="domain-link" href="/">lumisco.re</a>
      </div>
      <nav className="footer-nav" aria-label="Footer navigation"><span aria-disabled="true" title="About page coming soon">About</span><a href="/#how-it-works">How it works</a><span aria-disabled="true" title="Publisher information coming soon">For publishers</span><span aria-disabled="true" title="Help center coming soon">Help</span></nav>
      <div className="footer-theme"><span>Reading mode</span><ThemeToggle onToggle={onThemeToggle} labeled /></div>
      <div className="footer-bottom"><span>© 2026 LumiScore</span><span>Made for readers everywhere.</span></div>
    </footer>
  );
}

type CatalogStats = { books: number; categories: number };

export function LumiScoreHome({ initialBooks, catalogStats }: { initialBooks: Book[]; catalogStats: CatalogStats }) {
  const catalogBooks = initialBooks;
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [wanted, setWanted] = useState<Set<string>>(new Set());

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    const normalizedQuery = normalizeCatalogSearchQuery(value);
    const cachedResults = catalogSearchCache.get(
      normalizedQuery.toLocaleLowerCase('en-US'),
    );

    if (cachedResults) {
      setSearchResults(cachedResults);
      setSearchStatus('success');
    } else if (isCatalogSearchQuery(normalizedQuery)) {
      setSearchStatus('loading');
    } else {
      setSearchResults([]);
      setSearchStatus('idle');
    }
  }, []);

  useEffect(() => {
    const normalizedQuery = normalizeCatalogSearchQuery(query);
    if (!isCatalogSearchQuery(normalizedQuery)) return;

    const searchCacheKey = normalizedQuery.toLocaleLowerCase('en-US');
    if (catalogSearchCache.has(searchCacheKey)) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch(`/api/catalog/search?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Catalog search failed.');
          const payload = (await response.json()) as { results?: unknown };
          const results = Array.isArray(payload.results)
            ? (payload.results as Book[])
            : [];
          if (catalogSearchCache.size >= MAX_CACHED_SEARCHES) {
            const oldestKey = catalogSearchCache.keys().next().value;
            if (oldestKey) catalogSearchCache.delete(oldestKey);
          }
          catalogSearchCache.set(searchCacheKey, results);
          setSearchResults(results);
          setSearchStatus('success');
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setSearchResults([]);
          setSearchStatus('error');
        });
    }, CATALOG_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    let animationFrame = 0;
    try {
      const stored = JSON.parse(localStorage.getItem('lumiscore-wanted') ?? '[]') as string[];
      animationFrame = requestAnimationFrame(() => setWanted(new Set(stored)));
    } catch { /* local preference is optional */ }
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search-bar input')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  const toggleWanted = useCallback((id: string) => {
    setWanted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('lumiscore-wanted', JSON.stringify([...next]));
      return next;
    });
  }, []);

  return (
    <main className="site-shell">
      <Header onThemeToggle={toggleTheme} query={query} onQueryChange={updateQuery} />
      <Hero books={catalogBooks} catalogStats={catalogStats} />
      <FeaturedBooks books={catalogBooks} query={query} searchResults={searchResults} searchStatus={searchStatus} wanted={wanted} onToggle={toggleWanted} />
      <ValueStrip />
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
