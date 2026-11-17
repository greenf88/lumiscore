import assert from 'node:assert/strict';
import test from 'node:test';
import { readGuestRoundSession, GUEST_ROUND_SESSION_TTL, guestRoundSessionKey } from './guest-round-session.ts';
import { guestRatingRecommendations } from './guest-rating-result.ts';
import { tasteVector } from './traits.ts';
const now=1000000;
const session={expires:now+GUEST_ROUND_SESSION_TTL,decisions:[{workId:'8',rating:9},{workId:'9',rating:null}],books:[{id:'8',workId:'8',title:'Duin',author:'Frank Herbert',cover:'orbit',editionCoverUrls:{}}]};
test('session restores ratings, skips and searched books without serialized promises',()=>{
 const saved=readGuestRoundSession(JSON.stringify(session),now)!;
 assert.deepEqual(saved.decisions,session.decisions);assert.equal(saved.books[0].workId,'8');assert.ok(!('editionCoverUrls' in saved.books[0]));
 assert.notEqual(guestRoundSessionKey('nl'),guestRoundSessionKey('en'));
});
test('expired, malformed, duplicate or excessive rating sessions are discarded',()=>{
 for(const value of [{...session,expires:now},{...session,expires:now+GUEST_ROUND_SESSION_TTL+1},{...session,decisions:[session.decisions[0],session.decisions[0]]},{...session,decisions:Array.from({length:11},(_,i)=>({workId:String(i+1),rating:8}))}])assert.equal(readGuestRoundSession(JSON.stringify(value),now),null);
 assert.equal(readGuestRoundSession('{',now),null);
});
test('completed result survives book navigation and malformed cached output does not lose ratings',()=>{
 const decisions=Array.from({length:10},(_,i)=>({workId:String(i+1),rating:9}));
 const result=guestRatingRecommendations(decisions.map(x=>({...x,traits:tasteVector({fantasy:1})})),[],[],'nl');
 const completed={...session,decisions,result};
 assert.deepEqual(readGuestRoundSession(JSON.stringify(completed),now)?.result,result);
 const malformed=readGuestRoundSession(JSON.stringify({...completed,result:{...result,profile:{...result.profile,confidence:'invented'}}}),now);
 assert.deepEqual(malformed?.decisions,decisions);
 assert.equal(malformed?.result,undefined);
});
