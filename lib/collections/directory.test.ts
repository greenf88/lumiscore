import assert from 'node:assert/strict';
import test from 'node:test';
import type { CollectionSummary } from './model.ts';
import {
  buildCollectionDirectoryBaseItems,
  filterCollectionDirectoryItems,
  getCollectionDirectoryHref,
  getCollectionDirectoryCoverage,
  getCollectionHref,
  normalizeCollectionDirectoryFilter,
  type CollectionDirectoryMembership,
} from './directory.ts';

const collections: CollectionSummary[] = [
  { id: '1', slug: 'narnia', name: 'Narnia', collectionType: 'series', description: null, expectedMainSeriesTotal: 7 },
  { id: '2', slug: 'earthsea', name: 'Earthsea', collectionType: 'series', description: null, expectedMainSeriesTotal: 6 },
  { id: '3', slug: 'middle-earth', name: 'Middle-earth', collectionType: 'universe', description: null, expectedMainSeriesTotal: null },
  { id: '4', slug: 'ursula-le-guin', name: 'Ursula K. Le Guin', collectionType: 'author_collection', description: null, expectedMainSeriesTotal: null },
];

const memberships: CollectionDirectoryMembership[] = [
  ...Array.from({ length: 7 }, (_, index) => ({ collectionId: '1', workId: String(10 + index), sequenceNumber: index + 1, publicationOrder: index + 1 })),
  ...Array.from({ length: 5 }, (_, index) => ({ collectionId: '2', workId: String(20 + index), sequenceNumber: index + 1, publicationOrder: index + 1 })),
  { collectionId: '3', workId: '30', sequenceNumber: null, publicationOrder: 1 },
  { collectionId: '4', workId: '40', sequenceNumber: null, publicationOrder: 1 },
];

test('all public collections are surfaced once with canonical slug links', () => {
  const items = buildCollectionDirectoryBaseItems(
    [...collections, collections[0]],
    memberships,
  );
  assert.equal(items.length, collections.length);
  assert.equal(new Set(items.map(({ collection }) => collection.id)).size, items.length);
  assert.equal(getCollectionHref('middle-earth'), '/collection/middle-earth');
});

test('known totals derive complete and incomplete catalog state safely', () => {
  const items = buildCollectionDirectoryBaseItems(collections, memberships);
  const narnia = items.find(({ collection }) => collection.slug === 'narnia')!;
  const earthsea = items.find(({ collection }) => collection.slug === 'earthsea')!;
  assert.deepEqual(
    [narnia.cataloguedMainSeriesCount, narnia.collection.expectedMainSeriesTotal, narnia.catalogComplete],
    [7, 7, true],
  );
  assert.deepEqual(getCollectionDirectoryCoverage(narnia), {
    kind: 'complete', count: 7, total: 7,
  });
  assert.deepEqual(
    [earthsea.cataloguedMainSeriesCount, earthsea.collection.expectedMainSeriesTotal, earthsea.catalogComplete],
    [5, 6, false],
  );
  assert.deepEqual(getCollectionDirectoryCoverage(earthsea), {
    kind: 'incomplete', count: 5, total: 6,
  });
});

test('unknown totals never invent a denominator or completion state', () => {
  const middleEarth = buildCollectionDirectoryBaseItems(collections, memberships)
    .find(({ collection }) => collection.slug === 'middle-earth')!;
  assert.equal(middleEarth.collection.expectedMainSeriesTotal, null);
  assert.equal(middleEarth.catalogComplete, false);
  assert.equal(middleEarth.cataloguedBookCount, 1);
  assert.deepEqual(getCollectionDirectoryCoverage(middleEarth), {
    kind: 'count', count: 1, total: null,
  });
});

test('series, universe and author collection filters stay deterministic', () => {
  const items = buildCollectionDirectoryBaseItems(collections, memberships);
  assert.deepEqual(items.map(({ collection }) => collection.collectionType), [
    'series',
    'series',
    'author_collection',
    'universe',
  ]);
  assert.deepEqual(
    filterCollectionDirectoryItems(items, 'series').map(({ collection }) => collection.name),
    ['Earthsea', 'Narnia'],
  );
  assert.equal(normalizeCollectionDirectoryFilter('invalid'), 'all');
  assert.equal(getCollectionDirectoryHref('universe'), '/collections?type=universe');
});
