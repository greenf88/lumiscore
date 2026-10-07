import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production catalog failures never fall back to demo ratings', async () => {
  const source = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /\{ books: \[\], total: null, unavailable: true \}/);
  assert.match(source, /catalogUnavailable=\{catalog\.unavailable\}/);
});

test('minimum launch SEO assets use the single Vinext metadata owner', async () => {
  const [metadata, robots, sitemap, detail] = await Promise.all([
    readFile(new URL('./seo/page-metadata.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/robots.txt/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.xml/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/book/[workId]/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(metadata, /openGraph:/);
  assert.match(metadata, /alternates: \{ canonical: url, languages:/);
  assert.match(metadata, /absoluteLumiScoreUrl/);
  assert.match(robots, /LUMISCORE_SITE_ORIGIN/);
  assert.match(sitemap, /from\('collections'\)/);
  assert.match(sitemap, /s-maxage=3600/);
  assert.doesNotMatch(sitemap, /REVIEWED_COLLECTION_SEEDS/);
  assert.match(detail, /\$\{book\.title\} \$\{locale === 'nl' \? 'van' : 'by'\} \$\{book\.author\} \| LumiScore/);
});
