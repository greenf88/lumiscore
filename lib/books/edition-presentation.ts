import { normalizeIsbn13, normalizeOpenLibraryId } from './covers.ts';
import { selectStrictEdition, type StrictEditionRow } from './strict-edition.ts';
import type { Locale } from '../i18n/config.ts';

export function selectBookEdition(workId: string, title: string, rows: readonly StrictEditionRow[], locale: Locale) {
  if (!title.trim()) return null;
  const edition = selectStrictEdition(rows.map(row => ({
    ...row,
    isbn_13: normalizeIsbn13(row.isbn_13),
    open_library_edition_id: normalizeOpenLibraryId(row.open_library_edition_id, 'edition'),
  })), locale, title);
  return edition && (edition.work_id == null || String(edition.work_id) === workId) ? edition : null;
}
