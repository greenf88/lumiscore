import type { SupabaseClient } from '@supabase/supabase-js';

/** Fresh owner-only reads. Never share these rows in a public/module cache. */
export async function loadReaderRows<T>(
  client: SupabaseClient,
  table: 'ratings' | 'user_book_status',
  columns: string,
  userId: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select(columns)
      .eq('user_id', userId).order('work_id').range(offset, offset + 999);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Reader data is unavailable.');
    rows.push(...data as T[]);
    if (data.length < 1000) return rows;
  }
}
