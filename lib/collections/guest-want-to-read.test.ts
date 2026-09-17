import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUEST_WANTED_STORAGE_KEY,
  getGuestWantedWorkIds,
  getGuestWantedStorageId,
  normalizeGuestWantedIds,
  parseGuestWantedIds,
  toggleGuestWantedId,
} from './guest-want-to-read.ts';

test('guest persistence keeps the existing storage key', () => {
  assert.equal(GUEST_WANTED_STORAGE_KEY, 'lumiscore-wanted');
});

test('real catalog books persist with a canonical work identifier', () => {
  assert.equal(getGuestWantedStorageId({ id: 'different-client-id', workId: '1300' }), 'work-1300');
});

test('stored guest identifiers survive refresh normalization and old numeric values migrate', () => {
  const stored = JSON.stringify(['work-8', '8', 'work-1300', 'work-0008', '', 1265]);
  const restored = parseGuestWantedIds(stored);
  assert.deepEqual(restored, ['work-8', 'work-1300', 'work-1265']);
});

test('only valid canonical catalog Work IDs are selected for guest catalog loading', () => {
  const restored = normalizeGuestWantedIds([
    '8',
    'work-8',
    'work-1300',
    'stale-demo-book',
    'work-0',
    'work-999999999999999999999999',
  ]);
  assert.deepEqual(restored, ['work-8', 'work-1300', 'stale-demo-book']);
  assert.deepEqual(getGuestWantedWorkIds(restored), ['8', '1300']);
  assert.deepEqual(parseGuestWantedIds('{broken-json'), []);
});

test('toggle creates a new stable set without mutating restored state', () => {
  const restored = new Set(['work-8']);
  const added = toggleGuestWantedId(restored, 'work-1300');
  const removed = toggleGuestWantedId(added, 'work-8');
  assert.deepEqual([...restored], ['work-8']);
  assert.deepEqual([...added], ['work-8', 'work-1300']);
  assert.deepEqual([...removed], ['work-1300']);
});
