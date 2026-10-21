import type { Book, VerifiedBookDescription } from '@/app/data/books';
import type { Locale } from '../i18n/config.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';
import { getReviewedDescription } from './reviewed-descriptions.ts';

/** Public bibliographic sources only. No personal data, own API call or DB write. */
export async function loadPublicBookDescription(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch): Promise<VerifiedBookDescription | null> {
  if(book.editionAvailable===false)return null;
  const lookup = {
    workId: book.workId, editionId: book.editionId, author: book.author,
    openLibraryWorkId: book.openLibraryWorkId,
    openLibraryEditionId: book.openLibraryEditionId,
    isbn13: book.isbn13, editionLanguage: book.editionLanguage, editionTitle:book.editionTitle,
    editionCandidates: book.descriptionCandidates, locale,
  };
  // An exact, human-reviewed own summary may be Dutch for an English edition.
  // This does not certify a Dutch edition or permit unlabelled provider copy.
  const reviewed = getReviewedDescription(lookup, locale);
  if (reviewed) return normalizeVerifiedBookDescription(reviewed);
  const budget = AbortSignal.timeout(4_000);
  const boundedFetch: typeof fetch = (input, init) => fetchImplementation(input, {
    ...init, signal: init?.signal ? AbortSignal.any([budget, init.signal]) : budget,
  });
  const result = await resolveBookDescription(lookup, boundedFetch);
  const description = normalizeVerifiedBookDescription(result.description);
  const allowed=book.englishEditionFallback && locale==='nl' ? 'en' : locale;
  return description?.language === allowed ? description : null;
}
