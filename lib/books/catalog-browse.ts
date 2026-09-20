export const CATALOG_BROWSE_PAGE_SIZES = [32, 64, 128] as const;
export type CatalogBrowsePageSize = (typeof CATALOG_BROWSE_PAGE_SIZES)[number];
export const CATALOG_BROWSE_PAGE_SIZE: CatalogBrowsePageSize = 32;

export const CATALOG_BROWSE_SORTS = ['az', 'newest'] as const;
export type CatalogBrowseSort = (typeof CATALOG_BROWSE_SORTS)[number];

export type CatalogBrowseOrder = {
  column: 'title' | 'first_publish_year' | 'id';
  ascending: boolean;
  nullsFirst?: boolean;
};

export function normalizeCatalogBrowsePage(value: unknown): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = typeof candidate === 'string' && /^\d+$/.test(candidate)
    ? Number(candidate)
    : typeof candidate === 'number'
      ? candidate
      : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function normalizeCatalogBrowsePageSize(value: unknown): CatalogBrowsePageSize {
  const candidate = Array.isArray(value) ? value[0] : value;
  const pageSize = typeof candidate === 'string' && /^\d+$/.test(candidate)
    ? Number(candidate)
    : typeof candidate === 'number'
      ? candidate
      : CATALOG_BROWSE_PAGE_SIZE;
  return CATALOG_BROWSE_PAGE_SIZES.includes(pageSize as CatalogBrowsePageSize)
    ? pageSize as CatalogBrowsePageSize
    : CATALOG_BROWSE_PAGE_SIZE;
}

export function getCatalogBrowsePageAfterPageSizeChange(
  currentPage: number,
  currentPageSize: CatalogBrowsePageSize,
  nextPageSize: CatalogBrowsePageSize,
  total?: number,
): number {
  const firstItemIndex = (normalizeCatalogBrowsePage(currentPage) - 1) * currentPageSize;
  const requestedPage = Math.floor(firstItemIndex / nextPageSize) + 1;
  return typeof total === 'number'
    ? clampCatalogBrowsePage(requestedPage, total, nextPageSize)
    : requestedPage;
}

export function normalizeCatalogBrowseSort(value: unknown): CatalogBrowseSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  return CATALOG_BROWSE_SORTS.includes(candidate as CatalogBrowseSort)
    ? candidate as CatalogBrowseSort
    : 'az';
}

export function getCatalogBrowseOrder(sort: CatalogBrowseSort): CatalogBrowseOrder[] {
  return sort === 'newest'
    ? [
        { column: 'first_publish_year', ascending: false, nullsFirst: false },
        { column: 'title', ascending: true },
        { column: 'id', ascending: true },
      ]
    : [
        { column: 'title', ascending: true },
        { column: 'id', ascending: true },
      ];
}

export function getCatalogBrowsePageCount(
  total: number,
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
): number {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  return Math.max(1, Math.ceil(safeTotal / safePageSize));
}

export function clampCatalogBrowsePage(
  page: number,
  total: number,
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
): number {
  return Math.min(
    normalizeCatalogBrowsePage(page),
    getCatalogBrowsePageCount(total, pageSize),
  );
}

export function getCatalogBrowseRange(
  page: number,
  pageSize = CATALOG_BROWSE_PAGE_SIZE,
): { from: number; to: number } {
  const safePage = normalizeCatalogBrowsePage(page);
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const from = (safePage - 1) * safePageSize;
  return { from, to: from + safePageSize - 1 };
}

export function getCatalogBrowseHref(
  page: number,
  sort: CatalogBrowseSort,
  pageSize: CatalogBrowsePageSize = CATALOG_BROWSE_PAGE_SIZE,
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (pageSize !== CATALOG_BROWSE_PAGE_SIZE) params.set('pageSize', String(pageSize));
  if (sort !== 'az') params.set('sort', sort);
  const query = params.toString();
  return query ? `/browse?${query}` : '/browse';
}
