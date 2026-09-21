import type { CollectionBook, ReadingStatus } from './model.ts';

export const COLLECTION_BULK_FILTERS = [
  'all', 'unknown', 'read', 'reading', 'want_to_read', 'dnf', 'rated',
] as const;
export type CollectionBulkFilter = (typeof COLLECTION_BULK_FILTERS)[number];

export function filterCollectionWorkIds(
  books: readonly CollectionBook[],
  statuses: Readonly<Record<string, ReadingStatus>>,
  ratedWorkIds: ReadonlySet<string>,
  filter: CollectionBulkFilter,
): string[] {
  return books.flatMap(({ workId }) => {
    const status = statuses[workId] ?? null;
    const matches = filter === 'all' ||
      (filter === 'unknown' && status === null) ||
      (filter === 'rated' && ratedWorkIds.has(workId)) ||
      status === filter;
    return matches ? [workId] : [];
  });
}
