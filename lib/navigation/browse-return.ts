import {
  CATALOG_BROWSE_PAGE_SIZES,
  CATALOG_BROWSE_SORTS,
  type CatalogBrowsePageSize,
  type CatalogBrowseSort,
} from '../books/catalog-browse.ts';

const BROWSE_PATH = '/browse';
const SINGLE_VALUE_KEYS = new Set(['page', 'pageSize', 'sort']);
const REPEATABLE_KEYS = new Set(['language', 'genre', 'filter']);
const SUPPORTED_KEYS = new Set([...SINGLE_VALUE_KEYS, ...REPEATABLE_KEYS]);
const SAFE_FILTER_VALUE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_REPEATABLE_VALUES = 12;

export type CatalogBrowseNavigationState = {
  page: number;
  pageSize: CatalogBrowsePageSize;
  sort: CatalogBrowseSort;
};

function isSafePositiveInteger(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0;
}

function isSafeRepeatableValue(key: string, value: string): boolean {
  if (key === 'language') return value === 'en' || value === 'nl';
  return value.length > 0 && value.length <= 60 && SAFE_FILTER_VALUE.test(value);
}

function parseBrowseReturnPath(value: unknown): URLSearchParams | null {
  if (typeof value !== 'string' || value.length > 2_048) return null;
  if (
    value.includes('\\') ||
    value.includes('#') ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    /%(?:00|23|2f|3a|5c)/iu.test(value)
  ) {
    return null;
  }
  if (value !== BROWSE_PATH && !value.startsWith(`${BROWSE_PATH}?`)) return null;

  const query = value === BROWSE_PATH ? '' : value.slice(BROWSE_PATH.length + 1);
  const params = new URLSearchParams(query);
  let repeatableCount = 0;

  for (const key of new Set(params.keys())) {
    if (!SUPPORTED_KEYS.has(key)) return null;
    const values = params.getAll(key);
    if (SINGLE_VALUE_KEYS.has(key) && values.length !== 1) return null;
    if (REPEATABLE_KEYS.has(key)) {
      repeatableCount += values.length;
      if (values.some((entry) => !isSafeRepeatableValue(key, entry))) return null;
    }
  }
  if (repeatableCount > MAX_REPEATABLE_VALUES) return null;

  const page = params.get('page');
  if (page !== null && !isSafePositiveInteger(page)) return null;

  const pageSize = params.get('pageSize');
  if (
    pageSize !== null &&
    !CATALOG_BROWSE_PAGE_SIZES.includes(Number(pageSize) as CatalogBrowsePageSize)
  ) {
    return null;
  }

  const sort = params.get('sort');
  if (sort !== null && !CATALOG_BROWSE_SORTS.includes(sort as CatalogBrowseSort)) {
    return null;
  }

  return params;
}

function canonicalizeBrowseParams(params: URLSearchParams): string {
  const canonical = new URLSearchParams();
  const page = params.get('page');
  const pageSize = params.get('pageSize');
  const sort = params.get('sort');

  if (page && page !== '1') canonical.set('page', page);
  if (pageSize) canonical.set('pageSize', pageSize);
  if (sort && sort !== 'az') canonical.set('sort', sort);

  for (const key of ['language', 'genre', 'filter']) {
    for (const value of params.getAll(key)) canonical.append(key, value);
  }

  const query = canonical.toString();
  return query ? `${BROWSE_PATH}?${query}` : BROWSE_PATH;
}

export function getSafeBrowseReturnPath(value: unknown): string | null {
  const params = parseBrowseReturnPath(value);
  return params ? canonicalizeBrowseParams(params) : null;
}

export function updateBrowseReturnPath(
  currentPath: unknown,
  next: Partial<CatalogBrowseNavigationState>,
): string {
  const safePath = getSafeBrowseReturnPath(currentPath) ?? BROWSE_PATH;
  const params = new URLSearchParams(safePath.split('?')[1] ?? '');

  if (next.page !== undefined) params.set('page', String(next.page));
  if (next.pageSize !== undefined) params.set('pageSize', String(next.pageSize));
  if (next.sort !== undefined) params.set('sort', next.sort);

  return canonicalizeBrowseParams(params);
}

export function browsePathFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(searchParams)) {
    const values = Array.isArray(rawValue) ? rawValue : rawValue === undefined ? [] : [rawValue];
    for (const value of values) params.append(key, value);
  }
  const query = params.toString();
  return getSafeBrowseReturnPath(query ? `${BROWSE_PATH}?${query}` : BROWSE_PATH);
}
