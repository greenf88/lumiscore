import type { Book } from '../../app/data/books.ts';
import { getOpenLibraryCoverUrl } from './covers.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';
export {getBookCoverIdentity} from './bound-cover-state.ts';

type BookCoverInitialFields = Pick<
  Book,
  'coverUrls' | 'isbn13' | 'workId' | 'title' | 'author' | 'strictEditionLanguage'
>;

export function getInitialBookCoverUrls(
  book: BookCoverInitialFields,
): string[] {
  if (book.strictEditionLanguage) return [...new Set(book.coverUrls ?? [])];
  const reviewed = getReviewedCoverOverride(book);
  if (book.coverUrls !== undefined) {
    return [...new Set([...book.coverUrls, reviewed?.coverUrl, reviewed?.fallbackCoverUrl].filter(
      (url): url is string => Boolean(url),
    ))];
  }

  const openLibraryCoverUrl = getOpenLibraryCoverUrl(book.isbn13);
  return [...new Set([reviewed?.coverUrl, reviewed?.fallbackCoverUrl, openLibraryCoverUrl].filter(
    (url): url is string => Boolean(url),
  ))];
}

export function hasUsableInitialBookCover(
  book: BookCoverInitialFields,
): boolean {
  return getInitialBookCoverUrls(book).length > 0;
}
