import { ROUND_GOAL, type RatingRoundState } from './rating-round.ts';

export function canOpenRoundResult(state: RatingRoundState | null): boolean {
  return Boolean(state?.round && state.round.ratedCount >= 10);
}

export function roundProgress(state: RatingRoundState | null) {
  const rated = state?.round?.ratedCount ?? 0;
  const goal = state?.round?.goal ?? ROUND_GOAL;
  return { rated, goal, percent: Math.min(100, Math.max(0, rated / goal * 100)) };
}

// A synchronous gate for every action. Keep it closed briefly after success so
// a second tap cannot rate the next book. No retries; the server is authoritative.
export function createRoundActionGate(wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  let busy = false;
  return {
    isBusy: () => busy,
    async run<T>(operation: () => Promise<T>, accept: (value: T) => void,
      failed: () => void, pending: (value: boolean) => void): Promise<boolean> {
      if (busy) return false;
      busy = true;
      pending(true);
      try {
        const value = await operation();
        accept(value);
        await wait(500);
        return true;
      } catch {
        failed();
        return false;
      } finally {
        busy = false;
        pending(false);
      }
    },
  };
}
