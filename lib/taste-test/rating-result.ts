import { TASTE_TRAITS, emptyTasteVector, getTraitLabel, type TasteTrait, type TasteVector } from './traits.ts';
import { ratingPreferenceWeight } from './profile.ts';
import type { EffectiveWorkTraits } from '../recommendations/work-trait-evidence.ts';
import type { RecommendationCandidate, PersonalizedRecommendation } from '../recommendations/engine.ts';
import type { Locale } from '../i18n/config.ts';

export type ResultRating = { workId: string; rating: number };
export type AffinityFacet = 'genre' | 'style' | 'era';
const GENRES = new Set<TasteTrait>(['fantasy','science_fiction','literary','romance','thriller_mystery','nonfiction']);
export type Affinity = { trait: TasteTrait; facet: AffinityFacet; score: number | null; books: number; positiveBooks: number };
export type RatingResultProfile = {
  ratingCount: number; classifiedCount: number; missingCount: number; provisional: boolean;
  affinities: Affinity[]; vector: TasteVector;
  archetype: 'worldbuilder' | 'sleuth' | 'explorer' | 'connector' | null;
};
// Only already-approved evidence and reviewed corrections, not pilot labels.
export function reliableResultTraits(effective: EffectiveWorkTraits | undefined): TasteVector {
  const vector = emptyTasteVector();
  if (!effective) return vector;
  for (const trait of TASTE_TRAITS) {
    const row = effective.evidenceByTrait[trait];
    const reviewed = effective.reviewedCorrection?.addTraits.some(x => x.trait === trait && x.weight > 0);
    if (effective.traits[trait] > 0 && (reviewed || (row && row.confidence >= .6)))
      vector[trait] = effective.traits[trait];
  }
  const mass = TASTE_TRAITS.reduce((sum, trait) => sum + vector[trait], 0);
  return mass ? Object.fromEntries(TASTE_TRAITS.map(trait => [trait, vector[trait] / mass])) as TasteVector : vector;
}
export function buildRatingResultProfile(ratings: readonly ResultRating[], evidence: ReadonlyMap<string, EffectiveWorkTraits>): RatingResultProfile {
  const unique = [...new Map(ratings.filter(x => Number.isInteger(x.rating) && x.rating >= 1 && x.rating <= 10).map(x => [x.workId,x])).values()];
  const sums = emptyTasteVector(), masses = emptyTasteVector(), counts = emptyTasteVector(), positives = emptyTasteVector();
  let classifiedCount = 0;
  for (const rating of unique) {
    const traits = reliableResultTraits(evidence.get(rating.workId));
    if (!TASTE_TRAITS.some(trait => traits[trait] > 0)) continue;
    classifiedCount++;
    for (const trait of TASTE_TRAITS) if (traits[trait] > 0) {
      sums[trait] += traits[trait] * ratingPreferenceWeight(rating.rating);
      masses[trait] += traits[trait]; counts[trait]++;
      if (rating.rating >= 7) positives[trait]++;
    }
  }
  const vector = Object.fromEntries(TASTE_TRAITS.map(trait => [trait, sums[trait] / (masses[trait] + 3)])) as TasteVector;
  const affinities = TASTE_TRAITS.filter(trait => counts[trait] > 0).map(trait => ({
    trait, facet: GENRES.has(trait) ? 'genre' as const : ['classic','contemporary'].includes(trait) ? 'era' as const : 'style' as const,
    score: counts[trait] >= 3 ? Math.round(50 + 50 * vector[trait]) : null,
    books: counts[trait], positiveBooks: positives[trait],
  })).sort((a,c) => (c.score ?? 50) - (a.score ?? 50) || a.trait.localeCompare(c.trait));
  const rules = { fantasy:'worldbuilder',thriller_mystery:'sleuth',science_fiction:'explorer',romance:'connector' } as const;
  const defining = classifiedCount >= 5 && classifiedCount >= unique.length / 2
    ? affinities.find(x => x.trait in rules && x.positiveBooks >= 3 && (x.score ?? 0) >= 60) : undefined;
  return {
    ratingCount:unique.length, classifiedCount, missingCount:unique.length-classifiedCount,
    provisional:classifiedCount < 10, vector, affinities,
    archetype:defining ? rules[defining.trait as keyof typeof rules] : null,
  };
}
export function resultMatchReason(profile: RatingResultProfile, traits: TasteVector, locale: Locale): string {
  const supported = profile.affinities.filter(x => x.positiveBooks >= 3 && profile.vector[x.trait] > 0 && traits[x.trait] > 0)
    .sort((a,c) => profile.vector[c.trait]*traits[c.trait] - profile.vector[a.trait]*traits[a.trait])[0];
  return supported ? locale === 'nl'
    ? `Past bij je positieve beoordelingen van ${supported.positiveBooks} boeken met het kenmerk “${getTraitLabel(locale,supported.trait)}”.`
    : `Shares “${getTraitLabel(locale,supported.trait)}” with ${supported.positiveBooks} books in your positive rating evidence.`
    : locale === 'nl' ? 'Een verkennende suggestie: nog onvoldoende gedeelde kenmerken voor een persoonlijke match.' : 'An exploratory suggestion: not enough shared evidence for a personal match yet.';
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
    const overlap = TASTE_TRAITS.reduce((sum,trait) => sum + input.profile.vector[trait]*traits[trait],0);
    const quality = candidate.book.score !== null ? candidate.book.score / 10 : .55;
    return [{ candidate, traits, rank: overlap + .05*quality }];
  }).sort((a,c) => c.rank-a.rank || Number(a.candidate.book.workId)-Number(c.candidate.book.workId)).slice(0,20).map(({candidate,traits}) => ({
    book:candidate.book, matchScore:null, matchLabel:null, matchConfidence:'low',
    explanation:resultMatchReason(input.profile,traits,input.locale),
    coverageLevel:candidate.coverageLevel, metadataConfidence:candidate.metadataConfidence, collaborativeExplanation:'',
  }));
}
