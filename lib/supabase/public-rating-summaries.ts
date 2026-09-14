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

export async function loadPublicRatingSummariesBatched(
  supabase: SupabaseClient,
  workIds: readonly string[],
): Promise<Map<string, PublicRatingSummary>> {
  const normalized = [...new Set(
    workIds
      .map(Number)
      .filter((workId) => Number.isSafeInteger(workId) && workId > 0),
  )];
  const batches = Array.from(
    { length: Math.ceil(normalized.length / 100) },
    (_, index) => normalized.slice(index * 100, (index + 1) * 100),
  );
  const batchResults = await Promise.all(
    batches.map((batch) => loadPublicRatingSummaries(
      supabase,
      batch.map(String),
    )),
  );
  return new Map(batchResults.flatMap((summaries) => [...summaries.entries()]));
}
