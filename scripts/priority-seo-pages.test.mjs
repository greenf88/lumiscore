import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPriorityPage, prioritySeoPaths } from './operations/priority-seo-pages.mjs';

const path = '/en/book/9912';
const section = content => `<section class="book-description" aria-labelledby="book-description-heading"><h2 id="book-description-heading">About this book</h2>${content}</section>`;
const loading = section('<p>Loading the description.</p>');
const resolved = section('<p>Reviewed book description.</p><p class="description-source">Source: <a href="https://example.com/book" rel="noreferrer" target="_blank">Publisher</a></p>');
const streamed = `${loading}<div hidden id="S:0">${resolved}</div><script>$RC("B:0","S:0")</script>`;
const html = `<html><head><title>A book</title><meta name="description" content="Book details"><link rel="canonical" href="https://lumisco.re/en/book/9912"><meta name="robots" content="index, follow"></head><body><h1>A book</h1>${streamed}<script type="application/ld+json">{"@type":"Book"}</script><a href="/nl/book/17">Mars</a></body></html>`;
const inspect = overrides => inspectPriorityPage({ path, html, status: 200, inSitemap: true, ...overrides });

test('cohort has twenty unique canonical paths and preserves language exclusions', () => {
  assert.equal(prioritySeoPaths.length, 20);
  assert.equal(new Set(prioritySeoPaths).size, 20);
  assert.ok(prioritySeoPaths.every(value => /^\/(?:nl|en)(?:\/[a-z0-9/-]+)?$/.test(value)));
  assert.ok(!prioritySeoPaths.includes('/nl/book/3822'));
  assert.ok(!prioritySeoPaths.includes('/en/book/1219'));
});
test('streamed successful content with a loading fallback passes', () => assert.deepEqual(inspect().errors, []));
test('missing or aborted description streams fail even with complete metadata and HTTP 200', () => {
  for (const incomplete of ['', loading, loading.replace('Loading the description.', 'De beschrijving wordt geladen.'), `${loading}<template data-dgst="SERVER_RENDER_ERROR"></template><script>${JSON.stringify(resolved)}</script>`]) {
    assert.ok(inspect({ html: html.replace(streamed, incomplete) }).errors.includes('Missing completed book description'));
  }
});
test('confirmed absence is a completed localized response, not a stream outage', () => {
  for (const message of ['A verified English description is not available yet.', 'Er is nog geen geverifieerde Nederlandse beschrijving beschikbaar.']) {
    assert.deepEqual(inspect({ html: html.replace(resolved, section(`<p>${message}</p>`)) }).errors, []);
  }
});
test('late body canonical cannot hide a missing head canonical', () => {
  const canonical = '<link rel="canonical" href="https://lumisco.re/en/book/9912">';
  assert.ok(inspect({ html: html.replace(canonical, '').replace('</body>', canonical + '</body>') }).errors.includes('Missing or incorrect head canonical'));
});
test('detects content failures even after HTTP 200 and valid metadata', () => {
  for (const message of ['The description could not load right now. Please try again later.', 'De beschrijving kon tijdelijk niet worden geladen. Probeer later opnieuw.']) {
    assert.ok(inspect({ html: html.replace(resolved, section(`<p role="status">${message}</p>`)) }).errors.includes('Visible content failure'));
  }
});
test('detects status, robots, sitemap and query regressions', () => {
  const result = inspect({ status: 503, xRobots: 'noindex', inSitemap: false, html: html.replace('/nl/book/17', '/nl/book/17?returnTo=%2Fnl') });
  assert.deepEqual(result.errors, ['HTTP 503', 'Not indexable', 'Missing from sitemap', 'Book link exposes returnTo variant']);
});
