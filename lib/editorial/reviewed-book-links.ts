import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from '../books/edition-ranking.ts';
import { REVIEWED_BOOK_LINKS } from './reviewed-book-links-data.ts';

const normalized = (value: string | null | undefined) => (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

/** Do not reuse production IDs for an unrelated work in an isolated catalogue. */
export function reviewedBookLinks(book: Book, locale: Locale) {
  if (book.source !== 'supabase' || book.editionAvailable === false
    || normalizeEditionLanguage(book.editionLanguage ?? '') !== (locale === 'nl' ? 'nld' : 'eng')
    || (book.detailLocales && !book.detailLocales.includes(locale))
    || (book.strictEditionLanguage && book.strictEditionLanguage !== locale)) return [];
  const source = REVIEWED_BOOK_LINKS.find(entry => entry.workId === book.workId && entry.language === locale
    && entry.openLibraryWorkId === book.openLibraryWorkId
    && normalized(entry.title) === normalized(book.editionTitle)
    && normalized(entry.author) === normalized(book.author));
  if (!source) return [];
  return source.links.flatMap(link => {
    const target = REVIEWED_BOOK_LINKS.find(entry => entry.workId === link.workId && entry.language === locale);
    return target && target.workId !== source.workId
      ? [{ href: '/book/' + target.workId, title: target.title, reason: link.reason }] : [];
  });
}
