import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';
import {
  canonicalizeRatedStatuses,
  executeStatusMutation,
  planGuestWantToReadMigration,
  reconcileRatedStatuses,
  type CanonicalStatusState,
  type StatusMutationAdapter,
} from '../collections/status-mutations.ts';
import { isReadingStatus, type ReadingStatus } from '../collections/model.ts';
import type { MyBooksItem } from '../collections/my-books.ts';
import { getVerifiedServerUser } from './auth.ts';
import { loadCatalogBooksByIds } from './books.ts';

type StatusRow = { work_id: number | string; status: string };
type RatingRow = { work_id: number | string; rating?: number | string | null };
type MyBooksStatusRow = StatusRow & { updated_at: string | null };
const MAX_STATUS_LOOKUP_WORK_IDS = 128;

export type MyBooksPageData = {
  authenticated: boolean;
  available: boolean;
  items: MyBooksItem[];
};

export type GuestStatusMigrationResult = {
  statuses: Map<string, ReadingStatus>;
  ratedWorksPreserved: number;
};

export const loadReadWorkIdsForCurrentUser = cache(async (): Promise<{
  authenticated: boolean;
  workIds: string[];
}> => {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, workIds: [] };
  const { data, error } = await client.from('user_book_status').select('work_id')
    .eq('user_id', user.id).eq('status', 'read');
  if (error) throw error;
  return { authenticated: true, workIds: (data ?? []).map((row) => String(row.work_id)) };
});

function normalizeWorkIds(workIds: readonly string[]): number[] {
  return [...new Set(workIds.map(Number).filter(
    (workId) => Number.isSafeInteger(workId) && workId > 0,
  ))].slice(0, MAX_STATUS_LOOKUP_WORK_IDS);
}

async function loadStatusState(
  client: SupabaseClient,
  userId: string,
  ids: readonly number[],
): Promise<CanonicalStatusState> {
  let statusesQuery = client.from('user_book_status').select('work_id,status')
    .eq('user_id', userId);
  let ratingsQuery = client.from('ratings').select('work_id,rating')
    .eq('user_id', userId);
  if (ids.length > 0) {
    statusesQuery = statusesQuery.in('work_id', ids);
    ratingsQuery = ratingsQuery.in('work_id', ids);
  }
  const [statusesResult, ratingsResult] = await Promise.all([statusesQuery, ratingsQuery]);
  if (statusesResult.error) throw statusesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const statuses = new Map(((statusesResult.data ?? []) as StatusRow[]).flatMap((row) =>
    isReadingStatus(row.status) ? [[String(row.work_id), row.status] as const] : []));
  const ratedWorkIds = new Set(((ratingsResult.data ?? []) as RatingRow[])
    .map((row) => String(row.work_id)));
  return { statuses, ratedWorkIds };
}

function createStatusMutationAdapter(
  client: SupabaseClient,
  userId: string,
  ids: readonly number[],
): StatusMutationAdapter {
  return {
    loadState: () => loadStatusState(client, userId, ids),
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
    deleteStatuses: async (workIds) => {
      const { error } = await client.from('user_book_status').delete()
        .eq('user_id', userId).in('work_id', workIds.map(Number));
      if (error) throw error;
    },
  };
}

export async function loadUserBookStatuses(
  workIds: readonly string[] = [],
): Promise<{
  authenticated: boolean;
  statuses: Map<string, ReadingStatus>;
  ratedWorkIds: Set<string>;
}> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, statuses: new Map(), ratedWorkIds: new Set() };
  const state = canonicalizeRatedStatuses(
    await loadStatusState(client, user.id, normalizeWorkIds(workIds)),
  );
  return { authenticated: true, ...state };
}

export async function saveUserBookStatus(
  workId: string,
  status: ReadingStatus,
): Promise<ReadingStatus | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  const result = await executeStatusMutation(
    { workIds: [workId], action: 'set', status },
    createStatusMutationAdapter(client, user.id, [Number(workId)]),
  );
  return result.statuses.get(workId) ?? null;
}

export async function deleteUserBookStatus(workId: string): Promise<boolean | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  await executeStatusMutation(
    { workIds: [workId], action: 'clear', status: null },
    createStatusMutationAdapter(client, user.id, [Number(workId)]),
  );
  return true;
}

export async function migrateGuestWantToRead(
  workIds: readonly string[],
): Promise<GuestStatusMigrationResult | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  const ids = normalizeWorkIds(workIds);
  if (ids.length === 0) return { statuses: new Map(), ratedWorksPreserved: 0 };

  const { data: existingWorks, error: worksError } = await client.from('works')
    .select('id').in('id', ids);
  if (worksError) throw worksError;
  const validIds = new Set((existingWorks ?? []).map((row) => Number(row.id)));
  const catalogIds = ids.filter((workId) => validIds.has(workId));
  if (catalogIds.length === 0) return { statuses: new Map(), ratedWorksPreserved: 0 };

  const adapter = createStatusMutationAdapter(client, user.id, catalogIds);
  const before = await adapter.loadState();
  const plan = planGuestWantToReadMigration(catalogIds.map(String), before);
  const { rows } = plan;
  if (rows.length > 0) await adapter.upsertStatuses(rows);
  const reconciled = rows.length > 0
    ? await reconcileRatedStatuses(adapter)
    : { state: canonicalizeRatedStatuses(before), repaired: 0 };
  return {
    statuses: reconciled.state.statuses,
    ratedWorksPreserved: plan.ratedWorksPreserved,
  };
}

export async function loadMyBooksPageData(): Promise<MyBooksPageData> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, available: true, items: [] };

  const { data, error } = await client.from('user_book_status')
    .select('work_id,status,updated_at').eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as MyBooksStatusRow[]).filter(
    (row): row is MyBooksStatusRow & { status: ReadingStatus } => isReadingStatus(row.status),
  );
  const books = await loadCatalogBooksByIds(rows.map((row) => String(row.work_id)));
  const booksByWorkId = new Map(books.flatMap((book) =>
    book.workId ? [[book.workId, book] as const] : [],
  ));
  return {
    authenticated: true,
    available: true,
    items: rows.flatMap((row) => {
      const book = booksByWorkId.get(String(row.work_id));
      return book ? [{ book, status: row.status, updatedAt: row.updated_at }] : [];
    }),
  };
}
