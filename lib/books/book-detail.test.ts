import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import {
  getBookMetadataDescription,
  getCatalogSourceLabel,
  getVerifiedBackCover,
  isCatalogWorkId,
} from './book-detail.ts';
import { getBookHref } from './book-navigation.ts';

const fixture = (overrides: Partial<Book> = {}): Book => ({
  id: 'work-42',
  source: 'supabase',
  workId: '42',
  sourceType: 'open_library',
  openLibraryWorkId: 'OL42W',
  title: 'Dune',
  author: 'Frank Herbert',
  firstPublishYear: 1965,
  score: null,
  ratingsCount: null,
  match: null,
  cover: 'orbit',
  ...overrides,
});

test('accepts positive internal database IDs and rejects invalid routes', () => {
  assert.equal(isCatalogWorkId('1'), true);
  assert.equal(isCatalogWorkId('1301'), true);
  assert.equal(isCatalogWorkId('0'), false);
  assert.equal(isCatalogWorkId('OL42W'), false);
  assert.equal(isCatalogWorkId('not-a-book'), false);
});

test('builds detail links only from real Supabase works.id values', () => {
  assert.equal(
    getBookHref({
      ...fixture(),
      workId: '8',
    }),
    '/book/8',
  );
  assert.equal(
    getBookHref(fixture({ id: 'demo-book', source: 'demo', workId: null })),
    null,
  );
  assert.equal(
    getBookHref(fixture({ workId: 'not-an-id' })),
    null,
  );
});

test('labels Open Library and LumiScore-native works without changing routing identity', () => {
  assert.equal(getCatalogSourceLabel(fixture()), 'Open Library catalog');
  assert.equal(
    getCatalogSourceLabel(
      fixture({ sourceType: 'lumiscore_native', openLibraryWorkId: null }),
    ),
    'LumiScore catalog',
  );
});

test('builds useful metadata without inventing missing publication data', () => {
  assert.equal(
    getBookMetadataDescription(fixture()),
    'Dune by Frank Herbert, first published in 1965. View book information and its LumiScore rating status.',
  );
  assert.equal(
    getBookMetadataDescription(
      fixture({ title: 'Vogeleiland', author: 'Marion Pauw', firstPublishYear: null }),
    ),
    'Vogeleiland by Marion Pauw. View book information and its LumiScore rating status.',
  );
});

test('keeps verified back-cover media separate and tied to the edition ISBN', () => {
  const backCover = {
    side: 'back' as const,
    url: 'https://metadata.example.test/dune-back.jpg',
    source: 'trusted-onix-feed',
    sourceKey: '9780441172719:back',
    isbn13: '9780441172719',
    verified: true as const,
  };

  assert.equal(
    getVerifiedBackCover(
      fixture({ isbn13: '9780441172719', backCover }),
    ),
    backCover,
  );
  assert.equal(
    getVerifiedBackCover(
      fixture({
        isbn13: '9780441172719',
        backCover: { ...backCover, isbn13: '9780593099322' },
      }),
    ),
    null,
  );
  assert.equal(
    getVerifiedBackCover(
      fixture({ backCover: { ...backCover, url: 'http://example.test/back.jpg' } }),
    ),
    null,
  );
});
