import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { rankCatalogSearchResults, reviewedCoauthorSearchKeys } from '../books/catalog-search.ts';
import { bookAuthorByline, REVIEWED_COAUTHORS } from './reviewed-coauthors.ts';

test('Mismatch credits and finds Mark van Vugt on the verified English paperback', () => {
  const book: Book = { id: 'work-1787', source: 'supabase', workId: '1787', title: 'Mismatch',
    author: 'Ronald Giphart', isbn13: '9781472139702', cover: 'orbit', score: null, match: null, ratingsCount: null };
  const other = { ...book, isbn13: '9781472139719' };
  assert.equal(bookAuthorByline(book, 'en'), 'Ronald Giphart and Mark van Vugt');
  assert.equal(bookAuthorByline(other, 'en'), 'Ronald Giphart');
  assert.equal(bookAuthorByline({ ...book, author: 'Another author' }, 'en'), 'Another author');
  assert.deepEqual(reviewedCoauthorSearchKeys('Mark van Vugt'), { workIds: [], editionIsbns: ['9781472139702'] });
  assert.deepEqual(rankCatalogSearchResults([other, book], 'Mark van Vugt'), [book]);
});

const books: Book[] = [
  { id: 'work-10473', workId: '10473', title: 'Het Waterpark', author: 'Thomas van Grinsven', source: 'supabase', cover: 'orbit', score: null, match: null, ratingsCount: null },
  { id: 'work-10474', workId: '10474', title: 'Ollie & Moos: Opgeruimd staat netjes', author: 'Mark Haayema', source: 'supabase', cover: 'orbit', score: null, match: null, ratingsCount: null },
];

test('verified coauthors are searchable as authors while primary authors still match', () => {
  for (const [index, credit] of REVIEWED_COAUTHORS.filter(credit => credit.workId).entries()) {
    assert.deepEqual(reviewedCoauthorSearchKeys(credit.name), { workIds: [Number(credit.workId)], editionIsbns: [] });
    assert.deepEqual(rankCatalogSearchResults(books, credit.name, 10), [books[index]]);
    assert.deepEqual(rankCatalogSearchResults(books, credit.primaryAuthor, 10), [books[index]]);
    assert.equal(bookAuthorByline(books[index], 'nl'), [credit.primaryAuthor, credit.name].join(' en '));
  }
  assert.deepEqual(reviewedCoauthorSearchKeys('Sabine van der Stadt'), { workIds: [], editionIsbns: [] });
  assert.deepEqual(reviewedCoauthorSearchKeys('ivan en ilia'), { workIds: [], editionIsbns: [] });
});

test('Alex Khan is credited only on the reviewed paperback with the expected author', () => {
  const paperback: Book = { ...books[0], id: 'work-80', workId: '80', title: 'Haar laatste adem',
    author: 'M.J. Arlidge', isbn13: '9789049213343' };
  const differentEdition = { ...paperback, id: 'work-81', workId: '81', isbn13: '9781398716698' };
  assert.deepEqual(reviewedCoauthorSearchKeys('Alex Khan'), { workIds: [], editionIsbns: ['9789049213343'] });
  assert.deepEqual(reviewedCoauthorSearchKeys('Haar laatste adem'), { workIds: [], editionIsbns: [] });
  assert.deepEqual(rankCatalogSearchResults([differentEdition, paperback], 'Alex Khan'), [paperback]);
  assert.equal(bookAuthorByline(paperback, 'nl'), 'M.J. Arlidge en Alex Khan');
  assert.equal(bookAuthorByline(differentEdition, 'nl'), 'M.J. Arlidge');
  assert.equal(bookAuthorByline({ ...paperback, author: 'Unexpected author' }, 'nl'), 'Unexpected author');
});

test('an unrelated Work or unexpected primary author does not acquire a credit', () => {
  assert.equal(bookAuthorByline({ ...books[0], workId: '30' }, 'nl'), books[0].author);
  assert.equal(bookAuthorByline({ ...books[0], author: 'Unexpected author' }, 'nl'), 'Unexpected author');
});

test('Human + Machine credits and finds Wilson on the verified 2018 edition only', () => {
  const book: Book = { ...books[0], id: 'work-6789', workId: '6789', title: 'Human + machine',
    author: 'Paul R. Daugherty', isbn13: '9781633693869' };
  const otherEdition = { ...book, isbn13: '9781647827203' };
  assert.deepEqual(reviewedCoauthorSearchKeys('H. James Wilson'), { workIds: [], editionIsbns: ['9781633693869'] });
  assert.deepEqual(rankCatalogSearchResults([otherEdition, book], 'H. James Wilson'), [book]);
  assert.equal(bookAuthorByline(book, 'en'), 'Paul R. Daugherty and H. James Wilson');
  assert.equal(bookAuthorByline(book, 'nl'), 'Paul R. Daugherty en H. James Wilson');
  assert.equal(bookAuthorByline(otherEdition, 'en'), 'Paul R. Daugherty');
  assert.equal(bookAuthorByline({ ...book, author: 'Another author' }, 'en'), 'Another author');
});
