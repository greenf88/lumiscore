import assert from 'node:assert/strict';
import test from 'node:test';

// Run against scripts/madonna-review-local.mjs, not production or a database.
const origin = 'http://127.0.0.1:3145';
async function html(path) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200);
  return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}
test('NL original server HTML has the exact e-book cover, own synopsis and publisher attribution', async () => {
  const source = await html('/nl/book/1305');
  assert.match(source, /Reclamemanager Ingrid/);
  assert.match(source, /De bestemming/);
  assert.match(source, /href="https:\/\/www.awbruna.nl\/boek\/thrillers\/suzanne-vermeer\/madonna\/"/);
  assert.match(source, /b6bd674d8e0e6381e637a31d0b0022af-364x0/);
  assert.match(source, /9789044970791/);
  assert.doesNotMatch(source, /Bron[^<]*Open Library/);
});
test('EN original HTML presents no suitable edition, not Dutch copy or cover', async () => {
  const source = await html('/en/book/1305');
  assert.match(source, /No suitable edition available/);
  assert.doesNotMatch(source, /Reclamemanager Ingrid|b6bd674d8e0e6381e637a31d0b0022af-364x0|9789044970791/);
});
test('NL collection uses the same reviewed cover and Work-keyed return context', async () => {
  const source = await html('/nl/collection/suzanne-vermeer');
  assert.match(source, /Bekijk Madonna van Suzanne Vermeer/);
  assert.match(source, /b6bd674d8e0e6381e637a31d0b0022af-364x0/);
  assert.match(source, /\/nl\/book\/1305\?returnTo=%2Fcollection%2Fsuzanne-vermeer/);
  assert.equal((source.match(/class="score-badge cover-rating-badge"/g) ?? []).length, 1);
});
test('EN collection excludes the Dutch-only captured edition', async () => {
  const source = await html('/en/collection/suzanne-vermeer');
  assert.doesNotMatch(source, /View Madonna|b6bd674d8e0e6381e637a31d0b0022af-364x0|book\/1305/);
});
