import type { RatingRoundState } from '../taste-test/rating-round.ts';
/** Capability detection is read-only. No fallback on permission/network errors. */
export async function readTasteRoundState(client: {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}): Promise<RatingRoundState> {
  let response = await client.rpc('taste_rating_state_v3');
  if (response.error?.code === 'PGRST202') response = await client.rpc('taste_rating_state');
  if (response.error) throw response.error;
  return response.data as RatingRoundState;
}
