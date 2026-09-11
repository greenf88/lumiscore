import type { Book } from '@/app/data/books';

export const CATALOG_SEARCH_MIN_LENGTH = 2;
export const CATALOG_SEARCH_LIMIT = 18;
export const CATALOG_SEARCH_DEBOUNCE_MS = 300;

export type CatalogSearchResult = Book;

export function normalizeCatalogSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, 100);
}

export function isCatalogSearchQuery(query: string): boolean {
  return normalizeCatalogSearchQuery(query).length >= CATALOG_SEARCH_MIN_LENGTH;
}

function searchable(value: string): string {
  return value.toLocaleLowerCase('en-US');
}

function resultScore(book: CatalogSearchResult, normalizedQuery: string): number {
  const query = searchable(normalizedQuery);
  const title = searchable(book.title);
  const author = searchable(book.author);

  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (author === query) return 3;
  if (author.startsWith(query)) return 4;
  if (author.includes(query)) return 5;
  return Number.POSITIVE_INFINITY;
}

export function rankCatalogSearchResults(
  books: readonly CatalogSearchResult[],
  query: string,
  limit = CATALOG_SEARCH_LIMIT,
): CatalogSearchResult[] {
  const normalizedQuery = normalizeCatalogSearchQuery(query);
  if (normalizedQuery.length < CATALOG_SEARCH_MIN_LENGTH) return [];

  const uniqueBooks = new Map<string, CatalogSearchResult>();
  for (const book of books) {
    if (Number.isFinite(resultScore(book, normalizedQuery))) {
      uniqueBooks.set(book.workId ?? book.id, book);
    }
  }

  return [...uniqueBooks.values()]
    .sort((left, right) => {
      const scoreDifference =
        resultScore(left, normalizedQuery) - resultScore(right, normalizedQuery);
      if (scoreDifference !== 0) return scoreDifference;

      return left.title.localeCompare(right.title, 'en', {
        sensitivity: 'base',
      });
    })
    .slice(0, Math.max(0, Math.trunc(limit)));
}
