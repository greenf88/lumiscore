import type { Book } from '@/app/data/books';
import type { Locale } from '../i18n/config.ts';
export const RATING_COUNT_BANDS = ['5–9', '10–19', '20–49', '50+'] as const;
export type RatingCountBand = typeof RATING_COUNT_BANDS[number];
export type PublicRatingSummaryRow = {
  work_id?: number | string | null;
  lumiscore?: number | string | null;
  rating_count?: number | string | null;
  rating_count_band?: string | null;
  evidence_status?: string | null;
};
export type PublicRatingSummary = { lumiscore: number | null; ratingCount: null; ratingBand: RatingCountBand | null };
export function formatPublicRatingDisplay(lumiscore: number | null, _ratingCount: number | null, locale: Locale = 'en', ratingBand?: string | null): { score: string; count: string } {
  if (lumiscore === null || !RATING_COUNT_BANDS.includes(ratingBand as RatingCountBand))
    return { score: '—', count: locale === 'nl' ? 'Onvoldoende beoordelingen' : 'Insufficient ratings' };
  return { score: lumiscore.toFixed(1), count: `${ratingBand} ${locale === 'nl' ? 'beoordelaars' : 'raters'}` };
}
export function normalizeRatingWorkIds(workIds: readonly string[]): number[] {
  return [...new Set(workIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 100);
}
export function ratingSummaryMap(rows: readonly PublicRatingSummaryRow[]): Map<string, PublicRatingSummary> {
  const summaries = new Map<string, PublicRatingSummary>();
  for (const row of rows) {
    const workId = Number(row.work_id);
    if (!Number.isSafeInteger(workId) || workId < 1) continue;
    const band = RATING_COUNT_BANDS.includes(row.rating_count_band as RatingCountBand) ? row.rating_count_band as RatingCountBand : null;
    const score = row.lumiscore === null || row.lumiscore === undefined ? null : Number(row.lumiscore);
    const available = row.evidence_status === 'available' && band && score !== null && Number.isFinite(score) && score >= 1 && score <= 10;
    summaries.set(String(workId), { lumiscore: available ? Math.round(score! * 10) / 10 : null, ratingCount: null, ratingBand: available ? band : null });
  }
  return summaries;
}
export function applyRatingSummaries(books: readonly Book[], summaries: ReadonlyMap<string, PublicRatingSummary>): Book[] {
  return books.map(book => {
    if (book.source !== 'supabase' || !book.workId) return book;
    const summary = summaries.get(book.workId);
    return { ...book, score: summary?.lumiscore ?? null, ratingsCount: null, ratingBand: summary?.ratingBand ?? null };
  });
}
