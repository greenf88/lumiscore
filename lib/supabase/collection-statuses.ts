import type { SupabaseClient } from '@supabase/supabase-js';
import {
  executeStatusMutation,
  type BulkStatusPayload,
  type CanonicalStatusState,
  type StatusMutationAdapter,
  type StatusMutationResult,
} from '../collections/status-mutations.ts';
import { isReadingStatus, type ReadingStatus } from '../collections/model.ts';
import { getVerifiedServerUser } from './auth.ts';

type StatusRow = { work_id: number | string; status: string };
type RatingRow = { work_id: number | string; rating: number | string };

export class CollectionNotFoundError extends Error {
  constructor() {
    super('COLLECTION_NOT_FOUND');
    this.name = 'CollectionNotFoundError';
  }
}

export class CollectionMembershipError extends Error {
  readonly invalidWorkIds: string[];

  constructor(invalidWorkIds: readonly string[]) {
    super('COLLECTION_MEMBERSHIP_INVALID');
    this.name = 'CollectionMembershipError';
    this.invalidWorkIds = [...invalidWorkIds];
  }
}

async function loadState(
  client: SupabaseClient,
  userId: string,
  workIds: readonly string[],
): Promise<CanonicalStatusState> {
  const ids = workIds.map(Number);
  const [statusesResult, ratingsResult] = await Promise.all([
    client.from('user_book_status').select('work_id,status')
      .eq('user_id', userId).in('work_id', ids),
    client.from('ratings').select('work_id,rating')
      .eq('user_id', userId).in('work_id', ids),
  ]);
  if (statusesResult.error) throw statusesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  return {
    statuses: new Map(((statusesResult.data ?? []) as StatusRow[]).flatMap((row) =>
      isReadingStatus(row.status) ? [[String(row.work_id), row.status] as const] : [])),
    ratedWorkIds: new Set(((ratingsResult.data ?? []) as RatingRow[])
      .map((row) => String(row.work_id))),
  };
}

function mutationAdapter(
  client: SupabaseClient,
  userId: string,
  workIds: readonly string[],
): StatusMutationAdapter {
  return {
    loadState: () => loadState(client, userId, workIds),
    upsertStatuses: async (rows) => {
      const { error } = await client.from('user_book_status').upsert(
        rows.map(({ workId, status }) => ({
          user_id: userId,
          work_id: Number(workId),
          status,
        })),
        { onConflict: 'user_id,work_id' },
      );
      if (error) throw error;
    },
    deleteStatuses: async (ids) => {
      const { error } = await client.from('user_book_status').delete()
        .eq('user_id', userId).in('work_id', ids.map(Number));
      if (error) throw error;
    },
  };
}

export async function updateCollectionStatuses(
  slug: string,
  payload: BulkStatusPayload,
): Promise<StatusMutationResult | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;

  const collectionResult = await client.from('collections').select('id')
    .eq('slug', slug).maybeSingle();
  if (collectionResult.error) throw collectionResult.error;
  if (!collectionResult.data) throw new CollectionNotFoundError();

  const membershipResult = await client.from('collection_books').select('work_id')
    .eq('collection_id', collectionResult.data.id)
    .in('work_id', payload.workIds.map(Number));
  if (membershipResult.error) throw membershipResult.error;
  const members = new Set((membershipResult.data ?? []).map((row) => String(row.work_id)));
  const invalidWorkIds = payload.workIds.filter((workId) => !members.has(workId));
  if (invalidWorkIds.length > 0) throw new CollectionMembershipError(invalidWorkIds);

  return executeStatusMutation(payload, mutationAdapter(
    client,
    user.id,
    payload.workIds,
  ));
}

export function serializeStatusResult(result: StatusMutationResult): {
  statuses: Record<string, ReadingStatus>;
  ratedWorkIds: string[];
  changed: number;
  repairedRatedStatuses: number;
} {
  return {
    statuses: Object.fromEntries(result.statuses),
    ratedWorkIds: [...result.ratedWorkIds],
    changed: result.changed,
    repairedRatedStatuses: result.repairedRatedStatuses,
  };
}
