import type { Book } from '../../app/data/books.ts';
import type { ReadingStatus } from './model.ts';

export const MY_BOOKS_STATUSES = [
  'want_to_read',
  'reading',
  'read',
  'dnf',
] as const satisfies readonly ReadingStatus[];

export type MyBooksItem = {
  book: Book;
  status: ReadingStatus;
  updatedAt: string | null;
};

export function filterMyBooks(
  items: readonly MyBooksItem[],
  status: ReadingStatus,
): MyBooksItem[] {
  return items.filter((item) => item.status === status);
}

export function countMyBooksByStatus(
  items: readonly MyBooksItem[],
): Record<ReadingStatus, number> {
  const counts: Record<ReadingStatus, number> = {
    want_to_read: 0,
    reading: 0,
    read: 0,
    dnf: 0,
  };
  for (const item of items) counts[item.status] += 1;
  return counts;
}
