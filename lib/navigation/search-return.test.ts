import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSearchReturnContext,
  getSafeSearchReturnPath,
  serializeSearchReturnPath,
} from './search-return.ts';

test('serializes and restores the complete internal search context', () => {
  const returnTo = serializeSearchReturnPath({
    q: 'suzanne vermeer',
    page: '2',
    language: ['nl', 'en'],
    sort: 'rating',
  });
  assert.equal(
    returnTo,
    '/search?q=suzanne+vermeer&page=2&language=nl&language=en&sort=rating',
  );
  assert.equal(getSafeSearchReturnPath(returnTo), returnTo);
  assert.equal(
    appendSearchReturnContext('/book/1296', returnTo),
    '/book/1296?returnTo=%2Fsearch%3Fq%3Dsuzanne%2Bvermeer%26page%3D2%26language%3Dnl%26language%3Den%26sort%3Drating',
  );
});

test('preserves encoded accents and spaces without decoding into unsafe markup', () => {
  const returnTo = serializeSearchReturnPath({ q: 'Café in Parijs' });
  assert.equal(returnTo, '/search?q=Caf%C3%A9+in+Parijs');
  assert.equal(getSafeSearchReturnPath(returnTo), returnTo);
});

test('rejects external, protocol-relative, script and non-search return routes', () => {
  for (const unsafe of [
    'https://evil.example/search?q=suzanne',
    '//evil.example/search?q=suzanne',
    '/\\evil.example/search?q=suzanne',
    'javascript:alert(1)',
    '/book/8',
    '/search?q=suzanne#javascript:alert(1)',
  ]) {
    assert.equal(getSafeSearchReturnPath(unsafe), null, unsafe);
  }
});
