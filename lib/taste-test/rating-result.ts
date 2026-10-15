import { TASTE_TRAITS, type TasteVector } from './traits.ts';
import { buildTasteProfile, type TasteProfile } from './profile.ts';
import { reliableProfileTraits, type EffectiveWorkTraits } from '../recommendations/work-trait-evidence.ts';
import type { TasteTestAnswers } from './config.ts';
import type { RecommendationCandidate, PersonalizedRecommendation } from '../recommendations/engine.ts';
import {calculatePersonalMatch} from '../recommendations/engine.ts';
import {ERA_TRAITS} from './profile-policy.ts';
import type { Locale } from '../i18n/config.ts';

export type ResultRating = { workId: string; rating: number; updatedAt?:string|null };
export type { Affinity, AffinityFacet } from './profile.ts';
export type RatingResultProfile = TasteProfile;
// Only already-approved evidence and reviewed corrections, not pilot labels.
export function reliableResultTraits(effective: EffectiveWorkTraits | undefined): TasteVector {
  return reliableProfileTraits(effective);
}
export function buildRatingResultProfile(ratings: readonly ResultRating[], evidence: ReadonlyMap<string, EffectiveWorkTraits>,answers:TasteTestAnswers={},locale:Locale='en'): RatingResultProfile {
  return buildTasteProfile(answers,ratings.map(row=>({...row,traits:reliableProfileTraits(evidence.get(String(Number(row.workId)))??evidence.get(row.workId))})),locale);
}
export function recommendRatingResult(input: {
  profile: RatingResultProfile; candidates: readonly RecommendationCandidate[];
  evidence: ReadonlyMap<string,EffectiveWorkTraits>; excludedIds: ReadonlySet<string>;
  availableIds: ReadonlySet<string>; locale: Locale;
}): PersonalizedRecommendation[] {
  const seen = new Set<string>();
  return input.candidates.flatMap(candidate => {
    const id = candidate.book.workId;
    if (!id || seen.has(id) || input.excludedIds.has(id) || !input.availableIds.has(id)) return [];
    seen.add(id);
    const traits = reliableResultTraits(input.evidence.get(id));
    if (!TASTE_TRAITS.some(trait => traits[trait] > 0)) return [];
    const overlap = TASTE_TRAITS.reduce((sum,trait) => sum + (ERA_TRAITS.has(trait)?0:input.profile.vector[trait]*traits[trait]),0);
    const quality = candidate.book.score !== null ? candidate.book.score / 10 : .55;
    return [{ candidate, traits, rank: overlap + .05*quality }];
  }).sort((a,c) => c.rank-a.rank || Number(a.candidate.book.workId)-Number(c.candidate.book.workId)).slice(0,20).map(({candidate,traits}) => ({
    ...calculatePersonalMatch({profile:input.profile,candidate:{...candidate,traits},workId:candidate.book.workId!,locale:input.locale}),
    book:candidate.book,
    coverageLevel:candidate.coverageLevel, metadataConfidence:candidate.metadataConfidence, collaborativeExplanation:'',
  }));
}
