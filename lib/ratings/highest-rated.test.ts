import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  HIGHEST_RATED_MINIMUM_RATINGS,
  rankHighestRatedWorks,
  type HighestRatedWork,
} from './highest-rated.ts';

const works: HighestRatedWork[] = [
  { workId: '4', title: 'Lower score', score: 8.9, ratingCount: 100 },
  { workId: '3', title: 'Fewer ratings', score: 9, ratingCount: 2 },
  { workId: '2', title: 'More ratings', score: 9, ratingCount: 5 },
  { workId: '10', title: 'Same title', score: 8, ratingCount: 1 },
  { workId: '5', title: 'Same title', score: 8, ratingCount: 1 },
  { workId: '6', title: 'Unrated', score: null, ratingCount: 0 },
  { workId: '7', title: 'Invalid empty aggregate', score: 10, ratingCount: 0 },
];

test('highest-rated books use score, count, title and work id deterministically', () => {
  assert.deepEqual(
    rankHighestRatedWorks(works, 10).map(({ workId }) => workId),
    ['2', '3', '4', '5', '10'],
  );
});

test('highest-rated selection excludes unrated books without mutating its input', () => {
  const original = structuredClone(works);
  const result = rankHighestRatedWorks(works, 2);

  assert.equal(HIGHEST_RATED_MINIMUM_RATINGS, 1);
  assert.equal(result.length, 2);
  assert.ok(result.every(({ ratingCount }) => ratingCount >= 1));
  assert.deepEqual(works, original);
});

test('highest-rated selection supports a modest future rating threshold', () => {
  assert.deepEqual(
    rankHighestRatedWorks(works, 10, 3).map(({ workId }) => workId),
    ['2', '4'],
  );
});

test('homepage uses the global aggregate ranking and Highest rated label', async () => {
  const [page, home, catalog] = await Promise.all([
    readFile(new URL('../../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/books.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /loadHighestRatedCatalog\(18\)/);
  assert.match(home, /'Highest rated'/);
  assert.doesNotMatch(home, /Featured today/);
  assert.match(catalog, /loadPublicRatingSummariesBatched/);
  assert.match(catalog, /rankHighestRatedWorks/);
});
