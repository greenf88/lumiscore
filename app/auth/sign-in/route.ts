import { NextResponse, type NextRequest } from 'next/server';
import {
  getSafeNextPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
  authDestination,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scheduleSignInMeasurement,requestAnalysisGrant } from '@/lib/product-metrics/server';
import { attemptSignIn } from '@/lib/auth/sign-in';

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
  const next = getSafeNextPath(formData.get('next'));

  const result = await attemptSignIn(async () => {
    const supabase = await createServerSupabaseClient();
    return supabase.auth.signInWithPassword({ email, password });
  });
  if (!result.error && result.session) scheduleSignInMeasurement(result.session.access_token, formData.get('productContext'),requestAnalysisGrant(request));
  if (result.error) console.warn('auth.signin_failed', { category: result.error });
  const destination = result.error
    ? `/login?error=${result.error}&next=${encodeURIComponent(next)}`
    : next;

  return NextResponse.redirect(new URL(authDestination(destination, next), request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
