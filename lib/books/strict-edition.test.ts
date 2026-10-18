import test from 'node:test';
import assert from 'node:assert/strict';
import type { Book } from '../../app/data/books.ts';
import { selectStrictEdition, withStrictEdition, type StrictEditionRow } from './strict-edition.ts';
import { getInitialBookCoverUrls, getBookCoverIdentity } from './book-cover-state.ts';

const book: Book = { id: '1', workId: '1', source: 'supabase', title: 'English canonical', author: 'Synthetic', score: null, match: null, ratingsCount: null, cover: 'orbit',
  coverUrls: ['https://example.invalid/french-cover.jpg'], openLibraryWorkId: 'OL1W' };
const edition = (language: string | null, extra: Partial<StrictEditionRow> = {}): StrictEditionRow => ({ id: 1, title: 'Nederlandse editietitel', language, isbn_13: '9789041416841', open_library_edition_id: 'OL1M', ...extra });
test('strict edition language is explicit, never inferred from title, ISBN or original Work language', () => {
  for (const language of [null, '', 'fr', 'ger']) assert.equal(selectStrictEdition([edition(language)], 'nl', book.title), null);
  for (const language of ['nl', 'nld', 'dut', '/languages/dut', 'DUTCH']) assert.ok(selectStrictEdition([edition(language)], 'nl', book.title));
  assert.equal(selectStrictEdition([edition('nld')], 'en', book.title), null);
  assert.equal(selectStrictEdition([edition('eng', { title: null })], 'en', book.title), null);
  assert.equal(selectStrictEdition([edition('eng', { title: 'Synthetic omnibus box set' })], 'en', book.title), null);
});
test('selected edition owns displayed title and cover candidates; Work/French covers never return', () => {
  const strict = withStrictEdition(book, edition('nld'), 'nl', [
    { state: 'resolved', source_key: 'OL1W', cover_url: 'https://example.invalid/work-fr.jpg' },
    { state: 'resolved', source_key: 'OL1M', cover_url: 'https://example.invalid/edition-nl.jpg',editionVerified:true },
  ])!;
  assert.equal(strict.title, 'Nederlandse editietitel'); assert.equal(strict.editionId, '1');
  assert.equal(getInitialBookCoverUrls(strict)[0], 'https://example.invalid/edition-nl.jpg');
  assert.equal(strict.coverUrls?.some(u => u.includes('french') || u.includes('work-fr') || u.includes('999')), false);
});
test('no exact cover identity gives neutral fallback, not a Work-level fallback', () => {
  const strict = withStrictEdition(book, edition('nld', { isbn_13: null, open_library_edition_id: null }), 'nl')!;
  assert.deepEqual(strict.coverUrls, []); assert.deepEqual(getInitialBookCoverUrls(strict), []);
  assert.equal(withStrictEdition(book, edition('nld'), 'en'), null);
});
test('switching editions/language for the same Work invalidates reused cover state even without an ISBN', () => {
  const nl = withStrictEdition(book, edition('nld', { id: 1, isbn_13: null }), 'nl')!;
  const en = withStrictEdition(book, edition('eng', { id: 2, isbn_13: null }), 'en')!;
  assert.notEqual(getBookCoverIdentity(nl), getBookCoverIdentity(en));
});
test('a Work OLID incorrectly stored in an edition field cannot revive a Work-keyed cover', () => {
  const strict = withStrictEdition(book, edition('nld', { open_library_edition_id: 'OL1W', isbn_13: null }), 'nl', [
    { state: 'resolved', source_key: 'OL1W', cover_url: 'https://example.invalid/french-work.jpg' },
  ])!;
  assert.equal(strict.openLibraryEditionId, null); assert.deepEqual(strict.coverUrls, []);
});
