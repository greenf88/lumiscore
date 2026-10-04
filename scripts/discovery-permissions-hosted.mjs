// Existing synthetic test accounts only. No keys, target selection or user creation.
import assert from 'node:assert/strict';
import { verifyAnonymousTasteApi } from './discovery-permissions.mjs';
export async function verifyHostedTastePermissions({ anon, a, b, aId, bId }) {
  const ok = result => { assert.equal(result.error, null, 'Authenticated test API request failed'); return result.data; };
  const state = async client => ok(await client.rpc('taste_rating_state'));
  const ratings = async client => ok(await client.from('ratings').select('work_id,rating').order('work_id'));
  const act = async (client, action, current, work, score) => ok(await client.rpc('taste_rating_advance', {
    p_action: action, p_round_id: current?.round?.id ?? null, p_work_id: work ?? null,
    p_score: score ?? null, p_language: 'en',
  }));
  const anonymous = await verifyAnonymousTasteApi(anon);
  const beforeA = await ratings(a), beforeB = await ratings(b), stateA = await state(a);
  assert.ok(beforeA.length >= 60 && beforeB.length >= 1, 'Prior synthetic ratings must remain available');
  assert.equal(ok(await a.from('taste_rating_rounds').select('id').eq('user_id', bId)).length, 0);
  assert.equal(ok(await b.from('taste_rating_rounds').select('id').eq('user_id', aId)).length, 0);
  assert.equal(ok(await b.from('taste_rating_offers').select('work_id').eq('user_id', aId)).length, 0);
  assert.equal(ok(await a.from('taste_rating_offers').select('work_id').eq('user_id', bId)).length, 0);
  if (stateA.round) assert.ok((await b.rpc('taste_rating_advance', { p_action:'resume',p_round_id:stateA.round.id })).error);
  let current = await act(b, 'start');
  assert.ok(current.currentWorkId && Number(current.currentWorkId) >= 8800001 && Number(current.currentWorkId) <= 8800305,
    'Only synthetic candidate Works may be rated');
  const offered = current.currentWorkId, count = current.round.ratedCount;
  const afterRate = await act(b, 'rate', current, offered, 7);
  assert.equal(afterRate.round.ratedCount, count + 1);
  assert.deepEqual(await act(b, 'rate', current, offered, 7), afterRate, 'Retry must not write another rating');
  assert.deepEqual(await state(b), afterRate, 'Authenticated state restores persisted progress');
  assert.equal(ok(await b.from('ratings').select('rating').eq('work_id', offered))[0].rating, 7);
  current = afterRate;
  let skippedWithoutRating = false;
  if (current.currentWorkId) {
    const skipped = current.currentWorkId;
    current = await act(b, 'skip', current, skipped);
    assert.equal(current.round.ratedCount, count + 1);
    assert.equal(ok(await b.from('ratings').select('work_id').eq('work_id', skipped)).length, 0);
    skippedWithoutRating = true;
  }
  assert.deepEqual(await act(b, 'resume', current), current);
  assert.deepEqual(await state(a), stateA, 'Reader A progress must not change');
  assert.deepEqual(await ratings(a), beforeA, 'Reader A ratings must not change');
  const afterB = await ratings(b);
  for (const row of beforeB) assert.deepEqual(afterB.find(r => r.work_id === row.work_id), row, 'Existing B score changed');
  assert.equal(afterB.length, beforeB.length + 1);
  assert.equal(ok(await a.from('taste_rating_rounds').select('id').eq('id', current.round.id)).length, 0);
  assert.ok((await a.rpc('taste_rating_advance', {p_action:'resume',p_round_id:current.round.id})).error);
  return { ...anonymous, authenticatedStateWorks:true, twoUserIsolation:true,
    priorARatings:beforeA.length, priorBRatings:beforeB.length, existingRatingsPreserved:true,
    newSyntheticRating:1, idempotentRetry:true, storedProgress:true, skippedWithoutRating };
}
