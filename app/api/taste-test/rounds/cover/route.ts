import { NextResponse } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { parseCoverAnchor, buildTasteCoverHint } from '@/lib/taste-test/cover-preload';
import { isProductionBackedReview } from '@/lib/supabase/review-target';
import { readServerEnvironment } from '@/lib/server-environment';

export const dynamic = 'force-dynamic';
const json = (cover: unknown = null, status = 200) => NextResponse.json({ cover }, { status, headers: PRIVATE_RESPONSE_HEADERS });
export async function GET(request: Request) {
  const anchor = parseCoverAnchor(new URL(request.url).searchParams);
  if (!anchor) return json(null, 400);
  try {
    const { client, user } = await getVerifiedServerUser();
    if (!user) return json();
    if (isProductionBackedReview({ deploymentEnvironment: process.env.VERCEL_ENV, nodeEnvironment: process.env.NODE_ENV,
      supabaseUrl: readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL') })) return json();
    // Stable GET RPC: cannot reserve/offer a Work or advance a round.
    const { data, error } = await client.rpc('taste_rating_cover_lookahead', {
      p_round_id: anchor.roundId, p_work_id: Number(anchor.fromWorkId),
    }, { get: true }).abortSignal(AbortSignal.timeout(1500));
    if (error || !data || data.roundId !== anchor.roundId || data.fromWorkId !== anchor.fromWorkId
      || !['nl', 'en'].includes(data.locale) || !/^[1-9]\d*$/.test(data.workId ?? '')) return json();
    const { loadCatalogBooksByIdsWithStoredCovers } = await import('@/lib/supabase/books');
    const books = await loadCatalogBooksByIdsWithStoredCovers([data.workId], undefined, anchor.locale);
    return json(buildTasteCoverHint(books.find(b => b.workId === data.workId), anchor));
  } catch { return json(); } // Optional optimization, never turn a successful save into an error.
}
