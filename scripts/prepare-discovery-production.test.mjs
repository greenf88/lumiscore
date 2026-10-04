import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProductionDelta, discoveryMigration, discoveryMigrationHash, permissionsMigration, permissionsMigrationHash, releaseMigrations } from './prepare-discovery-production.mjs';
test('production delta is exactly the reviewed feature and forward permissions versions, never the test baseline', async () => {
  const currentHashes = JSON.parse(await readFile(new URL('../test-support/discovery/migration-hashes.json', import.meta.url), 'utf8'));
  // The PR8 release proposal is immutable; later migrations require a new plan.
  const allFiles = Object.keys(currentHashes).sort();
  const files = allFiles.filter(n=>n!=='20261004164419_flexible_taste_rounds.sql');
  const hashes = Object.fromEntries(files.map(n=>[n,currentHashes[n]]));
  const previous = files.filter(n => !releaseMigrations.includes(n)).map(n => n.slice(0, 14));
  assert.equal(previous.length, 13);
  assert.deepEqual(validateProductionDelta(files, hashes, previous), releaseMigrations);
  assert.equal(hashes[discoveryMigration], discoveryMigrationHash);
  assert.equal(hashes[permissionsMigration], permissionsMigrationHash);
  assert.throws(() => validateProductionDelta(files.filter(n => n !== permissionsMigration), hashes, previous));
  assert.throws(() => validateProductionDelta(files, { ...hashes, [permissionsMigration]: 'changed' }, previous));
  assert.throws(() => validateProductionDelta(files, hashes, previous.slice(1)));
  assert.throws(() => validateProductionDelta(files, hashes, [...previous, discoveryMigration.slice(0, 14)]));
  assert.throws(() => validateProductionDelta([...files, 'unexpected.sql'], hashes, previous));
  assert.throws(() => validateProductionDelta(allFiles, hashes, previous));
  assert.throws(() => validateProductionDelta(files, { ...hashes, [discoveryMigration]: 'changed' }, previous));
});
