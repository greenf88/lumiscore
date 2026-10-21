import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
test('regular overviews share the card; mobile grids and scores have fixed columns', async () => {
  for (const file of ['EditorialTopList','LumiScoreCollectionPage','LumiScoreMyBooks','TasteRatingResult'])
    assert.match(await read('app/components/'+file+'.tsx'), /<BookCard\b/);
  const css=await read('app/globals.css');
  assert.match(css,/\.taste-score-buttons \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css,/@media \(max-width: 760px\) \{\s*\.book-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css,/\.taste-score-buttons button \{[^}]*min-height: 44px/);
});
test('reference card puts the localized year above its title; compact progress cannot inherit the thin guest bar', async () => {
  const card=await read('app/components/LumiScoreHome.tsx');
  const css=await read('app/globals.css');
  assert.match(card,/className="book-year"[\s\S]*t\('common.firstPublished'[\s\S]*<h3>\{book.title\}<\/h3>/);
  assert.match(css,/\.book-year \{[^}]*color: var\(--teal\)[^}]*text-transform: uppercase/);
  const taste=await read('app/components/RatingTasteTest.tsx');
  assert.match(taste,/className="taste-direct-progress"/);
  assert.doesNotMatch(taste,/className="taste-progress"/);
  assert.match(css,/\.rating-round-progress \{[^}]*min-height: 24px/);
});
test('home has only a compact authenticated recommendation preview and no guest personal fetch', async () => {
  const page=await read('app/page.tsx');
  const home=await read('app/components/LumiScoreHome.tsx');
  assert.match(page,/if \(!\(await authPromise\)\.authenticated\) return emptyPersonalization/);
  assert.match(page,/loadHomepagePersonalization\(locale, 3\)/);
  assert.match(page,/loadHighestRatedCatalog\(8,locale,true\)/);
  assert.equal((page.match(/loadHomepagePersonalization\(locale, 3\)/g) ?? []).length, 1);
  assert.match(home,/personalization\.recommendations\.slice\(0, 3\)/);
  assert.match(home,/loading=\{presentation==='detail'\?'eager':'lazy'\}/);
  assert.doesNotMatch(home,/<RecommendationsSection|loadGuestHomepagePersonalization|\/api\/recommendations\/guest/);
  assert.match(home,/personalization\.authenticated && <RecommendationPanel/);
  assert.match(home,/href="\/recommendations"/);
  assert.match(home,/href="\/browse\?sort=highest"/);
  assert.match(await read('app/components/LumiScoreTasteTest.tsx'), /href="\/recommendations">\{t\('taste.seeRecommendations'\)/);
  assert.doesNotMatch(await read('app/recommendations/page.tsx'), /Choose 10|recommendation-limit/);
});

test('local review routes use real components without adding an application authentication bypass', async () => {
  const main=await read('test-support/compact-taste/main.tsx');
  assert.match(main,/location\.pathname.endsWith\('\/taste-test\/result'\) \? <TasteRatingResult/);
  assert.match(main,/<HomePreview/);
  const adapter=await read('scripts/compact-taste-local.mjs');
  assert.match(adapter,/configFile: false, envFile: false/);
  assert.match(adapter,/host: '127\.0\.0\.1'/);
  assert.match(adapter,/buildRatingResultProfile/);
  assert.doesNotMatch(adapter,/createClient|createServerSupabaseClient|process\.env\./);
});
test('rating UI directly saves an explicit score, with skip/search and no language question', async () => {
  const taste=await read('app/components/RatingTasteTest.tsx');
  assert.match(taste,/NEW_ROUND_GOALS\.map/);
  assert.doesNotMatch(taste,/<select|setLanguage|window\.location\.reload/);
  const scores=await read('app/components/DirectRatingScores.tsx');
  assert.match(scores,/aria-pressed=\{isPendingWorkScore\(selection, workId, score, pending\)\}/);
  assert.match(taste,/<DirectRatingScores[\s\S]*?selection=\{selectedScore\}[\s\S]*?act\('rate', workId, score\)/);
  assert.match(taste,/act\('skip', workId\)/);
  assert.doesNotMatch(taste,/Save rating|setScore\(/);
  assert.match(taste,/setSaved\(action === 'rate'\)/);
  assert.match(taste,/\/api\/catalog\/search/);
  assert.match(taste,/href="\/taste-test\/result"/);
});
