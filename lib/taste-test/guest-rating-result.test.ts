import assert from 'node:assert/strict';
import test from 'node:test';
import { guestRatingRecommendations, parseGuestRatings, parseGuestExclusions } from './guest-rating-result.ts';
import { tasteVector } from './traits.ts';
import type { RecommendationCandidate } from '../recommendations/engine.ts';

const ratings = Array.from({length:10}, (_,i) => ({workId:String(i+1), rating:i<5?10:2, traits:tasteVector(i<5?{fantasy:1,fast_paced:1}:{literary:1,slow_burn:1})}));
function candidate(id:number, fantasy:boolean, locale:'nl'|'en'='nl'):RecommendationCandidate {
  return {book:{source:'supabase',id:String(id),workId:String(id),title:`Book ${id}`,author:`Author ${id}`,cover:'orbit',score:8,ratingsCount:30,match:null,strictEditionLanguage:locale,editionLanguage:locale,editionAvailable:true},traits:tasteVector(fantasy?{fantasy:1,fast_paced:1}:{literary:1,slow_burn:1}),metadataConfidence:.9,coverageLevel:'rich'};
}
test('ten distinct meaningful ratings are required; skips, duplicates and client traits are rejected',()=>{
 const input=ratings.map(({workId,rating})=>({workId,rating}));
 assert.deepEqual(parseGuestRatings(input),input);
 for(const invalid of [input.slice(1),[...input,input[0]],input.map(x=>({...x,rating:null})),input.map(x=>({...x,workId:'1'})),input.map(x=>({...x,traits:{fantasy:1}}))])assert.equal(parseGuestRatings(invalid),null);
 assert.equal(parseGuestExclusions(['1','unsafe']),null);assert.deepEqual(parseGuestExclusions(['1','1','2']),['1','2']);
});
test('opposing preferences change recommendations; matches exclude rated/saved works and wrong editions',()=>{
 const candidates=[candidate(1,true),candidate(100,true),candidate(101,true),candidate(102,true,'en'),...Array.from({length:10},(_,i)=>candidate(200+i,i%2===0))];
 const a=guestRatingRecommendations(ratings,candidates,['100'],'nl');
 const b=guestRatingRecommendations(ratings.map(x=>({...x,rating:12-x.rating})),candidates,['100'],'nl');
 assert.equal(a.recommendations.length,5);assert.equal(b.recommendations.length,5);
 assert.notDeepEqual(a.recommendations.map(x=>x.book.workId),b.recommendations.map(x=>x.book.workId));
 for(const result of [a,b])for(const x of result.recommendations){assert.ok(!['1','100','102'].includes(x.book.workId!));assert.equal(x.matchScore,null);assert.equal(x.book.match,null);assert.ok(x.explanation.length>20);}
 assert.deepEqual(a,guestRatingRecommendations(ratings,candidates,['100'],'nl'));
 assert.ok(a.recommendations[0].book.workId==='101'||Number(a.recommendations[0].book.workId)%2===0);
 assert.ok(Number(b.recommendations[0].book.workId)%2===1);
});
test('absent evidence never becomes generic popularity recommendations',()=>{
 const result=guestRatingRecommendations(ratings.map(x=>({...x,traits:tasteVector({})})),[candidate(100,true)],[],'nl');
 assert.deepEqual(result.recommendations,[]);
});
