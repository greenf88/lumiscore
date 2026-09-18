import type { NextRequest } from 'next/server';

export function getSafeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = '/',
): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/u.test(value)
  ) {
    return fallback;
  }

  try {
    const origin = new URL('https://lumisco.re');
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin.origin || parsed.username || parsed.password) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export const PRIVATE_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
} as const;
