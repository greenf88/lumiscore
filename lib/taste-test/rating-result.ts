import { TASTE_TRAITS, cosineTasteSimilarity, type TasteVector } from './traits.ts';
import { buildTasteProfile, contentTasteVector, type TasteProfile } from './profile.ts';
import { reliableProfileTraits, type EffectiveWorkTraits } from '../recommendations/work-trait-evidence.ts';
import type { TasteTestAnswers } from './config.ts';
import type { RecommendationCandidate, PersonalizedRecommendation } from '../recommendations/engine.ts';
import {calculatePersonalMatch} from '../recommendations/engine.ts';
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
  const remaining = input.candidates.flatMap(candidate => {
    const id = candidate.book.workId;
    if (!id || seen.has(id) || input.excludedIds.has(id) || !input.availableIds.has(id)) return [];
    seen.add(id);
    const traits = reliableResultTraits(input.evidence.get(id));
    if (!TASTE_TRAITS.some(trait => traits[trait] > 0)) return [];
    // Compare the whole content combination. Raw dot products favour sparsely
    // tagged, single-genre books over books matching several reader preferences.
    // Keep the sign: a disliked trait must lower rank, never become a match.
    const overlap = cosineTasteSimilarity(contentTasteVector(input.profile.vector), contentTasteVector(traits));
    const quality = candidate.book.score !== null ? candidate.book.score / 10 : .55;
    return [{ candidate, traits, rank: overlap + .05*quality }];
  });
  const selected: typeof remaining = [];
  while (remaining.length && selected.length < 20) {
    const adjusted = (item: typeof remaining[number]) => {
      const author = item.candidate.book.author.trim().toLocaleLowerCase('en');
      const sameAuthor = author ? selected.filter(x => x.candidate.book.author.trim().toLocaleLowerCase('en') === author).length : 0;
      const sameSeries = item.candidate.seriesKey ? selected.filter(x => x.candidate.seriesKey === item.candidate.seriesKey).length : 0;
      // Small penalties diversify close matches without replacing a much better fit.
      return item.rank - Math.min(.16, sameAuthor * .08) - Math.min(.12, sameSeries * .1);
    };
    remaining.sort((a,b) => adjusted(b)-adjusted(a) || Number(a.candidate.book.workId)-Number(b.candidate.book.workId));
    selected.push(remaining.shift()!);
  }
  return selected.map(({candidate,traits}) => ({
    ...calculatePersonalMatch({profile:input.profile,candidate:{...candidate,traits},workId:candidate.book.workId!,locale:input.locale}),
    book:candidate.book,
    coverageLevel:candidate.coverageLevel, metadataConfidence:candidate.metadataConfidence, collaborativeExplanation:'',
  }));
}
