/** Review progress is keyed by canonical Work ID. Refreshes never replace it. */
export type MetadataReview = {
  workId: string; reviewStatus: string; proposedCorrections: Record<string, unknown>;
  verifiedFacts: Record<string, unknown>; reviewer: string; checkedAt: string; notes: string;
};
export function mergeMetadataReviews<T extends { workId: string; review: MetadataReview }>(
  refreshed: readonly T[], previous: readonly { workId: string; review: MetadataReview }[],
) {
  const old = new Map<string, MetadataReview>();
  for (const row of previous) {
    if (old.has(row.workId)) throw new Error(`Duplicate review Work ID: ${row.workId}`);
    if (row.review.workId !== row.workId) throw new Error('Review identity mismatch');
    old.set(row.workId, structuredClone(row.review));
  }
  const seen = new Set<string>();
  const records = refreshed.map(row => {
    if (seen.has(row.workId)) throw new Error(`Duplicate catalog Work ID: ${row.workId}`);
    seen.add(row.workId);
    return { ...row, review: old.get(row.workId) ?? row.review };
  });
  // Keep reviews of removed Works in a separate archive, never silently discard.
  const orphanedReviews = [...old].filter(([id]) => !seen.has(id)).map(([workId, review]) => ({ workId, review }));
  return { records, orphanedReviews };
}
/** RFC4180 quoting; guard spreadsheet formula injection without changing JSON. */
export function metadataCsvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const safe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
