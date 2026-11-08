import type { CatalogBrowsePage } from './books';
import { type EditorialQuery } from '@/lib/catalog/editorial-query';
import type { Locale } from '@/lib/i18n/config';
import type { PublicCategory, AuthorOption } from '@/lib/catalog/discovery';
import { loadPublicCategories } from './categories';
import { eligibleBrowseArgs, readEligibleBrowsePage, alignEligibleBrowseBooks } from '@/lib/catalog/eligible-browse';
import { ReliableCatalogPages, CatalogUnavailable } from '@/lib/catalog/reliable-page';
export type EditorialPage = CatalogBrowsePage & {
  available: boolean;
  facets: Record<string, number>;
  selectionCount: number | null;
  categories: PublicCategory[];
  selectedAuthor: AuthorOption | null;
  discoveryAvailable: boolean;
};
const pages = new ReliableCatalogPages<EditorialPage>();
export async function loadEditorialCatalog(state: EditorialQuery, locale: Locale, hydrateBooks = true, streamCovers = false): Promise<EditorialPage> {
  return pages.get({ locale, page: state.page, key: JSON.stringify([eligibleBrowseArgs(state, locale), hydrateBooks, streamCovers]),
    load: signal => loadEditorialAttempt(state, locale, hydrateBooks, streamCovers, signal),
    validate: value => {
      const expected = hydrateBooks ? Math.min(state.pageSize, Math.max(0, value.total - (value.page - 1) * state.pageSize)) : 0;
      if (!value.available || value.books.length !== expected || (hydrateBooks && value.total > 0 && !value.books.length)) throw new CatalogUnavailable('unexpected_empty_page');
      return value.books.length;
    } });
}
async function loadEditorialAttempt(state: EditorialQuery, locale: Locale, hydrateBooks: boolean, streamCovers: boolean, signal: AbortSignal): Promise<EditorialPage> {
  const [{ supabase }, { loadCatalogBooksByIdsWithStoredCovers }] = await Promise.all([
    import('./client'), import('./books'),
  ]);
  const rpcSignal = AbortSignal.any([signal, AbortSignal.timeout(1800)]);
  const [categories, selectedAuthor, response] = await Promise.all([
    loadPublicCategories(AbortSignal.timeout(1500)).catch(() => null), state.author ? supabase.from('authors').select('id,name').eq('id', state.author).abortSignal(AbortSignal.timeout(1500)).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
    supabase.rpc('catalog_browse_page_v3', eligibleBrowseArgs(state, locale)).abortSignal(rpcSignal),
  ]);
  // A backend awaiting this reviewed RPC is unavailable, not an incorrectly
  // counted fallback. Public eligibility/count/order/page share one SQL snapshot.
  const { data, error } = response;
  if (error) throw new CatalogUnavailable(rpcSignal.aborted ? 'timeout' : response.status === 429 ? 'upstream_429' : 'upstream_data', response.status >= 400 ? response.status : null);
  const { ids, total, page, pageCount } = readEligibleBrowsePage(data, state, locale);
  // Keep existing edition ranking, stored-cover validation and genuine rating summaries.
  const books = hydrateBooks ? await loadCatalogBooksByIdsWithStoredCovers(ids, undefined, locale, streamCovers, signal) : [];
  return {
    books: hydrateBooks ? alignEligibleBrowseBooks(ids, books) : [],
    total, page, pageSize: state.pageSize,
    pageCount, sort: state.sort,
    facets: data.facets ?? {}, selectionCount: Number.isSafeInteger(data.selectionCount) ? data.selectionCount : null, available: true,
    categories: categories ?? [], selectedAuthor, discoveryAvailable: categories !== null,
  };
}
export function unavailableEditorialPage(state: EditorialQuery): EditorialPage {
  return { books: [], total: 0, page: 1, pageSize: state.pageSize, pageCount: 1,
    sort: state.sort, facets: {}, selectionCount: null, available: false, categories: [], selectedAuthor: null, discoveryAvailable: false };
}
