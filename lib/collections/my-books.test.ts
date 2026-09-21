import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  countMyBooksByStatus,
  createGuestWantToReadItems,
  filterMyBooks,
  MY_BOOKS_STATUSES,
  type MyBooksItem,
} from './my-books.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const header = read('../../app/components/LumiScoreHome.tsx');
const page = read('../../app/components/LumiScoreMyBooks.tsx');
const guestMyBooksSource = page.slice(
  page.indexOf('function GuestMyBooks'),
  page.indexOf('export function LumiScoreMyBooks'),
);
const route = read('../../app/my-books/page.tsx');
const guestCatalogRoute = read('../../app/api/catalog/books/route.ts');
const detail = read('../../app/components/LumiScoreBookDetail.tsx');
const detailModel = read('../books/book-detail.ts');
const statusLoader = read('../supabase/book-status.ts');
const guestHook = read('../../app/components/useWantToRead.ts');
const signOutRoute = read('../../app/auth/sign-out/route.ts');
const translations = read('../i18n/translations.ts');
const styles = read('../../app/globals.css');
const migration = read('../../supabase/migrations/20260916071439_collections_v1.sql');

function book(workId: string, title: string): Book {
  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title,
    author: 'Reader',
    score: null,
    ratingsCount: 0,
    match: null,
    cover: 'orbit',
  };
}

const items: MyBooksItem[] = MY_BOOKS_STATUSES.map((status, index) => ({
  book: book(String(index + 1), status),
  status,
  updatedAt: null,
}));

test('each My Books tab exposes only its matching reading status', () => {
  for (const status of MY_BOOKS_STATUSES) {
    const visible = filterMyBooks(items, status);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].status, status);
  }
  assert.deepEqual(countMyBooksByStatus(items), {
    want_to_read: 1,
    reading: 1,
    read: 1,
    dnf: 1,
  });
});

test('header exposes active English and Dutch My Books navigation', () => {
  assert.match(header, /<a className="my-books-nav-link" href="\/my-books">/);
  assert.match(header, /mobile-navigation-panel/);
  assert.match(translations, /'header\.myBooks': 'My books'/);
  assert.match(translations, /'header\.myBooks': 'Mijn boeken'/);
  assert.doesNotMatch(header, /nav-unavailable|header\.myLists/);
});

test('logged-out My Books renders the local guest experience without an auth gate', () => {
  assert.match(route, /loadMyBooksPageData/);
  assert.match(page, /!data\.authenticated/);
  assert.match(page, /<GuestMyBooks \/>/);
  assert.match(page, /href="\/login\?next=%2Fmy-books"/);
  assert.match(page, /myBooks\.guestSignInCopy/);
  assert.doesNotMatch(page, /className="my-books-gate"/);
});

test('guest Want to Read books preserve local order, de-duplicate and skip stale works', () => {
  const guestItems = createGuestWantToReadItems(
    [book('8', 'Dune'), book('1300', 'Dwaalspoor')],
    ['1300', '404', '8', '1300'],
  );
  assert.deepEqual(guestItems.map((item) => item.book.workId), ['1300', '8']);
  assert.ok(guestItems.every((item) => item.status === 'want_to_read'));
  assert.ok(guestItems.every((item) => item.updatedAt === null));
});

test('guest catalog metadata and ratings are loaded in one batched request', () => {
  assert.match(page, /\/api\/catalog\/books\?workIds=/);
  assert.match(guestCatalogRoute, /loadCatalogBooksByIdsWithStoredCovers\(workIds\)/);
  assert.match(guestCatalogRoute, /createGuestWantToReadItems\(books, workIds\)/);
  assert.doesNotMatch(guestCatalogRoute, /for \([^)]*workIds[^)]*\)[\s\S]{0,100}await/);
});

test('My Books loads only the current user statuses and batches associated books', () => {
  assert.match(statusLoader, /from\('user_book_status'\)/);
  assert.match(statusLoader, /\.eq\('user_id', user\.id\)/);
  assert.match(statusLoader, /loadCatalogBooksByIds\(rows\.map/);
  assert.doesNotMatch(statusLoader, /loadCatalogBooks\(1303\)|from\('auth\.users'\)/);
});

test('safe guest migration is shared and never overwrites an existing status', () => {
  assert.match(page, /migrateGuestWantToReadFromLocal/);
  assert.match(guestHook, /localStorage\.removeItem\(GUEST_WANTED_STORAGE_KEY\)/);
  assert.match(statusLoader, /from\('works'\)/);
  assert.match(statusLoader, /catalogIds/);
  assert.match(statusLoader, /planGuestWantToReadMigration/);
  assert.match(statusLoader, /ratedWorksPreserved/);
});

test('logout never copies authenticated statuses into guest storage', () => {
  assert.match(signOutRoute, /supabase\.auth\.signOut\(\)/);
  assert.doesNotMatch(signOutRoute, /localStorage|lumiscore-wanted|user_book_status/);
  assert.match(guestHook, /if \(!authenticated \|\| !book\.workId\)/);
});

test('rating to Read consistency remains database-backed', () => {
  assert.match(migration, /sync_rating_to_read_status/);
  assert.match(migration, /values \(new\.user_id, new\.work_id, 'read'\)/);
  assert.match(page, /useState<ReadingStatus>\('want_to_read'\)/);
  assert.match(guestHook, /existingStatus !== 'want_to_read'/);
  assert.match(header, /status && status !== 'want_to_read'/);
});

test('localized empty states and direct status mutation are present', () => {
  assert.match(page, /EMPTY_KEYS\[activeStatus\]/);
  assert.match(page, /LumiScoreReadingStatus/);
  assert.match(page, /updateItemStatus/);
  assert.match(translations, /You haven't saved any books yet/);
  assert.match(translations, /Je hebt nog geen boeken opgeslagen/);
  assert.match(translations, /Find a book and add it to Want to Read/);
  assert.match(translations, /Zoek een boek en voeg het toe aan Wil ik lezen/);
});

test('guest My Books exposes only Want to Read with shared local removal', () => {
  assert.match(page, /useWantToRead\(false, books\)/);
  assert.match(page, /toggleWanted\(book\)/);
  assert.match(page, /my-books-remove/);
  assert.match(page, /resolveMissing=\{authenticated\}/);
  assert.doesNotMatch(guestMyBooksSource, /MY_BOOKS_STATUSES|myBooks\.reading|myBooks\.read|myBooks\.dnf/);
  assert.match(translations, /Remove \{title\} from Want to Read/);
  assert.match(translations, /Verwijder \{title\} uit Wil ik lezen/);
});

test('book detail reflects the same guest Want to Read state', () => {
  assert.match(detail, /function GuestWantToRead/);
  assert.match(detail, /useWantToRead\(false, \[book\]\)/);
  assert.match(detail, /getGuestWantedStorageId\(book\)/);
  assert.match(detail, /aria-pressed=\{isWanted\}/);
});

test('guest sign-in copy explains sync benefits without blocking local books', () => {
  assert.match(translations, /Sign in to keep your books across devices and track Reading, Read and DNF/);
  assert.match(translations, /Log in om je boeken op al je apparaten te bewaren/);
  assert.match(page, /my-books-guest-cta/);
  assert.match(page, /state\.items\.length > 0/);
});

test('Open Library source removal is presentation-only', () => {
  assert.doesNotMatch(detail, /getCatalogSourceLabel|openLibraryCatalog/);
  assert.match(detailModel, /export function getCatalogSourceLabel/);
  assert.match(detailModel, /detail\.openLibraryCatalog/);
});

test('book-detail back navigation remains a plain, stronger accessible link', () => {
  assert.match(detail, /href=\{returnNavigation\.href\}/);
  assert.match(detail, /detail\.backToCollection/);
  assert.match(detail, /detail\.backToCollections/);
  assert.match(detail, /detail\.backToSearch/);
  assert.match(detail, /detail\.backToBooks/);
  assert.match(styles, /\.book-detail \.detail-back-link \{[^}]*font-size: 16px/);
  assert.match(styles, /\.detail-back-link \{[^}]*min-height: 44px/);
});

test('responsive header swaps crowded links for a compact navigation menu', () => {
  assert.match(styles, /@media \(max-width: 1040px\)[\s\S]*\.mobile-navigation \{ position: static; display: block; \}/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.main-nav > \.taste-test-nav-link \{ display: none; \}/);
  assert.match(styles, /\.mobile-navigation-trigger \{[^}]*min-height: 44px/);
});

test('guest cards and CTA retain mobile-safe layout and tap targets', () => {
  assert.match(styles, /\.my-books-remove \{[^}]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.my-books-guest-cta \{[^}]*flex-direction: column/);
  assert.match(styles, /\.my-books-grid \{ max-width: 290px; grid-template-columns: 1fr/);
});
