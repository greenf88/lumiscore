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
  assert.match(taste,/className="rating-round-progress"/);
  assert.doesNotMatch(taste,/className="taste-progress"/);
  assert.match(css,/\.rating-round-progress \{[^}]*min-height: 24px/);
});
test('home has only a compact authenticated recommendation preview and no guest personal fetch', async () => {
  const page=await read('app/page.tsx');
  const home=await read('app/components/LumiScoreHome.tsx');
  assert.match(page,/if \(!\(await authPromise\)\.authenticated\) return emptyPersonalization/);
  assert.match(page,/loadHomepagePersonalization\(locale, 3\)/);
  assert.doesNotMatch(home,/<RecommendationsSection|loadGuestHomepagePersonalization|\/api\/recommendations\/guest/);
  assert.match(home,/personalization\.authenticated && <RecommendationPanel/);
  assert.match(home,/href="\/recommendations"/);
  assert.match(home,/href="\/browse\?sort=highest"/);
  assert.match(await read('app/components/LumiScoreTasteTest.tsx'), /href="\/recommendations">\{t\('taste.seeRecommendations'\)/);
  assert.doesNotMatch(await read('app/recommendations/page.tsx'), /Choose 10|recommendation-limit/);
});
test('rating UI keeps explicit save/skip/search with compact progress and no language question', async () => {
  const taste=await read('app/components/RatingTasteTest.tsx');
  assert.match(taste,/NEW_ROUND_GOALS\.map/);
  assert.doesNotMatch(taste,/<select|setLanguage|window\.location\.reload/);
  assert.match(taste,/aria-pressed=\{score === n\}/);
  assert.match(taste,/onClick=\{\(\) => \{ setScore\(n\); setSaved\(false\); \}\}/);
  assert.match(taste,/act\('rate', book.workId!, score!\)/);
  assert.match(taste,/act\('skip', book.workId!\)/);
  assert.match(taste,/setSaved\(action === 'rate'\)/);
  assert.match(taste,/\/api\/catalog\/search/);
  assert.match(taste,/href="\/taste-test\/result"/);
});
