import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import { loadPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
import { clearBookDescriptionCacheForTests } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';

const book = { workId: '1', openLibraryWorkId: 'OL893415W', editionLanguage: 'eng',openLibraryEditionId:'OL123M' } as Book;

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
    return new Response(JSON.stringify({works:[{key:'/works/OL893415W'}],languages:[{key:'/languages/eng'}], description: '<p>Public synopsis.</p><script>private()</script>' }));
  };
  const first = await loadPublicBookDescription(book, 'en', fetcher);
  assert.equal(first?.text, 'Public synopsis.');
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
    works: [{key:'/works/OL893415W'}], languages:[{key:'/languages/nld'}], description:'Een Nederlandse beschrijving.',
  })));
  assert.equal(description?.language, 'nl');
  assert.equal(description?.text, 'Een Nederlandse beschrijving.');
});

test('attribution links cannot expose arbitrary source URLs or credentials', () => {
  const base = { text: 'Text', language: 'en', verifiedAt:'2026-10-07', source:'open_library' } as const;
  assert.equal(publicDescriptionSource({ ...base, sourceKey:'https://private.invalid/secret' }), null);
  assert.equal(publicDescriptionSource({ ...base, source:'google_books', sourceKey:'9780441172719' })?.href, 'https://books.google.com/books?vid=ISBN9780441172719');
});
