// Loopback-only read-only tests against the real Vinext router with synthetic
// loaders: node scripts/seo-critical-local.mjs --port=3123.
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectServerHtml } from '../lib/seo/server-html.ts';

const origin = 'http://127.0.0.1:3123';
async function read(path) {
  const response = await fetch(origin + path, {
    redirect: 'manual', signal: AbortSignal.timeout(20000),
    headers: { 'accept-language': 'de', cookie: 'lumiscore-locale=de' },
  });
  return { response, html: await response.text() };
}

const legacyCases = [
  ['/', '/en'], ['/browse?page=2&category=fiction', '/en/browse?page=2&category=fiction'],
  ['/book/1?returnTo=%2Fbrowse%3Fpage%3D2%26sort%3Dhighest', '/en/book/1?returnTo=%2Fbrowse%3Fpage%3D2%26sort%3Dhighest'],
  ['/books/1', '/en/book/1'], ['/nl/books/1', '/nl/book/1'],
  ['/login?next=%2Fnl%2Ftaste-test', '/en/login?next=%2Fnl%2Ftaste-test'],
];
for (const [oldPath, destination] of legacyCases) {
  test(`legacy ${oldPath}: temporary no-store redirect, same destination, no loop`, async () => {
    const { response } = await read(oldPath);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(new URL(response.headers.get('location'), origin).href, origin + destination);
    const target = await read(destination);
    assert.equal(target.response.status, 200);
    assert.equal(target.response.headers.get('location'), null);
  });
}

// A browser with a stored 308 goes straight to this destination, bypassing
// legacy requests. Test those real destination responses; not browser-cache QA.
for (const locale of ['en', 'nl']) {
  for (const path of ['', '/browse?page=2&category=fiction', '/book/1', '/book/2',
    '/book/1?returnTo=%2Fbrowse%3Fpage%3D2%26sort%3Dhighest',
    '/collection/synthetic-series', '/login?next=%2F' + locale + '%2Ftaste-test',
    '/taste-test', '/taste-test/result']) {
    test(`cached-308/direct destination ${locale}${path}: serves localized HTML without redirect`, async () => {
      const { response, html } = await read('/' + locale + path);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('location'), null);
      const seo = inspectServerHtml(html);
      assert.equal(seo.lang, locale);
      assert.deepEqual(seo.canonical, ['https://lumisco.re/' + locale + path.split('?')[0]]);
      assert.equal(seo.robots.length, 1);
      assert.deepEqual(seo.duplicates, []);
      const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      assert.ok(visible.includes(`href="/${locale === 'en' ? 'nl' : 'en'}${path.replaceAll('&', '&amp;')}"`));
      if (path.startsWith('/book/1?')) {
        assert.ok(visible.includes(`href="/${locale}/browse?page=2&amp;sort=highest"`), 'return page and sort kept');
      }
      if (path.startsWith('/book/')) {
        assert.ok(visible.includes('Synthetic book'));
        assert.ok(visible.includes('Synthetic author'));
        assert.ok(visible.includes(locale === 'nl' ? 'geverifieerde Nederlandse beschrijving' : 'verified English description'));
        assert.ok(visible.includes(`href="/${locale}/login?next=`), 'localized authentication return link');
      }
      if (path.startsWith('/login?')) {
        assert.match(visible, /action="\/auth\/sign-in"/);
        assert.ok(visible.includes(`name="next" value="/${locale}/taste-test"`));
      }
    });
  }
  test(`unknown ${locale} book still returns legitimate 404`, async () => {
    assert.equal((await read(`/${locale}/book/null`)).response.status, 404);
  });
}

test('existing framework trailing-slash normalization remains safe, destination serves 200', async () => {
  // Vinext normalizes before the application proxy: this pre-existing 308 is
  // not the recovery's legacy redirect and its canonical destination is kept.
  for (const locale of ['en', 'nl']) {
    const { response } = await read(`/${locale}/?page=2`);
    assert.equal(response.status, 308);
    assert.equal(new URL(response.headers.get('location'), origin).href, `${origin}/${locale}?page=2`);
    assert.equal((await read(`/${locale}?page=2`)).response.status, 200);
  }
});

test('same neutral description API, verified source text, no locale API copy; robots unchanged', async () => {
  for (const locale of ['en', 'nl']) {
    const { response, html } = await read(`/api/books/1/description?locale=${locale}`);
    assert.equal(response.status, 200);
    const payload = JSON.parse(html);
    assert.equal(payload.description.language, locale);
    assert.equal(payload.description.sourceKey, 'OL1W');
    const alias = await read(`/${locale}/api/books/1/description?locale=${locale}`);
    assert.equal(alias.response.status, 307);
    assert.equal(new URL(alias.response.headers.get('location'), origin).pathname, '/api/books/1/description');
  }
  const { html } = await read('/robots.txt');
  assert.match(html, /Disallow: \/api\//);
  assert.match(html, /Disallow: \/auth\//);
});
