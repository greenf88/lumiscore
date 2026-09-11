import type { Book } from '@/app/data/books';

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
