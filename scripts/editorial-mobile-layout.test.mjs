import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('editorial mobile grid overrides the wider desktop minimum with two shrinkable columns', () => {
  const css = read('app/globals.css');
  const desktop = css.indexOf('.editorial-books { grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }');
  const mobile = css.indexOf('.editorial-books { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
  assert.ok(desktop >= 0 && mobile > desktop, 'mobile rule must win over the 220px desktop minimum');
  assert.match(css.slice(desktop, mobile), /@media \(max-width: 600px\) \{[^}]+\}/);
  assert.equal(css.slice(mobile + 1).includes('.editorial-books { grid-template-columns:'), false,
    'a later editorial override would defeat the mobile rule');
});

test('all editorial selections retain the same shared BookCard grid', () => {
  const component = read('app/components/EditorialTopList.tsx');
  assert.match(component, /<ol className="book-grid editorial-books">/);
  assert.match(component, /<BookCard book=\{book\}/);
  const base = JSON.parse(read('lib/catalog/top-lists.json')).lists;
  const campaigns = JSON.parse(read('lib/catalog/editorial-campaigns-20261028.json')).lists;
  assert.ok(base.length > 0 && campaigns.length === 10);
  assert.equal(new Set([...base, ...campaigns].map(list => list.slug)).size, base.length + campaigns.length);
  assert.match(read('app/toplijsten/[slug]/page.tsx'), /<EditorialTopList/);
});
