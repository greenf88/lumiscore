'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Book } from '../data/books';
import { getVerifiedBackCover } from '@/lib/books/book-detail';
import {
  formatRatingCount,
  MAX_RATING,
  MIN_RATING,
  type BookRatingState,
} from '@/lib/ratings/model';
import { BookCover, ThemeToggle } from './LumiScoreHome';
import { LumiScoreBookDescription } from './LumiScoreBookDescription';
import { LanguageSwitcher, useLumiScoreLocale } from './LumiScoreLocale';
import { LumiScoreReadingStatus } from './LumiScoreReadingStatus';
import { LumiScoreWordmark } from './LumiScoreWordmark';
import type { ReadingStatus } from '@/lib/collections/model';
import type { BookCollectionContext } from '@/lib/supabase/collections';
import type { BookDetailPersonalization } from '@/lib/supabase/taste-test';
import {
  calculatePersonalMatch,
  type MatchLabel,
  type PersonalMatchResult,
} from '@/lib/recommendations/engine';
import { buildTasteProfile } from '@/lib/taste-test/profile';
import {
  parseGuestTasteTestAnswers,
  TASTE_TEST_GUEST_STORAGE_KEY,
} from '@/lib/taste-test/guest-storage';

type LumiScoreBookDetailProps = {
  book: Book;
  initialRatingState: BookRatingState;
  initialReadingStatus: ReadingStatus | null;
  collectionContext: BookCollectionContext | null;
  personalization: BookDetailPersonalization;
};

const MATCH_LABEL_KEYS: Record<MatchLabel, 'match.strong' | 'match.good' | 'match.possible' | 'match.early'> = {
  'Strong match': 'match.strong',
  'Good match': 'match.good',
  'Possible match': 'match.possible',
  'Early match': 'match.early',
};

const ratingChoices = Array.from(
  { length: MAX_RATING - MIN_RATING + 1 },
  (_, index) => index + MIN_RATING,
);

export function LumiScoreBookDetail({
  book,
  initialRatingState,
  initialReadingStatus,
  collectionContext,
  personalization,
}: LumiScoreBookDetailProps) {
  const { locale, t } = useLumiScoreLocale();
  const [ratingState, setRatingState] = useState(initialRatingState);
  const [readingStatus, setReadingStatus] = useState<ReadingStatus | null>(
    initialReadingStatus,
  );
  const [pendingRating, setPendingRating] = useState<number | 'remove' | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [guestPersonalization, setGuestPersonalization] = useState<{
    key: string;
    hasEvidence: boolean;
    match: PersonalMatchResult | null;
  } | null>(null);
  const detailPath = `/book/${book.workId}`;
  const loginHref = `/login?next=${encodeURIComponent(detailPath)}`;
  const score =
    ratingState.ratingCount > 0 && ratingState.lumiscore !== null
      ? ratingState.lumiscore.toFixed(1)
      : '—';
  const backCover = getVerifiedBackCover(book);
  const isAuthenticated = ratingState.authenticated;
  const guestPersonalizationKey = `${book.workId ?? book.id}:${locale}:${personalization.candidate ? 'candidate' : 'none'}`;
  const currentGuestPersonalization = guestPersonalization?.key === guestPersonalizationKey
    ? guestPersonalization
    : null;
  const hasTasteEvidence = isAuthenticated
    ? personalization.hasEvidence
    : currentGuestPersonalization?.hasEvidence ?? false;
  const personalMatch = isAuthenticated
    ? personalization.match
    : currentGuestPersonalization?.match ?? null;
  const matchValue = personalMatch?.matchScore !== null && personalMatch?.matchScore !== undefined
    ? `${personalMatch.matchScore}%`
    : personalMatch?.matchLabel
      ? t(MATCH_LABEL_KEYS[personalMatch.matchLabel])
      : '—';
  const matchCopy = !hasTasteEvidence
    ? t('detail.unlockMatch')
    : !personalization.candidate || personalization.candidate.coverageLevel === 'none'
      ? t('detail.matchNeedsBookMetadata')
      : personalMatch?.explanation
        ? personalMatch.explanation
        : personalMatch?.matchLabel === 'Early match'
          ? t('detail.matchEarlyCopy')
          : t('detail.matchNoOverlap');

  useEffect(() => {
    const candidate = personalization.candidate;
    if (isAuthenticated || !candidate) return;
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      const answers = parseGuestTasteTestAnswers(
        localStorage.getItem(TASTE_TEST_GUEST_STORAGE_KEY),
      );
      const profile = buildTasteProfile(answers, [], locale);
      const hasEvidence = profile.selectedCount > 0;
      setGuestPersonalization({
        key: guestPersonalizationKey,
        hasEvidence,
        match: hasEvidence
          ? calculatePersonalMatch({
            profile,
            candidate,
            workId: book.workId ?? book.id,
            locale,
          })
          : null,
      });
    });

    return () => {
      active = false;
    };
  }, [
    book.id,
    book.workId,
    guestPersonalizationKey,
    isAuthenticated,
    locale,
    personalization.candidate,
  ]);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  };

  const updateRating = async (rating: number) => {
    setPendingRating(rating);
    setRatingError(null);

    try {
      const response = await fetch(`/api/ratings/${book.workId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      const payload = (await response.json()) as {
        state?: BookRatingState;
        error?: string;
      };
      if (response.status === 401) {
        window.location.assign(loginHref);
        return;
      }
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? t('detail.ratingSaveError'));
      }
      setRatingState(payload.state);
      setReadingStatus('read');
    } catch (error) {
      setRatingError(
        error instanceof Error ? error.message : t('detail.ratingSaveError'),
      );
    } finally {
      setPendingRating(null);
    }
  };

  const removeRating = async () => {
    setPendingRating('remove');
    setRatingError(null);

    try {
      const response = await fetch(`/api/ratings/${book.workId}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as {
        state?: BookRatingState;
        error?: string;
      };
      if (response.status === 401) {
        window.location.assign(loginHref);
        return;
      }
      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? t('detail.ratingRemoveError'));
      }
      setRatingState(payload.state);
    } catch (error) {
      setRatingError(
        error instanceof Error ? error.message : t('detail.ratingRemoveError'),
      );
    } finally {
      setPendingRating(null);
    }
  };

  return (
    <main className="book-detail-shell">
      <header className="detail-header">
        <LumiScoreWordmark />
        <div className="detail-header-actions">
          <a className="detail-taste-test-link" href="/taste-test">{t('detail.tasteTest')}</a>
          {ratingState.authenticated ? (
            <form className="detail-account" action="/auth/sign-out" method="post">
              <input type="hidden" name="next" value={detailPath} />
              {ratingState.userEmail && <span>{ratingState.userEmail}</span>}
              <button type="submit">{t('detail.signOut')}</button>
            </form>
          ) : (
            <a className="detail-sign-in" href={loginHref}>{t('detail.signIn')}</a>
          )}
          <LanguageSwitcher />
          <ThemeToggle onToggle={toggleTheme} labeled />
        </div>
      </header>

      <article className={`book-detail${backCover ? ' has-back-cover' : ''}`}>
        <div className="detail-cover-gallery" role="group" aria-label={t('detail.bookCovers')}>
          <figure className="detail-cover-figure">
            <div className="detail-cover-wrap">
              <span className="score-badge detail-score-badge"><strong>{score}</strong><small>LumiScore</small></span>
              <BookCover book={book} label={t('detail.frontCoverOf', { title: book.title })} />
            </div>
            <figcaption>{t('detail.frontCover')}</figcaption>
          </figure>
          {backCover && (
            <figure className="detail-cover-figure">
              <div className="detail-cover-wrap detail-back-cover-wrap">
                <div className="book-cover detail-back-cover">
                  <Image
                    src={backCover.url}
                    alt={t('detail.backCoverOf', { title: book.title })}
                    fill
                    sizes="(max-width: 560px) 78vw, 250px"
                    unoptimized
                  />
                </div>
              </div>
              <figcaption>{t('detail.backCover')}</figcaption>
            </figure>
          )}
        </div>
        <div className="detail-copy">
          <a className="detail-back-link" href="/">← {t('detail.backToBooks')}</a>
          <h1>{book.title}</h1>
          <p className="detail-author">{t('detail.by', { author: book.author })}</p>
          <p className="detail-year">{book.firstPublishYear ? t('common.firstPublished', { year: book.firstPublishYear }) : t('common.publicationUnavailable')}</p>

          {collectionContext && (
            <section className="detail-collection" aria-label={t('collection.collection')}>
              <a href={`/collection/${collectionContext.collection.slug}`}>
                <strong>
                  {t(
                    collectionContext.collection.collectionType === 'series'
                      ? 'collection.partOfSeries'
                      : collectionContext.collection.collectionType === 'author_collection'
                        ? 'collection.partOfAuthor'
                        : 'collection.partOfUniverse',
                    { name: collectionContext.collection.name },
                  )}
                  {collectionContext.collection.collectionType === 'series' && collectionContext.position !== null
                    ? ` · ${t('collection.bookOf', { position: collectionContext.position, total: collectionContext.total })}`
                    : ''}
                </strong>
                <span>
                  {collectionContext.progress
                    ? `${t('collection.readProgress', { read: collectionContext.progress.read, total: collectionContext.progress.total })} · `
                    : ''}
                  {t(collectionContext.collection.collectionType === 'series'
                    ? 'collection.viewFullSeries'
                    : 'collection.viewAllBooks')} →
                </span>
              </a>
            </section>
          )}

          <div className="detail-score-grid">
            <section className="detail-score-panel" aria-labelledby="lumiscore-heading">
              <span id="lumiscore-heading">LumiScore</span>
              <strong>{score}</strong>
              <p>{ratingState.ratingCount === 0 ? t('common.notRated') : formatRatingCount(ratingState.ratingCount, locale)}</p>
            </section>
            <section className="detail-score-panel detail-match-panel" aria-labelledby="match-heading">
              <span id="match-heading">{t('detail.yourMatch')}</span>
              <strong>{matchValue}</strong>
              <p>{matchCopy}</p>
            </section>
          </div>

          {book.workId && <LumiScoreBookDescription workId={book.workId} />}

          {book.workId && (
            <LumiScoreReadingStatus
              workId={book.workId}
              status={readingStatus}
              authenticated={ratingState.authenticated}
              returnTo={detailPath}
              onStatusChange={setReadingStatus}
            />
          )}

          <section className="rating-section" aria-labelledby="rate-book-heading">
            <div>
              <span className="eyebrow">{t('detail.yourRating')}</span>
              <h2 id="rate-book-heading">{t('detail.rateBook')}</h2>
              <p>{ratingState.authenticated
                ? ratingState.userRating
                  ? t('detail.currentRating', { rating: ratingState.userRating })
                  : t('detail.chooseRating')
                : t('detail.signInRatingCopy')}</p>
            </div>
            {ratingState.authenticated ? (
              <>
                <div className="rating-options" aria-label={t('detail.chooseRatingLabel')}>
                  {ratingChoices.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={t('detail.rateOutOf', { rating })}
                      aria-pressed={ratingState.userRating === rating}
                      disabled={pendingRating !== null}
                      onClick={() => void updateRating(rating)}
                    >
                      {pendingRating === rating ? '…' : rating}
                    </button>
                  ))}
                </div>
                {ratingState.userRating && (
                  <button
                    className="rating-remove"
                    type="button"
                    disabled={pendingRating !== null}
                    onClick={() => void removeRating()}
                  >
                    {pendingRating === 'remove' ? t('detail.removing') : t('detail.removeRating')}
                  </button>
                )}
              </>
            ) : (
              <a className="primary-cta rating-sign-in" href={loginHref}>{t('detail.signInToRate')} <span>→</span></a>
            )}
            <p className="rating-feedback" role="status" aria-live="polite">{ratingError ?? ''}</p>
          </section>

          <section className="detail-information" aria-labelledby="book-information-heading">
            <h2 id="book-information-heading">{t('detail.information')}</h2>
            <dl>
              <div><dt>{t('detail.author')}</dt><dd>{book.author}</dd></div>
              <div><dt>{t('detail.firstPublishedLabel')}</dt><dd>{book.firstPublishYear ?? t('common.unknown')}</dd></div>
              {book.editionTitle && book.editionTitle !== book.title && <div><dt>{t('detail.edition')}</dt><dd>{book.editionTitle}</dd></div>}
              {book.editionPublisher && <div><dt>{t('detail.publisher')}</dt><dd>{book.editionPublisher}</dd></div>}
              {book.editionLanguage && <div><dt>{t('detail.language')}</dt><dd>{book.editionLanguage.toUpperCase()}</dd></div>}
              {book.isbn13 && <div><dt>ISBN-13</dt><dd>{book.isbn13}</dd></div>}
              {!book.isbn13 && book.isbn10 && <div><dt>ISBN-10</dt><dd>{book.isbn10}</dd></div>}
            </dl>
          </section>
        </div>
      </article>
    </main>
  );
}
