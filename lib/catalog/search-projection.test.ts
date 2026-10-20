import test from 'node:test';
import assert from 'node:assert/strict';
import { readSearchProjection, validateProjectedPage } from './search-projection.ts';
import { searchWindow } from './search-window.ts';
import { searchQuery } from './editorial-query.ts';
const projection = { contract: 'strict-spine-v1', candidates: [
  { workId: '1', editionId: '11', title: 'Dune Messiah', author: 'Frank Herbert', aliases: [] },
  { workId: '2', editionId: '21', title: 'Dune', author: 'Frank Herbert', aliases: ['Duin'] },
] };
test('compact projection preserves exact relevance, edition identity and total before paging', () => {
  const selection = readSearchProjection(projection, 'Dune');
  const page = searchWindow(selection.books, searchQuery({ q: 'Dune' }), selection.aliases);
  assert.equal(page.total, 2); assert.equal(page.books[0].workId, '2');
  assert.equal(page.books[0].editionId, '21'); assert.equal(page.books[0].score, null);
  const actual = validateProjectedPage(page.books, [...page.books].reverse());
  assert.equal(actual[0].workId, '2');
  assert.throws(() => validateProjectedPage(page.books, [{ ...page.books[0], editionId: 'wrong' }, page.books[1]]), /edition changed/);
  assert.throws(() => validateProjectedPage(page.books, [page.books[0]]), /identity changed/);
});
test('reject malformed, duplicate, mismatched protocol or oversized projections', () => {
  for (const data of [null, { ...projection, contract: 'wrong' }, { ...projection, candidates: [projection.candidates[0], projection.candidates[0]] },
    { ...projection, candidates: [{ ...projection.candidates[0], workId: 'NaN' }] },
    { ...projection, candidates: [{ ...projection.candidates[0], aliases: [null] }] }]) assert.throws(() => readSearchProjection(data, 'Dune'));
});
