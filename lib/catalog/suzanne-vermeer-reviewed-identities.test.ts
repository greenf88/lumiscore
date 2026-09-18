import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUZANNE_VERMEER_AUTHOR,
  SUZANNE_VERMEER_COVER_REPAIRS,
  SUZANNE_VERMEER_EXCLUSIONS,
  SUZANNE_VERMEER_REVIEWED_IDENTITIES,
  sortSuzanneVermeerIdentities,
} from './suzanne-vermeer-reviewed-identities.ts';

test('reviewed catalog contains exactly 54 unique HIGH-confidence works', () => {
  assert.equal(SUZANNE_VERMEER_REVIEWED_IDENTITIES.length, 54);
  assert.equal(new Set(SUZANNE_VERMEER_REVIEWED_IDENTITIES.map(({ title }) => title)).size, 54);
  assert.equal(new Set(SUZANNE_VERMEER_REVIEWED_IDENTITIES.map(({ representativeIsbn13 }) => representativeIsbn13)).size, 54);
  assert.ok(SUZANNE_VERMEER_REVIEWED_IDENTITIES.every(({ confidence }) => confidence === 'HIGH'));
});

test('canonical author and the two missing native identities are fixed', () => {
  assert.deepEqual(SUZANNE_VERMEER_AUTHOR, {
    name: 'Suzanne Vermeer', productionAuthorId: 713, openLibraryAuthorId: 'OL7535086A',
  });
  assert.deepEqual(
    SUZANNE_VERMEER_REVIEWED_IDENTITIES.filter(({ expectedProductionWorkId }) => expectedProductionWorkId === null)
      .map(({ title }) => title),
    ['Winterberg', 'De eilanden'],
  );
});

test('publication order is deterministic and not a fake series sequence', () => {
  assert.deepEqual(
    sortSuzanneVermeerIdentities(SUZANNE_VERMEER_REVIEWED_IDENTITIES).map(({ title }) => title),
    SUZANNE_VERMEER_REVIEWED_IDENTITIES.map(({ title }) => title),
  );
});

test('omnibus and future-title exclusions cannot enter the reviewed catalog', () => {
  const titles = new Set(SUZANNE_VERMEER_REVIEWED_IDENTITIES.map(({ title }) => title));
  for (const exclusion of SUZANNE_VERMEER_EXCLUSIONS) assert.equal(titles.has(exclusion.title), false);
  assert.ok(SUZANNE_VERMEER_EXCLUSIONS.some(({ title }) => title === 'De bestemming'));
  assert.ok(SUZANNE_VERMEER_EXCLUSIONS.some(({ title }) => title === 'Schiereiland'));
});

test('every audited placeholder has one ISBN-bound HTTPS cover repair', () => {
  assert.equal(SUZANNE_VERMEER_COVER_REPAIRS.length, 14);
  assert.equal(new Set(SUZANNE_VERMEER_COVER_REPAIRS.map(([title]) => title)).size, 14);
  for (const [, isbn13, url] of SUZANNE_VERMEER_COVER_REPAIRS) {
    assert.match(isbn13, /^97[89]\d{10}$/);
    assert.match(url, /^https:\/\//);
  }
});
