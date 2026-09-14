'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Book } from '../data/books';
import {
  getCatalogSourceLabel,
  getVerifiedBackCover,
} from '@/lib/books/book-detail';
import {
  formatRatingCount,
  MAX_RATING,
  MIN_RATING,
  type BookRatingState,
} from '@/lib/ratings/model';
import { BookCover, ThemeToggle } from './LumiScoreHome';
import { LumiScoreBookDescription } from './LumiScoreBookDescription';
import { LumiScoreWordmark } from './LumiScoreWordmark';

type LumiScoreBookDetailProps = {
  book: Book;
  initialRatingState: BookRatingState;
};

const ratingChoices = Array.from(
  { length: MAX_RATING - MIN_RATING + 1 },
  (_, index) => index + MIN_RATING,
);

export function LumiScoreBookDetail({
  book,
  initialRatingState,
}: LumiScoreBookDetailProps) {
  const [ratingState, setRatingState] = useState(initialRatingState);
  const [pendingRating, setPendingRating] = useState<number | 'remove' | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const detailPath = `/book/${book.workId}`;
  const loginHref = `/login?next=${encodeURIComponent(detailPath)}`;
  const score =
    ratingState.ratingCount > 0 && ratingState.lumiscore !== null
      ? ratingState.lumiscore.toFixed(1)
      : '—';
  const backCover = getVerifiedBackCover(book);

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
        throw new Error(payload.error ?? 'Your rating could not be saved.');
      }
      setRatingState(payload.state);
    } catch (error) {
      setRatingError(
        error instanceof Error ? error.message : 'Your rating could not be saved.',
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
        throw new Error(payload.error ?? 'Your rating could not be removed.');
      }
      setRatingState(payload.state);
    } catch (error) {
      setRatingError(
        error instanceof Error ? error.message : 'Your rating could not be removed.',
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
          <a className="detail-taste-test-link" href="/taste-test">Taste Test</a>
          {ratingState.authenticated ? (
            <form className="detail-account" action="/auth/sign-out" method="post">
              <input type="hidden" name="next" value={detailPath} />
              {ratingState.userEmail && <span>{ratingState.userEmail}</span>}
              <button type="submit">Sign out</button>
            </form>
          ) : (
            <a className="detail-sign-in" href={loginHref}>Sign in</a>
          )}
          <ThemeToggle onToggle={toggleTheme} labeled />
        </div>
      </header>

      <article className={`book-detail${backCover ? ' has-back-cover' : ''}`}>
        <div className="detail-cover-gallery" role="group" aria-label="Book covers">
          <figure className="detail-cover-figure">
            <div className="detail-cover-wrap">
              <span className="score-badge detail-score-badge"><strong>{score}</strong><small>LumiScore</small></span>
              <BookCover book={book} label={`Front cover of ${book.title}`} />
            </div>
            <figcaption>Front cover</figcaption>
          </figure>
          {backCover && (
            <figure className="detail-cover-figure">
              <div className="detail-cover-wrap detail-back-cover-wrap">
                <div className="book-cover detail-back-cover">
                  <Image
                    src={backCover.url}
                    alt={`Back cover of ${book.title}`}
                    fill
                    sizes="(max-width: 560px) 78vw, 250px"
                    unoptimized
                  />
                </div>
              </div>
              <figcaption>Back cover</figcaption>
            </figure>
          )}
        </div>
        <div className="detail-copy">
          <a className="detail-back-link" href="/">← Back to books</a>
          <span className="eyebrow">{getCatalogSourceLabel(book)}</span>
          <h1>{book.title}</h1>
          <p className="detail-author">by {book.author}</p>
          <p className="detail-year">{book.firstPublishYear ? `First published ${book.firstPublishYear}` : 'Publication year unavailable'}</p>

          <div className="detail-score-grid">
            <section className="detail-score-panel" aria-labelledby="lumiscore-heading">
              <span id="lumiscore-heading">LumiScore</span>
              <strong>{score}</strong>
              <p>{ratingState.ratingCount === 0 ? 'Not rated yet' : formatRatingCount(ratingState.ratingCount)}</p>
            </section>
            <section className="detail-score-panel detail-match-panel" aria-labelledby="match-heading">
              <span id="match-heading">Your Match</span>
              <strong>—</strong>
              <p>Rate books to unlock your match</p>
            </section>
          </div>

          {book.workId && <LumiScoreBookDescription workId={book.workId} />}

          <section className="rating-section" aria-labelledby="rate-book-heading">
            <div>
              <span className="eyebrow">YOUR RATING</span>
              <h2 id="rate-book-heading">Rate this book</h2>
              <p>{ratingState.authenticated
                ? ratingState.userRating
                  ? `Your current rating is ${ratingState.userRating}/10.`
                  : 'Choose one whole-number score from 1 to 10.'
                : 'Sign in to add your rating. Browsing remains open without an account.'}</p>
            </div>
            {ratingState.authenticated ? (
              <>
                <div className="rating-options" aria-label="Choose a rating from 1 to 10">
                  {ratingChoices.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`Rate ${rating} out of 10`}
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
                    {pendingRating === 'remove' ? 'Removing…' : 'Remove my rating'}
                  </button>
                )}
              </>
            ) : (
              <a className="primary-cta rating-sign-in" href={loginHref}>Sign in to rate <span>→</span></a>
            )}
            <p className="rating-feedback" role="status" aria-live="polite">{ratingError ?? ''}</p>
          </section>

          <section className="detail-information" aria-labelledby="book-information-heading">
            <h2 id="book-information-heading">Book information</h2>
            <dl>
              <div><dt>Author</dt><dd>{book.author}</dd></div>
              <div><dt>First published</dt><dd>{book.firstPublishYear ?? 'Unknown'}</dd></div>
              {book.editionTitle && book.editionTitle !== book.title && <div><dt>Edition</dt><dd>{book.editionTitle}</dd></div>}
              {book.editionPublisher && <div><dt>Publisher</dt><dd>{book.editionPublisher}</dd></div>}
              {book.editionLanguage && <div><dt>Language</dt><dd>{book.editionLanguage.toUpperCase()}</dd></div>}
              {book.isbn13 && <div><dt>ISBN-13</dt><dd>{book.isbn13}</dd></div>}
              {!book.isbn13 && book.isbn10 && <div><dt>ISBN-10</dt><dd>{book.isbn10}</dd></div>}
            </dl>
          </section>
        </div>
      </article>
    </main>
  );
}
