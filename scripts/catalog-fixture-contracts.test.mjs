import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = [
  'test/fixtures/collection-v1-quality.contract.json',
  'test/fixtures/catalog-expansion-option-b.contract.json',
];
function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', `safe.directory=${cwd}`, '-C', cwd, ...args],
    { windowsHide: true, timeout: 30_000 });
  assert.equal(result.status, 0, 'Local fixture checkout operation must succeed');
  return result.stdout;
}

test('contract fixtures survive both autocrlf modes and tests need no repository cwd or credentials', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lumiscore-contract-checkout-'));
  try {
    const source = path.join(temporary, 'source');
    await fs.mkdir(path.join(source, 'test', 'fixtures'), { recursive: true });
    await fs.copyFile(path.join(root, '.gitattributes'), path.join(source, '.gitattributes'));
    for (const fixture of fixtures) await fs.copyFile(path.join(root, fixture), path.join(source, fixture));
    git(source, 'init', '--quiet');
    git(source, '-c', 'core.autocrlf=false', 'add', '--', '.gitattributes', ...fixtures);
    git(source, '-c', 'user.name=Contract Test', '-c', 'user.email=contract@example.invalid',
      'commit', '--quiet', '--no-gpg-sign', '-m', 'Synthetic local fixture checkout');
    for (const autocrlf of ['true', 'false']) {
      const checkout = path.join(temporary, `checkout-${autocrlf}`);
      git(temporary, '-c', `core.autocrlf=${autocrlf}`, 'clone', '--quiet', '--local', '--no-hardlinks', source, checkout);
      for (const fixture of fixtures) {
        assert.deepEqual(await fs.readFile(path.join(checkout, fixture)),
          await fs.readFile(path.join(root, fixture)), `${fixture}: autocrlf=${autocrlf}`);
      }
    }
    const env = { ...process.env };
    for (const name of Object.keys(env)) {
      if (/SUPABASE|CATALOG_DATABASE|GOOGLE_BOOKS|^PG/.test(name)) delete env[name];
    }
    // This is an independent test run, not an inherited Node test-runner worker.
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test-reporter=tap', '--test',
      path.join(root, 'lib/collections/collection-v1-quality.test.ts'),
      path.join(root, 'scripts/catalog-expansion-trait-option-b.test.ts')],
    { cwd: temporary, env, windowsHide: true, timeout: 30_000 });
    assert.equal(result.status, 0, 'All seven contract tests must pass outside the repository without credentials');
    assert.match(result.stdout.toString(), /(?:#|ℹ) pass 7\b/);
    assert.match(result.stdout.toString(), /(?:#|ℹ) fail 0\b/);
  } finally {
    const resolved = path.resolve(temporary);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('lumiscore-contract-checkout-'));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
