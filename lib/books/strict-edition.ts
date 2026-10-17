import type { Book } from '../../app/data/books.ts';
import { normalizeEditionLanguage, rankRepresentativeEditions, isSuspiciousRepresentativeEdition } from './edition-ranking.ts';
import { getOpenLibraryCoverUrl, getOpenLibraryOlidCoverUrl, uniqueCoverUrls, normalizeOpenLibraryId, normalizeIsbn13 } from './covers.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';
import type { Locale } from '../i18n/config.ts';

export type StrictEditionRow = {
  id: number | string; work_id?: number | string; title: string | null; language: string | null;
  isbn_10?: string | null; isbn_13: string | null; open_library_edition_id: string | null; publisher?: string | null;
};
export type EditionBoundCover = { state: string; source_key: string; cover_url: string | null };
export function editionHasLanguage(edition: Pick<StrictEditionRow, 'language'>, language: Locale): boolean {
  return Boolean(edition.language && normalizeEditionLanguage(edition.language.trim()) === (language === 'nl' ? 'nld' : 'eng'));
}
/** No ISBN/author/title inference. Never rank another language as a fallback. */
export function selectStrictEdition(editions: readonly StrictEditionRow[], language: Locale, title: string): StrictEditionRow | null {
  const allowed = editions.filter(e => editionHasLanguage(e, language) && String(e.id).trim() && e.title?.trim() && !isSuspiciousRepresentativeEdition(e));
  const ranked = rankRepresentativeEditions(allowed.map(e => ({
    ...e, languageCodes: [e.language!], openLibraryEditionId: e.open_library_edition_id, isbn13: e.isbn_13,
  })), { workTitle: title, preferredLanguages: [language === 'nl' ? 'nld' : 'eng'] });
  return ranked[0] ?? null;
}
export function withStrictEdition(book: Book, edition: StrictEditionRow | null, language: Locale,
  storedCovers: readonly EditionBoundCover[] = []): Book | null {
  if (!edition || !editionHasLanguage(edition, language) || !edition.title?.trim()) return null;
  const editionOlid = normalizeOpenLibraryId(edition.open_library_edition_id, 'edition');
  const isbn13 = normalizeIsbn13(edition.isbn_13);
  const isbn10 = edition.isbn_10?.replace(/[\s-]/g, '').toUpperCase();
  const reviewed = getReviewedCoverOverride({ ...book, isbn13 });
  const keys = new Set([editionOlid, isbn13, isbn10 && /^\d{9}[\dX]$/.test(isbn10) ? isbn10 : null].filter(Boolean));
  const verified = storedCovers.filter(c => c.state === 'resolved' && keys.has(c.source_key)).map(c => c.cover_url);
  // Work-level cover IDs and resolved Work covers may belong to another edition.
  const coverUrls = uniqueCoverUrls([reviewed?.coverUrl, ...verified,
    getOpenLibraryOlidCoverUrl(editionOlid),
    editionOlid ? getOpenLibraryCoverUrl(isbn13) : null]);
  return { ...book, title: edition.title.trim(), editionTitle: edition.title.trim(),
    editionId: String(edition.id), editionLanguage: edition.language, editionPublisher: edition.publisher ?? null,
    openLibraryEditionId: editionOlid, isbn10: isbn10 ?? null, isbn13,
    coverUrls, strictEditionLanguage: language };
}
