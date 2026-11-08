import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedCollectionDescription } from './reviewed-descriptions.ts';

const rows = [
  { slug: 'geef-me-de-ruimte', name: 'Geef me de ruimte', collection_type: 'series', description: 'Thea Beckmans historische trilogie over de Honderdjarige Oorlog.' },
  { slug: 'kinderen-van-moeder-aarde', name: 'Kinderen van Moeder Aarde', collection_type: 'series', description: 'Thea Beckmans toekomsttrilogie over Thule.' },
];

test('reviewed English collection context does not change Dutch or unspecified presentation', () => {
  for (const row of rows) {
    assert.match(reviewedCollectionDescription(row, 'en')!, /^Thea Beckman’s/);
    assert.equal(reviewedCollectionDescription(row, 'nl'), row.description);
    assert.equal(reviewedCollectionDescription(row), row.description);
    assert.match(reviewedCollectionDescription(row, 'en')!, /available in this language/);
  }
});

test('future editorial changes and different identities are never overridden', () => {
  for (const row of rows) for (const changed of [
    { ...row, slug: 'another' }, { ...row, name: 'Different series' },
    { ...row, collection_type: 'author' }, { ...row, description: 'New reviewed context.' },
    { ...row, description: null },
  ]) assert.equal(reviewedCollectionDescription(changed, 'en'), changed.description);
});
