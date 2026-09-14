import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  TASTE_TEST_ANCHORS,
  TASTE_TEST_QUESTIONS,
  TASTE_TEST_VERSION,
  isTasteTestChoice,
} from './config.ts';
import { parseGuestTasteTestAnswers, serializeGuestTasteTestAnswers } from './guest-storage.ts';
import {
  buildTasteProfile,
  calculateUserEvidenceConfidence,
  getTasteEvidenceBlend,
  getTasteProfileConfidenceCopy,
  ratingPreferenceWeight,
} from './profile.ts';
import { emptyTasteVector, tasteVector } from './traits.ts';

test('taste_test_v1 contains exactly ten valid catalog pairs', () => {
  assert.equal(TASTE_TEST_VERSION, 'taste_test_v1');
  assert.equal(TASTE_TEST_QUESTIONS.length, 10);
  assert.equal(new Set(TASTE_TEST_QUESTIONS.map(({ key }) => key)).size, 10);
  for (const question of TASTE_TEST_QUESTIONS) {
    assert.match(question.leftWorkId, /^\d+$/);
    assert.match(question.rightWorkId, /^\d+$/);
    assert.ok(TASTE_TEST_ANCHORS[question.leftWorkId]);
    assert.ok(TASTE_TEST_ANCHORS[question.rightWorkId]);
    assert.notEqual(question.leftWorkId, question.rightWorkId);
  }
});

test('only left, right and neither are valid choices', () => {
  assert.equal(isTasteTestChoice('left'), true);
  assert.equal(isTasteTestChoice('right'), true);
  assert.equal(isTasteTestChoice('neither'), true);
  assert.equal(isTasteTestChoice('skip'), false);
});

test('guest answers round-trip locally and invalid values are ignored', () => {
  const answers = { 'fantasy-or-science-fiction': 'right' as const };
  assert.deepEqual(parseGuestTasteTestAnswers(serializeGuestTasteTestAnswers(answers)), answers);
  assert.deepEqual(parseGuestTasteTestAnswers('{"unknown":"left","fantasy-or-science-fiction":"bad"}'), {});
  assert.deepEqual(parseGuestTasteTestAnswers('not json'), {});
});

test('an existing answer can be changed without accumulating stale evidence', () => {
  const dune = buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, []);
  const eragon = buildTasteProfile({ 'fantasy-or-science-fiction': 'left' }, []);
  assert.ok(dune.vector.science_fiction > eragon.vector.science_fiction);
  assert.ok(eragon.vector.fantasy > dune.vector.fantasy);
  assert.equal(eragon.selectedCount, 1);
});

test('choosing Dune raises science fiction and worldbuilding evidence', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'right' }, []);
  assert.ok(profile.vector.science_fiction > 0);
  assert.ok(profile.vector.worldbuilding > 0);
  assert.equal(profile.selectedCount, 1);
});

test('neither records completion without distorting the taste vector', () => {
  const profile = buildTasteProfile({ 'fantasy-or-science-fiction': 'neither' }, []);
  assert.deepEqual(profile.vector, emptyTasteVector());
  assert.equal(profile.answeredCount, 1);
  assert.equal(profile.selectedCount, 0);
});

test('high and low ratings contribute with opposite signs', () => {
  const traits = tasteVector({ fantasy: 1 });
  const positive = buildTasteProfile({}, [{ workId: '1', rating: 10, traits }]);
  const negative = buildTasteProfile({}, [{ workId: '1', rating: 1, traits }]);
  assert.ok(positive.vector.fantasy > 0);
  assert.ok(negative.vector.fantasy < 0);
  assert.equal(ratingPreferenceWeight(10), 1);
  assert.equal(ratingPreferenceWeight(1), -1);
});

test('taste-test weight decreases as real rating evidence grows', () => {
  assert.deepEqual(getTasteEvidenceBlend(0), { tasteTest: 1, ratings: 0 });
  assert.deepEqual(getTasteEvidenceBlend(4), { tasteTest: .7, ratings: .3 });
  assert.deepEqual(getTasteEvidenceBlend(9), { tasteTest: .5, ratings: .5 });
  assert.deepEqual(getTasteEvidenceBlend(24), { tasteTest: .25, ratings: .75 });
  assert.deepEqual(getTasteEvidenceBlend(25), { tasteTest: .1, ratings: .9 });
});

test('user evidence confidence has explicit low, medium and high gates', () => {
  assert.equal(calculateUserEvidenceConfidence(4, 4, 2), 'LOW');
  assert.equal(calculateUserEvidenceConfidence(7, 3, 0), 'MEDIUM');
  assert.equal(calculateUserEvidenceConfidence(5, 5, 0), 'MEDIUM');
  assert.equal(calculateUserEvidenceConfidence(0, 0, 3), 'MEDIUM');
  assert.equal(calculateUserEvidenceConfidence(10, 5, 5), 'HIGH');
  assert.equal(calculateUserEvidenceConfidence(0, 0, 10), 'HIGH');
});

test('user evidence confidence has friendly product copy without changing its internal value', () => {
  assert.deepEqual(getTasteProfileConfidenceCopy('LOW'), {
    label: 'Early profile',
    description: "We're still learning your taste.",
  });
  assert.deepEqual(getTasteProfileConfidenceCopy('MEDIUM'), {
    label: 'Good profile',
    description: "We've got a good first read on your taste.",
  });
  assert.deepEqual(getTasteProfileConfidenceCopy('HIGH'), {
    label: 'Strong profile',
    description: 'We know your reading taste well.',
  });
});

test('authenticated persistence uses the current Supabase user and own-row RLS', async () => {
  const persistence = await readFile(new URL('../supabase/taste-test.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../../supabase/migrations/20260913150000_taste_test_responses.sql', import.meta.url), 'utf8');
  assert.match(persistence, /auth\.getUser\(\)/);
  assert.match(persistence, /from\('taste_test_responses'\)\.upsert/);
  assert.match(persistence, /user_id:\s*user\.id/);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
});

test('Taste Test stays in navigation and low-evidence users get a CTA', async () => {
  const home = await readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8');
  const tasteTest = await readFile(new URL('../../app/components/LumiScoreTasteTest.tsx', import.meta.url), 'utf8');
  assert.match(home, /href="\/taste-test">Taste Test/);
  assert.match(home, /Improve your recommendations/);
  assert.match(home, /Take the 2-minute Taste Test/);
  assert.match(home, /recommendation\.matchLabel/);
  assert.doesNotMatch(home, /matchScore === null\s*\?\s*'Early match'/);
  assert.doesNotMatch(tasteTest, /Confidence:\s*\{profile\.confidence\}/);
  assert.match(tasteTest, /getTasteProfileConfidenceCopy\(profile\.confidence\)/);
});
