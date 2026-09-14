import type { TasteProfile } from '../taste-test/profile.ts';
import type { TasteVector } from '../taste-test/traits.ts';
import type { RankedRecommendation } from './engine.ts';
import { getTopTraitOverlaps, type TraitOverlap } from './explanations.ts';

export type RecommendationAuditReport = {
  bookTitle: string;
  workId: string | null;
  rawPersonalSimilarity: number;
  rankingScore: number;
  userConfidence: TasteProfile['confidence'];
  coverageLevel: RankedRecommendation['coverageLevel'];
  metadataConfidence: number;
  userFacingMatchDisplay: string | null;
  topOverlappingTraits: TraitOverlap[];
  finalExplanation: string | null;
};

export function auditRecommendation(input: {
  recommendation: RankedRecommendation;
  profile: TasteProfile;
  candidateTraits: TasteVector;
}): RecommendationAuditReport {
  const { recommendation } = input;
  return {
    bookTitle: recommendation.book.title,
    workId: recommendation.book.workId ?? null,
    rawPersonalSimilarity: recommendation.personalMatch,
    rankingScore: recommendation.rankingScore,
    userConfidence: input.profile.confidence,
    coverageLevel: recommendation.coverageLevel,
    metadataConfidence: recommendation.metadataConfidence,
    userFacingMatchDisplay: recommendation.matchScore !== null
      ? `Your Match ${recommendation.matchScore}%`
      : recommendation.matchLabel,
    topOverlappingTraits: getTopTraitOverlaps(
      input.profile.vector,
      input.candidateTraits,
    ),
    finalExplanation: recommendation.explanation || null,
  };
}
