import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import { getStoredPublicBookDescription, loadPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
import { clearBookDescriptionCacheForTests } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';
import {publicDescriptionCacheControl} from './description-cache.ts';

const book = { workId: '1', openLibraryWorkId: 'OL893415W', editionLanguage: 'eng',openLibraryEditionId:'OL123M' } as Book;
const enCopy='A young reader discovers that the story of her family is not what she expected. With the help of a friend, she follows the clues through the city while the people around her try to keep their secrets. She must decide who she can trust and what the truth will mean for her future.';
const nlCopy='Een jonge lezer ontdekt dat het verhaal van haar familie anders is dan zij dacht. Met de hulp van een vriend volgt zij de aanwijzingen door de stad, terwijl de mensen om haar heen hun geheimen proberen te bewaren. Zij moet beslissen wie zij kan vertrouwen en wat de waarheid voor haar toekomst betekent.';

test('stored original description renders without providers; withdrawals/failures have bounded public cache',async()=>{
 const description={text:'A reviewed original summary that remains available during a provider outage.',language:'en' as const,
  source:'official_publisher' as const,sourceKey:'https://example.com/book',sourceUrl:'https://example.com/book',sourceName:'Verified publisher',verifiedAt:'2026-10-30'};
 let calls=0;const failed:typeof fetch=async()=>{calls++;throw Error('Provider unavailable');};
 assert.equal(getStoredPublicBookDescription({...book,storedDescription:description},'en')?.text,description.text);
 assert.equal(getStoredPublicBookDescription({...book,storedDescription:description},'nl'),null);
 assert.equal(getStoredPublicBookDescription({...book,editionAvailable:false,storedDescription:description},'en'),null);
 assert.equal(getStoredPublicBookDescription({...book,storedDescription:{...description,text:'Service unavailable'}},'en'),null);
 assert.equal((await loadPublicBookDescriptionState({...book,storedDescription:description},'en',failed)).description?.text,description.text);
 assert.equal((await loadPublicBookDescriptionState({...book,storedDescription:description,englishEditionFallback:true},'nl',failed)).description,null);
 assert.equal(calls,0);
 assert.match(publicDescriptionCacheControl('resolved'),/s-maxage=300/);
 assert.equal(publicDescriptionCacheControl('temporary_failure'),'public, max-age=0, s-maxage=60');
 assert.equal(publicDescriptionCacheControl('confirmed_missing'),'public, max-age=60, s-maxage=300');
});

test('public UI distinguishes absence, source failure and unavailable edition; timeouts are not retried', async () => {
  clearBookDescriptionCacheForTests();
  let calls=0;
  const timeout:typeof fetch=async()=>{calls++;throw new DOMException('Budget exhausted','TimeoutError')};
  assert.deepEqual(await loadPublicBookDescriptionState(book,'en',timeout),{state:'temporary_failure',description:null});
  assert.equal(calls,1);
  assert.equal((await loadPublicBookDescriptionState(book,'en',timeout)).state,'temporary_failure');
  assert.equal(calls,1,'short-lived failure cache deduplicates source calls, not permanent absence');
  clearBookDescriptionCacheForTests();
  assert.deepEqual(await loadPublicBookDescriptionState(book,'en',async()=>new Response('',{status:404})),{state:'confirmed_missing',description:null});
  assert.deepEqual(await loadPublicBookDescriptionState({...book,editionAvailable:false},'en',timeout),{state:'confirmed_missing',description:null});
  assert.equal(calls,1,'unavailable edition does not request a synopsis');
});

test('SSR loader resolves sanitized public text once, with locale-separated cache and an abort budget', async () => {
  clearBookDescriptionCacheForTests();
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(new URL(String(input)).origin, 'https://openlibrary.org');
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(JSON.stringify({works:[{key:'/works/OL893415W'}],languages:[{key:'/languages/eng'}], description: `<p>${enCopy}</p><script>private()</script>` }));
  };
  const first = await loadPublicBookDescription(book, 'en', fetcher);
  assert.equal(first?.text, enCopy);
  assert.equal(first?.language, 'en');
  assert.deepEqual(publicDescriptionSource(first!), { name: 'Open Library', href: 'https://openlibrary.org/books/OL123M' });
  assert.equal((await loadPublicBookDescription(book, 'en', fetcher))?.text, first?.text);
  assert.equal(calls, 1);
  assert.equal(await loadPublicBookDescription(book, 'nl', fetcher), null);
  assert.equal(calls, 1, 'cached English copy does not authorize display on an NL page without a fallback edition');
});

test('Dutch SSR copy requires an exact Dutch edition linked to the Work', async () => {
  clearBookDescriptionCacheForTests();
  const description = await loadPublicBookDescription({ ...book, openLibraryEditionId: 'OL123M', editionLanguage: 'nld' }, 'nl', async () => new Response(JSON.stringify({
    works: [{key:'/works/OL893415W'}], languages:[{key:'/languages/nld'}], description:nlCopy,
  })));
  assert.equal(description?.language, 'nl');
  assert.equal(description?.text, nlCopy);
});

test('attribution links cannot expose arbitrary source URLs or credentials', () => {
  const base = { text: 'Text', language: 'en', verifiedAt:'2026-10-07', source:'open_library' } as const;
  assert.equal(publicDescriptionSource({ ...base, sourceKey:'https://private.invalid/secret' }), null);
  assert.equal(publicDescriptionSource({ ...base, source:'google_books', sourceKey:'9780441172719' })?.href, 'https://books.google.com/books?vid=ISBN9780441172719');
});

test('a storage outage plus a missing external response is temporary, never cached as catalogue absence',async()=>{
 clearBookDescriptionCacheForTests();
 const result=await loadPublicBookDescriptionState({...book,storedPresentationUnavailable:true},'en',async()=>new Response('',{status:404}));
 assert.equal(result.state,'temporary_failure');assert.equal(result.description,null);
});

test('provider quota cooldown covers different ISBNs, expires and preserves reviewed text',async()=>{
 clearBookDescriptionCacheForTests();const realNow=Date.now;let now=realNow(),calls=0;
 Date.now=()=>now;
 const lookup=(isbn13:string)=>({workId:'quota-'+isbn13,isbn13,editionLanguage:'eng'} as Book);
 const fetcher:typeof fetch=async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'60'}});};
 try{
  assert.equal((await loadPublicBookDescriptionState(lookup('9780141439518'),'en',fetcher)).state,'temporary_failure');
  assert.equal((await loadPublicBookDescriptionState(lookup('9780441172719'),'en',fetcher)).state,'temporary_failure');
  assert.equal(calls,1,'a distinct ISBN does not retry a known shared provider rejection');
  const stored={text:enCopy,language:'en' as const,source:'official_catalog' as const,sourceKey:'https://example.com/book',sourceUrl:'https://example.com/book',sourceName:'Reviewed catalogue',verifiedAt:'2026-11-07'};
  assert.equal((await loadPublicBookDescriptionState({...lookup('9780593135204'),storedDescription:stored},'en',fetcher)).description?.text,enCopy);
  assert.equal(calls,1,'stored reviewed text bypasses the failed provider');
  now+=60_001;
  assert.equal((await loadPublicBookDescriptionState(lookup('9780593135204'),'en',fetcher)).state,'temporary_failure');
  assert.equal(calls,2,'new request permitted after the explicit provider wait; still never absence');
 }finally{Date.now=realNow;clearBookDescriptionCacheForTests();}
});

test('quota Retry-After dates, missing and invalid values are bounded without becoming missing content',async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 try{for(const makeHeader of[()=>undefined,()=>'-1',()=>new Date(now+120_000).toUTCString(),()=>'999999999999999999999999']){
  const header=makeHeader();
  clearBookDescriptionCacheForTests();let calls=0;const fetcher:typeof fetch=async()=>{calls++;return new Response('{}',{status:429,headers:header?{'Retry-After':header}:{}});};
  const lookup=(isbn13:string)=>({...book,openLibraryEditionId:null,isbn13});
  assert.equal((await loadPublicBookDescriptionState(lookup('9780141439518'),'en',fetcher)).state,'temporary_failure');
  now+=2_000;assert.equal((await loadPublicBookDescriptionState(lookup('9780441172719'),'en',fetcher)).state,'temporary_failure');assert.equal(calls,1);
  now+=24*60*60*1_000+1;
  await loadPublicBookDescriptionState(lookup('9780593135204'),'en',fetcher);assert.equal(calls,2,'even extreme upstream waits expire');
 }}finally{Date.now=realNow;clearBookDescriptionCacheForTests();}
});

test('simultaneous different book lookups limit the initial provider burst and retain temporary states',async()=>{
 clearBookDescriptionCacheForTests();let calls=0,active=0,peak=0;let finish!:()=>void;
 const pending=new Promise<void>(resolve=>{finish=resolve;});
 const fetcher:typeof fetch=async()=>{calls++;active++;peak=Math.max(peak,active);await pending;active--;return new Response('{}',{status:429});};
 const isbns=['9780141439518','9780441172719','9780593135204','9780553293357','9780061120084','9780747532699'];
 const results=isbns.map(isbn13=>loadPublicBookDescriptionState({workId:'synthetic-'+isbn13,isbn13,editionLanguage:'eng'} as Book,'en',fetcher));
 await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls,2);finish();
 assert.ok((await Promise.all(results)).every(r=>r.state==='temporary_failure'));assert.equal(peak,2);assert.equal(calls,2);
 clearBookDescriptionCacheForTests();
});

test('simultaneous identical book lookups share the existing in-flight success cache',async()=>{
 clearBookDescriptionCacheForTests();let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;await new Promise<void>(resolve=>setImmediate(resolve));return new Response(JSON.stringify({works:[{key:'/works/OL893415W'}],languages:[{key:'/languages/eng'}],description:enCopy}));};
 const results=await Promise.all(Array.from({length:30},()=>loadPublicBookDescriptionState(book,'en',fetcher)));
 assert.equal(calls,1);assert.ok(results.every(r=>r.description?.text===enCopy));clearBookDescriptionCacheForTests();
});

test('404, server faults and network faults do not become shared quota or durable absence',async()=>{
 for(const fault of[404,410,500,503,'network','timeout'] as const){
  clearBookDescriptionCacheForTests();let calls=0;
  const failing:typeof fetch=async()=>{calls++;if(fault==='network')throw new TypeError('Synthetic network');if(fault==='timeout')throw new DOMException('Synthetic deadline','TimeoutError');return new Response('{}',{status:fault});};
  const first={workId:'synthetic-first',isbn13:'9780141439518',editionLanguage:'eng'} as Book;
  assert.equal((await loadPublicBookDescriptionState(first,'en',failing)).state,typeof fault==='number'&&fault<500?'confirmed_missing':'temporary_failure');
  assert.equal(calls,fault===500||fault===503||fault==='network'?3:1);
  const before=calls;
  const next=await loadPublicBookDescriptionState({...first,workId:'synthetic-next',isbn13:'9780441172719'},'en',async()=>{calls++;return new Response(JSON.stringify({items:[]}));});
  assert.equal(calls,before+1,'a different book can still use this provider');assert.equal(next.state,'confirmed_missing');
 }
 clearBookDescriptionCacheForTests();
});

test('503 Retry-After is a temporary service instruction, not missing content or an eager retry',async()=>{
 clearBookDescriptionCacheForTests();let calls=0;
 const lookup=(isbn13:string)=>({workId:'synthetic-'+isbn13,isbn13,editionLanguage:'eng'} as Book);
 const fetcher:typeof fetch=async()=>{calls++;return new Response('{}',{status:503,headers:{'Retry-After':'30'}});};
 assert.equal((await loadPublicBookDescriptionState(lookup('9780141439518'),'en',fetcher)).state,'temporary_failure');
 assert.equal((await loadPublicBookDescriptionState(lookup('9780441172719'),'en',fetcher)).state,'temporary_failure');
 assert.equal(calls,1);
 clearBookDescriptionCacheForTests();
});


test('withdrawal blocks even a warm provider cache; a read outage fails temporarily, not to a new provider import',async()=>{
 clearBookDescriptionCacheForTests();
 const exact={...book,workId:'1',authorId:'2',editionId:'3',editionAvailable:true,strictEditionLanguage:'en',editionTitle:'A verified book'} as Book;
 const {createDescriptionSnapshot}=await import('./description-snapshot.ts');
 const row=createDescriptionSnapshot(exact,'en',{text:enCopy,language:'en',source:'open_library',sourceKey:'OL123M',verifiedAt:new Date().toISOString()})!;
 assert.ok(row);let calls=0,writes=0,checks=0;
 const provider:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({title:'A verified book',works:[{key:'/works/OL893415W'}],languages:[{key:'/languages/eng'}],description:enCopy}));};
 let current:typeof row|null=null;
 const store={loadDescriptionSnapshot:async()=>{checks++;return current;},saveDescriptionSnapshot:async()=>{writes++;},markDescriptionSnapshotFailure:async()=>{throw Error('must not mark withdrawal');}};
 assert.equal((await loadPublicBookDescriptionState(exact,'en',provider,store)).state,'resolved');assert.equal(calls,1);
 current={...row,text:null,provider_status:'withdrawn'};
 for(let i=0;i<3;i++)assert.deepEqual(await loadPublicBookDescriptionState(exact,'en',provider,store),{state:'confirmed_missing',description:null});
 assert.equal(calls,1);assert.equal(writes,1);assert.equal(checks,4,'disposition checked before cached provider text');
 const failed={...store,loadDescriptionSnapshot:async()=>{throw Error('synthetic storage outage');}};
 assert.equal((await loadPublicBookDescriptionState(exact,'en',provider,failed)).state,'temporary_failure');assert.equal(calls,1);
 assert.equal((await loadPublicBookDescriptionState({...exact,storedDescription:{text:enCopy,source:'official_catalog',sourceKey:'https://example.com',sourceUrl:'https://example.com',sourceName:'Reviewed',language:'en',verifiedAt:'2026-11-08'}},'en',provider,failed)).description?.text,enCopy);
 clearBookDescriptionCacheForTests();
});

test('independently reviewed summaries survive OL snapshot outages, stale text and withdrawal',async()=>{
 const exact={workId:'9912',authorId:'42',editionId:'73',editionAvailable:true,strictEditionLanguage:'en',
  title:'10 Things I Hate About You',editionTitle:'10 Things I Hate About You',author:'David Levithan',
  isbn13:'9780439087308',editionLanguage:'eng',openLibraryWorkId:'OL123W',openLibraryEditionId:'OL123M'} as Book;
 const {createDescriptionSnapshot}=await import('./description-snapshot.ts');
 const {getReviewedDescription}=await import('./reviewed-descriptions.ts');
 const row=createDescriptionSnapshot(exact,'en',{text:enCopy,language:'en',source:'open_library',sourceKey:'OL123M',verifiedAt:new Date().toISOString()})!;
 assert.ok(row);
 const expected=getReviewedDescription(exact,'en');assert.ok(expected);
 let reads=0,providerCalls=0,writes=0;
 const provider:typeof fetch=async()=>{providerCalls++;throw Error('Provider unavailable');};
 for(const disposition of ['outage','resolved','temporary_failure','withdrawn'] as const){
  const store={loadDescriptionSnapshot:async()=>{reads++;if(disposition==='outage')throw Error('Snapshot outage');
    return {...row,provider_status:disposition,text:disposition==='withdrawn'?null:row.text};},
   saveDescriptionSnapshot:async()=>{writes++;},markDescriptionSnapshotFailure:async()=>{writes++;}};
  assert.deepEqual(await loadPublicBookDescriptionState(exact,'en',provider,store),{state:'resolved',description:expected});
 }
 assert.equal(reads,0);assert.equal(providerCalls,0);assert.equal(writes,0);
 const central={text:enCopy,language:'en' as const,source:'official_catalog' as const,sourceKey:'https://example.com/book',sourceUrl:'https://example.com/book',sourceName:'Central review',verifiedAt:'2026-11-08'};
 assert.equal((await loadPublicBookDescriptionState({...exact,storedDescription:central},'en',provider)).description?.text,enCopy,'central reviewed content still takes precedence');
 assert.deepEqual(await loadPublicBookDescriptionState({...exact,editionAvailable:false},'en',provider),{state:'confirmed_missing',description:null});
});
