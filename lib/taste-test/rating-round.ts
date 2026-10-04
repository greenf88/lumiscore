import { parseRating } from '../ratings/model.ts';
export const ROUND_GOAL = 20;
export type RatingRoundState = {
  round: { id: string; number: number; language: 'nl' | 'en'; complete: boolean; ratedCount: number; offeredCount: number } | null;
  currentWorkId: string | null;
  exhausted: boolean;
};
export type RoundAction = { action: 'start' | 'resume' | 'rate' | 'skip' | 'choose'; roundId?: string; workId?: string; score?: number; language: 'nl' | 'en' };
export function parseRoundAction(value: unknown): RoundAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (Object.keys(x).some(k => !['action', 'roundId', 'workId', 'score', 'language'].includes(k))) return null;
  if (!['start', 'resume', 'rate', 'skip', 'choose'].includes(String(x.action))) return null;
  if (x.language !== 'nl' && x.language !== 'en') return null;
  if (x.action !== 'start' && (typeof x.roundId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x.roundId))) return null;
  if (['rate', 'skip', 'choose'].includes(String(x.action)) && (typeof x.workId !== 'string' || !/^\d+$/.test(x.workId) || !Number.isSafeInteger(Number(x.workId)) || Number(x.workId) <= 0)) return null;
  if (x.action === 'rate' && parseRating(x.score) === null) return null;
  if (x.action !== 'rate' && x.score !== undefined) return null;
  return x as RoundAction;
}
