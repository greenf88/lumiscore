import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import { isDutchLanguageBook } from '../books/language.ts';

export type BookLanguagePreference = {
  language: 'dutch';
  source: 'locale' | 'explicit';
  strength: number;
};

export const DUTCH_PREFERENCE_MAX_PERSONAL_GAP = .05;
export const DUTCH_PREFERENCE_MAX_RANKING_GAP = .04;

export function getLocaleLanguagePreferenceStrength(
  meaningfulRatingCount: number,
): number {
  const count = Math.max(0, Math.trunc(meaningfulRatingCount));
  if (count <= 2) return 1;
  if (count <= 5) return .65;
  if (count <= 9) return .35;
  return .1;
}

export function resolveLocaleBookLanguagePreference(
  locale: Locale,
  profile: Pick<TasteProfile, 'meaningfulRatingCount'>,
): BookLanguagePreference | null {
  if (locale !== 'nl') return null;
  return {
    language: 'dutch',
    source: 'locale',
    strength: getLocaleLanguagePreferenceStrength(profile.meaningfulRatingCount),
  };
}

export function canDutchBookOvertake(input: {
  dutchBook: Pick<Book, 'editionLanguage' | 'isbn13'>;
  otherBook: Pick<Book, 'editionLanguage' | 'isbn13'>;
  dutchPersonalSimilarity: number;
  otherPersonalSimilarity: number;
  dutchRankingScore: number;
  otherRankingScore: number;
  preference: BookLanguagePreference | null | undefined;
}): boolean {
  const strength = Math.max(0, Math.min(1, input.preference?.strength ?? 0));
  if (
    strength === 0 ||
    input.preference?.language !== 'dutch' ||
    input.dutchPersonalSimilarity <= 0 ||
    !isDutchLanguageBook(input.dutchBook) ||
    isDutchLanguageBook(input.otherBook)
  ) return false;

  return input.otherPersonalSimilarity - input.dutchPersonalSimilarity <=
      DUTCH_PREFERENCE_MAX_PERSONAL_GAP * strength &&
    input.otherRankingScore - input.dutchRankingScore <=
      DUTCH_PREFERENCE_MAX_RANKING_GAP * strength;
}
