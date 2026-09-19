import { NextResponse, type NextRequest } from 'next/server';
import {
  getSafeNextPath,
  isSameOriginRequest,
  PRIVATE_RESPONSE_HEADERS,
} from '@/lib/auth/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return new NextResponse('Forbidden.', {
      status: 403,
      headers: PRIVATE_RESPONSE_HEADERS,
    });
  }

  const formData = await request.formData();
  const next = getSafeNextPath(formData.get('next'));
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(next, request.url), {
    status: 303,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}
