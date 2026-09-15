import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import {
  applyCollaborativeBoost,
  buildCollaborativeSignals,
  type CollaborativeRating,
} from './collaborative.ts';
import { recommendBooks, type RecommendationCandidate } from './engine.ts';

const target = 'target-user';
const sharedTwo: CollaborativeRating[] = [
  { userId: target, workId: '1', rating: 9 },
  { userId: target, workId: '2', rating: 8 },
  { userId: 'reader-a', workId: '1', rating: 8 },
  { userId: 'reader-a', workId: '2', rating: 10 },
];

function signalFor(ratings: CollaborativeRating[], workId = '3') {
  return buildCollaborativeSignals(ratings, target).get(workId);
}

function candidate(workId: string, similarity: number): RecommendationCandidate {
  const book: Book = {
    id: `work-${workId}`, source: 'supabase', workId, title: `Book ${workId}`,
    author: `Author ${workId}`, score: 5.5, ratingsCount: 5, match: null, cover: 'orbit',
  };
  return {
    book,
    traits: tasteVector({ science_fiction: similarity, romance: Math.sqrt(Math.max(0, 1 - similarity ** 2)) }),
    metadataConfidence: .9,
    coverageLevel: 'rich',
  };
}

const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, [], 'en');

test('fewer than two target likes produces no collaborative signal', () => {
  assert.equal(buildCollaborativeSignals([
    { userId: target, workId: '1', rating: 10 },
    { userId: 'reader-a', workId: '1', rating: 10 },
    { userId: 'reader-a', workId: '3', rating: 10 },
  ], target).size, 0);
});

test('one shared like does not qualify, while two shared likes do', () => {
  const oneShared = signalFor([
    ...sharedTwo.filter(({ userId, workId }) => userId === target || workId === '1'),
    { userId: 'reader-a', workId: '3', rating: 9 },
  ]);
  const twoShared = signalFor([...sharedTwo, { userId: 'reader-a', workId: '3', rating: 9 }]);
  assert.equal(oneShared, undefined);
  assert.ok(twoShared);
  assert.ok(twoShared.score > .5);
  assert.equal(twoShared.weight, .03);
});

test('already-rated candidates and ratings below eight are excluded', () => {
  const signals = buildCollaborativeSignals([
    ...sharedTwo,
    { userId: target, workId: '3', rating: 4 },
    { userId: 'reader-a', workId: '3', rating: 10 },
    { userId: 'reader-a', workId: '4', rating: 7 },
  ], target);
  assert.equal(signals.has('3'), false);
  assert.equal(signals.has('4'), false);
});

test('three shared likes and multiple independent supporters strengthen evidence', () => {
  const twoShared = signalFor([...sharedTwo, { userId: 'reader-a', workId: '3', rating: 9 }])!;
  const threeShared = signalFor([
    ...sharedTwo,
    { userId: target, workId: '5', rating: 10 },
    { userId: 'reader-a', workId: '5', rating: 9 },
    { userId: 'reader-a', workId: '3', rating: 9 },
  ])!;
  const multipleReaders = signalFor([
    ...sharedTwo,
    { userId: 'reader-a', workId: '3', rating: 9 },
    { userId: 'reader-b', workId: '1', rating: 9 },
    { userId: 'reader-b', workId: '2', rating: 8 },
    { userId: 'reader-b', workId: '3', rating: 10 },
  ])!;
  assert.ok(threeShared.weight > twoShared.weight);
  assert.ok(multipleReaders.weight > twoShared.weight);
  assert.ok(multipleReaders.score > twoShared.score);
});

test('aggregate privacy contract contains no reader identity fields', () => {
  const signal = signalFor([...sharedTwo, { userId: 'reader-a', workId: '3', rating: 9 }])!;
  assert.deepEqual(Object.keys(signal).sort(), ['score', 'weight']);
  assert.doesNotMatch(JSON.stringify(signal), /user|email|reader/i);
});

test('no collaborative data leaves current recommendation output and order unchanged', () => {
  const candidates = [candidate('11', .82), candidate('12', .75), candidate('13', .6)];
  const baseline = recommendBooks({ candidates, profile, ratedWorkIds: new Set(), limit: 3 });
  const empty = recommendBooks({ candidates, profile, ratedWorkIds: new Set(), collaborativeSignals: new Map(), limit: 3 });
  assert.deepEqual(empty, baseline);
});

test('one weak signal cannot beat a clearly superior content match', () => {
  const results = recommendBooks({
    candidates: [candidate('11', .95), candidate('12', .2)],
    profile,
    ratedWorkIds: new Set(),
    collaborativeSignals: new Map([['12', { score: .56, weight: .03 }]]),
    limit: 2,
  });
  assert.deepEqual(results.map(({ book }) => book.workId), ['11', '12']);
  assert.ok(applyCollaborativeBoost(.2, { score: .56, weight: .03 }) < .21);
});

test('collaborative ordering never changes match display, personal similarity, profile or traits', () => {
  const candidates = [candidate('11', .7), candidate('12', .69)];
  const profileBefore = structuredClone(profile);
  const traitsBefore = structuredClone(candidates.map(({ traits }) => traits));
  const baseline = recommendBooks({ candidates, profile, ratedWorkIds: new Set(), limit: 2 });
  const withSignal = recommendBooks({
    candidates,
    profile,
    ratedWorkIds: new Set(),
    collaborativeSignals: new Map([['12', { score: 1, weight: .15 }]]),
    limit: 2,
  });
  for (const recommendation of withSignal) {
    const original = baseline.find(({ book }) => book.workId === recommendation.book.workId)!;
    assert.equal(recommendation.personalMatch, original.personalMatch);
    assert.equal(recommendation.matchScore, original.matchScore);
    assert.equal(recommendation.matchLabel, original.matchLabel);
    assert.equal(recommendation.rankingScore, original.rankingScore);
  }
  assert.deepEqual(profile, profileBefore);
  assert.deepEqual(candidates.map(({ traits }) => traits), traitsBefore);
});

test('localized collaborative explanation appears only with real aggregate evidence', () => {
  const noEvidence = recommendBooks({ candidates: [candidate('11', .7)], profile, ratedWorkIds: new Set(), locale: 'en' })[0];
  const english = recommendBooks({
    candidates: [candidate('11', .7)], profile, ratedWorkIds: new Set(), locale: 'en',
    collaborativeSignals: new Map([['11', { score: .7, weight: .05 }]]),
  })[0];
  const dutch = recommendBooks({
    candidates: [candidate('11', .7)], profile, ratedWorkIds: new Set(), locale: 'nl',
    collaborativeSignals: new Map([['11', { score: .7, weight: .05 }]]),
  })[0];
  assert.equal(noEvidence.collaborativeExplanation, '');
  assert.equal(english.collaborativeExplanation, 'Readers with similar taste also rate this book highly.');
  assert.equal(dutch.collaborativeExplanation, 'Lezers met een vergelijkbare smaak waarderen dit boek ook hoog.');
});

test('migration derives auth identity, aggregates once and exposes no reader identities', async () => {
  const migration = (await readFile(new URL(
    '../../supabase/migrations/20260915191053_collaborative_recommendation_signals.sql',
    import.meta.url,
  ), 'utf8')).toLowerCase();
  const returnContract = migration.slice(migration.indexOf('returns table'), migration.indexOf('language sql'));
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /select auth\.uid\(\) as target_user_id/);
  assert.doesNotMatch(migration, /target_user_id (uuid|text)/);
  assert.match(migration, /having count\(\*\) >= 2/);
  assert.match(migration, /candidate_ratings\.rating >= 8/);
  assert.match(migration, /revoke all[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(returnContract, /user_id|email|supporter/);
});
