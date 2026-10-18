import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('desktop header reserves intrinsic navigation space and lets search shrink at both desktop breakpoints', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /grid-template-columns: minmax\(160px, \.65fr\) minmax\(0, 480px\) max-content/);
  assert.match(css, /\.header-search \{ min-width: 0; \}/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1350px\) \{\s*\.site-header \{ grid-template-columns: auto minmax\(0, 1fr\) max-content/);
});

test('front caption is absent in both locales while the meaningful cover label and badge remain', async () => {
  const source = await read('app/components/LumiScoreBookDetail.tsx');
  assert.doesNotMatch(source, /<figcaption>\{t\('detail.frontCover'\)\}/);
  assert.match(source, /label=\{t\('detail.frontCoverOf', \{ title: book.title \}\)\}/);
  assert.match(source, /<CoverScoreBadge score=\{score\} presentation="detail"/);
  assert.match(source, /<figcaption>\{t\('detail.backCover'\)\}/);
});

test('compact detail header reuses the existing accessible mobile navigation, no star-only replacement', async () => {
  const detail = await read('app/components/LumiScoreBookDetail.tsx');
  const home = await read('app/components/LumiScoreHome.tsx');
  const navigation = await read('app/components/MobileNavigation.tsx');
  const css = await read('app/globals.css');
  assert.match(detail, /<MobileNavigation authenticated=\{/);
  assert.match(home, /<MobileNavigation authenticated=\{/);
  assert.match(navigation, /href="\/taste-test"/);
  assert.match(navigation, /aria-expanded=\{open\}/);
  assert.match(navigation, /event.key !== 'Escape'/);
  assert.match(navigation, /trigger.current\?\.focus\(\)/);
  assert.match(css, /\.detail-taste-test-link \{[^}]*white-space: nowrap/);
  assert.match(css, /@media \(max-width: 820px\) \{\s*\.detail-header \.detail-taste-test-link \{ display: none; \}/);
  assert.doesNotMatch(css, /\.detail-taste-test-link::before/);
});

test('rating hover is gated to a real hover pointer; focus-visible remains independent', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.taste-direct-test button:hover/);
  assert.match(css, /\.taste-direct-test button:focus-visible[^}]*outline: 2px solid var\(--teal\)/);
  const source = await read('app/components/RatingTasteTest.tsx');
  assert.match(source, /<DirectRatingScores workId=\{workId/);
  const scores = await read('app/components/DirectRatingScores.tsx');
  assert.match(scores, /isPendingWorkScore\(selection, workId, score, pending\)/);
  assert.match(source, /workId: chosenWork, score: rating/);
  assert.match(source, /setData\(next\); setSelectedScore\(null\)/);
});

test('detail header establishes the same raised stacking layer as the shared header so covers cannot intercept menu clicks', async () => {
  const css = await read('app/globals.css');
  assert.match(css, /\.detail-header \{ position: relative; z-index: 20;/);
  assert.match(css, /\.mobile-navigation-panel \{[^}]*z-index: 32/);
  // Actual pointer hit-testing and click navigation are verified in the browser.
});

test('book detail keeps the account last on the right, with its panel anchored to that edge', async () => {
  const detail = await read('app/components/LumiScoreBookDetail.tsx');
  const header = detail.split('<header className="detail-header">')[1]?.split('</header>')[0];
  assert.ok(header);
  assert.ok(header.indexOf('<ThemeToggle') < header.indexOf('<LanguageSwitcher'));
  assert.ok(header.indexOf('<LanguageSwitcher') < header.indexOf('<LumiScoreAccountMenu'));
  assert.match(header, /<LumiScoreAccountMenu authState=\{authState\} returnTo=\{detailPath\} variant="detail" \/>\s*<\/div>/);
  const css = await read('app/globals.css');
  assert.match(css, /\.header-account \{ position: relative;/);
  assert.match(css, /\.header-account-panel \{[^}]*right: 0;[^}]*width: min\(280px, calc\(100vw - 24px\)\)/);
});
