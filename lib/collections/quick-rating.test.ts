import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueCollectionBooks, quickRatingStorageKey, reconcileQuickSession, quickRatingProgress} from './quick-rating.ts';
import {createRoundActionGate, isPendingWorkScore} from '../taste-test/direct-rating.ts';
import type {CollectionBook} from './model.ts';
import {translate} from '../i18n/translations.ts';
const books = ['1','2','2','3'].map(workId => ({workId, book: {workId, title: workId}})) as CollectionBook[];
const session = (raw: unknown = null, rated = ['1']) => reconcileQuickSession(raw,'alice','collection', ['1','2','3'],rated);

test('real member identities deduplicated in original order; mismatched editions not admitted', () => {
  assert.deepEqual(uniqueCollectionBooks([...books,{workId:'4',book:{workId:'5'}} as CollectionBook]).map(book => book.workId),['1','2','3']);
});
test('user and collection namespace, malformed and cross-user local progress are discarded', () => {
  assert.notEqual(quickRatingStorageKey('alice','a'), quickRatingStorageKey('bob','a'));
  assert.notEqual(quickRatingStorageKey('alice','a'), quickRatingStorageKey('alice','b'));
  for(const raw of [null, {}, '{bad', {version:1,userId:'bob',collectionId:'collection',skippedIds:['2']}]) assert.deepEqual(session(raw),session());
});
test('resume checks current members and server ratings; storage cannot create a rating', () => {
  const next=session({...session(),newRatedIds:['2','2','4'],skippedIds:['2','3','4']},['1','2']);
  assert.deepEqual(next.newRatedIds,['2']);assert.deepEqual(next.skippedIds,['3']);
  const removed=reconcileQuickSession(next,'alice','collection',['1','3'],['1','2']);
  assert.deepEqual(removed.newRatedIds,[]);
  assert.deepEqual(session({...session(),newRatedIds:['3']}).newRatedIds,[]);
});
test('previous ratings separate from new; skips lower remaining but never raise rated', () => {
  const s=session();let p=quickRatingProgress(books,['1'],s);
  assert.equal(p.previouslyRated,1);assert.equal(p.newRated,0);assert.equal(p.remaining.length,2);
  p=quickRatingProgress(books,['1'],{...s,skippedIds:['2']});
  assert.equal(p.remaining.length,1);assert.equal(p.newRated,0);assert.equal(p.viewed,1);
  p=quickRatingProgress(books,['1','3'],{...s,newRatedIds:['3'],skippedIds:['2']});
  assert.equal(p.newRated,1);assert.equal(p.previouslyRated,1);assert.equal(p.remaining.length,0);assert.equal(p.skipped,1);
});
test('empty, all already rated, all skipped and deliberate restart never invent ratings', () => {
  assert.equal(quickRatingProgress([],[],session()).total,0);
  assert.equal(quickRatingProgress(books,['1','2','3'],session()).remaining.length,0);
  const all=quickRatingProgress(books,[],{...session(),skippedIds:['1','2','3']});
  assert.equal(all.newRated,0);assert.equal(all.remaining.length,0);assert.equal(all.skipped,3);
  assert.equal(quickRatingProgress(books,['1'],session()).remaining.length,2);
});
test('failure/double tap/late response: no book swap before accepted save, gate holds through cooldown', async () => {
  let resolve!: (value:string)=>void, release!: ()=>void, writes=0, current='2';
  const network=new Promise<string>(r=>{resolve=r;}), cooldown=new Promise<void>(r=>{release=r;});
  const gate=createRoundActionGate(()=>cooldown);
  const action=()=>gate.run(async()=>{writes++;return network;},next=>{current=next;},assert.fail,()=>{});
  const first=action();assert.equal(current,'2');assert.equal(await action(),false);assert.equal(writes,1);
  resolve('3');await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(current,'3');assert.equal(await action(),false);assert.equal(isPendingWorkScore({workId:'2',score:8},current,8,true),false);
  release();await first;
  let errors=0;await gate.run(async()=>{throw Error();},()=>assert.fail(),()=>{errors++;},()=>{});
  assert.equal(errors,1);assert.equal(current,'3');assert.equal(writes,1);
});
test('NL/EN round totals and zero completion interpolate cleanly',()=>{
  for(const locale of ['nl','en'] as const)for(const key of ['quickCollection.progress','quickCollection.result','quickCollection.existing'] as const){
    const text=translate(locale,key,{rated:0,remaining:2,count:0});assert.doesNotMatch(text,/[{}]/);assert.match(text,/0/);
  }
});
