import {TASTE_TRAITS,getTraitLabel,type TasteTrait,type TasteVector} from '../taste-test/traits.ts';
import type {TasteProfile} from '../taste-test/profile.ts';
import {ERA_TRAITS,PROFILE_POLICY} from '../taste-test/profile-policy.ts';
import type {Locale} from '../i18n/config.ts';
import type {WorkTraitCoverageLevel} from './work-trait-evidence.ts';

export type TraitOverlap={trait:TasteTrait;label:string;contribution:number};
export function getTopTraitOverlaps(profile:TasteVector,candidate:TasteVector,limit=3,locale:Locale='en'):TraitOverlap[]{
 return TASTE_TRAITS.flatMap(trait=>{
  const contribution=profile[trait]*candidate[trait];
  return profile[trait]>0&&candidate[trait]>0&&Number.isFinite(contribution)
   ?[{trait,label:getTraitLabel(locale,trait),contribution}]:[];
 }).sort((a,b)=>b.contribution-a.contribution||TASTE_TRAITS.indexOf(a.trait)-TASTE_TRAITS.indexOf(b.trait))
   .slice(0,Math.max(0,Math.trunc(limit)));
}

// Presentation hold only, NOT a replacement classification or ranking exclusion.
// Work276 / OL14856842W has conflicting seed/OL labels; bounded read-only proof
// and the unresolved data-review requirement are in the local review report.
const EXPLANATION_REVIEW_HOLDS=new Set(['276']);
const COPY:Record<Locale,Partial<Record<TasteTrait,string>>>={
 en:{
  fantasy:'Fantasy that fits your reading preferences.',
  science_fiction:'Science fiction connects this book with your interests.',
  speculative:'Its speculative ideas fit your reading taste.',
  literary:'Literary writing is the shared thread here.',
  romance:'Relationship-driven storytelling fits your preferences.',
  thriller_mystery:'A pick for your interest in thrillers and mysteries.',
  nonfiction:'Nonfiction connects this book with your reading interests.',
  dark:'A darker tone fits your reading preferences.',
  uplifting:'Its hopeful tone fits your reading taste.',
  fast_paced:'A fast-paced plot fits the pace you prefer.',
  slow_burn:'Slow-burn storytelling fits your preferences.',
  worldbuilding:'An immersive world connects this book with your interests.',
  character_driven:'Character-focused storytelling is the shared thread here.',
  idea_driven:'Thought-provoking ideas fit your reading taste.',
  accessible:'Accessible storytelling fits your preferences.',
  complex:'Complex narratives connect this book with your interests.',
 },
 nl:{
  fantasy:'Fantasy die aansluit bij je leesvoorkeur.',
  science_fiction:'Sciencefiction verbindt dit boek met je interesses.',
  speculative:'De speculatieve ideeën passen bij je leessmaak.',
  literary:'Literair geschreven: dat is hier de gedeelde voorkeur.',
  romance:'Verhalen rond relaties passen bij je voorkeur.',
  thriller_mystery:'Een keuze voor je interesse in thrillers en mysteries.',
  nonfiction:'Non-fictie verbindt dit boek met je leesinteresses.',
  dark:'Een donkere toon die past bij je leesvoorkeur.',
  uplifting:'De hoopvolle toon past bij je leessmaak.',
  fast_paced:'Het hoge verteltempo sluit aan bij je voorkeur.',
  slow_burn:'Een rustig opgebouwde vertelling, passend bij je smaak.',
  worldbuilding:'Een meeslepende wereld sluit aan bij je interesses.',
  character_driven:'Verhalen rond personages zijn hier de gedeelde voorkeur.',
  idea_driven:'Ideeën om over na te denken, passend bij je leessmaak.',
  accessible:'Toegankelijk verteld, passend bij je voorkeur.',
  complex:'Complexe verhalen sluiten aan bij je leesinteresses.',
 },
};
type ReasonInput={
 profile:Pick<TasteProfile,'vector'|'affinities'>;candidate:TasteVector;workId:string;
 coverageLevel:WorkTraitCoverageLevel;metadataConfidence:number;locale?:Locale;
};
export function buildRecommendationReason(input:ReasonInput):{explanation:string;trait:TasteTrait|null;supported:boolean}{
 const locale=input.locale??'en';
 const fallback={explanation:locale==='nl'
  ?'Een verkennende suggestie: nog onvoldoende gedeeld smaakbewijs.'
  :'An exploratory suggestion: not enough shared taste evidence yet.',trait:null,supported:false} as const;
 if(EXPLANATION_REVIEW_HOLDS.has(input.workId)||!['rich','partial'].includes(input.coverageLevel)
  ||!Number.isFinite(input.metadataConfidence)||input.metadataConfidence<PROFILE_POLICY.minimumTraitConfidence)return fallback;
 // Consume the shared profile's existing evidence counts, never build a second profile.
 const supported=new Set(input.profile.affinities.filter(a=>!ERA_TRAITS.has(a.trait)
  &&(a.positiveBooks>=PROFILE_POLICY.minimumPositiveSupport||a.answerSupport>=PROFILE_POLICY.minimumPreferenceSupport)).map(a=>a.trait));
 const strongest=getTopTraitOverlaps(input.profile.vector,input.candidate,TASTE_TRAITS.length,locale)
  .find(x=>supported.has(x.trait)&&x.contribution>=.02&&COPY[locale][x.trait]);
 return strongest?{explanation:COPY[locale][strongest.trait]!,trait:strongest.trait,supported:true}:fallback;
}
export function buildRecommendationExplanation(input:ReasonInput):string{return buildRecommendationReason(input).explanation;}
