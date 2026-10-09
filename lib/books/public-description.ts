import type { Book, VerifiedBookDescription } from '@/app/data/books';
import type { Locale } from '../i18n/config.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';

/** Public bibliographic sources only. No personal data, own API call or DB write. */
export async function loadPublicBookDescription(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch): Promise<VerifiedBookDescription | null> {
  const budget = AbortSignal.timeout(4_000);
  const boundedFetch: typeof fetch = (input, init) => fetchImplementation(input, {
    ...init, signal: init?.signal ? AbortSignal.any([budget, init.signal]) : budget,
  });
  const result = await resolveBookDescription({
    openLibraryWorkId: book.openLibraryWorkId,
    openLibraryEditionId: book.openLibraryEditionId,
    isbn13: book.isbn13, editionLanguage: book.editionLanguage,
    editionCandidates: book.descriptionCandidates, locale,
  }, boundedFetch);
  const description = normalizeVerifiedBookDescription(result.description);
  return description?.language === locale ? description : null;
}
