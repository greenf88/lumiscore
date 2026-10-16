'use client';
import {useLumiScoreLocale} from './LumiScoreLocale';
import {isPendingWorkScore, type PendingWorkScore} from '@/lib/taste-test/direct-rating';
import {MIN_RATING, MAX_RATING} from '@/lib/ratings/model';

export function DirectRatingScores({workId, pending, selection, onRate}: {
  workId: string; pending: boolean; selection: PendingWorkScore; onRate: (score: number) => void;
}) {
  const {t} = useLumiScoreLocale();
  return <fieldset disabled={pending || !workId}><legend>{t('directTaste.yourRating')}</legend>
    <div className="taste-score-buttons">{Array.from({length: MAX_RATING - MIN_RATING + 1}, (_, index) => index + MIN_RATING).map(score =>
      <button type="button" key={score} aria-label={t('directTaste.rate', {score})}
        aria-pressed={isPendingWorkScore(selection, workId, score, pending)}
        onKeyDown={event => {if (event.repeat) event.preventDefault();}}
        onClick={event => {if (event.detail <= 1) onRate(score);}}>{score}</button>)}</div>
  </fieldset>;
}
