import type { Book, VerifiedBookDescription } from '@/app/data/books';
import { normalizeIsbn13 } from './covers.ts';
import type { Locale } from '../i18n/config.ts';
import { translate } from '../i18n/translations.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';
import { publicDescriptionSource } from './description-source.ts';

export function isCatalogWorkId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

export function getCatalogSourceLabel(book: Book, locale: Locale = 'en'): string {
  return book.sourceType === 'lumiscore_native' || !book.openLibraryWorkId
    ? translate(locale, 'detail.lumiscoreCatalog')
    : translate(locale, 'detail.openLibraryCatalog');
}

/** Pass only the synchronous, edition-bound choice used by the page body.
 * Metadata must never await an optional provider or snapshot lookup. */
export function getBookMetadataDescription(book: Book, locale: Locale = 'en', initialDescription: VerifiedBookDescription | null = null): string {
  const description = normalizeVerifiedBookDescription(initialDescription);
  if (book.editionAvailable !== false && description?.language === locale && publicDescriptionSource(description)) {
    const text = description.text.replace(/\s+/gu, ' ').trim();
    const characters = Array.from(text);
    if (characters.length <= 160) return text;
    const prefix = characters.slice(0, 159).join('');
    const boundary = prefix.lastIndexOf(' ');
    if (boundary > 0) return prefix.slice(0, boundary).replace(/[,;:–—-]+$/u, '') + '…';
  }
  if (locale === 'nl') return `${book.title} van ${book.author}${book.firstPublishYear ? `, voor het eerst verschenen in ${book.firstPublishYear}` : ''}. Bekijk boekinformatie en de beoordelingsstatus op LumiScore.`;
  const year = book.firstPublishYear
    ? `, first published in ${book.firstPublishYear}`
    : '';
  return `${book.title} by ${book.author}${year}. View book information and its LumiScore rating status.`;
}

export function getVerifiedBackCover(book: Book) {
  const asset = book.backCover;
  if (!asset?.verified || asset.side !== 'back') return null;

  try {
    const url = new URL(asset.url);
    if (url.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  const bookIsbn13 = normalizeIsbn13(book.isbn13);
  const assetIsbn13 = normalizeIsbn13(asset.isbn13);
  if (bookIsbn13 && assetIsbn13 && bookIsbn13 !== assetIsbn13) return null;

  return asset;
}
