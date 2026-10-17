import { NextResponse } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { loadRecommendationCatalog } from '@/lib/supabase/recommendation-catalog';
import { mapCatalogWorks } from '@/lib/supabase/books';
import { loadTasteEligibility, loadStrictRecommendationBooks, loadOwnOfferHistory } from '@/lib/supabase/taste-safety';
import { loadReaderRows } from '@/lib/supabase/reader-rows';
import type { RatingRoundState } from '@/lib/taste-test/rating-round';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
/** Owner-only search. It never mutates an offer, rating, status or round. */
export async function GET(request: Request) {
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json({ error: 'Sign in.' }, 401);
    const saved = await client.rpc('taste_rating_state');
    if (saved.error) throw saved.error;
    const round = (saved.data as RatingRoundState).round;
    if (!round || round.complete) return json({ results: [] });
    const language = round.language;
    const [catalog, history, ratings] = await Promise.all([
      loadRecommendationCatalog(client, mapCatalogWorks), loadOwnOfferHistory(client, user.id),
      loadReaderRows<{work_id:number|string}>(client, 'ratings', 'work_id', user.id),
    ]);
    const ids = catalog.candidates.flatMap(c => c.book.workId ? [c.book.workId] : []);
    const checks = await loadTasteEligibility(client, ids, language);
    // The deployed RPC rejects every historical offer. Do not present choices it
    // cannot persist, or silently erase/skip historical entries to work around it.
    const excluded = new Set([...history.map(h => h.workId), ...ratings.map(r => String(r.work_id))]);
    const eligible = catalog.candidates.filter(c => c.book.workId && !excluded.has(c.book.workId) && checks.get(c.book.workId)?.eligible).map(c => c.book);
    const books = await loadStrictRecommendationBooks(client, eligible, language);
    const query = new URL(request.url).searchParams.get('q')?.slice(0, 100).trim().toLocaleLowerCase(language) ?? '';
    const results = query.length < 2 ? [] : books.filter(b => `${b.title} ${b.author}`.toLocaleLowerCase(language).includes(query))
      .sort((a, b) => Number(a.workId) - Number(b.workId)).slice(0, 20);
    return json({ results, language, eligibleCount: books.length, earlierSkipsCanBeReoffered: false });
  } catch { return json({ error: 'Search unavailable.' }, 503); }
}
