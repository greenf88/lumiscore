import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteProfile} from './profile.ts';
import {buildRatingResultProfile,recommendRatingResult} from './rating-result.ts';
import {topSupportedAffinities} from './result-presentation.ts';
import {TASTE_TEST_QUESTIONS} from './config.ts';
import {emptyTasteVector} from './traits.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits,reliableProfileTraits,type TraitWeight,type WorkTraitEvidence} from '../recommendations/work-trait-evidence.ts';
import {calculatePersonalMatch,recommendBooks,type RecommendationCandidate} from '../recommendations/engine.ts';

const effective=(id:string,traits:TraitWeight,confidence=1)=>buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:id,traits,confidence,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-10-15'}));
const ratings=(count:number,rating=10)=>Array.from({length:count},(_,i)=>({workId:String(i+1),rating}));
const evidence=(count:number,traits:TraitWeight)=>new Map(ratings(count).map(r=>[r.workId,effective(r.workId,traits)]));

test('shared profile and result adapter have identical full outcomes, including saved guest choices',()=>{
  const rows=ratings(12),traits=evidence(12,{fantasy:1,worldbuilding:.7});
  const answers={'fantasy-or-science-fiction':'right' as const};
  const direct=buildTasteProfile(answers,rows.map(r=>({...r,traits:reliableProfileTraits(traits.get(r.workId))})),'nl');
  assert.deepEqual(direct,buildRatingResultProfile(rows,traits,answers,'nl'));
  assert.equal(direct.selectedCount,1);
  const en=buildRatingResultProfile(rows,traits,answers,'en');
  assert.deepEqual({...direct,summary:''},{...en,summary:''});
});
test('era-only metadata, even manual/rich, cannot produce a content type, preference or precise match',()=>{
  const profile=buildRatingResultProfile(ratings(30),evidence(30,{classic:1}));
  assert.deepEqual(profile.coverage,{ratedWorks:30,contentWorks:0,eraOnlyWorks:30,unknownWorks:0,contentRatio:0});
  assert.equal(profile.confidence,'LOW');assert.equal(profile.archetype,null);assert.equal(profile.meaningfulRatingCount,0);
  assert.deepEqual(topSupportedAffinities(profile),[]);
  const match=calculatePersonalMatch({profile,candidate:{traits:reliableProfileTraits(effective('50',{fantasy:1,classic:1})),metadataConfidence:1,coverageLevel:'rich'},workId:'50'});
  assert.equal(match.personalSimilarity,0);assert.equal(match.matchScore,null);assert.equal(match.matchLabel,null);
});
test('all rated Works are counted separately from content, era-only and unknown; sparse coverage stays low',()=>{
  const traits=evidence(10,{fantasy:1});for(let i=11;i<=15;i++)traits.set(String(i),effective(String(i),{classic:1}));
  const profile=buildRatingResultProfile(ratings(100),traits);
  assert.deepEqual(profile.coverage,{ratedWorks:100,contentWorks:10,eraOnlyWorks:5,unknownWorks:85,contentRatio:.1});
  assert.equal(profile.confidence,'LOW');assert.equal(profile.provisional,true);assert.equal(profile.archetype,null);
});
test('confidence threshold, mapping allowlist, reviewed corrections and conflicting source priority are shared',()=>{
  assert.deepEqual(reliableProfileTraits(effective('1',{fantasy:1},.59)),emptyTasteVector());
  assert.ok(reliableProfileTraits(effective('1',{fantasy:1},.6)).fantasy>0);
  const rows=evidenceRowsForTraits({workId:'1',traits:{fantasy:.3},confidence:1,source:'manual',sourceKey:'manual',rawLabels:[],verifiedAt:'2026-10-15'});
  rows.push(...evidenceRowsForTraits({workId:'1',traits:{fantasy:1,classic:1},confidence:1,source:'open_library',sourceKey:'catalog',rawLabels:[],verifiedAt:'2026-10-15'}));
  assert.deepEqual(buildEffectiveWorkTraitVector(rows),buildEffectiveWorkTraitVector([...rows].reverse()));
  assert.deepEqual(reliableProfileTraits(buildEffectiveWorkTraitVector(rows,{workId:'1',removeTraits:['fantasy'],addTraits:[{trait:'romance',weight:1}],reason:'Synthetic reviewed correction',reviewedAt:'2026-10-15'})),{...emptyTasteVector(),romance:.5,classic:.5});
  assert.deepEqual(reliableProfileTraits(buildEffectiveWorkTraitVector(rows.map(r=>({...r,mappingVersion:'pilot_not_approved'})))),emptyTasteVector());
  assert.deepEqual(reliableProfileTraits(buildEffectiveWorkTraitVector(rows.map(r=>({...r,source:'pilot' as WorkTraitEvidence['source']})))),emptyTasteVector());
});
test('positive/negative ratings preserve signed weighting and the existing small-sample prior',()=>{
  const traits=evidence(10,{fantasy:1});
  const one=buildRatingResultProfile(ratings(1),traits),many=buildRatingResultProfile(ratings(10),traits),negative=buildRatingResultProfile(ratings(10,1),traits);
  assert.equal(one.vector.fantasy,.25);assert.equal(many.vector.fantasy,10/13);assert.equal(negative.vector.fantasy,-10/13);
  assert.equal(one.archetype,null);assert.equal(many.archetype,'worldbuilder');assert.equal(negative.archetype,null);
  assert.deepEqual(topSupportedAffinities(negative),[]);
});
test('duplicate Works are deterministic; latest updated score wins; ambiguous duplicates invent no preference',()=>{
  const traits=evidence(1,{fantasy:1});
  const rows=[{workId:'1',rating:1,updatedAt:'2026-10-14'},{workId:'01',rating:10,updatedAt:'2026-10-15'}];
  // Real DB IDs are canonical before lookup; same canonical evidence for duplicates.
  traits.set('01',traits.get('1')!);
  assert.deepEqual(buildRatingResultProfile(rows,traits),buildRatingResultProfile([...rows].reverse(),traits));
  assert.equal(buildRatingResultProfile(rows,traits).ratingCount,1);assert.equal(buildRatingResultProfile(rows,traits).vector.fantasy,.25);
  const ambiguous=buildRatingResultProfile([{workId:'1',rating:1},{workId:'1',rating:10}],traits);
  assert.equal(ambiguous.ratingCount,1);assert.deepEqual(ambiguous.vector,emptyTasteVector());
  assert.equal(buildRatingResultProfile([{workId:'null',rating:10},{workId:'',rating:9},{workId:'1',rating:0}],traits).ratingCount,0);
});
test('unknown rating metadata does not wash out guest preferences; neither/Read/skip are not ratings',()=>{
  const answers=Object.fromEntries(TASTE_TEST_QUESTIONS.map(q=>[q.key,'left'])) as Parameters<typeof buildTasteProfile>[0];
  const guest=buildTasteProfile(answers,[]),unknown=buildRatingResultProfile(ratings(50),new Map(),answers);
  assert.deepEqual(guest.vector,unknown.vector);assert.equal(unknown.ratingCount,50);assert.equal(unknown.meaningfulRatingCount,0);
  assert.equal(guest.confidence,'MEDIUM');assert.equal(unknown.confidence,'MEDIUM');assert.equal(guest.archetype,null);
  assert.equal(buildTasteProfile({'fantasy-or-science-fiction':'neither'},[]).selectedCount,0);
});
test('changing/deleting a rating fully recomputes preferences with no stale aggregate',()=>{
  const traits=evidence(10,{fantasy:1});
  const initial=buildRatingResultProfile(ratings(10),traits);
  const changed=buildRatingResultProfile(ratings(10,1),traits);
  assert.notDeepEqual(initial.vector,changed.vector);assert.equal(changed.archetype,null);
  assert.equal(buildRatingResultProfile([],traits).ratingCount,0);assert.deepEqual(buildRatingResultProfile([],traits).vector,emptyTasteVector());
});
test('result recommendations and homepage/detail use the same book match; rankers cannot mutate taste',()=>{
  const traits=evidence(30,{fantasy:1}),profile=buildRatingResultProfile(ratings(10),traits),before=JSON.stringify(profile);
  const candidates:RecommendationCandidate[]=Array.from({length:20},(_,i)=>({book:{id:'work-'+(i+11),workId:String(i+11),source:'supabase',title:'Synthetic',author:'Synthetic '+i,cover:'fallback',score:null,ratingsCount:null,match:null},traits:reliableProfileTraits(traits.get(String(i+11))),coverageLevel:'rich',metadataConfidence:1}));
  const home=recommendBooks({candidates,profile,ratedWorkIds:new Set(ratings(10).map(r=>r.workId))});
  const result=recommendRatingResult({profile,candidates,evidence:traits,excludedIds:new Set(),availableIds:new Set(traits.keys()),locale:'en'});
  for(const item of result){const candidate=candidates.find(c=>c.book.workId===item.book.workId)!;const detail=calculatePersonalMatch({profile,candidate,workId:item.book.workId!});
    assert.equal(item.matchScore,detail.matchScore);assert.equal(item.matchConfidence,detail.matchConfidence);assert.equal(home.find(h=>h.book.workId===item.book.workId)?.matchScore,detail.matchScore);}
  assert.equal(JSON.stringify(profile),before);
});
