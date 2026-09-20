import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import { calculateEraPreferenceBoost, ERA_PREFERENCE_MAX_BOOST } from './era-preference.ts';
import { recommendBooks, type RecommendationCandidate } from './engine.ts';

function candidate(workId: string, year: number): RecommendationCandidate {
  const book: Book = {
    id: `work-${workId}`, source: 'supabase', workId, title: `Book ${workId}`,
    author: 'Author', firstPublishYear: year, score: 7, ratingsCount: 2, match: null, cover: 'orbit',
  };
  return { book, traits: tasteVector({ fantasy: 1 }), metadataConfidence: .9, coverageLevel: 'rich' };
}

test('direct reading-era preference is a bounded cold-start nudge, never an exclusion', () => {
  assert.equal(calculateEraPreferenceBoost({ readingPeriods: ['2015_present'], firstPublishYear: 2020, userConfidence: 'LOW' }), ERA_PREFERENCE_MAX_BOOST);
  assert.equal(calculateEraPreferenceBoost({ readingPeriods: ['2015_present'], firstPublishYear: 1990, userConfidence: 'LOW' }), 0);
  assert.equal(calculateEraPreferenceBoost({ readingPeriods: ['2015_present'], firstPublishYear: 2020, userConfidence: 'HIGH' }), 0);
});

test('all-periods, no-preference and absent preference preserve ranking exactly', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'left' }, []);
  const input = { candidates: [candidate('9001', 1995), candidate('9002', 2022)], profile, ratedWorkIds: new Set<string>() };
  const baseline = recommendBooks(input);
  assert.deepEqual(recommendBooks({ ...input, readingPeriods: [] }), baseline);
  assert.deepEqual(recommendBooks({ ...input, readingPeriods: ['all_periods'] }), baseline);
  assert.deepEqual(recommendBooks({ ...input, readingPeriods: ['no_preference'] }), baseline);
});

test('matching era can reorder a cold-start tie but keeps every candidate', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'left' }, []);
  const results = recommendBooks({
    candidates: [candidate('9001', 1995), candidate('9002', 2022)],
    profile,
    ratedWorkIds: new Set(),
    readingPeriods: ['2015_present'],
    locale: 'en',
  });
  assert.equal(results.length, 2);
  assert.equal(results[0].book.workId, '9002');
  assert.equal(results[0].eraPreferenceBoost, ERA_PREFERENCE_MAX_BOOST);
});
