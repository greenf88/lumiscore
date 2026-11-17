import { NextResponse, type NextRequest } from 'next/server';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { isLocale } from '@/lib/i18n/config';
import { parseGuestRatings, parseGuestExclusions } from '@/lib/taste-test/guest-rating-result';

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden' }, 403);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({ error: 'Invalid content type' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Missing body' }, 400);
  let text = '', bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return json({ error: 'Body too large' }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    const ratings = parseGuestRatings(body?.ratings), excluded = parseGuestExclusions(body?.excluded ?? []);
    if (!ratings || !excluded || !isLocale(body?.locale)) return json({ error: 'Ten distinct ratings are required' }, 400);
    try {
      const { loadGuestRatingResult } = await import('@/lib/supabase/guest-rating-result');
      return json(await loadGuestRatingResult(ratings, excluded, body.locale));
    } catch {
      console.warn('Guest rating recommendations unavailable');
      return json({ error: 'Recommendations unavailable' }, 503);
    }
  } catch { return json({ error: 'Invalid request' }, 400); }
}
