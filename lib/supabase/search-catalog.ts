import type { Book } from '@/app/data/books';
import type { EditorialQuery } from '../catalog/editorial-query.ts';
import { editorialRpcArgs } from '../catalog/editorial-query.ts';
import { searchWindow } from '../catalog/search-window.ts';
import { createSearchSelectionCache, searchSelectionKey, type PublicSearchSelection } from '../catalog/search-selection-cache.ts';
import { mapCatalogWorks } from './books';
import { loadPublicCategories } from './categories';
import { supabase } from './client';
import { hydrateStoredPresentation } from './stored-presentation';
import { loadPublicRatingSummariesBatched } from './public-rating-summaries';
import { applyRatingSummaries } from '../ratings/card-summaries.ts';
import { deferEditionCoverEvidence } from '../books/edition-cover-evidence.ts';
import type { Locale } from '../i18n/config.ts';
import { unavailableEditorialPage, type EditorialPage } from './editorial-catalog';
import { measureServerOperation } from '../performance/server-timing.ts';
import { newSearchObservation, searchObservationEvent } from '../catalog/search-observation.ts';
import { readSearchProjection, validateProjectedPage } from '../catalog/search-projection.ts';
import { EDITION_PRESENTATION_SELECT } from './edition-rows.ts';

const IDENTITY_SELECT = 'id,title,first_publish_year,open_library_id,source_type,work_type,author_id,authors(id,name)';
const readSelection = createSearchSelectionCache();
const readVisibleIdentities = createSearchSelectionCache();

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
    observation.selectionSource = selection.projected ? 'projection' : 'legacy';
    observation.eligibleTotal = window.total; observation.shown = window.books.length;
    const page = selection.projected ? loadProjectedPage(window.books, locale, observation) : Promise.resolve(window.books);
    observation.databaseRequests += Math.ceil(window.books.length / 100);
    const scoresStarted = performance.now();
    const scoreRead = loadPublicRatingSummariesBatched(supabase, window.books.map(book => book.workId!)).then(value => {
      observation.scoresMs = performance.now() - scoresStarted; return value;
    });
    const [books, summaries] = await Promise.all([page.then(books=>hydrateStoredPresentation(books,locale,n=>{observation.databaseRequests+=n;})), scoreRead]);
    return { ...window, books: deferEditionCoverEvidence(applyRatingSummaries(books, summaries), (input, init) => {
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
    p_languages: state.languages.length ? state.languages : [locale] };
  // Versioned read-only projection is independently installed/reviewed. Preserve
  // the existing route where absent, NEVER treat other failures as empty/success.
  observation.databaseRequests += 2 + (state.author ? 1 : 0); // projection + categories + optional public author
  const { p_page: _page, p_page_size: _size, ...projectionArgs } = rpcArgs;
  void _page; void _size;
  const [projection, categories, selectedAuthor] = await Promise.all([
    supabase.rpc('catalog_search_selection_v2', { ...projectionArgs, p_locale: locale }).abortSignal(signal),
    loadPublicCategories(signal),
    state.author ? supabase.from('authors').select('id,name').eq('id', state.author).abortSignal(signal).maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data ? { id: String(data.id), name: String(data.name) } : null; }) : null,
  ]);
  if (projection.error) throw projection.error;
  const selected = readSearchProjection(projection.data, state.query);
  observation.selectionRowsLoaded += selected.books.length;
  return { ...selected, categories, selectedAuthor };
}

async function loadProjectedPage(keys: readonly Book[], locale: Locale, observation: ReturnType<typeof newSearchObservation>) {
  if (!keys.length) return [];
  // Same bounded15s PUBLIC-ONLY identity cache, keyed by locale and the exact
  // selected Work/edition/title/author keys, never user/session or score data.
  const key = JSON.stringify([locale, keys.map(b => [b.workId, b.editionId, b.title, b.author])]);
  const value = await readVisibleIdentities(key, async () => ({
    books: await hydrateProjectedPage(keys, locale, observation), aliases: new Map(), categories: [], selectedAuthor: null,
  }));
  return validateProjectedPage(keys, value.books);
}

async function hydrateProjectedPage(keys: readonly Book[], locale: Locale, observation: ReturnType<typeof newSearchObservation>) {
  const started = performance.now(); observation.databaseRequests++;
  const { data, error } = await supabase.from('works').select(IDENTITY_SELECT + ',editions!inner(' + EDITION_PRESENTATION_SELECT + ')')
    .in('id', keys.map(b => b.workId!)).in('editions.id', keys.map(b => b.editionId!)).order('id').abortSignal(AbortSignal.timeout(5000));
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Search page identity unavailable');
  observation.worksLoaded += data.length;
  observation.editionsLoaded += (data as unknown as { editions: unknown[] }[]).reduce((n, row) => {
    if (!Array.isArray(row.editions)) throw new Error('Search page editions unavailable');
    return n + row.editions.length;
  }, 0);
  observation.identityMs = performance.now() - started;
  return validateProjectedPage(keys, mapCatalogWorks(data, locale));
}
