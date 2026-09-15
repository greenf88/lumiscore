import type { Locale } from '../i18n/config.ts';
import { formatLocalizedCount } from '../i18n/format.ts';

export const MIN_RATING = 1;
export const MAX_RATING = 10;

export type BookRatingState = {
  authenticated: boolean;
  userEmail: string | null;
  userRating: number | null;
  lumiscore: number | null;
  ratingCount: number;
};

export const EMPTY_RATING_STATE: BookRatingState = {
  authenticated: false,
  userEmail: null,
  userRating: null,
  lumiscore: null,
  ratingCount: 0,
};

export function parseRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= MIN_RATING && value <= MAX_RATING ? value : null;
}

export function calculateRatingSummary(ratings: readonly number[]): {
  lumiscore: number | null;
  ratingCount: number;
} {
  const validRatings = ratings.filter((rating) => parseRating(rating) !== null);
  if (validRatings.length === 0) return { lumiscore: null, ratingCount: 0 };

  const average =
    validRatings.reduce((total, rating) => total + rating, 0) /
    validRatings.length;
  return {
    lumiscore: Math.round((average + Number.EPSILON) * 10) / 10,
    ratingCount: validRatings.length,
  };
}

export function formatRatingCount(count: number, locale: Locale = 'en'): string {
  return formatLocalizedCount(locale, count, 'common.rating', 'common.ratings');
}
