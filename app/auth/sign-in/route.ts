import { NextResponse, type NextRequest } from 'next/server';
import {
  getSafeNextPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
  authDestination,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scheduleSignInMeasurement,requestAnalysisGrant } from '@/lib/product-metrics/server';

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

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) scheduleSignInMeasurement(data.session.access_token, formData.get('productContext'),requestAnalysisGrant(request));
  const errorCategory = error?.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'invalid_credentials';
  const destination = error
    ? `/login?error=${errorCategory}&next=${encodeURIComponent(next)}`
    : next;

  return NextResponse.redirect(new URL(authDestination(destination, next), request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
