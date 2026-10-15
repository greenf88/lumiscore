import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteProfile} from '../taste-test/profile.ts';
import {tasteVector} from '../taste-test/traits.ts';
import {buildRecommendationReason,getTopTraitOverlaps} from './explanations.ts';
import {calculatePersonalMatch,recommendBooks} from './engine.ts';
import {recommendRatingResult} from '../taste-test/rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits} from './work-trait-evidence.ts';
const traits=tasteVector({science_fiction:.8,worldbuilding:.4,romance:.2});
const profile=buildTasteProfile({},Array.from({length:5},(_,i)=>({workId:String(100+i),rating:9,traits})));
const input={profile,candidate:traits,workId:'9991',coverageLevel:'rich' as const,metadataConfidence:.9};
test('one strongest supported book-specific reason, stable across calls and input order, localized',()=>{
 const a=buildRecommendationReason(input);
 assert.equal(a.supported,true);assert.equal(a.trait,'science_fiction');
 assert.match(a.explanation,/Science fiction/);assert.doesNotMatch(a.explanation,/immersive|relationship/);
 assert.deepEqual(buildRecommendationReason(input),a);
 assert.deepEqual(buildRecommendationReason({...input,profile:{...profile,affinities:[...profile.affinities].reverse()}}),a);
 assert.match(buildRecommendationReason({...input,locale:'nl'}).explanation,/Sciencefiction/);
 const b=buildRecommendationReason({...input,candidate:tasteVector({worldbuilding:1})});
 assert.equal(b.trait,'worldbuilding');assert.notEqual(b.explanation,a.explanation);
});
test('profile-wide favourite absent from book never leaks into its explanation',()=>{
 const reason=buildRecommendationReason({...input,candidate:tasteVector({romance:1})});
 assert.equal(reason.trait,'romance');assert.doesNotMatch(reason.explanation,/science|world/i);
});
test('weak, missing, negative or era-only evidence yields honest exploration and no confident match',()=>{
 const sparse=buildTasteProfile({},[{workId:'1',rating:10,traits}]);
 for(const weak of [
  {...input,profile:sparse},
  {...input,candidate:tasteVector({fantasy:1})},
  {...input,candidate:tasteVector({classic:1}),coverageLevel:'era_only' as const},
  {...input,metadataConfidence:.59},
  {...input,metadataConfidence:NaN},
  {...input,profile:buildTasteProfile({},Array.from({length:8},(_,i)=>({workId:String(i+1),rating:1,traits})))},
 ]){
  assert.equal(buildRecommendationReason(weak).supported,false);
  const result=calculatePersonalMatch({profile:weak.profile,candidate:{traits:weak.candidate,coverageLevel:weak.coverageLevel,metadataConfidence:weak.metadataConfidence},workId:weak.workId});
  assert.match(result.explanation,/exploratory/);assert.equal(result.matchScore,null);assert.equal(result.matchLabel,null);
 }
 assert.deepEqual(getTopTraitOverlaps(tasteVector({fantasy:-1}),tasteVector({fantasy:-1})),[]);
});
test('known La Nuit metadata conflict cannot become a confident claim; no replacement classification',()=>{
 const badTraits=tasteVector({speculative:1,thriller_mystery:1});
 const reader=buildTasteProfile({},Array.from({length:12},(_,i)=>({workId:String(i+1),rating:9,traits:badTraits})));
 const reason=buildRecommendationReason({...input,workId:'276',profile:reader,candidate:badTraits});
 assert.equal(reason.supported,false);assert.match(reason.explanation,/exploratory/);
 assert.doesNotMatch(reason.explanation,/thriller|speculative|memoir|nonfiction/i);
 const result=calculatePersonalMatch({profile:reader,candidate:{traits:badTraits,coverageLevel:'rich',metadataConfidence:.95},workId:'276'});
 assert.equal(result.matchScore,null);assert.equal(result.matchLabel,null);assert.ok(result.personalSimilarity>0);
});
test('result and homepage use the same reason/presentation with unchanged shared profile and ranking inputs',()=>{
 const book={id:'work-9991',workId:'9991',title:'Synthetic',author:'Synthetic',source:'supabase' as const,score:null,ratingsCount:null,match:null,cover:'orbit'};
 const effective=buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:'9991',traits:{science_fiction:1},confidence:1,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-10-15'}));
 const candidate={book,traits:tasteVector({science_fiction:1}),metadataConfidence:effective.metadataConfidence,coverageLevel:effective.coverageLevel};
 const before=JSON.stringify(profile);
 const home=recommendBooks({candidates:[candidate],profile,ratedWorkIds:new Set()})[0];
 const result=recommendRatingResult({profile,candidates:[candidate],evidence:new Map([['9991',effective]]),excludedIds:new Set(),availableIds:new Set(['9991']),locale:'en'})[0];
 assert.equal(result.explanation,home.explanation);assert.equal(result.matchScore,home.matchScore);
 assert.equal(JSON.stringify(profile),before);assert.ok(home.rankingScore>0);
});
