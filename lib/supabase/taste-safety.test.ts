import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadOwnOfferHistory, loadStrictRecommendationBooks } from './taste-safety.ts';
import type { Book } from '../../app/data/books.ts';

function client(rows: Record<string, unknown>[], fail = false) {
  const calls: { table: string; owner: string | null; offset: number; order: string[] }[] = [];
  return { calls, db: { from(table: string) {
    let owner: string | null = null;
    const order: string[] = [];
    const chain = { select: () => chain, order: (key: string) => { order.push(key); return chain; }, in: () => chain,
      eq: (key: string, value: string) => { assert.equal(key, 'user_id'); owner = value; return chain; },
      range: async (offset: number, end: number) => { calls.push({ table, owner, offset, order }); return { data: rows.slice(offset, end + 1), error: fail ? new Error('fixture failed') : null }; } };
    return chain;
  } } as unknown as SupabaseClient };
}
test('offer history is owner scoped on every page; >1000 historical entries cannot disappear', async () => {
  const x = client(Array.from({ length: 1201 }, (_, i) => ({ work_id: i + 1, round_id: 'fixture-round', decision: 'skipped' })));
  const rows = await loadOwnOfferHistory(x.db, 'synthetic-owner');
  assert.equal(rows.length, 1201); assert.equal(rows[1200].workId, '1201');
  assert.deepEqual(x.calls.map(c => c.offset), [0, 1000]); assert.ok(x.calls.every(c => c.owner === 'synthetic-owner'));
  await assert.rejects(() => loadOwnOfferHistory(client([], true).db, 'synthetic-owner'));
});
test('round-scoped history with repeated Works is fully paged with a deterministic composite order', async () => {
  const x = client(Array.from({ length: 2001 }, (_, i) => ({ work_id: 1, round_id: `fixture-round-${i}`, decision: 'skipped' })));
  const rows = await loadOwnOfferHistory(x.db, 'synthetic-owner');
  assert.equal(rows.length, 2001); assert.equal(new Set(rows.map(r => r.roundId)).size, 2001);
  assert.deepEqual(x.calls.map(c => c.offset), [0, 1000, 2000]);
  assert.ok(x.calls.every(c => c.order.join(',') === 'work_id,round_id' && c.owner === 'synthetic-owner'));
});
test('edition pagination does not miss the matching edition beyond the first REST page', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({ id: i + 1, work_id: 1, language: i === 1000 ? 'nld' : 'fra', title: 'Fixture', isbn_13: null, open_library_edition_id: null }));
  const x = client(rows), book: Book = { id: '1', workId: '1', source: 'supabase', title: 'Fixture', author: 'Fixture', score: null, match: null, ratingsCount: null, cover: 'orbit' };
  const selected = await loadStrictRecommendationBooks(x.db, [book], 'nl', []);
  assert.equal(selected[0].editionId, '1001'); assert.deepEqual(x.calls.map(c => c.offset), [0, 1000]);
});
