import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getReviewedSeriesMetadata,
  REVIEWED_SERIES_METADATA,
} from './reviewed-series-metadata.ts';

const expectedTotals = new Map<string, number>([
  ['harry-potter', 7],
  ['the-hunger-games', 5],
  ['the-expanse', 9],
  ['millennium-original-trilogy', 3],
  ['percy-jackson-and-the-olympians', 5],
  ['the-witcher', 8],
  ['bridgerton', 8],
  ['the-heroes-of-olympus', 5],
  ['once-upon-a-broken-heart', 3],
  ['powerless', 3],
  ['throne-of-glass', 7],
  ['kings-of-sin', 6],
  ['chestnut-springs', 5],
  ['the-wheel-of-time', 14],
  ['a-court-of-thorns-and-roses', 4],
  ['heartstopper', 5],
]);

test('reviewed main-series totals preserve complete and incomplete launch series', () => {
  for (const [slug, total] of expectedTotals) {
    assert.equal(getReviewedSeriesMetadata(slug)?.expectedMainSeriesTotal, total, slug);
  }
});

test('reviewed totals are unique and future unknown series remain denominator-free', () => {
  assert.equal(
    new Set(REVIEWED_SERIES_METADATA.map(({ slug }) => slug)).size,
    REVIEWED_SERIES_METADATA.length,
  );
  assert.equal(getReviewedSeriesMetadata('earthsea'), null);
});
