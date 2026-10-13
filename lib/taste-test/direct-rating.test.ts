import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenRoundResult, createRoundActionGate, roundProgress } from './direct-rating.ts';
import { buildRoundRequest } from './round-request.ts';
import { shouldOpenCompletedResult } from './result-presentation.ts';
import type { RatingRoundState } from './rating-round.ts';
import { translate } from '../i18n/translations.ts';

const state = (ratedCount = 0, goal = 10): RatingRoundState => ({
  round: { id: 'dddddddd-0000-4000-8000-000000000001', number: 1, language: 'nl', goal, complete: ratedCount === goal, ratedCount, offeredCount: ratedCount + 1 },
  currentWorkId: '100', exhausted: false,
});
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

for (const goal of [10, 15, 30]) test(`one start action immediately sends the selected goal ${goal}, in either language`, async () => {
  for (const locale of ['en', 'nl'] as const) {
    const writes: unknown[] = [], gate = createRoundActionGate(async () => {});
    await gate.run(async () => { writes.push(buildRoundRequest('start', null, locale, goal)); return state(0, goal); }, () => {}, assert.fail, () => {});
    assert.deepEqual(writes, [{ action: 'start', language: locale, goal }]);
  }
});

test('double click, pause/search/refresh races and second tap after book swap cannot write while gate is held', async () => {
  const network = deferred<RatingRoundState>(), cooldown = deferred<void>();
  let writes = 0, accepts = 0, current = state(), duration = 0;
  const pending: boolean[] = [];
  const gate = createRoundActionGate(ms => { duration = ms; return cooldown.promise; });
  const run = () => gate.run(async () => { writes++; return network.promise; }, next => { current = next; accepts++; }, assert.fail, value => pending.push(value));
  const first = run();
  assert.equal(gate.isBusy(), true);
  for (let i = 0; i < 5; i++) assert.equal(await run(), false);
  assert.equal(writes, 1); assert.equal(current.round?.ratedCount, 0);
  network.resolve(state(1)); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(current.round?.ratedCount, 1); assert.equal(accepts, 1);
  assert.equal(await run(), false, 'next book cannot be rated by the second tap');
  assert.equal(duration, 500); assert.equal(writes, 1);
  cooldown.resolve(); assert.equal(await first, true);
  assert.deepEqual(pending, [true, false]); assert.equal(gate.isBusy(), false);
});

test('failed storage keeps current book/progress; no retry until an explicit new attempt', async () => {
  let writes = 0, failures = 0, current = state();
  const gate = createRoundActionGate(async () => {});
  const before = structuredClone(current);
  assert.equal(await gate.run(async () => { writes++; throw new Error('synthetic storage failure'); }, next => { current = next; }, () => { failures++; }, () => {}), false);
  assert.deepEqual(current, before); assert.equal(writes, 1); assert.equal(failures, 1); assert.equal(gate.isBusy(), false);
  await gate.run(async () => { writes++; return state(1); }, next => { current = next; }, assert.fail, () => {});
  assert.equal(writes, 2); assert.equal(current.round?.ratedCount, 1);
});

test('skip and search selection carry no score; resume preserves legacy length, round, language and progress', () => {
  const original = state(4, 20), before = structuredClone(original);
  for (const action of ['skip', 'choose', 'resume'] as const) {
    const request = buildRoundRequest(action, original, 'en', 30, action === 'resume' ? undefined : '101');
    assert.equal(request.score, undefined); assert.equal(request.goal, undefined); assert.equal(request.roundId, original.round?.id); assert.equal(request.language, 'nl');
  }
  assert.deepEqual(original, before);
});

test('progress counts ratings only; exhaustion and zero-rating completion never invent a result', () => {
  assert.equal(canOpenRoundResult(null), false);
  for (const count of [0, 1, 9]) {
    const s = state(count); s.exhausted = true;
    assert.equal(canOpenRoundResult(s), false);
  }
  const s = state(3, 15); s.round!.offeredCount = 12;
  assert.deepEqual(roundProgress(s), { rated: 3, goal: 15, percent: 20 });
  assert.equal(canOpenRoundResult(state(10, 15)), true);
  assert.deepEqual(roundProgress(state(4, 20)), { rated: 4, goal: 20, percent: 20 });
});

test('only the successful final rating opens the existing result flow, never skip or a replay', () => {
  const before = state(9), next = { authenticated: true, available: true, state: state(10) };
  assert.equal(shouldOpenCompletedResult('rate', before, next), true);
  assert.equal(shouldOpenCompletedResult('skip', before, next), false);
  assert.equal(shouldOpenCompletedResult('rate', next.state, next), false);
  assert.equal(shouldOpenCompletedResult('rate', before, { ...next, available: false }), false);
});

test('new accessible names and progress are translated without interpolation leaks', () => {
  for (const locale of ['nl', 'en'] as const) {
    assert.ok(translate(locale, 'directTaste.startChoice', { count: 15 }).includes('15'));
    assert.ok(translate(locale, 'directTaste.rate', { score: 8 }).includes('8'));
    assert.doesNotMatch(translate(locale, 'directTaste.progress', { rated: 3, goal: 10 }), /[{}]/);
  }
});
