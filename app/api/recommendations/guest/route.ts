import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { isLocale } from '@/lib/i18n/config';
import {
  getGuestTasteTestProgress,
  isCompleteGuestTasteTestAnswersPayload,
  normalizeGuestTasteTestAnswers,
} from '@/lib/taste-test/guest-storage';
import { loadGuestHomepagePersonalization } from '@/lib/supabase/taste-test';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const record = body as Record<string, unknown>;
  if (!isCompleteGuestTasteTestAnswersPayload(record.answers)) {
    return json({ error: 'Complete the Taste Test first.' }, 400);
  }
  const answers = normalizeGuestTasteTestAnswers(record.answers);
  if (!getGuestTasteTestProgress(answers).complete) {
    return json({ error: 'Invalid Taste Test answers.' }, 400);
  }
  const locale = isLocale(record.locale) ? record.locale : 'en';

  try {
    return json(await loadGuestHomepagePersonalization(answers, locale));
  } catch (error) {
    console.error('Guest recommendations temporarily unavailable.', error);
    return json({ error: 'Recommendations are temporarily unavailable.' }, 503);
  }
}
