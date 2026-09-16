import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  countMyBooksByStatus,
  filterMyBooks,
  MY_BOOKS_STATUSES,
  type MyBooksItem,
} from './my-books.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const header = read('../../app/components/LumiScoreHome.tsx');
const page = read('../../app/components/LumiScoreMyBooks.tsx');
const route = read('../../app/my-books/page.tsx');
const detail = read('../../app/components/LumiScoreBookDetail.tsx');
const detailModel = read('../books/book-detail.ts');
const statusLoader = read('../supabase/book-status.ts');
const guestHook = read('../../app/components/useWantToRead.ts');
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

test('logged-out My Books state preserves the return route', () => {
  assert.match(route, /loadMyBooksPageData/);
  assert.match(page, /!data\.authenticated/);
  assert.match(page, /href="\/login\?next=%2Fmy-books"/);
  assert.match(page, /myBooks\.signInHeading/);
});

test('My Books loads only the current user statuses and batches associated books', () => {
  assert.match(statusLoader, /from\('user_book_status'\)/);
  assert.match(statusLoader, /\.eq\('user_id', user\.id\)/);
  assert.match(statusLoader, /loadCatalogBooksByIds\(rows\.map/);
  assert.doesNotMatch(statusLoader, /loadCatalogBooks\(1303\)|from\('auth\.users'\)/);
});

test('safe guest migration is shared and never overwrites an existing status', () => {
  assert.match(page, /migrateGuestWantToReadFromLocal/);
  assert.match(guestHook, /localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(statusLoader, /missing = ids\.filter/);
  assert.match(statusLoader, /existingIds/);
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
});

test('Open Library source removal is presentation-only', () => {
  assert.doesNotMatch(detail, /getCatalogSourceLabel|openLibraryCatalog/);
  assert.match(detailModel, /export function getCatalogSourceLabel/);
  assert.match(detailModel, /detail\.openLibraryCatalog/);
});

test('book-detail back navigation remains a plain, stronger accessible link', () => {
  assert.match(detail, /<a className="detail-back-link" href="\/">←/);
  assert.match(styles, /\.book-detail \.detail-back-link \{[^}]*font-size: 16px/);
  assert.match(styles, /\.detail-back-link \{[^}]*min-height: 44px/);
});

test('responsive header swaps crowded links for a compact navigation menu', () => {
  assert.match(styles, /@media \(max-width: 1040px\)[\s\S]*\.mobile-navigation \{ position: static; display: block; \}/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.main-nav > \.taste-test-nav-link \{ display: none; \}/);
  assert.match(styles, /\.mobile-navigation summary \{[^}]*min-height: 44px/);
});
