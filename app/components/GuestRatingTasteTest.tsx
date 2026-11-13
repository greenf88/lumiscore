'use client';

import { useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import { GUEST_ROUND_GOAL, guestRoundResult, guestRoundState, type GuestDecision, type GuestOffer } from '@/lib/taste-test/guest-round';
import { getTasteProfileConfidenceCopy } from '@/lib/taste-test/profile';
import { DirectRatingScores } from './DirectRatingScores';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { EditionPresentationLabel } from './EditionPresentationLabel';
import { BookCover } from './LumiScoreHome';
import { LocaleLink, useLumiScoreLocale } from './LumiScoreLocale';

export function GuestRatingTasteTest({ offers, authState }: { offers: GuestOffer[] | null; authState: HeaderAuthState }) {
  const { locale, t } = useLumiScoreLocale();
  const [decisions, setDecisions] = useState<GuestDecision[]>([]);
  const [started, setStarted] = useState(false);
  const { ratings, remaining, next } = guestRoundState(offers ?? [], decisions);
  const complete = ratings.length === GUEST_ROUND_GOAL;
  const insufficient = remaining.length + ratings.length < GUEST_ROUND_GOAL;

  function decide(workId: string, rating: number | null) {
    setDecisions(previous => previous.some(item => item.workId === workId) ? previous : [...previous, { workId, rating }]);
  }

  const book = next?.book;
  const result = complete && offers ? guestRoundResult(offers, decisions, locale) : null;
  const confidence = result ? getTasteProfileConfidenceCopy(result.confidence, locale) : null;

  return <DiscoveryPageShell authState={authState} path="/taste-test/preferences">
    <section className="featured-section taste-rating-test taste-direct-test" aria-labelledby="guest-taste-title">
      <h1 id="guest-taste-title">{t(result ? 'taste.readingTaste' : 'directTaste.label')}</h1>
      {offers === null ? <div role="alert">
        <p>{t('directTaste.unavailable')}</p>
        <button type="button" onClick={() => window.location.reload()}>{t('guestTaste.retry')}</button>
      </div> : result && confidence ? <div className="taste-results">
        <p className="taste-result-summary">{result.summary}</p>
        <div className="taste-confidence"><strong>{confidence.label}</strong><span>{confidence.description}</span></div>
        <p>{t('guestTaste.localOnly')}</p>
        <LocaleLink href="/browse">{t('taste.backToBooks')}</LocaleLink>
      </div> : insufficient ? <div role="status">
        <p>{t('guestTaste.insufficient')}</p>
        <LocaleLink href="/browse">{t('taste.backToBooks')}</LocaleLink>
      </div> : !started ? <div className="taste-start-screen">
        <p>{t('guestTaste.intro')}</p>
        <button className="primary-cta" type="button" onClick={() => setStarted(true)}>
          {t('directTaste.startChoice', { count: GUEST_ROUND_GOAL })}
        </button>
      </div> : book && <>
        <p className="taste-direct-progress" role="status" aria-live="polite">
          {t('directTaste.progress', { rated: ratings.length, goal: GUEST_ROUND_GOAL })}
        </p>
        <article className="book-card taste-rating-card" key={book.workId}>
          <div className="taste-book-identity">
            <BookCover book={book} presentation="taste" resolveMissing={false} />
            <div className="book-card-body"><h2>{book.title}</h2><p>{book.author}</p><EditionPresentationLabel book={book} /></div>
          </div>
          <div className="taste-rating-actions">
            <DirectRatingScores workId={book.workId} pending={false} selection={null} onRate={rating => decide(book.workId, rating)} />
            <button className="taste-skip-button" type="button" onClick={event => {
              if (event.detail <= 1) decide(book.workId, null);
            }}>{t('directTaste.skip')}</button>
          </div>
        </article>
      </>}
    </section>
  </DiscoveryPageShell>;
}
