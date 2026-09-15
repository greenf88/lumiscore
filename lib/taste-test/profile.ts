import { TASTE_TEST_ANCHORS, TASTE_TEST_QUESTIONS, type TasteTestAnswers } from './config.ts';
import type { Locale } from '../i18n/config.ts';
import { formatLocalizedList } from '../i18n/format.ts';
import { translate } from '../i18n/translations.ts';
import { TASTE_TRAITS, emptyTasteVector, getTraitLabel, normalizeTasteVector, tasteVector, type TasteTrait, type TasteVector } from './traits.ts';

export type RatingEvidence = { rating: number; traits: TasteVector; workId: string };
export type TasteEvidenceBlend = { tasteTest: number; ratings: number };
export type TasteProfile = {
  vector: TasteVector; tasteTestVector: TasteVector; ratingsVector: TasteVector;
  blend: TasteEvidenceBlend; answeredCount: number; selectedCount: number;
  ratingCount: number; meaningfulRatingCount: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; summary: string;
};

export type TasteProfileConfidenceCopy = {
  label: string;
  description: string;
};

export function getTasteProfileConfidenceCopy(
  confidence: TasteProfile['confidence'],
  locale: Locale = 'en',
): TasteProfileConfidenceCopy {
  const level = confidence.toLowerCase() as 'low' | 'medium' | 'high';
  return {
    label: translate(locale, `taste.confidence.${level}.label`),
    description: translate(locale, `taste.confidence.${level}.description`),
  };
}

export function getTasteEvidenceBlend(ratingCount: number): TasteEvidenceBlend {
  if (ratingCount === 0) return { tasteTest: 1, ratings: 0 };
  if (ratingCount <= 4) return { tasteTest: .7, ratings: .3 };
  if (ratingCount <= 9) return { tasteTest: .5, ratings: .5 };
  if (ratingCount <= 24) return { tasteTest: .25, ratings: .75 };
  return { tasteTest: .1, ratings: .9 };
}

export function ratingPreferenceWeight(rating: number): number {
  return Math.max(-1, Math.min(1, (rating - 5.5) / 4.5));
}

function calculateTasteTestVector(answers: TasteTestAnswers) {
  const vector = emptyTasteVector();
  let answeredCount = 0;
  let selectedCount = 0;
  for (const question of TASTE_TEST_QUESTIONS) {
    const choice = answers[question.key];
    if (!choice) continue;
    answeredCount += 1;
    if (choice === 'neither') continue;
    selectedCount += 1;
    const chosen = TASTE_TEST_ANCHORS[choice === 'left' ? question.leftWorkId : question.rightWorkId];
    for (const trait of TASTE_TRAITS) vector[trait] += chosen.traits[trait];
  }
  return { vector: normalizeTasteVector(vector), answeredCount, selectedCount };
}

function calculateRatingsVector(ratings: readonly RatingEvidence[]) {
  const vector = emptyTasteVector();
  let meaningfulRatingCount = 0;
  for (const evidence of ratings) {
    const weight = ratingPreferenceWeight(evidence.rating);
    if (Math.abs(weight) >= .1) meaningfulRatingCount += 1;
    for (const trait of TASTE_TRAITS) vector[trait] += evidence.traits[trait] * weight;
  }
  return { vector: normalizeTasteVector(vector), meaningfulRatingCount };
}

function hasEvidence(vector: TasteVector) { return TASTE_TRAITS.some((trait) => vector[trait] !== 0); }

function summarizeTaste(vector: TasteVector, locale: Locale): string {
  const labels = TASTE_TRAITS.filter((trait) => vector[trait] > 0)
    .sort((left, right) => vector[right] - vector[left]).slice(0, 3).map((trait) => getTraitLabel(locale, trait));
  if (labels.length === 0) return translate(locale, 'taste.emptySummary');
  return translate(locale, 'taste.summary', {
    traits: formatLocalizedList(locale, labels),
  });
}

export function calculateUserEvidenceConfidence(
  answeredCount: number,
  selectedCount: number,
  meaningfulRatingCount: number,
): TasteProfile['confidence'] {
  if (
    meaningfulRatingCount >= 10 ||
    (answeredCount === 10 && selectedCount >= 5 && meaningfulRatingCount >= 5)
  ) return 'HIGH';
  if (
    selectedCount >= 5 ||
    (answeredCount >= 7 && selectedCount >= 3) ||
    meaningfulRatingCount >= 3
  ) return 'MEDIUM';
  return 'LOW';
}

export function buildTasteProfile(
  answers: TasteTestAnswers,
  ratings: readonly RatingEvidence[],
  locale: Locale = 'en',
): TasteProfile {
  const tasteTest = calculateTasteTestVector(answers);
  const ratingEvidence = calculateRatingsVector(ratings);
  const configuredBlend = getTasteEvidenceBlend(ratings.length);
  const tasteAvailable = hasEvidence(tasteTest.vector);
  const ratingsAvailable = hasEvidence(ratingEvidence.vector);
  const blend = !tasteAvailable && ratingsAvailable ? { tasteTest: 0, ratings: 1 }
    : tasteAvailable && !ratingsAvailable ? { tasteTest: 1, ratings: 0 } : configuredBlend;
  const vector = normalizeTasteVector(tasteVector(Object.fromEntries(TASTE_TRAITS.map((trait) => [
    trait, tasteTest.vector[trait] * blend.tasteTest + ratingEvidence.vector[trait] * blend.ratings,
  ]))));
  return {
    vector, tasteTestVector: tasteTest.vector, ratingsVector: ratingEvidence.vector, blend,
    answeredCount: tasteTest.answeredCount, selectedCount: tasteTest.selectedCount,
    ratingCount: ratings.length, meaningfulRatingCount: ratingEvidence.meaningfulRatingCount,
    confidence: calculateUserEvidenceConfidence(tasteTest.answeredCount, tasteTest.selectedCount, ratingEvidence.meaningfulRatingCount),
    summary: summarizeTaste(vector, locale),
  };
}

export function strongestPositiveTraits(profile: TasteVector, candidate: TasteVector, limit = 2): TasteTrait[] {
  return TASTE_TRAITS.filter((trait) => profile[trait] > 0 && candidate[trait] > 0)
    .sort((left, right) => profile[right] * candidate[right] - profile[left] * candidate[left]).slice(0, limit);
}
