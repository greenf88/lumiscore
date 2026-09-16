import type { Book } from '../../app/data/books.ts';

export function getGuestWantedStorageId(book: Pick<Book, 'id' | 'workId'>): string {
  return book.workId ? `work-${book.workId}` : book.id;
}

export function normalizeGuestWantedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const trimmed = item.trim();
    const workMatch = /^(?:work-)?(\d+)$/.exec(trimmed);
    if (workMatch) return [`work-${workMatch[1]}`];
    return trimmed ? [trimmed] : [];
  }))];
}

export function toggleGuestWantedId(
  current: ReadonlySet<string>,
  storageId: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(storageId)) next.delete(storageId);
  else next.add(storageId);
  return next;
}
