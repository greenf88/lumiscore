import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  calculateSeriesProgress,
  type CollectionBook,
  type ReadingStatus,
} from '../collections/model.ts';
import { translate } from '../i18n/translations.ts';

function seriesBook(position: number): CollectionBook {
  return {
    workId: String(position),
    sequenceNumber: position,
    publicationOrder: position,
    subgroup: null,
    book: {
      id: `work-${position}`,
      source: 'supabase',
      workId: String(position),
      title: `Book ${position}`,
      author: 'Author',
      firstPublishYear: 2000 + position,
      score: null,
      ratingsCount: 0,
      match: null,
      cover: 'orbit',
    } satisfies Book,
  };
}

test('public browse route loads catalog books without requiring a search query or login', async () => {
  const page = await readFile(
    new URL('../../app/browse/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /loadCatalogBrowsePage\(page, sort, pageSize, locale\)/);
  assert.match(page, /<LumiScoreBrowsePage data=\{data\} authState=\{authState\} returnTo=\{returnTo\}/);
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
  assert.match(browseSource, /detailReturnContext=\{detailReturnContext\}/);
  assert.match(homeSource, /const href = getBookHref\(book\)/);
  assert.match(homeSource, /className="book-card-main-link"[\s\S]*?href=\{href\}/);
});

test('Browse exposes an accessible native page-size control and keeps page size in navigation', async () => {
  const browseSource = await readFile(
    new URL('../../app/components/LumiScoreBrowsePage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(browseSource, /<label htmlFor="browse-page-size">\{t\('browse\.pageSize'\)\}<\/label>/);
  assert.match(browseSource, /<select[\s\S]*?id="browse-page-size"[\s\S]*?name="pageSize"/);
  assert.match(browseSource, /CATALOG_BROWSE_PAGE_SIZES\.map/);
  assert.match(browseSource, /getCatalogBrowsePageAfterPageSizeChange/);
  assert.match(browseSource, /window\.location\.assign/);
  assert.match(browseSource, /updateBrowseReturnPath\(returnTo/);
});

test('128-card Browse pages keep ratings and stored-cover reads batched', async () => {
  const [booksSource, browseSource, homeSource, statusRoute, statusLoader] = await Promise.all([
    readFile(new URL('../supabase/books.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreBrowsePage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/book-status/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/book-status.ts', import.meta.url), 'utf8'),
  ]);
  const loader = booksSource.slice(
    booksSource.indexOf('export async function loadCatalogBrowsePage'),
    booksSource.indexOf('export async function loadHomepageCatalog'),
  );

  assert.match(loader, /Promise\.all\(\[[\s\S]*?loadPublicRatingSummariesBatched\(supabase, workIds\)[\s\S]*?loadStoredCoverResolutionsBatched\(workIds\)/);
  assert.doesNotMatch(loader, /for \([^)]*book[^)]*\)[\s\S]*?await/);
  assert.match(browseSource, /resolveMissingCover=\{false\}/);
  assert.match(homeSource, /loading="lazy"/);
  assert.match(statusRoute, /\.slice\(0, 128\)/);
  assert.match(statusLoader, /MAX_STATUS_LOOKUP_WORK_IDS = 128/);
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
  assert.equal(translate('en', 'browse.pageSize'), 'Books per page');
  assert.equal(translate('nl', 'browse.pageSize'), 'Boeken per pagina');
  assert.equal(translate('en', 'collections.bookCount', { count: 5 }), '5 books');
  assert.equal(translate('nl', 'collections.bookCount', { count: 5 }), '5 boeken');
  assert.doesNotMatch(translate('en', 'collections.copy'), /complete|incomplete/i);
  assert.doesNotMatch(translate('nl', 'collections.copy'), /compleet|incompleet/i);
});

test('collection discovery and detail expose catalog counts without completeness marketing', async () => {
  const [directorySource, detailSource] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreCollectionsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreCollectionPage.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(directorySource, /item\.cataloguedBookCount/);
  assert.match(directorySource, /'collections\.bookCount'/);
  assert.doesNotMatch(directorySource, /collections\.(?:completeCount|coverageCount)/);
  assert.match(detailSource, /className="collection-book-count"/);
  assert.match(detailSource, /books\.length/);
});

test('completed-series state requires a genuinely complete reviewed series', () => {
  const books = [seriesBook(1), seriesBook(2), seriesBook(3)];
  const completeStatuses = new Map<string, ReadingStatus>([
    ['1', 'read'],
    ['2', 'read'],
    ['3', 'read'],
  ]);
  const incompleteStatuses = new Map<string, ReadingStatus>([
    ['1', 'read'],
    ['2', 'reading'],
    ['3', 'want_to_read'],
  ]);

  assert.equal(calculateSeriesProgress(books, completeStatuses, 3).complete, true);
  assert.equal(calculateSeriesProgress(books, incompleteStatuses, 3).complete, false);
  assert.equal(calculateSeriesProgress(books.slice(0, 2), completeStatuses, 3).complete, false);
});

test('collection detail renders translated completion only inside authenticated complete state', async () => {
  const detailSource = await readFile(
    new URL('../../app/components/LumiScoreCollectionPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    detailSource,
    /\{authenticated \? \([\s\S]*?\{seriesProgress\?\.complete \? \([\s\S]*?<p className="collection-complete">\{t\('collection\.seriesComplete'\)\}<\/p>[\s\S]*?\) : actionBook \? \(/,
  );
  assert.match(
    detailSource,
    /\) : \([\s\S]*?className="status-sign-in collection-sign-in"[\s\S]*?collection\.signInTrack/,
  );
  assert.equal(
    detailSource.match(/className="collection-complete"/g)?.length,
    1,
  );
  assert.equal(translate('en', 'collection.seriesComplete'), 'Series complete');
  assert.equal(translate('nl', 'collection.seriesComplete'), 'Reeks voltooid');
});
