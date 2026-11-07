import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewedPresentationCache} from './reviewed-presentation-cache.ts';
import {applyStoredPresentation,storedPresentationSelection,type StoredDescription} from './stored-presentation.ts';
import {loadPublicBookDescriptionState} from './public-description.ts';

test('reviewed cache coalesces simultaneous reads and keeps the ordinary 30s fresh bound',async()=>{
 let now=0,calls=0;const cache=new ReviewedPresentationCache(()=>now);
 const load=async()=>{calls++;return {text:'reviewed'};};
 const rows=await Promise.all(Array.from({length:20},()=>cache.get('nl:work1:edition1',load)));
 assert.equal(calls,1);assert(rows.every(r=>r===rows[0]));
 now=29_999;await cache.get('nl:work1:edition1',load);assert.equal(calls,1);
 now=30_001;await cache.get('nl:work1:edition1',load);assert.equal(calls,2);
});
test('temporary refresh failure keeps the reviewed value, bounds retries and never extends stale age',async()=>{
 let now=0,calls=0;const cache=new ReviewedPresentationCache(()=>now);
 await cache.get('en:1',async()=>({text:'approved'}));
 const fail=async()=>{calls++;throw new Error('Synthetic timeout');};
 now=31_000;assert.equal((await cache.get('en:1',fail)).text,'approved');
 now=34_000;await cache.get('en:1',fail);assert.equal(calls,1);
 now=36_001;await cache.get('en:1',fail);assert.equal(calls,2);
 now=300_001;await assert.rejects(cache.get('en:1',fail),/Synthetic timeout/);
});
test('a cold failure is not stored as an empty or approved result; recovery works immediately',async()=>{
 const cache=new ReviewedPresentationCache();let calls=0;
 await assert.rejects(cache.get('en:1',async()=>{calls++;throw new Error('synthetic unavailable');}));
 assert.deepEqual(await cache.get('en:1',async()=>{calls++;return [];}),[]);assert.equal(calls,2);
});
test('a successful empty/revoked read replaces old text and a later failure cannot resurrect it',async()=>{
 let now=0;const cache=new ReviewedPresentationCache<string[]>(()=>now);
 await cache.get('en:1',async()=>['approved']);now=31_000;
 assert.deepEqual(await cache.get('en:1',async()=>[]),[]);
 now=62_000;assert.deepEqual(await cache.get('en:1',async()=>{throw new Error('synthetic');}),[]);
});
test('invalidation cannot be undone by an older request completing later',async()=>{
 const cache=new ReviewedPresentationCache<string>();let finish!:(v:string)=>void;
 const old=cache.get('en:1',()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();cache.invalidate('en:1');
 assert.equal(await cache.get('en:1',async()=>'corrected'),'corrected');
 finish('old');assert.equal(await old,'old');
 assert.equal(await cache.get('en:1',async()=>'unexpected'),'corrected');
});
test('bounded eviction cannot resurrect an evicted entry from its in-flight completion',async()=>{
 const cache=new ReviewedPresentationCache<string>(()=>0,30_000,300_000,5_000,1);let finish!:(v:string)=>void;
 const old=cache.get('a',()=>new Promise(resolve=>{finish=resolve;}));await Promise.resolve();
 await cache.get('b',async()=>'b');finish('a');await old;let calls=0;
 await cache.get('a',async()=>{calls++;return 'new a';});assert.equal(calls,1);
});
test('last-known-good rows still pass current author/edition/locale guards and bypass unavailable providers',async()=>{
 let now=0;const cache=new ReviewedPresentationCache<{descriptions:StoredDescription[]}>(()=>now);
 const row:StoredDescription={work_id:42,language:'en',bound_author_id:7,text:'A reviewed English summary about this synthetic book and its central conflict, kept in durable storage with a verified public source.',source_type:'official_catalog',source_name:'Fixture library',source_url:'https://example.org/books/42',reviewed_at:'2026-11-07T00:00:00Z',review_status:'approved'};
 const book={workId:'42',authorId:'7',editionId:'43',editionAvailable:true,title:'Fixture',author:'Author',editionTitle:'Fixture',editionLanguage:'eng',isbn13:'9780141439471'};
 const key=storedPresentationSelection([book],'en').key;
 await cache.get(key,async()=>({descriptions:[row]}));now=31_000;
 const data=await cache.get(key,async()=>{throw new Error('Synthetic storage503');});
 const selected=applyStoredPresentation([book],'en',data.descriptions,[])[0];
 let upstream=0;const result=await loadPublicBookDescriptionState(selected,'en',async()=>{upstream++;throw new Error('Synthetic provider429');});
 assert.equal(result.state,'resolved');assert.equal(result.description?.text,row.text);assert.equal(upstream,0);
 assert.equal(applyStoredPresentation([{...book,authorId:'8'}],'en',data.descriptions,[])[0].storedDescription,undefined);
 assert.equal(applyStoredPresentation([book],'nl',data.descriptions,[])[0].storedDescription,undefined);
 assert.equal(applyStoredPresentation([{...book,editionAvailable:false}],'en',data.descriptions,[])[0].storedDescription,undefined);
 assert.notEqual(storedPresentationSelection([book],'en').key,storedPresentationSelection([{...book,editionId:'44'}],'en').key);
});

