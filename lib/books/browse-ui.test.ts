import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { translate } from '../i18n/translations.ts';

test('public browse route loads catalog books without requiring a search query or login', async () => {
  const page = await readFile(
    new URL('../../app/browse/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /loadCatalogBrowsePage\(page, sort, locale\)/);
  assert.match(page, /<LumiScoreBrowsePage data=\{data\} authState=\{authState\}/);
  assert.doesNotMatch(page, /redirect\(|notFound\(/);
  assert.doesNotMatch(page, /\bq\b.*required|isCatalogSearchQuery/);
});

test('browse cards reuse BookCard and therefore canonical native book links', async () => {
  const [browseSource, homeSource] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBrowsePage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(browseSource, /<BookCard/);
  assert.match(browseSource, /resolveMissingCover=\{false\}/);
  assert.match(homeSource, /const href = getBookHref\(book\)/);
  assert.match(homeSource, /className="book-card-main-link"[\s\S]*?href=\{href\}/);
});

test('Browse is reachable in desktop and mobile navigation and search has a browse escape', async () => {
  const [homeSource, searchSource] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreSearchPage.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(homeSource, /<a href="\/browse">\{t\('header\.browse'\)\}<\/a>/);
  assert.match(homeSource, /mobile-navigation-panel[\s\S]*?<a href="\/browse">/);
  assert.match(homeSource, /mobile-navigation-panel[\s\S]*?<a href="\/collections">/);
  assert.match(searchSource, /className="empty-results-action" href="\/browse"/);
});

test('new browse and collection UI copy is complete in English and Dutch', () => {
  assert.equal(translate('en', 'header.browse'), 'Browse');
  assert.equal(translate('nl', 'header.browse'), 'Ontdekken');
  assert.equal(translate('en', 'browse.collections'), 'Collections');
  assert.equal(translate('nl', 'browse.collections'), 'Collecties');
  assert.equal(translate('en', 'collections.bookCount', { count: 5 }), '5 books');
  assert.equal(translate('nl', 'collections.bookCount', { count: 5 }), '5 boeken');
  assert.doesNotMatch(translate('en', 'collections.copy'), /complete|incomplete/i);
  assert.doesNotMatch(translate('nl', 'collections.copy'), /compleet|incompleet/i);
});

test('collection discovery and detail expose counts without completeness copy', async () => {
  const [directorySource, detailSource] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreCollectionsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreCollectionPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(directorySource, /item\.cataloguedBookCount/);
  assert.match(directorySource, /'collections\.bookCount'/);
  assert.doesNotMatch(directorySource, /collections\.(?:completeCount|coverageCount)/);
  assert.match(detailSource, /className="collection-book-count"/);
  assert.match(detailSource, /books\.length/);
  assert.doesNotMatch(detailSource, /collection\.seriesComplete|collection-complete/);
});
