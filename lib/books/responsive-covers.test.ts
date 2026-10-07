import assert from 'node:assert/strict';
import test from 'node:test';
import { getBookCoverImageSource, nextBookCoverAttempt } from './covers.ts';

const source = 'https://covers.openlibrary.org/b/id/240727-L.jpg?default=false';
test('card and compact sources provide smaller base images with native Retina choices', () => {
  const card = getBookCoverImageSource(source, 'card');
  assert.equal(card.src, source.replace('-L.jpg', '-M.jpg'));
  assert.equal(card.srcSet, `${card.src} 1x, ${source} 2x`);
  const compact = getBookCoverImageSource(source, 'compact');
  assert.equal(compact.src, source.replace('-L.jpg', '-S.jpg'));
  assert.equal(compact.srcSet, `${compact.src} 1x, ${card.src} 2x`);
});
test('taste uses medium only; details and same-identity fallback retain large', () => {
  assert.deepEqual(getBookCoverImageSource(source, 'taste'), {
    src: source.replace('-L.jpg', '-M.jpg'), srcSet: undefined, canRetryLarge: true,
  });
  for (const presentation of ['card', 'compact', 'taste', 'detail'] as const) {
    assert.equal(getBookCoverImageSource(source, presentation, true).src, source);
  }
  assert.deepEqual(getBookCoverImageSource(source, 'detail'), {
    src: source, srcSet: undefined, canRetryLarge: false,
  });
});
test('provider variants retain verified identity and query; unrelated URLs remain untouched', () => {
  for (const url of [
    'https://books.google.com/books/content?id=public-cover&zoom=1',
    'https://www.awbruna.nl/cover.png', '/compact-cover.svg',
    'https://covers.openlibrary.org.evil.test/b/id/240727-L.jpg',
    'https://covers.openlibrary.org/b/id/no-variant.png',
  ]) {
    for (const presentation of ['card', 'compact', 'taste', 'detail'] as const) {
      assert.deepEqual(getBookCoverImageSource(url, presentation), {
        src: url, srcSet: undefined, canRetryLarge: false,
      });
    }
  }
  for (const key of ['isbn/9780385472579', 'olid/OL7440033M', 'id/240727']) {
    const url = `https://covers.openlibrary.org/b/${key}-S.jpg?default=false`;
    assert.equal(getBookCoverImageSource(url, 'taste').src, url.replace('-S.jpg', '-M.jpg'));
  }
});
test('missing/placeholder variants retry the same cover once, then progress without a loop', () => {
  assert.deepEqual(nextBookCoverAttempt(0, true), { index: 0, largeFallbackIndex: 0 });
  assert.equal(getBookCoverImageSource(source, 'card', true).canRetryLarge, false);
  assert.deepEqual(nextBookCoverAttempt(0, false), { index: 1, largeFallbackIndex: null });
  assert.deepEqual(nextBookCoverAttempt(1, false), { index: 2, largeFallbackIndex: null });
});
