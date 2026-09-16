import { recommendBooks, type RecommendationCandidate } from './engine.ts';
import {
  TASTE_TEST_WORK_IDS,
  type TasteTestAnswers,
} from '../taste-test/config.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import type { Locale } from '../i18n/config.ts';
import { resolveLocaleBookLanguagePreference } from './language-preference.ts';

export function recommendGuestBooks(input: {
  answers: TasteTestAnswers;
  candidates: readonly RecommendationCandidate[];
  locale: Locale;
  limit?: number;
}) {
  const profile = buildTasteProfile(input.answers, [], input.locale);
  return {
    profile,
    recommendations: profile.selectedCount > 0
      ? recommendBooks({
          candidates: input.candidates,
          profile,
          ratedWorkIds: new Set(),
          excludedWorkIds: new Set(TASTE_TEST_WORK_IDS),
          locale: input.locale,
          languagePreference: resolveLocaleBookLanguagePreference(input.locale, profile),
          limit: input.limit ?? 10,
        })
      : [],
  };
}
