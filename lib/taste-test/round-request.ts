import { parseRoundAction, type RatingRoundState, type RoundAction } from './rating-round.ts';
import type { Locale } from '../i18n/config.ts';

export function buildRoundRequest(action: RoundAction['action'], state: RatingRoundState | null,
  locale: Locale, goal: number, workId?: string, score?: number, extensionGoal?: number): RoundAction {
  const request = {
    action, language: action === 'start' ? locale : state?.round?.language ?? locale,
    ...(action === 'start' ? { goal } : action === 'extend' ? { goal: extensionGoal } : {}),
    ...(action !== 'start' ? { roundId: state?.round?.id } : {}),
    ...(workId !== undefined ? { workId } : {}),
    ...(score !== undefined ? { score } : {}),
  };
  const parsed = parseRoundAction(request);
  if (!parsed) throw new Error('Invalid taste round action.');
  return parsed;
}
