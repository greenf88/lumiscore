import test from 'node:test';import assert from 'node:assert/strict';
import {readerPersona} from './reader-persona.ts';
import {buildRatingResultProfile} from './rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits} from '../recommendations/work-trait-evidence.ts';
import type {TasteTrait} from './traits.ts';
const ratings=Array.from({length:10},(_,i)=>({workId:String(i+1),rating:9}));
function profile(traits:Partial<Record<TasteTrait,number>>,rating=9){return buildRatingResultProfile(ratings.map(r=>({...r,rating})),new Map(ratings.map(r=>[r.workId,buildEffectiveWorkTraitVector(evidenceRowsForTraits({workId:r.workId,traits,confidence:1,source:'manual',sourceKey:'persona-test',rawLabels:[],verifiedAt:'2026-11-17'}))])));}
test('different evidenced reading tastes choose deterministic illustrated characters in both languages',()=>{
 for(const locale of ['nl','en'] as const)for(const [traits,id] of [[{fantasy:1,worldbuilding:1},'hobbit'],[{thriller_mystery:1,dark:1},'hannibal'],[{thriller_mystery:1,fast_paced:1},'sleuth'],[{science_fiction:1,idea_driven:1},'cosmic'],[{romance:1},'romantic'],[{nonfiction:1},'scholar'],[{literary:1},'storyweaver']] as const){
  const p=profile(traits),before=JSON.stringify(p),result=readerPersona(p,locale);assert.equal(result?.id,id);assert.equal(result?.image,`/images/reading-personas/${id}.jpg`);assert.deepEqual(readerPersona(p,locale),result);assert.equal(JSON.stringify(p),before);
 }
});
test('negative or missing evidence never invents a shareable reading character',()=>{
 assert.equal(readerPersona(profile({fantasy:1},1),'nl'),null);assert.equal(readerPersona(buildRatingResultProfile(ratings,new Map()),'en'),null);
});
