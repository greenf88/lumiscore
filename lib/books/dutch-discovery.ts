import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { isDutchLanguageBook } from './language.ts';

function hasRealRating(book: Book): boolean {
  return book.score !== null && (book.ratingsCount ?? 0) > 0;
}

export function shouldShowDutchDiscovery(
  locale: Locale,
  bookCount: number,
): boolean {
  return locale === 'nl' && bookCount > 0;
}

export function selectDutchDiscoveryBooks(
  books: readonly Book[],
  excludedWorkIds: ReadonlySet<string> = new Set(),
  limit = 6,
): Book[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return books
    .filter((book) =>
      Boolean(book.workId) &&
      !excludedWorkIds.has(book.workId!) &&
      isDutchLanguageBook(book),
    )
    .toSorted((left, right) =>
      Number(hasRealRating(right)) - Number(hasRealRating(left)) ||
      (right.score ?? -1) - (left.score ?? -1) ||
      (right.ratingsCount ?? 0) - (left.ratingsCount ?? 0) ||
      left.title.localeCompare(right.title, 'nl', { sensitivity: 'base' }) ||
      Number(left.workId) - Number(right.workId) ||
      left.workId!.localeCompare(right.workId!, 'en'),
    )
    .slice(0, safeLimit);
}
