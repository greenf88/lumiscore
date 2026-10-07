import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRoundRequest } from './round-request.ts';
import type { RatingRoundState } from './rating-round.ts';
const state: RatingRoundState = { round: { id: '00000000-0000-4000-8000-000000000001', number: 1, language: 'nl', goal: 20, ratedCount: 3, offeredCount: 4, complete: false }, currentWorkId: '10134', exhausted: false };
test('new 10/15/30 rounds use the active site language', () => {
  for (const goal of [10,15,30]) for (const locale of ['en','nl'] as const)
    assert.deepEqual(buildRoundRequest('start', null, locale, goal), { action: 'start', language: locale, goal });
});
test('resume, skip, choose and rate retain a legacy round and its saved language', () => {
  const before = structuredClone(state);
  for (const action of ['resume','skip','choose','rate'] as const) {
    const request = buildRoundRequest(action, state, 'en', 30, action === 'resume' ? undefined : '10134', action === 'rate' ? 8 : undefined);
    assert.equal(request.language, 'nl'); assert.equal(request.roundId, state.round?.id);
    assert.equal(request.goal, undefined); assert.equal(request.score, action === 'rate' ? 8 : undefined);
  }
  assert.deepEqual(state, before);
});
test('rating needs an explicit score; skip cannot silently rate', () => {
  assert.throws(() => buildRoundRequest('rate', state, 'en', 10, '10134'));
  assert.throws(() => buildRoundRequest('skip', state, 'en', 10, '10134', 8));
  assert.throws(() => buildRoundRequest('resume', null, 'en', 10));
  assert.throws(() => buildRoundRequest('start', null, 'en', 20));
});
