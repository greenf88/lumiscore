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
