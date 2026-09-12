import type { Book } from '@/app/data/books';
import { normalizeIsbn13 } from './covers.ts';

export function isCatalogWorkId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

export function getCatalogSourceLabel(book: Book): string {
  return book.sourceType === 'lumiscore_native' || !book.openLibraryWorkId
    ? 'LumiScore catalog'
    : 'Open Library catalog';
}

export function getBookMetadataDescription(book: Book): string {
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
