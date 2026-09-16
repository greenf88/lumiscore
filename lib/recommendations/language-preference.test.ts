import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import type { TasteProfile } from '../taste-test/profile.ts';
import { emptyTasteVector, tasteVector } from '../taste-test/traits.ts';
import { calculateDisplayedMatchScore, recommendBooks, type RecommendationCandidate } from './engine.ts';
import {
  getLocaleLanguagePreferenceStrength,
  resolveLocaleBookLanguagePreference,
} from './language-preference.ts';

function vectorForSimilarity(similarity: number) {
  return tasteVector({
    science_fiction: similarity,
    romance: Math.sqrt(1 - similarity ** 2),
  });
}

function profile(meaningfulRatingCount = 0): TasteProfile {
  return {
    vector: tasteVector({ science_fiction: 1 }),
    tasteTestVector: tasteVector({ science_fiction: 1 }),
    ratingsVector: emptyTasteVector(),
    blend: { tasteTest: 1, ratings: 0 },
    answeredCount: 10,
    selectedCount: 5,
    ratingCount: meaningfulRatingCount,
    meaningfulRatingCount,
    confidence: 'MEDIUM',
    summary: 'Test profile',
  };
}

function candidate(
  workId: string,
  title: string,
  similarity: number,
  editionLanguage: string | null,
): RecommendationCandidate {
  const book: Book = {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title,
    author: `${title} Author`,
    editionLanguage,
    score: 5.5,
    ratingsCount: 5,
    match: null,
    cover: 'orbit',
  };
  return {
    book,
    traits: vectorForSimilarity(similarity),
    metadataConfidence: .9,
    coverageLevel: 'rich',
  };
}

function ranked(candidates: RecommendationCandidate[], locale: 'en' | 'nl', meaningfulRatings = 0) {
  const tasteProfile = profile(meaningfulRatings);
  return recommendBooks({
    candidates,
    profile: tasteProfile,
    ratedWorkIds: new Set(),
    locale,
    languagePreference: resolveLocaleBookLanguagePreference(locale, tasteProfile),
    limit: candidates.length,
  });
}

test('English locale ranking is exactly invariant', () => {
  const candidates = [
    candidate('1000', 'English', .78, 'eng'),
    candidate('1001', 'Dutch', .75, 'nld'),
  ];
  const tasteProfile = profile();
  assert.deepEqual(
    ranked(candidates, 'en'),
    recommendBooks({
      candidates,
      profile: tasteProfile,
      ratedWorkIds: new Set(),
      locale: 'en',
      limit: candidates.length,
    }),
  );
});

test('a close Dutch candidate can move above an English candidate for NL', () => {
  const candidates = [
    candidate('1000', 'English', .78, 'eng'),
    candidate('1001', 'Dutch', .75, 'nld'),
  ];
  assert.equal(ranked(candidates, 'en')[0].book.title, 'English');
  assert.equal(ranked(candidates, 'nl')[0].book.title, 'Dutch');
});

test('a clearly worse Dutch candidate never overtakes the stronger match', () => {
  const candidates = [
    candidate('1000', 'English', .82, 'eng'),
    candidate('1001', 'Dutch', .61, 'nld'),
  ];
  assert.equal(ranked(candidates, 'nl')[0].book.title, 'English');
});

test('locale ordering never changes personal similarity or inflates the Dutch match score', () => {
  const candidates = [
    candidate('1000', 'English', .78, 'eng'),
    candidate('1001', 'Dutch', .75, 'nld'),
  ];
  const english = ranked(candidates, 'en').find(({ book }) => book.title === 'Dutch')!;
  const dutch = ranked(candidates, 'nl').find(({ book }) => book.title === 'Dutch')!;
  assert.equal(dutch.personalMatch, english.personalMatch);
  assert.equal(dutch.rankingScore, english.rankingScore);
  assert.equal(dutch.matchScore, english.matchScore);
  assert.equal(dutch.matchScore, calculateDisplayedMatchScore({
    personalSimilarity: dutch.personalMatch,
    userConfidence: 'MEDIUM',
  }));
});

test('unknown language receives no Dutch preference', () => {
  const candidates = [
    candidate('1000', 'English', .78, 'eng'),
    candidate('1001', 'Unknown', .75, null),
  ];
  assert.deepEqual(
    ranked(candidates, 'nl').map(({ book }) => book.workId),
    ranked(candidates, 'en').map(({ book }) => book.workId),
  );
});

test('language alone cannot promote a book with zero personal overlap', () => {
  const candidates = [
    candidate('1000', 'English', 0, 'eng'),
    candidate('1001', 'Dutch', 0, 'nld'),
  ];
  assert.deepEqual(
    ranked(candidates, 'nl').map(({ book }) => book.workId),
    ranked(candidates, 'en').map(({ book }) => book.workId),
  );
});

test('Dutch preference cannot turn era-only overlap into a personal ranking signal', () => {
  const candidates = [
    { ...candidate('1010', 'English era', 1, 'eng'), coverageLevel: 'era_only' as const },
    { ...candidate('1011', 'Dutch era', 1, 'nld'), coverageLevel: 'era_only' as const },
  ];

  assert.deepEqual(
    ranked(candidates, 'nl').map(({ book }) => book.workId),
    ranked(candidates, 'en').map(({ book }) => book.workId),
  );
});

test('meaningful rating history conservatively fades the locale preference', () => {
  assert.deepEqual([0, 3, 6, 10].map(getLocaleLanguagePreferenceStrength), [1, .65, .35, .1]);
  const candidates = [
    candidate('1000', 'English', .78, 'eng'),
    candidate('1001', 'Dutch', .75, 'nld'),
  ];
  assert.equal(ranked(candidates, 'nl', 0)[0].book.title, 'Dutch');
  assert.equal(ranked(candidates, 'nl', 10)[0].book.title, 'English');
});
