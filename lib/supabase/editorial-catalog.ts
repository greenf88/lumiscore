import type { CatalogBrowsePage } from './books';
import { editorialRpcArgs, type EditorialQuery } from '@/lib/catalog/editorial-query';
import type { Locale } from '@/lib/i18n/config';
import type { PublicCategory, AuthorOption } from '@/lib/catalog/discovery';
import { loadPublicCategories } from './categories';
export type EditorialPage = CatalogBrowsePage & {
  available: boolean;
  facets: Record<string, number>;
  selectionCount: number | null;
  categories: PublicCategory[];
  selectedAuthor: AuthorOption | null;
  discoveryAvailable: boolean;
};
export async function loadEditorialCatalog(state: EditorialQuery, locale: Locale, hydrateBooks = true): Promise<EditorialPage> {
  const [{ supabase }, { loadCatalogBooksByIdsWithStoredCovers }] = await Promise.all([
    import('./client'), import('./books'),
  ]);
  const [categories, selectedAuthor] = await Promise.all([
    loadPublicCategories(), state.author ? supabase.from('authors').select('id,name').eq('id', state.author).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
  ]);
  let response = await supabase.rpc('catalog_discovery_page', { ...editorialRpcArgs(state), p_author_id: state.author ? Number(state.author) : null });
  const discoveryAvailable = !response.error;
  // A review preview may use a backend awaiting the reviewed migration. Never silently ignore a filter.
  if (response.error?.code === 'PGRST202' && !state.author && state.sort !== 'highest') {
    response = await supabase.rpc('catalog_editorial_page', editorialRpcArgs(state));
  }
  const { data, error } = response;
  if (error) throw error;
  const ids = (data.workIds as number[]).map(String);
  // Keep existing edition ranking, stored-cover validation and genuine rating summaries.
  const books = hydrateBooks ? await loadCatalogBooksByIdsWithStoredCovers(ids, undefined, locale) : [];
  const byId = new Map(books.map(book => [book.workId, book]));
  return {
    books: ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),
    total: Number(data.total), page: Number(data.page), pageSize: state.pageSize,
    pageCount: Number(data.pageCount), sort: state.sort,
    facets: data.facets ?? {}, selectionCount: Number.isSafeInteger(data.selectionCount) ? data.selectionCount : null, available: true,
    categories, selectedAuthor, discoveryAvailable,
  };
}
export function unavailableEditorialPage(state: EditorialQuery): EditorialPage {
  return { books: [], total: 0, page: 1, pageSize: state.pageSize, pageCount: 1,
    sort: state.sort, facets: {}, selectionCount: null, available: false, categories: [], selectedAuthor: null, discoveryAvailable: false };
}
