import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  EMPTY_RATING_STATE,
  parseRating,
  type BookRatingState,
} from '../ratings/model.ts';
import { createServerSupabaseClient } from './server.ts';

type RatingSummaryRow = {
  lumiscore?: number | string | null;
  rating_count?: number | string | null;
};

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

async function loadPublicSummary(
  supabase: SupabaseClient,
  workId: string,
): Promise<Pick<BookRatingState, 'lumiscore' | 'ratingCount'>> {
  const { data, error } = await supabase
    .rpc('get_work_rating_summary', { target_work_id: Number(workId) })
    .maybeSingle<RatingSummaryRow>();

  if (error || !data) return { lumiscore: null, ratingCount: 0 };

  return {
    lumiscore: asFiniteNumber(data.lumiscore),
    ratingCount: asFiniteNumber(data.rating_count) ?? 0,
  };
}

async function getVerifiedUser(supabase: SupabaseClient): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function loadBookRatingState(workId: string): Promise<BookRatingState> {
  try {
    const supabase = await createServerSupabaseClient();
    const [summary, user] = await Promise.all([
      loadPublicSummary(supabase, workId),
      getVerifiedUser(supabase),
    ]);

    if (!user) return { ...EMPTY_RATING_STATE, ...summary };

    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('work_id', workId)
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      authenticated: true,
      userEmail: user.email ?? null,
      userRating: error ? null : parseRating(data?.rating),
      ...summary,
    };
  } catch {
    return EMPTY_RATING_STATE;
  }
}

export async function saveBookRating(
  workId: string,
  rating: number,
): Promise<BookRatingState | null> {
  const parsedRating = parseRating(rating);
  if (parsedRating === null) throw new Error('INVALID_RATING');

  const supabase = await createServerSupabaseClient();
  const user = await getVerifiedUser(supabase);
  if (!user) return null;

  const { error } = await supabase.from('ratings').upsert(
    {
      user_id: user.id,
      work_id: Number(workId),
      rating: parsedRating,
    },
    { onConflict: 'user_id,work_id' },
  );
  if (error) throw error;

  return {
    authenticated: true,
    userEmail: user.email ?? null,
    userRating: parsedRating,
    ...(await loadPublicSummary(supabase, workId)),
  };
}

export async function deleteBookRating(
  workId: string,
): Promise<BookRatingState | null> {
  const supabase = await createServerSupabaseClient();
  const user = await getVerifiedUser(supabase);
  if (!user) return null;

  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('work_id', workId)
    .eq('user_id', user.id);
  if (error) throw error;

  return {
    authenticated: true,
    userEmail: user.email ?? null,
    userRating: null,
    ...(await loadPublicSummary(supabase, workId)),
  };
}
