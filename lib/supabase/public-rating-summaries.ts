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

  try {
    const { data, error } = await supabase.rpc('get_work_rating_summaries_v2', {
      target_work_ids: targetWorkIds,
    });
    if (error || !Array.isArray(data)) return new Map();
    const rows = data as PublicRatingSummaryRow[];
    const summaries = ratingSummaryMap(rows);
    for (const row of rows) {
      const key = String(row.work_id);
      if (!targetWorkIds.includes(Number(row.work_id)) ||
        (row.evidence_status !== 'available' && row.evidence_status !== 'insufficient_evidence') ||
        (row.evidence_status === 'available' && summaries.get(key)?.lumiscore === null)) {
        summaries.delete(key);
      }
    }
    return summaries;
  } catch {
    // Missing entries mean unavailable, never zero/insufficient evidence.
    return new Map();
  }
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
