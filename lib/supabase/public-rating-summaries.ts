import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeRatingWorkIds,
  ratingSummaryMap,
  type PublicRatingSummary,
  type PublicRatingSummaryRow,
} from '../ratings/card-summaries.ts';

export async function loadPublicRatingSummaries(
  supabase: SupabaseClient,
  workIds: readonly string[],
): Promise<Map<string, PublicRatingSummary>> {
  const targetWorkIds = normalizeRatingWorkIds(workIds);
  if (targetWorkIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc('get_work_rating_summaries', {
    target_work_ids: targetWorkIds,
  });
  if (error) return new Map();

  return ratingSummaryMap((data ?? []) as PublicRatingSummaryRow[]);
}
