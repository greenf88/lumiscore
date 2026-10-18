import { NextResponse, type NextRequest } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { isSameOriginRequest, PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { canRevisitEarlierSkips, parseRoundAction, type RatingRoundState } from '@/lib/taste-test/rating-round';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { readServerEnvironment } from '@/lib/server-environment';
import { isProductionBackedReview } from '@/lib/supabase/review-target';
import { loadTasteEligibility, loadStrictRecommendationBooks } from '@/lib/supabase/taste-safety';
import { readTasteRoundState } from '@/lib/supabase/taste-round-storage';
function reviewUsesProduction() {
  return isProductionBackedReview({ deploymentEnvironment: process.env.VERCEL_ENV, nodeEnvironment: process.env.NODE_ENV,
    supabaseUrl: readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') });
}
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
async function present(state: RatingRoundState, request: Request, client: Awaited<ReturnType<typeof getVerifiedServerUser>>['client']) {
  const { locale } = await resolveRequestLocale(request);
  const language = state.round?.language ?? locale;
  const { loadCatalogBooksByIdsWithStoredCovers } = await import('@/lib/supabase/books');
  const ids = state.currentWorkId ? [state.currentWorkId] : [];
  const [checks, books] = await Promise.all([
    loadTasteEligibility(client, ids, language), loadCatalogBooksByIdsWithStoredCovers(ids, undefined, locale),
  ]);
  const check = state.currentWorkId ? checks.get(state.currentWorkId) : undefined;
  const strict = check?.eligible ? await loadStrictRecommendationBooks(client, books, locale) : [];
  return { authenticated: true, available: true, state, book: strict[0] ?? null, language,
    selectionBlocked: Boolean(state.currentWorkId && !strict[0]), selectionReasons: check?.reasons ?? [] };
}
export async function GET(request: Request) {
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json({ authenticated: false, available: true, state: null, book: null });
    if (reviewUsesProduction()) return json({ authenticated: true, available: false, reason: 'separate-test-database-required' });
    const state = await readTasteRoundState(client);
    return json(await present(state, request, client));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST202')
      return json({ authenticated: true, available: false, reason: 'migration-required' });
    return json({ error: 'Taste round unavailable.' }, 503);
  }
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
    if (action.action === 'revisit' || ((action.action === 'rate' || action.action === 'choose') && action.workId)) {
      const state = await readTasteRoundState(client);
      if (action.action === 'revisit' && (!canRevisitEarlierSkips(state) || action.roundId !== state.round?.id))
        return json({ error: 'revisit-unavailable' }, 409);
      const language = state.round?.language ?? action.language;
      if (action.workId) {
        const checks = await loadTasteEligibility(client, [action.workId], language);
        if (!checks.get(action.workId)?.eligible) return json({ error: 'book-not-eligible' }, 409);
      }
    }
    const { data, error } = await client.rpc('taste_rating_advance_v2', {
      p_action: action.action, p_round_id: action.roundId ?? null, p_work_id: action.workId ? Number(action.workId) : null,
      p_score: action.score ?? null, p_language: action.language, p_goal: action.goal ?? 20,
    });
    if (error?.code === '23505') return json({ error: 'existing-rating-preserved' }, 409);
    if (error?.code === '22023') return json({ error: 'stale-or-invalid-action' }, 409);
    if (error?.code === 'PGRST202') return json({ error: 'migration-required' }, 503);
    if (error) throw error;
    return json(await present(data as RatingRoundState, request, client));
  } catch { return json({ error: 'Action could not be confirmed. Refresh to see saved progress.' }, 503); }
}
