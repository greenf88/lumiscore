import assert from 'node:assert/strict';
import test from 'node:test';
import { highestRatedPageArgs, readHighestRatedPage } from './highest-rated-page.ts';

test('home ranks globally on the server and hydrates at most eight identities', () => {
  const args = highestRatedPageArgs(8);
  assert.equal(args.p_sort, 'highest');
  assert.equal(args.p_page, 1);
  assert.equal(args.p_page_size, 32);
  assert.deepEqual(args.p_categories, []);
  const workIds = [10134, 4500, 9, 8, 7, 6, 5, 4, 3];
  assert.deepEqual(readHighestRatedPage({ workIds, page: 1, total: 10134 }, 8),
    { ids: workIds.slice(0, 8).map(String), total: 10134 });
});
test('invalid, duplicate and unbounded responses are errors, not empty catalogs', () => {
  for (const workIds of [[null], [true], [{}], [0], ['null'], [-1], [1, 1], Array.from({ length: 33 }, (_, i) => i+1)])
    assert.throws(() => readHighestRatedPage({ workIds, page: 1, total: 50 }, 8));
  for (const response of [null, {}, { workIds: [], page: 2, total: 0 }, { workIds: [], page: 1, total: -1 }])
    assert.throws(() => readHighestRatedPage(response, 8));
  assert.throws(() => highestRatedPageArgs(NaN));
  assert.deepEqual(readHighestRatedPage({ workIds: [], page: 1, total: 0 }, 8), { ids: [], total: 0 });
});
