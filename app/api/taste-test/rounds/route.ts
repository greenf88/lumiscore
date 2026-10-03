import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { parseRoundAction, type RatingRoundState } from '@/lib/taste-test/rating-round';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { readServerEnvironment } from '@/lib/server-environment';
import { isProductionBackedReview } from '@/lib/supabase/review-target';
function reviewUsesProduction() {
  return isProductionBackedReview({ deploymentEnvironment: process.env.VERCEL_ENV, nodeEnvironment: process.env.NODE_ENV,
    supabaseUrl: readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') });
}
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
async function present(state: RatingRoundState) {
  const { locale } = await resolveRequestLocale();
  const { loadCatalogBooksByIdsWithStoredCovers } = await import('@/lib/supabase/books');
  const books = state.currentWorkId ? await loadCatalogBooksByIdsWithStoredCovers([state.currentWorkId], undefined, locale) : [];
  return { authenticated: true, available: true, state, book: books[0] ?? null };
}
export async function GET() {
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json({ authenticated: false, available: true, state: null, book: null });
    if (reviewUsesProduction()) return json({ authenticated: true, available: false, reason: 'separate-test-database-required' });
    const { data, error } = await client.rpc('taste_rating_state');
    if (error?.code === 'PGRST202') return json({ authenticated: true, available: false, reason: 'migration-required' });
    if (error) throw error;
    return json(await present(data as RatingRoundState));
  } catch { return json({ error: 'Taste round unavailable.' }, 503); }
}
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: 'Forbidden.' }, 403);
  let action;
  try { const text = await request.text(); if (text.length > 1024) return json({ error: 'Invalid action.' }, 400); action = parseRoundAction(JSON.parse(text)); }
  catch { return json({ error: 'Invalid action.' }, 400); }
  if (!action) return json({ error: 'Invalid action.' }, 400);
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json({ error: 'Sign in to save explicit ratings.' }, 401);
    if (reviewUsesProduction()) return json({ error: 'separate-test-database-required' }, 503);
    const { data, error } = await client.rpc('taste_rating_advance', {
      p_action: action.action, p_round_id: action.roundId ?? null, p_work_id: action.workId ? Number(action.workId) : null,
      p_score: action.score ?? null, p_language: action.language,
    });
    if (error?.code === '23505') return json({ error: 'existing-rating-preserved' }, 409);
    if (error?.code === '22023') return json({ error: 'stale-or-invalid-action' }, 409);
    if (error?.code === 'PGRST202') return json({ error: 'migration-required' }, 503);
    if (error) throw error;
    return json(await present(data as RatingRoundState));
  } catch { return json({ error: 'Action could not be confirmed. Refresh to see saved progress.' }, 503); }
}
