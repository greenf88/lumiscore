import test from 'node:test';import assert from 'node:assert/strict';
import {loadGuestBookMatch} from './guest-book-match.ts';
import {calculatePersonalMatch,type RecommendationCandidate} from '../recommendations/engine.ts';
import {buildTasteProfile} from '../taste-test/profile.ts';
import {parseGuestTasteTestAnswers} from '../taste-test/guest-storage.ts';
import {tasteVector} from '../taste-test/traits.ts';
const candidate={book:{id:'work-9001',workId:'9001',title:'Synthetic fixture',author:'Test',source:'supabase',cover:'orbit',score:8,ratingsCount:5,match:null},traits:tasteVector({science_fiction:1,worldbuilding:.8}),metadataConfidence:.9,coverageLevel:'rich'} as RecommendationCandidate;
test('deferred optional calculation preserves the exact existing NL/EN match output',async()=>{
 for(const locale of ['nl','en'] as const)for(const raw of [null,'not-json','{}',JSON.stringify({'fantasy-or-science-fiction':'right'}),JSON.stringify({'fantasy-or-science-fiction':'neither'})]){
 const profile=buildTasteProfile(parseGuestTasteTestAnswers(raw),[],locale),hasEvidence=profile.selectedCount>0;
 assert.deepEqual(await loadGuestBookMatch(raw,candidate,'9001',locale),{hasEvidence,match:hasEvidence?calculatePersonalMatch({profile,candidate,workId:'9001',locale}):null});
 }
});
