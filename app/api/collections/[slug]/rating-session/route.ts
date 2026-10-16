import {NextResponse} from 'next/server';
import {PRIVATE_RESPONSE_HEADERS} from '@/lib/auth/request';
import {getVerifiedServerUser} from '@/lib/supabase/auth';
import {loadCollectionPageData} from '@/lib/supabase/collections';
import {QUICK_RATING_COLLECTION} from '@/lib/collections/quick-rating';

export async function GET(_request: Request, {params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: PRIVATE_RESPONSE_HEADERS});
  if (slug !== QUICK_RATING_COLLECTION) return json({error: 'Not found.'}, 404);
  try {
    const {user} = await getVerifiedServerUser();
    if (!user) return json({error: 'Sign in required.'}, 401);
    const data = await loadCollectionPageData(slug);
    return data ? json({data, userId: user.id}) : json({error: 'Not found.'}, 404);
  } catch {return json({error: 'Progress could not be checked.'}, 503);}
}
