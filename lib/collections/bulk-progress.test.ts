import assert from 'node:assert/strict';
import test from 'node:test';
import type { CollectionBook } from './model.ts';
import { filterCollectionWorkIds } from './bulk-progress.ts';

const books = ['1', '2', '3', '4'].map((workId): CollectionBook => ({
  workId,
  sequenceNumber: Number(workId),
  publicationOrder: Number(workId),
  subgroup: null,
  book: {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title: `Book ${workId}`,
    author: 'Author',
    score: null,
    ratingsCount: 0,
    match: null,
    cover: 'default',
  },
}));

test('bulk filters are deterministic and keep rating separate from status', () => {
  const statuses = { '1': 'read', '2': 'reading', '3': 'dnf' } as const;
  const rated = new Set(['1', '4']);
  assert.deepEqual(filterCollectionWorkIds(books, statuses, rated, 'all'), ['1', '2', '3', '4']);
  assert.deepEqual(filterCollectionWorkIds(books, statuses, rated, 'unknown'), ['4']);
  assert.deepEqual(filterCollectionWorkIds(books, statuses, rated, 'read'), ['1']);
  assert.deepEqual(filterCollectionWorkIds(books, statuses, rated, 'rated'), ['1', '4']);
});
