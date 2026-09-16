import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGuestWantedStorageId,
  normalizeGuestWantedIds,
  toggleGuestWantedId,
} from './guest-want-to-read.ts';

test('real catalog books persist with a canonical work identifier', () => {
  assert.equal(getGuestWantedStorageId({ id: 'different-client-id', workId: '1300' }), 'work-1300');
});

test('stored guest identifiers survive refresh normalization and old numeric values migrate', () => {
  const stored = JSON.stringify(['work-8', '8', 'work-1300', '', 1265]);
  const restored = normalizeGuestWantedIds(JSON.parse(stored));
  assert.deepEqual(restored, ['work-8', 'work-1300']);
});

test('toggle creates a new stable set without mutating restored state', () => {
  const restored = new Set(['work-8']);
  const added = toggleGuestWantedId(restored, 'work-1300');
  const removed = toggleGuestWantedId(added, 'work-8');
  assert.deepEqual([...restored], ['work-8']);
  assert.deepEqual([...added], ['work-8', 'work-1300']);
  assert.deepEqual([...removed], ['work-1300']);
});
