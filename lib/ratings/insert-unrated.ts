import type {SupabaseClient} from '@supabase/supabase-js';
import {parseRating} from './model.ts';

// Atomic existing unique constraint, no migration, no read-then-overwrite race.
export async function insertUnrated(client: Pick<SupabaseClient, 'from'>, userId: string, workId: string, score: number) {
  if (parseRating(score) === null) throw new Error('INVALID_RATING');
  const {data, error} = await client.from('ratings').upsert(
    {user_id: userId, work_id: Number(workId), rating: score},
    {onConflict: 'user_id,work_id', ignoreDuplicates: true},
  ).select('rating');
  if (error) throw error;
  const created = Boolean(data?.length);
  const existing = created ? {data: data?.[0], error: null} : await client.from('ratings')
    .select('rating').eq('user_id', userId).eq('work_id', workId).single();
  if (existing.error) throw existing.error;
  const rating = parseRating(existing.data?.rating);
  if (rating === null) throw new Error('RATING_NOT_CONFIRMED');
  return {rating, created};
}
