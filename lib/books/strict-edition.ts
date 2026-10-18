import type { Book } from '../../app/data/books.ts';
import { normalizeEditionLanguage, rankRepresentativeEditions, isSuspiciousRepresentativeEdition } from './edition-ranking.ts';
import { uniqueCoverUrls, normalizeOpenLibraryId, normalizeIsbn13 } from './covers.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';
import type { Locale } from '../i18n/config.ts';

export type StrictEditionRow = {
  id: number | string; work_id?: number | string; title: string | null; language: string | null;
  isbn_10?: string | null; isbn_13: string | null; open_library_edition_id: string | null; publisher?: string | null;
};
export type EditionBoundCover = { state: string; source_key: string; cover_url: string | null; editionVerified?:boolean };
export function permittedEditionLanguage(edition: Pick<StrictEditionRow, 'language'>, locale: Locale): boolean {
  return editionHasLanguage(edition,locale) || (locale==='nl' && editionHasLanguage(edition,'en'));
}
export function editionHasLanguage(edition: Pick<StrictEditionRow, 'language'>, language: Locale): boolean {
  return Boolean(edition.language && normalizeEditionLanguage(edition.language.trim()) === (language === 'nl' ? 'nld' : 'eng'));
}
/** NL first, then explicit EN; EN only EN. No title/script/ISBN-prefix inference. */
export function selectStrictEdition(editions: readonly StrictEditionRow[], language: Locale, title: string): StrictEditionRow | null {
  const possible = editions.filter(e => permittedEditionLanguage(e, language) && e.id != null && String(e.id).trim() && e.title?.trim() && !isSuspiciousRepresentativeEdition(e));
  const preferred=possible.filter(e=>editionHasLanguage(e,language));
  const allowed=preferred.length?preferred:possible;
  const ranked = rankRepresentativeEditions(allowed.map(e => ({
    ...e, languageCodes: [e.language!], openLibraryEditionId: e.open_library_edition_id, isbn13: e.isbn_13,
  })), { workTitle: title, preferredLanguages: [language === 'nl' ? 'nld' : 'eng'] });
  return ranked[0] ?? null;
}
export function withStrictEdition(book: Book, edition: StrictEditionRow | null, language: Locale,
  storedCovers: readonly EditionBoundCover[] = []): Book | null {
  if (!edition || !permittedEditionLanguage(edition, language) || !edition.title?.trim() ||
    (edition.work_id != null && String(edition.work_id)!==book.workId)) return null;
  const editionOlid = normalizeOpenLibraryId(edition.open_library_edition_id, 'edition');
  const isbn13 = normalizeIsbn13(edition.isbn_13);
  const isbn10 = edition.isbn_10?.replace(/[\s-]/g, '').toUpperCase();
  const reviewed = getReviewedCoverOverride({ ...book, title:edition.title.trim(), isbn13 });
  const keys = new Set([editionOlid].filter(Boolean));
  const verified = storedCovers.filter(c => c.editionVerified===true && c.state === 'resolved' && keys.has(c.source_key)).map(c => c.cover_url);
  // Work-level cover IDs and resolved Work covers may belong to another edition.
  // An ISBN endpoint returning an image is NOT edition/image evidence. Existing
  // Work-keyed caches are not evidence either. Only reviewed or edition-bound assets.
  const coverUrls = uniqueCoverUrls([reviewed?.coverUrl, ...verified]);
  return { ...book, title: edition.title.trim(), editionTitle: edition.title.trim(),
    editionId: String(edition.id), editionLanguage: edition.language, editionPublisher: edition.publisher ?? null,
    openLibraryEditionId: editionOlid, isbn10: isbn10 ?? null, isbn13,
    coverUrls, backCover:null, descriptionCandidates:[], strictEditionLanguage: language,
    editionAvailable:true, englishEditionFallback:language==='nl' && editionHasLanguage(edition,'en') };
}

/** Direct links remain valid even when no permitted edition can be presented. */
export function unavailableEdition(book:Book, locale:Locale):Book {
  return {...book,title:locale==='nl'?'Geen passende editie beschikbaar':'No suitable edition available',
    editionAvailable:false,englishEditionFallback:false,strictEditionLanguage:locale,
    editionId:null,editionTitle:null,editionLanguage:null,editionPublisher:null,
    openLibraryEditionId:null,isbn10:null,isbn13:null,coverUrls:[],backCover:null,descriptionCandidates:[]};
}
