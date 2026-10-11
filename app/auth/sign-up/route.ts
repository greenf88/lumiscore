import { NextResponse, type NextRequest } from 'next/server';
import { authDestination } from '@/lib/auth/request';
import {
  getSafeNextPath,
  getReadingPreferencesOnboardingPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { normalizeDisplayName } from '@/lib/auth/display-name';
import { isValidNewAccountPassword } from '@/lib/auth/credentials';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { attemptSignup } from '@/lib/auth/registration';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', {
      status: 403,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = normalizeDisplayName(formData.get('displayName'));
  const next = getSafeNextPath(formData.get('next'));
  const onboardingNext = getReadingPreferencesOnboardingPath(next);
  if (!displayName.ok || !isValidNewAccountPassword(password)) {
    return NextResponse.redirect(
      new URL(authDestination(`/login?error=invalid_signup_details&next=${encodeURIComponent(next)}`, next), request.url),
      { status: 303, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
  const callback = new URL('/auth/callback', request.url);
  callback.searchParams.set('next', onboardingNext);

  const result = await attemptSignup(async () => {
    const supabase = await createServerSupabaseClient();
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callback.toString(),
        data: { display_name: displayName.value },
      },
    });
  });

  let destination = onboardingNext;
  if (result.error) {
    // Safe operational category; never log Auth errors, form data or credentials.
    console.warn('auth.signup_failed', { category: result.error });
    destination = `/login?error=${result.error}&next=${encodeURIComponent(next)}`;
  } else if (!result.hasSession) {
    destination = `/login?message=check_email&next=${encodeURIComponent(onboardingNext)}`;
  }

  return NextResponse.redirect(new URL(authDestination(destination, next), request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
