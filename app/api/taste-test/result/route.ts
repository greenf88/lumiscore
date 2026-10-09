import { NextResponse } from 'next/server';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { loadRatingResult } from '@/lib/supabase/rating-result';
export async function GET(request: Request) {
  try {
    const {locale} = await resolveRequestLocale(request);
    return NextResponse.json(await loadRatingResult(locale), {headers:PRIVATE_RESPONSE_HEADERS});
  } catch {
    return NextResponse.json({kind:'error'}, {status:503,headers:PRIVATE_RESPONSE_HEADERS});
  }
}
