import type { CollaborativeSignal } from '../recommendations/collaborative.ts';
import type { createServerSupabaseClient } from './server.ts';

type CollaborativeSignalRow = {
  work_id: number | string;
  collaborative_score: number | string;
  collaborative_weight: number | string;
};

export async function loadCollaborativeRecommendationSignals(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<ReadonlyMap<string, CollaborativeSignal>> {
  try {
    const { data, error } = await client.rpc(
      'get_collaborative_recommendation_signals',
      { candidate_limit: 100 },
    );
    if (error || !Array.isArray(data)) return new Map();

    return new Map((data as CollaborativeSignalRow[]).flatMap((row) => {
      const score = Number(row.collaborative_score);
      const weight = Number(row.collaborative_weight);
      if (
        !Number.isFinite(score) || score <= .5 || score > 1 ||
        !Number.isFinite(weight) || weight <= 0 || weight > .15
      ) return [];
      return [[String(row.work_id), { score, weight }] as const];
    }));
  } catch {
    return new Map();
  }
}
