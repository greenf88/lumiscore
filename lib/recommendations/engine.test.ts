import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import { calculateMatchConfidence, calculateQualityPrior, getMatchPresentation, recommendBooks, type RecommendationCandidate } from './engine.ts';

function candidate(workId: string, title: string, author: string, traits: Parameters<typeof tasteVector>[0], score: number | null = null, ratingsCount = 0): RecommendationCandidate {
  const book: Book = { id: `work-${workId}`, source: 'supabase', workId, title, author, score, ratingsCount, match: null, cover: 'orbit' };
  return { book, traits: tasteVector(traits), metadataConfidence: .9, coverageLevel: 'rich' };
}

const duneProfile = buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, []);

test('already-rated books are excluded', () => {
  const results = recommendBooks({ candidates: [candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 })], profile: duneProfile, ratedWorkIds: new Set(['8']) });
  assert.deepEqual(results, []);
});

test('a stronger profile match ranks above a weaker match', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'Space', 'A', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'Romance', 'B', { romance: 1 }),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  assert.equal(results[0].book.workId, '1');
});

test('unrated candidates receive a neutral quality prior', () => {
  assert.equal(calculateQualityPrior(null, 0), .55);
  assert.ok(calculateQualityPrior(10, 1) < .7);
});

test('one global ten does not dominate a much stronger personal match', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'Strong match', 'A', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'Weak global hit', 'B', { romance: 1 }, 10, 1),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  assert.equal(results[0].book.title, 'Strong match');
});

test('recommendations and match percentages are deterministic', () => {
  const input = {
    candidates: [candidate('10', 'A', 'A', { speculative: 1 }), candidate('11', 'B', 'B', { science_fiction: 1 })],
    profile: duneProfile,
    ratedWorkIds: new Set<string>(),
  };
  assert.deepEqual(recommendBooks(input), recommendBooks(input));
});

test('era-only candidate has low match confidence and no precise score', () => {
  const result = recommendBooks({
    candidates: [{
      ...candidate('10', 'Old book', 'A', { classic: 1 }),
      metadataConfidence: .3,
      coverageLevel: 'era_only',
    }],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  })[0];
  assert.equal(result.matchConfidence, 'low');
  assert.equal(result.matchScore, null);
  assert.equal(result.matchLabel, 'Early match');
});

test('candidate and user evidence both influence match confidence', () => {
  assert.equal(calculateMatchConfidence({
    candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'HIGH',
  }), 'high');
  assert.equal(calculateMatchConfidence({
    candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'LOW',
  }), 'low');
});

test('only rich metadata plus sufficient user evidence receives an exact percentage', () => {
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'MEDIUM',
  }), { matchScore: 84, matchLabel: null, matchConfidence: 'medium' });
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'rich', metadataConfidence: .9, userConfidence: 'LOW',
  }), { matchScore: null, matchLabel: 'Strong match', matchConfidence: 'low' });
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .84, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }), { matchScore: null, matchLabel: 'Strong match', matchConfidence: 'medium' });
});

test('partial metadata uses deterministic qualitative match thresholds', () => {
  assert.equal(getMatchPresentation({
    personalSimilarity: .75, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Strong match');
  assert.equal(getMatchPresentation({
    personalSimilarity: .5, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Good match');
  assert.equal(getMatchPresentation({
    personalSimilarity: .49, candidateCoverage: 'partial', metadataConfidence: .7, userConfidence: 'HIGH',
  }).matchLabel, 'Possible match');
});

test('none coverage receives no user-facing match label', () => {
  assert.deepEqual(getMatchPresentation({
    personalSimilarity: .9, candidateCoverage: 'none', metadataConfidence: 0, userConfidence: 'HIGH',
  }), { matchScore: null, matchLabel: null, matchConfidence: 'low' });
});

test('quality and exploration affect ranking but never inflate personal match', () => {
  const lowQuality = candidate('21', 'Low quality', 'A', { science_fiction: 1 }, 1, 100);
  const highQuality = candidate('22', 'High quality', 'B', { science_fiction: 1 }, 10, 100);
  const [first, second] = recommendBooks({
    candidates: [lowQuality, highQuality],
    profile: { ...duneProfile, confidence: 'MEDIUM' },
    ratedWorkIds: new Set(),
    limit: 2,
  });
  assert.equal(first.matchScore, second.matchScore);
  assert.notEqual(first.rankingScore, second.rankingScore);
  assert.equal(first.matchScore, Math.round(first.personalMatch * 100));
  assert.notEqual(first.rankingScore, first.personalMatch);
});

test('diversity reranking avoids filling the first results with one author', () => {
  const results = recommendBooks({
    candidates: [
      candidate('1', 'A1', 'Same Author', { science_fiction: 1, worldbuilding: 1 }),
      candidate('2', 'A2', 'Same Author', { science_fiction: 1, worldbuilding: 1 }),
      candidate('3', 'Other', 'Other Author', { science_fiction: .9, idea_driven: .8 }),
    ],
    profile: duneProfile,
    ratedWorkIds: new Set(),
    limit: 2,
  });
  assert.equal(new Set(results.map(({ book }) => book.author)).size, 2);
});

test('explanations name traits that genuinely overlap', () => {
  const [result] = recommendBooks({
    candidates: [candidate('1', 'Space', 'A', { science_fiction: 1, worldbuilding: 1 })],
    profile: duneProfile,
    ratedWorkIds: new Set(),
  });
  assert.match(result.explanation, /science fiction|immersive worlds/);
});

test('Taste Test anchor identity has no ranking bonus', async () => {
  const base = candidate('8', 'Dune', 'Frank Herbert', { science_fiction: 1 });
  const withoutSeries = recommendBooks({
    candidates: [base], profile: duneProfile, ratedWorkIds: new Set(),
  })[0];
  const withSeries = recommendBooks({
    candidates: [{ ...base, seriesKey: 'taste-test-anchor' }], profile: duneProfile, ratedWorkIds: new Set(),
  })[0];
  assert.equal(withoutSeries.rankingScore, withSeries.rankingScore);
  const engineSource = await readFile(new URL('./engine.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(engineSource, /TASTE_TEST_ANCHORS|anchorWorkIds/);
});
