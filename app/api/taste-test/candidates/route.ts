import {resolveRequestLocale} from '@/lib/i18n/server';
import {withEditionCoverEvidence} from '@/lib/books/edition-cover-evidence';
import { NextResponse } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { loadRecommendationCatalog } from '@/lib/supabase/recommendation-catalog';
import { mapCatalogWorks } from '@/lib/supabase/books';
import { loadTasteEligibility, loadStrictRecommendationBooks, loadOwnOfferHistory } from '@/lib/supabase/taste-safety';
import { loadReaderRows } from '@/lib/supabase/reader-rows';
import { readTasteRoundState } from '@/lib/supabase/taste-round-storage';
import { classifyTasteExclusion } from '@/lib/taste-test/eligibility';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
/** Owner-only search. It never mutates an offer, rating, status or round. */
export async function GET(request: Request) {
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json({ error: 'Sign in.' }, 401);
    const saved = await readTasteRoundState(client);
    const round = saved.round;
    if (!round || round.complete) return json({ results: [] });
    const language = round.language;
    const {locale}=await resolveRequestLocale(request);
    const [catalog, history, ratings, statuses] = await Promise.all([
      loadRecommendationCatalog(client, rows=>mapCatalogWorks(rows,locale)), loadOwnOfferHistory(client, user.id),
      loadReaderRows<{work_id:number|string}>(client, 'ratings', 'work_id', user.id),
      loadReaderRows<{work_id:number|string;status:string}>(client, 'user_book_status', 'work_id,status', user.id),
    ]);
    const ids = catalog.candidates.flatMap(c => c.book.workId ? [c.book.workId] : []);
    const checks = await loadTasteEligibility(client, ids, language);
    const ratedOrRead = new Set([...ratings.map(r => String(r.work_id)), ...statuses.filter(s => s.status === 'read').map(s => String(s.work_id))]);
    // Earlier skips remain excluded until the atomic v3 storage confirms explicit
    // opt-in. Never simulate revisit by deleting history or changing a decision.
    const revisit = saved.storageVersion === 3 && saved.revisitEarlierSkips === true;
    const eligible = catalog.candidates.filter(c => {
      const id = c.book.workId; if (!id) return false;
      const exclusion = classifyTasteExclusion(id, round.id, ratedOrRead, history, checks.get(id)?.eligible === true);
      return exclusion === null || (revisit && exclusion === 'skipped-earlier');
    }).map(c => c.book);
    const books = await loadStrictRecommendationBooks(client, eligible, locale);
    const query = new URL(request.url).searchParams.get('q')?.slice(0, 100).trim().toLocaleLowerCase(language) ?? '';
    const results = query.length < 2 ? [] : books.filter(b => `${b.title} ${b.author}`.toLocaleLowerCase(language).includes(query))
      .sort((a, b) => Number(a.workId) - Number(b.workId)).slice(0, 20);
    return json({ results:await withEditionCoverEvidence(results), language, eligibleCount: books.length, earlierSkipsCanBeReoffered: revisit });
  } catch { return json({ error: 'Search unavailable.' }, 503); }
}
