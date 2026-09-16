import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { recommendBooks, type RecommendationCandidate } from './engine.ts';
import { recommendGuestBooks } from './guest.ts';
import { TASTE_TEST_QUESTIONS, TASTE_TEST_WORK_IDS, type TasteTestAnswers } from '../taste-test/config.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import { resolveLocaleBookLanguagePreference } from './language-preference.ts';

function candidate(workId: string, title: string, traits: Parameters<typeof tasteVector>[0]): RecommendationCandidate {
  const book: Book = {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title,
    author: 'Reader',
    score: 8,
    ratingsCount: 2,
    match: null,
    cover: 'orbit',
  };
  return { book, traits: tasteVector(traits), metadataConfidence: .9, coverageLevel: 'rich' };
}

const answers = Object.fromEntries(
  TASTE_TEST_QUESTIONS.map(({ key }) => [key, 'left']),
) as TasteTestAnswers;

test('guest personalization is a thin wrapper around the existing profile and ranking engine', () => {
  const candidates = [
    candidate(TASTE_TEST_WORK_IDS[0], 'Anchor', { fantasy: 1 }),
    candidate('9001', 'Fantasy candidate', { fantasy: 1, worldbuilding: .8 }),
    candidate('9002', 'Literary candidate', { literary: 1, slow_burn: 1 }),
  ];
  const guest = recommendGuestBooks({ answers, candidates, locale: 'en' });
  const profile = buildTasteProfile(answers, [], 'en');
  const direct = recommendBooks({
    candidates,
    profile,
    ratedWorkIds: new Set(),
    excludedWorkIds: new Set(TASTE_TEST_WORK_IDS),
    locale: 'en',
    languagePreference: resolveLocaleBookLanguagePreference('en', profile),
    limit: 10,
  });
  assert.deepEqual(guest.recommendations, direct);
  assert.equal(guest.profile.answeredCount, 10);
  const anchorIds = new Set<string>(TASTE_TEST_WORK_IDS);
  assert.equal(guest.recommendations.some(({ book }) => anchorIds.has(book.workId!)), false);
});

test('all-neither guest answers create no fabricated personalization', () => {
  const neither = Object.fromEntries(
    TASTE_TEST_QUESTIONS.map(({ key }) => [key, 'neither']),
  ) as TasteTestAnswers;
  const guest = recommendGuestBooks({
    answers: neither,
    candidates: [candidate('9001', 'Candidate', { fantasy: 1 })],
    locale: 'en',
  });
  assert.equal(guest.profile.answeredCount, 10);
  assert.equal(guest.profile.selectedCount, 0);
  assert.deepEqual(guest.recommendations, []);
});
