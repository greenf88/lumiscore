export const COLLABORATIVE_POSITIVE_RATING = 8;
export const COLLABORATIVE_MIN_TARGET_LIKES = 2;
export const COLLABORATIVE_MIN_SHARED_LIKES = 2;
export const COLLABORATIVE_MAX_WEIGHT = .15;

export type CollaborativeSignal = {
  score: number;
  weight: number;
};

export type CollaborativeRating = {
  userId: string;
  workId: string;
  rating: number;
};

type CandidateEvidence = {
  weightedPreference: number;
  similarityWeight: number;
  supporterCount: number;
  maximumSharedLikes: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getSimilarReaderStrength(sharedLikeCount: number): number {
  return clamp(Math.trunc(sharedLikeCount) / 4, 0, 1);
}

export function getCandidatePreference(rating: number): number {
  if (rating < COLLABORATIVE_POSITIVE_RATING) return 0;
  return clamp(.6 + (rating - COLLABORATIVE_POSITIVE_RATING) * .2, 0, 1);
}

export function getCollaborativeWeight(
  supporterCount: number,
  maximumSharedLikes: number,
): number {
  if (supporterCount < 1 || maximumSharedLikes < COLLABORATIVE_MIN_SHARED_LIKES) return 0;
  return Math.min(
    COLLABORATIVE_MAX_WEIGHT,
    .03 + Math.max(0, supporterCount - 1) * .025 +
      Math.max(0, maximumSharedLikes - COLLABORATIVE_MIN_SHARED_LIKES) * .015,
  );
}

export function applyCollaborativeBoost(
  baseRankingScore: number,
  signal: CollaborativeSignal | null | undefined,
): number {
  const base = clamp(baseRankingScore, 0, 1);
  if (!signal || signal.weight <= 0 || signal.score <= .5) return baseRankingScore;
  const confidenceAboveNeutral = clamp((signal.score - .5) * 2, 0, 1);
  const weight = clamp(signal.weight, 0, COLLABORATIVE_MAX_WEIGHT);
  return base + (1 - base) * weight * confidenceAboveNeutral;
}

/**
 * Pure reference implementation used by tests and privacy-safe developer audits.
 * Its result contains only anonymous, per-work aggregate signals.
 */
export function buildCollaborativeSignals(
  ratings: readonly CollaborativeRating[],
  targetUserId: string,
): ReadonlyMap<string, CollaborativeSignal> {
  const targetRatings = new Map(
    ratings
      .filter(({ userId }) => userId === targetUserId)
      .map(({ workId, rating }) => [workId, rating] as const),
  );
  const targetLikes = new Set(
    [...targetRatings].flatMap(([workId, rating]) =>
      rating >= COLLABORATIVE_POSITIVE_RATING ? [workId] : []),
  );
  if (targetLikes.size < COLLABORATIVE_MIN_TARGET_LIKES) return new Map();

  const positiveRatingsByOtherUser = new Map<string, CollaborativeRating[]>();
  for (const rating of ratings) {
    if (
      rating.userId === targetUserId ||
      rating.rating < COLLABORATIVE_POSITIVE_RATING
    ) continue;
    const current = positiveRatingsByOtherUser.get(rating.userId) ?? [];
    current.push(rating);
    positiveRatingsByOtherUser.set(rating.userId, current);
  }

  const evidenceByWorkId = new Map<string, CandidateEvidence>();
  for (const otherRatings of positiveRatingsByOtherUser.values()) {
    const sharedLikeCount = otherRatings.filter(({ workId }) => targetLikes.has(workId)).length;
    if (sharedLikeCount < COLLABORATIVE_MIN_SHARED_LIKES) continue;
    const readerStrength = getSimilarReaderStrength(sharedLikeCount);

    for (const candidate of otherRatings) {
      if (targetRatings.has(candidate.workId)) continue;
      const evidence = evidenceByWorkId.get(candidate.workId) ?? {
        weightedPreference: 0,
        similarityWeight: 0,
        supporterCount: 0,
        maximumSharedLikes: 0,
      };
      evidence.weightedPreference += readerStrength * getCandidatePreference(candidate.rating);
      evidence.similarityWeight += readerStrength;
      evidence.supporterCount += 1;
      evidence.maximumSharedLikes = Math.max(evidence.maximumSharedLikes, sharedLikeCount);
      evidenceByWorkId.set(candidate.workId, evidence);
    }
  }

  return new Map([...evidenceByWorkId].map(([workId, evidence]) => {
    // A neutral 0.55 prior with two equivalent observations keeps tiny samples modest.
    const score = clamp(
      (evidence.weightedPreference + 1.1) / (evidence.similarityWeight + 2),
      0,
      1,
    );
    return [workId, {
      score,
      weight: getCollaborativeWeight(
        evidence.supporterCount,
        evidence.maximumSharedLikes,
      ),
    }] as const;
  }));
}
