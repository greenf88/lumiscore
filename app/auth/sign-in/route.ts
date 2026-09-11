import { NextResponse, type NextRequest } from 'next/server';
import {
  getSafeNextPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = getSafeNextPath(formData.get('next'));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  const destination = error
    ? `/login?error=invalid_credentials&next=${encodeURIComponent(next)}`
    : next;

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
