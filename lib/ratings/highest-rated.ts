export const HIGHEST_RATED_MINIMUM_RATINGS = 1;

export type HighestRatedWork = {
  workId: string;
  title: string;
  score: number | null;
  ratingCount: number;
};

export function rankHighestRatedWorks<T extends HighestRatedWork>(
  works: readonly T[],
  limit: number,
  minimumRatings = HIGHEST_RATED_MINIMUM_RATINGS,
): T[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  const safeMinimumRatings = Math.max(1, Math.trunc(minimumRatings));

  return works
    .filter((work) =>
      work.score !== null &&
      Number.isFinite(work.score) &&
      work.ratingCount >= safeMinimumRatings,
    )
    .toSorted((left, right) =>
      right.score! - left.score! ||
      right.ratingCount - left.ratingCount ||
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }) ||
      Number(left.workId) - Number(right.workId) ||
      left.workId.localeCompare(right.workId, 'en'),
    )
    .slice(0, safeLimit);
}
