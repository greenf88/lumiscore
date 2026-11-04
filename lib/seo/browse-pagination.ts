import type { CatalogParams, EditorialQuery } from '../catalog/editorial-query.ts';

/** Only the normal, unfiltered 16-card/highest-score series. Never promote
 * arbitrary query/filter variants into indexable URLs after normalizing them. */
export function publicBrowsePage(params: CatalogParams): number | null {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.some(([key, value]) => !['page', 'pageSize', 'sort'].includes(key) || typeof value !== 'string')) return null;
  if (params.pageSize !== undefined && params.pageSize !== '16') return null;
  if (params.sort !== undefined && params.sort !== 'highest') return null;
  if (params.page === undefined) return 1;
  if (typeof params.page !== 'string' || !/^[1-9]\d*$/.test(params.page)) return null;
  const page = Number(params.page);
  return Number.isSafeInteger(page) && page <= 2147483647 ? page : null;
}

export function browsePagePath(page: number): string {
  return page === 1 ? '/browse' : `/browse?page=${page}`;
}

/** Keep every active filter and non-default order/size in the established path.
 * Only default unfiltered Browse links use the compact canonical series. */
export function publicBrowseHref(state: EditorialQuery, fallback: string): string {
  return !state.query && !state.author && !state.selection && !state.categories.length
    && !state.languages.length && state.pageSize === 16 && state.sort === 'highest'
    ? browsePagePath(state.page) : fallback;
}
