import type { Book } from '@/app/data/books';
import type { EditorialQuery } from '../catalog/editorial-query.ts';
import { editorialRpcArgs } from '../catalog/editorial-query.ts';
import { collectSearchIds, searchWindow, type SearchIdPage } from '../catalog/search-window.ts';
import { collectCatalogSearchAliases } from '../books/catalog-search.ts';
import { mapCatalogWorks } from './books';
import { loadEditionRows } from './edition-rows.ts';
import { loadPublicCategories } from './categories';
import { supabase } from './client';
import { loadPublicRatingSummariesBatched } from './public-rating-summaries';
import { applyRatingSummaries } from '../ratings/card-summaries.ts';
import { deferEditionCoverEvidence } from '../books/edition-cover-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import { unavailableEditorialPage, type EditorialPage } from './editorial-catalog';

const IDENTITY_SELECT = 'id,title,first_publish_year,open_library_id,source_type,work_type,author_id,authors(id,name)';

/** Search-only presentation. Reuses existing DB filters and strict edition
 * selection; normal Browse's paged/highest-score path is deliberately untouched. */
export async function loadSearchCatalog(state: EditorialQuery, locale: Locale): Promise<EditorialPage> {
  const categoriesPromise = loadPublicCategories();
  if (state.query.length < 2) {
    return { ...unavailableEditorialPage(state), available: true, categories: await categoriesPromise };
  }
  const rpcArgs = { ...editorialRpcArgs({ ...state, pageSize: 128, page: 1 }),
    p_author_id: state.author ? Number(state.author) : null,
    p_languages: state.languages.length ? state.languages : locale === 'en' ? ['en'] : ['nl', 'en'] };
  const readPage = async (page: number): Promise<SearchIdPage> => {
    const { data, error } = await supabase.rpc('catalog_discovery_page', { ...rpcArgs, p_page: page });
    if (error) throw error; // Never silently ignore filters or convert failure to zero results.
    return data as SearchIdPage;
  };
  const [first, categories, selectedAuthor] = await Promise.all([
    readPage(1), categoriesPromise,
    state.author ? supabase.from('authors').select('id,name').eq('id', state.author).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
  ]);
  const ids = await collectSearchIds(first, readPage);
  const identities: Book[] = [];
  const titleAliases: { workId: string; title: string }[] = [];
  // Bounded batches; only minimal public identity metadata for MATCHING Works.
  // Complete edition rows avoid truncating nested relations. No N+1, ratings,
  // external cover requests or descriptions for off-page matches.
  for (let start = 0; start < ids.length; start += 200) {
    const batch = ids.slice(start, start + 200);
    const [result, editions] = await Promise.all([
      supabase.from('works').select(IDENTITY_SELECT).in('id', batch).order('id'),
      loadEditionRows(supabase, batch),
    ]);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || result.data.length !== batch.length) throw new Error('Search identities changed; retry.');
    const byWork = new Map<string, typeof editions>();
    for (const e of editions) {
      const key = String(e.work_id);
      const rows = byWork.get(key) ?? []; rows.push(e); byWork.set(key, rows);
      if (e.title) titleAliases.push({ workId: key, title: e.title });
    }
    for (const row of result.data) titleAliases.push({ workId: String(row.id), title: row.title });
    identities.push(...mapCatalogWorks(result.data.map(row => ({ ...row, editions: byWork.get(String(row.id)) ?? [] })), locale));
  }
  const byId = new Map(identities.map(book => [book.workId, book]));
  const candidates = ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const { aliasesByWorkId } = collectCatalogSearchAliases(state.query, titleAliases);
  const window = searchWindow(candidates, state, aliasesByWorkId);
  const summaries = await loadPublicRatingSummariesBatched(supabase, window.books.map(book => book.workId!));
  return { ...window, books: deferEditionCoverEvidence(applyRatingSummaries(window.books, summaries)),
    pageSize: state.pageSize, sort: state.sort, available: true, discoveryAvailable: true,
    facets: first.facets ?? {}, selectionCount: Number.isSafeInteger(first.selectionCount) ? first.selectionCount! : null,
    categories, selectedAuthor };
}
