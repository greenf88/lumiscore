import type { Book } from '@/app/data/books';
import { REVIEWED_WORK_TITLE_ALIASES } from './reviewed-title-aliases.ts';
import { REVIEWED_COAUTHORS, reviewedCoauthor } from '../catalog/reviewed-coauthors.ts';

export const CATALOG_SEARCH_MIN_LENGTH = 2;
export const CATALOG_SEARCH_SUGGESTION_LIMIT = 18;
export const CATALOG_SEARCH_PAGE_LIMIT = 100;
export const CATALOG_SEARCH_MAX_LIMIT = 100;
export const CATALOG_SEARCH_LIMIT = CATALOG_SEARCH_SUGGESTION_LIMIT;
export const CATALOG_SEARCH_DEBOUNCE_MS = 300;

export type CatalogSearchResult = Book;
export type CatalogSearchAliasEntry = {
  workId: string;
  title: string;
};
export type CatalogSearchAliases = ReadonlyMap<string, readonly string[]>;

export function normalizeCatalogSearchQuery(query: string): string {
  // NFKC expands a terminal Unicode ellipsis into three dots. The SQL
  // candidate lookup uses literal edition titles, so that otherwise misses
  // titles ending in the original ellipsis. Omit only a terminal ellipsis;
  // retain meaningful internal punctuation and the existing search limit.
  return query.normalize('NFKC').trim().replace(/\.{3,}$/u, '').trimEnd()
    .replace(/\s+/g, ' ').slice(0, 100);
}

export function isCatalogSearchQuery(query: string): boolean {
  return normalizeCatalogSearchQuery(query).length >= CATALOG_SEARCH_MIN_LENGTH;
}

/** Recognize complete ISBNs only, so ordinary title/author text stays on its existing path. */
export function normalizeCatalogIsbn(query: string): string | null {
  const isbn = query.normalize('NFKC').replace(/[\p{Dash_Punctuation}\s−]/gu, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? isbn : null;
  }
  if (!/^\d{9}[\dX]$/.test(isbn)) return null;
  const sum = [...isbn].reduce((total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0);
  return sum % 11 === 0 ? isbn : null;
}

export function normalizeCatalogSearchText(value: string): string {
  return normalizeCatalogSearchQuery(value)
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function reviewedCoauthorSearchWorkIds(query: string) {
  const normalized = normalizeCatalogSearchText(query);
  if (normalized.length < CATALOG_SEARCH_MIN_LENGTH) return [];
  return REVIEWED_COAUTHORS.filter(credit => normalizeCatalogSearchText(credit.name).includes(normalized))
    .map(credit => Number(credit.workId));
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
  const coauthor = reviewedCoauthor(book);
  const authorScore = Math.min(textScore(book.author, query, 3, 4, 5),
    coauthor ? textScore(coauthor.name, query, 3, 4, 5) : Number.POSITIVE_INFINITY);

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
