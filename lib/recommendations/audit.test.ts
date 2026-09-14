import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';
import { auditRecommendation } from './audit.ts';
import { recommendBooks, type RecommendationCandidate } from './engine.ts';

test('developer audit reports deterministic ranking and presentation details', () => {
  const profile = {
    ...buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, []),
    confidence: 'MEDIUM' as const,
  };
  const book: Book = {
    id: 'work-42',
    source: 'supabase',
    workId: '42',
    title: 'A Test of Worlds',
    author: 'Example Author',
    score: 8,
    ratingsCount: 20,
    match: null,
    cover: 'orbit',
  };
  const candidateTraits = tasteVector({
    science_fiction: 1,
    worldbuilding: .8,
    romance: 1,
  });
  const candidate: RecommendationCandidate = {
    book,
    traits: candidateTraits,
    metadataConfidence: .9,
    coverageLevel: 'rich',
  };
  const recommendation = recommendBooks({
    candidates: [candidate],
    profile,
    ratedWorkIds: new Set(),
  })[0];

  const report = auditRecommendation({
    recommendation,
    profile,
    candidateTraits,
  });

  assert.deepEqual(
    report,
    auditRecommendation({ recommendation, profile, candidateTraits }),
  );
  assert.equal(report.bookTitle, 'A Test of Worlds');
  assert.equal(report.workId, '42');
  assert.equal(report.rawPersonalSimilarity, recommendation.personalMatch);
  assert.equal(report.rankingScore, recommendation.rankingScore);
  assert.equal(report.userConfidence, 'MEDIUM');
  assert.equal(report.coverageLevel, 'rich');
  assert.equal(report.metadataConfidence, .9);
  assert.equal(
    report.userFacingMatchDisplay,
    `Your Match ${recommendation.matchScore}%`,
  );
  assert.ok(report.topOverlappingTraits.length > 0);
  assert.ok(
    report.topOverlappingTraits.every(({ trait }) =>
      profile.vector[trait] > 0 && candidateTraits[trait] > 0,
    ),
  );
  assert.equal(report.finalExplanation, recommendation.explanation);
});
