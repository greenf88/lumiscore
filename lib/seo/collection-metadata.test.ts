import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionMetadataDescription, collectionMetadataTitle } from './collection-metadata.ts';

test('collection descriptions retain editorial copy and localize a type-specific fallback', () => {
  const collection = { name: 'Dune', collectionType: 'series', description: '  Follow the Atreides across Arrakis.  ' } as const;
  assert.equal(collectionMetadataDescription(collection, 'en'), 'Follow the Atreides across Arrakis.');
  assert.match(collectionMetadataDescription(collection, 'nl'), /leesvolgorde van Dune/);
  assert.match(collectionMetadataDescription({ ...collection, description: 'Dune' }, 'en'), /reading order for Dune/);
  assert.doesNotMatch(collectionMetadataDescription({ ...collection, collectionType: 'universe', description: null }, 'en'), /reading order/);
});

test('localized collection titles preserve identity while distinguishing the reading purpose', () => {
 const series = {name:'Dune', collectionType:'series'} as const;
 assert.match(collectionMetadataTitle(series, 'nl'), /^Dune: leesvolgorde/);
 assert.match(collectionMetadataTitle(series, 'en'), /^Dune: reading order/);
 assert.notEqual(collectionMetadataTitle(series,'en'),collectionMetadataTitle(series,'nl'));
 assert.doesNotMatch(collectionMetadataTitle({...series,collectionType:'author_collection'},'en'),/reading order/);
});
