import { TASTE_TEST_ANCHORS, TASTE_TEST_QUESTIONS, type TasteTestAnswers } from './config.ts';
import type { Locale } from '../i18n/config.ts';
import { formatLocalizedList } from '../i18n/format.ts';
import { translate } from '../i18n/translations.ts';
import { TASTE_TRAITS, emptyTasteVector, getTraitLabel, normalizeTasteVector, tasteVector, type TasteTrait, type TasteVector } from './traits.ts';
import { ARCHETYPE_TRAITS, ERA_TRAITS, GENRE_TRAITS, PROFILE_POLICY } from './profile-policy.ts';

// traits must come from reliableProfileTraits (or the existing guest anchors).
export type RatingEvidence = { rating: number; traits: TasteVector; workId: string; updatedAt?: string | null; conflicted?:boolean };
export type TasteEvidenceBlend = { tasteTest: number; ratings: number };
export type AffinityFacet = 'genre' | 'style' | 'era';
export type Affinity = {trait:TasteTrait;facet:AffinityFacet;score:number|null;books:number;positiveBooks:number;answerSupport:number};
export type TasteProfile = {
  vector: TasteVector; tasteTestVector: TasteVector; ratingsVector: TasteVector;
  blend: TasteEvidenceBlend; answeredCount: number; selectedCount: number;
  ratingCount: number; meaningfulRatingCount: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; summary: string;
  classifiedCount: number; eraOnlyCount: number; missingCount: number; provisional: boolean;
  coverage: {ratedWorks:number;contentWorks:number;eraOnlyWorks:number;unknownWorks:number;contentRatio:number};
  affinities: Affinity[];
  archetype: (typeof ARCHETYPE_TRAITS)[keyof typeof ARCHETYPE_TRAITS] | null;
};

export type TasteProfileConfidenceCopy = {
  label: string;
  description: string;
};

export function getTasteProfileConfidenceCopy(
  confidence: TasteProfile['confidence'],
  locale: Locale = 'en',
): TasteProfileConfidenceCopy {
  const level = confidence.toLowerCase() as 'low' | 'medium' | 'high';
  return {
    label: translate(locale, `taste.confidence.${level}.label`),
    description: translate(locale, `taste.confidence.${level}.description`),
  };
}

export function getTasteEvidenceBlend(ratingCount: number): TasteEvidenceBlend {
  if (ratingCount === 0) return { tasteTest: 1, ratings: 0 };
  if (ratingCount <= 4) return { tasteTest: .7, ratings: .3 };
  if (ratingCount <= 9) return { tasteTest: .5, ratings: .5 };
  if (ratingCount <= 24) return { tasteTest: .25, ratings: .75 };
  return { tasteTest: .1, ratings: .9 };
}

export function ratingPreferenceWeight(rating: number): number {
  return Math.max(-1, Math.min(1, (rating - 5.5) / 4.5));
}

function calculateTasteTestVector(answers: TasteTestAnswers) {
  const vector = emptyTasteVector();
  let answeredCount = 0;
  let selectedCount = 0;
  for (const question of TASTE_TEST_QUESTIONS) {
    const choice = answers[question.key];
    if (!choice || !['left','right','neither'].includes(choice)) continue;
    answeredCount += 1;
    if (choice === 'neither') continue;
    selectedCount += 1;
    const chosen = TASTE_TEST_ANCHORS[choice === 'left' ? question.leftWorkId : question.rightWorkId];
    for (const trait of TASTE_TRAITS) vector[trait] += chosen.traits[trait];
  }
  return { vector: normalizeTasteVector(vector), answeredCount, selectedCount };
}

export function uniqueProfileRatings(ratings: readonly RatingEvidence[]): RatingEvidence[] {
  const grouped = new Map<string,RatingEvidence[]>();
  for (const row of ratings) {
    const id=String(row.workId??'').trim();
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id)<1 || !Number.isInteger(row.rating) || row.rating<1 || row.rating>10) continue;
    const key=String(Number(id));
    const rows=grouped.get(key)??[]; rows.push({...row,workId:key}); grouped.set(key,rows);
  }
  return [...grouped].sort(([a],[b])=>a.localeCompare(b,'en')).map(([id,rows])=>{
    const time=(r:RatingEvidence)=>Date.parse(r.updatedAt??'')||0;
    rows.sort((a,b)=>time(b)-time(a)||a.rating-b.rating||JSON.stringify(a.traits).localeCompare(JSON.stringify(b.traits),'en'));
    const latest=rows.filter(r=>time(r)===time(rows[0]));
    // The database PK prevents this. Ambiguous snapshots still count once,
    // but do not invent a preference by choosing a favourable duplicate.
    return new Set(latest.map(r=>r.rating)).size>1
      ? {...rows[0],workId:id,conflicted:true} : rows[0];
  });
}

function hasEvidence(vector: TasteVector) { return TASTE_TRAITS.some((trait) => vector[trait] !== 0); }

function summarizeTaste(vector: TasteVector, locale: Locale): string {
  const labels = TASTE_TRAITS.filter((trait) => !ERA_TRAITS.has(trait) && vector[trait] > 0)
    .sort((left, right) => vector[right] - vector[left]).slice(0, 3).map((trait) => getTraitLabel(locale, trait));
  if (labels.length === 0) return translate(locale, 'taste.emptySummary');
  return translate(locale, 'taste.summary', {
    traits: formatLocalizedList(locale, labels),
  });
}

export function calculateUserEvidenceConfidence(
  answeredCount: number,
  selectedCount: number,
  meaningfulRatingCount: number,
  contentRatio = 1,
): TasteProfile['confidence'] {
  if (
    contentRatio >= PROFILE_POLICY.minimumContentCoverage && (meaningfulRatingCount >= PROFILE_POLICY.highContentWorks ||
    (answeredCount === TASTE_TEST_QUESTIONS.length && selectedCount >= PROFILE_POLICY.minimumGuestChoices && meaningfulRatingCount >= PROFILE_POLICY.highHybridContentWorks))
  ) return 'HIGH';
  if (
    selectedCount >= PROFILE_POLICY.minimumGuestChoices ||
    (answeredCount >= PROFILE_POLICY.mediumGuestAnswered && selectedCount >= PROFILE_POLICY.mediumGuestSelected) ||
    (meaningfulRatingCount >= PROFILE_POLICY.minimumPreferenceSupport && contentRatio >= PROFILE_POLICY.minimumContentCoverage)
  ) return 'MEDIUM';
  return 'LOW';
}

export function buildTasteProfile(
  answers: TasteTestAnswers,
  ratings: readonly RatingEvidence[],
  locale: Locale = 'en',
): TasteProfile {
  const tasteTest = calculateTasteTestVector(answers);
  const unique=uniqueProfileRatings(ratings);
  const sums=emptyTasteVector(),masses=emptyTasteVector(),counts=emptyTasteVector(),positives=emptyTasteVector(),answerSupport=emptyTasteVector();
  let classifiedCount=0,eraOnlyCount=0,meaningfulRatingCount=0;
  for(const row of unique){
    const clean=tasteVector(Object.fromEntries(TASTE_TRAITS.map(t=>[t,Math.max(0,Math.min(1,row.traits[t]))])));
    const mass=TASTE_TRAITS.reduce((sum,t)=>sum+clean[t],0);
    const content=TASTE_TRAITS.some(t=>!ERA_TRAITS.has(t)&&clean[t]>0);
    if(content)classifiedCount++;else if(mass>0)eraOnlyCount++;
    if(!mass||row.conflicted)continue;
    if(content)meaningfulRatingCount++;
    for(const trait of TASTE_TRAITS)if(clean[trait]>0){
      const weight=clean[trait]/mass;
      sums[trait]+=weight*ratingPreferenceWeight(row.rating);masses[trait]+=weight;counts[trait]++;
      if(row.rating>=7)positives[trait]++;
    }
  }
  for(const question of TASTE_TEST_QUESTIONS){
    const choice=answers[question.key];if(choice!=='left'&&choice!=='right')continue;
    const traits=TASTE_TEST_ANCHORS[choice==='left'?question.leftWorkId:question.rightWorkId].traits;
    for(const trait of TASTE_TRAITS)if(traits[trait]>0)answerSupport[trait]++;
  }
  const ratingEvidence={vector:tasteVector(Object.fromEntries(TASTE_TRAITS.map(t=>[t,sums[t]/(masses[t]+PROFILE_POLICY.ratingPriorMass)]))),meaningfulRatingCount};
  const configuredBlend = getTasteEvidenceBlend(meaningfulRatingCount);
  const tasteAvailable = hasEvidence(tasteTest.vector);
  const ratingsAvailable = hasEvidence(ratingEvidence.vector);
  const blend = !tasteAvailable && ratingsAvailable ? { tasteTest: 0, ratings: 1 }
    : tasteAvailable && !ratingsAvailable ? { tasteTest: 1, ratings: 0 } : configuredBlend;
  const vector = tasteVector(Object.fromEntries(TASTE_TRAITS.map((trait) => [
    trait, tasteTest.vector[trait] * blend.tasteTest + ratingEvidence.vector[trait] * blend.ratings,
  ])));
  const ratio=unique.length?classifiedCount/unique.length:0;
  const confidence=calculateUserEvidenceConfidence(tasteTest.answeredCount,tasteTest.selectedCount,meaningfulRatingCount,ratio);
  const affinities:Affinity[]=TASTE_TRAITS.filter(t=>counts[t]>0||answerSupport[t]>0).map<Affinity>(trait=>({
    trait,facet:GENRE_TRAITS.has(trait)?'genre':ERA_TRAITS.has(trait)?'era':'style',
    score:counts[trait]+answerSupport[trait]>=PROFILE_POLICY.minimumPreferenceSupport?Math.round(50+50*vector[trait]):null,
    books:counts[trait],positiveBooks:positives[trait],answerSupport:answerSupport[trait],
  })).sort((a,b)=>(b.score??50)-(a.score??50)||a.trait.localeCompare(b.trait,'en'));
  const defining=classifiedCount>=PROFILE_POLICY.minimumArchetypeContentWorks&&ratio>=PROFILE_POLICY.minimumContentCoverage
    ? affinities.find(x=>x.trait in ARCHETYPE_TRAITS&&x.positiveBooks>=PROFILE_POLICY.minimumPositiveSupport&&(x.score??0)>=PROFILE_POLICY.minimumPreferenceScore):undefined;
  return {
    vector, tasteTestVector: tasteTest.vector, ratingsVector: ratingEvidence.vector, blend,
    answeredCount: tasteTest.answeredCount, selectedCount: tasteTest.selectedCount,
    ratingCount: unique.length, meaningfulRatingCount: ratingEvidence.meaningfulRatingCount,
    classifiedCount,eraOnlyCount,missingCount:unique.length-classifiedCount-eraOnlyCount,provisional:confidence!=='HIGH',
    coverage:{ratedWorks:unique.length,contentWorks:classifiedCount,eraOnlyWorks:eraOnlyCount,unknownWorks:unique.length-classifiedCount-eraOnlyCount,contentRatio:ratio},
    affinities,archetype:defining?ARCHETYPE_TRAITS[defining.trait as keyof typeof ARCHETYPE_TRAITS]:null,
    confidence,
    summary: summarizeTaste(vector, locale),
  };
}

export function strongestPositiveTraits(profile: TasteVector, candidate: TasteVector, limit = 2): TasteTrait[] {
  return TASTE_TRAITS.filter((trait) => !ERA_TRAITS.has(trait) && profile[trait] > 0 && candidate[trait] > 0)
    .sort((left, right) => profile[right] * candidate[right] - profile[left] * candidate[left]).slice(0, limit);
}

export function contentTasteVector(vector:TasteVector):TasteVector {
  return tasteVector({...vector,classic:0,contemporary:0});
}
