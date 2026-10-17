import type { Affinity, RatingResultProfile } from './rating-result.ts';
import { ROUND_GOAL, type RatingRoundState, type RoundAction } from './rating-round.ts';
import { ERA_TRAITS, PROFILE_POLICY } from './profile-policy.ts';

// Presentation only: reuse the existing positive-evidence thresholds and scores.
// Neutral, negative and under-supported traits are not presented as preferences.
export function topSupportedAffinities(profile: RatingResultProfile): Affinity[] {
  return profile.affinities.filter(x => !ERA_TRAITS.has(x.trait)
    && x.books+x.answerSupport >= PROFILE_POLICY.minimumPreferenceSupport
    && x.positiveBooks+x.answerSupport >= PROFILE_POLICY.minimumPositiveSupport
    && x.score !== null && Number.isFinite(x.score) && x.score >= PROFILE_POLICY.minimumPreferenceScore && x.score <= 100)
    .sort((a, b) => b.score! - a.score! || a.trait.localeCompare(b.trait,'en')).slice(0, 3);
}

/** Hide an empty explanation panel without changing evidence or reliability. */
export function hasSupportedTasteSummary(profile: RatingResultProfile): boolean {
  return Boolean(profile.archetype || topSupportedAffinities(profile).length);
}

// Call only after a successful, parsed save response. Neither a skip, a retry
// returning an already-complete round, nor a failed save completes a new rating.
export function shouldOpenCompletedResult(action: RoundAction['action'], before: RatingRoundState | null,
  next: { authenticated: boolean; available: boolean; state: RatingRoundState | null }): boolean {
  const previous = before?.round, round = next.state?.round;
  return action === 'rate' && next.authenticated && next.available && Boolean(previous && round
    && previous.id === round.id && !previous.complete && round.complete
    && round.ratedCount > previous.ratedCount && round.ratedCount >= (round.goal ?? ROUND_GOAL));
}
