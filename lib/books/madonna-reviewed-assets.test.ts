import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { selectStrictEdition, withStrictEdition, unavailableEdition } from './strict-edition.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';
import { getReviewedDescription } from './reviewed-descriptions.ts';
import { loadPublicBookDescription } from './public-description.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';
import { normalizeVerifiedBookDescription } from './description-text.ts';

// Public production identity read on 2026-10-18. No user data or DB mutations.
const work: Book = { id: 'work-1305', workId: '1305', title: 'Madonna', author: 'Suzanne Vermeer',
  source: 'supabase', cover: 'orbit', score: null, ratingsCount: null, match: null };
const edition = { id: 1305, work_id: 1305, title: 'Madonna', language: 'nld',
  isbn_13: '9789044970791', open_library_edition_id: null, publisher: 'A.W. Bruna Uitgevers' };
const book = withStrictEdition(work, selectStrictEdition([edition], 'nl', work.title), 'nl')!;
const lookup = { ...book, locale: 'nl' as const };
const noNetwork: typeof fetch = async () => { throw new Error('No provider fetch expected'); };

test('Madonna resolves the reviewed exact e-book cover through shared edition presentation', () => {
  assert.equal(book.workId, '1305');
  assert.equal(book.editionId, '1305');
  assert.equal(book.editionLanguage, 'nld');
  assert.equal(book.isbn13, '9789044970791');
  assert.deepEqual(book.coverUrls, [getReviewedCoverOverride(book)?.coverUrl]);
  assert.match(book.coverUrls![0], /b6bd674d8e0e6381e637a31d0b0022af-364x0/);
});

test('publisher description is shared by SSR and API resolver without remote requests', async () => {
  const ssr = await loadPublicBookDescription(book, 'nl', noNetwork);
  const api = await resolveBookDescription(lookup, noNetwork);
  assert.deepEqual(api.description, ssr);
  assert.equal(api.state, 'resolved');
  assert.equal(ssr?.language, 'nl');
  assert.match(ssr!.text, /Ingrid/);
  assert.match(ssr!.text, /De bestemming/);
  assert.deepEqual(normalizeVerifiedBookDescription(ssr), ssr);
  assert.deepEqual(publicDescriptionSource(ssr!), {
    name: 'A.W. Bruna Uitgevers', href: 'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/madonna/',
  });
});

test('reviewed synopsis cannot leak across Work, edition, title, author, ISBN or language', () => {
  for (const mismatch of [{workId:'1306'}, {editionId:'1306'}, {editionTitle:'Other title'},
    {author:'Other author'}, {isbn13:'9789046172841'}, {editionLanguage:'eng'}, {editionLanguage:null}]) {
    assert.equal(getReviewedDescription({...lookup, ...mismatch}, 'nl'), null);
  }
  assert.equal(getReviewedDescription(lookup, 'en'), null);
});

test('Dutch-only Madonna remains unavailable in English, without a cover or synopsis', async () => {
  assert.equal(selectStrictEdition([edition], 'en', work.title), null);
  assert.equal(withStrictEdition(work, edition, 'en'), null);
  const english = unavailableEdition(work, 'en');
  assert.equal(english.workId, '1305');
  assert.deepEqual(english.coverUrls, []);
  assert.equal(await loadPublicBookDescription(english, 'en', noNetwork), null);
  assert.equal(getReviewedCoverOverride(english), null);
  assert.equal(getReviewedCoverOverride({...book, isbn13:'9789046172841'}), null);
});

test('publisher attribution accepts only the explicitly reviewed public source', () => {
  const value = getReviewedDescription(lookup, 'nl')!;
  for (const sourceKey of ['https://private.invalid/token', '9789046172841', 'javascript:alert(1)']) {
    assert.equal(publicDescriptionSource({...value, sourceKey}), null);
    assert.equal(normalizeVerifiedBookDescription({...value, sourceKey}), null);
  }
});
