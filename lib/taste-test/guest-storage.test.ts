import assert from 'node:assert/strict';
import test from 'node:test';
import { TASTE_TEST_QUESTIONS, type TasteTestAnswers } from './config.ts';
import {
  getGuestTasteTestProgress,
  isCompleteGuestTasteTestAnswersPayload,
  normalizeGuestTasteTestAnswers,
  parseGuestTasteTestAnswers,
  serializeGuestTasteTestAnswers,
} from './guest-storage.ts';

const completedAnswers = Object.fromEntries(
  TASTE_TEST_QUESTIONS.map(({ key }, index) => [
    key,
    index % 3 === 0 ? 'neither' : index % 2 === 0 ? 'left' : 'right',
  ]),
) as TasteTestAnswers;

test('derives completed result state from all ten valid saved answers', () => {
  const restored = parseGuestTasteTestAnswers(
    serializeGuestTasteTestAnswers(completedAnswers),
  );
  assert.deepEqual(getGuestTasteTestProgress(restored), {
    answeredCount: 10,
    complete: true,
    nextQuestionIndex: 9,
  });
});

test('restores an incomplete test at its first unanswered question', () => {
  const partial: TasteTestAnswers = {
    [TASTE_TEST_QUESTIONS[0].key]: 'left',
    [TASTE_TEST_QUESTIONS[2].key]: 'right',
  };
  assert.deepEqual(getGuestTasteTestProgress(partial), {
    answeredCount: 2,
    complete: false,
    nextQuestionIndex: 1,
  });
});

test('invalid and unknown stored values cannot manufacture completion', () => {
  const normalized = normalizeGuestTasteTestAnswers({
    [TASTE_TEST_QUESTIONS[0].key]: 'left',
    [TASTE_TEST_QUESTIONS[1].key]: 'invalid',
    invented: 'right',
  });
  assert.deepEqual(normalized, { [TASTE_TEST_QUESTIONS[0].key]: 'left' });
  assert.equal(getGuestTasteTestProgress(normalized).complete, false);
  assert.equal(isCompleteGuestTasteTestAnswersPayload({ ...completedAnswers, invented: 'right' }), false);
  assert.equal(isCompleteGuestTasteTestAnswersPayload(completedAnswers), true);
});
