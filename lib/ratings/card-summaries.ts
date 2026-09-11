import type { Book } from '@/app/data/books';
import { formatRatingCount } from './model.ts';

export type PublicRatingSummaryRow = {
  work_id?: number | string | null;
  lumiscore?: number | string | null;
  rating_count?: number | string | null;
};

export type PublicRatingSummary = {
  lumiscore: number | null;
  ratingCount: number;
};

export function formatPublicRatingDisplay(
  lumiscore: number | null,
  ratingCount: number,
): { score: string; count: string } {
  if (lumiscore === null || ratingCount < 1) {
    return { score: '—', count: 'Not rated yet' };
  }

  return {
    score: lumiscore.toFixed(1),
    count: formatRatingCount(ratingCount),
  };
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRatingWorkIds(workIds: readonly string[]): number[] {
  return [...new Set(
    workIds
      .map(Number)
      .filter((workId) => Number.isSafeInteger(workId) && workId > 0),
  )].slice(0, 100);
}

export function ratingSummaryMap(
  rows: readonly PublicRatingSummaryRow[],
): Map<string, PublicRatingSummary> {
  const summaries = new Map<string, PublicRatingSummary>();

  for (const row of rows) {
    const workId = asFiniteNumber(row.work_id);
    if (!workId || !Number.isSafeInteger(workId) || workId < 1) continue;

    const ratingCount = asFiniteNumber(row.rating_count) ?? 0;
    const rawLumiscore = ratingCount > 0 ? asFiniteNumber(row.lumiscore) : null;
    const lumiscore =
      rawLumiscore === null
        ? null
        : Math.round((rawLumiscore + Number.EPSILON) * 10) / 10;
    summaries.set(String(workId), {
      lumiscore,
      ratingCount: Math.max(0, Math.trunc(ratingCount)),
    });
  }

  return summaries;
}

export function applyRatingSummaries(
  books: readonly Book[],
  summaries: ReadonlyMap<string, PublicRatingSummary>,
): Book[] {
  return books.map((book) => {
    if (book.source !== 'supabase' || !book.workId) return book;
    const summary = summaries.get(book.workId);
    return {
      ...book,
      score: summary?.lumiscore ?? null,
      ratingsCount: summary?.ratingCount ?? 0,
    };
  });
}
