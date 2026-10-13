// Opt-in read-only checks against the separate loopback SSR fixture, never production.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin = process.env.BROWSE_REVIEW_ORIGIN;
if (!origin || !/^http:\/\/(127\.0\.0\.1|localhost):3122$/.test(origin)) throw new Error('Exact loopback Browse fixture origin required.');
async function html(path) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200);
  return (await response.text()).replaceAll(/<!--.*?-->/g, '');
}
const ids = body => [...body.matchAll(/<article class="book-card browse-card" id="browse-synthetic-(\d+)"/g)].map(m => m[1]);
test('SSR starts with closed filters, direct search/sort, and honest page-sized cards', async () => {
  const body = await html('/nl/browse');
  assert.equal(ids(body).length, 32);
  assert.match(body, /aria-expanded="false" aria-controls="browse-filter-panel"/);
  assert.doesNotMatch(body, /role="region" aria-labelledby="browse-filter-title"/);
  assert.match(body, /Zoek op titel of auteur/); assert.match(body, /160 boeken in de catalogus/);
  assert.doesNotMatch(body, /VOLLEDIGE CATALOGUS|pagina voor pagina|class="score-badge"|class="book-year"/);
  assert.match(body, /Nog geen betrouwbare score/); assert.match(body, /3–4 beoordelaars/);
  assert.doesNotMatch(body, /returnTo=[^" ]*https/);
});
for (const size of [32, 64, 128]) test(`SSR ${size}-page sizing and non-overlap retain existing URL context`, async () => {
  const first = ids(await html(`/en/browse?pageSize=${size}`));
  const next = ids(await html(`/en/browse?pageSize=${size}&page=2`));
  assert.equal(first.length, size); assert.equal(next.length, Math.min(size, 160 - size));
  assert.ok(next.every(id => !first.includes(id)));
  const filtered = await html(`/en/browse?category=fiction_fantasy&language=en&sort=newest&pageSize=${size}`);
  assert.match(filtered, /80 results/); assert.ok(ids(filtered).length <= size);
  assert.match(filtered, /returnTo=[^" ]*fiction_fantasy/);
});
test('combined author/category/selection/edition totals come from filtered data, not global catalog', async () => {
  const body = await html('/nl/browse?author=1&category=fiction_fantasy&selection=lumiscore-selectie-1000&language=nl');
  assert.equal(ids(body).length, 27); assert.match(body, /27 resultaten/);
  assert.doesNotMatch(body, /160 boeken in de catalogus/);
  assert.match(body, /4 actieve filtergroepen/); assert.match(body, /Verwijder filter: Schrijver: Ada Vermeer/);
});
test('highest-score eligible subset is labelled as results without adding a content-filter badge', async () => {
  const body = await html('/en/browse?sort=highest&pageSize=128');
  assert.equal(ids(body).length, 54); assert.match(body, /54 results/);
  assert.doesNotMatch(body, /54 books in the catalog|class="browse-filter-count"/);
});
test('empty results and actual loader failure stay distinct in NL/EN', async () => {
  for (const locale of ['nl', 'en']) {
    const empty = await html(`/${locale}/browse?q=no-such-synthetic-book`);
    assert.equal(ids(empty).length, 0); assert.match(empty, /0 (?:results|resultaten)/);
    const failed = await html(`/${locale}/browse?q=fixture-load-error`);
    assert.equal(ids(failed).length, 0);
    assert.match(failed, locale === 'nl' ? /catalogus.*niet beschikbaar/i : /catalog unavailable/i);
    assert.doesNotMatch(failed, /0 (?:results|resultaten)/);
  }
});
test('existing book route/return destination carries all filters and localization with one safe context', async () => {
  const path = '/nl/browse?category=fiction_fantasy&language=en&sort=newest&pageSize=32&page=2';
  const body = await html(path);
  const link = body.match(/class="book-card-main-link"[^>]*href="([^"]+)"/)[1].replaceAll('&amp;', '&');
  const url = new URL(link, origin);
  assert.match(url.pathname, /^\/nl\/book\/\d+$/);
  const returnTo = url.searchParams.get('returnTo');
  for (const [key, value] of new URL(path, origin).searchParams) assert.equal(new URL(returnTo, origin).searchParams.get(key), value);
  const detail = await html(link);
  assert.match(detail, /href="\/nl\/browse\?/);
  assert.match(detail, /fiction_fantasy/);
});
