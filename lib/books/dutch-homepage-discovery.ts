import type { ReadingPeriod } from '../preferences/reading-periods.ts';
import { calculateEraPreferenceBoost } from '../recommendations/era-preference.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import type { ReviewedBestsellerEntry, ReviewedBestsellerSnapshot, ReviewedClassicEntry } from './dutch-homepage-sources.ts';

export type DutchDiscoverySimilarity = ReadonlyMap<string, number>;

export type DutchDiscoverySelectionInput = {
  excludedWorkIds?: ReadonlySet<string>;
  similarityByWorkId?: DutchDiscoverySimilarity;
  profileConfidence?: TasteProfile['confidence'];
  readingPeriods?: readonly ReadingPeriod[] | null;
  year: number;
  week: number;
};

export function isCurrentBestsellerSnapshot(
  snapshot: ReviewedBestsellerSnapshot,
  now = new Date(),
): boolean {
  const verifiedAt = Date.parse(snapshot.verifiedAt);
  if (!Number.isFinite(verifiedAt)) return false;
  const age = Math.max(0, now.getTime() - verifiedAt);
  return age <= snapshot.maxAgeDays * 24 * 60 * 60 * 1_000;
}

export function selectPopularDutchBooks(
  entries: readonly ReviewedBestsellerEntry[],
  eligibleWorkIds: ReadonlySet<string>,
  input: DutchDiscoverySelectionInput,
  limit = 3,
): ReviewedBestsellerEntry[] {
  const excluded = input.excludedWorkIds ?? new Set<string>();
  const similarity = input.similarityByWorkId ?? new Map<string, number>();
  const safeLimit = Math.max(0, Math.trunc(limit));

  return entries
    .filter(({ workId }) => eligibleWorkIds.has(workId) && !excluded.has(workId))
    .toSorted((left, right) => {
      // One official rank always outweighs the full personal nudge (0.15).
      const leftScore = left.rank - Math.max(0, similarity.get(left.workId) ?? 0) * .15;
      const rightScore = right.rank - Math.max(0, similarity.get(right.workId) ?? 0) * .15;
      return leftScore - rightScore || left.rank - right.rank || Number(left.workId) - Number(right.workId);
    })
    .slice(0, safeLimit);
}

function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function classicScore(
  entry: ReviewedClassicEntry,
  input: DutchDiscoverySelectionInput,
): number {
  const editorial = 1 - Math.min(1, Math.max(0, entry.editorialPriority - 1) / 100);
  const similarity = Math.max(0, input.similarityByWorkId?.get(entry.workId) ?? 0);
  const eraBoost = calculateEraPreferenceBoost({
    readingPeriods: input.readingPeriods,
    firstPublishYear: entry.firstPublishYear,
    userConfidence: input.profileConfidence ?? 'LOW',
  });
  const weeklyTieBreak = deterministicUnit(`${input.year}-${input.week}-${entry.workId}`) * .015;
  return editorial * .7 + similarity * .25 + eraBoost + weeklyTieBreak;
}

export function selectDutchClassics(
  entries: readonly ReviewedClassicEntry[],
  input: DutchDiscoverySelectionInput,
  limit = 3,
): ReviewedClassicEntry[] {
  const excluded = input.excludedWorkIds ?? new Set<string>();
  const safeLimit = Math.max(0, Math.trunc(limit));
  const ranked = entries
    .filter((entry) => entry.reviewStatus === 'approved' && !excluded.has(entry.workId))
    .toSorted((left, right) =>
      classicScore(right, input) - classicScore(left, input) ||
      left.editorialPriority - right.editorialPriority ||
      Number(left.workId) - Number(right.workId),
    );
  const selected: ReviewedClassicEntry[] = [];

  for (const candidate of ranked) {
    if (selected.length >= safeLimit) break;
    if (selected.some(({ author }) => author === candidate.author)) continue;
    if (candidate.seriesKey && selected.some(({ seriesKey }) => seriesKey === candidate.seriesKey)) continue;
    selected.push(candidate);
  }

  if (selected.length < safeLimit) {
    for (const candidate of ranked) {
      if (selected.length >= safeLimit) break;
      if (!selected.some(({ workId }) => workId === candidate.workId)) selected.push(candidate);
    }
  }

  return selected;
}

export function hasSufficientClassicPersonalization(input: {
  profileConfidence?: TasteProfile['confidence'];
  similarityByWorkId?: DutchDiscoverySimilarity;
}): boolean {
  return input.profileConfidence !== undefined &&
    input.profileConfidence !== 'LOW' &&
    [...(input.similarityByWorkId?.values() ?? [])].some((value) => value > 0);
}

