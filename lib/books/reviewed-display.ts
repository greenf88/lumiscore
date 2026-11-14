import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';

/** Exact-edition display correction, never a general retailer-text stripper.
 * Evidence: docs/operations/reviewed-descriptions-recovery3-20261113.json.
 * Preserve editionTitle: source snapshots and descriptions bind to that value. */
export function applyReviewedBookDisplay(book: Book, locale: Locale): Book {
  if (locale !== 'en' || book.editionAvailable !== true || book.strictEditionLanguage !== locale
    || normalizeEditionLanguage(book.editionLanguage ?? '') !== 'eng'
    || normalizeIsbn13(book.isbn13) !== '9780008312787'
    || book.editionTitle !== 'The Death of Truth [Hardcover] Michiko Kakutani'
    || book.author.trim().normalize('NFC').toLowerCase() !== 'michiko kakutani') return book;
  return { ...book, title: 'The Death of Truth', author: 'Michiko Kakutani' };
}
