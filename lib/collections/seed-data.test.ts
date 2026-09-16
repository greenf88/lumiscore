import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { REVIEWED_COLLECTION_SEEDS } from './seed-data.ts';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260916071439_collections_v1.sql', import.meta.url),
  'utf8',
);

test('reviewed seeds use unique slugs and no duplicate work within a collection', () => {
  assert.equal(new Set(REVIEWED_COLLECTION_SEEDS.map(({ slug }) => slug)).size, REVIEWED_COLLECTION_SEEDS.length);
  for (const seed of REVIEWED_COLLECTION_SEEDS) {
    const ids = seed.books.map(({ workId }) => workId);
    assert.equal(new Set(ids).size, ids.length, seed.slug);
  }
});

test('every reviewed seed and work ID is represented in the migration', () => {
  for (const seed of REVIEWED_COLLECTION_SEEDS) {
    assert.match(migration, new RegExp(`'${seed.slug}'`));
    for (const member of seed.books) {
      assert.match(migration, new RegExp(`\\('${seed.slug}', ${member.workId},`));
    }
  }
});

test('Suzanne Vermeer is an unordered author collection rather than a fake series', () => {
  const suzanne = REVIEWED_COLLECTION_SEEDS.find(({ slug }) => slug === 'suzanne-vermeer');
  assert.equal(suzanne?.collectionType, 'author_collection');
  assert.equal(suzanne?.books.length, 52);
  assert.ok(suzanne?.books.every(({ sequenceNumber }) => sequenceNumber === null));
});

