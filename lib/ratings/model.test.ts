import assert from 'node:assert/strict';
import test from 'node:test';
import { isCatalogWorkId } from '../books/book-detail.ts';
import {
  calculateRatingSummary,
  EMPTY_RATING_STATE,
  formatRatingCount,
  parseRating,
} from './model.ts';

test('accepts only whole-number ratings from 1 through 10', () => {
  assert.equal(parseRating(1), 1);
  assert.equal(parseRating(10), 10);
  for (const invalid of [0, 11, 8.5, '8', null, undefined]) {
    assert.equal(parseRating(invalid), null);
  }
});

test('calculates a one-decimal LumiScore and rating count', () => {
  assert.deepEqual(calculateRatingSummary([8, 9, 9]), {
    lumiscore: 8.7,
    ratingCount: 3,
  });
  assert.equal(formatRatingCount(1), '1 rating');
  assert.equal(formatRatingCount(124), '124 ratings');
});

test('keeps an unrated work neutral', () => {
  assert.deepEqual(calculateRatingSummary([]), {
    lumiscore: null,
    ratingCount: 0,
  });
  assert.equal(EMPTY_RATING_STATE.lumiscore, null);
  assert.equal(EMPTY_RATING_STATE.userRating, null);
});

test('changing one user rating replaces it in the aggregate', () => {
  const ratingsByUser = new Map([
    ['reader-a', 8],
    ['reader-b', 9],
  ]);
  ratingsByUser.set('reader-a', 10);
  assert.deepEqual(calculateRatingSummary([...ratingsByUser.values()]), {
    lumiscore: 9.5,
    ratingCount: 2,
  });
});

test('native works use the same internal works.id rating identity', () => {
  assert.equal(isCatalogWorkId('1265'), true);
  assert.deepEqual(calculateRatingSummary([7]), {
    lumiscore: 7,
    ratingCount: 1,
  });
});
