import type { Locale } from '../i18n/config.ts';
import { isBookPresentationAllowed } from '../books/strict-edition.ts';
import { buildTasteProfile, type RatingEvidence } from './profile.ts';
import { recommendBooks, type RecommendationCandidate, type PersonalizedRecommendation } from '../recommendations/engine.ts';
import { GUEST_ROUND_GOAL } from './guest-round.ts';
import { buildRecommendationReason, getTopTraitOverlaps } from '../recommendations/explanations.ts';
import { getTraitLabel, cosineTasteSimilarity } from './traits.ts';
import { GENRE_TRAITS, PROFILE_POLICY } from './profile-policy.ts';

export type GuestRatingInput = { workId: string; rating: number };
export type GuestRatingResult = { profile: ReturnType<typeof buildTasteProfile>; recommendations: PersonalizedRecommendation[] };
export function parseGuestRatings(value: unknown): GuestRatingInput[] | null {
  if (!Array.isArray(value) || value.length !== GUEST_ROUND_GOAL) return null;
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(key => !['workId', 'rating'].includes(key)) ||
      typeof row.workId !== 'string' || !/^[1-9]\d*$/.test(row.workId) || !Number.isSafeInteger(Number(row.workId)) ||
      !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 10 || ids.has(row.workId)) return null;
    ids.add(row.workId);
  }
  return value;
}
export function parseGuestExclusions(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 500 || value.some(id => typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) return null;
  return [...new Set(value)];
}
export function guestRatingRecommendations(ratings: RatingEvidence[], candidates: readonly RecommendationCandidate[], excluded: string[], locale: Locale): GuestRatingResult {
  const profile = buildTasteProfile({}, ratings, locale);
  const byId = new Map(candidates.map(x=>[x.book.workId,x]));
  // Only supported, positive content matches; never fill a short list with generic popularity.
  const recommendations = recommendBooks({
    profile, candidates: candidates.filter(x => isBookPresentationAllowed(x.book, locale)),
    ratedWorkIds: new Set(ratings.map(x => x.workId)), excludedWorkIds: new Set(excluded), locale, limit: 25,
  }).filter(x => x.personalMatch > 0 && (x.matchLabel !== null || x.matchScore !== null))
    .flatMap(x => {
      const candidate=byId.get(x.book.workId)!;
      const reason=buildRecommendationReason({profile,candidate:candidate.traits,workId:x.book.workId!,coverageLevel:candidate.coverageLevel,metadataConfidence:candidate.metadataConfidence,locale});
      if(!reason.supported||!reason.trait)return [];
      const supported=(trait:string)=>profile.affinities.some(a=>a.trait===trait && a.positiveBooks>=PROFILE_POLICY.minimumPositiveSupport);
      // Compound catalogue labels cannot distinguish fantasy from science fiction.
      // Prefer the supported shared speculative trait over asserting either genre.
      const ambiguousGenre=['fantasy','science_fiction'].includes(reason.trait) && candidate.traits.fantasy>0 && candidate.traits.science_fiction>0;
      const primary=ambiguousGenre && candidate.traits.speculative>0 && profile.vector.speculative>0 && supported('speculative') ? 'speculative' : reason.trait;
      if(ambiguousGenre && primary!=='speculative')return [];
      const shared=getTopTraitOverlaps(profile.vector,candidate.traits,18,locale)
        .filter(overlap=>overlap.trait!==primary && !GENRE_TRAITS.has(overlap.trait) && !['classic','contemporary'].includes(overlap.trait) && overlap.contribution>=.02 && supported(overlap.trait)).slice(0,1);
      const labels=[getTraitLabel(locale,primary),...shared.map(item=>getTraitLabel(locale,item.trait))];
      const features=labels.join(locale==='nl'?' en ':' and ');
      const anchors=ratings.filter(r=>r.rating>=7 && byId.has(r.workId) && cosineTasteSimilarity(r.traits,candidate.traits)>0)
        .sort((a,b)=>cosineTasteSimilarity(b.traits,candidate.traits)-cosineTasteSimilarity(a.traits,candidate.traits)||b.rating-a.rating||Number(a.workId)-Number(b.workId)).slice(0,2).map(r=>byId.get(r.workId)!.book.title);
      const why=anchors.length ? (locale==='nl'?`Je gaf ${anchors.join(' en ')} hoge cijfers.`:`You rated ${anchors.join(' and ')} highly.`) : (locale==='nl'?'Deze kenmerken komen terug in je hoger beoordeelde boeken.':'These features also appear in books you rated more highly.');
      const explanation=locale==='nl' ? `${why} ${x.book.title} sluit aan door ${features}.` : `${why} ${x.book.title} connects through ${features}.`;
      return [{ ...x, explanation, matchScore: null, book: { ...x.book, match: null } }];
    }).slice(0,5);
  return { profile, recommendations };
}
