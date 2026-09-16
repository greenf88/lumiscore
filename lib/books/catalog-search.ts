import type { Book } from '@/app/data/books';
import { REVIEWED_WORK_TITLE_ALIASES } from './reviewed-title-aliases.ts';

export const CATALOG_SEARCH_MIN_LENGTH = 2;
export const CATALOG_SEARCH_SUGGESTION_LIMIT = 18;
export const CATALOG_SEARCH_PAGE_LIMIT = 24;
export const CATALOG_SEARCH_MAX_LIMIT = 40;
export const CATALOG_SEARCH_LIMIT = CATALOG_SEARCH_SUGGESTION_LIMIT;
export const CATALOG_SEARCH_DEBOUNCE_MS = 300;

export type CatalogSearchResult = Book;
export type CatalogSearchAliasEntry = {
  workId: string;
  title: string;
};
export type CatalogSearchAliases = ReadonlyMap<string, readonly string[]>;

export function normalizeCatalogSearchQuery(query: string): string {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 100);
}

export function isCatalogSearchQuery(query: string): boolean {
  return normalizeCatalogSearchQuery(query).length >= CATALOG_SEARCH_MIN_LENGTH;
}

export function normalizeCatalogSearchText(value: string): string {
  return normalizeCatalogSearchQuery(value)
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function textScore(
  value: string,
  query: string,
  exactScore: number,
  prefixScore: number,
  partialScore: number,
): number {
  const searchableValue = normalizeCatalogSearchText(value);
  if (searchableValue === query) return exactScore;
  if (searchableValue.startsWith(query)) return prefixScore;
  if (searchableValue.includes(query)) return partialScore;
  return Number.POSITIVE_INFINITY;
}

function resultScore(
  book: CatalogSearchResult,
  normalizedQuery: string,
  aliasesByWorkId?: CatalogSearchAliases,
): number {
  const query = normalizeCatalogSearchText(normalizedQuery);
  const titleScore = textScore(book.title, query, 0, 1, 2);
  const aliasScore = Math.min(
    ...(aliasesByWorkId?.get(book.workId ?? book.id) ?? []).map((alias) =>
      textScore(alias, query, 0.5, 1.5, 2.5),
    ),
  );
  const authorScore = textScore(book.author, query, 3, 4, 5);

  return Math.min(titleScore, aliasScore, authorScore);
}

function aliasMatchesQuery(alias: string, normalizedQuery: string): boolean {
  const query = normalizeCatalogSearchText(normalizedQuery);
  return query.length >= CATALOG_SEARCH_MIN_LENGTH
    && normalizeCatalogSearchText(alias).includes(query);
}

export function collectCatalogSearchAliases(
  query: string,
  editionAliases: readonly CatalogSearchAliasEntry[],
): {
  workIds: string[];
  aliasesByWorkId: Map<string, readonly string[]>;
} {
  const normalizedQuery = normalizeCatalogSearchQuery(query);
  const aliasesByWorkId = new Map<string, string[]>();

  const addAlias = (workId: string, alias: string) => {
    if (!aliasMatchesQuery(alias, normalizedQuery)) return;

    const aliases = aliasesByWorkId.get(workId) ?? [];
    if (!aliases.includes(alias)) aliases.push(alias);
    aliasesByWorkId.set(workId, aliases);
  };

  for (const { workId, title } of editionAliases) addAlias(workId, title);
  for (const reviewed of REVIEWED_WORK_TITLE_ALIASES) {
    for (const alias of reviewed.aliases) addAlias(reviewed.workId, alias);
  }

  return {
    workIds: [...aliasesByWorkId.keys()],
    aliasesByWorkId,
  };
}

export function rankCatalogSearchResults(
  books: readonly CatalogSearchResult[],
  query: string,
  limit = CATALOG_SEARCH_LIMIT,
  aliasesByWorkId?: CatalogSearchAliases,
): CatalogSearchResult[] {
  const normalizedQuery = normalizeCatalogSearchQuery(query);
  if (normalizedQuery.length < CATALOG_SEARCH_MIN_LENGTH) return [];

  const uniqueBooks = new Map<string, CatalogSearchResult>();
  for (const book of books) {
    if (Number.isFinite(resultScore(book, normalizedQuery, aliasesByWorkId))) {
      uniqueBooks.set(book.workId ?? book.id, book);
    }
  }

  return [...uniqueBooks.values()]
    .sort((left, right) => {
      const scoreDifference =
        resultScore(left, normalizedQuery, aliasesByWorkId)
        - resultScore(right, normalizedQuery, aliasesByWorkId);
      if (scoreDifference !== 0) return scoreDifference;

      return left.title.localeCompare(right.title, 'en', {
        sensitivity: 'base',
      });
    })
    .slice(0, Math.max(0, Math.trunc(limit)));
}
