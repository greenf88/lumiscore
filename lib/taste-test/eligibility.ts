import type { Locale } from '../i18n/config.ts';
import { GENRE_TRAITS } from './profile-policy.ts';
import { reliableProfileTraits, type EffectiveWorkTraits } from '../recommendations/work-trait-evidence.ts';
import { editionHasLanguage, selectStrictEdition, type StrictEditionRow } from '../books/strict-edition.ts';
import { getReviewedSeriesMetadata } from '../collections/reviewed-series-metadata.ts';

export type TasteMembership = {
  collectionId: string; slug: string; name: string; type: string; sequence: number | null;
  subgroup: string | null; expectedTotal: number | null;
};
export type TasteIdentity = {
  workId: string; title: string; author: string | null; identityKey: string | null;
  workType: string | null; labels: readonly string[]; editions: readonly StrictEditionRow[];
  memberships: readonly TasteMembership[];
  /** Only an explicit reviewed statement, never absence of collection links. */
  standaloneEvidence?: { sourceUrl: string; checkedAt: string };
};
export type EligibilityReason = 'identity-unverified' | 'content-evidence-missing' | 'cooking-or-recipes'
  | 'series-position-unknown' | 'series-continuation' | 'non-main-or-bundle' | 'edition-language-missing' | 'edition-title-missing';
export function isCookingOrRecipes(labels: readonly string[]): boolean {
  return labels.some(label => /\b(cooking|cookbooks?|cookery|recipes?|kookboeken?|kookkunst|recepten(?:boek(?:en)?)?)\b/i.test(label));
}
export function seriesEligibility(identity: TasteIdentity): EligibilityReason[] {
  const series = identity.memberships.filter(m => m.type !== 'author_collection');
  if (/omnibus|box.?set|bundle|prequel|anthology/i.test(identity.workType ?? '')) return ['non-main-or-bundle'];
  if (!series.length) return identity.standaloneEvidence?.sourceUrl && identity.standaloneEvidence.checkedAt ? [] : ['series-position-unknown'];
  const reasons: EligibilityReason[] = [];
  for (const m of series) {
    const reviewed = getReviewedSeriesMetadata(m.slug);
    if (m.type !== 'series' || !reviewed || m.expectedTotal !== reviewed.expectedMainSeriesTotal || m.sequence === null)
      reasons.push('series-position-unknown');
    else if (m.subgroup && m.subgroup !== 'main') reasons.push('non-main-or-bundle');
    else if (m.sequence !== 1) reasons.push(m.sequence > 1 ? 'series-continuation' : 'non-main-or-bundle');
  }
  return [...new Set(reasons)];
}
export function tasteEligibility(identity: TasteIdentity, effective: EffectiveWorkTraits | undefined, language: Locale) {
  const reasons: EligibilityReason[] = [];
  if (!identity.workId || !identity.title.trim() || !identity.author?.trim() || !identity.identityKey) reasons.push('identity-unverified');
  const traits = reliableProfileTraits(effective);
  if (![...GENRE_TRAITS].some(trait => traits[trait] > 0)) reasons.push('content-evidence-missing');
  if (isCookingOrRecipes(identity.labels)) reasons.push('cooking-or-recipes');
  reasons.push(...seriesEligibility(identity));
  const edition = selectStrictEdition(identity.editions, language, identity.title);
  if (!edition) reasons.push(identity.editions.some(e => editionHasLanguage(e,language))
    ? 'edition-title-missing' : 'edition-language-missing');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], edition };
}
export type OfferHistory = { workId: string; roundId: string; decision: 'offered' | 'rated' | 'skipped' };
export function classifyTasteExclusion(workId: string, roundId: string, rated: ReadonlySet<string>,
  history: readonly OfferHistory[], suitable: boolean): 'rated' | 'skipped-this-round' | 'skipped-earlier' | 'offered-this-round' | 'unsuitable' | null {
  if (rated.has(workId) || history.some(o => o.workId === workId && o.decision === 'rated')) return 'rated';
  if (!suitable) return 'unsuitable';
  const same = history.find(o => o.workId === workId && o.roundId === roundId);
  if (same) return same.decision === 'skipped' ? 'skipped-this-round' : 'offered-this-round';
  return history.some(o => o.workId === workId && o.decision === 'skipped') ? 'skipped-earlier' : null;
}
/** A policy preview, not a replacement for atomic DB storage. Same-round offers never repeat. */
export function selectTasteInventory(input: {
  identities: readonly TasteIdentity[]; evidence: ReadonlyMap<string, EffectiveWorkTraits>; language: Locale;
  roundId: string; ratedIds: ReadonlySet<string>; history: readonly OfferHistory[]; revisitEarlierSkips?: boolean;
}) {
  return [...input.identities].sort((a,b) => Number(a.workId)-Number(b.workId)).flatMap(identity => {
    const eligibility = tasteEligibility(identity, input.evidence.get(identity.workId), input.language);
    const exclusion = classifyTasteExclusion(identity.workId,input.roundId,input.ratedIds,input.history,eligibility.eligible);
    return exclusion === null || (exclusion === 'skipped-earlier' && input.revisitEarlierSkips)
      ? [{ identity, edition: eligibility.edition! }] : [];
  });
}
