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
    if (seed.slug === 'suzanne-vermeer') continue;
    for (const member of seed.books) {
      assert.match(migration, new RegExp(`\\('${seed.slug}', ${member.workId},`));
    }
  }
});

test('Suzanne Vermeer is an unordered author collection rather than a fake series', () => {
  const suzanne = REVIEWED_COLLECTION_SEEDS.find(({ slug }) => slug === 'suzanne-vermeer');
  assert.equal(suzanne?.collectionType, 'author_collection');
  assert.equal(suzanne?.books.length, 54);
  assert.ok(suzanne?.books.every(({ sequenceNumber }) => sequenceNumber === null));
  assert.deepEqual(
    suzanne?.books.map(({ workId }) => workId),
    [
      1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1229, 1228,
      1230, 1303, 1304, 1306, 1305, 1302, 1231, 2543, 1232, 1233,
      1234, 1235, 1236, 1237, 1238, 1241, 1239, 1240, 1242, 2544,
      1282, 1259, 1283, 1284, 1285, 1286, 1299, 1300, 1288, 1301,
      1243, 1287, 1289, 1290, 1291, 1292, 1293, 1294, 1245, 1244,
      1295, 1296, 1297, 1298,
    ],
  );
});

