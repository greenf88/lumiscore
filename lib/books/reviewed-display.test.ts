import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { applyReviewedBookDisplay } from './reviewed-display.ts';
import { withStrictEdition } from './strict-edition.ts';
import { bookPageJsonLd } from '../seo/book-json-ld.ts';
import { descriptionBinding } from './description-snapshot.ts';

// Identity recorded from the live selected edition before the correction.
const original: Book = {
  id: 'work-8027', source: 'supabase', workId: '8027', authorId: '4821', editionId: '8186',
  title: 'The Death of Truth [Hardcover] Michiko Kakutani',
  editionTitle: 'The Death of Truth [Hardcover] Michiko Kakutani',
  author: 'michiko kakutani', isbn13: '9780008312787', editionLanguage: 'eng',
  editionAvailable: true, strictEditionLanguage: 'en',
  openLibraryWorkId: 'OL99999W', openLibraryEditionId: 'OL27846520M',
  score: null, ratingsCount: null, match: null, cover: 'orbit',
};

test('exact edition displays a clean title consistently without changing source binding', () => {
  const corrected = withStrictEdition(original, { id: '8186', work_id: '8027',
    title: original.editionTitle!, language: 'eng', isbn_13: original.isbn13!,
    open_library_edition_id: original.openLibraryEditionId! }, 'en')!;
  assert.equal(corrected.title, 'The Death of Truth');
  assert.equal(corrected.author, 'Michiko Kakutani');
  assert.equal(corrected.editionTitle, original.editionTitle);
  assert.equal(descriptionBinding(corrected, 'en'), descriptionBinding(original, 'en'));
  const graph = bookPageJsonLd(corrected, 'en')['@graph'];
  assert.equal(graph.find(node => node['@type'] === 'WebPage')?.name, corrected.title);
  assert.equal(graph.find(node => node['@id'] === 'https://lumisco.re/#edition-8186')?.name, corrected.title);
  assert.equal(graph.find(node => node['@type'] === 'Person')?.name, corrected.author);
  assert.equal(original.title, original.editionTitle, 'the source object stays unchanged');
});

test('similar title, different ISBN/author/language or unavailable edition is never rewritten', () => {
  for (const patch of [
    { isbn13: '9780525574828' }, { isbn13: null }, { author: 'Another author' },
    { editionTitle: 'The Death of Truth' }, { editionTitle: null },
    { editionLanguage: 'nld' }, { editionLanguage: null },
    { editionAvailable: false }, { strictEditionLanguage: 'nl' as const },
  ]) {
    const book = { ...original, ...patch };
    assert.equal(applyReviewedBookDisplay(book, 'en'), book);
  }
  assert.equal(applyReviewedBookDisplay(original, 'nl'), original);
});
