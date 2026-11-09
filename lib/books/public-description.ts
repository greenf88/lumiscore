import type { Book, VerifiedBookDescription } from '@/app/data/books';
import type { Locale } from '../i18n/config.ts';
import { resolveBookDescription, type BookDescriptionResolution } from './description-resolution.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';
import { createDescriptionSnapshot, readDescriptionSnapshot, isDescriptionSnapshotWithdrawn } from './description-snapshot.ts';

/** Public bibliography only; optional PR92 source snapshots use the shared adapter. */
export async function loadPublicBookDescription(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch): Promise<VerifiedBookDescription | null> {
  return (await loadPublicBookDescriptionState(book, locale, fetchImplementation)).description;
}

/** Already reviewed by the shared, edition/author-bound storage loader. Keep
 * this synchronous so SSR can render approved text in the initial main slot. */
export function getStoredPublicBookDescription(book: Book, locale: Locale): VerifiedBookDescription | null {
  if (book.editionAvailable === false) return null;
  const stored = normalizeVerifiedBookDescription(book.storedDescription);
  return stored?.language === locale ? stored : null;
}

/** Preserve absence versus transport failure through to the public UI. */
export async function loadPublicBookDescriptionState(book: Book, locale: Locale, fetchImplementation: typeof fetch = fetch,
  snapshotStore?:Pick<typeof import('../supabase/description-snapshots.ts'),'loadDescriptionSnapshot'|'saveDescriptionSnapshot'|'markDescriptionSnapshotFailure'>): Promise<BookDescriptionResolution> {
  if(book.editionAvailable===false)return {state:'confirmed_missing',description:null};
  const stored=getStoredPublicBookDescription(book,locale);
  if(stored)
    return {state:'resolved',description:stored};
  // Durable, exact-edition snapshots are independent of a server process.
  // Without a configured snapshot identity the existing provider path remains.
  // A failed disposition read must not silently revive a withdrawn source.
  const snapshots = snapshotStore ?? await import('../supabase/description-snapshots.ts');
  let priorRow;
  try { priorRow = await snapshots.loadDescriptionSnapshot(book, locale); }
  catch { return {state:'temporary_failure',description:null}; }
  // Reviewed central content above still wins; a withdrawn source is not refetched.
  if(isDescriptionSnapshotWithdrawn(priorRow,book,locale))return {state:'confirmed_missing',description:null};
  const prior = readDescriptionSnapshot(priorRow,book,locale);
  if (prior?.fresh) return {state:'resolved',description:prior.description};
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
  if (description?.language === locale) {
    const snapshot = createDescriptionSnapshot(book,locale,description);
    if (snapshot) await snapshots.saveDescriptionSnapshot(snapshot);
  } else if (prior && result.state === 'temporary_failure') {
    if (priorRow) await snapshots.markDescriptionSnapshotFailure(priorRow,'temporary_failure');
    console.info(JSON.stringify({event:'description_snapshot_fallback',locale,providerStatus:result.state}));
    return {state:'resolved',description:prior.description};
  }
  return description?.language === locale ? {state:'resolved',description} : {state:result.state==='temporary_failure'||book.storedPresentationUnavailable?'temporary_failure':'confirmed_missing',description:null};
}
