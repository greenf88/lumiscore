import test from 'node:test';
import assert from 'node:assert/strict';
import { readRoundPause, writeRoundPause } from './round-pause.ts';

test('resume is a round-scoped presentation choice, only after an explicit pause', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
  assert.equal(readRoundPause(storage, 'round-a'), false);
  writeRoundPause(storage, 'round-a', true);
  assert.equal(readRoundPause(storage, 'round-a'), true);
  assert.equal(readRoundPause(storage, 'round-b'), false);
  // A fresh component reads the same paused state after refresh.
  assert.equal(readRoundPause({ ...storage }, 'round-a'), true);
  writeRoundPause(storage, 'round-a', false);
  assert.equal(readRoundPause(storage, 'round-a'), false);
  assert.equal(values.size, 0);
});

test('blocked optional storage never prevents pausing/resuming in memory', () => {
  const fail = () => { throw new Error('Storage blocked'); };
  const storage = { getItem: fail, setItem: fail, removeItem: fail };
  assert.equal(readRoundPause(storage, 'round-a'), false);
  assert.doesNotThrow(() => writeRoundPause(storage, 'round-a', true));
  assert.doesNotThrow(() => writeRoundPause(storage, 'round-a', false));
});
