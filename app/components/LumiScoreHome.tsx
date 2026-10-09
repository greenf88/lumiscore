'use client';

import { LocaleLink } from './LumiScoreLocale';
import { localizedHref } from '@/lib/i18n/paths';

import Image from 'next/image';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Book } from '../data/books';
import type { HeaderAuthState } from '@/lib/auth/header';
import {
  getBookCoverImageSource,
  nextBookCoverAttempt,
  isUsableCoverImageDimensions,
  type CoverPresentation,
} from '@/lib/books/covers';
import {
  getBookCoverIdentity,
  getInitialBookCoverUrls,
} from '@/lib/books/book-cover-state';
import { getBookHref } from '@/lib/books/book-navigation';
import type { BookLinkReturnContext } from '@/lib/navigation/book-return';
import {
  CATALOG_SEARCH_DEBOUNCE_MS,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import { formatPublicRatingDisplay } from '@/lib/ratings/card-summaries';
import type { PersonalizedRecommendation } from '@/lib/recommendations/engine';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import type { Locale } from '@/lib/i18n/config';
import { translate } from '@/lib/i18n/translations';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreWordmark } from './LumiScoreWordmark';
import { LumiScoreAccountMenu } from './LumiScoreAccountMenu';
import type { HomepageSeriesContinuation } from '@/lib/supabase/collections';
import type { DutchHomepageDiscovery } from '@/lib/supabase/dutch-homepage-discovery';
import { useWantToRead } from './useWantToRead';
import type { ReadingStatus } from '@/lib/collections/model';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';

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

type BookCoverProps = {
  book: Book;
  small?: boolean;
  presentation?: CoverPresentation;
  label?: string;
  resolveMissing?: boolean;
};

function BookCoverForIdentity({
  book,
  small = false,
  presentation = small ? 'compact' : 'card',
  label,
  resolveMissing = true,
}: BookCoverProps) {
  const { t } = useLumiScoreLocale();
  const [coverUrls, setCoverUrls] = useState(() =>
    getInitialBookCoverUrls(book),
  );
  const [coverIndex, setCoverIndex] = useState(0);
  const [largeFallbackIndex, setLargeFallbackIndex] = useState<number | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const resolvedRequested = useRef(false);
  const coverUrl = coverUrls[coverIndex] ?? null;
  const imageSource = coverUrl
    ? getBookCoverImageSource(coverUrl, presentation, largeFallbackIndex === coverIndex)
    : null;
  const displayedCoverUrl = imageSource?.src ?? null;

  const requestResolvedCovers = useCallback(() => {
    if (
      !resolveMissing ||
      resolvedRequested.current ||
      (!book.openLibraryWorkId && !book.isbn13)
    ) return;

    resolvedRequested.current = true;
    void loadResolvedCovers(book).then((resolvedUrls) => {
      setCoverUrls((currentUrls) => [
        ...new Set([...currentUrls, ...resolvedUrls]),
      ]);
    });
  }, [book, resolveMissing]);

  useEffect(() => {
    if (!coverUrl) requestResolvedCovers();
  }, [coverUrl, requestResolvedCovers]);

  const handleCoverFailure = () => {
    const next = nextBookCoverAttempt(coverIndex, imageSource?.canRetryLarge ?? false);
    setCoverLoaded(false);
    setLargeFallbackIndex(next.largeFallbackIndex);
    setCoverIndex(next.index);
    // Try the same verified identity at L before resolving/advancing to another cover.
    if (next.index !== coverIndex) requestResolvedCovers();
  };

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
        <picture key={displayedCoverUrl}>
        {imageSource?.srcSet && <source srcSet={imageSource.srcSet} />}
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
              handleCoverFailure();
              return;
            }
            setCoverLoaded(true);
          }}
          onError={handleCoverFailure}
        />
        </picture>
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
  const { locale, t } = useLumiScoreLocale();

  return (
    <form className={`search-bar${mobile ? ' search-bar-mobile' : ''}`} action={localizedHref('/search', locale)} method="get" role="search">
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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationPanelId = `mobile-navigation-${useId().replaceAll(':', '')}`;
  const { locale, t } = useLumiScoreLocale();

  useEffect(() => {
    if (!mobileNavigationOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) {
        setMobileNavigationOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMobileNavigationOpen(false);
      navigationTriggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  return (
    <header className="site-header">
      <LumiScoreWordmark />
      <div className="header-search"><SearchBar query={query} onChange={onQueryChange} /></div>
      <nav className="main-nav" aria-label={t('header.mainNavigation')}>
        <LocaleLink href="/browse">{t('header.browse')}</LocaleLink>
        <LocaleLink href="/categories">{t('home.categories')}</LocaleLink>
        <LocaleLink href="/toplijsten">{locale === 'nl' ? 'Toplijsten' : 'Reading lists'}</LocaleLink>
        <LocaleLink className="taste-test-nav-link" href="/taste-test">{t('header.tasteTest')}</LocaleLink>
        <LocaleLink className="my-books-nav-link" href="/my-books">{t('header.myBooks')}</LocaleLink>
        <div className="mobile-navigation" ref={navigationRef}>
          <button
            className="mobile-navigation-trigger"
            type="button"
            ref={navigationTriggerRef}
            aria-label={t('header.openNavigation')}
            aria-expanded={mobileNavigationOpen}
            aria-controls={navigationPanelId}
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            <span className="hamburger-icon" aria-hidden="true"><i /><i /><i /></span>
          </button>
          {mobileNavigationOpen && <div
            className="mobile-navigation-panel"
            id={navigationPanelId}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                setMobileNavigationOpen(false);
              }
            }}
          >
            <LocaleLink href="/browse">{t('browse.books')}</LocaleLink>
            <LocaleLink href="/collections">{t('browse.collections')}</LocaleLink>
            <LocaleLink href="/categories">{t('home.categories')}</LocaleLink>
            <LocaleLink href="/toplijsten">{locale === 'nl' ? 'Toplijsten' : 'Reading lists'}</LocaleLink>
            <LocaleLink href="/taste-test">{t('header.tasteTest')}</LocaleLink>
            <LocaleLink href="/my-books">{t('header.myBooks')}</LocaleLink>
            <span className="mobile-navigation-divider" aria-hidden="true" />
            <LocaleLink href="/over-ons">{t('footer.about')}</LocaleLink>
            <LocaleLink href="/zo-werkt-het">{t('footer.howItWorks')}</LocaleLink>
            <LocaleLink href="/voor-uitgevers">{t('footer.publishers')}</LocaleLink>
            <LocaleLink href="/contact">{t('footer.contact')}</LocaleLink>
          </div>}
        </div>
        <button className="mobile-search-button" type="button" aria-label={t('header.openSearch')} aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((open) => !open)}><span className="search-icon" aria-hidden="true" /></button>
        <ThemeToggle onToggle={onThemeToggle} />
        <LanguageSwitcher />
        <LumiScoreAccountMenu authState={authState} returnTo={returnTo} />
      </nav>
      {mobileSearchOpen && <div className="mobile-search-drawer"><SearchBar query={query} onChange={onQueryChange} mobile /></div>}
    </header>
  );
}

const RecommendationRow = memo(function RecommendationRow({ book, recommendation, returnContext = { kind: 'home' } }: { book: Book; recommendation?: PersonalizedRecommendation; returnContext?: BookLinkReturnContext }) {
  const { locale } = useLumiScoreLocale();
  const score = book.score;
  const ratingDisplay = formatPublicRatingDisplay(
    score,
    book.ratingsCount ?? 0,
    locale,
    book.ratingBand,
  );
  const href = getBookHref(book, returnContext);
  const matchText = recommendation ? recommendationMatchLabel(recommendation, locale) : ratingDisplay.count;
  const content = (
    <>
      <BookCover book={book} small resolveMissing={false} />
      <span className="recommendation-copy">
        <strong>{book.title}</strong>
        <span>{book.author}</span>
        {matchText && <span className="match-line"><i /> {matchText}</span>}
        {recommendation?.explanation && <span className="recommendation-reason">{recommendation.explanation}</span>}
      </span>
      <span className="mini-score"><strong>{ratingDisplay.score}</strong><small>LumiScore</small></span>
    </>
  );

  return href ? (
    <LocaleLink className="recommendation-row" href={href}>{content}</LocaleLink>
  ) : (
    <div className="recommendation-row">{content}</div>
  );
});

export function recommendationMatchLabel(recommendation: PersonalizedRecommendation, locale: Locale): string {
  const label = translate(locale, 'home.yourMatch');
  if (recommendation.matchScore !== null) return `${label} ${recommendation.matchScore}%`;
  const labels = { 'Strong match': 'match.strong', 'Good match': 'match.good', 'Possible match': 'match.possible', 'Early match': 'match.early' } as const;
  const key = labels[recommendation.matchLabel as keyof typeof labels];
  return key ? `${label} · ${translate(locale, key)}` : label;
}

export function RecommendationsSection({ personalization, limit = 20, returnTo = '/' }: { personalization: HomepagePersonalization; limit?: number; returnTo?: string }) {
  const { locale, t } = useLumiScoreLocale();
  const nl = locale === 'nl';
  const items = useMemo(() => personalization.recommendations.slice(0, limit), [personalization.recommendations, limit]);
  const books = useMemo(() => items.map(item => item.book), [items]);
  const { wanted, statuses, toggleWanted } = useWantToRead(personalization.authenticated, books);
  if (personalization.unavailable) return <section className="featured-section" id="recommendations" aria-labelledby="recommendations-title">
    <h2 id="recommendations-title">{t('home.upNext')}</h2>
    <p role="alert">{nl ? 'Aanbevelingen konden niet laden. Dit is geen leeg profiel. Vernieuw de pagina om opnieuw te proberen.' : 'Recommendations could not load. This is not an empty profile. Refresh the page to try again.'}</p>
  </section>;
  return <section className="featured-section" id="recommendations" aria-labelledby="recommendations-title">
    <div className="section-heading"><h2 id="recommendations-title">{t('home.yourNextBooks')}</h2></div>
    {!personalization.hasEvidence ? <p>{nl ? 'We hebben nog geen bruikbaar smaakprofiel. Beoordeel gelezen boeken of hervat je smaaktest; we verzinnen geen persoonlijke matches.' : 'There is not enough taste evidence yet. Rate books you have read or resume your taste test; we do not invent personal matches.'} <LocaleLink href="/taste-test">{nl ? 'Smaaktest' : 'Taste test'}</LocaleLink></p>
      : items.length < 10 && <p role="status">{nl ? 'Er zijn momenteel minder dan tien geschikte, nog niet gelezen kandidaten met voldoende betrouwbare metadata. We tonen alleen de echte resultaten.' : 'There are currently fewer than ten suitable unread candidates with sufficiently reliable metadata. Only genuine results are shown.'}</p>}
    <div className="book-grid">{items.map(item => <BookCard key={item.book.workId} book={item.book}
      wanted={wanted.has(getGuestWantedStorageId(item.book))} status={item.book.workId ? statuses.get(item.book.workId) : null}
      onToggle={toggleWanted} resolveMissingCover={false} matchLabel={recommendationMatchLabel(item, locale)}
      detailReturnContext={returnTo === '/' ? { kind: 'home' } : { kind: 'recommendations', path: returnTo }} />)}</div>
  </section>;
}

const RecommendationPanel = memo(function RecommendationPanel({ personalization }: { personalization: HomepagePersonalization }) {
  const { t } = useLumiScoreLocale();
  const personalized = personalization.hasEvidence
    ? personalization.recommendations.slice(0, 3)
    : [];
  const showTasteTestCta = personalization.authenticated &&
    personalization.ratingCount < 10 &&
    personalization.tasteTestAnsweredCount < 10;
  return (
    <aside className="recommendation-panel" aria-labelledby="up-next-title">
      <div className="panel-heading">
        <div><h2 id="up-next-title">{t('home.yourNextBooks')}</h2><span className="eyebrow">{t('home.recommendationsCurated')}</span></div>
      </div>
      {showTasteTestCta && (
        <LocaleLink className="taste-test-cta" href="/taste-test">
          <strong>{t('home.improveRecommendations')}</strong>
          <span>{t('home.takeTasteTest')}</span>
        </LocaleLink>
      )}
      <div className="recommendation-list">
        {personalization.unavailable ? (
          <div className="recommendation-empty" role="status">
            <strong>{t('home.searchUnavailable')}</strong>
            <span>{t('home.tryAgain')}</span>
          </div>
        ) : personalized.length
          ? personalized.map((item) => <RecommendationRow key={item.book.id} book={item.book} recommendation={item} />)
          : <p className="recommendation-empty">{t('home.noPersonalEvidence')}</p>}
      </div>
      {!personalization.unavailable && <LocaleLink className="view-all" href="/recommendations">{t('home.seeMore')} <span>→</span></LocaleLink>}
    </aside>
  );
});

const Hero = memo(function Hero({ catalogStats, personalization }: { catalogStats: CatalogStats; personalization: HomepagePersonalization }) {
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
          <LocaleLink className="primary-cta" href="/taste-test">{t('home.tasteTestCta')} <span>→</span></LocaleLink>
          <div className="paper-features">
            <div><i>✦</i><span><strong>{t('home.smartRecommendations')}</strong><small>{t('home.personalizedForYou')}</small></span></div>
            <div><i>✓</i><span><strong>{t('home.trustedReaders')}</strong><small>{t('home.realMatches')}</small></span></div>
          </div>
          <LocaleLink className="learn-link" href="#how-it-works">{t('home.learn')} <span>→</span></LocaleLink>
          <dl className="hero-stats">
            <div><dt>{catalogStats.books === null ? '—' : catalogStats.books.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US')}</dt><dd>{t('home.curatedBooks')}</dd></div>
            <div><dt><LocaleLink href="/categories" aria-label={`${catalogStats.categories ?? '—'} ${t('home.categories')}`}>{catalogStats.categories ?? '—'}</LocaleLink></dt><dd><LocaleLink href="/categories">{t('home.categories')}</LocaleLink></dd></div>
          </dl>
        </div>
        {personalization.authenticated && <RecommendationPanel personalization={personalization} />}
      </div>
    </section>
  );
});

const CARD_STATUS_KEYS: Record<Exclude<ReadingStatus, 'want_to_read'>, 'collection.reading' | 'collection.read' | 'collection.dnf'> = {
  reading: 'collection.reading',
  read: 'collection.read',
  dnf: 'collection.dnf',
};

type BookCardProps = {
  book: Book;
  wanted?: boolean;
  status?: ReadingStatus | null;
  onToggle?: (book: Book) => void;
  resolveMissingCover?: boolean;
  detailReturnContext?: BookLinkReturnContext;
  label?: string;
  rank?: number;
  matchLabel?: string;
  href?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function BookCardIdentity({ book, resolveMissingCover = true, label, rank, matchLabel }: Pick<BookCardProps, 'book' | 'resolveMissingCover' | 'label' | 'rank' | 'matchLabel'>) {
  const { locale, t } = useLumiScoreLocale();
  const score = book.score;
  const ratingDisplay = formatPublicRatingDisplay(score, book.ratingsCount, locale, book.ratingBand);
  return (
    <>
      <div className="card-cover-wrap">
        {label && <span className="discovery-card-label">{label}</span>}
        {rank !== undefined && <span className="card-rank">#{rank}</span>}
        <span className="score-badge"><strong>{ratingDisplay.score}</strong><small>LumiScore</small></span>
        <BookCover book={book} resolveMissing={resolveMissingCover} />
      </div>
      <div className="book-card-body">
        <span className="book-year">{book.firstPublishYear != null
          ? t('common.firstPublished', { year: book.firstPublishYear })
          : t('common.publicationUnavailable')}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        {book.genre && <span className="book-genre">{book.genre}</span>}
        {matchLabel && <span className="book-match">{matchLabel}</span>}
        <div className="book-meta">
          <span>{ratingDisplay.count}</span>
        </div>
      </div>
    </>
  );
}

export const BookCard = memo(function BookCard({ book, wanted = false, status, onToggle, resolveMissingCover = true, detailReturnContext, label, rank, matchLabel, href: explicitHref, actions, children, className = '' }: BookCardProps) {
  const { t } = useLumiScoreLocale();
  const href = explicitHref ?? getBookHref(book, detailReturnContext);
  const bookContent = <BookCardIdentity book={book} resolveMissingCover={resolveMissingCover} label={label} rank={rank} matchLabel={matchLabel} />;
  return (
    <article className={`book-card${className ? ' ' + className : ''}`} id={book.id}>
      {href ? (
        // Vinext's production Link chunk loses navigateClientSide's named export.
        // Use native document navigation: Link cancels the click before throwing.
        <LocaleLink
          className="book-card-main-link"
          href={href}
          aria-label={t('home.viewBook', { title: book.title, author: book.author })}
        >
          {bookContent}
        </LocaleLink>
      ) : bookContent}
      {children}
      <div className="book-card-action">
        {actions !== undefined ? actions : status && status !== 'want_to_read' ? (
          <span className="card-reading-status">✓ {t(CARD_STATUS_KEYS[status])}</span>
        ) : onToggle ? (
          <button className={`want-button${wanted ? ' is-wanted' : ''}`} type="button" onClick={() => onToggle(book)} aria-pressed={wanted}>
            <span aria-hidden="true">{wanted ? '✓' : '+'}</span>{t('home.wantToRead')}
          </button>
        ) : null}
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
            <LocaleLink href={`/search?q=${encodeURIComponent(normalizeCatalogSearchQuery(query))}`}>{t('home.viewAllResults')} <b aria-hidden="true">→</b></LocaleLink>
          ) : null}
        </div>
      </div>
      {!searchActive && catalogUnavailable ? (
        <div className="empty-results" role="status"><span>⌕</span><h3>{t('home.catalogUnavailable')}</h3><p>{t('home.tryAgain')}</p></div>
      ) : hasError ? (
        <div className="empty-results" role="status"><span>⌕</span><h3>{t('home.searchUnavailable')}</h3><p>{t('home.tryAgain')}</p></div>
      ) : isLoading && displayedBooks.length === 0 ? (
        <div className="search-loading" role="status">{t('home.searchingCatalog')}</div>
      ) : displayedBooks.length > 0 ? (
        <div className="book-grid">{displayedBooks.map((book) => <BookCard key={book.id} book={book} wanted={wanted.has(book.id)} status={book.workId ? statuses.get(book.workId) : null} onToggle={onToggle} detailReturnContext={searchActive ? { kind: 'search', path: `/search?q=${encodeURIComponent(normalizeCatalogSearchQuery(query))}` } : { kind: 'home' }} />)}</div>
      ) : (
        <div className="empty-results"><span>⌕</span><h3>{t('home.noBooks')}</h3><p>{t('home.tryAnother')}</p></div>
      )}
      {!searchActive && !catalogUnavailable && <div className="section-more"><LocaleLink className="primary-cta" href="/browse?sort=highest">{t('home.seeMoreHighlyRated')} <span aria-hidden="true">→</span></LocaleLink></div>}
    </section>
  );
}

function DutchDiscoveryGroup({
  id,
  title,
  books,
  label,
  wanted,
  statuses,
  onToggle,
  source,
}: {
  id: string;
  title: string;
  books: Book[];
  label: string;
  wanted: Set<string>;
  statuses: ReadonlyMap<string, ReadingStatus>;
  onToggle: (book: Book) => void;
  source?: ReactNode;
}) {
  if (books.length === 0) return null;

  return (
    <section className="dutch-discovery-group" aria-labelledby={id}>
      <div className="dutch-discovery-group-heading">
        <h3 id={id}>{title}</h3>
        {source}
      </div>
      <div className="book-grid dutch-discovery-grid">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            wanted={wanted.has(book.id)}
            status={book.workId ? statuses.get(book.workId) : null}
            onToggle={onToggle}
            resolveMissingCover={false}
            detailReturnContext={{ kind: 'home' }}
            label={label}
          />
        ))}
      </div>
    </section>
  );
}

function DutchDiscoveryBooks({ discovery, wanted, statuses, onToggle }: { discovery: DutchHomepageDiscovery; wanted: Set<string>; statuses: ReadonlyMap<string, ReadingStatus>; onToggle: (book: Book) => void }) {
  const { t } = useLumiScoreLocale();
  if (discovery.popular.books.length === 0 && discovery.classics.books.length === 0) return null;

  const popularHeading = discovery.popular.current
    ? discovery.popular.personalized
      ? t('home.dutchPopularPersonalized')
      : t('home.dutchPopularNow')
    : t('home.dutchPopularFallback');
  const classicHeading = discovery.classics.personalized
    ? t('home.dutchClassicsPersonalized')
    : t('home.dutchClassics');

  return (
    <section className="featured-section dutch-discovery-section" aria-labelledby="dutch-discovery-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('home.dutchDiscoveryEyebrow')}</span>
          <h2 id="dutch-discovery-title">{t('home.dutchDiscoveryHeading')}</h2>
          <p className="section-intro">{t('home.dutchDiscoveryCopy')}</p>
        </div>
      </div>
      <div className="dutch-discovery-groups">
        <DutchDiscoveryGroup
          id="dutch-discovery-popular"
          title={popularHeading}
          books={discovery.popular.books}
          label={t('home.dutchPopularLabel')}
          wanted={wanted}
          statuses={statuses}
          onToggle={onToggle}
          source={discovery.popular.current ? (
            <LocaleLink href={discovery.popular.sourceUrl} target="_blank" rel="noreferrer">
              {t('home.dutchPopularSource', { week: discovery.popular.week })}
            </LocaleLink>
          ) : undefined}
        />
        <DutchDiscoveryGroup
          id="dutch-discovery-classics"
          title={classicHeading}
          books={discovery.classics.books}
          label={t('home.dutchClassicLabel')}
          wanted={wanted}
          statuses={statuses}
          onToggle={onToggle}
        />
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

function ContinueSeries({ continuations }: { continuations: HomepageSeriesContinuation[] }) {
  const { t } = useLumiScoreLocale();
  return (
    <section className="continue-series" aria-labelledby="continue-series-title">
      <div className="continue-series-heading">
        <span className="eyebrow">{t('collection.continueEyebrow')}</span>
        <h2 id="continue-series-title">{t('collection.continueHeading')}</h2>
        <LocaleLink className="continue-series-directory-link" href="/collections">{t('collections.browseAll')} →</LocaleLink>
      </div>
      <div className="continue-series-list">
        {continuations.map(({ collection, progress, action, actionBook }) => (
          <article className="continue-series-item" key={collection.id}>
            <div className="continue-series-copy">
              <LocaleLink href={`/collection/${collection.slug}`}>{collection.name}</LocaleLink>
              <p>{progress.total === null
                ? t('collection.readCount', { read: progress.read })
                : t('collection.readProgress', { read: progress.read, total: progress.total })}</p>
            </div>
            <LocaleLink className="continue-series-book" href={`/book/${actionBook.workId}`}>
              <BookCover book={actionBook} small label={actionBook.title} />
              <span>
                <small>{t(action === 'continue_reading'
                  ? 'collection.continueReading'
                  : 'collection.nextInSeries')}</small>
                <strong>{actionBook.title}</strong>
                <small>{actionBook.author}</small>
              </span>
              <b>{t('collection.continueAction')} →</b>
            </LocaleLink>
          </article>
        ))}
      </div>
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
        <LocaleLink className="domain-link" href="/">lumisco.re</LocaleLink>
      </div>
      <nav className="footer-nav" aria-label={t('footer.navigation')}>
        <LocaleLink href="/over-ons">{t('footer.about')}</LocaleLink>
        <LocaleLink href="/zo-werkt-het">{t('footer.howItWorks')}</LocaleLink>
        <LocaleLink href="/voor-uitgevers">{t('footer.publishers')}</LocaleLink>
        <LocaleLink href="/contact">{t('footer.contact')}</LocaleLink>
      </nav>
      <div className="footer-theme"><span>{t('footer.readingMode')}</span><ThemeToggle onToggle={onThemeToggle} labeled /></div>
      <div className="footer-bottom"><span>© 2026 LumiScore</span><span>{t('footer.madeForReaders')}</span></div>
    </footer>
  );
}

type CatalogStats = { books: number | null; categories: number | null };

export function LumiScoreHome({
  initialBooks,
  dutchDiscovery,
  catalogStats,
  personalization,
  authState,
  catalogUnavailable,
  seriesContinuations,
}: {
  initialBooks: Book[];
  dutchDiscovery: DutchHomepageDiscovery;
  catalogStats: CatalogStats;
  personalization: HomepagePersonalization;
  authState: HeaderAuthState;
  catalogUnavailable: boolean;
  seriesContinuations: HomepageSeriesContinuation[];
}) {
  const catalogBooks = initialBooks;
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const trackedBooks = useMemo(
    () => [...catalogBooks, ...dutchDiscovery.popular.books, ...dutchDiscovery.classics.books, ...searchResults],
    [catalogBooks, dutchDiscovery, searchResults],
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
      <Hero catalogStats={catalogStats} personalization={personalization} />
      {seriesContinuations.length > 0 && (
        <ContinueSeries continuations={seriesContinuations} />
      )}
      <FeaturedBooks books={catalogBooks} query={query} searchResults={searchResults} searchStatus={searchStatus} wanted={wanted} statuses={statuses} onToggle={toggleWanted} catalogUnavailable={catalogUnavailable} />
      <DutchDiscoveryBooks discovery={dutchDiscovery} wanted={wanted} statuses={statuses} onToggle={toggleWanted} />
      <ValueStrip />
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
