import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchSelectionCache, searchSelectionKey, readSearchIdentityBatches, type PublicSearchSelection } from './search-selection-cache.ts';
import { searchQuery, type EditorialQuery } from './editorial-query.ts';

const selection = (count = 1): PublicSearchSelection => ({ books: Array.from({ length: count }, (_, i) => ({
  id: String(i), workId: String(i), title: 'Dune', author: 'Author', cover: 'orbit', source: 'supabase', score: null, ratingsCount: null, match: null,
})), aliases: new Map(), categories: [], selectedAuthor: null });

test('selection key separates locale, every filter and DB sort, but shares page/size', () => {
  const state = searchQuery({ q: 'Dune' }), key = searchSelectionKey(state, 'en');
  assert.equal(searchSelectionKey({ ...state, page: 2, pageSize: 64 }, 'en'), key);
  assert.notEqual(searchSelectionKey(state, 'nl'), key);
  const patches: Partial<EditorialQuery>[] = [{ query: 'Duin' }, { author: '2' }, { categories: ['fiction_fantasy'] },
    { languages: ['nl'] }, { selection: 'selected' }, { sort: 'highest' }];
  for (const patch of patches) {
    assert.notEqual(searchSelectionKey({ ...state, ...patch }, 'en'), key);
  }
});

test('public identity selection coalesces, expires at15s; live page scores never enter it', async () => {
  let now = 0, reads = 0;
  const cached = createSearchSelectionCache(() => now), source = selection();
  const read = async () => { reads++; return source; };
  const first = await Promise.all([cached('q', read), cached('q', read)]);
  assert.equal(reads, 1); assert.equal(first[0], first[1]);
  assert.equal(await cached('q', read), source); assert.equal(reads, 1);
  now = 15000; await cached('q', read); assert.equal(reads, 2);
  await assert.rejects(() => cached('unsafe', async () => ({ ...selection(), books: [{ ...source.books[0], match: 99 }] })), /cannot contain/);
  await assert.rejects(() => cached('unsafe', async () => ({ ...selection(), books: [{ ...source.books[0], score: 8 }] })), /cannot contain/);
});

test('failed reads are not cached/retried; capacity bounds entries and total public Works', async () => {
  const cached = createSearchSelectionCache(); let reads = 0;
  await assert.rejects(() => cached('error', async () => { reads++; throw Error('database unavailable'); }));
  assert.equal(reads, 1); await cached('error', async () => { reads++; return selection(); }); assert.equal(reads, 2);
  for (let i = 0; i < 9; i++) await cached('key' + i, async () => selection());
  await cached('key0', async () => { reads++; return selection(); }); assert.equal(reads, 3);
  await cached('large1', async () => selection(3000)); await cached('large2', async () => selection(3000));
  await cached('large1', async () => { reads++; return selection(); }); assert.equal(reads, 4);
  for (let i = 0; i < 2; i++) await cached('oversize', async () => { reads++; return selection(5001); });
  assert.equal(reads, 6);
});

test('identity batches overlap only two200-ID batches and retain deterministic input order', async () => {
  let active = 0, peak = 0;
  const result = await readSearchIdentityBatches(Array.from({ length: 850 }, (_, i) => String(i)), async ids => {
    active++; peak = Math.max(peak, active); assert.ok(ids.length <= 200);
    await Promise.resolve(); active--; return ids;
  });
  assert.equal(peak, 2); assert.equal(result.length, 850); assert.equal(result[849], '849');
  await assert.rejects(() => readSearchIdentityBatches(['1'], async () => { throw Error('failed batch'); }), /failed batch/);
});
