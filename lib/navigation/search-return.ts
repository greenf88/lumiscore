import { getSafeNextPath } from '../auth/request.ts';

export type SearchParamValues = Record<
  string,
  string | string[] | undefined
>;

export function serializeSearchReturnPath(params: SearchParamValues): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else if (typeof value === 'string') {
      search.append(key, value);
    }
  }

  const query = search.toString();
  return query ? `/search?${query}` : '/search';
}

export function getSafeSearchReturnPath(value: unknown): string | null {
  const safePath = getSafeNextPath(
    typeof value === 'string' ? value : null,
    '',
  );
  if (!safePath) return null;

  const parsed = new URL(safePath, 'https://lumisco.re');
  if (parsed.pathname !== '/search' || parsed.hash) return null;

  return `${parsed.pathname}${parsed.search}`;
}

export function appendSearchReturnContext(
  bookHref: string,
  requestedReturnTo: string | null | undefined,
): string {
  const returnTo = getSafeSearchReturnPath(requestedReturnTo);
  if (!returnTo) return bookHref;

  const separator = bookHref.includes('?') ? '&' : '?';
  return `${bookHref}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
