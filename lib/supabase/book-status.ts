import {
  isReadingStatus,
  type ReadingStatus,
} from '../collections/model.ts';
import type { MyBooksItem } from '../collections/my-books.ts';
import { cache } from 'react';
import { getVerifiedServerUser } from './auth.ts';
import { loadCatalogBooksByIds } from './books.ts';

type StatusRow = { work_id: number | string; status: string };
type MyBooksStatusRow = StatusRow & { updated_at: string | null };

export type MyBooksPageData = {
  authenticated: boolean;
  available: boolean;
  items: MyBooksItem[];
};

export const loadReadWorkIdsForCurrentUser = cache(async (): Promise<{
  authenticated: boolean;
  workIds: string[];
}> => {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, workIds: [] };
  const { data, error } = await client
    .from('user_book_status')
    .select('work_id')
    .eq('user_id', user.id)
    .eq('status', 'read');
  if (error) throw error;
  return {
    authenticated: true,
    workIds: (data ?? []).map((row) => String(row.work_id)),
  };
});

function normalizeWorkIds(workIds: readonly string[]): number[] {
  return [...new Set(workIds.map(Number).filter(
    (workId) => Number.isSafeInteger(workId) && workId > 0,
  ))].slice(0, 100);
}

export async function loadUserBookStatuses(
  workIds: readonly string[] = [],
): Promise<{
  authenticated: boolean;
  statuses: Map<string, ReadingStatus>;
}> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, statuses: new Map() };

  const ids = normalizeWorkIds(workIds);
  let query = client
    .from('user_book_status')
    .select('work_id,status')
    .eq('user_id', user.id);
  if (ids.length > 0) query = query.in('work_id', ids);
  const { data, error } = await query;
  if (error) throw error;

  return {
    authenticated: true,
    statuses: new Map(((data ?? []) as StatusRow[]).flatMap((row) =>
      isReadingStatus(row.status)
        ? [[String(row.work_id), row.status] as const]
        : [])),
  };
}

export async function saveUserBookStatus(
  workId: string,
  status: ReadingStatus,
): Promise<ReadingStatus | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;

  const { error } = await client.from('user_book_status').upsert({
    user_id: user.id,
    work_id: Number(workId),
    status,
  }, { onConflict: 'user_id,work_id' });
  if (error) throw error;
  return status;
}

export async function deleteUserBookStatus(workId: string): Promise<boolean | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  const { error } = await client
    .from('user_book_status')
    .delete()
    .eq('user_id', user.id)
    .eq('work_id', Number(workId));
  if (error) throw error;
  return true;
}

export async function migrateGuestWantToRead(
  workIds: readonly string[],
): Promise<Map<string, ReadingStatus> | null> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return null;
  const ids = normalizeWorkIds(workIds);
  if (ids.length === 0) return new Map();

  const { data: existing, error: readError } = await client
    .from('user_book_status')
    .select('work_id,status')
    .eq('user_id', user.id)
    .in('work_id', ids);
  if (readError) throw readError;
  const existingIds = new Set((existing ?? []).map((row) => Number(row.work_id)));
  const missing = ids.filter((workId) => !existingIds.has(workId));
  if (missing.length > 0) {
    const { error } = await client.from('user_book_status').insert(
      missing.map((workId) => ({
        user_id: user.id,
        work_id: workId,
        status: 'want_to_read' as const,
      })),
    );
    if (error) throw error;
  }

  return (await loadUserBookStatuses(ids.map(String))).statuses;
}

export async function loadMyBooksPageData(): Promise<MyBooksPageData> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return { authenticated: false, available: true, items: [] };

  const { data, error } = await client
    .from('user_book_status')
    .select('work_id,status,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as MyBooksStatusRow[]).filter(
    (row): row is MyBooksStatusRow & { status: ReadingStatus } =>
      isReadingStatus(row.status),
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
