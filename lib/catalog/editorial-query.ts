import model from './categories.json' with { type: 'json' };
import { normalizeCatalogBrowsePage, normalizeCatalogBrowsePageSize, normalizeCatalogBrowseSort } from '../books/catalog-browse.ts';
import { normalizeCatalogSearchQuery, collectCatalogSearchAliases } from '../books/catalog-search.ts';
export const editorialCategories = model.categories;
export const selectionSlug = 'lumiscore-selectie-1000';
export type CatalogParams = Record<string, string | string[] | undefined>;
const values = (value: string | string[] | undefined) => value === undefined ? [] : Array.isArray(value) ? value : [value];
export function editorialQuery(params: CatalogParams) {
  const categories = [...new Set(values(params.category))].filter(id => model.categories.some(c => c.id === id));
  const languages = [...new Set(values(params.language))].filter(id => id === 'nl' || id === 'en');
  const query = normalizeCatalogSearchQuery(values(params.q)[0] ?? '');
  return {
    query, categories, languages,
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
  if (state.query && route === '/search') params.set('q', state.query);
  if (state.page > 1) params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  if (state.sort !== 'az') params.set('sort', state.sort);
  for (const id of state.categories) params.append('category', id);
  for (const id of state.languages) params.append('language', id);
  if (state.selection) params.set('selection', state.selection);
  return route + '?' + params.toString();
}
