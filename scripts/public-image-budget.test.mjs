import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);
async function images(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await images(path));
    else if (imageExtensions.has(extname(entry.name).toLowerCase())) result.push(path);
  }
  return result;
}

test('every shipped local public image is strictly below 300 decimal kB', async () => {
  const files = await images('public');
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.ok((await stat(file)).size < 300_000, `${file} exceeds the image budget`);
  }
});
