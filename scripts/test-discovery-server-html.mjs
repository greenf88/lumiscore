// Read-only HTTP checks; never creates accounts, sessions or ratings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectServerHtml } from '../lib/seo/server-html.ts';
const origin = process.env.CATALOG_TEST_ORIGIN;
if (!origin || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw new Error('A local review origin is required.');
const html = async (path, locale = 'en') => {
  const response = await fetch(origin + path, { headers: { cookie: `lumiscore-locale=${locale}` } });
  assert.equal(response.status, 200);
  const body = await response.text(), seo = inspectServerHtml(body);
  assert.equal(seo.robots.length, 1); assert.equal(seo.canonical.length, 1); assert.deepEqual(seo.duplicates, []);
  assert.doesNotMatch(body, /\/book\/(?:null|undefined)/);
  return body.replaceAll(/<!--.*?-->/g, '');
};
test('real category source, NL/EN links and honest empty category', async () => {
  const body = await html('/categories');
  const links = [...body.matchAll(/href="\/browse\?category=([^"&]+)/g)].map(m => m[1]);
  assert.equal(links.length, 20); assert.equal(new Set(links).size, 20);
  assert.match(body, /20 public categories/); assert.match(body, /no linked books yet/);
  assert.match(await html('/categories', 'nl'), /20 publieke categorie/);
  assert.match(await html('/browse?category=nonfiction_cooking_food'), /0 books in the catalog/);
});
test('server Home and recommendation overview carry valid originating destinations', async () => {
  const home = await html('/');
  assert.match(home, /href="\/categories"/);
  assert.match(home, /\/book\/\d+\?returnTo=%2F/);
  const overview = await html('/recommendations?limit=25');
  assert.match(overview, /<option selected="">25<\/option>/);
  assert.match(overview, /id="recommendations"/);
  const guest = await html('/taste-test');
  assert.match(guest, /twenty different books/);
});
