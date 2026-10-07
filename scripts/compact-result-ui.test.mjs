import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
test('completion navigation is after response validation, never in failure handler', async () => {
  const source = await read('app/components/RatingTasteTest.tsx');
  assert.match(source, /if \(!r.ok\) throw new Error\(\);[\s\S]*const next = await r.json\(\) as Response;[\s\S]*if \(shouldOpenCompletedResult\(action, data\?\.state \?\? null, next\)\) window.location.assign\(localizedHref\('\/taste-test\/result', locale\)\);\s*\} catch \{ setError\(true\); \}/);
});
test('compact result shows labels and existing scores only as decorative bars; no report or counts', async () => {
  const source = await read('app/components/TasteRatingResult.tsx');
  assert.match(source, /window.scrollTo\(\{top:0,behavior:'instant'\}\)/);
  assert.match(source, /topSupportedAffinities\(profile\)/);
  assert.match(source, /taste-preference-track" aria-hidden="true"/);
  assert.doesNotMatch(source, /profile\.(ratingCount|classifiedCount|missingCount|provisional)|x\.(books|positiveBooks)|\/100|<meter|ARCHETYPE_COPY|taste-facets/);
  assert.match(source, /'Boeken voor jou':'Books for you'/);
  assert.match(source, /'Verfijn je smaak':'Refine your taste'/);
  assert.equal((source.match(/<BookCard /g) ?? []).length, 1);
  const css = await read('app/globals.css');
  assert.match(css, /\.featured-section\.taste-result \{[^}]*padding-block: 24px 36px/);
});
