import type { Book } from '../../app/data/books.ts';

export const GUEST_WANTED_STORAGE_KEY = 'lumiscore-wanted';

export function getGuestWantedStorageId(book: Pick<Book, 'id' | 'workId'>): string {
  return book.workId ? `work-${book.workId}` : book.id;
}

export function normalizeGuestWantedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item === 'number') {
      return Number.isSafeInteger(item) && item > 0 ? [`work-${item}`] : [];
    }
    if (typeof item !== 'string') return [];
    const trimmed = item.trim();
    const workMatch = /^(?:work-)?(\d+)$/.exec(trimmed);
    if (workMatch) {
      const workId = Number(workMatch[1]);
      return Number.isSafeInteger(workId) && workId > 0 ? [`work-${workId}`] : [];
    }
    return trimmed ? [trimmed] : [];
  }))];
}

export function parseGuestWantedIds(serialized: string | null): string[] {
  if (!serialized) return [];
  try {
    return normalizeGuestWantedIds(JSON.parse(serialized) as unknown);
  } catch {
    return [];
  }
}

export function getGuestWantedWorkIds(
  storedIds: readonly string[],
  limit = 100,
): string[] {
  const workIds = storedIds.flatMap((storedId) => {
    const match = /^work-([1-9]\d*)$/.exec(storedId);
    return match ? [match[1]] : [];
  });
  return [...new Set(workIds)].slice(0, Math.max(0, limit));
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
