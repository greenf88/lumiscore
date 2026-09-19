import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('search cards preserve full search context and detail fallback stays clean', async () => {
  const searchPage = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8');
  const searchUi = await readFile(new URL('../../app/components/LumiScoreSearchPage.tsx', import.meta.url), 'utf8');
  const detailPage = await readFile(new URL('../../app/book/[workId]/page.tsx', import.meta.url), 'utf8');

  assert.match(searchPage, /serializeSearchReturnPath\(resolvedSearchParams\)/);
  assert.match(searchUi, /\{ kind: 'search', path: searchReturnTo \}/);
  assert.match(searchUi, /detailReturnContext=\{detailReturnContext\}/);
  assert.match(detailPage, /resolveBookReturnNavigation/);
  assert.match(detailPage, /returnNavigation=\{returnNavigation\}/);
});

test('primary homepage CTA uses the existing taste test in both locales', async () => {
  const home = await readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8');
  const translations = await readFile(new URL('../i18n/translations.ts', import.meta.url), 'utf8');

  assert.match(home, /className="primary-cta" href="\/taste-test">\{t\('home\.tasteTestCta'\)\}/);
  assert.match(translations, /'home\.tasteTestCta': 'Take the taste test'/);
  assert.match(translations, /'home\.tasteTestCta': 'Doe de smaaktest'/);
  assert.doesNotMatch(home, /className="primary-cta" href="#discover">\{t\('home\.findNext'\)\}/);
});
