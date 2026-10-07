import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import { loadPublicBookDescription } from './public-description.ts';
import { clearBookDescriptionCacheForTests } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';

const book = { workId: '1', openLibraryWorkId: 'OL893415W', editionLanguage: 'eng' } as Book;

test('SSR loader resolves sanitized public text once, with locale-separated cache and an abort budget', async () => {
  clearBookDescriptionCacheForTests();
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(new URL(String(input)).origin, 'https://openlibrary.org');
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ description: '<p>Public synopsis.</p><script>private()</script>' }));
  };
  const first = await loadPublicBookDescription(book, 'en', fetcher);
  assert.equal(first?.text, 'Public synopsis.');
  assert.equal(first?.language, 'en');
  assert.deepEqual(publicDescriptionSource(first!), { name: 'Open Library', href: 'https://openlibrary.org/works/OL893415W' });
  assert.equal((await loadPublicBookDescription(book, 'en', fetcher))?.text, first?.text);
  assert.equal(calls, 1);
  assert.equal(await loadPublicBookDescription(book, 'nl', fetcher), null);
  assert.equal(calls, 1, 'do not infer synopsis language from work edition languages');
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
