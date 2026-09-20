import type { TasteProfile } from '../taste-test/profile.ts';
import {
  hasDirectReadingEraPreference,
  readingPeriodContainsYear,
  type ReadingPeriod,
} from '../preferences/reading-periods.ts';

export const ERA_PREFERENCE_MAX_BOOST = 0.035;

export function calculateEraPreferenceBoost(input: {
  readingPeriods?: readonly ReadingPeriod[] | null;
  firstPublishYear?: number | null;
  userConfidence: TasteProfile['confidence'];
}): number {
  if (
    !input.firstPublishYear ||
    !input.readingPeriods ||
    !hasDirectReadingEraPreference(input.readingPeriods) ||
    !input.readingPeriods.some((period) => readingPeriodContainsYear(period, input.firstPublishYear!))
  ) return 0;

  if (input.userConfidence === 'HIGH') return 0;
  return input.userConfidence === 'MEDIUM' ? 0.015 : ERA_PREFERENCE_MAX_BOOST;
}

export function getEraPreferenceExplanation(
  locale: 'en' | 'nl',
  boost: number,
): string {
  if (boost <= 0) return '';
  return locale === 'nl'
    ? 'Past bij de periodes die je graag leest.'
    : 'Matches the periods you enjoy reading.';
}
