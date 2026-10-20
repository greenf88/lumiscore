import type { Book } from '../../app/data/books.ts';
import type { EditorialQuery } from './editorial-query.ts';
import { rankCatalogSearchResults, type CatalogSearchAliases } from '../books/catalog-search.ts';

export type SearchIdPage = { workIds: number[]; total: number; page: number; facets?: Record<string, number>; selectionCount?: number };
/** Existing RPC exposes <=128 bare IDs, not globally relevance-ranked pages.
 * Collect the matching ID selection only; never download covers/ratings/catalog
 * into the browser to reorder an already paginated window. */
export async function collectSearchIds(first: SearchIdPage, fetchPage: (page: number) => Promise<SearchIdPage>) {
  const size = 128;
  if (!Number.isSafeInteger(first.total) || first.total < 0 || first.total > 10000 || first.page !== 1) {
    throw new Error('Search selection unavailable; narrow the search.');
  }
  const ids = [...first.workIds];
  const pages = Math.ceil(first.total / size);
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - start + 1) }, (_, n) => start + n)
      .map(async page => {
        const result = await fetchPage(page);
        if (result.total !== first.total || result.page !== page || result.workIds.length > size) throw new Error('Search changed; retry.');
        return result.workIds;
      }));
    ids.push(...batch.flat());
  }
  if (ids.length !== first.total || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Incomplete search selection.');
  }
  return ids.map(String);
}

/** Input already has strict edition identity and all database filters applied. */
export function searchWindow(books: readonly Book[], state: EditorialQuery, aliases?: CatalogSearchAliases) {
  const ranked = state.relevance ? rankCatalogSearchResults(books, state.query, books.length, aliases) : [...books];
  const seen = new Set(ranked.map(book => book.workId ?? book.id));
  // A database alias may not be in the local reviewed-alias map. Keep that
  // verified hit after ranked matches; sorting must never change eligibility.
  const ordered = [...ranked, ...books.filter(book => !seen.has(book.workId ?? book.id))];
  const total = ordered.length, pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(state.page, pageCount);
  return { books: ordered.slice((page - 1) * state.pageSize, page * state.pageSize), total, page, pageCount };
}
