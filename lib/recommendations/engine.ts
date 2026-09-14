import type { Book } from '../../app/data/books.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import { cosineTasteSimilarity, type TasteVector } from '../taste-test/traits.ts';
import { buildRecommendationExplanation } from './explanations.ts';
import type { WorkTraitCoverageLevel } from './work-trait-evidence.ts';

export type MatchConfidence = 'high' | 'medium' | 'low';
export type MatchLabel = 'Strong match' | 'Good match' | 'Possible match' | 'Early match';
export type RecommendationCandidate = {
  book: Book;
  traits: TasteVector;
  metadataConfidence: number;
  coverageLevel: WorkTraitCoverageLevel;
  seriesKey?: string;
};
export type PersonalizedRecommendation = {
  book: Book;
  matchScore: number | null;
  matchLabel: MatchLabel | null;
  matchConfidence: MatchConfidence;
  explanation: string;
  coverageLevel: WorkTraitCoverageLevel;
  metadataConfidence: number;
};
export type RankedRecommendation = PersonalizedRecommendation & {
  personalMatch: number;
  rankingScore: number;
};
const QUALITY_NEUTRAL_SCORE = 5.5;
const QUALITY_PRIOR_RATINGS = 5;

export function calculateQualityPrior(average: number | null, ratingCount: number): number {
  if (average === null || ratingCount <= 0) return QUALITY_NEUTRAL_SCORE / 10;
  const smoothed = (average * ratingCount + QUALITY_NEUTRAL_SCORE * QUALITY_PRIOR_RATINGS) / (ratingCount + QUALITY_PRIOR_RATINGS);
  return Math.max(0, Math.min(1, smoothed / 10));
}

function deterministicExploration(workId: string): number {
  let hash = 2166136261;
  for (const character of workId) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967295;
}

export function calculateMatchConfidence(input: {
  candidateCoverage: WorkTraitCoverageLevel;
  metadataConfidence: number;
  userConfidence: TasteProfile['confidence'];
}): MatchConfidence {
  if (
    input.candidateCoverage === 'rich' &&
    input.metadataConfidence >= .8 &&
    input.userConfidence === 'HIGH'
  ) return 'high';
  if (
    (input.candidateCoverage === 'rich' || input.candidateCoverage === 'partial') &&
    input.metadataConfidence >= .6 &&
    input.userConfidence !== 'LOW'
  ) return 'medium';
  return 'low';
}

export function calculateDisplayedMatchScore(input: {
  personalSimilarity: number;
  userConfidence: TasteProfile['confidence'];
}): number {
  const similarity = Math.max(0, Math.min(1, input.personalSimilarity));
  const ceiling = input.userConfidence === 'HIGH' ? 96 : 94;
  return Math.round(Math.min(ceiling, Math.sqrt(similarity) * ceiling));
}

export function getMatchPresentation(input: {
  personalSimilarity: number;
  candidateCoverage: WorkTraitCoverageLevel;
  metadataConfidence: number;
  userConfidence: TasteProfile['confidence'];
}): { matchScore: number | null; matchLabel: MatchLabel | null; matchConfidence: MatchConfidence } {
  const matchConfidence = calculateMatchConfidence(input);
  if (input.candidateCoverage === 'none') {
    return { matchScore: null, matchLabel: null, matchConfidence: 'low' };
  }
  if (input.candidateCoverage === 'era_only') {
    return { matchScore: null, matchLabel: 'Early match', matchConfidence: 'low' };
  }
  if (
    input.candidateCoverage === 'rich' &&
    input.metadataConfidence >= .8 &&
    input.userConfidence !== 'LOW'
  ) {
    return {
      matchScore: calculateDisplayedMatchScore({
        personalSimilarity: input.personalSimilarity,
        userConfidence: input.userConfidence,
      }),
      matchLabel: null,
      matchConfidence,
    };
  }
  const matchLabel: MatchLabel = input.personalSimilarity >= .75
    ? 'Strong match'
    : input.personalSimilarity >= .5
      ? 'Good match'
      : 'Possible match';
  return { matchScore: null, matchLabel, matchConfidence };
}

type ScoredCandidate = RankedRecommendation & {
  author: string;
  seriesKey?: string;
  traits: TasteVector;
};

export function recommendBooks(input: {
  candidates: readonly RecommendationCandidate[];
  profile: TasteProfile;
  ratedWorkIds: ReadonlySet<string>;
  excludedWorkIds?: ReadonlySet<string>;
  limit?: number;
}): RankedRecommendation[] {
  const limit = Math.max(1, Math.trunc(input.limit ?? 10));
  const remaining: ScoredCandidate[] = input.candidates
    .filter(({ book }) => Boolean(book.workId)
      && !input.ratedWorkIds.has(book.workId!)
      && !input.excludedWorkIds?.has(book.workId!))
    .map(({ book, traits, metadataConfidence, coverageLevel, seriesKey }) => {
      const personalSimilarity = Math.max(0, cosineTasteSimilarity(input.profile.vector, traits));
      const qualityPrior = calculateQualityPrior(book.score, book.ratingsCount ?? 0);
      const rankingScore = .8 * personalSimilarity + .15 * qualityPrior + .05 * deterministicExploration(book.workId!);
      const matchPresentation = getMatchPresentation({
        personalSimilarity,
        candidateCoverage: coverageLevel,
        metadataConfidence,
        userConfidence: input.profile.confidence,
      });
      return {
        book,
        traits,
        seriesKey,
        author: book.author,
        personalMatch: personalSimilarity,
        rankingScore,
        ...matchPresentation,
        coverageLevel,
        metadataConfidence,
        explanation: buildRecommendationExplanation({
          profile: input.profile.vector,
          candidate: traits,
          workId: book.workId!,
          coverageLevel,
          metadataConfidence,
        }),
      };
    });
  const selected: ScoredCandidate[] = [];
  while (selected.length < limit && remaining.length > 0) {
    const adjusted = (candidate: ScoredCandidate) => {
      const sameAuthor = selected.filter(({ author }) => author === candidate.author).length;
      const sameSeries = candidate.seriesKey ? selected.filter(({ seriesKey }) => seriesKey === candidate.seriesKey).length : 0;
      const closest = selected.reduce((maximum, existing) => Math.max(maximum, Math.max(0, cosineTasteSimilarity(existing.traits, candidate.traits))), 0);
      return candidate.rankingScore - Math.min(.16, sameAuthor * .08) - Math.min(.12, sameSeries * .1) - closest * .06;
    };
    remaining.sort((left, right) => adjusted(right) - adjusted(left) || Number(left.book.workId) - Number(right.book.workId));
    selected.push(remaining.shift()!);
  }
  let previousDisplayedMatch = 100;
  return selected.map((candidate) => {
    const matchScore = candidate.matchScore === null
      ? null
      : Math.min(previousDisplayedMatch, candidate.matchScore);
    if (matchScore !== null) previousDisplayedMatch = matchScore;

    return {
      book: candidate.book,
      matchScore,
      matchLabel: candidate.matchLabel,
      matchConfidence: candidate.matchConfidence,
      explanation: candidate.explanation,
      coverageLevel: candidate.coverageLevel,
      metadataConfidence: candidate.metadataConfidence,
      personalMatch: candidate.personalMatch,
      rankingScore: candidate.rankingScore,
    };
  });
}
