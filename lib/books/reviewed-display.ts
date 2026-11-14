import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';

/** Exact-edition display corrections, never a general retailer-text stripper.
 * Evidence: docs/operations/reviewed-descriptions-recovery{3,6}-202611*.json.
 * Preserve editionTitle: source snapshots and descriptions bind to that value. */
export function applyReviewedBookDisplay(book: Book, locale: Locale): Book {
  if (locale !== 'en' || book.editionAvailable !== true || book.strictEditionLanguage !== locale
    || normalizeEditionLanguage(book.editionLanguage ?? '') !== 'eng'
    || typeof book.author !== 'string') return book;
  const isbn = normalizeIsbn13(book.isbn13);
  const author = book.author.trim().normalize('NFC').toLowerCase();
  if (isbn === '9780008312787'
    && book.editionTitle === 'The Death of Truth [Hardcover] Michiko Kakutani'
    && author === 'michiko kakutani') {
    return { ...book, title: 'The Death of Truth', author: 'Michiko Kakutani' };
  }
  // The exact ebook's publisher is confirmed by Simon & Schuster. Replace
  // only the observed bad value; preserve future catalogue corrections.
  if (isbn === '9781534457713' && book.editionTitle === 'These Violent Delights'
    && author === 'chloe gong' && book.editionPublisher === 'Chloe Gong') {
    return { ...book, editionPublisher: 'Margaret K. McElderry Books' };
  }
  return book;
}
