import type { CatalogBrowsePage } from './books';
import { type EditorialQuery } from '@/lib/catalog/editorial-query';
import type { Locale } from '@/lib/i18n/config';
import type { PublicCategory, AuthorOption } from '@/lib/catalog/discovery';
import { loadPublicCategories } from './categories';
import { eligibleBrowseArgs, readEligibleBrowsePage, alignEligibleBrowseBooks } from '@/lib/catalog/eligible-browse';
export type EditorialPage = CatalogBrowsePage & {
  available: boolean;
  facets: Record<string, number>;
  selectionCount: number | null;
  categories: PublicCategory[];
  selectedAuthor: AuthorOption | null;
  discoveryAvailable: boolean;
};
export async function loadEditorialCatalog(state: EditorialQuery, locale: Locale, hydrateBooks = true, streamCovers = false): Promise<EditorialPage> {
  const [{ supabase }, { loadCatalogBooksByIdsWithStoredCovers }] = await Promise.all([
    import('./client'), import('./books'),
  ]);
  const [categories, selectedAuthor, response] = await Promise.all([
    loadPublicCategories(), state.author ? supabase.from('authors').select('id,name').eq('id', state.author).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
    supabase.rpc('catalog_browse_page_v2', eligibleBrowseArgs(state, locale)).abortSignal(AbortSignal.timeout(5000)),
  ]);
  // A backend awaiting this reviewed RPC is unavailable, not an incorrectly
  // counted fallback. Public eligibility/count/order/page share one SQL snapshot.
  const { data, error } = response;
  if (error) throw error;
  const { ids, total, page, pageCount } = readEligibleBrowsePage(data, state, locale);
  // Keep existing edition ranking, stored-cover validation and genuine rating summaries.
  const books = hydrateBooks ? await loadCatalogBooksByIdsWithStoredCovers(ids, undefined, locale, streamCovers) : [];
  return {
    books: hydrateBooks ? alignEligibleBrowseBooks(ids, books) : [],
    total, page, pageSize: state.pageSize,
    pageCount, sort: state.sort,
    facets: data.facets ?? {}, selectionCount: Number.isSafeInteger(data.selectionCount) ? data.selectionCount : null, available: true,
    categories, selectedAuthor, discoveryAvailable: true,
  };
}
export function unavailableEditorialPage(state: EditorialQuery): EditorialPage {
  return { books: [], total: 0, page: 1, pageSize: state.pageSize, pageCount: 1,
    sort: state.sort, facets: {}, selectionCount: null, available: false, categories: [], selectedAuthor: null, discoveryAvailable: false };
}
