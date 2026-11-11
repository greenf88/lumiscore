import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { rankCatalogSearchResults, reviewedCoauthorSearchWorkIds } from '../books/catalog-search.ts';
import { bookAuthorByline, REVIEWED_COAUTHORS } from './reviewed-coauthors.ts';

const books: Book[] = [
  { id: 'work-10473', workId: '10473', title: 'Het Waterpark', author: 'Thomas van Grinsven', source: 'supabase', cover: 'orbit', score: null, match: null, ratingsCount: null },
  { id: 'work-10474', workId: '10474', title: 'Ollie & Moos: Opgeruimd staat netjes', author: 'Mark Haayema', source: 'supabase', cover: 'orbit', score: null, match: null, ratingsCount: null },
];

test('verified coauthors are searchable as authors while primary authors still match', () => {
  for (const [index, credit] of REVIEWED_COAUTHORS.entries()) {
    assert.deepEqual(reviewedCoauthorSearchWorkIds(credit.name), [Number(credit.workId)]);
    assert.deepEqual(rankCatalogSearchResults(books, credit.name, 10), [books[index]]);
    assert.deepEqual(rankCatalogSearchResults(books, credit.primaryAuthor, 10), [books[index]]);
    assert.equal(bookAuthorByline(books[index], 'nl'), [credit.primaryAuthor, credit.name].join(' en '));
  }
  assert.deepEqual(reviewedCoauthorSearchWorkIds('Sabine van der Stadt'), []);
  assert.deepEqual(reviewedCoauthorSearchWorkIds('ivan en ilia'), []);
});

test('an unrelated Work or unexpected primary author does not acquire a credit', () => {
  assert.equal(bookAuthorByline({ ...books[0], workId: '30' }, 'nl'), books[0].author);
  assert.equal(bookAuthorByline({ ...books[0], author: 'Unexpected author' }, 'nl'), 'Unexpected author');
});
