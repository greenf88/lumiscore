import { NextResponse, type NextRequest } from 'next/server';
import { languageRoute, LOCALE_REQUEST_HEADER, PATH_REQUEST_HEADER } from './lib/i18n/paths';
import { refreshSupabaseSession } from '@/lib/supabase/proxy';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';

export async function proxy(request: NextRequest) {
  const decision = languageRoute(request.nextUrl.pathname);
  if (decision.kind === 'redirect') {
    const target = request.nextUrl.clone();
    target.pathname = decision.path;
    // Recovery keeps cached permanent destinations live without adding new
    // permanent redirect cache entries. Never redirect locale URLs to legacy.
    const redirect = NextResponse.redirect(target, 307);
    redirect.headers.set('Cache-Control', 'no-store');
    return redirect;
  }
  // Retain the existing session refresh and refreshed request cookies.
  const session = await refreshSupabaseSession(request);
  const requestHeaders = new Headers(request.headers);
  // Never accept a caller-supplied language/path header as authority.
  requestHeaders.delete(LOCALE_REQUEST_HEADER);
  requestHeaders.delete(PATH_REQUEST_HEADER);
  let response;
  if (decision.kind === 'pass') response = NextResponse.next({ request: { headers: requestHeaders } });
  else {
    const target = request.nextUrl.clone();
    target.pathname = decision.path;
    requestHeaders.set(LOCALE_REQUEST_HEADER, decision.locale);
    requestHeaders.set(PATH_REQUEST_HEADER, request.nextUrl.pathname + request.nextUrl.search);
    response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  }
  for (const cookie of session.cookies.getAll()) response.cookies.set(cookie);
  for (const [name, value] of session.headers) {
    if (!name.startsWith('x-middleware-') && name !== 'set-cookie') response.headers.set(name, value);
  }
  const path = decision.kind === 'rewrite' ? decision.path : request.nextUrl.pathname;
  if (['/login', '/forgot-password', '/update-password'].includes(path) || path.startsWith('/auth/')) {
    for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/catalog/(?:books|search)|api/open-library/covers|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2|css|js)$).*)'],
};
