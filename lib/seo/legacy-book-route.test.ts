import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLegacyBook, type LegacyBook } from './legacy-book-route.ts';

const host = 'https://lumisco.re';
const book = (locales: LegacyBook['locales']): LegacyBook => ({ title: 'Work <42> & friends', locales });

for (const prefix of ['book', 'books']) {
  test(`${prefix} chooses a proven target without interpreting returnTo as a URL`, async () => {
    for (const [locales, target] of [[['en'], 'en'], [['en', 'nl'], 'en'], [['nl'], 'nl']] as const) {
      const input = new URL(`/${prefix}/%34%32?returnTo=https%3A%2F%2Fother.example%2F&tag=one&tag=two`, host);
      let reads = 0;
      const response = await resolveLegacyBook(input, async id => {
        reads++;
        assert.equal(id, '42');
        return book(locales);
      });
      assert(response instanceof Response);
      assert.equal(reads, 1);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), `${host}/${target}/book/42${input.search}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  });

  test(`${prefix} distinguishes missing, no eligible edition and a temporary failure`, async () => {
    const url = new URL(`/${prefix}/42`, host);
    assert.equal(await resolveLegacyBook(url, async () => null), 'missing');
    const unavailable = await resolveLegacyBook(url, async () => book([]));
    assert(unavailable instanceof Response);
    assert.equal(unavailable.status, 200);
    assert.equal(unavailable.headers.get('location'), null);
    const html = await unavailable.text();
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.match(html, /Work &lt;42&gt; &amp; friends/);
    assert.doesNotMatch(html, /canonical|hreflang|ld\+json/);
    const failure = await resolveLegacyBook(url, async () => { throw new Error('fixture DB error'); });
    assert(failure instanceof Response);
    assert.equal(failure.status, 503);
    assert.equal(failure.headers.get('retry-after'), '5');
    assert.equal(failure.headers.get('cache-control'), 'private, no-store');
    assert.equal(failure.headers.get('location'), null);
    const recovered = await resolveLegacyBook(url, async () => book(['en']));
    assert(recovered instanceof Response);
    assert.equal(recovered.status, 308);
  });
}

test('localized and unrelated routes do not call the new lookup', async () => {
  const unexpected = async () => { throw new Error('Unexpected catalog read'); };
  for (const path of ['/en/book/42', '/nl/book/42', '/nl/books/42', '/browse', '/book/42/more']) {
    assert.equal(await resolveLegacyBook(new URL(path, host), unexpected), null);
  }
  for (const path of ['/book/0', '/books/00042', '/books/%zz', '/book/%2f42']) {
    assert.equal(await resolveLegacyBook(new URL(path, host), unexpected), 'missing');
  }
});
