import model from './categories.json' with { type: 'json' };
import { normalizeCatalogBrowsePage, normalizeCatalogBrowsePageSize, normalizeCatalogBrowseSort } from '../books/catalog-browse.ts';
import { normalizeCatalogSearchQuery, collectCatalogSearchAliases } from '../books/catalog-search.ts';
export const editorialCategories = model.categories;
export const selectionSlug = 'lumiscore-selectie-1000';
export type CatalogParams = Record<string, string | string[] | undefined>;
const values = (value: string | string[] | undefined) => value === undefined ? [] : Array.isArray(value) ? value : [value];
export function editorialQuery(params: CatalogParams) {
  // Public category labels and existence come from the database, not research files.
  const categories = [...new Set(values(params.category))].filter(id => /^[a-z][a-z0-9_]{1,59}$/.test(id) && id !== 'unknown').slice(0, 32);
  const languages = [...new Set(values(params.language))].filter(id => id === 'nl' || id === 'en');
  const query = normalizeCatalogSearchQuery(values(params.q)[0] ?? '');
  const rawAuthor = values(params.author)[0] ?? '';
  const author = /^\d+$/.test(rawAuthor) && Number.isSafeInteger(Number(rawAuthor)) && Number(rawAuthor) > 0 ? String(Number(rawAuthor)) : '';
  return {
    query, categories, languages, author,
    selection: values(params.selection)[0] === selectionSlug ? selectionSlug : '',
    page: normalizeCatalogBrowsePage(params.page),
    pageSize: normalizeCatalogBrowsePageSize(params.pageSize),
    sort: normalizeCatalogBrowseSort(params.sort),
  };
}
export type EditorialQuery = ReturnType<typeof editorialQuery>;
export function editorialRpcArgs(state: EditorialQuery) {
  return {
    p_query: state.query, p_categories: state.categories, p_languages: state.languages,
    p_selection: state.selection, p_page: Math.min(state.page, 2147483647),
    p_page_size: state.pageSize, p_sort: state.sort,
    p_alias_ids: collectCatalogSearchAliases(state.query, []).workIds.map(Number),
  };
}
export function editorialHref(route: '/browse' | '/search', state: EditorialQuery) {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.author) params.set('author', state.author);
  if (state.page > 1) params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  if (state.sort !== 'az') params.set('sort', state.sort);
  for (const id of state.categories) params.append('category', id);
  for (const id of state.languages) params.append('language', id);
  if (state.selection) params.set('selection', state.selection);
  return route + '?' + params.toString();
}
