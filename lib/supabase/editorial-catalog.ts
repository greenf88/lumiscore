import type { CatalogBrowsePage } from './books';
import { editorialRpcArgs, type EditorialQuery } from '@/lib/catalog/editorial-query';
import type { Locale } from '@/lib/i18n/config';
export type EditorialPage = CatalogBrowsePage & {
  available: boolean;
  facets: Record<string, number>;
  selectionCount: number | null;
};
export async function loadEditorialCatalog(state: EditorialQuery, locale: Locale): Promise<EditorialPage> {
  const [{ supabase }, { loadCatalogBooksByIdsWithStoredCovers }] = await Promise.all([
    import('./client'), import('./books'),
  ]);
  const { data, error } = await supabase.rpc('catalog_editorial_page', editorialRpcArgs(state));
  if (error) throw error;
  const ids = (data.workIds as number[]).map(String);
  // Keep existing edition ranking, stored-cover validation and genuine rating summaries.
  const books = await loadCatalogBooksByIdsWithStoredCovers(ids, undefined, locale);
  const byId = new Map(books.map(book => [book.workId, book]));
  return {
    books: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),
    total: Number(data.total), page: Number(data.page), pageSize: state.pageSize,
    pageCount: Number(data.pageCount), sort: state.sort,
    facets: data.facets ?? {}, selectionCount: Number.isSafeInteger(data.selectionCount) ? data.selectionCount : null, available: true,
  };
}
export function unavailableEditorialPage(state: EditorialQuery): EditorialPage {
  return { books: [], total: 0, page: 1, pageSize: state.pageSize, pageCount: 1,
    sort: state.sort, facets: {}, selectionCount: null, available: false };
}
