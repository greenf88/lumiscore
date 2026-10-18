import test from 'node:test';
import assert from 'node:assert/strict';
import { readTasteRoundState } from './taste-round-storage.ts';
test('read-only v3 handshake exposes capabilities; only absent function falls back to legacy state', async () => {
  for (const legacy of [false, true]) {
    const calls: string[] = []; const state = { round: null, exhausted: false, currentWorkId: null, ...(legacy ? {} : { storageVersion: 3 }) };
    const result = await readTasteRoundState({ async rpc(name) {
      calls.push(name); return legacy && name.endsWith('_v3') ? { data: null, error: { code: 'PGRST202' } } : { data: state, error: null };
    } });
    assert.deepEqual(result, state);
    assert.deepEqual(calls, legacy ? ['taste_rating_state_v3', 'taste_rating_state'] : ['taste_rating_state_v3']);
  }
});
test('permission, transport and other SQL errors never silently downgrade storage guarantees', async () => {
  for (const code of ['42501', 'PGRST301', 'NETWORK', 'XX000']) {
    let calls = 0;
    await assert.rejects(() => readTasteRoundState({ async rpc() { calls++; return { data: null, error: { code } }; } }), e => (e as { code: string }).code === code);
    assert.equal(calls, 1);
  }
});
