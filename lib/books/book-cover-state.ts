import type { Book } from '../../app/data/books.ts';
import { getOpenLibraryCoverUrl } from './covers.ts';

type BookCoverIdentityFields = Pick<
  Book,
  'id' | 'workId' | 'openLibraryWorkId' | 'isbn13'
>;

type BookCoverInitialFields = Pick<Book, 'coverUrls' | 'isbn13'>;

function identityPart(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function getBookCoverIdentity(book: BookCoverIdentityFields): string {
  return JSON.stringify([
    identityPart(book.workId),
    identityPart(book.openLibraryWorkId),
    identityPart(book.isbn13),
    identityPart(book.id),
  ]);
}

export function getInitialBookCoverUrls(
  book: BookCoverInitialFields,
): string[] {
  if (book.coverUrls !== undefined) return [...book.coverUrls];

  const openLibraryCoverUrl = getOpenLibraryCoverUrl(book.isbn13);
  return openLibraryCoverUrl ? [openLibraryCoverUrl] : [];
}

export function hasUsableInitialBookCover(
  book: BookCoverInitialFields,
): boolean {
  return getInitialBookCoverUrls(book).length > 0;
}
