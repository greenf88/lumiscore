import {
  TASTE_TRAITS,
  getTraitLabel,
  type TasteTrait,
  type TasteVector,
} from '../taste-test/traits.ts';
import type { Locale } from '../i18n/config.ts';
import { formatLocalizedList } from '../i18n/format.ts';
import type { WorkTraitCoverageLevel } from './work-trait-evidence.ts';

export type TraitOverlap = {
  trait: TasteTrait;
  label: string;
  contribution: number;
};

const MIN_EXPLANATION_CONTRIBUTION = 0.02;
const EXPLANATION_TEMPLATES: Record<Locale, ReadonlyArray<(traits: string) => string>> = {
  en: [
    (traits) => `Because you like ${traits}.`,
    (traits) => `Matches your preference for ${traits}.`,
    (traits) => `Chosen for your interest in ${traits}.`,
    (traits) => `Connects with your taste in ${traits}.`,
  ],
  nl: [
    (traits) => `Omdat je houdt van ${traits}.`,
    (traits) => `Past bij jouw voorkeur voor ${traits}.`,
    (traits) => `Gekozen vanwege jouw interesse in ${traits}.`,
    (traits) => `Sluit aan bij jouw smaak voor ${traits}.`,
  ],
};

export function getTopTraitOverlaps(
  profile: TasteVector,
  candidate: TasteVector,
  limit = 3,
  locale: Locale = 'en',
): TraitOverlap[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return TASTE_TRAITS.flatMap((trait) => {
    const contribution = profile[trait] * candidate[trait];
    return contribution > 0
      ? [{ trait, label: getTraitLabel(locale, trait), contribution }]
      : [];
  })
    .sort((left, right) =>
      right.contribution - left.contribution ||
      TASTE_TRAITS.indexOf(left.trait) - TASTE_TRAITS.indexOf(right.trait),
    )
    .slice(0, safeLimit);
}

function deterministicTemplateIndex(workId: string): number {
  let hash = 0;
  for (const character of workId) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % EXPLANATION_TEMPLATES.en.length;
}

export function buildRecommendationExplanation(input: {
  profile: TasteVector;
  candidate: TasteVector;
  workId: string;
  coverageLevel: WorkTraitCoverageLevel;
  metadataConfidence: number;
  locale?: Locale;
}): string {
  if (
    (input.coverageLevel !== 'rich' && input.coverageLevel !== 'partial') ||
    input.metadataConfidence < 0.6
  ) return '';

  const locale = input.locale ?? 'en';
  const overlaps = getTopTraitOverlaps(input.profile, input.candidate, 3, locale).filter(
    ({ contribution }) => contribution >= MIN_EXPLANATION_CONTRIBUTION,
  );
  if (overlaps.length === 0) return '';

  const traits = formatLocalizedList(locale, overlaps.map(({ label }) => label));
  return EXPLANATION_TEMPLATES[locale][deterministicTemplateIndex(input.workId)](traits);
}
