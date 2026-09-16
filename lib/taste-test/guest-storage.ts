import {
  isTasteTestChoice,
  isTasteTestQuestionKey,
  TASTE_TEST_QUESTIONS,
  type TasteTestAnswers,
} from './config.ts';

export const TASTE_TEST_GUEST_STORAGE_KEY = 'lumiscore:taste-test:taste_test_v1';

export type GuestTasteTestProgress = {
  answeredCount: number;
  complete: boolean;
  nextQuestionIndex: number;
};

export function normalizeGuestTasteTestAnswers(value: unknown): TasteTestAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const answers: TasteTestAnswers = {};
  for (const [questionKey, choice] of Object.entries(value)) {
    if (isTasteTestQuestionKey(questionKey) && isTasteTestChoice(choice)) {
      answers[questionKey] = choice;
    }
  }
  return answers;
}

export function isCompleteGuestTasteTestAnswersPayload(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length === TASTE_TEST_QUESTIONS.length && entries.every(
    ([questionKey, choice]) =>
      isTasteTestQuestionKey(questionKey) && isTasteTestChoice(choice),
  );
}

export function parseGuestTasteTestAnswers(raw: string | null): TasteTestAnswers {
  if (!raw) return {};
  try {
    return normalizeGuestTasteTestAnswers(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function getGuestTasteTestProgress(
  answers: TasteTestAnswers,
): GuestTasteTestProgress {
  const firstUnansweredIndex = TASTE_TEST_QUESTIONS.findIndex(
    ({ key }) => !isTasteTestChoice(answers[key]),
  );
  const complete = firstUnansweredIndex === -1;
  return {
    answeredCount: complete
      ? TASTE_TEST_QUESTIONS.length
      : TASTE_TEST_QUESTIONS.filter(({ key }) => isTasteTestChoice(answers[key])).length,
    complete,
    nextQuestionIndex: complete
      ? TASTE_TEST_QUESTIONS.length - 1
      : firstUnansweredIndex,
  };
}

export function serializeGuestTasteTestAnswers(answers: TasteTestAnswers): string {
  return JSON.stringify(answers);
}
