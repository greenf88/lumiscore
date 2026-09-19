import type { NextRequest } from 'next/server';
import { refreshSupabaseSession } from '@/lib/supabase/proxy';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';

export async function proxy(request: NextRequest) {
  const response = await refreshSupabaseSession(request);
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/forgot-password' ||
    request.nextUrl.pathname === '/update-password' ||
    request.nextUrl.pathname.startsWith('/auth/')
  ) {
    for (const [name, value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) {
      response.headers.set(name, value);
    }
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/catalog/(?:books|search)|api/open-library/covers|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
