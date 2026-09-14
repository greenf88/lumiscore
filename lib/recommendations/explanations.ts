import {
  TASTE_TRAITS,
  type TasteTrait,
  type TasteVector,
} from '../taste-test/traits.ts';
import type { WorkTraitCoverageLevel } from './work-trait-evidence.ts';

export type TraitOverlap = {
  trait: TasteTrait;
  label: string;
  contribution: number;
};

const MIN_EXPLANATION_CONTRIBUTION = 0.02;
const EXPLANATION_TRAIT_LABELS: Record<TasteTrait, string> = {
  fantasy: 'fantasy',
  science_fiction: 'science fiction',
  speculative: 'speculative ideas',
  literary: 'literary writing',
  romance: 'relationship-driven stories',
  thriller_mystery: 'suspenseful stories',
  nonfiction: 'nonfiction',
  classic: 'classic literature',
  contemporary: 'contemporary stories',
  dark: 'darker stories',
  uplifting: 'hopeful stories',
  fast_paced: 'fast-paced plots',
  slow_burn: 'slow-burn storytelling',
  worldbuilding: 'immersive worlds',
  character_driven: 'character-focused stories',
  idea_driven: 'thought-provoking ideas',
  accessible: 'accessible storytelling',
  complex: 'complex narratives',
};
const EXPLANATION_TEMPLATES = [
  (traits: string) => `Because you like ${traits}.`,
  (traits: string) => `Matches your preference for ${traits}.`,
  (traits: string) => `Chosen for your interest in ${traits}.`,
  (traits: string) => `Connects with your taste in ${traits}.`,
] as const;

export function getTopTraitOverlaps(
  profile: TasteVector,
  candidate: TasteVector,
  limit = 3,
): TraitOverlap[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return TASTE_TRAITS.flatMap((trait) => {
    const contribution = profile[trait] * candidate[trait];
    return contribution > 0
      ? [{ trait, label: EXPLANATION_TRAIT_LABELS[trait], contribution }]
      : [];
  })
    .sort((left, right) =>
      right.contribution - left.contribution ||
      TASTE_TRAITS.indexOf(left.trait) - TASTE_TRAITS.indexOf(right.trait),
    )
    .slice(0, safeLimit);
}

function formatTraitList(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function deterministicTemplateIndex(workId: string): number {
  let hash = 0;
  for (const character of workId) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % EXPLANATION_TEMPLATES.length;
}

export function buildRecommendationExplanation(input: {
  profile: TasteVector;
  candidate: TasteVector;
  workId: string;
  coverageLevel: WorkTraitCoverageLevel;
  metadataConfidence: number;
}): string {
  if (
    (input.coverageLevel !== 'rich' && input.coverageLevel !== 'partial') ||
    input.metadataConfidence < 0.6
  ) return '';

  const overlaps = getTopTraitOverlaps(input.profile, input.candidate).filter(
    ({ contribution }) => contribution >= MIN_EXPLANATION_CONTRIBUTION,
  );
  if (overlaps.length === 0) return '';

  const traits = formatTraitList(overlaps.map(({ label }) => label));
  return EXPLANATION_TEMPLATES[deterministicTemplateIndex(input.workId)](traits);
}
