import { NextResponse, type NextRequest } from 'next/server';
import {
  getSafeNextPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { normalizeDisplayName } from '@/lib/auth/display-name';
import { isValidNewAccountPassword } from '@/lib/auth/credentials';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', { status: 403 });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = normalizeDisplayName(formData.get('displayName'));
  const next = getSafeNextPath(formData.get('next'));
  if (!displayName.ok || !isValidNewAccountPassword(password)) {
    return NextResponse.redirect(
      new URL(`/login?error=invalid_signup_details&next=${encodeURIComponent(next)}`, request.url),
      { status: 303, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
  const callback = new URL('/auth/callback', request.url);
  callback.searchParams.set('next', next);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callback.toString(),
      data: { display_name: displayName.value },
    },
  });

  let destination = next;
  if (error) {
    destination = `/login?error=signup_failed&next=${encodeURIComponent(next)}`;
  } else if (!data.session) {
    destination = `/login?message=check_email&next=${encodeURIComponent(next)}`;
  }

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
