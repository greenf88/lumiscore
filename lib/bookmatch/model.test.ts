import test from 'node:test';
import assert from 'node:assert/strict';
import {advice,nextCard,parseSession,prototypeAllowed,parseDeckQuery,substantiveCount,storageKey,swipeDecision,type MatchCard,type InterestChoice} from './model.ts';
import {emptyTasteVector} from '../taste-test/traits.ts';
const cards: MatchCard[]=Array.from({length:25},(_,i)=>({book:{id:`${i+1}`,workId:`${i+1}`,source:'supabase',title:'Synthetic',author:'Synthetic',cover:'',score:null,ratingsCount:0,match:null},traits:{...emptyTasteVector(),fantasy:1}}));
test('ten interests not ratings; skips and undo do not inflate completion; one advice excludes chosen cards',()=>{
  const choices: InterestChoice[]=cards.slice(0,10).map(x=>({workId:x.book.workId!,decision:'interested'}));
  choices.push({workId:'11',decision:'skip'});
  assert.equal(substantiveCount(choices),10); assert.equal(substantiveCount(choices.slice(0,9)),9);
  assert.equal(nextCard(cards,choices)?.book.workId,'12');
  assert.equal(advice(cards,choices,'nl')?.card.book.workId,'12');
  assert.match(advice(cards,choices,'nl')!.reason,/10 boeken/);
  assert.equal(advice(cards.slice(0,10),choices,'nl'),null);
  const low=choices.map(x=>({...x,decision:'not-for-me' as const}));
  assert.match(advice(cards,low,'en')!.reason,/exploratory/);
});
test('interest storage is versioned, bounded, owner/language separated and never a rating payload',()=>{
  const session={version:1,seed:'12345678-abcd-abcd-abcd-123456789abc',history:['20'],choices:[{workId:'1',decision:'interested'}]};
  assert.deepEqual(parseSession(JSON.stringify(session)),session);
  assert.equal(parseSession(JSON.stringify({...session,choices:[{workId:'1',rating:10}]})),null);
  assert.equal(parseSession(JSON.stringify({...session,choices:[...session.choices,...session.choices]})),null);
  assert.equal(parseSession('{'),null);
  assert.notEqual(storageKey('a','nl'),storageKey('b','nl'));assert.notEqual(storageKey('a','nl'),storageKey('a','en'));
});
test('production and unknown targets are always closed; no production fallback',()=>{
  for(const node of ['production','development','test']) assert.equal(prototypeAllowed({node,vercel:'production',url:'https://hlvujbrmfdlrfxdjwsmb.supabase.co'}),false);
  assert.equal(prototypeAllowed({node:'production',url:'https://hlvujbrmfdlrfxdjwsmb.supabase.co'}),false);
  assert.equal(prototypeAllowed({node:'production',vercel:'preview',url:'https://hlvujbrmfdlrfxdjwsmb.supabase.co'}),true);
  assert.equal(prototypeAllowed({node:'development',url:'http://127.0.0.1:55431'}),true);
  for(const url of ['https://qvplwejffhjvxaypmjut.supabase.co','https://other.supabase.co','http://localhost:55431','https://user@hlvujbrmfdlrfxdjwsmb.supabase.co','']) assert.equal(prototypeAllowed({node:'development',vercel:'preview',url}),false);
});
test('deck query only accepts bounded non-secret public IDs and seed',()=>{
  assert.equal(parseDeckQuery(new URL('http://local/api?seed=12345678-abcd-abcd-abcd-123456789abc&seen=1,2'))?.seen.size,2);
  for(const query of ['seed=x','seed=12345678-abcd-abcd-abcd-123456789abc&owner=other','seed=12345678-abcd-abcd-abcd-123456789abc&seen=-2']) assert.equal(parseDeckQuery(new URL('http://local/api?'+query)),null);
});
test('horizontal swipe chooses; small/vertical motion cannot convert scrolling into interest',()=>{
  assert.equal(swipeDecision(100,5),'interested');assert.equal(swipeDecision(-100,5),'not-for-me');
  assert.equal(swipeDecision(50,5),null);assert.equal(swipeDecision(80,100),null);assert.equal(swipeDecision(80,70),null);
});
