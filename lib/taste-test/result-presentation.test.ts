import test from 'node:test';
import assert from 'node:assert/strict';
import { topSupportedAffinities, shouldOpenCompletedResult } from './result-presentation.ts';
import { buildRatingResultProfile } from './rating-result.ts';
import { buildEffectiveWorkTraitVector, evidenceRowsForTraits } from '../recommendations/work-trait-evidence.ts';
import type { RatingRoundState } from './rating-round.ts';

const evidence = new Map(Array.from({length: 30}, (_, i) => [String(i + 1),
  buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId: String(i + 1),
    traits: {thriller_mystery: 1, dark: .8, fast_paced: .7, contemporary: .6}, confidence: 1,
    source: 'manual', sourceKey: 'synthetic', rawLabels: [], verifiedAt: '2026-10-07'}))]));
test('presentation preserves scores and calculation; at most three supported positive preferences', () => {
  const profile = buildRatingResultProfile(Array.from({length: 10}, (_, i) => ({workId: String(i + 1), rating: 10})), evidence);
  const before = JSON.stringify(profile);
  const preferences = topSupportedAffinities(profile);
  assert.equal(profile.archetype, 'sleuth');
  assert.equal(preferences.length, 3);
  assert.ok(preferences.every(x => profile.affinities.includes(x) && x.score! >= 60));
  assert.deepEqual(preferences.map(x => x.score), [...preferences.map(x => x.score)].sort((a, b) => b! - a!));
  assert.equal(JSON.stringify(profile), before);
});
test('missing, sparse, neutral and negative evidence never becomes invented preferences or types', () => {
  for (const [count, score, traits] of [[2, 10, evidence], [10, 1, evidence], [10, 5, evidence], [10, 10, new Map()]] as const) {
    const profile = buildRatingResultProfile(Array.from({length: count}, (_, i) => ({workId: String(i + 1), rating: score})), traits);
    assert.equal(profile.archetype, null);
    assert.deepEqual(topSupportedAffinities(profile), []);
  }
});
const state = (count: number, goal: number, complete = false): RatingRoundState => ({
  round: {id: 'same-round', number: 1, language: 'nl', goal, ratedCount: count, offeredCount: count + 1, complete},
  currentWorkId: complete ? null : '10', exhausted: false,
});
test('only the successful final rating of the same round opens result (10/15/30 and legacy20)', () => {
  for (const goal of [10, 15, 20, 30]) {
    const before = state(goal - 1, goal);
    const next = {authenticated: true, available: true, state: state(goal, goal, true)};
    assert.equal(shouldOpenCompletedResult('rate', before, next), true);
    for (const action of ['skip', 'choose', 'start', 'resume', 'extend'] as const) assert.equal(shouldOpenCompletedResult(action, before, next), false);
    assert.equal(shouldOpenCompletedResult('rate', state(goal, goal, true), next), false);
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, authenticated: false}), false);
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, available: false}), false);
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, state: null}), false);
    const changed = state(goal, goal, true); changed.round!.id = 'other-round';
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, state: changed}), false);
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, state: state(goal - 1, goal, true)}), false);
    assert.equal(shouldOpenCompletedResult('rate', before, {...next, state: state(goal, goal, false)}), false);
  }
});
