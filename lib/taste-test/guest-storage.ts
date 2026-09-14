import {
  isTasteTestChoice,
  isTasteTestQuestionKey,
  type TasteTestAnswers,
} from './config.ts';

export const TASTE_TEST_GUEST_STORAGE_KEY = 'lumiscore:taste-test:taste_test_v1';

export function parseGuestTasteTestAnswers(raw: string | null): TasteTestAnswers {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const answers: TasteTestAnswers = {};
    for (const [questionKey, choice] of Object.entries(value)) {
      if (isTasteTestQuestionKey(questionKey) && isTasteTestChoice(choice)) {
        answers[questionKey] = choice;
      }
    }
    return answers;
  } catch {
    return {};
  }
}

export function serializeGuestTasteTestAnswers(answers: TasteTestAnswers): string {
  return JSON.stringify(answers);
}
