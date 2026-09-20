import type { Book } from '../../app/data/books.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import { cosineTasteSimilarity, type TasteVector } from '../taste-test/traits.ts';
import { buildRecommendationExplanation } from './explanations.ts';
import type { WorkTraitCoverageLevel } from './work-trait-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import {
  canDutchBookOvertake,
  DUTCH_PREFERENCE_MAX_RANKING_GAP,
  type BookLanguagePreference,
} from './language-preference.ts';
import {
  applyCollaborativeBoost,
  type CollaborativeSignal,
} from './collaborative.ts';
import { translate } from '../i18n/translations.ts';
import type { ReadingPeriod } from '../preferences/reading-periods.ts';
import {
  calculateEraPreferenceBoost,
  getEraPreferenceExplanation,
} from './era-preference.ts';

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
  collaborativeExplanation: string;
};
export type RankedRecommendation = PersonalizedRecommendation & {
  personalMatch: number;
  rankingScore: number;
  collaborativeScore: number | null;
  collaborativeWeight: number;
  finalRankingScore: number;
  eraPreferenceBoost: number;
};
export type PersonalMatchResult = Pick<
  PersonalizedRecommendation,
  | 'matchScore'
  | 'matchLabel'
  | 'matchConfidence'
  | 'explanation'
  | 'coverageLevel'
  | 'metadataConfidence'
> & {
  personalSimilarity: number;
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
  if (
    input.candidateCoverage === 'none' ||
    input.candidateCoverage === 'era_only'
  ) {
    return { matchScore: null, matchLabel: null, matchConfidence: 'low' };
  }
  if (input.personalSimilarity <= 0) {
    return { matchScore: null, matchLabel: null, matchConfidence };
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

export function calculatePersonalMatch(input: {
  profile: TasteProfile;
  candidate: Pick<
    RecommendationCandidate,
    'traits' | 'metadataConfidence' | 'coverageLevel'
  >;
  workId: string;
  locale?: Locale;
}): PersonalMatchResult {
  const personalSimilarity = Math.max(
    0,
    cosineTasteSimilarity(input.profile.vector, input.candidate.traits),
  );
  const presentation = getMatchPresentation({
    personalSimilarity,
    candidateCoverage: input.candidate.coverageLevel,
    metadataConfidence: input.candidate.metadataConfidence,
    userConfidence: input.profile.confidence,
  });

  return {
    ...presentation,
    personalSimilarity,
    coverageLevel: input.candidate.coverageLevel,
    metadataConfidence: input.candidate.metadataConfidence,
    explanation: buildRecommendationExplanation({
      profile: input.profile.vector,
      candidate: input.candidate.traits,
      workId: input.workId,
      coverageLevel: input.candidate.coverageLevel,
      metadataConfidence: input.candidate.metadataConfidence,
      locale: input.locale,
    }),
  };
}

type ScoredCandidate = RankedRecommendation & {
  author: string;
  seriesKey?: string;
  traits: TasteVector;
  rankingPersonalSimilarity: number;
  collaborativeSignal: CollaborativeSignal | null;
};

export function recommendBooks(input: {
  candidates: readonly RecommendationCandidate[];
  profile: TasteProfile;
  ratedWorkIds: ReadonlySet<string>;
  excludedWorkIds?: ReadonlySet<string>;
  limit?: number;
  locale?: Locale;
  languagePreference?: BookLanguagePreference | null;
  collaborativeSignals?: ReadonlyMap<string, CollaborativeSignal>;
  readingPeriods?: readonly ReadingPeriod[] | null;
}): RankedRecommendation[] {
  const limit = Math.max(1, Math.trunc(input.limit ?? 10));
  const remaining: ScoredCandidate[] = input.candidates
    .filter(({ book }) => Boolean(book.workId)
      && !input.ratedWorkIds.has(book.workId!)
      && !input.excludedWorkIds?.has(book.workId!))
    .filter(({ coverageLevel }) => coverageLevel !== 'none')
    .map(({ book, traits, metadataConfidence, coverageLevel, seriesKey }) => {
      const personalMatch = calculatePersonalMatch({
        profile: input.profile,
        candidate: { traits, metadataConfidence, coverageLevel },
        workId: book.workId!,
        locale: input.locale,
      });
      const personalSimilarity = personalMatch.personalSimilarity;
      const rankingPersonalSimilarity = coverageLevel === 'era_only'
        ? 0
        : personalSimilarity;
      const qualityPrior = calculateQualityPrior(book.score, book.ratingsCount ?? 0);
      const eraPreferenceBoost = calculateEraPreferenceBoost({
        readingPeriods: input.readingPeriods,
        firstPublishYear: book.firstPublishYear,
        userConfidence: input.profile.confidence,
      });
      const rankingScore = .8 * rankingPersonalSimilarity + .15 * qualityPrior + .05 * deterministicExploration(book.workId!) + eraPreferenceBoost;
      const collaborativeSignal = input.collaborativeSignals?.get(book.workId!) ?? null;
      const finalRankingScore = applyCollaborativeBoost(rankingScore, collaborativeSignal);
      return {
        book,
        traits,
        seriesKey,
        author: book.author,
        personalMatch: personalSimilarity,
        rankingPersonalSimilarity,
        rankingScore,
        collaborativeSignal,
        collaborativeScore: collaborativeSignal?.score ?? null,
        collaborativeWeight: collaborativeSignal?.weight ?? 0,
        finalRankingScore,
        eraPreferenceBoost,
        matchScore: personalMatch.matchScore,
        matchLabel: personalMatch.matchLabel,
        matchConfidence: personalMatch.matchConfidence,
        coverageLevel,
        metadataConfidence,
        explanation: personalMatch.explanation || getEraPreferenceExplanation(input.locale ?? 'en', eraPreferenceBoost),
        collaborativeExplanation: collaborativeSignal
          ? translate(input.locale ?? 'en', 'recommendation.collaborative')
          : '',
      };
    });
  const selected: ScoredCandidate[] = [];
  while (selected.length < limit && remaining.length > 0) {
    const adjusted = (candidate: ScoredCandidate) => {
      const sameAuthor = selected.filter(({ author }) => author === candidate.author).length;
      const sameSeries = candidate.seriesKey ? selected.filter(({ seriesKey }) => seriesKey === candidate.seriesKey).length : 0;
      const closest = selected.reduce((maximum, existing) => Math.max(maximum, Math.max(0, cosineTasteSimilarity(existing.traits, candidate.traits))), 0);
      const diversifiedBase = candidate.rankingScore - Math.min(.16, sameAuthor * .08) - Math.min(.12, sameSeries * .1) - closest * .06;
      return applyCollaborativeBoost(diversifiedBase, candidate.collaborativeSignal);
    };
    remaining.sort((left, right) => adjusted(right) - adjusted(left) || Number(left.book.workId) - Number(right.book.workId));
    if (input.languagePreference) {
      for (let index = 1; index < remaining.length; index += 1) {
        let currentIndex = index;
        while (currentIndex > 0) {
          const dutchCandidate = remaining[currentIndex];
          const otherCandidate = remaining[currentIndex - 1];
          const dutchAdjustedScore = adjusted(dutchCandidate);
          const otherAdjustedScore = adjusted(otherCandidate);
          const strength = Math.max(0, Math.min(1, input.languagePreference.strength));
          if (
            otherAdjustedScore - dutchAdjustedScore >
              DUTCH_PREFERENCE_MAX_RANKING_GAP * strength ||
            !canDutchBookOvertake({
              dutchBook: dutchCandidate.book,
              otherBook: otherCandidate.book,
              dutchPersonalSimilarity: dutchCandidate.rankingPersonalSimilarity,
              otherPersonalSimilarity: otherCandidate.rankingPersonalSimilarity,
              dutchRankingScore: dutchCandidate.finalRankingScore,
              otherRankingScore: otherCandidate.finalRankingScore,
              preference: input.languagePreference,
            })
          ) break;
          remaining[currentIndex - 1] = dutchCandidate;
          remaining[currentIndex] = otherCandidate;
          currentIndex -= 1;
        }
      }
    }
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
      collaborativeExplanation: candidate.collaborativeExplanation,
      personalMatch: candidate.personalMatch,
      rankingScore: candidate.rankingScore,
      collaborativeScore: candidate.collaborativeScore,
      collaborativeWeight: candidate.collaborativeWeight,
      finalRankingScore: candidate.finalRankingScore,
      eraPreferenceBoost: candidate.eraPreferenceBoost,
    };
  });
}
