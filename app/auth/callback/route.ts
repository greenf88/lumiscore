import { NextResponse, type NextRequest } from 'next/server';
import { getSafeNextPath, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = getSafeNextPath(request.nextUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url), {
        status: 303,
        headers: PRIVATE_RESPONSE_HEADERS,
      });
    }
  }

  return NextResponse.redirect(
    new URL(
      `/login?error=confirmation_failed&next=${encodeURIComponent(next)}`,
      request.url,
    ),
    { status: 303, headers: PRIVATE_RESPONSE_HEADERS },
  );
}
