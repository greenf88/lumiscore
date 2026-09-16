import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production catalog failures never fall back to demo ratings', async () => {
  const source = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /\{ books: \[\], total: null, unavailable: true \}/);
  assert.match(source, /catalogUnavailable=\{catalog\.unavailable\}/);
});

test('minimum launch SEO assets and direct Vinext metadata are present', async () => {
  const [metadata, robots, sitemap, detail] = await Promise.all([
    readFile(new URL('../app/components/LumiScoreMetadata.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.xml/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/book/[workId]/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(metadata, /<meta property="og:title"/);
  assert.match(metadata, /<link rel="canonical"/);
  assert.match(robots, /Sitemap: https:\/\/lumiscore-gamma\.vercel\.app\/sitemap\.xml/);
  assert.match(sitemap, /s-maxage=86400/);
  assert.match(detail, /\$\{book\.title\} by \$\{book\.author\} \| LumiScore/);
});
