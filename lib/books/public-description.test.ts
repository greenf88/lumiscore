import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import { loadPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
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
