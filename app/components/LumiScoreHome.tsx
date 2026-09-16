'use client';

import Image from 'next/image';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Book } from '../data/books';
import {
  getHeaderAuthPresentation,
  type HeaderAuthState,
} from '@/lib/auth/header';
import {
  getOpenLibraryCoverVariantUrl,
  isUsableCoverImageDimensions,
} from '@/lib/books/covers';
import {
  getBookCoverIdentity,
  getInitialBookCoverUrls,
} from '@/lib/books/book-cover-state';
import { getBookHref } from '@/lib/books/book-navigation';
import {
  CATALOG_SEARCH_DEBOUNCE_MS,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import { formatPublicRatingDisplay } from '@/lib/ratings/card-summaries';
import type { PersonalizedRecommendation } from '@/lib/recommendations/engine';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import type { Locale } from '@/lib/i18n/config';
import { formatLocalizedCount } from '@/lib/i18n/format';
import { translate } from '@/lib/i18n/translations';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';
import { shouldShowDutchDiscovery } from '@/lib/books/dutch-discovery';
import type { HomepageSeriesContinuation } from '@/lib/supabase/collections';
import { useWantToRead } from './useWantToRead';
import type { ReadingStatus } from '@/lib/collections/model';

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

type BookCoverProps = { book: Book; small?: boolean; label?: string };

function BookCoverForIdentity({ book, small = false, label }: BookCoverProps) {
  const { t } = useLumiScoreLocale();
  const [coverUrls, setCoverUrls] = useState(() =>
    getInitialBookCoverUrls(book),
  );
  const [coverIndex, setCoverIndex] = useState(0);
  const [coverLoaded, setCoverLoaded] = useState(false);
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
      <span className="cover-kicker">{t('common.lumiEdition')}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-mark">✦</span>
      <span className="cover-author">{book.author}</span>
      {displayedCoverUrl && (
        <Image
          key={displayedCoverUrl}
          className={`book-cover-image${coverLoaded ? ' is-loaded' : ''}`}
          src={displayedCoverUrl}
          alt=""
          fill
          sizes={small ? '43px' : '(max-width: 820px) 245px, (max-width: 1180px) 30vw, 15vw'}
          loading="lazy"
          unoptimized
          onLoad={(event) => {
            if (
              !isUsableCoverImageDimensions(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              )
            ) {
              requestResolvedCovers();
              setCoverLoaded(false);
              setCoverIndex((index) => index + 1);
              return;
            }
            setCoverLoaded(true);
          }}
          onError={() => {
            requestResolvedCovers();
            setCoverLoaded(false);
            setCoverIndex((index) => index + 1);
          }}
        />
      )}
    </div>
  );
}

export const BookCover = memo(function BookCover(props: BookCoverProps) {
  const coverIdentity = getBookCoverIdentity(props.book);

  return <BookCoverForIdentity key={coverIdentity} {...props} />;
});

function SearchBar({ query, onChange, mobile = false }: { query: string; onChange: (value: string) => void; mobile?: boolean }) {
  const inputId = useId();
  const { t } = useLumiScoreLocale();

  return (
    <form className={`search-bar${mobile ? ' search-bar-mobile' : ''}`} action="/search" method="get" role="search">
      <label className="sr-only" htmlFor={inputId}>{t('header.search')}</label>
      <span className="search-icon" aria-hidden="true" />
      <input id={inputId} name="q" value={query} onChange={(event) => onChange(event.target.value)} placeholder={t('header.search')} />
      {!mobile && <kbd>⌘ K</kbd>}
    </form>
  );
}

export function ThemeToggle({ onToggle, labeled = false }: { onToggle: () => void; labeled?: boolean }) {
  const { t } = useLumiScoreLocale();
  return (
    <button className={`theme-toggle${labeled ? ' theme-toggle-labeled' : ''}`} type="button" onClick={onToggle} aria-label={t('theme.toggle')}>
      {labeled && <><span className="toggle-label toggle-label-ink">{t('theme.ink')}</span><span className="toggle-label toggle-label-paper">{t('theme.paper')}</span></>}
      <span className="theme-sun" aria-hidden="true">☼</span>
      <span className="theme-track"><span className="theme-thumb" /></span>
      <span className="theme-moon" aria-hidden="true">☾</span>
    </button>
  );
}

export function Header({
  onThemeToggle,
  query,
  onQueryChange,
  authState,
  returnTo,
}: {
  onThemeToggle: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  authState: HeaderAuthState;
  returnTo: string;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const auth = getHeaderAuthPresentation(authState, returnTo);
  const { t } = useLumiScoreLocale();

  return (
    <header className="site-header">
      <LumiScoreWordmark />
      <div className="header-search"><SearchBar query={query} onChange={onQueryChange} /></div>
      <nav className="main-nav" aria-label={t('header.mainNavigation')}>
        <a href="/#discover">{t('header.discover')}</a>
        <a className="taste-test-nav-link" href="/taste-test">{t('header.tasteTest')}</a>
        <a className="my-books-nav-link" href="/my-books">{t('header.myBooks')}</a>
        <details className="mobile-navigation">
          <summary aria-label={t('header.openNavigation')}><span aria-hidden="true">•••</span></summary>
          <div className="mobile-navigation-panel">
            <a href="/#discover">{t('header.discover')}</a>
            <a href="/taste-test">{t('header.tasteTest')}</a>
            <a href="/my-books">{t('header.myBooks')}</a>
          </div>
        </details>
        <button className="mobile-search-button" type="button" aria-label={t('header.openSearch')} aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((open) => !open)}><span className="search-icon" aria-hidden="true" /></button>
        <ThemeToggle onToggle={onThemeToggle} />
        <LanguageSwitcher />
        {auth.authenticated ? (
          <details className="header-account">
            <summary aria-label={t('header.openAccount')}>
              <span className="header-account-avatar" aria-hidden="true">A</span>
              <span className="header-account-label">{t('header.account')}</span>
            </summary>
            <div className="header-account-panel">
              <span>{t('header.signedIn')}</span>
              <form action="/auth/sign-out" method="post">
                <input type="hidden" name="next" value={auth.returnTo} />
                <button type="submit">{t('header.signOut')}</button>
              </form>
            </div>
          </details>
        ) : (
          <a className="header-sign-in" href={auth.signInHref}>{t('header.signIn')}</a>
        )}
      </nav>
      {mobileSearchOpen && <div className="mobile-search-drawer"><SearchBar query={query} onChange={onQueryChange} mobile /></div>}
    </header>
  );
}

const RecommendationRow = memo(function RecommendationRow({ book, recommendation }: { book: Book; recommendation?: PersonalizedRecommendation }) {
  const { locale, t } = useLumiScoreLocale();
  const score = book.score;
  const ratingDisplay = formatPublicRatingDisplay(
    score,
    book.ratingsCount ?? 0,
    locale,
  );
  const ratingStatus =
    book.source === 'demo' && score !== null && (book.ratingsCount ?? 0) > 0
      ? formatCardRatingCount(book, locale)
      : ratingDisplay.count;
  const href = getBookHref(book);
  const matchText = recommendation
    ? recommendation.matchScore !== null
      ? `${t('home.yourMatch')} ${recommendation.matchScore}%`
      : recommendation.matchLabel === 'Strong match'
        ? t('match.strong')
        : recommendation.matchLabel === 'Good match'
          ? t('match.good')
          : recommendation.matchLabel === 'Possible match'
            ? t('match.possible')
            : recommendation.matchLabel === 'Early match'
              ? t('match.early')
              : ''
    : ratingStatus;
  const content = (
    <>
      <BookCover book={book} small />
      <span className="recommendation-copy">
        <strong>{book.title}</strong>
        <span>{book.author}</span>
        {matchText && <span className="match-line"><i /> {matchText}</span>}
        {recommendation?.explanation && <span className="recommendation-reason">{recommendation.explanation}</span>}
        {recommendation?.collaborativeExplanation && <span className="recommendation-reason recommendation-collaborative-reason">{recommendation.collaborativeExplanation}</span>}
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

const RecommendationPanel = memo(function RecommendationPanel({ books, personalization, catalogUnavailable }: { books: Book[]; personalization: HomepagePersonalization; catalogUnavailable: boolean }) {
  const { t } = useLumiScoreLocale();
  const personalized = personalization.hasEvidence
    ? personalization.recommendations.slice(0, 3)
    : [];
  const curated = [books[1], books[2], books[5]].filter((book): book is Book => Boolean(book));
  const showTasteTestCta = personalization.authenticated &&
    personalization.ratingCount < 10 &&
    personalization.tasteTestAnsweredCount < 10;
  return (
    <aside className="recommendation-panel" aria-labelledby="up-next-title">
      <div className="panel-heading">
        <div><span className="eyebrow">{personalized.length ? t('home.recommendationsCurated') : t('home.readerDiscoveries')}</span><h2 id="up-next-title">{personalized.length ? t('home.upNext') : t('home.popular')}</h2></div>
        <button type="button" aria-label={t('home.moreUnavailable')} title={t('home.moreComing')} disabled>↻</button>
      </div>
      {showTasteTestCta && (
        <a className="taste-test-cta" href="/taste-test">
          <strong>{t('home.improveRecommendations')}</strong>
          <span>{t('home.takeTasteTest')}</span>
        </a>
      )}
      <div className="recommendation-list">
        {catalogUnavailable && personalized.length === 0 ? (
          <div className="recommendation-empty" role="status">
            <strong>{t('home.catalogUnavailable')}</strong>
            <span>{t('home.tryAgain')}</span>
          </div>
        ) : personalized.length
          ? personalized.map((item) => <RecommendationRow key={item.book.id} book={item.book} recommendation={item} />)
          : curated.map((book) => <RecommendationRow key={book.id} book={book} />)}
      </div>
      {!catalogUnavailable && <a className="view-all" href="#discover">{t('home.browseAll')} <span>→</span></a>}
    </aside>
  );
});

const Hero = memo(function Hero({ books, catalogStats, personalization, catalogUnavailable }: { books: Book[]; catalogStats: CatalogStats; personalization: HomepagePersonalization; catalogUnavailable: boolean }) {
  const { locale, t } = useLumiScoreLocale();
  return (
    <section className="hero" id="top">
      <div className="hero-photo" aria-hidden="true" />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><i /> {t('home.nextFiveStar')}</span>
          <h1>{t('home.heroStart')}<br /><em>{t('home.heroEmphasis')}</em></h1>
          <p className="hero-primary">{t('home.heroPrimary')}</p>
          <p className="hero-paper-copy">{t('home.heroCopy')}</p>
          <a className="primary-cta" href="#discover">{t('home.findNext')} <span>→</span></a>
          <div className="paper-features">
            <div><i>✦</i><span><strong>{t('home.smartRecommendations')}</strong><small>{t('home.personalizedForYou')}</small></span></div>
            <div><i>✓</i><span><strong>{t('home.trustedReaders')}</strong><small>{t('home.realMatches')}</small></span></div>
          </div>
          <a className="learn-link" href="#how-it-works">{t('home.learn')} <span>→</span></a>
          <dl className="hero-stats">
            <div><dt>{catalogStats.books === null ? '—' : catalogStats.books.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')}</dt><dd>{t('home.curatedBooks')}</dd></div>
            <div><dt>{catalogStats.categories}</dt><dd>{t('home.categories')}</dd></div>
          </dl>
        </div>
        <RecommendationPanel books={books} personalization={personalization} catalogUnavailable={catalogUnavailable} />
      </div>
    </section>
  );
});

function formatRatings(count: number, locale: Locale) {
  if (count < 1000) {
    return formatLocalizedCount(locale, count, 'common.rating', 'common.ratings');
  }
  return `${Math.round(count / 1000)}k ${translate(locale, 'common.ratings')}`;
}

function formatCardRatingCount(book: Book, locale: Locale): string {
  const count = book.ratingsCount ?? 0;
  return book.source === 'demo'
    ? formatRatings(count, locale)
    : formatPublicRatingDisplay(book.score, count, locale).count;
}

const CARD_STATUS_KEYS: Record<Exclude<ReadingStatus, 'want_to_read'>, 'collection.reading' | 'collection.read' | 'collection.dnf'> = {
  reading: 'collection.reading',
  read: 'collection.read',
  dnf: 'collection.dnf',
};

export const BookCard = memo(function BookCard({ book, wanted, status, onToggle }: { book: Book; wanted: boolean; status?: ReadingStatus | null; onToggle: (book: Book) => void }) {
  const { locale, t } = useLumiScoreLocale();
  const score = book.score;
  const ratingDisplay = formatPublicRatingDisplay(score, book.ratingsCount ?? 0, locale);
  const hasRatings = ratingDisplay.score !== '—';
  const href = getBookHref(book);
  const bookContent = (
    <>
      <div className="card-cover-wrap">
        <span className="score-badge"><strong>{ratingDisplay.score}</strong><small>LumiScore</small></span>
        <BookCover book={book} />
      </div>
      <div className="book-card-body">
        <span className="book-genre">{book.genre ?? (book.firstPublishYear ? t('common.firstPublished', { year: book.firstPublishYear }) : t('common.publicationUnavailable'))}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="book-meta">
          <span>{hasRatings ? formatCardRatingCount(book, locale) : t('common.notRated')}</span>
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
          aria-label={t('home.viewBook', { title: book.title, author: book.author })}
        >
          {bookContent}
        </a>
      ) : bookContent}
      <div className="book-card-action">
        {status && status !== 'want_to_read' ? (
          <span className="card-reading-status">✓ {t(CARD_STATUS_KEYS[status])}</span>
        ) : (
          <button className={`want-button${wanted ? ' is-wanted' : ''}`} type="button" onClick={() => onToggle(book)} aria-pressed={wanted}>
            <span aria-hidden="true">{wanted ? '✓' : '+'}</span>{t('home.wantToRead')}
          </button>
        )}
      </div>
    </article>
  );
});

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

function FeaturedBooks({ books, query, searchResults, searchStatus, wanted, statuses, onToggle, catalogUnavailable }: { books: Book[]; query: string; searchResults: Book[]; searchStatus: SearchStatus; wanted: Set<string>; statuses: ReadonlyMap<string, ReadingStatus>; onToggle: (book: Book) => void; catalogUnavailable: boolean }) {
  const { locale, t } = useLumiScoreLocale();
  const searchActive = isCatalogSearchQuery(query);
  const displayedBooks = searchActive ? searchResults : books;
  const isLoading = searchActive && searchStatus === 'loading';
  const hasError = searchActive && searchStatus === 'error';

  return (
    <section className="featured-section" id="discover" aria-labelledby="featured-title">
      <div className="section-heading">
        <div><span className="eyebrow">{t('home.chosenByReaders')}</span><h2 id="featured-title">{searchActive ? t('home.searchResults') : t('home.highestRated')}</h2></div>
        <div className="section-tools">
          <span aria-live="polite">{isLoading ? t('home.searching') : `${displayedBooks.length.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')} ${t(displayedBooks.length === 1 ? 'common.book' : 'common.books')}`}</span>
          {searchActive && displayedBooks.length > 0 ? (
            <a href={`/search?q=${encodeURIComponent(normalizeCatalogSearchQuery(query))}`}>{t('home.viewAllResults')} <b aria-hidden="true">→</b></a>
          ) : (
            <span className="section-note">{t('home.searchFullCatalog')}</span>
          )}
        </div>
      </div>
      {!searchActive && catalogUnavailable ? (
        <div className="empty-results" role="status"><span>⌕</span><h3>{t('home.catalogUnavailable')}</h3><p>{t('home.tryAgain')}</p></div>
      ) : hasError ? (
        <div className="empty-results" role="status"><span>⌕</span><h3>{t('home.searchUnavailable')}</h3><p>{t('home.tryAgain')}</p></div>
      ) : isLoading && displayedBooks.length === 0 ? (
        <div className="search-loading" role="status">{t('home.searchingCatalog')}</div>
      ) : displayedBooks.length > 0 ? (
        <div className="book-grid">{displayedBooks.map((book) => <BookCard key={book.id} book={book} wanted={wanted.has(book.id)} status={book.workId ? statuses.get(book.workId) : null} onToggle={onToggle} />)}</div>
      ) : (
        <div className="empty-results"><span>⌕</span><h3>{t('home.noBooks')}</h3><p>{t('home.tryAnother')}</p></div>
      )}
    </section>
  );
}

function DutchDiscoveryBooks({ books, wanted, statuses, onToggle }: { books: Book[]; wanted: Set<string>; statuses: ReadonlyMap<string, ReadingStatus>; onToggle: (book: Book) => void }) {
  const { locale, t } = useLumiScoreLocale();
  if (!shouldShowDutchDiscovery(locale, books.length)) return null;

  return (
    <section className="featured-section dutch-discovery-section" aria-labelledby="dutch-discovery-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('home.dutchDiscoveryEyebrow')}</span>
          <h2 id="dutch-discovery-title">{t('home.dutchDiscoveryHeading')}</h2>
          <p className="section-intro">{t('home.dutchDiscoveryCopy')}</p>
        </div>
      </div>
      <div className="book-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} wanted={wanted.has(book.id)} status={book.workId ? statuses.get(book.workId) : null} onToggle={onToggle} />
        ))}
      </div>
    </section>
  );
}

const ValueStrip = memo(function ValueStrip() {
  const { t } = useLumiScoreLocale();
  const values = [
    { icon: '✦', title: t('home.personalizedPicks'), copy: t('home.madeForTaste') },
    { icon: '◎', title: t('home.readerMatches'), copy: t('home.notSponsored') },
    { icon: '8.7', title: t('home.trustedScores'), copy: t('home.ratingsDistilled') },
    { icon: '✓', title: t('home.trackDiscover'), copy: t('home.libraryWithYou') },
  ];
  return (
    <section className="value-strip" id="how-it-works" aria-label={t('home.why')}>
      <div className="value-inner">{values.map((value) => (
        <div className="value-item" key={value.title}><span className="value-icon">{value.icon}</span><span><strong>{value.title}</strong><small>{value.copy}</small></span></div>
      ))}</div>
    </section>
  );
});

function ContinueSeries({ continuation }: { continuation: HomepageSeriesContinuation }) {
  const { t } = useLumiScoreLocale();
  const { collection, progress, nextBook } = continuation;
  return (
    <section className="continue-series" aria-labelledby="continue-series-title">
      <div className="continue-series-copy">
        <span className="eyebrow">{t('collection.continueEyebrow')}</span>
        <h2 id="continue-series-title">{t('collection.continueHeading')}</h2>
        <a href={`/collection/${collection.slug}`}>{collection.name}</a>
        <p>{t('collection.readProgress', { read: progress.read, total: progress.total })}</p>
      </div>
      <a className="continue-series-book" href={`/book/${nextBook.workId}`}>
        <BookCover book={nextBook} small label={nextBook.title} />
        <span><strong>{nextBook.title}</strong><small>{nextBook.author}</small></span>
        <b>{t('collection.continueAction')} →</b>
      </a>
    </section>
  );
}

export function Footer({ onThemeToggle }: { onThemeToggle: () => void }) {
  const { t } = useLumiScoreLocale();
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <LumiScoreWordmark />
        <p>{t('footer.tagline')}</p>
        <a className="domain-link" href="/">lumisco.re</a>
      </div>
      <nav className="footer-nav" aria-label={t('footer.navigation')}><span aria-disabled="true" title={t('footer.aboutComing')}>{t('footer.about')}</span><a href="/#how-it-works">{t('footer.howItWorks')}</a><span aria-disabled="true" title={t('footer.publishersComing')}>{t('footer.publishers')}</span><span aria-disabled="true" title={t('footer.helpComing')}>{t('footer.help')}</span></nav>
      <div className="footer-theme"><span>{t('footer.readingMode')}</span><ThemeToggle onToggle={onThemeToggle} labeled /></div>
      <div className="footer-bottom"><span>© 2026 LumiScore</span><span>{t('footer.madeForReaders')}</span></div>
    </footer>
  );
}

type CatalogStats = { books: number | null; categories: number };

export function LumiScoreHome({ initialBooks, dutchDiscoveryBooks, catalogStats, personalization, authState, catalogUnavailable, seriesContinuation }: { initialBooks: Book[]; dutchDiscoveryBooks: Book[]; catalogStats: CatalogStats; personalization: HomepagePersonalization; authState: HeaderAuthState; catalogUnavailable: boolean; seriesContinuation: HomepageSeriesContinuation | null }) {
  const catalogBooks = initialBooks;
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const trackedBooks = useMemo(
    () => [...catalogBooks, ...dutchDiscoveryBooks, ...searchResults],
    [catalogBooks, dutchDiscoveryBooks, searchResults],
  );
  const { wanted, statuses, toggleWanted } = useWantToRead(authState.authenticated, trackedBooks);

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

  return (
    <main className="site-shell">
      <Header onThemeToggle={toggleTheme} query={query} onQueryChange={updateQuery} authState={authState} returnTo="/" />
      <Hero books={catalogBooks} catalogStats={catalogStats} personalization={personalization} catalogUnavailable={catalogUnavailable} />
      {seriesContinuation && <ContinueSeries continuation={seriesContinuation} />}
      <FeaturedBooks books={catalogBooks} query={query} searchResults={searchResults} searchStatus={searchStatus} wanted={wanted} statuses={statuses} onToggle={toggleWanted} catalogUnavailable={catalogUnavailable} />
      <DutchDiscoveryBooks books={dutchDiscoveryBooks} wanted={wanted} statuses={statuses} onToggle={toggleWanted} />
      <ValueStrip />
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
