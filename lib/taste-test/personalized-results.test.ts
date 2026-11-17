import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTasteProfile} from './profile.ts';
import {tasteVector, type TasteVector} from './traits.ts';
import {readingTastePortrait} from './result-presentation.ts';
import {recommendRatingResult} from './rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits,reliableProfileTraits} from '../recommendations/work-trait-evidence.ts';
import type {RecommendationCandidate} from '../recommendations/engine.ts';

const reader=(traits:Partial<TasteVector>,rating=10,count=10)=>buildTasteProfile({},Array.from({length:count},(_,i)=>({workId:String(1000+i),rating,traits:tasteVector(traits)})));
function catalog(rows:Array<{id:number;traits:Partial<TasteVector>;author?:string;seriesKey?:string}>) {
  const evidence=new Map(rows.map(row=>[String(row.id),buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:String(row.id),traits:row.traits,confidence:1,source:'manual',sourceKey:'synthetic',rawLabels:[],verifiedAt:'2026-11-17'}))]));
  const candidates:RecommendationCandidate[]=rows.map(row=>({book:{id:'work-'+row.id,workId:String(row.id),title:'Synthetic '+row.id,author:row.author??'Author '+row.id,source:'supabase',cover:'fallback',score:null,ratingsCount:null,match:null},traits:reliableProfileTraits(evidence.get(String(row.id))),metadataConfidence:1,coverageLevel:'rich',seriesKey:row.seriesKey}));
  return {candidates,evidence,availableIds:new Set(evidence.keys()),excludedIds:new Set<string>(),locale:'en' as const};
}

test('eight supported combinations produce distinct portraits and first recommendations; identical evidence is stable',()=>{
  const combinations:Partial<TasteVector>[]=[{fantasy:1,worldbuilding:1},{fantasy:1,romance:1},{science_fiction:1,idea_driven:1},{thriller_mystery:1,fast_paced:1},{literary:1,character_driven:1},{nonfiction:1,idea_driven:1},{romance:1,uplifting:1},{literary:1,complex:1}];
  const input=catalog(combinations.map((traits,i)=>({id:i+1,traits})));
  for(const locale of ['nl','en'] as const){
    const titles=combinations.map(traits=>readingTastePortrait(reader(traits),locale).title);
    assert.equal(new Set(titles).size,8);
    assert.deepEqual(combinations.map(traits=>readingTastePortrait(reader(traits),locale).title),titles);
  }
  combinations.forEach((traits,i)=>{
    const profile=reader(traits),result=recommendRatingResult({...input,profile});
    assert.equal(result[0].book.workId,String(i+1));
    assert.deepEqual(recommendRatingResult({...input,profile,candidates:[...input.candidates].reverse()}),result);
  });
});

test('a combination match outranks a sparsely tagged genre match and repeated authors do not dominate ties',()=>{
  const profile=reader({fantasy:1,worldbuilding:.8});
  const input=catalog([{id:1,traits:{fantasy:1}},{id:2,traits:{fantasy:1,worldbuilding:.8},author:'Same'},{id:3,traits:{fantasy:1,worldbuilding:.8},author:'Same'},{id:4,traits:{fantasy:1,worldbuilding:.8},author:'Different'}]);
  const ids=recommendRatingResult({...input,profile}).map(x=>x.book.workId);
  assert.deepEqual(ids,['2','4','3','1']);
});

test('negative evidence changes the ranking; exclusions and no unsupported profile claims remain intact',()=>{
  const input=catalog([{id:1,traits:{fantasy:1}},{id:2,traits:{romance:1}}]);
  const positive=reader({fantasy:1}),negative=reader({fantasy:1},1);
  assert.equal(recommendRatingResult({...input,profile:positive})[0].book.workId,'1');
  assert.equal(recommendRatingResult({...input,profile:negative})[0].book.workId,'2');
  assert.deepEqual(recommendRatingResult({...input,profile:positive,excludedIds:new Set(['1'])}).map(x=>x.book.workId),['2']);
  for(const profile of [negative,reader({fantasy:1},10,2),reader({classic:1}),reader({})]){
    assert.equal(readingTastePortrait(profile,'nl').preferences.length,0);
    assert.match(readingTastePortrait(profile,'nl').summary,/nog geen voldoende onderbouwde/);
  }
  assert.doesNotMatch(readingTastePortrait(reader({fantasy:1,speculative:1}),'nl').title,/speculatieve/);
});
