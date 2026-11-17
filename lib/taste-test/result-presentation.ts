import type { Affinity, RatingResultProfile } from './rating-result.ts';
import { ROUND_GOAL, type RatingRoundState, type RoundAction } from './rating-round.ts';
import { ERA_TRAITS, PROFILE_POLICY } from './profile-policy.ts';
import { GENRE_TRAITS } from './profile-policy.ts';
import { getTraitLabel } from './traits.ts';
import type { Locale } from '../i18n/config.ts';

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

/** Describe a supported combination, never assign a personality from one genre. */
export function readingTastePortrait(profile: RatingResultProfile, locale: Locale) {
  const preferences = topSupportedAffinities(profile);
  const genre = preferences.find(x => GENRE_TRAITS.has(x.trait));
  const distinctive = preferences.filter(x => !(genre && ['fantasy','science_fiction'].includes(genre.trait) && x.trait === 'speculative'));
  const other = distinctive.find(x => x !== genre);
  const defining = [...new Set([genre, other, ...distinctive].filter((x): x is Affinity => Boolean(x)))].slice(0, 2);
  const labels = defining.map(x => getTraitLabel(locale, x.trait));
  const title = labels.length ? labels.join(' · ').replace(/^./u, c => c.toLocaleUpperCase(locale))
    : locale === 'nl' ? 'Je leessmaak is nog in ontwikkeling' : 'Your reading taste is still taking shape';
  const ratingEvidence = locale === 'nl'
    ? `Gebaseerd op ${profile.ratingCount} beoordeelde boeken. Van ${profile.classifiedCount} daarvan zijn inhoudelijke kenmerken bekend.`
    : `Based on ${profile.ratingCount} rated books. Content traits are available for ${profile.classifiedCount} of them.`;
  const choiceEvidence = profile.selectedCount ? locale === 'nl' ? ` Ook ${profile.selectedCount} gekozen boekvoorkeuren tellen mee.` : ` Your ${profile.selectedCount} selected book preferences also contribute.` : '';
  const evidence = ratingEvidence + choiceEvidence;
  const summary = labels.length
    ? locale === 'nl' ? 'Deze combinatie komt naar voren uit je positieve beoordelingen en keuzes.' : 'This combination emerges from your positive ratings and choices.'
    : locale === 'nl' ? 'Er is nog geen voldoende onderbouwde voorkeur. Beoordeel meer boeken die je goed kent, ook boeken die je minder bevielen.' : 'There is not yet enough evidence for a clear preference. Rate more books you know well, including books you liked less.';
  return { title, summary, evidence, preferences };
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
