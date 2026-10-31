import type { Book, VerifiedBookDescription } from '@/app/data/books';
import type { Locale } from '../i18n/config.ts';
import { resolveBookDescription, type BookDescriptionResolution } from './description-resolution.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';

/** Public bibliographic sources only. No personal data, own API call or DB write. */
export async function loadPublicBookDescription(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch): Promise<VerifiedBookDescription | null> {
  return (await loadPublicBookDescriptionState(book, locale, fetchImplementation)).description;
}

/** Preserve absence versus transport failure through to the public UI. */
export async function loadPublicBookDescriptionState(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch): Promise<BookDescriptionResolution> {
  if(book.editionAvailable===false)return {state:'confirmed_missing',description:null};
  const stored=normalizeVerifiedBookDescription(book.storedDescription);
  if(stored&&stored.language===locale)
    return {state:'resolved',description:stored};
  const budget = AbortSignal.timeout(4_000);
  const boundedFetch: typeof fetch = (input, init) => {
    budget.throwIfAborted();
    return fetchImplementation(input, {
      ...init, signal: init?.signal ? AbortSignal.any([budget, init.signal]) : budget,
    });
  };
  const result = await resolveBookDescription({
    workId: book.workId, editionId: book.editionId, author: book.author,
    openLibraryWorkId: book.openLibraryWorkId,
    openLibraryEditionId: book.openLibraryEditionId,
    isbn13: book.isbn13, editionLanguage: book.editionLanguage, editionTitle:book.editionTitle,
    editionCandidates: book.descriptionCandidates, locale,
  }, boundedFetch);
  const description = normalizeVerifiedBookDescription(result.description);
  return description?.language === locale ? {state:'resolved',description} : {state:result.state==='temporary_failure'||book.storedPresentationUnavailable?'temporary_failure':'confirmed_missing',description:null};
}
