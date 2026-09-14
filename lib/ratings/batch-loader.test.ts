import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPublicRatingSummaries, loadPublicRatingSummariesBatched } from '../supabase/public-rating-summaries.ts';

test('loads every displayed work through one aggregate RPC call', async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    async rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return {
        data: [
          { work_id: 8, lumiscore: '8.0', rating_count: '1' },
          { work_id: 1265, lumiscore: null, rating_count: '0' },
        ],
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const summaries = await loadPublicRatingSummaries(client, ['8', '1265', '8']);

  assert.deepEqual(calls, [
    {
      name: 'get_work_rating_summaries',
      args: { target_work_ids: [8, 1265] },
    },
  ]);
  assert.deepEqual(summaries.get('8'), { lumiscore: 8, ratingCount: 1 });
  assert.deepEqual(summaries.get('1265'), { lumiscore: null, ratingCount: 0 });
});

test('loads a recommendation catalog in bounded batches instead of per-card queries', async () => {
  const calls: number[][] = [];
  const client = {
    rpc: async (_name: string, args: { target_work_ids: number[] }) => {
      calls.push(args.target_work_ids);
      return {
        data: args.target_work_ids.map((workId) => ({
          work_id: workId,
          lumiscore: null,
          rating_count: 0,
        })),
        error: null,
      };
    },
  } as never;
  const ids = Array.from({ length: 205 }, (_, index) => String(index + 1));

  const summaries = await loadPublicRatingSummariesBatched(client, ids);

  assert.deepEqual(calls.map((batch) => batch.length), [100, 100, 5]);
  assert.equal(summaries.size, 205);
});

test('keeps cards unrated when the public aggregate is unavailable', async () => {
  const client = {
    async rpc() {
      return { data: null, error: new Error('not available') };
    },
  } as unknown as SupabaseClient;

  assert.equal((await loadPublicRatingSummaries(client, ['8'])).size, 0);
});
