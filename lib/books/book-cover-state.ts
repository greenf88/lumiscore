import type { Book } from '../../app/data/books.ts';
import { getOpenLibraryCoverUrl } from './covers.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';

type BookCoverIdentityFields = Pick<
  Book,
  'id' | 'workId' | 'openLibraryWorkId' | 'isbn13'
>;

type BookCoverInitialFields = Pick<
  Book,
  'coverUrls' | 'isbn13' | 'workId' | 'title' | 'author'
>;

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
  const reviewedCover = getReviewedCoverOverride(book)?.coverUrl;
  if (book.coverUrls !== undefined) {
    return [...new Set([...book.coverUrls, reviewedCover].filter(
      (url): url is string => Boolean(url),
    ))];
  }

  const openLibraryCoverUrl = getOpenLibraryCoverUrl(book.isbn13);
  return [...new Set([reviewedCover, openLibraryCoverUrl].filter(
    (url): url is string => Boolean(url),
  ))];
}

export function hasUsableInitialBookCover(
  book: BookCoverInitialFields,
): boolean {
  return getInitialBookCoverUrls(book).length > 0;
}
