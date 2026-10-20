import type { Book } from '@/app/data/books';
import type { EditorialQuery } from '../catalog/editorial-query.ts';
import { editorialRpcArgs } from '../catalog/editorial-query.ts';
import { collectSearchIds, searchWindow, type SearchIdPage } from '../catalog/search-window.ts';
import { collectCatalogSearchAliases } from '../books/catalog-search.ts';
import { createSearchSelectionCache, readSearchIdentityBatches, searchSelectionKey, type PublicSearchSelection } from '../catalog/search-selection-cache.ts';
import { mapCatalogWorks } from './books';
import { loadEditionRows } from './edition-rows.ts';
import { loadPublicCategories } from './categories';
import { supabase } from './client';
import { loadPublicRatingSummariesBatched } from './public-rating-summaries';
import { applyRatingSummaries } from '../ratings/card-summaries.ts';
import { deferEditionCoverEvidence } from '../books/edition-cover-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import { unavailableEditorialPage, type EditorialPage } from './editorial-catalog';
import { measureServerOperation } from '../performance/server-timing.ts';
import { newSearchObservation, searchObservationEvent } from '../catalog/search-observation.ts';

const IDENTITY_SELECT = 'id,title,first_publish_year,open_library_id,source_type,work_type,author_id,authors(id,name)';
const readSelection = createSearchSelectionCache();

/** Search-only presentation. Reuses existing DB filters and strict edition
 * selection; normal Browse's paged/highest-score path is deliberately untouched. */
export async function loadSearchCatalog(state: EditorialQuery, locale: Locale): Promise<EditorialPage> {
  if (state.query.length < 2) {
    return { ...unavailableEditorialPage(state), available: true, categories: await loadPublicCategories() };
  }
  return measureServerOperation('search.catalog', 'public', () => loadObservedSearchCatalog(state, locale));
}

async function loadObservedSearchCatalog(state: EditorialQuery, locale: Locale): Promise<EditorialPage> {
  const observation = newSearchObservation(locale), started = performance.now();
  try {
    const selection = await readSelection(searchSelectionKey(state, locale), () => loadPublicSearchSelection(state, locale, observation), value => { observation.cache = value; });
    observation.selectionMs = performance.now() - started;
    const window = searchWindow(selection.books, state, selection.aliases);
    observation.eligibleTotal = window.total; observation.shown = window.books.length;
    observation.databaseRequests += Math.ceil(window.books.length / 100);
    const scoresStarted = performance.now();
    const summaries = await loadPublicRatingSummariesBatched(supabase, window.books.map(book => book.workId!));
    observation.scoresMs = performance.now() - scoresStarted;
    return { ...window, books: deferEditionCoverEvidence(applyRatingSummaries(window.books, summaries), (input, init) => {
      observation.coverSourceRequests++; return fetch(input, init);
    }),
      pageSize: state.pageSize, sort: state.sort, available: true, discoveryAvailable: true,
      facets: {}, selectionCount: null, categories: selection.categories, selectedAuthor: selection.selectedAuthor };
  } finally { console.info(JSON.stringify(searchObservationEvent(observation))); }
}

async function loadPublicSearchSelection(state: EditorialQuery, locale: Locale, observation: ReturnType<typeof newSearchObservation>): Promise<PublicSearchSelection> {
  // One total selection deadline, not a fresh allowance for every continuation.
  // Timeout/errors stay unavailable; never cache a truncated successful result.
  const signal = AbortSignal.timeout(5000);
  const rpcArgs = { ...editorialRpcArgs({ ...state, pageSize: 128, page: 1 }),
    p_author_id: state.author ? Number(state.author) : null,
    p_languages: state.languages.length ? state.languages : locale === 'en' ? ['en'] : ['nl', 'en'] };
  const readPage = async (page: number): Promise<SearchIdPage> => {
    observation.databaseRequests++;
    const { data, error } = await supabase.rpc('catalog_discovery_page', { ...rpcArgs, p_page: page }).abortSignal(signal);
    if (error) throw error; // Never silently ignore filters or convert failure to zero results.
    observation.candidateIdsLoaded += (data as SearchIdPage).workIds.length;
    return data as SearchIdPage;
  };
  observation.databaseRequests += 1 + (state.author ? 1 : 0); // categories + optional public author label
  const [matching, categories, selectedAuthor] = await Promise.all([
    loadMatchingIdentities(state, locale, readPage, signal, observation), loadPublicCategories(signal),
    state.author ? supabase.from('authors').select('id,name').eq('id', state.author).abortSignal(signal).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
  ]);
  return { ...matching, categories, selectedAuthor };
}

async function loadMatchingIdentities(state: EditorialQuery, locale: Locale, readPage: (page: number) => Promise<SearchIdPage>, signal: AbortSignal, observation: ReturnType<typeof newSearchObservation>) {
  // Filter options/author labels must not block ID continuation or identities.
  const ids = await collectSearchIds(await readPage(1), readPage);
  const titleAliases: { workId: string; title: string }[] = [];
  // Up to 400 Works per window, two parallel batches of up to 200 Works'
  // complete editions; only minimal public identity for MATCHING Works.
  // Complete edition rows avoid truncating nested relations. No N+1, ratings,
  // external cover requests or descriptions for off-page matches.
  const identities = await readSearchIdentityBatches<Book>(ids, async batch => {
    observation.databaseRequests++;
    const [result, editionBatches] = await Promise.all([
      supabase.from('works').select(IDENTITY_SELECT).in('id', batch).order('id').abortSignal(signal),
      Promise.all([batch.slice(0, 200), batch.slice(200)].filter(ids => ids.length).map(ids =>
        loadEditionRows(supabase, ids, signal, rows => { observation.databaseRequests++; observation.editionsLoaded += rows; }))),
    ]);
    const editions = editionBatches.flat();
    if (result.error) throw result.error;
    if (!Array.isArray(result.data) || result.data.length !== batch.length) throw new Error('Search identities changed; retry.');
    observation.worksLoaded += result.data.length;
    const byWork = new Map<string, typeof editions>();
    for (const e of editions) {
      const key = String(e.work_id);
      const rows = byWork.get(key) ?? []; rows.push(e); byWork.set(key, rows);
      if (e.title) titleAliases.push({ workId: key, title: e.title });
    }
    for (const row of result.data) titleAliases.push({ workId: String(row.id), title: row.title });
    return mapCatalogWorks(result.data.map(row => ({ ...row, editions: byWork.get(String(row.id)) ?? [] })), locale);
  });
  const byId = new Map(identities.map(book => [book.workId, book]));
  const candidates = ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const { aliasesByWorkId } = collectCatalogSearchAliases(state.query, titleAliases);
  return { books: candidates, aliases: aliasesByWorkId };
}
